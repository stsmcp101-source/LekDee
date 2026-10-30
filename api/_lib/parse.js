// ตัวแปลงข้อมูลจากแหล่งผลรางวัล — ฟังก์ชันล้วน ไม่แตะเครือข่าย เพื่อให้ทดสอบได้

const MONTHS = {
  มกราคม: 1, กุมภาพันธ์: 2, มีนาคม: 3, เมษายน: 4, พฤษภาคม: 5, มิถุนายน: 6,
  กรกฎาคม: 7, สิงหาคม: 8, กันยายน: 9, ตุลาคม: 10, พฤศจิกายน: 11, ธันวาคม: 12,
};
const MONTH_RE = Object.keys(MONTHS).join('|');

const pad = (n) => String(n).padStart(2, '0');

/** ผลสลากกินแบ่งรัฐบาลไทย จาก API ของ glo.or.th (getLotteryResult) */
export function parseGloResult(json) {
  const result = json?.response?.result;
  const data = result?.data;
  const p1 = data?.first?.number?.[0]?.value;
  const p2 = data?.last2?.number?.[0]?.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result?.date || '') || !/^\d{6}$/.test(p1 || '') || !/^\d{2}$/.test(p2 || '')) return null;
  return { lottery: 'thai', draw_date: result.date, p1, p2 };
}

/** ลิงก์บทความผลหวยลาวจากหน้ารวมของข่าวสด (ใหม่สุดก่อน) */
export function parseKhaosodList(html, limit = 8) {
  const out = [];
  for (const m of html.matchAll(/href="([^"]*laolottery\/news_\d+)"/g)) {
    const url = new URL(m[1], 'https://www.khaosod.co.th').href;
    if (!out.includes(url)) out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** ผลหวยลาวพัฒนาจากบทความข่าวสด — คืน null ถ้าอ่านไม่ได้หรือเลขท้ายไม่สอดคล้องกัน */
export function parseKhaosodArticle(html) {
  const text = htmlToText(html);
  const dm = text.match(new RegExp(`งวด(?:ล่าสุด|ประจำ)?วันที่\\s*(\\d{1,2})\\s*(${MONTH_RE})\\s*(\\d{4})`));
  const nm = text.match(/รางวัลเลข\s*6\s*ตัว\s*:?\s*(\d{6})/);
  if (!dm || !nm) return null;
  const n6 = nm[1];
  const l4 = text.match(/เลขท้าย\s*4\s*ตัว\s*:?\s*(\d{4})/)?.[1];
  const l2 = text.match(/เลขท้าย\s*2\s*ตัว\s*:?\s*(\d{2})/)?.[1];
  if ((l4 && l4 !== n6.slice(-4)) || (l2 && l2 !== n6.slice(-2))) return null;
  const year = Number(dm[3]) - 543;
  return { lottery: 'lao', draw_date: `${year}-${pad(MONTHS[dm[2]])}-${pad(dm[1])}`, p1: n6, p2: null };
}
