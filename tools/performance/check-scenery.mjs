/** Browser checks for full-detail scenery and pooled betting chips. Run against the isolated dev server. */
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PERF_PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.PERF_OUTPUT || 'outputs/performance/visuals';
const browser = await chromium.launch({ headless: true, executablePath: process.env.PERF_BROWSER_EXECUTABLE || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.PERF_URL || 'http://127.0.0.1:5188/?playtest=1');
  await page.getByRole('button', { name: 'Seed run', exact: true }).click({ timeout: 120000 });
  await mkdir(output, { recursive: true });
  for (const action of ['casinoWide', 'hotel-lobby', 'serviceOverview', 'craps', 'crapsB']) {
    await page.evaluate(action => {
      const runtime = window.__lastJackpot;
      runtime.testAction('new');
      runtime.testAction(action);
    }, action);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${output}/${action}.png` });
  }
  const inventory = await page.evaluate(() => {
    const scene = window.__lastJackpot.renderer.scene;
    return { meshes: scene.meshes.length, vertices: scene.getTotalVertices(), geometries: scene.geometries.length };
  });
  const hands = await page.evaluate(async () => {
    const { VIEWMODELS } = await import('/lib/game/weapon-viewmodels.ts');
    const renderer = window.__lastJackpot.renderer;
    const sources = new Map();
    let sharedCopies = 0;
    for (const [id, spec] of Object.entries(VIEWMODELS)) {
      if (!spec.hands) continue;
      const gun = renderer.guns[id];
      if (!gun) throw new Error(`Missing weapon rig ${id}`);
      const prefix = `${id}-grip-`;
      const meshes = gun.getChildMeshes().filter(mesh => mesh.name.startsWith(prefix) && mesh.geometry);
      if (!meshes.length) throw new Error(`Missing hand geometry ${id}`);
      for (const mesh of meshes) {
        const key = `${spec.hands}:${mesh.name.slice(prefix.length)}`;
        const original = sources.get(key);
        if (original) {
          if (original === mesh || original.geometry !== mesh.geometry) throw new Error(`Hand geometry not shared independently: ${key}`);
          const originalPosition = original.position.clone();
          const x = mesh.position.x;
          mesh.position.x += 1;
          if (!original.position.equals(originalPosition)) throw new Error(`Hand transforms are shared: ${key}`);
          mesh.position.x = x;
          sharedCopies++;
        } else sources.set(key, mesh);
      }
    }
    if (!sharedCopies) throw new Error('No shared hand copies tested');
    return { sharedCopies, sourceParts: sources.size };
  });
  const chips = await page.evaluate(async () => {
    const runtime = window.__lastJackpot;
    runtime.testAction('new');
    const sim = runtime.sim, visuals = runtime.renderer.casino, scene = runtime.renderer.scene;
    const { BET_TARGETS } = await import('/lib/game/casino.ts');
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    visuals.update(sim);
    const initialMeshes = scene.meshes.length;
    check([...visuals.piles.values()].every(pile => pile.chips.length === 0), 'Fresh tables must have no chip copies');
    // Cover both banks, independent tables, minimum stakes, the eight-chip cap, and all six targets.
    const chipAsset = visuals.assets[0];
    const sourceVertices = chipAsset.meshes.reduce((n, mesh) => n + mesh.getTotalVertices(), 0);
    const started = performance.now();
    for (const [key, pile] of visuals.piles) {
      sim.betsByTable[pile.tableId][pile.number] = pile.number === 4 ? 25 : 250;
      sim.betBanksByTable[pile.tableId][pile.number] = pile.tableId === 'craps' ? 0 : 1;
      visuals.update(sim);
      check(pile.chips.length === (pile.number === 4 ? 1 : 8), `${key}: wrong stack size`);
      for (const chip of pile.chips) {
        check(chip.isEnabled(), `${key}: chip hidden`);
        check((chip.getTotalVertices?.() ?? 0) + chip.getChildMeshes().reduce((n, mesh) => n + mesh.getTotalVertices(), 0) === sourceVertices, `${key}: model detail changed`);
      }
    }
    const allocationMs = performance.now() - started;
    const populatedMeshes = scene.meshes.length;
    for (const pile of visuals.piles.values()) {
      sim.betBanksByTable[pile.tableId][pile.number] = 1 - sim.betBanksByTable[pile.tableId][pile.number];
    }
    visuals.update(sim);
    for (const pile of visuals.piles.values()) {
      const target = BET_TARGETS.find(t => t.tableId === pile.tableId && t.number === pile.number && t.bank === sim.betBanksByTable[pile.tableId][pile.number]);
      check(pile.chips.every(chip => chip.position.x === target.x && chip.position.z === target.z + .065), 'Stack failed to move between banks');
    }
    runtime.testAction('new');
    visuals.update(runtime.sim);
    check([...visuals.piles.values()].every(pile => pile.chips.every(chip => !chip.isEnabled())), 'Reset left betting chips visible');
    runtime.sim.betsByTable.craps[4] = 25;
    visuals.update(runtime.sim);
    check(scene.meshes.length === populatedMeshes, 'Repeat bet allocated another stack');
    check(visuals.piles.get('craps:4').chips[0].isEnabled(), 'Pooled chip did not reappear');
    return { initialMeshes, populatedMeshes, sourceVertices, allocationMs };
  });
  await page.evaluate(async () => {
    const { BET_TARGETS } = await import('/lib/game/casino.ts');
    const sim = window.__lastJackpot.sim;
    const target = BET_TARGETS.find(t => t.tableId === 'craps' && t.number === 9 && t.bank === 0);
    sim.betsByTable.craps[9] = 100;
    sim.betBanksByTable.craps[9] = 0;
    sim.player = { x: target.x, z: target.z - .85 };
    sim.yaw = 0;
    sim.pitch = .8;
  });
  await page.getByRole('button', { name: 'Hide controls', exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/pooled-chips.png` });
  await writeFile(`${output}/checks.json`, JSON.stringify({ inventory, hands, chips, errors }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ output, inventory, hands, chips, errors }));
} finally {
  await browser.close();
}
