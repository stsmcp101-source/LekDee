import { parseKhaosodList, parseKhaosodArticle } from '../_lib/parse.js';
import { saveDraws, existingDates, authorize } from '../_lib/db.js';

const UA = 'Mozilla/5.0 (compatible; LekDeeBot/1.0)';

async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'th' } });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
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
    res.status(500).json({ ok: false, error: e.message });
  }
}
