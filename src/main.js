import './style.css';
import { THAI_DAYS, TABLES_DATA, HISTORICAL_DRAWS, QUICK_DRAWS, mergeThaiDraws } from './data.js';
import { calculateThaiLunar, formatThaiDate, moonIcon, parseISO, shortThaiDate, toISO } from './lunar.js';
import { runEngine, runBacktest, tuneTrainTest, PAIR_COUNT_OPTIONS, DEFAULT_PAIR_COUNT } from './engine.js';
import { LAO_DRAWS, mergeLaoDraws } from './lao-data.js';
import { runLaoEngine, runLaoBacktest, nextDrawDate, LAO_PAIR_OPTIONS } from './lao.js';
import { checkThai, checkLao, VALID_LENGTHS } from './check.js';
import * as store from './store.js';

/* ------------------------------------------------------------------ state */
const state = {
  tab: 'dashboard',
  date: parseISO('2026-10-16'),
  phase: 'waning',
  kham: 5,
  manual: false,
  showManual: false,
  showPool: false,
  refSub: 'day',
  btFilter: 'all',
  pairCount: readPairCount(),
  laoPairCount: 17,
  checkKind: 'thai',
  checkIdx: 0,
  checkNum: '',
  tune: null,
  tuning: false,
  result: null,
  userDraws: [],
  history: [],
};

function readPairCount() {
  try {
    const n = Number(localStorage.getItem('pairCount'));
    return PAIR_COUNT_OPTIONS.includes(n) ? n : DEFAULT_PAIR_COUNT;
  } catch {
    return DEFAULT_PAIR_COUNT;
  }
}

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (n, d = 1) => `${(n * 100).toFixed(d)}%`;

