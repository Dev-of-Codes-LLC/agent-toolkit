#!/usr/bin/env node
// Render a feature document (CommonMark subset + GFM pipe tables) into a
// standalone, styled HTML "reference sheet" using ../assets/template.html:
// one page of lettered panels (one per level-2 section) inside a frame with
// grid references and a title block, like an engineering drawing sheet.
//
//   node render.mjs <input.md> [output.html] [--link-base <url>] [--strip-internal-links]
//
// --link-base <url>        rewrite relative links that are not sibling feature
//                          pages to <url> + path (for example the repository's
//                          blob URL of the docs/features/ folder at a commit),
//                          so the HTML keeps working once it is shared.
// --strip-internal-links   render relative non-sibling links as plain text
//                          (for a reader edition shared outside the project).
//
// No dependencies. Supported: ATX headings h1 to h6, paragraphs, hard breaks,
// emphasis, inline code, links (balanced parentheses), images (a lone image
// becomes a figure with its alt text as caption; a lone image of a local .svg
// file is inlined as a diagram, with its scripts, styles, and event handlers
// removed, or left as an image if it cannot be cleaned), fenced code, ordered and unordered lists (loose or tight, start
// numbers, nesting by indentation, continuation paragraphs and fences inside
// items), GFM tables with or without outer pipes and with alignment (a body
// cell that is exactly yes/pass/ok or no/fail is marked as a status cell:
// blue check or red cross), blockquotes (lazy continuation; a leading
// **Label:** makes a callout), horizontal rules. A two-column table directly
// after the title whose header is empty or whose first column holds a known
// key (Status, Owner, ...) becomes the metadata card, and its Owner and Status
// rows also fill the title block. Raw HTML in the source is escaped, never
// passed through.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, basename, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = { linkBase: null, strip: false };
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--link-base") flags.linkBase = args[++i];
  else if (args[i] === "--strip-internal-links") flags.strip = true;
  else positional.push(args[i]);
}
const [input, outputArg] = positional;
if (!input) {
  console.error("usage: node render.mjs <input.md> [output.html] [--link-base <url>] [--strip-internal-links]");
  process.exit(2);
}
const output = outputArg ?? input.replace(/\.md$/i, "") + ".html";
// Hash of the Markdown with line endings normalised, so a CRLF checkout and a
// LF checkout of the same file agree. scripts/check-feature-docs.mjs recomputes it.
export const sourceDigest = (text) => createHash("sha256").update(text.replace(/\r\n?/g, "\n")).digest("hex");
const source = readFileSync(input, "utf8").replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
const template = readFileSync(join(here, "..", "assets", "template.html"), "utf8");

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// One pass, so "&amp;lt;" becomes "&lt;" and not "<": the exact inverse of escape().
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"' };
const unescape = (s) => s.replace(/&(amp|lt|gt|quot);/g, (_, name) => ENTITIES[name]);
const stripTags = (s) => s.replace(/<[^>]+>/g, "");
const slugs = new Map();
function slugify(html) {
  const text = stripTags(html).replace(/&[a-z#0-9]+;/gi, "");
  const base = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || "section";
  const n = slugs.get(base) ?? 0;
  slugs.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

// --- links -------------------------------------------------------------------
function resolveHref(href) {
  if (/^(https?:|mailto:|#)/i.test(href)) return { href, internal: false };
  const clean = href.replace(/^\.\//, "");
  if (!clean.includes("/") && /\.md(#|$)/.test(clean)) return { href: clean.replace(/\.md(#|$)/, ".html$1"), internal: false };
  if (flags.strip) return { href: null, internal: true };
  if (flags.linkBase) return { href: new URL(clean, flags.linkBase.replace(/\/?$/, "/")).href, internal: false };
  return { href: clean, internal: false };
}

// Balanced-parenthesis link target: returns [target, endIndex] or null.
function readTarget(s, start) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") { i++; continue; }
    if (c === "(") depth++;
    else if (c === ")") { if (depth === 0) return [s.slice(start, i), i]; depth--; }
    else if (c === " " && depth === 0) {
      const close = s.indexOf(")", i);
      return close < 0 ? null : [s.slice(start, i), close];
    }
  }
  return null;
}

// --- inline ------------------------------------------------------------------
function inline(text, { links = true } = {}) {
  const held = [];
  const hold = (html) => `\u0000${held.push(html) - 1}\u0000`;
  let s = text.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${escape(c)}</code>`));
  // Images and links first, on the raw text, so their targets are not escaped twice.
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const isImage = s[i] === "!" && s[i + 1] === "[";
    if (s[i] === "[" || isImage) {
      const open = isImage ? i + 1 : i;
      const close = s.indexOf("](", open);
      const labelEnd = close;
      if (close > open && !s.slice(open + 1, labelEnd).includes("\n\n")) {
        const target = readTarget(s, close + 2);
        if (target) {
          const [raw, end] = target;
          const label = s.slice(open + 1, labelEnd);
          if (isImage) {
            out += hold(`<img src="${escape(raw)}" alt="${escape(stripTags(label))}" loading="lazy">`);
          } else {
            const { href, internal } = resolveHref(raw);
            const inner = inline(label, { links: false });
            if (!links || (internal && href === null)) out += hold(inner);
            else out += hold(`<a href="${escape(href)}"${/^https?:/.test(href) ? ' rel="noopener"' : ""}>${inner}</a>`);
          }
          i = end;
          continue;
        }
      }
    }
    out += s[i];
  }
  s = escape(out);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, url) => (links ? `${pre}${hold(`<a href="${url}" rel="noopener">${url}</a>`)}` : `${pre}${url}`));
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^\w])__([^_]+)__(?!\w)/g, "$1<strong>$2</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>").replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/( {2,}|\\)\n/g, "<br>\n").replace(/\n/g, " ");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => held[Number(i)]).replace(/\u0000(\d+)\u0000/g, (_, i) => held[Number(i)]);
}
// Plain text of a Markdown fragment (for attributes and the title block).
const plain = (md) => unescape(stripTags(inline(md, { links: false })));

// --- diagrams ----------------------------------------------------------------
// A lone image of a local .svg file is inlined so the page stays standalone
// and the template's diagram classes (hand font, strokes that follow the
// theme) apply. Scripts, styles, comments, animations, event handlers, and
// external references are removed: the SVG is a drawing, not code. If any of
// them is still there after cleaning, the SVG is not inlined at all and stays
// a plain <img>, where a browser never runs its scripts.
const SVG_STRIP = [
  /<\?xml[\s\S]*?\?>/g,
  /<!DOCTYPE[\s\S]*?>/gi,
  /<!--[\s\S]*?-->/g,
  /<script\b[\s\S]*?<\/script[^>]*>/gi,
  /<style\b[\s\S]*?<\/style[^>]*>/gi,
  /<(foreignObject|image|use|set|animate\w*)\b[\s\S]*?(\/>|<\/\1[^>]*>)/gi,
  /[\s/]+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/gi,
  /[\s/]+(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*'|(?!["'#])[^\s>]+)/gi,
];
const SVG_UNSAFE = /<\s*\/?\s*(script|style|foreignObject|iframe|object|embed|image|use|set|animate\w*)\b|<!--|[\s/]on[a-z]+\s*=|javascript:/i;
// Remove every match, then look again: one pass leaves "<script" behind when
// the input hides a match inside another, such as "<scr<script></script>ipt>".
function removeAll(s, pattern) {
  let previous;
  do {
    previous = s;
    s = s.replace(pattern, "");
  } while (s !== previous);
  return s;
}
function inlineSvg(src, alt) {
  if (!/\.svg$/i.test(src) || /^[a-z]+:/i.test(src) || isAbsolute(src)) return null;
  const path = join(dirname(input), src);
  if (!existsSync(path)) return null;
  let svg = readFileSync(path, "utf8");
  for (const pattern of SVG_STRIP) svg = removeAll(svg, pattern);
  svg = svg.trim();
  if (SVG_UNSAFE.test(svg)) {
    console.warn(`render: ${src} not inlined: it still has script, style, animation or event-handler markup after cleaning`);
    return null;
  }
  const open = svg.match(/^<svg\b[^>]*>/i);
  if (!open) return null;
  let tag = open[0].replace(/\s+(role|aria-label|aria-hidden)\s*=\s*("[^"]*"|'[^']*')/gi, "");
  const a11y = alt ? ` role="img" aria-label="${escape(alt)}"` : ' aria-hidden="true"';
  tag = tag.replace(/>$/, `${a11y}>`);
  return tag + svg.slice(open[0].length);
}

// --- tables ------------------------------------------------------------------
const DELIM = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const META_KEYS = /^(status|owner|area|delivered( in)?|decisions?|related|version|release|updated|as of|audience|shipped|pr|ticket)$/i;
// Status cells: blue check for approved, red cross for wrong, grey for unknown.
const STATUS_OK = /^(yes|pass(ed)?|ok|done|true|✓|✔)$/i;
const STATUS_BAD = /^(no|fail(ed)?|false|wrong|✗|✘|✕)$/i;
const STATUS_NA = /^(not (checked|run|verified|tested|done)|skipped|n\/a|pending|unknown)$/i;
function splitRow(row) {
  const codes = [];
  const protectedRow = row.trim().replace(/`[^`]*`/g, (m) => `\u0001${codes.push(m) - 1}\u0001`);
  return protectedRow
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|").replace(/\u0001(\d+)\u0001/g, (_, i) => codes[Number(i)]));
}
const looksLikeRow = (l) => l.includes("|") && l.trim() !== "";

// --- document ----------------------------------------------------------------
const toc = [];
let title = "";
let lead = "";
let sawTitle = false;
let metaDone = false;
let blocksSinceTitle = 0;
let metaHtml = "";
const metaPairs = [];

function renderTable(rows) {
  const head = splitRow(rows[0]);
  const aligns = splitRow(rows[1]).map((c) => (/^:-+:$/.test(c) ? "center" : /^-+:$/.test(c) ? "num" : ""));
  const body = rows.slice(2).map(splitRow);
  const emptyHead = head.every((h) => h === "");
  const metaLike = head.length === 2 && (emptyHead || META_KEYS.test(stripTags(inline(head[0]))) || body.some((r) => META_KEYS.test((r[0] ?? "").replace(/[*_]/g, ""))));
  if (!metaDone && sawTitle && blocksSinceTitle <= 2 && metaLike) {
    metaDone = true;
    const pairs = (emptyHead ? body : META_KEYS.test(head[0].replace(/[*_]/g, "")) ? [head, ...body] : body).filter((r) => r[0] || r[1]);
    for (const [k, v] of pairs) metaPairs.push([plain(k).replace(/[*_]/g, "").trim(), plain(v ?? "")]);
    metaHtml = `<dl class="meta">${pairs.map(([k, v]) => `<dt>${inline(k)}</dt><dd>${inline(v ?? "")}</dd>`).join("")}</dl>`;
    return metaHtml + "\n{{INLINE_TOC}}";
  }
  const cls = (i, cell) => {
    const classes = [];
    if (aligns[i]) classes.push(aligns[i]);
    if (cell !== undefined) {
      const text = plain(cell).trim();
      if (STATUS_OK.test(text)) classes.push("status", "status-ok");
      else if (STATUS_BAD.test(text)) classes.push("status", "status-bad");
      else if (STATUS_NA.test(text)) classes.push("status", "status-na");
    }
    return classes.length ? ` class="${classes.join(" ")}"` : "";
  };
  const labels = head.map((h) => escape(stripTags(inline(h))));
  const wide = head.length >= 3 ? " stack" : "";
  const thead = emptyHead ? "" : `<thead><tr>${head.map((h, i) => `<th scope="col"${cls(i)}>${inline(h)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${body.map((r) => `<tr>${head.map((_, i) => `<td${cls(i, r[i] ?? "")}${emptyHead ? "" : ` data-label="${labels[i]}"`}>${inline(r[i] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<div class="table-wrap${wide}"><table>${thead}${tbody}</table></div>`;
}

const LIST_ITEM = /^(\s*)([-*+]|(\d+)[.)])\s+(.*)$/;

function renderList(lines) {
  // Build a tree of items from indentation, then render. Continuation lines
  // (indented, or blank followed by indented text) belong to the open item.
  const root = { indent: -1, children: [], ordered: false, start: 1 };
  const stack = [root];
  let loose = false;
  let lastItem = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(LIST_ITEM);
    if (m) {
      const indent = m[1].length;
      // Leave nested lists whose owning item's content starts right of this item.
      while (stack.length > 1 && indent < stack[stack.length - 1].ownerContentIndent - 1) stack.pop();
      let parent = stack[stack.length - 1];
      if (lastItem && indent >= lastItem.contentIndent - 1 && indent > lastItem.indent && parent.children.includes(lastItem)) {
        parent = { indent, ownerContentIndent: lastItem.contentIndent, children: [], ordered: Boolean(m[3]), start: Number(m[3] ?? 1), isList: true };
        lastItem.body.push(parent);
        stack.push(parent);
      } else if (parent === root && root.children.length === 0) {
        root.ordered = Boolean(m[3]);
        root.start = Number(m[3] ?? 1);
        root.indent = indent;
      }
      const item = { indent, contentIndent: indent + m[2].length + 1, text: [m[4]], body: [] };
      parent.children.push(item);
      lastItem = item;
      i++;
      continue;
    }
    if (!line.trim()) {
      const next = lines[i + 1] ?? "";
      const nm = next.match(LIST_ITEM);
      if (nm) {
        // A different marker type at the top level starts a new list.
        if (nm[1].length <= root.indent && Boolean(nm[3]) !== root.ordered) break;
        loose = true;
        i++;
        continue;
      }
      if (lastItem && /^\s+\S/.test(next)) {
        loose = true;
        const block = [];
        i++;
        while (i < lines.length && (lines[i].trim() === "" || /^\s+\S/.test(lines[i])) && !(lines[i].match(LIST_ITEM) && lines[i].match(LIST_ITEM)[1].length < lastItem.contentIndent)) {
          if (lines[i].match(LIST_ITEM) && lines[i].match(LIST_ITEM)[1].length <= lastItem.indent) break;
          block.push(lines[i].slice(Math.min(lastItem.contentIndent, lines[i].search(/\S|$/))));
          i++;
        }
        while (block.length && !block[block.length - 1].trim()) block.pop();
        lastItem.body.push({ blocks: block });
        continue;
      }
      break;
    }
    if (lastItem && /^\s*```/.test(line)) {
      const block = [line.trim()];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) block.push(lines[i++].slice(lastItem.contentIndent));
      block.push("```");
      i++;
      lastItem.body.push({ blocks: block });
      continue;
    }
    if (lastItem) { lastItem.text.push(line.trim()); i++; continue; }
    break;
  }
  const render = (list) => {
    const tag = list.ordered ? "ol" : "ul";
    const start = list.ordered && list.start !== 1 ? ` start="${list.start}"` : "";
    return `<${tag}${start}>${list.children
      .map((item) => {
        const text = inline(item.text.join("\n"));
        const head = loose ? `<p>${text}</p>` : text;
        const rest = item.body.map((b) => (b.isList ? render(b) : renderBlocks(b.blocks, true))).join("");
        return `<li>${head}${rest}</li>`;
      })
      .join("")}</${tag}>`;
  };
  return [render(root), i];
}

// Callout kinds. The sheet has two meanings only: blue (annotation, approved)
// and red (wrong, not allowed, at risk). Anything unlabelled is grey.
const CALLOUT_KINDS = { note: "note", info: "note", important: "important", warning: "warning", caution: "caution", limitation: "limitation", "not verified": "limitation", "known issue": "limitation", tip: "tip", success: "success", example: "note" };

function renderBlocks(ls, nested = false) {
  const out = [];
  let i = 0;
  const isBlockStart = (l, next) => /^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s)/.test(l) || /^(\s*[-*_]){3,}\s*$/.test(l) || (looksLikeRow(l) && DELIM.test(next ?? "") && next.includes("|"));
  while (i < ls.length) {
    const line = ls[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^\s*```\s*([\w+-]*)/))) {
      const buf = [];
      i++;
      while (i < ls.length && !/^\s*```\s*$/.test(ls[i])) buf.push(ls[i++]);
      i++;
      out.push(`<pre><code${m[1] ? ` class="language-${m[1]}"` : ""}>${escape(buf.join("\n"))}</code></pre>`);
    } else if ((m = line.match(/^(#{1,6})\s+(.*?)(\s+#+)?\s*$/))) {
      const level = m[1].length;
      const text = inline(m[2]);
      if (level === 1 && !sawTitle && !nested) {
        sawTitle = true;
        title = plain(m[2]);
        out.push(`<h1>${text}</h1>`);
      } else {
        const id = slugify(text);
        if (level === 2 && !nested) toc.push({ id, text: inline(m[2], { links: false }) });
        const anchor = level <= 3 ? `<a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>` : "";
        out.push(`<h${level} id="${id}">${text}${anchor}</h${level}>`);
      }
      i++;
      continue;
    } else if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      out.push("<hr>");
      i++;
    } else if (looksLikeRow(line) && i + 1 < ls.length && DELIM.test(ls[i + 1]) && ls[i + 1].includes("|")) {
      const rows = [];
      while (i < ls.length && looksLikeRow(ls[i])) rows.push(ls[i++]);
      out.push(renderTable(rows));
    } else if (/^>/.test(line)) {
      const buf = [];
      while (i < ls.length && ls[i].trim() && (/^>/.test(ls[i]) || !isBlockStart(ls[i], ls[i + 1]))) buf.push(ls[i++].replace(/^>\s?/, ""));
      const inner = renderBlocks(buf, true);
      const label = buf.join(" ").match(/^\s*\*\*([^*:]+?):?\*\*/);
      let kind = null;
      if (label) kind = CALLOUT_KINDS[label[1].trim().toLowerCase()] ?? CALLOUT_KINDS[label[1].trim().toLowerCase().split(" ")[0]] ?? "note";
      out.push(kind ? `<blockquote class="callout callout-${kind}">${inner}</blockquote>` : `<blockquote>${inner}</blockquote>`);
    } else if (LIST_ITEM.test(line)) {
      const [html, used] = renderList(ls.slice(i));
      out.push(html);
      i += used;
    } else {
      const buf = [];
      while (i < ls.length && ls[i].trim() && !(buf.length && isBlockStart(ls[i], ls[i + 1]))) buf.push(ls[i++]);
      const text = buf.join("\n");
      const img = text.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (img) {
        const caption = img[1] ? `<figcaption>${inline(img[1])}</figcaption>` : "";
        const svg = inlineSvg(img[2], plain(img[1]));
        out.push(svg ? `<figure class="diagram">${svg}${caption}</figure>` : `<figure>${inline(text.trim())}${caption}</figure>`);
      } else {
        if (!nested && sawTitle && !lead && blocksSinceTitle === 0) lead = plain(text);
        out.push(`<p>${inline(text)}</p>`);
      }
    }
    if (sawTitle && !nested) blocksSinceTitle++;
  }
  return out.join("\n");
}

// --- sheet -------------------------------------------------------------------
// Every level-2 section becomes a lettered panel. The caption on the right of
// a panel head names what kind of content the panel holds, in a few words.
const CAPTIONS = {
  "at a glance": "summary",
  "why it exists": "problem",
  "how it works": "procedure",
  "what it guarantees": "checked promises",
  "what it promises": "checked promises",
  "what it does not do": "limits",
  "when something goes wrong": "recovery",
  "key decisions": "design records",
  verification: "evidence",
  glossary: "terms",
  "technical appendix": "reference",
  changelog: "history",
  "what it works with": "scope",
};
const letter = (i) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + Math.floor(i / 26) - 1)}${String.fromCharCode(65 + (i % 26))}`);
const words = (html) => stripTags(html).split(/\s+/).filter(Boolean).length;

function panelize(html) {
  const lines = html.split("\n");
  const head = [];
  const panels = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^<h2 id="([^"]+)">([\s\S]*?)(<a class="anchor"[^>]*>#<\/a>)?<\/h2>$/);
    if (m) {
      current = { id: m[1], text: m[2], lines: [] };
      panels.push(current);
      continue;
    }
    (current ? current.lines : head).push(line);
  }
  panels.forEach((p, i) => {
    p.letter = letter(i);
    p.body = p.lines.join("\n");
    const key = unescape(stripTags(p.text)).toLowerCase().replace(/\s+/g, " ").trim();
    p.caption =
      CAPTIONS[key] ??
      (p.body.includes('<figure class="diagram">') ? "diagram" : p.body.includes("<ol") ? "steps" : p.body.includes("<table") ? "table" : "notes");
    const heavy = /<table|<figure|<pre/.test(p.body);
    p.wide = heavy || words(p.body) > 160 || key === "how it works";
  });
  const index = panels.length
    ? `<nav class="index" aria-label="On this sheet"><ol>${panels
        .map((p) => `<li><a href="#${p.id}"><span class="chip">${p.letter}</span> <span>${p.text}</span></a></li>`)
        .join("")}</ol></nav>`
    : "";
  let titleZone = head.join("\n");
  titleZone = titleZone.includes("{{INLINE_TOC}}") ? titleZone.replace("{{INLINE_TOC}}", () => index) : titleZone.replace(/(<\/p>)/, (m) => `${m}\n${index}`);
  const titlePanel = `<header class="panel panel-title" id="top">\n${titleZone}\n</header>`;
  const sections = panels.map(
    (p) =>
      `<section class="panel${p.wide ? " wide" : ""}" id="${p.id}" aria-labelledby="${p.id}-heading">\n` +
      `<div class="panel-head"><h2 id="${p.id}-heading"><span class="chip">${p.letter}</span> ${p.text}<a class="anchor" href="#${p.id}" aria-hidden="true" tabindex="-1">#</a></h2><span class="caption">${p.caption}</span></div>\n` +
      `${p.body}\n</section>`,
  );
  return [titlePanel, ...sections].join("\n");
}

const body = panelize(renderBlocks(source.split("\n")));
const today = new Date().toISOString().slice(0, 10);
const digest = sourceDigest(readFileSync(input, "utf8"));
const metaValue = (key) => metaPairs.find(([k]) => k.toLowerCase() === key)?.[1] ?? "";
const sourcePath = (() => {
  const rel = relative(process.cwd(), input).replace(/\\/g, "/");
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : basename(input);
})();
const sourceCell =
  flags.linkBase && !flags.strip
    ? `<a href="${escape(new URL(basename(input), flags.linkBase.replace(/\/?$/, "/")).href)}" rel="noopener">${escape(sourcePath)}</a>`
    : escape(sourcePath);
const fill = {
  "{{TITLE}}": escape(title || basename(input, ".md")),
  "{{DESCRIPTION}}": escape(lead.slice(0, 200)),
  "{{BODY}}": body,
  // Lets scripts/check-feature-docs.mjs prove the HTML was rendered from this exact Markdown.
  "{{SOURCE_SHA256}}": digest,
  "{{LINK_BASE}}": escape(flags.linkBase ?? ""),
  "{{TB_SOURCE}}": sourceCell,
  "{{TB_OWNER}}": escape(metaValue("owner") || "—"),
  "{{TB_STATUS}}": escape(metaValue("status") || "—"),
  "{{TB_REV}}": digest.slice(0, 8),
  "{{TB_DATE}}": today,
  "{{TB_SHEET}}": "1 of 1",
  "{{FOOTER}}": `Rendered from <code>${escape(basename(input))}</code> on ${today}. The Markdown file is the source of record.`,
};
let html = template;
for (const [key, value] of Object.entries(fill)) html = html.split(key).join(value);
writeFileSync(output, html);
console.log(`wrote ${output} (${toc.length} panels${flags.linkBase ? ", links rebased" : ""}${flags.strip ? ", internal links stripped" : ""})`);
