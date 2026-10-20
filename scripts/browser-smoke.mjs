import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { isDeepStrictEqual } from 'node:util';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'output/validation');
await mkdir(output, { recursive: true });
const url = 'http://127.0.0.1:4175';
const backendUrl = 'http://127.0.0.1:5050';
const logs = [];
const pageErrors = [];
let backend;
let preview;
let browser;
function launch(command, args, cwd, extraEnv = {}) {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => logs.push(data.toString()));
  child.stderr.on('data', data => logs.push(data.toString()));
  return child;
}
async function waitFor(address) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(address)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Service not ready: ${address}`);
}
async function startBackend() {
  backend = launch(process.execPath, ['dist/app.js'], resolve(root, 'backend'), { PORT: '5050', ROOM_DATA_DIR: resolve(output, 'rooms') });
  await waitFor(`${backendUrl}/api/health`);
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}
async function state(page) { return page.evaluate(() => JSON.parse(window.render_game_to_text())); }
async function ready(page) {
  await page.waitForFunction(() => {
    if (!window.render_game_to_text) return false;
    const s = JSON.parse(window.render_game_to_text());
    return !s.loading && !s.busy && !s.blocked && s.handSize >= 10;
  });
}
async function screenshot(page, name) {
  // Let card layout transitions finish before judging the rendered positions.
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  if (name.includes('lobby')) await page.screenshot({ path: resolve(output, `${name}-viewport.png`) });
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'Horizontal page overflow');
}
try {
  await startBackend();
  preview = launch(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], resolve(root, 'frontend'), { API_PROXY_TARGET: backendUrl });
  await waitFor(url);
  browser = await chromium.launch({ headless: true });
  for (const [name, viewport] of Object.entries({
    desktop: { width: 1440, height: 1000 },
    mobile: { width: 390, height: 844 },
    narrow: { width: 320, height: 720 },
    landscape: { width: 844, height: 390 },
  })) {
    const context = await browser.newContext({ viewport, locale: 'zh-CN' });
    const page = await context.newPage();
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') logs.push(`browser: ${msg.text()}`); });
    await page.goto(url);
    await page.getByRole('heading', { name: '选择你的牌桌' }).waitFor();
    await page.waitForTimeout(1000);
    await noOverflow(page);
    await screenshot(page, `${name}-lobby`);
    await page.getByTestId('start-room').click();
    await ready(page);
    assert.equal((await state(page)).handSize, 10);
    await page.getByTestId('draw-card').click();
    await ready(page);
    assert.equal((await state(page)).handSize, 11);
    assert.equal(await page.getByTestId('draw-card').isDisabled(), true);
    // Each card remains reachable at overlapping mobile widths.
    const cards = page.locator('.hand-row .game-card');
    for (let i = 0; i < 11; i++) {
      const card = cards.nth(i);
      const selected = await card.getAttribute('aria-label');
      await card.click({ position: { x: 8, y: 8 } });
      assert.equal(await card.getAttribute('aria-pressed'), 'true', `Unreachable card ${i}: ${selected}`);
    }
    await cards.nth(3).click({ position: { x: 8, y: 8 } });
    const selectedId = (await state(page)).selectedId;
    await page.getByRole('button', { name: '理牌', exact: true }).click();
    assert.equal((await state(page)).selectedId, selectedId);
    await noOverflow(page);
    await screenshot(page, `${name}-table-selected`);
    const sortedValues = (await state(page)).hand.map(card => Number(card.value) || 99);
    assert.deepEqual(sortedValues, [...sortedValues].sort((a, b) => a - b), 'Sort order mismatch');
    if (name === 'landscape') {
      const actionBox = await page.getByTestId('discard-card').boundingBox();
      assert.ok(actionBox && actionBox.y + actionBox.height <= viewport.height, 'Landscape action requires scrolling');
      assert.equal(await page.evaluate(() => window.scrollY), 0, 'Landscape table is not visible with hand controls');
    }
    await page.getByTestId('discard-card').click();
    await ready(page);
    const saved = await state(page);
    assert.equal(saved.handSize, 10);
    assert.equal(saved.discard.id, selectedId);
    await page.reload();
    await ready(page);
    const restored = await state(page);
    assert.equal(restored.revision, saved.revision);
    assert.equal(restored.discard.id, selectedId);
    assert.equal(restored.handSize, 10);

    if (name === 'desktop') {
      // A lost action response must not turn into a local mutation.
      await page.route('**/api/games/*/draw', route => route.abort());
      await page.getByTestId('draw-card').click();
      await page.getByRole('alert').waitFor();
      assert.equal((await state(page)).handSize, 10);
      assert.equal((await state(page)).blocked, true);
      await screenshot(page, 'desktop-connection-recovery');
      await page.unroute('**/api/games/*/draw');
      await page.locator('.notice button').click();
      await ready(page);
      await page.getByTestId('draw-card').click();
      await ready(page);
      const pending = await state(page);
      await stop(backend);
      await startBackend();
      await page.reload();
      await ready(page);
      const restarted = await state(page);
      assert.equal(restarted.revision, pending.revision);
      assert.equal(restarted.handSize, 11);
      assert.ok(isDeepStrictEqual(restarted.hand, pending.hand), 'Restart changed the hand');
      assert.equal(await page.getByTestId('draw-card').isDisabled(), true);
      // Two tabs cannot apply the same turn twice.
      const other = await context.newPage();
      await other.goto(page.url());
      await ready(other);
      await page.locator('.hand-row .game-card').first().click({ position: { x: 8, y: 8 } });
      await page.getByTestId('discard-card').click();
      await ready(page);
      await other.locator('.hand-row .game-card').first().click({ position: { x: 8, y: 8 } });
      await other.getByTestId('discard-card').click();
      await other.getByRole('alert').waitFor();
      assert.equal((await state(other)).handSize, 10);
      assert.equal((await state(other)).revision, (await state(page)).revision);
      await other.close();
    }
    await page.getByRole('button', { name: '玩法说明' }).first().click();
    await page.getByRole('dialog').waitFor();
    await screenshot(page, `${name}-help`);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    await page.getByRole('button', { name: '返回大厅' }).click();
    await page.getByTestId('resume-room').waitFor();
    // The explicit local mode works without making game API requests.
    let practiceRequests = 0;
    page.on('request', req => { if (req.url().includes('/api/games')) practiceRequests++; });
    await page.getByRole('button', { name: '先离线练习', exact: true }).click();
    await ready(page);
    await page.getByTestId('draw-card').click();
    await page.locator('.hand-row .game-card').first().click({ position: { x: 8, y: 8 } });
    await page.getByTestId('discard-card').click();
    assert.equal((await state(page)).handSize, 10);
    assert.equal(practiceRequests, 0);
    await writeFile(resolve(output, `${name}-state.json`), JSON.stringify(await state(page), null, 2));
    await context.close();
  }
  assert.deepEqual(pageErrors, [], 'Unexpected browser errors');
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, viewports: 4, checks: ['create', 'draw', 'all cards reachable', 'selection and sorting', 'discard', 'refresh', 'server restart', 'network failure recovery', 'stale tab conflict', 'dialog Escape', 'resume', 'explicit offline mode', 'no overflow'] }, null, 2));
} finally {
  await writeFile(resolve(output, 'server.log'), logs.join(''));
  await writeFile(resolve(output, 'page-errors.json'), JSON.stringify(pageErrors));
  await browser?.close();
  await stop(preview);
  await stop(backend);
}
