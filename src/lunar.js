// คำนวณข้างขึ้น/ข้างแรมแบบประมาณ (อ้างอิงเดือนดับ 2024-05-08 03:22 UTC)
const LUNAR_REF_UTC = Date.UTC(2024, 4, 8, 3, 22, 0);
const SYNODIC_PERIOD = 29.53058867;

export function parseISO(iso) {
  const [y, m, dd] = iso.split('-').map(Number);
  return new Date(y, m - 1, dd);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function calculateThaiLunar(date) {
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const diffDays = (target - LUNAR_REF_UTC) / 86400000;
  let progress = diffDays % SYNODIC_PERIOD;
  if (progress < 0) progress += SYNODIC_PERIOD;

  const half = SYNODIC_PERIOD / 2;
  let phase;
  let kham;
  let illumination;
  if (progress <= half) {
    phase = 'waxing';
    kham = Math.max(1, Math.min(15, Math.floor((progress / half) * 14.5) + 1));
    illumination = Math.round((progress / half) * 100);
  } else {
    phase = 'waning';
    const w = progress - half;
    kham = Math.max(1, Math.min(15, Math.floor((w / half) * 14.5) + 1));
    illumination = Math.round((1 - w / half) * 100);
  }
  return { phase, kham, illumination, dayOfWeek: date.getDay() };
}

export function moonIcon(phase, kham) {
  if (phase === 'waxing') return kham <= 3 ? '🌒' : kham <= 8 ? '🌓' : kham <= 13 ? '🌔' : '🌕';
  return kham <= 3 ? '🌕' : kham <= 8 ? '🌖' : kham <= 12 ? '🌗' : '🌘';
}

export function formatThaiDate(date) {
  const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return `${days[date.getDay()]}ที่ ${date.getDate()} ${months[date.getMonth()]} พ.ศ. ${date.getFullYear() + 543}`;
}

export function shortThaiDate(iso) {
  const d = parseISO(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
}
