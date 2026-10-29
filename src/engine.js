import { TABLES_DATA, STATS_5YEAR_FREQ } from './data.js';

/**
 * คำนวณชุดตัวเลขจากวันในสัปดาห์ + ข้างขึ้น/ข้างแรม (ตรรกะเดียวกับไฟล์ต้นฉบับ)
 * คืนค่า probMap เป็น "ตัวเลข" (เปอร์เซ็นต์สัมพัทธ์ระหว่าง 0-9 รวมกัน = 100)
 */
export function runEngine(dayIdx, phase) {
  const dayTable = TABLES_DATA.day[dayIdx];
  const lunarTable = TABLES_DATA[phase][dayIdx];

  const daySet = new Set(dayTable.all);
  const lunarSet = new Set(lunarTable.all);
  const combinedPool = [...new Set([...dayTable.all, ...lunarTable.all])].sort((a, b) => a - b);
  const overlapDigits = lunarTable.all.filter((x) => daySet.has(x));

  const raw = {};
  for (let digit = 0; digit <= 9; digit++) {
    let score = 0;
    if (daySet.has(digit)) score += 0.3;
    if (lunarSet.has(digit)) score += 0.28;
    if (digit === dayTable.center) score += 0.16;
    if (digit === lunarTable.center) score += 0.16;
    score += ((STATS_5YEAR_FREQ[digit] || 0.1) / 0.142) * 0.2;
    if (daySet.has(digit) && lunarSet.has(digit)) score *= 1.25;
    raw[digit] = score;
  }
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
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
      let score = (p1 + p2) * 1.5 + p1 * p2 * 0.12;

      const isCenter = [dayTable.center, lunarTable.center].some((c) => c === d1 || c === d2);
      if (isCenter) score += 2.5;
      if (overlapDigits.includes(d1) && overlapDigits.includes(d2)) score += 2.0;

      const crossTier =
        (dayTable.top.includes(d1) && (dayTable.mid.includes(d2) || dayTable.bottom.includes(d2))) ||
        (dayTable.top.includes(d2) && (dayTable.mid.includes(d1) || dayTable.bottom.includes(d1)));
      if (crossTier) score += 1.8;

      pairs.push({ pair: `${d1}${d2}`, reversed: `${d2}${d1}`, score, isCenter });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair));

  const coreCount = Math.min(8, Math.max(6, Math.floor(pairs.length * 0.4)));
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

export function evaluateDraw(draw) {
  const r = runEngine(draw.dayIdx, draw.lunar);
  const core = new Set(r.corePairs.map((p) => p.pair));
  const prot = new Set(r.protectionPairs.map((p) => p.pair));
  const both = new Set([...core, ...prot]);
  const top2 = draw.p1.slice(-2);
  const bottom2 = draw.p2;
  const top3 = new Set(r.sortedDigits.slice(0, 3).map(String));

  const coreTop = pairHit(core, top2);
  const coreBottom = pairHit(core, bottom2);
  const allTop = pairHit(both, top2);
  const allBottom = pairHit(both, bottom2);
  const runHit = [...top2, ...bottom2].some((ch) => top3.has(ch));

  return {
    top2,
    bottom2,
    coreHit: coreTop || coreBottom,
    anyHit: allTop || allBottom,
    runHit,
    detail: [
      coreTop && `${top2} (บน) ชุดเด่น`,
      coreBottom && `${bottom2} (ล่าง) ชุดเด่น`,
      !coreTop && allTop && `${top2} (บน) ชุดกัน`,
      !coreBottom && allBottom && `${bottom2} (ล่าง) ชุดกัน`,
    ].filter(Boolean),
    coverage: both.size,
    coreCount: core.size,
  };
}

export function runBacktest(draws) {
  const rows = draws.map((draw) => ({ draw, ...evaluateDraw(draw) }));
  const n = rows.length || 1;
  const count = (k) => rows.filter((r) => r[k]).length;
  const avgCore = rows.reduce((s, r) => s + r.coreCount, 0) / n;
  const avgAll = rows.reduce((s, r) => s + r.coverage, 0) / n;
  // โอกาสสุ่มเข้า: เลขหนึ่งชุดครอบคลุมได้ 2 เลข (กลับ) ต่อคู่ เลือกบนหรือล่างอย่างใดอย่างหนึ่ง
  const baseline = (pairsCount) => 1 - Math.pow(1 - (pairsCount * 2) / 100, 2);
  return {
    rows,
    total: rows.length,
    coreHits: count('coreHit'),
    anyHits: count('anyHit'),
    runHits: count('runHit'),
    avgCore,
    avgAll,
    coreBaseline: baseline(avgCore),
    anyBaseline: baseline(avgAll),
    runBaseline: 1 - Math.pow(0.7, 4),
  };
}
