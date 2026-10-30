import test from 'node:test';
import assert from 'node:assert/strict';
import { checkThai, checkLao } from '../src/check.js';

test('check: thai number matching', () => {
  const draw = { p1: '011781', p2: '48' };
  assert.ok(checkThai('011781', draw)[0].hit);
  assert.ok(!checkThai('011782', draw)[0].hit);
  assert.deepEqual(checkThai('781', draw).map((r) => r.hit), [true, false]);
  assert.deepEqual(checkThai('178', draw).map((r) => r.hit), [false, true]); // โต๊ด
  assert.deepEqual(checkThai('81', draw).map((r) => r.hit), [true, false]);
  assert.deepEqual(checkThai('48', draw).map((r) => r.hit), [false, true]);
  assert.deepEqual(checkThai('4', draw), []);
});

test('check: lao number matching', () => {
  const draw = { n6: '740618' };
  assert.ok(checkLao('740618', draw)[0].hit);
  assert.ok(checkLao('0618', draw)[0].hit);
  assert.deepEqual(checkLao('618', draw).map((r) => r.hit), [true, false]);
  assert.deepEqual(checkLao('861', draw).map((r) => r.hit), [false, true]);
  assert.ok(checkLao('18', draw)[0].hit);
  assert.deepEqual(checkLao('5', draw), []);
});
