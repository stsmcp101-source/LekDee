import { TABLES_DATA, STATS_5YEAR_FREQ } from './data.js';

// น้ำหนักตั้งต้น (ตรงกับไฟล์ต้นฉบับ) — การทดลองปรับสูตรจะสุ่มค่ารอบ ๆ ชุดนี้
export const DEFAULT_WEIGHTS = {
  day: 0.3,
  lunar: 0.28,
  dayCenter: 0.16,
  lunarCenter: 0.16,
  freq: 0.2,
  synergy: 1.25,
  pairSum: 1.5,
  pairProd: 0.12,
  centerBonus: 2.5,
  overlapBonus: 2.0,
  crossBonus: 1.8,
};

export const PAIR_COUNT_OPTIONS = [8, 12, 17];
export const DEFAULT_PAIR_COUNT = 8;

/**
 * คำนวณชุดตัวเลขจากวันในสัปดาห์ + ข้างขึ้น/ข้างแรม
 * คืนค่า probMap เป็น "ตัวเลข" (เปอร์เซ็นต์สัมพัทธ์ระหว่าง 0-9 รวมกัน = 100)
 */
export function runEngine(dayIdx, phase, { pairCount = DEFAULT_PAIR_COUNT, weights = DEFAULT_WEIGHTS } = {}) {
  const w = weights;
  const dayTable = TABLES_DATA.day[dayIdx];
  const lunarTable = TABLES_DATA[phase][dayIdx];

  const daySet = new Set(dayTable.all);
  const lunarSet = new Set(lunarTable.all);
  const combinedPool = [...new Set([...dayTable.all, ...lunarTable.all])].sort((a, b) => a - b);
  const overlapDigits = lunarTable.all.filter((x) => daySet.has(x));

  const raw = {};
  for (let digit = 0; digit <= 9; digit++) {
    let score = 0;
    if (daySet.has(digit)) score += w.day;
    if (lunarSet.has(digit)) score += w.lunar;
    if (digit === dayTable.center) score += w.dayCenter;
    if (digit === lunarTable.center) score += w.lunarCenter;
    score += ((STATS_5YEAR_FREQ[digit] || 0.1) / 0.142) * w.freq;
    if (daySet.has(digit) && lunarSet.has(digit)) score *= w.synergy;
    raw[digit] = score;
  }
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  const probMap = {};
  for (let digit = 0; digit <= 9; digit++) probMap[digit] = Math.round((raw[digit] / total) * 1000) / 10;

  const sortedDigits = Object.keys(probMap).map(Number).sort((a, b) => probMap[b] - probMap[a] || a - b);

  const pairs = [];
  for (let i = 0; i < combinedPool.length; i++) {
    for (let j = i + 1; j < combinedPool.length; j++) {
      const d1 = combinedPool[i];
      const d2 = combinedPool[j];
      const p1 = probMap[d1];
      const p2 = probMap[d2];
      let score = (p1 + p2) * w.pairSum + p1 * p2 * w.pairProd;

      const isCenter = [dayTable.center, lunarTable.center].some((c) => c === d1 || c === d2);
      if (isCenter) score += w.centerBonus;
      if (overlapDigits.includes(d1) && overlapDigits.includes(d2)) score += w.overlapBonus;

      const crossTier =
        (dayTable.top.includes(d1) && (dayTable.mid.includes(d2) || dayTable.bottom.includes(d2))) ||
        (dayTable.top.includes(d2) && (dayTable.mid.includes(d1) || dayTable.bottom.includes(d1)));
      if (crossTier) score += w.crossBonus;

      pairs.push({ pair: `${d1}${d2}`, reversed: `${d2}${d1}`, score, isCenter });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair));

  const coreCount = Math.min(pairCount, pairs.length);
  const corePairs = pairs.slice(0, coreCount);
  const protectionPairs = pairs.slice(coreCount, coreCount + 4);
  const remainder = pairs.slice(coreCount + 4);

  const trioSets = generateTrios(dayTable, lunarTable, probMap);

  return {
    dayName: dayTable.name,
    combinedPool,
    overlapDigits,
    dayCenter: dayTable.center,
    lunarCenter: lunarTable.center,
    probMap,
    sortedDigits,
    allPairs: pairs,
    corePairs,
    protectionPairs,
    remainder,
    trioSets,
  };
}

function generateTrios(dayTable, lunarTable, probMap) {
  const topList = [...new Set([...dayTable.top, ...lunarTable.top])];
  const midList = [...new Set([...dayTable.mid, ...lunarTable.mid])];
  const botList = [...new Set([...dayTable.bottom, ...lunarTable.bottom])];
  const centers = [...new Set([dayTable.center, lunarTable.center])];
  const byKey = new Map();
  const add = (digits, score, tags) => {
    const code = [...digits].sort((x, y) => x - y).join('');
    const prev = byKey.get(code);
    if (!prev || prev.score < score) byKey.set(code, { code, score, tags });
  };

  for (const t of topList)
    for (const m of midList)
      for (const b of botList)
        if (t !== m && m !== b && t !== b) add([t, m, b], probMap[t] + probMap[m] + probMap[b], 'ผัง 3 ชั้น (Top-Mid-Bot)');

  for (const c of centers)
    for (const t of topList)
      for (const b of botList)
        if (c !== t && c !== b && t !== b) add([c, t, b], probMap[c] * 1.3 + probMap[t] + probMap[b], 'แกน Center + บน + ล่าง');

  return [...byKey.values()].sort((a, b) => b.score - a.score || a.code.localeCompare(b.code)).slice(0, 5);
}

