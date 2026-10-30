import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGloResult, parseKhaosodList, parseKhaosodArticle } from '../api/_lib/parse.js';
import { mergeThaiDraws, HISTORICAL_DRAWS } from '../src/data.js';
import { mergeLaoDraws, LAO_DRAWS } from '../src/lao-data.js';

const gloJson = {
  response: {
    result: {
      date: '2025-10-16',
      data: { first: { number: [{ round: 1, value: '059696' }] }, last2: { number: [{ round: 1, value: '61' }] } },
    },
  },
};

const article = (n6, extra = '') => `<html><head><title>หวยลาววันนี้ งวดประจำวันที่ 28 ตุลาคม 2569</title><script>var x = 'รางวัลเลข 6 ตัว: 111111';</script></head>
<body><main><p>งวดล่าสุดวันที่ 28 ตุลาคม 2569 ผลรางวัลทั้งหมดมีดังนี้
<b>รางวัลเลข 6 ตัว:</b> ${n6} รางวัลเลข 5 ตัว: ${n6.slice(1)} รางวัลเลขท้าย 4 ตัว: ${n6.slice(2)} รางวัลเลขท้าย 3 ตัว: ${n6.slice(3)} รางวัลเลขท้าย 2 ตัว: ${n6.slice(4)}${extra}</p></main></body></html>`;

test('GLO result is parsed to a thai row', () => {
  assert.deepEqual(parseGloResult(gloJson), { lottery: 'thai', draw_date: '2025-10-16', p1: '059696', p2: '61' });
});

test('GLO result: non-draw day or malformed data returns null', () => {
  assert.equal(parseGloResult({ response: { result: null } }), null);
  assert.equal(parseGloResult({}), null);
  assert.equal(parseGloResult({ response: { result: { date: '2025-10-17', data: { first: { number: [{ value: '12' }] } } } } }), null);
});

test('Khaosod list: unique article links, newest first, limited', () => {
  const html = ['10453181', '10450541', '10453181', '10440000'].map((id) => `<a href="/laolottery/news_${id}">x</a>`).join('') + '<a href="/other/news_1">no</a>';
  assert.deepEqual(parseKhaosodList(html, 2), [
    'https://www.khaosod.co.th/laolottery/news_10453181',
    'https://www.khaosod.co.th/laolottery/news_10450541',
  ]);
});

test('Khaosod article: date (Buddhist year) and 6-digit number, ignoring script text', () => {
  assert.deepEqual(parseKhaosodArticle(article('740618')), { lottery: 'lao', draw_date: '2026-10-28', p1: '740618', p2: null });
});

test('Khaosod article: inconsistent tail digits or missing data returns null', () => {
  assert.equal(parseKhaosodArticle(article('740618').replace('2 ตัว: 18', '2 ตัว: 99')), null);
  assert.equal(parseKhaosodArticle('<html><body>ไม่มีผล</body></html>'), null);
});

test('merge adds only unseen draws and keeps order', () => {
  const t = HISTORICAL_DRAWS.length;
  const l = LAO_DRAWS.length;
  const rows = [
    { lottery: 'thai', draw_date: '2026-11-01', p1: '123456', p2: '78' },
    { lottery: 'thai', draw_date: '2026-10-16', p1: '011781', p2: '48' }, // มีอยู่แล้ว
    { lottery: 'lao', draw_date: '2026-10-30', p1: '246810' },
    { lottery: 'lao', draw_date: '2026-10-28', p1: '740618' }, // มีอยู่แล้ว
  ];
  assert.equal(mergeThaiDraws(rows), 1);
  assert.equal(mergeLaoDraws(rows), 1);
  assert.equal(HISTORICAL_DRAWS.length, t + 1);
  assert.equal(HISTORICAL_DRAWS[0].date, '2026-11-01');
  assert.equal(LAO_DRAWS.length, l + 1);
  assert.equal(LAO_DRAWS.at(-1).last2, '10');
  // รันซ้ำต้องไม่เพิ่มอีก
  assert.equal(mergeThaiDraws(rows) + mergeLaoDraws(rows), 0);
});
