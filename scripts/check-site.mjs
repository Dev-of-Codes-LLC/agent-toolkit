#!/usr/bin/env node
// Checks that docs/site.json matches the repo, so the catalog page and the
// code cannot disagree. Node 18+, no dependencies.
//
//   node scripts/check-site.mjs
//
// Fails when: an item's path is missing, a skill, agent or pattern in the repo
// has no item, an item's plugin does not match its path, a required field is
// empty, or the counts differ from the items.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(join(root, 'docs/site.json'), 'utf8'));
const errors = [];
const kinds = ['skill', 'agent', 'routine', 'pattern'];

for (const key of ['name', 'repo', 'branch', 'licence', 'updated', 'install', 'counts', 'rules', 'items']) {
  if (site[key] === undefined) errors.push(`missing top-level key: ${key}`);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(site.updated ?? '')) errors.push('updated must be YYYY-MM-DD');

const items = site.items ?? [];
const paths = new Set();
for (const [i, item] of items.entries()) {
  const label = `items[${i}] (${item.name ?? '?'})`;
  if (!kinds.includes(item.kind)) errors.push(`${label}: kind must be one of ${kinds.join(', ')}`);
  for (const field of ['name', 'plugin', 'path', 'what']) {
    if (!item[field]) errors.push(`${label}: missing ${field}`);
  }
  if (item.kind !== 'pattern' && !item.wont) errors.push(`${label}: missing wont`);
  if (item.path && !existsSync(join(root, item.path))) errors.push(`${label}: path does not exist: ${item.path}`);
  const m = /^plugins\/([^/]+)\//.exec(item.path ?? '');
  if (m && m[1] !== item.plugin) errors.push(`${label}: plugin "${item.plugin}" does not match path`);
  if (paths.has(item.path)) errors.push(`${label}: duplicate path ${item.path}`);
  paths.add(item.path);
}

// Everything in the repo that the page should show.
const expected = [];
const list = (dir) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)) : []);
for (const plugin of list('plugins')) {
  for (const skill of list(`plugins/${plugin}/skills`)) {
    if (statSync(join(root, 'plugins', plugin, 'skills', skill)).isDirectory()) expected.push(`plugins/${plugin}/skills/${skill}`);
  }
  for (const agent of list(`plugins/${plugin}/agents`)) {
    if (agent.endsWith('.md')) expected.push(`plugins/${plugin}/agents/${agent}`);
  }
}
for (const f of list('routines')) if (f.endsWith('.md')) expected.push(`routines/${f}`);
for (const f of list('patterns')) if (f.endsWith('.md') && f !== 'README.md') expected.push(`patterns/${f}`);
for (const p of expected) if (!paths.has(p)) errors.push(`not in docs/site.json: ${p}`);

for (const kind of kinds) {
  const actual = items.filter((it) => it.kind === kind).length;
  if (site.counts?.[kind] !== actual) errors.push(`counts.${kind} is ${site.counts?.[kind]}, but there are ${actual} items`);
}

if (errors.length) {
  console.error(`docs/site.json: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`docs/site.json: OK (${items.length} items)`);
