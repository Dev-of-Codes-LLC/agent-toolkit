<#
.SYNOPSIS
  Tiered Docker cleanup driven by audit.ps1. Dry run unless -Execute.

.DESCRIPTION
  Re-runs the audit, picks the resources that belong to the requested
  tiers, prints exactly what would be removed and the commands used, and
  only removes anything when -Execute is present.

  Tiers, from safest to most consequential:
    cache        build-cache records unused for more than -KeepCacheDays
    builders     buildx builders whose endpoint is gone
    networks     compose networks whose project has no containers
    containers   exited containers outside protected projects
    images       dangling images and builds of torn-down projects
                 (-IncludePulled adds unused pulled images older than
                 -StaleDays; -IncludeLocalUnmatched adds local builds that
                 match no compose project, such as devcontainer images)
    volumes      never implied. Needs -VolumeProject <name> or -Volume
                 <names>; refuses in-use volumes and protected projects.
                 -AnonymousEmpty additionally removes anonymous volumes
                 that hold 0 bytes.

  -Project <pattern,...> (for example acme-*) limits the networks,
  containers, and images tiers to matching compose projects, so one
  project family can be cleared without touching the others' builds.

.EXAMPLE
  .\cleanup.ps1 -Tier cache,builders,networks,images
  .\cleanup.ps1 -Tier cache,builders,networks,images -Execute
  .\cleanup.ps1 -Tier volumes -VolumeProject acme-legacy -Execute
#>
[CmdletBinding()]
param(
  [string[]]$Tier = @('cache', 'builders', 'networks', 'containers', 'images'),
  [switch]$Execute,
  [int]$StaleDays = 30,
  [int]$KeepCacheDays = 7,
  [string[]]$Protected = @(),
  [string[]]$Project = @(),
  [switch]$IncludePulled,
  [switch]$IncludeLocalUnmatched,
  [string[]]$Volume = @(),
  [string]$VolumeProject,
  [switch]$AnonymousEmpty
)

$ErrorActionPreference = 'Stop'