/* ---------- Backtest (คำนวณจริงจากข้อมูล ไม่ใช้ตัวเลขที่ตั้งไว้ล่วงหน้า) ---------- */

const pairHit = (set, n2) => set.has(n2) || set.has(n2[1] + n2[0]);
const sortDigits = (s) => [...s].sort().join('');

export function evaluateDraw(draw, opts) {
  const r = runEngine(draw.dayIdx, draw.lunar, opts);
  const core = new Set(r.corePairs.map((p) => p.pair));
  const prot = new Set(r.protectionPairs.map((p) => p.pair));
  const both = new Set([...core, ...prot]);
  const top2 = draw.p1.slice(-2);
  const top3 = draw.p1.slice(-3);
  const bottom2 = draw.p2;
  const topDigits = new Set(r.sortedDigits.slice(0, 3).map(String));

  const coreTop = pairHit(core, top2);
  const coreBottom = pairHit(core, bottom2);
  const allTop = pairHit(both, top2);
  const allBottom = pairHit(both, bottom2);
  const runHit = [...top2, ...bottom2].some((ch) => topDigits.has(ch));
  // ชุด 3 ตัวซื้อครบ 6 ประตู = เข้าเมื่อ 3 ตัวบนมีเลขชุดเดียวกัน (ไม่สนลำดับ)
  const trio = r.trioSets.find((t) => t.code === sortDigits(top3));

  return {
    top2,
    top3,
    bottom2,
    coreHit: coreTop || coreBottom,
    anyHit: allTop || allBottom,
    runHit,
    trioHit: Boolean(trio),
    detail: [
      coreTop && `${top2} (บน) ชุดเด่น`,
      coreBottom && `${bottom2} (ล่าง) ชุดเด่น`,
      !coreTop && allTop && `${top2} (บน) ชุดกัน`,
      !coreBottom && allBottom && `${bottom2} (ล่าง) ชุดกัน`,
      trio && `${top3} (3 ตัว) ชุด ${trio.code}`,
    ].filter(Boolean),
    coverage: both.size,
    coreCount: core.size,
    trioCount: r.trioSets.length,
  };
}

// โอกาสสุ่มเข้า: 1 คู่ครอบคลุม 2 เลข (รวมเลขกลับ) แล้วเข้าได้ทั้งบนหรือล่าง
export const pairBaseline = (pairsCount) => 1 - Math.pow(1 - (pairsCount * 2) / 100, 2);
// ชุด 3 ตัวเลขไม่ซ้ำ 1 ชุด = 6 จาก 1000 แบบ
export const trioBaseline = (setsCount) => 1 - Math.pow(1 - 6 / 1000, setsCount);

export function runBacktest(draws, opts) {
  const rows = draws.map((draw) => ({ draw, ...evaluateDraw(draw, opts) }));
  const n = rows.length || 1;
  const count = (k) => rows.filter((r) => r[k]).length;
  const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / n;
  const avgCore = avg('coreCount');
  const avgAll = avg('coverage');
  const avgTrio = avg('trioCount');
  return {
    rows,
    total: rows.length,
    coreHits: count('coreHit'),
    anyHits: count('anyHit'),
    runHits: count('runHit'),
    trioHits: count('trioHit'),
    avgCore,
    avgAll,
    avgTrio,
    coreBaseline: pairBaseline(avgCore),
    anyBaseline: pairBaseline(avgAll),
    runBaseline: 1 - Math.pow(0.7, 4),
    trioBaseline: trioBaseline(avgTrio),
  };
}

/* ---------- การทดลองปรับสูตรแบบแยกข้อมูล (train / test) ---------- */

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const coreRate = (draws, opts) => draws.filter((d) => evaluateDraw(d, opts).coreHit).length / draws.length;

/**
 * สุ่มค้นหาน้ำหนักที่ทำให้ "ชุดเด่น" เข้ามากที่สุดในงวดเก่า (train)
 * แล้ววัดผลกับงวดใหม่ที่สูตรไม่เคยเห็น (test) — ถ้าผล test ไม่ดีกว่าค่าสุ่ม แปลว่าสูตรแค่จำข้อมูลเก่า
 */
export function tuneTrainTest(draws, { pairCount = DEFAULT_PAIR_COUNT, testSize = 40, iters = 300, seed = 42 } = {}) {
  const chrono = [...draws].sort((a, b) => a.date.localeCompare(b.date));
  const train = chrono.slice(0, chrono.length - testSize);
  const test = chrono.slice(chrono.length - testSize);
  const rand = mulberry32(seed);

  let best = { weights: DEFAULT_WEIGHTS, train: coreRate(train, { pairCount }) };
  const defaultTrain = best.train;
  for (let i = 0; i < iters; i++) {
    const weights = {};
    for (const [k, v] of Object.entries(DEFAULT_WEIGHTS)) {
      weights[k] = k === 'synergy' ? 0.5 + rand() * 1.5 : v * rand() * 2.5;
    }
    const score = coreRate(train, { pairCount, weights });
    if (score > best.train) best = { weights, train: score };
  }

  return {
    pairCount,
    trainSize: train.length,
    testSize: test.length,
    trainRange: [train[0].date, train[train.length - 1].date],
    testRange: [test[0].date, test[test.length - 1].date],
    defaultTrain,
    defaultTest: coreRate(test, { pairCount }),
    tunedTrain: best.train,
    tunedTest: coreRate(test, { pairCount, weights: best.weights }),
    baseline: pairBaseline(pairCount),
    weights: best.weights,
  };
}
