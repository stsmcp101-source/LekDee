import { createClient } from '@supabase/supabase-js';

// ใช้ service role key เฉพาะฝั่งเซิร์ฟเวอร์ (ห้ามตั้งชื่อขึ้นต้นด้วย VITE_ เพราะจะหลุดไปในเว็บ)
function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function saveDraws(rows) {
  if (!rows.length) return;
  const { error } = await admin().from('official_draws').upsert(rows, { onConflict: 'lottery,draw_date' });
  if (error) throw new Error(error.message);
}

export async function existingDates(lottery) {
  const { data, error } = await admin().from('official_draws').select('draw_date').eq('lottery', lottery);
  if (error) throw new Error(error.message);
  return new Set(data.map((r) => r.draw_date));
}

/** Vercel Cron ส่ง Authorization: Bearer <CRON_SECRET> มาให้เองเมื่อตั้งตัวแปรนี้ */
export function authorize(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า CRON_SECRET' });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}
