// ตรวจเลขของผู้ใช้กับผลรางวัลของงวดที่เลือก — ฟังก์ชันล้วน ทดสอบได้

const sortStr = (s) => [...s].sort().join('');

/**
 * หวยไทย: ข้อมูลที่มีคือรางวัลที่ 1 (6 หลัก) และเลขท้าย 2 ตัวล่าง
 * (ไม่มีรางวัลเลขหน้า 3 ตัว / เลขท้าย 3 ตัว จึงตรวจเฉพาะที่อนุมานจากรางวัลที่ 1 ได้)
 */
export function checkThai(num, draw) {
  const p1 = draw.p1;
  if (num.length === 6) return [{ label: 'รางวัลที่ 1', hit: num === p1, prize: '6,000,000 บาท' }];
  if (num.length === 3) {
    const t3 = p1.slice(-3);
    return [
      { label: '3 ตัวบน (ตรง)', hit: num === t3 },
      { label: '3 ตัวโต๊ด', hit: num !== t3 && sortStr(num) === sortStr(t3) },
    ];
  }
  if (num.length === 2) {
    return [
      { label: '2 ตัวบน', hit: num === p1.slice(-2) },
      { label: '2 ตัวล่าง', hit: num === draw.p2 },
    ];
  }
  return [];
}

/** หวยลาวพัฒนา: ตรวจจาก 6, 4, 3 และ 2 ตัวท้ายของเลขรางวัล */
export function checkLao(num, draw) {
  const n6 = draw.n6;
  if (num.length === 6) {
    // บางงวดมีเฉพาะเลขท้าย 4 ตัว (ตามแหล่งข้อมูล) ตรวจเลข 6 ตัวไม่ได้
    if (n6.length < 6) return [{ label: 'เลข 6 ตัว (งวดนี้ไม่มีข้อมูล 2 หลักหน้า)', hit: false }];
    return [{ label: 'เลข 6 ตัว', hit: num === n6 }];
  }
  if (num.length === 4) return [{ label: '4 ตัวท้าย', hit: num === n6.slice(-4) }];
  if (num.length === 3) {
    const t3 = n6.slice(-3);
    return [
      { label: '3 ตัวท้าย (ตรง)', hit: num === t3 },
      { label: '3 ตัวโต๊ด', hit: num !== t3 && sortStr(num) === sortStr(t3) },
    ];
  }
  if (num.length === 2) return [{ label: '2 ตัวท้าย', hit: num === n6.slice(-2) }];
  return [];
}

export const VALID_LENGTHS = { thai: [2, 3, 6], lao: [2, 3, 4, 6] };
