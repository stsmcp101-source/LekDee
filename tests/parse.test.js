import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGloResult, parseThaiorcLao } from '../api/_lib/parse.js';
import { mergeThaiDraws, HISTORICAL_DRAWS } from '../src/data.js';
import { mergeLaoDraws, LAO_DRAWS } from '../src/lao-data.js';
import { checkLao } from '../src/check.js';

const gloJson = {
  response: {
    result: {
      date: '2025-10-16',
      data: { first: { number: [{ round: 1, value: '059696' }] }, last2: { number: [{ round: 1, value: '61' }] } },
    },
  },
};

// โครงสร้างจริงของหน้า thaiorc: วันที่ซ้ำหลายรอบ (ฟอนต์ต่างขนาดจอ) ตามด้วยเลข 4 / 3 / 2 ตัว
const cell = (date, n4) => `<tr><td class="stats-title"><font class="pshide"><a href="jackpot.php?contentID=1">${date}</a></font><font class="dhide"><a href="jackpot.php?contentID=1">${date}</a></font></td>
<td><font>${n4}</font></td><td><font>${n4.slice(1)}</font></td><td><font>${n4.slice(2)}</font></td></tr>`;
const thaiorcPage = `<html><script>var d='01/01/2569 1111 111 11';</script><body><table>
<tr><td>งวดวันที่</td><td>เลข 4 ตัว</td><td>เลข 3 ตัว</td><td>เลข 2 ตัว</td></tr>
${cell('29/10/2569', '3294')}${cell('28/10/2569', '0618')}${cell('28/10/2569', '0618')}
<tr><td>27/10/2569</td><td>3372</td><td>999</td><td>72</td></tr>
</table></body></html>`;

test('GLO result is parsed to a thai row', () => {
  assert.deepEqual(parseGloResult(gloJson), { lottery: 'thai', draw_date: '2025-10-16', p1: '059696', p2: '61' });
});

test('GLO result: non-draw day or malformed data returns null', () => {
  assert.equal(parseGloResult({ response: { result: null } }), null);
  assert.equal(parseGloResult({}), null);
  assert.equal(parseGloResult({ response: { result: { date: '2025-10-17', data: { first: { number: [{ value: '12' }] } } } } }), null);
});

test('thaiorc: parses 4-digit lao rows, converts Buddhist year, drops duplicates and inconsistent rows', () => {
  assert.deepEqual(parseThaiorcLao(thaiorcPage), [
    { lottery: 'lao', draw_date: '2026-10-29', p1: '3294', p2: null },
    { lottery: 'lao', draw_date: '2026-10-28', p1: '0618', p2: null },
  ]);
});

test('thaiorc: unrecognised page returns no rows', () => {
  assert.deepEqual(parseThaiorcLao('<html><body>Just a moment...</body></html>'), []);
});

test('merge adds only unseen draws, handles 4-digit lao rows, keeps order', () => {
  const t = HISTORICAL_DRAWS.length;
  const l = LAO_DRAWS.length;
  const rows = [
    { lottery: 'thai', draw_date: '2026-11-01', p1: '123456', p2: '78' },
    { lottery: 'thai', draw_date: '2026-10-16', p1: '011781', p2: '48' }, // มีอยู่แล้ว
    { lottery: 'lao', draw_date: '2026-10-30', p1: '6810' },
    { lottery: 'lao', draw_date: '2026-10-28', p1: '0618' }, // มีอยู่แล้ว
  ];
  assert.equal(mergeThaiDraws(rows), 1);
  assert.equal(mergeLaoDraws(rows), 1);
  assert.equal(HISTORICAL_DRAWS.length, t + 1);
  assert.equal(HISTORICAL_DRAWS[0].date, '2026-11-01');
  assert.equal(LAO_DRAWS.length, l + 1);
  const last = LAO_DRAWS.at(-1);
  assert.deepEqual([last.last2, last.last3, last.last4], ['10', '810', '6810']);
  // รันซ้ำต้องไม่เพิ่มอีก
  assert.equal(mergeThaiDraws(rows) + mergeLaoDraws(rows), 0);
});

test('lao check works with 4-digit-only draws', () => {
  const draw = { n6: '3294' };
  assert.ok(checkLao('3294', draw)[0].hit);
  assert.ok(checkLao('294', draw)[0].hit);
  assert.ok(checkLao('94', draw)[0].hit);
  const six = checkLao('123294', draw);
  assert.equal(six[0].hit, false);
  assert.match(six[0].label, /ไม่มีข้อมูล/);
});
