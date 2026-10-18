// Regression tests for feature-doc's render.mjs: the SVG diagram sanitizer
// and text unescaping. Run with: node --test "tests/**/*.test.mjs"
//
// Each case writes a Markdown page whose only image is a local .svg, renders
// it, and checks the diagram's <figure>. The renderer must either inline a
// cleaned SVG or fall back to a plain <img>, never pass active content through.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skill = join(root, "plugins", "dev-workflow", "skills", "feature-doc");
const renderer = join(skill, "scripts", "render.mjs");

function render(markdown, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "feature-doc-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  const md = join(dir, "page.md");
  const html = join(dir, "page.html");
  writeFileSync(md, markdown);
  execFileSync(process.execPath, [renderer, md, html], { stdio: "pipe" });
  return readFileSync(html, "utf8");
}

function diagramFigure(svg) {
  const html = render("# Page\n\nLead.\n\n## How it works\n\n![The flow](flow.svg)\n", { "flow.svg": svg });
  const figure = html.match(/<figure\b[\s\S]*?<\/figure>/);
  assert.ok(figure, "the page has a figure for the image");
  return figure[0];
}

const UNSAFE = [
  [/<\s*script/i, "a script element"],
  [/<\s*style/i, "a style element"],
  [/<!--/, "a comment opener"],
  [/[\s/]on[a-z]+\s*=/i, "an event-handler attribute"],
  [/javascript:/i, "a javascript: URL"],
  [/<\s*(set|animate)/i, "an animation element"],
];

function assertSafe(figure) {
  for (const [re, what] of UNSAFE) assert.doesNotMatch(figure, re, `the figure still has ${what}:\n${figure}`);
}

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">${body}<rect width="10" height="10"/></svg>`;

const bypasses = {
  "nested script tags": svg("<scr<script></script>ipt>alert(1)</script>"),
  "script end tag with a space": svg("<script>alert(1)</script >"),
  "script end tag with junk": svg("<script>alert(1)</script\n foo>"),
  "unclosed script": svg("<script>alert(1)"),
  "nested style tags": svg("<sty<style></style>le>rect{fill:red}</style>"),
  "nested comment": svg("<!<!-- x -->-- hidden -->"),
  "quoted event handler": svg('<rect onclick="alert(1)" width="5" height="5"/>'),
  "unquoted event handler": `<svg xmlns="http://www.w3.org/2000/svg" onload=alert(1)><rect width="10" height="10"/></svg>`,
  "event handler after a slash": svg('<rect/onclick="alert(1)"/>'),
  "unquoted javascript: href": svg("<a href=javascript:alert(1)><text>x</text></a>"),
  "animation that sets href": svg('<a><set attributeName="href" to="javascript:alert(1)"/><text>x</text></a>'),
};

for (const [name, body] of Object.entries(bypasses)) {
  test(`SVG sanitizer: ${name}`, () => assertSafe(diagramFigure(body)));
}

test("SVG sanitizer: the diagram starter is still inlined", () => {
  const starter = readFileSync(join(skill, "assets", "diagram-starter.svg"), "utf8");
  const figure = diagramFigure(starter);
  assert.match(figure, /<figure class="diagram"><svg\b/, "the starter is inlined as a diagram");
  assert.match(figure, /role="img" aria-label="The flow"/);
  assertSafe(figure);
});

test("SVG sanitizer: internal #references survive, external ones go", () => {
  const figure = diagramFigure(svg('<path marker-end="url(#arrow)" href="#a"/><a href="https://example.com/x"><text>x</text></a>'));
  assert.match(figure, /href="#a"/);
  assert.doesNotMatch(figure, /example\.com/);
});

test("unescape: an escaped entity in the title is shown as typed", () => {
  const html = render("# Fish &lt;3\n\nLead.\n");
  // The source text is literally "&lt;3". The body shows it as typed; the title must match,
  // not decode it a second time into "<3".
  assert.match(html, /<title>Fish &amp;lt;3/);
});
