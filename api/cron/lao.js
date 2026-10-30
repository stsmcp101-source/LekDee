import { parseThaiorcLao } from '../_lib/parse.js';
import { saveDraws, existingDates, authorize } from '../_lib/db.js';

// ดึงจากหน้าสถิติหวยลาวย้อนหลัง 1 ปีของ horoscope.thaiorc.com (robots.txt ไม่ห้าม) วันละ 1 ครั้ง
// บอกตัวตนตามจริงว่าเป็นบอท ไม่ปลอมเป็นเบราว์เซอร์ — ถ้าเว็บต้นทางไม่อนุญาต ต้องเปลี่ยนแหล่งข้อมูล
const SOURCE = 'https://horoscope.thaiorc.com/lotto/lao/stats/lottery-years1.php';
const HEADERS = { 'User-Agent': 'LekDeeBot/1.0 (daily lottery result sync)', 'Accept-Language': 'th' };

// ตั้งเวลา 22:00 น. (เวลาไทย) วันจันทร์–ศุกร์ — ดูที่ vercel.json
export default async function handler(req, res) {
  if (!authorize(req, res)) return;
  try {
    const dry = req.query?.dry === '1';
    const r = await fetch(SOURCE, { headers: HEADERS });
    const html = await r.text();
    if (!r.ok) throw new Error(`${SOURCE} -> HTTP ${r.status}: ${html.slice(0, 120).replace(/\s+/g, ' ')}`);
    const rows = parseThaiorcLao(html);
    if (!rows.length) throw new Error('อ่านตารางผลหวยลาวไม่ได้ (รูปแบบหน้าเว็บอาจเปลี่ยน)');
    const have = await existingDates('lao');
    const fresh = rows.filter((row) => !have.has(row.draw_date));
    if (!dry) await saveDraws(fresh);
    res.status(200).json({ ok: true, dry, parsed: rows.length, saved: fresh });
  } catch (e) {
    console.error('[cron/lao] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
}
