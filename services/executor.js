'use strict';

const { spawnSync, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const TMP_ROOT = path.join(os.tmpdir(), 'codesprint-run');
if (!fs.existsSync(TMP_ROOT)) fs.mkdirSync(TMP_ROOT, { recursive: true });

// Language registry. Add entries here to support more languages.
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

const LANGUAGES = {
  python: {
    label: 'Python 3',
    ext: 'py',
    entryFile: 'main.py',
    run: (file) => ({ cmd: PYTHON_CMD, args: [file] }),
    probe: [PYTHON_CMD, ['--version']],
  },
  javascript: {
    label: 'JavaScript (Node)',
    ext: 'js',
    entryFile: 'main.js',
    run: (file) => ({ cmd: 'node', args: [file] }),
    probe: ['node', ['--version']],
  },
  java: {
    label: 'Java',
    ext: 'java',
    entryFile: 'Main.java',
    compile: (file) => ({ cmd: 'javac', args: ['-encoding', 'UTF-8', file] }),
    execute: (dir) => ({ cmd: 'java', args: ['-cp', dir, 'Main'] }),
    probe: ['java', ['-version']],
  },
  c: {
    label: 'C (GCC)',
    ext: 'c',
    entryFile: 'main.c',
    compile: (file) => ({ cmd: 'gcc', args: ['-O2', '-Wall', '-std=c11', '-o', 'main_exec', file] }),
    execute: (dir) => ({ cmd: path.join(dir, 'main_exec' + (process.platform === 'win32' ? '.exe' : '')), args: [] }),
    probe: ['gcc', ['--version']],
  },
  cpp: {
    label: 'C++ (G++)',
    ext: 'cpp',
    entryFile: 'main.cpp',
    compile: (file) => ({ cmd: 'g++', args: ['-O2', '-Wall', '-std=c++17', '-o', 'main_exec', file] }),
    execute: (dir) => ({ cmd: path.join(dir, 'main_exec' + (process.platform === 'win32' ? '.exe' : '')), args: [] }),
    probe: ['g++', ['--version']],
  },
};

function availableLanguages() {
  const out = {};
  for (const [key, lang] of Object.entries(LANGUAGES)) {
    try {
      const r = spawnSync(lang.probe[0], lang.probe[1], { timeout: 5000, encoding: 'utf8' });
      out[key] = { label: lang.label, available: r.status === 0 || r.status === 1 || !r.error };
    } catch {
      out[key] = { label: lang.label, available: false };
    }
  }
  return out;
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(TMP_ROOT, 'run-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function runOnce(lang, code, input, timeLimitMs) {
  const dir = mkTmpDir();
  const started = Date.now();
  try {
    let runSpec;
    const entry = path.join(dir, lang.entryFile || `main.${lang.ext}`);
    fs.writeFileSync(entry, code, 'utf8');

    if (lang.compile) {
      const compSpec = lang.compile(entry);
      const comp = spawnSync(compSpec.cmd, compSpec.args, {
        cwd: dir, timeout: Math.max(8000, timeLimitMs), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
      });
      if (comp.error) {
        return { status: 'runtime_error', stdout: '', stderr: String(comp.error.message || comp.error), timeMs: Date.now() - started };
      }
      if (comp.status !== 0) {
        return { status: 'compile_error', stdout: comp.stdout || '', stderr: comp.stderr || '', timeMs: Date.now() - started };
      }
      runSpec = lang.execute(dir);
    } else {
      runSpec = lang.run(entry);
    }

    const res = spawnSync(runSpec.cmd, runSpec.args, {
      cwd: dir,
      input: input || '',
      timeout: timeLimitMs,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });

    const timeMs = Date.now() - started;
    if (res.error && res.error.code === 'ETIMEDOUT') {
      return { status: 'timeout', stdout: res.stdout || '', stderr: 'Time limit exceeded', timeMs };
    }
    if (res.error) {
      return { status: 'runtime_error', stdout: res.stdout || '', stderr: String(res.error.message || res.error), timeMs };
    }
    if (res.signal === 'SIGTERM' || res.signal === 'SIGKILL') {
      return { status: 'timeout', stdout: res.stdout || '', stderr: 'Time limit exceeded', timeMs };
    }
    if (res.status !== 0) {
      return { status: 'runtime_error', stdout: res.stdout || '', stderr: res.stderr || `Exited with code ${res.status}`, timeMs };
    }
    return { status: 'ok', stdout: res.stdout || '', stderr: res.stderr || '', timeMs };
  } finally {
    cleanup(dir);
  }
}

function normalize(s) {
  return String(s || '').replace(/\r\n/g, '\n').trimEnd().split('\n').map((l) => l.trimEnd()).join('\n').trim();
}

// Run code against a set of test cases and produce an evaluated result.
function evaluate({ code, language, testCases, timeLimitMs = 4000 }) {
  const lang = LANGUAGES[language];
  if (!lang) return { status: 'error', error: `Unsupported language: ${language}`, cases: [], passed: 0, total: 0 };

  const cases = [];
  let passed = 0;
  let hardFail = null;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const run = runOnce(lang, code, tc.input, timeLimitMs);
    const actualNorm = normalize(run.stdout);
    const expectNorm = normalize(tc.expected_output);
    const ok = run.status === 'ok' && actualNorm === expectNorm;
    if (ok) passed++;
    const entry = {
      index: i,
      is_sample: !!tc.is_sample,
      status: run.status,
      passed: ok,
      timeMs: run.timeMs,
    };
    if (tc.is_sample) {
      entry.input = tc.input;
      entry.expected = tc.expected_output;
      entry.actual = run.stdout;
      entry.stderr = run.stderr;
    }
    cases.push(entry);
    if (run.status === 'compile_error') { hardFail = run; break; }
  }

  let status = 'wrong';
  if (hardFail && hardFail.status === 'compile_error') status = 'compile_error';
  else if (passed === testCases.length && testCases.length > 0) status = 'accepted';
  else if (cases.some((c) => c.status === 'timeout')) status = 'timeout';
  else if (cases.some((c) => c.status === 'runtime_error')) status = 'runtime_error';

  return { status, cases, passed, total: testCases.length };
}

// Quick single run for the "Run" button (uses first sample input).
function runQuick({ code, language, input, timeLimitMs = 4000 }) {
  const lang = LANGUAGES[language];
  if (!lang) return { status: 'error', error: `Unsupported language: ${language}` };
  return runOnce(lang, code, input, timeLimitMs);
}

module.exports = { LANGUAGES, availableLanguages, evaluate, runQuick };