# `powershell -File cleanup.ps1 -Tier a,b` delivers one string "a,b"; split every list parameter.
function Split-List([string[]]$v) { @($v | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
$Tier = Split-List $Tier; $Protected = Split-List $Protected; $Volume = Split-List $Volume; $Project = Split-List $Project
function Test-ProjectSelected([string]$name) {
  if ($Project.Count -eq 0) { return $true }
  foreach ($pattern in $Project) { if ($name -like $pattern) { return $true } }
  return $false
}
$validTiers = @('cache', 'builders', 'networks', 'containers', 'images', 'volumes')
foreach ($t in $Tier) { if ($t -notin $validTiers) { throw "Unknown tier '$t'. Valid: $($validTiers -join ', ')" } }

function Invoke-Docker([string[]]$dockerArgs) {
  # See audit.ps1: keep Docker's stderr from becoming a terminating error in PowerShell 5.1.
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $out = & docker @dockerArgs 2>&1 } finally { $ErrorActionPreference = $prev }
  return @($out | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | ForEach-Object { "$_" })
}

function Format-Bytes([long]$b) {
  if ($b -ge 1e9) { return ('{0:N2} GB' -f ($b / 1e9)) }
  if ($b -ge 1e6) { return ('{0:N1} MB' -f ($b / 1e6)) }
  if ($b -ge 1e3) { return ('{0:N0} kB' -f ($b / 1e3)) }
  return "$b B"
}

$mode = if ($Execute) { 'EXECUTE' } else { 'DRY RUN (add -Execute to apply)' }
Write-Output "docker cleanup: $mode"
Write-Output ''

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("docker-audit-{0}.json" -f [guid]::NewGuid().ToString('n'))
& (Join-Path $PSScriptRoot 'audit.ps1') -Protected $Protected -StaleDays $StaleDays -JsonOut $tmp -Quiet
$a = Get-Content $tmp -Raw | ConvertFrom-Json
Remove-Item $tmp -Force
$protected = @($a.ProtectedProjects)

$before = (Invoke-Docker @('system', 'df')) -join "`n"
$actions = @()   # each: @{ Tier; Label; Cmd (string[]); Frees }

function Add-Action([string]$tier, [string]$label, [string[]]$cmd, [long]$frees = 0) {
  $script:actions += [pscustomobject]@{ Tier = $tier; Label = $label; Cmd = $cmd; Frees = $frees }
}

# ---- cache
if ('cache' -in $Tier) {
  $hours = $KeepCacheDays * 24
  # buildx du has no per-record removal; the audit's stale figure (records unused >= StaleDays) is the lower bound of what this frees
  $frees = [long]$a.BuildCache.StaleBytes
  # Upper bound: BuildKit keeps an old record while a newer record still depends on it, so the prune
  # usually returns less than this. The command's own "Total:" line is the real figure.
  Add-Action 'cache' "build-cache records unused for more than $KeepCacheDays days (up to $($a.BuildCache.StaleRecords) records unused >= $StaleDays days, $(Format-Bytes $frees); parents of recent layers are kept)" @('buildx', 'prune', '--force', '--filter', "unused-for=${hours}h") $frees
}

# ---- builders
if ('builders' -in $Tier) {
  foreach ($b in @($a.BrokenBuilders)) {
    if ($b.CurrentContext) { Write-Output "builders tier: '$($b.Name)' is the current Docker context; switch away with 'docker context use' before removing it. Skipped."; continue }
    if ($b.IsContext) { Add-Action 'builders' "docker context '$($b.Name)' (builder endpoint unreachable)" @('context', 'rm', $b.Name) }
    else { Add-Action 'builders' "buildx builder '$($b.Name)' (endpoint unreachable)" @('buildx', 'rm', $b.Name) }
  }
}

# ---- networks
if ('networks' -in $Tier) {
  foreach ($n in @($a.Networks | Where-Object { $_.Class -eq 'orphan' -and (Test-ProjectSelected $_.Project) })) { Add-Action 'networks' "network $($n.Name) (project $($n.Project) has no containers)" @('network', 'rm', $n.Name) }
}

# ---- containers
if ('containers' -in $Tier) {
  foreach ($c in @($a.Containers | Where-Object { $_.State -ne 'running' -and $_.Project -notin $protected -and (Test-ProjectSelected $_.Project) })) {
    Add-Action 'containers' "container $($c.Name) [$($c.State), project $($c.Project)]" @('rm', $c.Id)
  }
}

# ---- images
if ('images' -in $Tier) {
  $classes = @('dangling', 'project-residue')
  if ($IncludePulled) { $classes += 'pulled-stale' }
  if ($IncludeLocalUnmatched) { $classes += 'local-unmatched' }
  # -Project narrows compose builds; dangling and pulled images have no project and pass through untouched by the filter
  foreach ($i in @($a.Images | Where-Object { $_.Class -in $classes -and $_.Containers -eq 0 -and ($_.Class -ne 'project-residue' -or (Test-ProjectSelected $_.Project)) } | Sort-Object UniqueBytes -Descending)) {
    Add-Action 'images' "image $($i.Ref) [$($i.Class), frees $(Format-Bytes $i.UniqueBytes)]" @('image', 'rm', $i.Ref) ([long]$i.UniqueBytes)
  }
}

# ---- volumes
if ('volumes' -in $Tier) {
  $targets = @()
  if ($VolumeProject) {
    $p = $a.Projects | Where-Object Name -eq $VolumeProject
    if (-not $p) { throw "No compose project named '$VolumeProject' owns any volume." }
    if ($p.Protected) { throw "Project '$VolumeProject' is protected (running or listed in -Protected); refusing." }
    $targets += @($a.Volumes | Where-Object Project -eq $VolumeProject)
  }
  foreach ($name in $Volume) {
    $v = $a.Volumes | Where-Object Name -eq $name
    if (-not $v) { throw "Volume '$name' does not exist." }
    $targets += $v
  }
  if ($AnonymousEmpty) { $targets += @($a.Volumes | Where-Object Class -eq 'anonymous-empty') }
  if ($targets.Count -eq 0) {
    Write-Output 'volumes tier: nothing selected. Volumes hold data, so name them with -VolumeProject <project>, -Volume <name,...>, or -AnonymousEmpty.'
  }
  foreach ($v in ($targets | Sort-Object Name -Unique)) {
    if ($v.Links -gt 0) { throw "Volume '$($v.Name)' is attached to a container; refusing." }
    if ($v.Project -and $v.Project -in $protected) { throw "Volume '$($v.Name)' belongs to protected project '$($v.Project)'; refusing." }
    Add-Action 'volumes' "volume $($v.Name) [$($v.Class), $(Format-Bytes $v.Bytes)] -- DATA, make sure a backup exists or the data is disposable" @('volume', 'rm', $v.Name) ([long]$v.Bytes)
  }
}

# ---- plan
if ($actions.Count -eq 0) { Write-Output 'Nothing to do for the selected tiers.'; return }

foreach ($t in @('cache', 'builders', 'networks', 'containers', 'images', 'volumes')) {
  $g = @($actions | Where-Object Tier -eq $t)
  if ($g.Count -eq 0) { continue }
  Write-Output "-- $t ($($g.Count)) --"
  foreach ($x in $g) { Write-Output ("  {0}`n      docker {1}" -f $x.Label, ($x.Cmd -join ' ')) }
}
$estimate = ($actions | Measure-Object Frees -Sum).Sum
Write-Output ''
Write-Output ("estimated space freed: {0} (image figures count unique layers only; shared layers stay until every image using them is gone)" -f (Format-Bytes $estimate))

if (-not $Execute) { Write-Output ''; Write-Output 'Dry run only. Re-run with -Execute to apply exactly this plan.'; return }

# ---- execute
Write-Output ''
$failed = @()
foreach ($x in $actions) {
  Write-Output ("> docker {0}" -f ($x.Cmd -join ' '))
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $out = & docker @($x.Cmd) 2>&1; $code = $LASTEXITCODE } finally { $ErrorActionPreference = $prev }
  $text = (($out | ForEach-Object { "$_" }) -join "`n").Trim()
  if ($code -ne 0) { $failed += $x; Write-Output ("  FAILED: {0}" -f $text) }
  elseif ($x.Tier -eq 'cache' -and $text) { Write-Output ("  {0}" -f ($text -split "`n" | Select-Object -Last 1)) }
}

Write-Output ''
Write-Output '== before =='; Write-Output $before
Write-Output '== after =='; Invoke-Docker @('system', 'df') | ForEach-Object { Write-Output $_ }
if ($failed.Count -gt 0) {
  Write-Output ''
  Write-Output "$($failed.Count) action(s) failed; nothing was retried:"
  $failed | ForEach-Object { Write-Output ("  {0}" -f $_.Label) }
  exit 1
}
