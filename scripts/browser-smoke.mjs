import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
async function prepareChallenge(id) {
  // Test-only save fixture using real physical cards; no seeding endpoint ships.
  const path = resolve(output, 'rooms', `${id}.json`);
  const room = JSON.parse(await readFile(path, 'utf8'));
  const pool = [...room.hand, ...room.drawPile, ...room.discardPile];
  const take = value => {
    const index = pool.findIndex(card => card.value === String(value));
    assert.notEqual(index, -1);
    return pool.splice(index, 1)[0];
  };
  room.hand = [1, 1, 1, 2, 2, 3, 4, 5, 6, 7].map(take);
  const next = take(2);
  room.discardPile = [pool.shift()];
  room.drawPile = [next, ...pool];
  await writeFile(path, JSON.stringify(room));
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

    await page.getByRole('button', { name: '返回大厅' }).click();
    await page.getByTestId('start-challenge').click();
    await ready(page);
    const challengeId = (await state(page)).room;
    assert.equal((await state(page)).challenge.status, 'active');
    await prepareChallenge(challengeId);
    await page.reload();
    await ready(page);
    assert.equal((await state(page)).suggestions.length, 1);
    assert.equal(await page.getByTestId('complete-challenge').isDisabled(), true);
    await screenshot(page, `${name}-challenge-goal`);
    await page.getByTestId('draw-card').click();
    await ready(page);
    assert.equal((await state(page)).handSize, 11);
    assert.equal(await page.getByTestId('complete-challenge').count(), 0, 'Cannot submit before discarding');
    const dropIndex = (await state(page)).hand.findIndex(card => card.value === '7');
    await page.locator('.hand-row .game-card').nth(dropIndex).click({ position: { x: 8, y: 8 } });
    await page.getByTestId('discard-card').click();
    await ready(page);
    assert.equal((await state(page)).suggestions.length, 2);
    assert.equal(await page.getByTestId('complete-challenge').isDisabled(), false);

    if (name === 'desktop') {
      // Save succeeds, but the client loses the response: never invent a win.
      await page.route(`**/api/games/${challengeId}/complete`, async route => {
        const response = await route.fetch();
        assert.equal(response.ok(), true);
        await route.abort();
      });
      await page.getByTestId('complete-challenge').click();
      await page.getByRole('alert').waitFor();
      assert.equal((await state(page)).blocked, true);
      assert.equal(await page.locator('.challenge-result').count(), 0);
      await page.unroute(`**/api/games/${challengeId}/complete`);
      await page.locator('.notice button').click();
      await ready(page);
    } else {
      await page.getByTestId('complete-challenge').click();
      await ready(page);
    }
    const result = (await state(page)).challenge;
    assert.equal(result.status, 'completed');
    assert.equal(result.turnsPlayed, 1);
    assert.equal(new Set(result.groups.flat()).size, 6);
    assert.equal(await page.locator('.result-group .game-card').count(), 6);
    assert.equal(await page.getByTestId('draw-card').count(), 0);
    assert.equal(await page.getByTestId('discard-card').count(), 0);
    assert.equal(await page.locator('.hand-row .game-card:enabled').count(), 0);
    await noOverflow(page);
    await screenshot(page, `${name}-challenge-result`);
    if (name === 'landscape') {
      const box = await page.getByTestId('next-challenge').boundingBox();
      assert.ok(box && box.y + box.height <= viewport.height, 'Challenge result actions require scrolling');
      assert.equal(await page.evaluate(() => window.scrollY), 0);
    }
    if (name === 'desktop') {
      await stop(backend);
      await startBackend();
    }
    await page.reload();
    await ready(page);
    assert.deepEqual((await state(page)).challenge, result, 'Reload or restart changed the saved result');
    const duplicate = await fetch(`${backendUrl}/api/games/${challengeId}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: (await state(page)).revision }),
    });
    assert.equal(duplicate.status, 409, 'Finished room accepted a repeated completion');
    await page.route('**/api/games', route => route.abort());
    await page.getByTestId('next-challenge').click();
    await page.getByRole('alert').waitFor();
    assert.equal((await state(page)).challenge.status, 'completed', 'Failed next-room create erased the result');
    await page.unroute('**/api/games');
    await page.getByTestId('next-challenge').click();
    await ready(page);
    assert.notEqual((await state(page)).room, challengeId);
    assert.equal((await state(page)).challenge.status, 'active');
    const previous = await (await fetch(`${backendUrl}/api/games/${challengeId}`)).json();
    assert.deepEqual(previous.challenge, result, 'Next room changed the previous result');
    await writeFile(resolve(output, `${name}-challenge-state.json`), JSON.stringify(await state(page), null, 2));

    // A deterministic display fixture exercises suggestions in every viewport;
    // the create/save/recovery flows above still use the live backend.
    const advice = await context.newPage();
    advice.on('pageerror', e => pageErrors.push(e.message));
    const colors = ['red', 'yellow', 'green', 'blue'];
    const knownHand = [1, 1, 1, 2, 2, 2, 3, 4, 5, 6, 'skip'].map((value, i) => ({
      id: `known-${i}`, color: value === 'skip' ? 'wild' : colors[i % 4], value: String(value),
    }));
    let adviceActions = 0;
    advice.on('request', request => {
      if (request.method() !== 'GET' && request.url().includes('/api/games/')) adviceActions++;
    });
    await advice.route('**/api/games/suggestions-qa', route => route.fulfill({ json: {
      id: 'suggestions-qa', created: Date.now(), revision: 0, turn: 1, drawPileCount: 96,
      discardPile: { id: 'known-discard', color: 'blue', value: '12' },
      player: { id: 'local-player', name: '你', hand: knownHand, hasDrawn: true },
    } }));
    await advice.goto(`${url}/rummy?room=suggestions-qa`);
    await ready(advice);
    assert.equal((await state(advice)).coveredCards, 10);
    assert.equal(await advice.locator('.insight-group').count(), 3);
    await advice.locator('.insight-group').first().focus();
    await advice.keyboard.press('Space');
    assert.equal((await state(advice)).selectedId, null, 'Suggestion selected a discard');
    assert.equal(await advice.locator('.in-suggestion').count(), 3);
    const highlighted = (await state(advice)).highlightedIds;
    await advice.getByRole('button', { name: '理牌', exact: true }).click();
    assert.deepEqual((await state(advice)).highlightedIds, highlighted, 'Sorting changed the highlighted group');
    const adviceCards = advice.locator('.hand-row .game-card');
    for (let i = 0; i < 11; i++) {
      await adviceCards.nth(i).click({ position: { x: 8, y: 8 } });
      assert.equal(await adviceCards.nth(i).getAttribute('aria-pressed'), 'true', `Highlight blocks card ${i}`);
    }
    const adviceSelected = (await state(advice)).selectedId;
    await advice.locator('.insight-group').nth(1).click();
    assert.equal((await state(advice)).selectedId, adviceSelected, 'Highlight changed the discard selection');
    await noOverflow(advice);
    await screenshot(advice, `${name}-hand-suggestions`);
    if (name === 'landscape') {
      const box = await advice.getByTestId('discard-card').boundingBox();
      assert.ok(box && box.y + box.height <= viewport.height, 'Suggestions push landscape actions off screen');
      assert.equal(await advice.evaluate(() => window.scrollY), 0);
    }
    assert.equal(adviceActions, 0, 'Suggestion sent a game action');
    await advice.reload();
    await ready(advice);
    assert.deepEqual((await state(advice)).highlightedIds, [], 'Reload retained a stale highlight');
    await advice.close();
    await context.close();
  }
  assert.deepEqual(pageErrors, [], 'Unexpected browser errors');
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, viewports: 4, checks: ['create', 'draw', 'all cards reachable', 'selection and sorting', 'discard', 'refresh', 'server restart', 'network failure recovery', 'stale tab conflict', 'dialog Escape', 'resume', 'explicit offline mode', 'disjoint suggestions', 'keyboard highlight', 'highlight and discard independence', 'challenge lobby entry', 'challenge goal and submission', 'lost completion response recovery', 'persisted completion after restart', 'duplicate completion rejected', 'failed next-room create preserves result', 'next challenge', 'landscape actions visible', 'no overflow'] }, null, 2));
} finally {
  await writeFile(resolve(output, 'server.log'), logs.join(''));
  await writeFile(resolve(output, 'page-errors.json'), JSON.stringify(pageErrors));
  await browser?.close();
  await stop(preview);
  await stop(backend);
}
