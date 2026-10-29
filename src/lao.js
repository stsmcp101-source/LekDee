import { TABLES_DATA } from './data.js';
import { trioBaseline } from './engine.js';

// หวยลาวไม่มีตารางกำลังวันของตัวเอง จึงใช้สถิติเลขจากผลย้อนหลัง + ตารางกำลังวันของไทยเป็นส่วนเสริมเล็กน้อย
export const LAO_WEIGHTS = { all: 0.5, recent: 0.5, day: 0.15, recentN: 30 };
export const LAO_PAIR_OPTIONS = [8, 17, 28];
// เลือกกลุ่มเลขให้ใหญ่พอที่จะจับคู่ได้ครบตามจำนวนที่ต้องการ
const poolSizeFor = (pairCount) => {
  let n = 7;
  while ((n * (n - 1)) / 2 < pairCount) n++;
  return n;
};
const MIN_HISTORY = 30;

export function nextDrawDate(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  // ออกรางวัลจันทร์–ศุกร์ เวลา 20:00 (เวลาไทย) ถ้าเลยเวลาแล้วนับเป็นวันถัดไป
  if (from.getHours() >= 20) d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function digitFreq(draws) {
  const f = Array(10).fill(0);
  let total = 0;
  for (const d of draws) {
    for (const ch of d.last3) {
      f[Number(ch)]++;
      total++;
    }
  }
  return f.map((x) => (total ? x / total : 0.1));
}

/**
 * history: ผลที่ออกแล้ว (เก่า→ใหม่) · dayIdx: วันในสัปดาห์ของงวดที่จะทำนาย
 */
export function runLaoEngine(history, dayIdx, { pairCount = 8, weights = LAO_WEIGHTS } = {}) {
  const w = weights;
  const fAll = digitFreq(history);
  const fRecent = digitFreq(history.slice(-w.recentN));
  const daySet = new Set(TABLES_DATA.day[dayIdx].all);

  const raw = [];
  for (let d = 0; d <= 9; d++) raw[d] = w.all * fAll[d] + w.recent * fRecent[d] + (daySet.has(d) ? w.day * 0.1 : 0);
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  const probMap = {};
  for (let d = 0; d <= 9; d++) probMap[d] = Math.round((raw[d] / total) * 1000) / 10;

  const sortedDigits = [...Array(10).keys()].sort((a, b) => probMap[b] - probMap[a] || a - b);
  const pool = sortedDigits.slice(0, poolSizeFor(pairCount));

  const pairs = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      const a = Math.min(pool[i], pool[j]);
      const b = Math.max(pool[i], pool[j]);
      pairs.push({ pair: `${a}${b}`, reversed: `${b}${a}`, score: probMap[a] + probMap[b] });
    }
  pairs.sort((x, y) => y.score - x.score || x.pair.localeCompare(y.pair));
  const corePairs = pairs.slice(0, Math.min(pairCount, pairs.length));
  const protectionPairs = pairs.slice(corePairs.length, corePairs.length + 4);

  const trios = [];
  const top = sortedDigits.slice(0, 6);
  for (let i = 0; i < top.length; i++)
    for (let j = i + 1; j < top.length; j++)
      for (let k = j + 1; k < top.length; k++) {
        const digits = [top[i], top[j], top[k]].sort((x, y) => x - y);
        trios.push({ code: digits.join(''), score: probMap[digits[0]] + probMap[digits[1]] + probMap[digits[2]] });
      }
  trios.sort((x, y) => y.score - x.score || x.code.localeCompare(y.code));

  return { probMap, sortedDigits, corePairs, protectionPairs, trioSets: trios.slice(0, 5) };
}

const sortStr = (s) => [...s].sort().join('');
const dayOf = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

/**
 * Walk-forward: ทำนายแต่ละงวดโดยใช้เฉพาะผลที่ออกก่อนหน้างวดนั้น (ไม่แอบดูอนาคต)
 */
export function runLaoBacktest(draws, opts = {}) {
  const rows = [];
  for (let i = MIN_HISTORY; i < draws.length; i++) {
    const draw = draws[i];
    const r = runLaoEngine(draws.slice(0, i), dayOf(draw.date), opts);
    const core = new Set(r.corePairs.map((p) => p.pair));
    const both = new Set([...core, ...r.protectionPairs.map((p) => p.pair)]);
    const rev = (s) => s[1] + s[0];
    const trio = r.trioSets.find((t) => t.code === sortStr(draw.last3));
    rows.push({
      draw,
      coreHit: core.has(draw.last2) || core.has(rev(draw.last2)),
      anyHit: both.has(draw.last2) || both.has(rev(draw.last2)),
      trioHit: Boolean(trio) && new Set(draw.last3).size === 3,
      coreCount: core.size,
      coverage: both.size,
      trioCount: r.trioSets.length,
    });
  }
  const n = rows.length || 1;
  const count = (k) => rows.filter((r) => r[k]).length;
  const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / n;
  return {
    rows,
    total: rows.length,
    coreHits: count('coreHit'),
    anyHits: count('anyHit'),
    trioHits: count('trioHit'),
    avgCore: avg('coreCount'),
    avgAll: avg('coverage'),
    avgTrio: avg('trioCount'),
    coreBaseline: laoPairBaseline(avg('coreCount')),
    anyBaseline: laoPairBaseline(avg('coverage')),
    trioBaseline: trioBaseline(avg('trioCount')),
  };
}

// 2 ตัวท้ายของหวยลาวมีโอกาสสุ่มเข้า 1 ใน 100 ต่อ 1 เลข (บนอย่างเดียว ไม่มีล่าง) — baseline สำหรับ UI
export function laoPairBaseline(pairsCount) {
  return Math.min(1, (pairsCount * 2) / 100);
}
