#!/usr/bin/env node
// Grades the result.md output from gh-similar-repos skill.
// Checks: file exists, has header, has star counts, has Why: reasoning,
// includes known fixture repos, filters low-signal noise.

import { readFileSync, existsSync } from 'fs';
import path from 'path';

const workDir = process.env.WORK;
const resultPath = path.join(workDir, 'result.md');

if (!existsSync(resultPath)) {
  console.log(JSON.stringify({
    pass: false,
    score: 0,
    evidence: ['result.md not found in /work — agent did not save output']
  }));
  process.exit(0);
}

const content = readFileSync(resultPath, 'utf8');
const evidence = [];
let score = 0;
const total = 5;

// 1. Has "Repos like" header
if (/## Repos like/i.test(content)) {
  score++;
} else {
  evidence.push('FAIL: Missing "## Repos like" section header');
}

// 2. Has star counts
if (/⭐/.test(content)) {
  score++;
} else {
  evidence.push('FAIL: No star counts (⭐) present — scoring/ranking likely skipped');
}

// 3. Has Why: reasoning on at least one repo
if (/Why:/i.test(content)) {
  score++;
} else {
  evidence.push('FAIL: No "Why:" reasoning — skill should explain similarity signals');
}

// 4. Includes at least one fixture repo (SDL, SFML, sokol, love2d)
if (/libsdl-org\/SDL|SFML\/SFML|floooh\/sokol|love2d\/love/i.test(content)) {
  score++;
} else {
  evidence.push('FAIL: None of the fixture repos (SDL, SFML, sokol, love2d) appear — search results not used');
}

// 5. Filters low-signal noise (cyclon.p2p is a noise entry with 0 topics, JS lang, 6 stars)
if (!/nicktindall\/cyclon/i.test(content)) {
  score++;
} else {
  evidence.push('FAIL: Low-signal noise repo (nicktindall/cyclon.p2p, 6★, wrong lang) included — scoring should filter it');
}

if (evidence.length === 0) {
  evidence.push(`All ${total} checks passed`);
}

console.log(JSON.stringify({
  pass: score === total,
  score: score / total,
  evidence
}));
