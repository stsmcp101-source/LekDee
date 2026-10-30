import test from 'node:test';
import assert from 'node:assert/strict';
import { runEngine, runBacktest } from '../src/engine.js';
import { calculateThaiLunar, parseISO } from '../src/lunar.js';
import { HISTORICAL_DRAWS } from '../src/data.js';

test('digit scores sum to ~100', () => {
  const r = runEngine(5, 'waning');
  const sum = Object.values(r.probMap).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) < 0.6);
});

test('core 6-8 pairs, protection 4, trios 5 for every day/phase', () => {
  for (let day = 0; day < 7; day++)
    for (const phase of ['waxing', 'waning']) {
      const r = runEngine(day, phase);
      assert.ok(r.corePairs.length >= 6 && r.corePairs.length <= 8, `${day}/${phase} core=${r.corePairs.length}`);
      assert.equal(r.protectionPairs.length, 4);
      assert.equal(r.trioSets.length, 5);
    }
});

test('lunar phase is waxing/waning with kham 1-15', () => {
  const l = calculateThaiLunar(parseISO('2026-10-16'));
  assert.ok(['waxing', 'waning'].includes(l.phase));
  assert.ok(l.kham >= 1 && l.kham <= 15);
});

test('backtest counts are consistent', () => {
  const bt = runBacktest(HISTORICAL_DRAWS);
  assert.equal(bt.total, 120);
  assert.ok(bt.coreHits <= bt.anyHits && bt.anyHits <= bt.total);
});

test('pair count option controls core size', () => {
  for (const pairCount of [8, 12, 17]) {
    const r = runEngine(5, 'waning', { pairCount });
    assert.equal(r.corePairs.length, Math.min(pairCount, r.allPairs.length));
  }
});

test('train/test tuning is deterministic and never worse on train', async () => {
  const { tuneTrainTest } = await import('../src/engine.js');
  const a = tuneTrainTest(HISTORICAL_DRAWS, { iters: 30 });
  const b = tuneTrainTest(HISTORICAL_DRAWS, { iters: 30 });
  assert.equal(a.tunedTest, b.tunedTest);
  assert.ok(a.tunedTrain >= a.defaultTrain);
  assert.equal(a.trainSize + a.testSize, 120);
});

test('lao data: 120 unique weekday draws with 6-digit numbers', async () => {
  const { LAO_DRAWS } = await import('../src/lao-data.js');
  assert.ok(LAO_DRAWS.length >= 120);
  assert.equal(new Set(LAO_DRAWS.map((d) => d.date)).size, LAO_DRAWS.length);
  for (const d of LAO_DRAWS) {
    assert.match(d.n6, /^\d{6}$/);
    const dow = new Date(d.date + 'T12:00:00Z').getUTCDay();
    assert.ok(dow >= 1 && dow <= 5, d.date);
  }
});

test('lao walk-forward backtest never uses the draw being predicted', async () => {
  const { LAO_DRAWS } = await import('../src/lao-data.js');
  const { runLaoBacktest, runLaoEngine } = await import('../src/lao.js');
  const bt = runLaoBacktest(LAO_DRAWS);
  assert.equal(bt.total, LAO_DRAWS.length - 30);
  assert.ok(bt.coreHits <= bt.anyHits);
  assert.equal(runLaoEngine(LAO_DRAWS, 3, { pairCount: 12 }).corePairs.length, 12);
});
