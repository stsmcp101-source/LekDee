import { parseKhaosodList, parseKhaosodArticle } from '../_lib/parse.js';
import { saveDraws, existingDates, authorize } from '../_lib/db.js';

// บอกตัวตนตามจริงว่าเป็นบอท ไม่ปลอมเป็นเบราว์เซอร์ — ถ้าเว็บต้นทางไม่อนุญาต ต้องเปลี่ยนแหล่งข้อมูล
const HEADERS = { 'User-Agent': 'LekDeeBot/1.0 (daily lottery result sync)', 'Accept-Language': 'th' };

async function getText(url) {
  const r = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  const body = await r.text();
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}: ${body.slice(0, 120).replace(/\s+/g, ' ')}`);
  return body;
}

// ตั้งเวลา 22:00 น. (เวลาไทย) วันจันทร์–ศุกร์ — ดูที่ vercel.json
export default async function handler(req, res) {
  if (!authorize(req, res)) return;
  try {
    const dry = req.query?.dry === '1';
    const links = parseKhaosodList(await getText('https://www.khaosod.co.th/laolottery'));
    const have = await existingDates('lao');
    const fresh = [];
    const skipped = [];
    for (const url of links) {
      const row = parseKhaosodArticle(await getText(url));
      if (!row) skipped.push(url);
      else if (!have.has(row.draw_date) && !fresh.some((f) => f.draw_date === row.draw_date)) fresh.push(row);
    }
    if (!dry) await saveDraws(fresh);
    res.status(200).json({ ok: true, dry, checked: links.length, saved: fresh, unreadable: skipped });
  } catch (e) {
    console.error('[cron/lao] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
}
