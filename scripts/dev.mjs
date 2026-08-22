#!/usr/bin/env node
// One-command dev environment: runs the Express API (:4000) and the Vite
// client (:3000) together, tag each process's output, and forward Ctrl-C to
// both. A zero-dependency alternative to `concurrently`.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  { tag: 'api', color: '\x1b[36m', cwd: join(root, 'server') },
  { tag: 'ui ', color: '\x1b[35m', cwd: join(root, 'client') },
];

console.log('PuneRoutes dev — API on http://localhost:4000 · UI on http://localhost:3000 (Ctrl-C to stop both)\n');

const children = targets.map(({ tag, color, cwd }) => {
  const child = spawn('npm', ['run', 'dev'], {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  const pipe = (stream) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        console.log(`${color}[${tag}]\x1b[0m ${buffer.slice(0, newline)}`);
        buffer = buffer.slice(newline + 1);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code) => {
    console.log(`${color}[${tag}]\x1b[0m exited (code ${code})`);
    shutdown(code === 0 ? 0 : 1);
  });

  return child;
});

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