const TABS = [
  { id: 'dashboard', label: 'วิเคราะห์', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'backtest', label: 'ย้อนหลัง', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'check', label: 'ตรวจผล', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'lao', label: 'หวยลาว', icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9' },
  { id: 'reference', label: 'ตาราง', icon: 'M3 10h18M3 14h18M10 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z' },
  { id: 'history', label: 'ประวัติ', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' },
];

/* ------------------------------------------------------------------ helpers */
let toastTimer;
function toast(msg) {
  $('toastMsg').textContent = msg;
  const el = $('toast');
  el.classList.remove('translate-y-6', 'opacity-0');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('translate-y-6', 'opacity-0'), 2400);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

const allDraws = () => {
  const mine = state.userDraws.map((r) => ({
    id: r.id,
    date: r.draw_date,
    p1: r.p1,
    p2: r.p2,
    dayIdx: r.day_idx,
    lunar: r.lunar,
    kham: r.kham,
    mine: true,
  }));
  const seen = new Set(mine.map((m) => m.date));
  return [...mine, ...HISTORICAL_DRAWS.filter((h) => !seen.has(h.date))].sort((a, b) => b.date.localeCompare(a.date));
};

/* ------------------------------------------------------------------ nav */
function renderNav() {
  const btn = (t, mobile) => {
    const active = state.tab === t.id;
    const icon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${t.icon}"/></svg>`;
    return mobile
      ? `<button data-tab="${t.id}" class="flex-1 py-2 flex flex-col items-center gap-0.5 text-[11px] ${active ? 'text-brand-emerald font-semibold' : 'text-slate-400'}">${icon}${t.label}</button>`
      : `<button data-tab="${t.id}" class="px-3.5 py-1.5 text-sm rounded-lg transition ${active ? 'bg-surface-card text-brand-emerald font-semibold shadow-sm' : 'text-brand-slate'}">${t.label}</button>`;
  };
  $('bottomNav').innerHTML = `<div class="flex max-w-lg mx-auto">${TABS.map((t) => btn(t, true)).join('')}</div>`;
  $('topNav').innerHTML = TABS.map((t) => btn(t, false)).join('');
}

function switchTab(id) {
  state.tab = id;
  for (const t of TABS) $(`view-${t.id}`).classList.toggle('hidden', t.id !== id);
  renderNav();
  if (id === 'backtest') renderBacktest();
  if (id === 'history') loadHistory();
  if (id === 'lao') renderLao();
  if (id === 'check') renderCheck();
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------------ date handling */
function applyDate(date, forced) {
  state.date = date;
  if (forced) {
    state.phase = forced.phase;
    state.kham = forced.kham;
    state.manual = true;
  } else {
    const l = calculateThaiLunar(date);
    state.phase = l.phase;
    state.kham = l.kham;
    state.manual = false;
  }
  compute();
}

function compute() {
  state.result = runEngine(state.date.getDay(), state.phase, { pairCount: state.pairCount });
  renderDashboard();
}

/* ------------------------------------------------------------------ dashboard */
function digitCard(digit, r) {
  const p = r.probMap[digit];
  const high = p >= 11.5;
  const med = p >= 9.5 && p < 11.5;
  const cls = high ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-200' : med ? 'border-emerald-200 bg-emerald-50/30' : 'border-surface-border';
  const bar = high ? 'bg-brand-gold' : med ? 'bg-brand-emerald' : 'bg-slate-300';
  const txt = high ? 'text-brand-goldDark font-bold' : med ? 'text-brand-emerald font-semibold' : 'text-slate-400';
  const center = digit === r.dayCenter || digit === r.lunarCenter;
  return `
    <div class="p-2.5 rounded-xl border ${cls} bg-surface-card">
      <div class="flex items-center justify-between">
        <span class="text-lg font-black font-mono">${digit}${center ? '<span class="text-amber-500 text-xs ml-0.5">★</span>' : ''}</span>
        <span class="text-xs font-mono ${txt}">${p.toFixed(1)}%</span>
      </div>
      <div class="w-full bg-surface-muted rounded-full h-1.5 my-1.5 overflow-hidden"><div class="${bar} h-1.5 rounded-full" style="width:${Math.min(p * 5.2, 100)}%"></div></div>
      <div class="flex justify-between text-[10px] text-slate-400"><span>${r.overlapDigits.includes(digit) ? '<span class="text-brand-gold font-bold">ซ้ำตาราง</span>' : 'ทั่วไป'}</span><span>${high ? 'เด่นมาก' : med ? 'เด่น' : 'ปกติ'}</span></div>
    </div>`;
}

function renderDashboard() {
  const r = state.result;
  const iso = toISO(state.date);
  const dayIdx = state.date.getDay();
  const medals = ['🥇', '🥈', '🥉'];
  const top3 = r.sortedDigits.slice(0, 3);

  $('view-dashboard').innerHTML = `
    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-bold flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-brand-emerald"></span>เลือกงวด</h2>
        <button data-act="today" class="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 text-brand-emerald font-semibold border border-emerald-200">วันนี้</button>
      </div>
      <div class="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        ${QUICK_DRAWS.map((q) => `<button data-quick="${q.iso}" class="shrink-0 px-2.5 py-1 text-xs rounded-lg border ${q.star ? 'bg-amber-50 text-brand-goldDark border-amber-300 font-semibold' : 'bg-surface-muted text-brand-slate border-surface-border'}">${q.star ? '★ ' : ''}${q.label}</button>`).join('')}
      </div>
      <input type="date" id="dateInput" value="${iso}" class="w-full bg-surface-muted/60 border border-surface-borderDark rounded-xl px-4 py-2.5 font-medium focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-emerald-100">
      <p class="text-xs text-brand-emerald font-semibold">${formatThaiDate(state.date)}</p>

      <div class="bg-surface-muted/40 rounded-xl p-3 border border-surface-border">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-brand-slate">🌙 ปฏิทินจันทรคติไทย</span>
          <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold border ${state.manual ? 'bg-amber-100 text-brand-goldDark border-amber-200' : 'bg-emerald-100 text-brand-emerald border-emerald-200'}">${state.manual ? 'ปรับเอง' : 'อัตโนมัติ'}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-surface-card p-2 rounded-lg border border-surface-border"><span class="block text-[10px] text-slate-400">วัน</span><span class="text-xs font-bold">${THAI_DAYS[dayIdx]}</span></div>
          <div class="bg-surface-card p-2 rounded-lg border border-surface-border"><span class="block text-[10px] text-slate-400">ข้างขึ้น/แรม</span><span class="text-xs font-bold text-brand-emerald">${moonIcon(state.phase, state.kham)} ${state.phase === 'waxing' ? 'ข้างขึ้น' : 'ข้างแรม'}</span></div>
          <div class="bg-surface-card p-2 rounded-lg border border-surface-border"><span class="block text-[10px] text-slate-400">ค่ำ</span><span class="text-xs font-bold text-brand-gold">${state.kham} ค่ำ</span></div>
        </div>
        <button data-act="toggleManual" class="mt-2 text-[11px] text-brand-emerald font-medium">ปรับจันทรคติเอง ${state.showManual ? '▴' : '▾'}</button>
        ${state.showManual ? `
          <div class="mt-2 pt-2 border-t border-dashed border-surface-borderDark grid grid-cols-2 gap-3">
            <div class="grid grid-cols-2 gap-1.5">
              ${['waxing', 'waning'].map((p) => `<button data-phase="${p}" class="py-1.5 rounded-lg text-xs ${state.phase === p ? 'bg-brand-emerald text-white font-semibold' : 'bg-surface-muted text-brand-slate border border-surface-border'}">${p === 'waxing' ? 'ข้างขึ้น' : 'ข้างแรม'}</button>`).join('')}
            </div>
            <select id="khamSelect" class="w-full bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-xs">
              ${Array.from({ length: 15 }, (_, i) => `<option value="${i + 1}" ${state.kham === i + 1 ? 'selected' : ''}>${i + 1} ค่ำ</option>`).join('')}
            </select>
          </div>` : ''}
      </div>
    </section>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card">
      <h3 class="text-sm font-bold mb-0.5 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-brand-emerald"></span>คะแนนเลขเดี่ยว 0–9</h3>
      <p class="text-[11px] text-brand-slate mb-3">สัดส่วนคะแนนสัมพัทธ์จากตารางวัน + จันทรคติ + เลขกึ่งกลาง + ความถี่ 5 ปี (รวม = 100%)</p>
      <div class="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2">${Array.from({ length: 10 }, (_, d) => digitCard(d, r)).join('')}</div>
      <div class="mt-3 p-3 rounded-xl bg-surface-muted/60 border border-surface-border flex items-center justify-between gap-3">
        <div>
          <span class="text-[11px] font-bold text-brand-slate block">★ เลขเด่นวิ่ง / รูด</span>
          <span class="text-xs font-semibold">อันดับ 1: <b class="font-mono text-brand-goldDark text-base">${top3[0]}</b> · อันดับ 2: <b class="font-mono text-brand-emerald text-base">${top3[1]}</b></span>
        </div>
        <div class="flex gap-1.5">${top3.map((d, i) => `<span class="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-card border border-surface-border text-sm font-mono font-bold">${medals[i]}${d}</span>`).join('')}</div>
      </div>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <section class="lg:col-span-7 bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-4">
        <div class="flex items-start justify-between gap-2 pb-3 border-b border-surface-border">
          <div>
            <h4 class="text-sm font-bold"><span class="text-brand-gold">✦</span> ชุดเด่น 2 ตัว (Core ${r.corePairs.length} คู่)</h4>
            <p class="text-[11px] text-brand-slate">เรียงตามคะแนนรวมสูงสุด · เลขกลับก็นับเป็นชุดเดียวกัน</p>
          </div>
          <button data-copy="corePairs" class="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-muted border border-surface-border">คัดลอก</button>
        </div>
        ${pairCountPicker()}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          ${r.corePairs.map((p, i) => `
            <div class="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200">
              <div class="flex items-center justify-between"><span class="text-xl font-black font-mono text-brand-goldDark tracking-wider">${p.pair}</span><span class="text-[10px] px-1.5 rounded bg-amber-100 text-brand-goldDark border border-amber-300 font-bold">${(94 - i * 1.8).toFixed(1)}%</span></div>
              <div class="text-[10px] text-slate-500 mt-1 flex justify-between"><span>กลับ <b class="font-mono">${p.reversed}</b></span><span class="text-brand-emerald font-semibold">${p.isCenter ? 'แกน Center' : 'คะแนน ' + p.score.toFixed(0)}</span></div>
            </div>`).join('')}
        </div>
        <div class="pt-3 border-t border-surface-border">
          <div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-brand-slate">🛡️ ชุดกัน / สำรอง (${r.protectionPairs.length} คู่)</span>
            <button data-copy="protPairs" class="text-[11px] text-brand-emerald font-medium">คัดลอก</button></div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            ${r.protectionPairs.map((p) => `<div class="p-2 rounded-lg bg-surface-muted/60 border border-surface-border"><span class="text-base font-bold font-mono">${p.pair}</span><span class="block text-[10px] text-slate-400">กลับ ${p.reversed}</span></div>`).join('')}
          </div>
        </div>
        <div class="pt-2 border-t border-surface-border">
          <button data-act="togglePool" class="w-full py-2 px-3 rounded-xl bg-surface-muted/50 text-xs font-medium text-slate-600 flex justify-between"><span>📂 คู่ทั้งหมดใน Full Pool (${r.allPairs.length} คู่)</span><span>${state.showPool ? '▴' : '▾'}</span></button>
          ${state.showPool ? `
            <div class="mt-3 p-3 bg-surface-muted/30 rounded-xl border border-surface-border">
              <p class="text-xs text-slate-500 mb-2">เลขในผัง: <b class="font-mono text-brand-navy">${r.combinedPool.join(', ')}</b></p>
              <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                ${r.remainder.map((p) => `<div class="p-1.5 rounded-md bg-surface-card border border-surface-border flex justify-between text-xs"><b class="font-mono">${p.pair}</b><span class="text-[10px] text-slate-400 font-mono">${p.reversed}</span></div>`).join('')}
              </div>
            </div>` : ''}
        </div>
      </section>

      <section class="lg:col-span-5 bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
        <div class="flex items-start justify-between gap-2 pb-3 border-b border-surface-border">
          <div>
            <h4 class="text-sm font-bold"><span class="text-brand-emerald">✦</span> ชุด 3 ตัว (${r.trioSets.length} ชุด)</h4>
            <p class="text-[11px] text-brand-slate">ผัง Tri-Tier: บน + กลาง + ล่าง / แกน Center</p>
          </div>
          <button data-copy="trios" class="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-muted border border-surface-border">คัดลอก</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
          ${r.trioSets.map((t, i) => `
            <div class="p-2.5 rounded-xl border border-surface-border flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-emerald-50 text-brand-emerald font-mono font-bold flex items-center justify-center text-xs border border-emerald-200">0${i + 1}</div>
                <div><span class="text-xl font-black font-mono tracking-wider">${t.code}</span><span class="block text-[10px] text-slate-400">${t.tags}</span></div>
              </div>
              <div class="text-right"><span class="text-xs px-2 py-0.5 rounded bg-emerald-100/70 text-brand-emerald font-bold font-mono">${(91 - i * 2.5).toFixed(1)}%</span><span class="block text-[9px] text-slate-400 mt-0.5">ตรง-โต๊ด 6 ประตู</span></div>
            </div>`).join('')}
        </div>
      </section>
    </div>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card">
      <div class="grid grid-cols-3 gap-2">
        <button data-act="save" class="py-2.5 rounded-xl bg-brand-emerald text-white text-sm font-semibold shadow-emeraldGlow">💾 บันทึก</button>
        <button data-act="copyAll" class="py-2.5 rounded-xl bg-surface-muted border border-surface-border text-sm font-semibold">คัดลอกสรุป</button>
        <button data-act="download" class="py-2.5 rounded-xl bg-surface-muted border border-surface-border text-sm font-semibold">ดาวน์โหลด</button>
      </div>
    </section>`;
}

function summaryText() {
  const r = state.result;
  const lines = [
    `[สรุป LekDee]`,
    `งวด: ${formatThaiDate(state.date)}`,
    `จันทรคติ: ${state.phase === 'waxing' ? 'ข้างขึ้น' : 'ข้างแรม'} ${state.kham} ค่ำ`,
    `เลขเด่น 3 อันดับ: ${r.sortedDigits.slice(0, 3).join(', ')}`,
    `ชุดเด่น 2 ตัว: ${r.corePairs.map((p) => `${p.pair}(${p.reversed})`).join(', ')}`,
    `ชุดกัน: ${r.protectionPairs.map((p) => `${p.pair}(${p.reversed})`).join(', ')}`,
    `ชุด 3 ตัว: ${r.trioSets.map((t) => t.code).join(', ')}`,
    `* เพื่อความบันเทิง ผลสลากเป็นการสุ่ม`,
  ];
  return lines.join('\n');
}

function download() {
  const blob = new Blob([summaryText()], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `analysis_${toISO(state.date)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('ดาวน์โหลดแล้ว');
}

async function saveCurrent() {
  const r = state.result;
  try {
    await store.saveAnalysis({
      draw_date: toISO(state.date),
      day_idx: state.date.getDay(),
      phase: state.phase,
      kham: state.kham,
      top_digits: r.sortedDigits.slice(0, 3),
      core: r.corePairs.map((p) => p.pair),
      protection: r.protectionPairs.map((p) => p.pair),
      trios: r.trioSets.map((t) => t.code),
    });
    toast(store.mode() === 'cloud' ? 'บันทึกขึ้นคลาวด์แล้ว' : 'บันทึกในเครื่องแล้ว');
  } catch (e) {
    toast('บันทึกไม่สำเร็จ: ' + e.message);
  }
}

/* ------------------------------------------------------------------ backtest */
function pairCountPicker(lao = false) {
  const opts = lao ? LAO_PAIR_OPTIONS : PAIR_COUNT_OPTIONS;
  const cur = lao ? state.laoPairCount : state.pairCount;
  const attr = lao ? 'data-laopaircount' : 'data-paircount';
  return `
    <div class="flex items-center justify-between gap-2 text-xs">
      <span class="text-slate-500">จำนวนชุดเด่น</span>
      <div class="flex gap-1 bg-surface-muted p-1 rounded-lg border border-surface-border">
        ${opts.map((n) => `<button ${attr}="${n}" class="px-3 py-1 rounded-md ${cur === n ? 'bg-surface-card text-brand-emerald font-semibold shadow-sm' : 'text-brand-slate'}">${n} คู่</button>`).join('')}
      </div>
    </div>`;
}

function renderTune() {
  const t = state.tune;
  if (state.tuning) return '<p class="text-xs text-slate-400">กำลังทดลองปรับสูตร 300 รอบ…</p>';
  if (!t) return `<button data-act="tune" class="w-full py-2.5 rounded-xl bg-brand-emerald text-white text-sm font-semibold">▶ รันการทดลอง (${state.pairCount} คู่)</button>`;
  const cell = (v, strong) => `<td class="p-2 text-center font-mono ${strong ? 'font-bold text-brand-navy' : 'text-slate-600'}">${pct(v)}</td>`;
  const gain = t.tunedTest - t.defaultTest;
  const verdict =
    t.tunedTest <= t.defaultTest
      ? 'สูตรที่ปรับแล้วเข้าเป้างวดเก่าได้มากขึ้น แต่กับงวดใหม่ที่ไม่เคยเห็นกลับได้ผลเท่าเดิมหรือแย่ลง แปลว่าสูตรแค่จำผลเก่า (overfitting) ไม่ได้ทำนายได้ดีขึ้น'
      : `สูตรที่ปรับแล้วดีขึ้นกับงวดใหม่ ${pct(gain)} แต่ชุดทดสอบมีแค่ ${t.testSize} งวด ความคลาดเคลื่อนจากการสุ่มอยู่ราว ±${pct(Math.sqrt(t.baseline * (1 - t.baseline) / t.testSize) * 2, 0)} จึงยังสรุปไม่ได้ว่าดีขึ้นจริง`;
  return `
    <div class="overflow-x-auto">
      <table class="w-full text-xs min-w-[300px]">
        <thead><tr class="bg-surface-muted text-brand-slate"><th class="p-2 text-left">สูตร</th><th class="p-2">งวดเก่า (ใช้ปรับ)<br><span class="font-normal">${t.trainSize} งวด</span></th><th class="p-2">งวดใหม่ (ทดสอบ)<br><span class="font-normal">${t.testSize} งวด</span></th></tr></thead>
        <tbody class="divide-y divide-surface-border">
          <tr><td class="p-2">สูตรเดิม</td>${cell(t.defaultTrain)}${cell(t.defaultTest, true)}</tr>
          <tr><td class="p-2">สูตรที่ปรับแล้ว</td>${cell(t.tunedTrain)}${cell(t.tunedTest, true)}</tr>
          <tr><td class="p-2 text-slate-400">สุ่มล้วน (${t.pairCount} คู่)</td>${cell(t.baseline)}${cell(t.baseline)}</tr>
        </tbody>
      </table>
    </div>
    <p class="text-[11px] text-slate-500">งวดเก่า ${shortThaiDate(t.trainRange[0])}–${shortThaiDate(t.trainRange[1])} · งวดใหม่ ${shortThaiDate(t.testRange[0])}–${shortThaiDate(t.testRange[1])}</p>
    <p class="text-xs p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-brand-goldDark">${verdict}</p>
    <button data-act="tune" class="text-[11px] text-brand-emerald font-medium">รันใหม่ (${state.pairCount} คู่)</button>`;
}

function renderBacktest() {
  const draws = allDraws();
  const bt = runBacktest(draws, { pairCount: state.pairCount });
  const kpi = (title, val, sub, base) => `
    <div class="bg-surface-card border border-surface-border rounded-2xl p-3.5 shadow-card">
      <span class="text-[11px] text-brand-slate block">${title}</span>
      <span class="text-2xl font-black font-mono text-brand-emerald">${val}</span>
      <span class="text-[11px] text-slate-500 block">${sub}</span>
      <span class="text-[10px] text-slate-400 block">สุ่มล้วนคาดว่า ≈ ${base}</span>
    </div>`;
  const rows = bt.rows.filter((r) => state.btFilter === 'all' || r.anyHit);

  $('view-backtest').innerHTML = `
    <section class="bg-surface-card border border-surface-border rounded-2xl p-3 shadow-card">${pairCountPicker()}</section>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${kpi('เข้าชุดเด่น (Core)', pct(bt.coreHits / bt.total, 0), `${bt.coreHits}/${bt.total} งวด · ${bt.avgCore.toFixed(0)} คู่`, pct(bt.coreBaseline, 0))}
      ${kpi('เข้าชุดเด่น+กัน', pct(bt.anyHits / bt.total, 0), `${bt.anyHits}/${bt.total} งวด · ${bt.avgAll.toFixed(0)} คู่`, pct(bt.anyBaseline, 0))}
      ${kpi('ชุด 3 ตัว (ตรง-โต๊ด)', pct(bt.trioHits / bt.total, 1), `${bt.trioHits}/${bt.total} งวด · ${bt.avgTrio.toFixed(0)} ชุด`, pct(bt.trioBaseline, 1))}
      ${kpi('เลขวิ่ง 3 อันดับ', pct(bt.runHits / bt.total, 0), `${bt.runHits}/${bt.total} งวด`, pct(bt.runBaseline, 0))}
    </div>
    <p class="text-[11px] text-slate-500 px-1">คำนวณสดจากข้อมูลงวดด้านล่าง: 2 ตัวนับบนหรือล่าง รวมเลขกลับ · 3 ตัวเทียบกับ 3 ตัวท้ายรางวัลที่ 1 แบบซื้อครบ 6 ประตู · ค่า "สุ่มล้วน" คือผลที่ได้ถ้าเลือกเลขมั่ว ๆ จำนวนเท่ากัน — การเพิ่มจำนวนคู่ทำให้เข้าบ่อยขึ้นเพราะซื้อมากขึ้น ไม่ใช่เพราะสูตรแม่นขึ้น</p>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
      <div>
        <h3 class="text-sm font-bold">🧪 ทดลองปรับสูตร (แยกข้อมูลทดสอบ)</h3>
        <p class="text-[11px] text-slate-500">สุ่มปรับน้ำหนักสูตร 300 แบบ เลือกแบบที่เข้าชุดเด่นมากที่สุดในงวดเก่า แล้วนำไปทดสอบกับ 40 งวดล่าสุดที่สูตรไม่เคยเห็น</p>
      </div>
      ${renderTune()}
    </section>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
      <h3 class="text-sm font-bold">เพิ่มผลรางวัลจริง</h3>
      <form id="drawForm" class="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <label class="text-[11px] text-slate-500 col-span-2 sm:col-span-1">วันที่ออกรางวัล<input name="date" type="date" required class="mt-1 w-full bg-surface-muted/60 border border-surface-borderDark rounded-lg px-3 py-2"></label>
        <label class="text-[11px] text-slate-500">รางวัลที่ 1 (6 หลัก)<input name="p1" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required class="mt-1 w-full font-mono bg-surface-muted/60 border border-surface-borderDark rounded-lg px-3 py-2"></label>
        <label class="text-[11px] text-slate-500">2 ตัวล่าง<input name="p2" inputmode="numeric" pattern="[0-9]{2}" maxlength="2" required class="mt-1 w-full font-mono bg-surface-muted/60 border border-surface-borderDark rounded-lg px-3 py-2"></label>
        <button class="col-span-2 sm:col-span-1 py-2.5 rounded-lg bg-brand-emerald text-white text-sm font-semibold">เพิ่มงวด</button>
      </form>
    </section>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-bold">ผลทดสอบรายงวด (${draws.length} งวด)</h3>
        <div class="flex gap-1.5 text-xs">
          <button data-filter="all" class="px-2.5 py-1 rounded-lg ${state.btFilter === 'all' ? 'bg-surface-card border border-surface-border font-semibold' : 'bg-surface-muted text-brand-slate'}">ทั้งหมด</button>
          <button data-filter="hit" class="px-2.5 py-1 rounded-lg ${state.btFilter === 'hit' ? 'bg-surface-card border border-emerald-200 text-brand-emerald font-semibold' : 'bg-surface-muted text-brand-slate'}">เข้าเป้า (${bt.anyHits})</button>
        </div>
      </div>
      <div class="divide-y divide-surface-border">
        ${rows.map((r) => {
          const d = r.draw;
          return `
          <div class="py-2.5 flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 text-sm"><b>${shortThaiDate(d.date)}</b>
                <span class="text-[11px] text-slate-400">${THAI_DAYS[d.dayIdx]} · ${d.lunar === 'waxing' ? 'ขึ้น' : 'แรม'} ${d.kham}</span>
                ${d.mine ? '<span class="text-[10px] px-1.5 rounded bg-blue-50 text-blue-600 border border-blue-100">ของฉัน</span>' : ''}</div>
              <div class="font-mono text-xs text-slate-600">รางวัล 1: ${d.p1} · บน <b>${r.top2}</b> · ล่าง <b class="text-brand-emerald">${r.bottom2}</b></div>
              <div class="text-[11px] ${r.anyHit ? 'text-brand-emerald' : 'text-slate-400'}">${r.detail.length ? r.detail.join(' · ') : 'ไม่เข้าชุดที่แนะนำ'}</div>
            </div>
            <div class="flex flex-col gap-1 items-end shrink-0">
              <span class="px-2 py-0.5 rounded-full text-[11px] border ${r.anyHit ? 'bg-emerald-50 text-brand-emerald border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">${r.anyHit ? 'เข้า ✓' : 'หลุด'}</span>
              <div class="flex gap-1">
                <button data-load="${d.date}|${d.lunar}|${d.kham}" class="text-[11px] px-2 py-0.5 rounded bg-surface-muted border border-surface-border text-brand-emerald">โหลด</button>
                ${d.mine ? `<button data-deldraw="${d.id}" class="text-[11px] px-2 py-0.5 rounded bg-red-50 border border-red-100 text-red-500">ลบ</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>`;
}

async function loadDraws() {
  try {
    state.userDraws = await store.listDraws();
  } catch (e) {
    console.warn(e);
  }
}

async function submitDraw(form) {
  const f = new FormData(form);
  const iso = f.get('date');
  const p1 = String(f.get('p1')).trim();
  const p2 = String(f.get('p2')).trim();
  if (!/^\d{6}$/.test(p1) || !/^\d{2}$/.test(p2) || !iso) return toast('กรอกข้อมูลไม่ครบ/ไม่ถูกต้อง');
  const date = parseISO(iso);
  const l = calculateThaiLunar(date);
  try {
    await store.addDraw({ draw_date: iso, p1, p2, day_idx: date.getDay(), lunar: l.phase, kham: l.kham });
    await loadDraws();
    renderBacktest();
    toast('เพิ่มงวดแล้ว');
  } catch (e) {
    toast('เพิ่มไม่สำเร็จ: ' + e.message);
  }
}

/* ------------------------------------------------------------------ lao pattana */
function renderLao() {
  const next = nextDrawDate();
  const r = runLaoEngine(LAO_DRAWS, next.getDay(), { pairCount: state.laoPairCount });
  const bt = runLaoBacktest(LAO_DRAWS, { pairCount: state.laoPairCount });
  const hitMap = new Map(bt.rows.map((x) => [x.draw.date, x]));
  const first = LAO_DRAWS[0].date;
  const last = LAO_DRAWS[LAO_DRAWS.length - 1];
  const high = r.sortedDigits.slice(0, 3);
  const kpi = (title, val, sub, base) => `
    <div class="bg-surface-card border border-surface-border rounded-2xl p-3.5 shadow-card">
      <span class="text-[11px] text-brand-slate block">${title}</span>
      <span class="text-2xl font-black font-mono text-brand-emerald">${val}</span>
      <span class="text-[11px] text-slate-500 block">${sub}</span>
      <span class="text-[10px] text-slate-400 block">สุ่มล้วนคาดว่า ≈ ${base}</span>
    </div>`;

  $('view-lao').innerHTML = `
    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span>หวยลาวพัฒนา</h2>
          <p class="text-[11px] text-brand-slate">ออกรางวัลจันทร์–ศุกร์ เวลา 20.00 น. · เลขรางวัล 6 ตัว ใช้ 2–3 ตัวท้ายตรวจ</p>
        </div>
        <div class="text-right shrink-0">
          <span class="text-[10px] text-slate-400 block">งวดถัดไป</span>
          <span class="text-xs font-bold text-brand-emerald">${formatThaiDate(next)}</span>
        </div>
      </div>
      <div class="p-3 rounded-xl bg-surface-muted/60 border border-surface-border flex items-center justify-between gap-3">
        <div><span class="text-[11px] text-brand-slate block">ผลล่าสุด · ${shortThaiDate(last.date)}</span>
          <span class="font-mono text-xl font-black tracking-widest">${last.n6.slice(0, 3)}<span class="text-brand-emerald">${last.n6.slice(3)}</span></span></div>
        <div class="text-right text-[11px] text-slate-500">3 ตัวท้าย <b class="font-mono text-brand-navy">${last.last3}</b><br>2 ตัวท้าย <b class="font-mono text-brand-emerald">${last.last2}</b></div>
      </div>
      <p class="text-[11px] text-slate-500">วิเคราะห์จากสถิติเลข ${LAO_DRAWS.length} งวดล่าสุด (${shortThaiDate(first)}–${shortThaiDate(last.date)}) ร่วมกับตารางกำลังวันเล็กน้อย</p>
    </section>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
      <h3 class="text-sm font-bold">คะแนนเลขเดี่ยว 0–9</h3>
      <div class="grid grid-cols-5 xl:grid-cols-10 gap-2">
        ${r.sortedDigits.slice().sort((a, b) => a - b).map((d) => {
          const isTop = high.includes(d);
          return `<div class="p-2 rounded-xl border text-center ${isTop ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-200' : 'border-surface-border'}">
            <span class="text-lg font-black font-mono ${isTop ? 'text-brand-goldDark' : ''}">${d}</span>
            <span class="block text-[10px] font-mono text-slate-500">${r.probMap[d].toFixed(1)}%</span></div>`;
        }).join('')}
      </div>
      <p class="text-xs">เด่น 3 อันดับ: ${high.map((d, i) => `<b class="font-mono text-base ${i === 0 ? 'text-brand-goldDark' : 'text-brand-emerald'}">${d}</b>`).join(' · ')}</p>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <section class="lg:col-span-7 bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
        <div class="flex items-start justify-between gap-2 pb-3 border-b border-surface-border">
          <div>
            <h4 class="text-sm font-bold"><span class="text-brand-gold">✦</span> ชุดเด่น 2 ตัว (${r.corePairs.length} คู่)</h4>
            <p class="text-[11px] text-brand-slate">รวมเลขกลับ · ชุดกันอีก ${r.protectionPairs.length} คู่</p>
          </div>
          <button data-copy="lao-core" class="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-muted border border-surface-border">คัดลอก</button>
        </div>
        ${pairCountPicker(true)}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          ${r.corePairs.map((p, i) => `<div class="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200"><div class="flex items-center justify-between"><span class="text-xl font-black font-mono text-brand-goldDark tracking-wider">${p.pair}</span><span class="text-[10px] px-1.5 rounded bg-amber-100 text-brand-goldDark border border-amber-300 font-bold">#${i + 1}</span></div><div class="text-[10px] text-slate-500 mt-1">กลับ <b class="font-mono">${p.reversed}</b></div></div>`).join('')}
        </div>
        <div class="pt-3 border-t border-surface-border">
          <span class="text-xs font-bold text-brand-slate">🛡️ ชุดกัน</span>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">${r.protectionPairs.map((p) => `<div class="p-2 rounded-lg bg-surface-muted/60 border border-surface-border"><span class="text-base font-bold font-mono">${p.pair}</span><span class="block text-[10px] text-slate-400">กลับ ${p.reversed}</span></div>`).join('')}</div>
        </div>
      </section>
      <section class="lg:col-span-5 bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
        <div class="flex items-start justify-between gap-2 pb-3 border-b border-surface-border">
          <div><h4 class="text-sm font-bold"><span class="text-brand-emerald">✦</span> ชุด 3 ตัว (${r.trioSets.length} ชุด)</h4><p class="text-[11px] text-brand-slate">ซื้อโต๊ด 6 ประตู</p></div>
          <button data-copy="lao-trio" class="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-muted border border-surface-border">คัดลอก</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
          ${r.trioSets.map((t, i) => `<div class="p-2.5 rounded-xl border border-surface-border flex items-center gap-3"><div class="w-8 h-8 rounded-lg bg-emerald-50 text-brand-emerald font-mono font-bold flex items-center justify-center text-xs border border-emerald-200">0${i + 1}</div><span class="text-xl font-black font-mono tracking-wider">${t.code}</span></div>`).join('')}
        </div>
      </section>
    </div>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
      <div>
        <h3 class="text-sm font-bold">ผลทดสอบย้อนหลัง (${bt.total} งวด)</h3>
        <p class="text-[11px] text-slate-500">ทำนายทีละงวดโดยใช้เฉพาะผลที่ออกก่อนหน้า (ไม่แอบดูอนาคต) · 30 งวดแรกใช้เป็นข้อมูลตั้งต้น · หวยลาวมีเลข 2 ตัวท้ายชุดเดียว ไม่มี 2 ตัวล่างแยก</p>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${kpi('เข้าชุดเด่น 2 ตัว', pct(bt.coreHits / bt.total, 0), `${bt.coreHits}/${bt.total} งวด · ${bt.avgCore.toFixed(0)} คู่`, pct(bt.coreBaseline, 0))}
        ${kpi('เข้าชุดเด่น+กัน', pct(bt.anyHits / bt.total, 0), `${bt.anyHits}/${bt.total} งวด · ${bt.avgAll.toFixed(0)} คู่`, pct(bt.anyBaseline, 0))}
        ${kpi('ชุด 3 ตัว', pct(bt.trioHits / bt.total, 1), `${bt.trioHits}/${bt.total} งวด · ${bt.avgTrio.toFixed(0)} ชุด`, pct(bt.trioBaseline, 1))}
      </div>
      <p class="text-xs p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-brand-goldDark">ลองวิธีเลือกเลขแล้ว 4 แบบ (เลขที่ออกบ่อย, ออกบ่อยช่วง 30 งวดหลัง, เลขที่ออกน้อย, เลขที่หายไปนาน) ทุกแบบได้ผลใกล้เคียง “สุ่มล้วน” และการกระจายของเลข 0–9 ใน ${LAO_DRAWS.length} งวดไม่ต่างจากการสุ่มอย่างมีนัยสำคัญ (χ² = 14.1 จากเกณฑ์ 16.9) ตัวเลขจะถึง 55% ได้เมื่อซื้อ ~28 คู่ (56 เลข) ซึ่งมาจากการครอบคลุมเลขมากขึ้น ไม่ใช่เพราะสูตรแม่น</p>
    </section>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-2">
      <h3 class="text-sm font-bold">ผลรางวัลย้อนหลัง ${LAO_DRAWS.length} งวด</h3>
      <div class="divide-y divide-surface-border max-h-[28rem] overflow-y-auto pr-1">
        ${[...LAO_DRAWS].reverse().map((d) => {
          const h = hitMap.get(d.date);
          return `<div class="py-2 flex items-center justify-between gap-2 text-sm">
            <div><b>${shortThaiDate(d.date)}</b> <span class="text-[11px] text-slate-400">${THAI_DAYS[new Date(d.date + 'T12:00:00').getDay()]}</span></div>
            <div class="font-mono">${d.n6.slice(0, 3)}<b class="text-brand-emerald">${d.n6.slice(3)}</b></div>
            <span class="w-14 text-center text-[10px] px-1.5 py-0.5 rounded-full border ${h ? (h.anyHit ? 'bg-emerald-50 text-brand-emerald border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200') : 'text-slate-300 border-transparent'}">${h ? (h.anyHit ? 'เข้า ✓' : 'หลุด') : 'ตั้งต้น'}</span>
          </div>`;
        }).join('')}
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ check results */
const checkDraws = () => (state.checkKind === 'thai' ? HISTORICAL_DRAWS : [...LAO_DRAWS].reverse());
const dayNameOf = (iso) => THAI_DAYS[parseISO(iso).getDay()];

function checkResultHTML() {
  const kind = state.checkKind;
  const draws = checkDraws();
  const draw = draws[state.checkIdx] || draws[0];
  const num = state.checkNum;
  const allowed = VALID_LENGTHS[kind];
  if (!num) return `<p class="text-xs text-slate-400">พิมพ์เลขที่ต้องการตรวจ (${allowed.join(' / ')} หลัก)</p>`;
  if (!allowed.includes(num.length)) return `<p class="text-xs text-amber-600">ตรวจได้เฉพาะเลข ${allowed.join(' / ')} หลัก — ตอนนี้พิมพ์ ${num.length} หลัก</p>`;
  const res = kind === 'thai' ? checkThai(num, draw) : checkLao(num, draw);
  const won = res.some((r) => r.hit);
  return `
    <div class="p-3 rounded-xl border ${won ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-surface-border'}">
      <p class="text-sm font-bold ${won ? 'text-brand-emerald' : 'text-slate-500'}">${won ? '🎉 ถูกรางวัล!' : 'ไม่ถูกรางวัลในงวดนี้'}</p>
      <p class="text-[11px] text-slate-500 mb-2">เลข <b class="font-mono text-brand-navy">${esc(num)}</b> · งวด ${shortThaiDate(draw.date)}</p>
      <div class="grid grid-cols-2 gap-2">
        ${res.map((r) => `<div class="px-2.5 py-1.5 rounded-lg text-xs border flex items-center justify-between ${r.hit ? 'bg-emerald-100 border-emerald-300 text-brand-emerald font-semibold' : 'bg-white border-surface-border text-slate-400'}"><span>${r.label}</span><span>${r.hit ? '✓ ถูก' : '✗'}</span></div>`).join('')}
      </div>
    </div>`;
}

function renderCheck() {
  const kind = state.checkKind;
  const isThai = kind === 'thai';
  const draws = checkDraws();
  if (state.checkIdx >= draws.length) state.checkIdx = 0;
  const draw = draws[state.checkIdx];
  const hi = isThai ? 'text-brand-emerald' : 'text-red-600';
  const full = isThai ? draw.p1 : draw.n6;
  const subs = isThai
    ? [['3 ตัวท้าย (บน)', draw.p1.slice(-3)], ['2 ตัวบน', draw.p1.slice(-2)], ['2 ตัวล่าง', draw.p2]]
    : [['4 ตัวท้าย', draw.n6.slice(-4)], ['3 ตัวท้าย', draw.n6.slice(-3)], ['2 ตัวท้าย', draw.n6.slice(-2)]];

  $('view-check').innerHTML = `
    <div class="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface-muted border border-surface-border">
      <button data-ckind="thai" class="py-2.5 rounded-xl text-sm font-bold ${isThai ? 'bg-brand-emerald text-white shadow-emeraldGlow' : 'text-brand-slate'}">🇹🇭 หวยไทย <span class="text-[10px] font-normal opacity-80">รัฐบาล</span></button>
      <button data-ckind="lao" class="py-2.5 rounded-xl text-sm font-bold ${!isThai ? 'bg-red-600 text-white shadow' : 'text-brand-slate'}">🇱🇦 หวยลาว <span class="text-[10px] font-normal opacity-80">พัฒนา</span></button>
    </div>

    <section class="rounded-2xl overflow-hidden border ${isThai ? 'border-emerald-200' : 'border-red-200'} shadow-card bg-surface-card">
      <div class="px-4 py-2.5 ${isThai ? 'bg-emerald-50' : 'bg-red-50'} flex items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold ${isThai ? 'text-brand-emeraldDark' : 'text-red-700'}">${isThai ? 'ผลสลากกินแบ่งรัฐบาลไทย' : 'ผลสลากพัฒนา สปป.ลาว'}</h2>
          <p class="text-[11px] text-slate-500">${isThai ? 'ออกรางวัลวันที่ 1 และ 16 ของเดือน' : 'ออกรางวัลจันทร์–ศุกร์ เวลา 20.00 น.'}</p>
        </div>
        <select id="checkDraw" class="max-w-[48%] bg-white border border-surface-border rounded-lg px-2 py-1.5 text-xs">
          ${draws.slice(0, 60).map((d, i) => `<option value="${i}" ${i === state.checkIdx ? 'selected' : ''}>${shortThaiDate(d.date)}${i === 0 ? ' (ล่าสุด)' : ''}</option>`).join('')}
        </select>
      </div>
      <div class="p-4 space-y-3">
        <div class="text-center">
          <p class="text-[11px] text-slate-400">${dayNameOf(draw.date)}ที่ ${shortThaiDate(draw.date)}</p>
          <p class="text-[11px] text-slate-500 mt-1">${isThai ? 'รางวัลที่ 1' : 'เลขรางวัล 6 ตัว'}</p>
          <span class="font-mono text-3xl font-black tracking-widest">${full.slice(0, 3)}<span class="${hi}">${full.slice(3)}</span></span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${subs.map(([l, v]) => `<div class="p-2.5 rounded-xl border border-surface-border text-center"><span class="block text-[10px] text-slate-400">${l}</span><span class="font-mono text-xl font-black ${hi}">${v}</span></div>`).join('')}
        </div>
        ${isThai ? '<p class="text-[10px] text-slate-400">* ระบบเก็บเฉพาะรางวัลที่ 1 และเลขท้าย 2 ตัว ไม่รวมเลขหน้า 3 ตัว เลขท้าย 3 ตัว และรางวัลอื่น ๆ โปรดตรวจสลากกับ glo.or.th อีกครั้ง</p>' : ''}
      </div>
    </section>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
      <h3 class="text-sm font-bold">🎫 ตรวจเลขของคุณ <span class="text-[11px] font-normal text-slate-400">กับงวด ${shortThaiDate(draw.date)}</span></h3>
      <input id="checkNum" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="พิมพ์เลข ${VALID_LENGTHS[kind].join(' / ')} หลัก" value="${esc(state.checkNum)}" class="w-full font-mono text-xl tracking-widest bg-surface-muted/60 border border-surface-borderDark rounded-xl px-4 py-3 focus:outline-none">
      <div id="checkResult">${checkResultHTML()}</div>
    </section>

    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-2">
      <h3 class="text-sm font-bold">ผลย้อนหลัง ${Math.min(draws.length, 30)} งวดล่าสุด <span class="text-[11px] font-normal text-slate-400">แตะเพื่อเลือกงวด</span></h3>
      <div class="divide-y divide-surface-border">
        ${draws.slice(0, 30).map((d, i) => {
          const f = isThai ? d.p1 : d.n6;
          const tail = isThai ? `บน ${d.p1.slice(-2)} · ล่าง ${d.p2}` : `4 ตัว ${d.n6.slice(-4)}`;
          return `<button data-cidx="${i}" class="w-full py-2 px-1 flex items-center justify-between gap-2 text-left ${i === state.checkIdx ? (isThai ? 'bg-emerald-50' : 'bg-red-50') : ''}">
            <span class="text-sm"><b>${shortThaiDate(d.date)}</b> <span class="text-[11px] text-slate-400">${dayNameOf(d.date)}</span></span>
            <span class="font-mono text-sm">${f.slice(0, 4)}<b class="${hi}">${f.slice(4)}</b></span>
            <span class="text-[11px] text-slate-500 font-mono">${tail}</span>
          </button>`;
        }).join('')}
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ reference */
function renderReference() {
  const data = TABLES_DATA[state.refSub];
  const subs = [['day', 'ประจำวัน'], ['waxing', 'ข้างขึ้น'], ['waning', 'ข้างแรม']];
  $('view-reference').innerHTML = `
    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-3">
      <h2 class="text-sm font-bold">ตารางเลขกำลังวัน</h2>
      <div class="grid grid-cols-3 gap-1 bg-surface-muted p-1 rounded-xl border border-surface-border text-xs">
        ${subs.map(([k, l]) => `<button data-ref="${k}" class="py-1.5 rounded-lg ${state.refSub === k ? 'bg-surface-card text-brand-emerald font-semibold shadow-sm' : 'text-brand-slate'}">${l}</button>`).join('')}
      </div>
      <div class="overflow-x-auto -mx-1">
        <table class="w-full text-left text-xs sm:text-sm min-w-[520px]">
          <thead><tr class="bg-surface-muted text-brand-slate"><th class="p-2">วัน</th><th class="p-2">บน</th><th class="p-2">กลาง</th><th class="p-2">ล่าง</th><th class="p-2 text-center">Center</th><th class="p-2">ทั้งหมด</th></tr></thead>
          <tbody class="divide-y divide-surface-border font-mono">
            ${Array.from({ length: 7 }, (_, i) => data[i]).map((x) => `
              <tr><td class="p-2 font-sans font-semibold whitespace-nowrap">${x.name}</td><td class="p-2">${x.top.join(', ')}</td><td class="p-2">${x.mid.join(', ')}</td><td class="p-2">${x.bottom.join(', ')}</td><td class="p-2 text-center font-bold text-brand-gold">${x.center}</td><td class="p-2 text-brand-emerald font-bold">${x.all.join(' ')}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ history */
async function loadHistory() {
  const box = $('view-history');
  box.innerHTML = '<p class="text-center text-sm text-slate-400 py-8">กำลังโหลด…</p>';
  try {
    state.history = await store.listAnalyses();
  } catch (e) {
    box.innerHTML = `<p class="text-center text-sm text-red-500 py-8">โหลดไม่สำเร็จ: ${esc(e.message)}</p>`;
    return;
  }
  if (!state.history.length) {
    box.innerHTML = '<p class="text-center text-sm text-slate-400 py-10">ยังไม่มีการวิเคราะห์ที่บันทึกไว้<br>กด “บันทึก” ที่หน้าวิเคราะห์</p>';
    return;
  }
  box.innerHTML = state.history.map((h) => `
    <section class="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-card space-y-2">
      <div class="flex items-center justify-between">
        <div><b class="text-sm">${shortThaiDate(h.draw_date)}</b>
          <span class="text-[11px] text-slate-400"> ${THAI_DAYS[h.day_idx]} · ${h.phase === 'waxing' ? 'ขึ้น' : 'แรม'} ${h.kham} ค่ำ</span></div>
        <div class="flex gap-1.5">
          <button data-load="${h.draw_date}|${h.phase}|${h.kham}" class="text-[11px] px-2 py-1 rounded bg-surface-muted border border-surface-border text-brand-emerald">เปิด</button>
          <button data-delhist="${h.id}" class="text-[11px] px-2 py-1 rounded bg-red-50 border border-red-100 text-red-500">ลบ</button>
        </div>
      </div>
      <p class="text-xs"><span class="text-slate-400">เด่น:</span> <b class="font-mono text-brand-goldDark">${esc(h.top_digits.join(' '))}</b></p>
      <p class="text-xs"><span class="text-slate-400">2 ตัว:</span> <span class="font-mono">${esc(h.core.join(', '))}</span></p>
      <p class="text-xs"><span class="text-slate-400">กัน:</span> <span class="font-mono">${esc(h.protection.join(', '))}</span></p>
      <p class="text-xs"><span class="text-slate-400">3 ตัว:</span> <span class="font-mono">${esc(h.trios.join(', '))}</span></p>
    </section>`).join('');
}

/* ------------------------------------------------------------------ events */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;

  if (d.tab) return switchTab(d.tab);
  if (d.ckind) {
    state.checkKind = d.ckind;
    state.checkIdx = 0;
    state.checkNum = '';
    return renderCheck();
  }
  if (d.cidx !== undefined) {
    state.checkIdx = Number(d.cidx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return renderCheck();
  }
  if (d.quick) {
    const q = QUICK_DRAWS.find((x) => x.iso === d.quick);
    applyDate(parseISO(q.iso), { phase: q.phase, kham: q.kham });
    return toast(`เลือกงวด ${q.label}`);
  }
  if (d.phase) {
    state.phase = d.phase;
    state.manual = true;
    return compute();
  }
  if (d.copy === 'lao-core' || d.copy === 'lao-trio') {
    const lr = runLaoEngine(LAO_DRAWS, nextDrawDate().getDay(), { pairCount: state.laoPairCount });
    const list = d.copy === 'lao-core' ? lr.corePairs.map((p) => p.pair) : lr.trioSets.map((x) => x.code);
    await copyText(list.join(', '));
    return toast('คัดลอกแล้ว: ' + list.join(', '));
  }
  if (d.copy) {
    const r = state.result;
    const map = {
      corePairs: r.corePairs.map((p) => p.pair),
      protPairs: r.protectionPairs.map((p) => p.pair),
      trios: r.trioSets.map((x) => x.code),
    };
    await copyText(map[d.copy].join(', '));
    return toast('คัดลอกแล้ว: ' + map[d.copy].join(', '));
  }
  if (d.laopaircount) {
    state.laoPairCount = Number(d.laopaircount);
    return renderLao();
  }
  if (d.paircount) {
    state.pairCount = Number(d.paircount);
    state.tune = null;
    try {
      localStorage.setItem('pairCount', d.paircount);
    } catch {
      /* storage blocked */
    }
    compute();
    if (state.tab === 'backtest') renderBacktest();
    if (state.tab === 'lao') renderLao();
    return;
  }
  if (d.filter) {
    state.btFilter = d.filter;
    return renderBacktest();
  }
  if (d.ref) {
    state.refSub = d.ref;
    return renderReference();
  }
  if (d.load) {
    const [iso, phase, kham] = d.load.split('|');
    applyDate(parseISO(iso), { phase, kham: Number(kham) });
    switchTab('dashboard');
    return toast(`โหลดงวด ${shortThaiDate(iso)}`);
  }
  if (d.deldraw) {
    await store.deleteDraw(d.deldraw);
    await loadDraws();
    return renderBacktest();
  }
  if (d.delhist) {
    await store.deleteAnalysis(d.delhist);
    return loadHistory();
  }

  switch (d.act) {
    case 'today': applyDate(new Date()); return toast('เลือกวันนี้');
    case 'toggleManual': state.showManual = !state.showManual; return renderDashboard();
    case 'togglePool': state.showPool = !state.showPool; return renderDashboard();
    case 'save': return saveCurrent();
    case 'tune':
      state.tuning = true;
      renderBacktest();
      setTimeout(() => {
        state.tune = tuneTrainTest(allDraws(), { pairCount: state.pairCount });
        state.tuning = false;
        renderBacktest();
      }, 30);
      return;
    case 'copyAll': await copyText(summaryText()); return toast('คัดลอกสรุปแล้ว');
    case 'download': return download();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'dateInput' && e.target.value) applyDate(parseISO(e.target.value));
  if (e.target.id === 'checkDraw') {
    state.checkIdx = Number(e.target.value);
    return renderCheck();
  }
  if (e.target.id === 'khamSelect') {
    state.kham = Number(e.target.value);
    state.manual = true;
    compute();
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'checkNum') return;
  state.checkNum = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (e.target.value !== state.checkNum) e.target.value = state.checkNum;
  $('checkResult').innerHTML = checkResultHTML();
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'drawForm') {
    e.preventDefault();
    submitDraw(e.target);
  }
});

/* ------------------------------------------------------------------ boot */
async function boot() {
  renderNav();
  applyDate(parseISO('2026-10-16'), { phase: 'waning', kham: 5 });
  renderReference();
  await store.initStore();
  $('storageBadge').textContent = store.mode() === 'cloud' ? '☁ ซิงก์แล้ว' : '📱 ในเครื่อง';
  await loadDraws();
  const official = await store.listOfficialDraws();
  if (mergeThaiDraws(official) + mergeLaoDraws(official) > 0) {
    if (state.tab === 'backtest') renderBacktest();
    if (state.tab === 'lao') renderLao();
    if (state.tab === 'check') renderCheck();
  }
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
boot();
