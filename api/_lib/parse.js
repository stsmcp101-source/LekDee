// ตัวแปลงข้อมูลจากแหล่งผลรางวัล — ฟังก์ชันล้วน ไม่แตะเครือข่าย เพื่อให้ทดสอบได้

/** ผลสลากกินแบ่งรัฐบาลไทย จาก API ของ glo.or.th (getLotteryResult) */
export function parseGloResult(json) {
  const result = json?.response?.result;
  const data = result?.data;
  const p1 = data?.first?.number?.[0]?.value;
  const p2 = data?.last2?.number?.[0]?.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result?.date || '') || !/^\d{6}$/.test(p1 || '') || !/^\d{2}$/.test(p2 || '')) return null;
  return { lottery: 'thai', draw_date: result.date, p1, p2 };
}

/**
 * ผลหวยลาวพัฒนาจากหน้าสถิติของ horoscope.thaiorc.com (ตารางวันที่ / เลข 4 ตัว / 3 ตัว / 2 ตัว)
 * เว็บนี้ลงเลขท้าย 4 ตัว ไม่มีเลข 6 ตัวเต็ม — เก็บ 4 หลักไว้ใน p1
 * ตรวจว่า 3 ตัวและ 2 ตัวสอดคล้องกับ 4 ตัว แถวที่ไม่สอดคล้องจะถูกข้าม
 */
export function parseThaiorcLao(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  // แต่ละแถวมีวันที่ซ้ำหลายรอบ (ฟอนต์ต่างขนาดจอ) ตามด้วยเลข 4 / 3 / 2 ตัว
  const re = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}\/\d{2}\/\d{4})*\s+(\d{4})\s+(\d{3})\s+(\d{2})(?!\d)/g;
  const rows = [];
  const seen = new Set();
  for (const m of text.matchAll(re)) {
    const [, d, mo, y, n4, n3, n2] = m;
    if (n4.slice(-3) !== n3 || n3.slice(-2) !== n2) continue;
    const date = `${Number(y) - 543}-${mo}-${d}`;
    if (seen.has(date)) continue;
    seen.add(date);
    rows.push({ lottery: 'lao', draw_date: date, p1: n4, p2: null });
  }
  return rows;
}
