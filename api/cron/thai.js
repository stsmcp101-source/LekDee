import { parseGloResult } from '../_lib/parse.js';
import { saveDraws, existingDates, authorize } from '../_lib/db.js';

// ตั้งเวลา 18:00 น. (เวลาไทย) ทุกวัน — วันที่ไม่มีงวดออกรางวัล API จะไม่คืนผล ระบบก็แค่ข้ามไป
// ย้อนดู 4 วัน เผื่องวดที่เลื่อนวันออก หรือรอบก่อนหน้าพลาด
const LOOKBACK_DAYS = 4;

async function fetchDay(date) {
  const r = await fetch('https://www.glo.or.th/api/checking/getLotteryResult', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://www.glo.or.th',
      Referer: 'https://www.glo.or.th/',
      'User-Agent': 'Mozilla/5.0 (compatible; LekDeeBot/1.0)',
    },
    body: JSON.stringify({
      date: String(date.getUTCDate()).padStart(2, '0'),
      month: String(date.getUTCMonth() + 1).padStart(2, '0'),
      year: String(date.getUTCFullYear()),
    }),
  });
  if (!r.ok) throw new Error(`GLO HTTP ${r.status}`);
  return parseGloResult(await r.json());
}

export default async function handler(req, res) {
  if (!authorize(req, res)) return;
  try {
    const dry = req.query?.dry === '1';
    const have = await existingDates('thai');
    // เวลาไทย = UTC+7
    const thaiNow = new Date(Date.now() + 7 * 3600 * 1000);
    const fresh = [];
    for (let i = 0; i < LOOKBACK_DAYS; i++) {
      const d = new Date(Date.UTC(thaiNow.getUTCFullYear(), thaiNow.getUTCMonth(), thaiNow.getUTCDate() - i));
      const row = await fetchDay(d);
      if (row && !have.has(row.draw_date) && !fresh.some((f) => f.draw_date === row.draw_date)) fresh.push(row);
    }
    if (!dry) await saveDraws(fresh);
    res.status(200).json({ ok: true, dry, saved: fresh });
  } catch (e) {
    console.error('[cron/thai] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
}
