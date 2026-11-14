/** Verify the public package, without DSH, network calls, or personal config. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run this check with npm run check.');
const temporary = await mkdtemp(join(tmpdir(), 'dsh-birthday-package-'));
try {
  const result = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: root, encoding: 'utf8' }))[0];
  const expected = [
    'LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'cordis.patch.yml', 'package.json',
    'lib/calendar.js', 'lib/client.js', 'lib/engine.js', 'lib/index.js', 'lib/store.js',
    'lib/vendor/lunar.cjs', 'lib/vendor/LICENSE-lunar-javascript',
  ];
  assert.deepEqual(result.files.map(file => file.path).sort(), expected.sort());
  assert.ok(result.size < 2_000_000, 'Unexpected package size');
  const unpack = join(temporary, 'unpacked');
  await mkdir(unpack);
  execFileSync('tar', ['-xzf', join(temporary, result.filename), '-C', unpack]);
  const installed = join(unpack, 'package');
  const moduleUrl = pathToFileURL(join(installed, 'lib/index.js')).href;
  const host = await import(moduleUrl);
  assert.equal(host.name, 'dsh-lunar-birthday-local');
  assert.deepEqual(host.inject, ['webServer', 'connection']);
  const { DEFAULTS } = await import(pathToFileURL(join(installed, 'lib/store.js')).href);
  assert.equal(DEFAULTS.birthday, null);
  assert.equal(DEFAULTS.enabled, false);
  const { isBirthday, nextBirthday } = await import(pathToFileURL(join(installed, 'lib/calendar.js')).href);
  const birthday = { calendar: 'lunar', month: 4, day: 1, leap: false };
  globalThis.fetch = () => { throw new Error('Offline calendar must not use a network request'); };
  assert.equal(nextBirthday(birthday, { year: 2026, iso: '2026-01-01' }), '2026-05-17');
  assert.equal(nextBirthday(birthday, { year: 2027, iso: '2027-01-01' }), '2027-05-06');
  assert.equal(isBirthday({ year: 2027, month: 5, day: 5 }, birthday), false);
  let client;
  vm.runInNewContext(await readFile(join(installed, 'lib/client.js'), 'utf8'), {
    window: { __ModuleLoader__: { load(module) { client = module; } } },
    document: { baseURI: 'http://127.0.0.1:3080/' }, URL,
  });
  assert.equal(client.id, 'dsh-lunar-birthday-local');
  const exports = client.factory(name => {
    assert.equal(name, 'react');
    return { createElement() {} };
  });
  assert.deepEqual(Array.from(exports.inject), ['slots']);
  assert.equal(typeof exports.apply, 'function');
  console.log(`Package verified: ${result.filename}; ${result.files.length} files; ${result.size} bytes; offline calendar and both entrypoints OK`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
