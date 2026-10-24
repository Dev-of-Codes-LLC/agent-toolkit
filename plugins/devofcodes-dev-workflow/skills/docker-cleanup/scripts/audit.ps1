<#
.SYNOPSIS
  Read-only audit of the local Docker environment, classified for cleanup.

.DESCRIPTION
  Groups every container, volume, network, and locally built image by its
  Docker Compose project, then labels each resource so a cleanup can be
  planned tier by tier:

    live             a project with running containers (always protected)
    stopped          a project whose containers all exited
    residue          a project with no containers left, only volumes,
                     networks, or images (typical after `compose down`
                     without `-v` or `--rmi local`)

  Nothing here changes state. Use cleanup.ps1 for that.

.PARAMETER Protected
  Extra Compose project names that must never be proposed for cleanup,
  on top of every project that currently has a running container.

.PARAMETER StaleDays
  Age after which an unused pulled image or a build-cache record counts
  as stale. Default 30.

.PARAMETER JsonOut
  Write the full classified inventory to this path as JSON.

.PARAMETER Quiet
  Skip the human-readable report (used by cleanup.ps1).
#>
[CmdletBinding()]
param(
  [string[]]$Protected = @(),
  [int]$StaleDays = 30,
  [string]$JsonOut,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$culture = [Globalization.CultureInfo]::InvariantCulture

# `powershell -File x.ps1 -Protected a,b` delivers one string "a,b"; split it.
$Protected = @($Protected | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

# ---------------------------------------------------------------- helpers

function Invoke-Docker([string[]]$dockerArgs) {
  # Docker writes warnings (for example unreachable buildx builders) to stderr.
  # Under $ErrorActionPreference = 'Stop', Windows PowerShell 5.1 turns that
  # into a terminating NativeCommandError, so run with Continue and drop the
  # error records; the exit code still tells us whether the call worked.
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $out = & docker @dockerArgs 2>&1 } finally { $ErrorActionPreference = $prev }
  return @($out | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | ForEach-Object { "$_" })
}

function ConvertTo-Bytes([string]$s) {
  if (-not $s -or $s -eq 'N/A') { return 0L }
  if ($s -match '^\s*([\d.]+)\s*([kMGT]?)B\s*$') {
    $n = [double]::Parse($Matches[1], $culture)
    switch ($Matches[2]) {
      'k' { return [long]($n * 1e3) }
      'M' { return [long]($n * 1e6) }
      'G' { return [long]($n * 1e9) }
      'T' { return [long]($n * 1e12) }
      default { return [long]$n }
    }
  }
  return 0L
}

function Format-Bytes([long]$b) {
  if ($b -ge 1e9) { return ('{0:N2} GB' -f ($b / 1e9)) }
  if ($b -ge 1e6) { return ('{0:N1} MB' -f ($b / 1e6)) }
  if ($b -ge 1e3) { return ('{0:N0} kB' -f ($b / 1e3)) }
  return "$b B"
}

function ConvertFrom-DockerDate([string]$s) {
  # "2026-09-26 17:52:13 -0700 PDT"  or  "2026-01-23 02:55:51.176900253 +0000 UTC"
  if (-not $s) { return $null }
  if ($s -match '^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:\.\d+)? ([+-]\d{2})(\d{2})') {
    $txt = '{0} {1}:{2}' -f $Matches[1], $Matches[2], $Matches[3]
    try { return [DateTimeOffset]::ParseExact($txt, 'yyyy-MM-dd HH:mm:ss zzz', $culture) } catch { return $null }
  }
  return $null
}

function ConvertFrom-RelativeAge([string]$s) {
  # "7 months ago", "About an hour ago", "2 weeks ago" -> approximate days
  if (-not $s) { return $null }
  if ($s -match '(\d+)\s+(second|minute|hour|day|week|month|year)') {
    $n = [int]$Matches[1]
    switch ($Matches[2]) {
      'second' { return 0 } 'minute' { return 0 } 'hour' { return 0 }
      'day' { return $n } 'week' { return 7 * $n } 'month' { return 30 * $n } 'year' { return 365 * $n }
    }
  }
  return 0
}

function ConvertFrom-Labels([string]$s) {
  $h = @{}
  if (-not $s) { return $h }
  foreach ($pair in ($s -split ',')) {
    $i = $pair.IndexOf('=')
    if ($i -gt 0) { $h[$pair.Substring(0, $i)] = $pair.Substring($i + 1) }
  }
  return $h
}

function Read-DockerJson([string[]]$cmd) {
  $raw = Invoke-Docker $cmd
  if (-not $raw) { return @() }
  $out = @()
  foreach ($line in $raw) { if ($line.Trim()) { $out += ($line | ConvertFrom-Json) } }
  return $out
}

$ageDays = { param($dto) if ($dto) { [int]([DateTimeOffset]::UtcNow - $dto).TotalDays } else { $null } }

# ---------------------------------------------------------------- gather

$dfRaw = (Invoke-Docker @('system', 'df', '-v', '--format', 'json')) -join ''
$df = if ($dfRaw) { $dfRaw | ConvertFrom-Json } else { $null }

$containers = @()
foreach ($c in (Read-DockerJson @('ps', '-a', '--format', 'json'))) {
  $l = ConvertFrom-Labels $c.Labels
  $containers += [pscustomobject]@{
    Id = $c.ID; Name = $c.Names; State = $c.State; Status = $c.Status; Image = $c.Image
    Project = $l['com.docker.compose.project']; Service = $l['com.docker.compose.service']
    WorkingDir = $l['com.docker.compose.project.working_dir']
    Created = ConvertFrom-DockerDate $c.CreatedAt
  }
}

$dfVolumes = @{}
if ($df -and $df.Volumes) { foreach ($v in $df.Volumes) { $dfVolumes[$v.Name] = $v } }
$volumes = @()
foreach ($v in (Read-DockerJson @('volume', 'ls', '--format', 'json'))) {
  $l = ConvertFrom-Labels $v.Labels
  $d = $dfVolumes[$v.Name]
  $volumes += [pscustomobject]@{
    Name = $v.Name; Project = $l['com.docker.compose.project']
    Links = if ($d) { [int]$d.Links } else { 0 }
    Bytes = if ($d) { ConvertTo-Bytes $d.Size } else { 0L }
    Anonymous = ($v.Name -match '^[0-9a-f]{64}$')
    Class = $null
  }
}

$networks = @()
foreach ($n in (Read-DockerJson @('network', 'ls', '--format', 'json'))) {
  if ($n.Name -in @('bridge', 'host', 'none')) { continue }
  $l = ConvertFrom-Labels $n.Labels
  $networks += [pscustomobject]@{ Name = $n.Name; Driver = $n.Driver; Project = $l['com.docker.compose.project']; Class = $null }
}

$images = @()
if ($df -and $df.Images) {
  $ids = @($df.Images | ForEach-Object { $_.ID })
  # Compose stamps the images it builds with project and service labels. That is the
  # only reliable "built here" signal: with the containerd image store every image,
  # pulled or built, carries a RepoDigest and a buildkit comment.
  $imgLabels = @{}
  if ($ids.Count -gt 0) {
    foreach ($line in (Invoke-Docker (@('image', 'inspect') + $ids + @('--format', '{{.Id}}|{{json .Config.Labels}}')))) {
      $i = $line.IndexOf('|'); if ($i -lt 1) { continue }
      $labels = @{}
      try { $obj = $line.Substring($i + 1) | ConvertFrom-Json; if ($obj) { foreach ($p in $obj.PSObject.Properties) { $labels[$p.Name] = $p.Value } } } catch {}
      $imgLabels[$line.Substring(0, $i)] = $labels
    }
  }
  $danglingIds = @(Invoke-Docker @('images', '--filter', 'dangling=true', '--no-trunc', '-q'))
  foreach ($i in $df.Images) {
    $created = ConvertFrom-DockerDate $i.CreatedAt
    $l = $imgLabels[$i.ID]; if (-not $l) { $l = @{} }
    $untagged = ($i.Repository -eq '<none>')
    $images += [pscustomobject]@{
      Id = $i.ID; ShortId = $i.ID.Replace('sha256:', '').Substring(0, 12)
      Repository = $i.Repository; Tag = $i.Tag
      Ref = if (-not $untagged -and $i.Tag -ne '<none>') { "$($i.Repository):$($i.Tag)" } else { $i.ID }
      Containers = [int]$i.Containers
      Bytes = ConvertTo-Bytes $i.Size; UniqueBytes = ConvertTo-Bytes $i.UniqueSize
      AgeDays = & $ageDays $created
      Dangling = ($i.ID -in $danglingIds)
      Untagged = $untagged
      ComposeProject = $l['com.docker.compose.project']
      ComposeService = $l['com.docker.compose.service']
      Devcontainer = ($l.Keys -contains 'devcontainer.metadata' -or $i.Repository -like 'vsc-*')
      Project = $null; Class = $null
    }
  }
}

$cache = @()
$block = @{}
foreach ($line in ((Invoke-Docker @('buildx', 'du', '--verbose')) + @(''))) {
  if ($line -match '^(\w[\w ]*?):\s*(.*)$') { $block[$Matches[1]] = $Matches[2].Trim(); continue }
  if (-not $line.Trim() -and $block.Count -gt 0) {
    # the trailing Shared/Private/Reclaimable/Total footer parses as a block without an ID; skip it
    if (-not $block['ID']) { $block = @{}; continue }
    $cache += [pscustomobject]@{
      Id = $block['ID']; Type = $block['Type']; Bytes = ConvertTo-Bytes $block['Size']
      Shared = ($block['Shared'] -eq 'true'); Reclaimable = ($block['Reclaimable'] -eq 'true')
      LastUsedDays = ConvertFrom-RelativeAge $block['Last used']
      AgeDays = & $ageDays (ConvertFrom-DockerDate $block['Created at'])
    }
    $block = @{}
  }
}

$builders = @()
foreach ($line in (Invoke-Docker @('buildx', 'ls'))) {
  if ($line -match '^(\S+)\s+\S*\s*error\s*$' -or $line -match '^(\S+)\s+error\s*$') { $builders += $Matches[1] }
}
# A builder that is really a Docker context (old WSL-engine entries, for example) can only
# be removed with `docker context rm`; `buildx rm` refuses it. Record which ones are contexts.
$contexts = @{}
foreach ($c in (Read-DockerJson @('context', 'ls', '--format', 'json'))) { $contexts[$c.Name] = [bool]$c.Current }
$brokenBuilders = @()
foreach ($b in $builders) {
  $isCtx = $contexts.ContainsKey($b)
  $brokenBuilders += [pscustomobject]@{ Name = $b; IsContext = $isCtx; CurrentContext = ($isCtx -and $contexts[$b]) }
}

# ---------------------------------------------------------------- classify

$projectNames = @($containers.Project + $volumes.Project + $networks.Project | Where-Object { $_ } | Sort-Object -Unique)
$projects = @()
foreach ($p in $projectNames) {
  $pc = @($containers | Where-Object Project -eq $p)
  $running = @($pc | Where-Object State -eq 'running').Count
  $wd = ($pc | Select-Object -First 1).WorkingDir
  $status = if ($running -gt 0) { 'live' } elseif ($pc.Count -gt 0) { 'stopped' } else { 'residue' }
  $projects += [pscustomobject]@{
    Name = $p; Status = $status
    Protected = ($status -eq 'live' -or $p -in $Protected)
    Running = $running; Containers = $pc.Count
    WorkingDir = $wd
    WorkingDirExists = if ($wd) { Test-Path $wd } else { $null }
    Volumes = @($volumes | Where-Object Project -eq $p | ForEach-Object Name)
    VolumeBytes = ($volumes | Where-Object Project -eq $p | Measure-Object Bytes -Sum).Sum
    Networks = @($networks | Where-Object Project -eq $p | ForEach-Object Name)
    Images = @()
    ImageBytes = 0L
  }
}
$projByName = @{}; foreach ($p in $projects) { $projByName[$p.Name] = $p }
$protectedNames = @($projects | Where-Object Protected | ForEach-Object Name)

foreach ($v in $volumes) {
  $owner = if ($v.Project) { $projByName[$v.Project] } else { $null }
  $v.Class = if ($v.Links -gt 0) { 'in-use' }
    elseif ($owner -and $owner.Protected) { 'protected' }
    elseif ($owner) { 'project-residue' }
    elseif ($v.Anonymous -and $v.Bytes -eq 0) { 'anonymous-empty' }
    elseif ($v.Anonymous) { 'anonymous' }
    else { 'unlabelled' }
}

foreach ($n in $networks) {
  $owner = if ($n.Project) { $projByName[$n.Project] } else { $null }
  $n.Class = if ($owner -and $owner.Status -ne 'residue') { 'in-use' } elseif ($owner) { 'orphan' } else { 'custom' }
}

foreach ($i in $images) {
  if ($i.ComposeProject) {
    $i.Project = $i.ComposeProject
    $owner = $projByName[$i.Project]
    if ($owner) { $owner.Images += $i.Ref; $owner.ImageBytes += $i.UniqueBytes }
  }
  # A name without a registry namespace and without a compose label is either an
  # official library image (node, postgres, redis...) or a one-off local build.
  # Library names are single words; local builds almost always carry a dash or
  # underscore. hello-world is the classic exception and is harmless either way.
  $looksLocal = (-not $i.ComposeProject) -and (-not $i.Untagged) -and ($i.Repository -notmatch '/') -and ($i.Repository -match '[-_]')
  $i.Class = if ($i.Containers -gt 0) { 'in-use' }
    elseif ($i.Dangling) { 'dangling' }
    elseif ($i.Untagged) { 'digest-pinned' }          # pulled by digest (Docker MCP Toolkit does this); not dangling
    elseif ($i.Project -and $i.Project -in $protectedNames) { 'protected-project-build' }
    elseif ($i.Project) { 'project-residue' }        # compose build whose project has no containers (or no trace at all)
    elseif ($i.Devcontainer -or $looksLocal) { 'local-unmatched' }
    elseif ($i.AgeDays -ge $StaleDays) { 'pulled-stale' }
    else { 'pulled-recent' }
}

$cacheTotal = ($cache | Measure-Object Bytes -Sum).Sum
$cacheStale = @($cache | Where-Object { $_.Reclaimable -and $_.LastUsedDays -ge $StaleDays })
$cacheStaleBytes = ($cacheStale | Measure-Object Bytes -Sum).Sum

$result = [ordered]@{
  GeneratedAt = [DateTimeOffset]::UtcNow.ToString('u')
  StaleDays = $StaleDays
  ProtectedProjects = $protectedNames
  Projects = $projects
  Containers = $containers
  Images = $images
  Volumes = $volumes
  Networks = $networks
  BuildCache = [ordered]@{ Records = $cache.Count; Bytes = $cacheTotal; StaleRecords = $cacheStale.Count; StaleBytes = $cacheStaleBytes }
  BrokenBuilders = $brokenBuilders
}

if ($JsonOut) { $result | ConvertTo-Json -Depth 6 | Set-Content -Path $JsonOut -Encoding UTF8 }
if ($Quiet) { return }

# ---------------------------------------------------------------- report

function Section([string]$t) { Write-Output ''; Write-Output "== $t ==" }

Section 'Disk (docker system df)'
Invoke-Docker @('system', 'df') | ForEach-Object { Write-Output $_ }

Section 'Compose projects'
$projects | Sort-Object Status, Name | Select-Object Name, Status, Protected, Running, Containers,
  @{n = 'Vols'; e = { $_.Volumes.Count } }, @{n = 'VolSize'; e = { Format-Bytes $_.VolumeBytes } },
  @{n = 'Nets'; e = { $_.Networks.Count } }, @{n = 'Imgs'; e = { $_.Images.Count } }, @{n = 'ImgUnique'; e = { Format-Bytes $_.ImageBytes } },
  @{n = 'WorkingDir'; e = { if ($_.WorkingDir) { if ($_.WorkingDirExists) { $_.WorkingDir } else { "$($_.WorkingDir) (missing)" } } } } |
  Format-Table -AutoSize | Out-String -Width 220

Section 'Containers not running'
$stopped = @($containers | Where-Object State -ne 'running')
if ($stopped.Count -eq 0) { Write-Output 'none' } else {
  $stopped | Select-Object Name, Project, State, Status, Image | Format-Table -AutoSize | Out-String -Width 200
}

Section 'Images by class (size = unique layers, i.e. what removal frees)'
$images | Group-Object Class | Sort-Object Name | Select-Object @{n = 'Class'; e = { $_.Name } }, Count,
  @{n = 'Unique'; e = { Format-Bytes (($_.Group | Measure-Object UniqueBytes -Sum).Sum) } },
  @{n = 'Total'; e = { Format-Bytes (($_.Group | Measure-Object Bytes -Sum).Sum) } } | Format-Table -AutoSize | Out-String
foreach ($cls in @('dangling', 'project-residue', 'protected-project-build', 'local-unmatched', 'pulled-stale', 'digest-pinned')) {
  $g = @($images | Where-Object Class -eq $cls | Sort-Object Project, UniqueBytes -Descending)
  if ($g.Count -eq 0) { continue }
  Write-Output "-- $cls --"
  $g | Select-Object @{n = 'Ref'; e = { if ($_.Untagged) { $_.ShortId } else { $_.Ref } } }, Project, ComposeService,
    @{n = 'Unique'; e = { Format-Bytes $_.UniqueBytes } }, @{n = 'Total'; e = { Format-Bytes $_.Bytes } }, AgeDays |
    Format-Table -AutoSize | Out-String -Width 200
}

Section 'Volumes by class'
$volumes | Group-Object Class | Sort-Object Name | Select-Object @{n = 'Class'; e = { $_.Name } }, Count,
  @{n = 'Size'; e = { Format-Bytes (($_.Group | Measure-Object Bytes -Sum).Sum) } } | Format-Table -AutoSize | Out-String
$vr = @($volumes | Where-Object { $_.Class -in @('project-residue', 'anonymous', 'unlabelled') } | Sort-Object Project, Name)
if ($vr.Count -gt 0) {
  Write-Output '-- candidates (never removed without an explicit name or project) --'
  $vr | Select-Object Name, Project, Class, @{n = 'Size'; e = { Format-Bytes $_.Bytes } } | Format-Table -AutoSize | Out-String -Width 200
}

Section 'Networks'
$networks | Sort-Object Class, Name | Select-Object Name, Project, Class | Format-Table -AutoSize | Out-String

Section 'Build cache'
Write-Output ("records: {0}   total: {1}   unused >= {2} days: {3} records, {4}" -f $cache.Count, (Format-Bytes $cacheTotal), $StaleDays, $cacheStale.Count, (Format-Bytes $cacheStaleBytes))

Section 'Buildx builders in error state'
if ($brokenBuilders.Count -eq 0) { Write-Output 'none' } else {
  $brokenBuilders | ForEach-Object { Write-Output ("{0}  ({1})" -f $_.Name, $(if ($_.IsContext) { 'docker context; remove with docker context rm' } else { 'buildx builder; remove with docker buildx rm' })) }
}

Section 'Cleanup candidates (what cleanup.ps1 would act on)'
$rows = @()
$rows += [pscustomobject]@{ Tier = 'cache';      Items = $cacheStale.Count; Frees = Format-Bytes $cacheStaleBytes; Note = "build-cache records unused >= $StaleDays days (cleanup keeps the last -KeepCacheDays)" }
$rows += [pscustomobject]@{ Tier = 'containers'; Items = @($stopped | Where-Object { $_.Project -notin $protectedNames }).Count; Frees = '-'; Note = 'exited containers outside protected projects' }
$imgCand = @($images | Where-Object Class -in @('dangling', 'project-residue'))
$rows += [pscustomobject]@{ Tier = 'images';     Items = $imgCand.Count; Frees = Format-Bytes (($imgCand | Measure-Object UniqueBytes -Sum).Sum); Note = 'dangling + builds of torn-down projects (add -IncludePulled / -IncludeLocalUnmatched for more)' }
$rows += [pscustomobject]@{ Tier = 'networks';   Items = @($networks | Where-Object Class -eq 'orphan').Count; Frees = '-'; Note = 'compose networks of torn-down projects' }
$rows += [pscustomobject]@{ Tier = 'builders';   Items = $builders.Count; Frees = '-'; Note = 'buildx builders whose endpoint no longer exists' }
$volCand = @($volumes | Where-Object Class -eq 'project-residue')
$rows += [pscustomobject]@{ Tier = 'volumes';    Items = $volCand.Count; Frees = Format-Bytes (($volCand | Measure-Object Bytes -Sum).Sum); Note = 'DATA: only with -VolumeProject or -Volume, per project, after checking backups' }
$rows | Format-Table -AutoSize | Out-String -Width 200
if ($JsonOut) { Write-Output "JSON inventory written to $JsonOut" }
