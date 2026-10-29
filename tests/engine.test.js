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
