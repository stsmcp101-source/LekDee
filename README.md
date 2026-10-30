# LekDee (Mobile-first PWA)

Vite + Tailwind + Supabase (ไม่บังคับ) · deploy บน Vercel

## รันในเครื่อง
```bash
npm install
npm run dev      # http://localhost:5173
npm test
```
ไม่ตั้งค่า Supabase ก็ใช้งานได้ — ข้อมูลที่บันทึกจะเก็บใน localStorage ของเครื่อง

## ตั้งค่า Supabase (ซิงก์ประวัติ + ผลรางวัลที่เพิ่มเอง)
1. สร้างโปรเจกต์ที่ supabase.com
2. SQL Editor → วางและรัน `supabase/schema.sql`
3. Authentication → Sign In / Providers → เปิด **Allow anonymous sign-ins**
4. Project Settings → API → คัดลอก URL และ anon key ใส่ `.env.local`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
ข้อมูลแต่ละเครื่องแยกกันด้วย RLS (anonymous user) — ล้างข้อมูลเบราว์เซอร์ = เสียตัวตน anonymous นั้น
ถ้าต้องการใช้ข้ามเครื่อง ให้เพิ่ม Email/Magic-link login ภายหลัง

## Deploy
1. push ขึ้น GitHub
2. vercel.com → Add New Project → เลือก repo (Framework = Vite อัตโนมัติ)
3. Settings → Environment Variables ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`
4. Deploy — บนมือถือเปิดลิงก์แล้ว “เพิ่มไปยังหน้าจอโฮม” จะใช้เหมือนแอป

## หมายเหตุสำคัญ
ตัวเลข “แม่นยำ 85%+ / 88%” ในไฟล์ต้นฉบับถูกตั้งค่าไว้ล่วงหน้า ในเวอร์ชันนี้หน้า “ย้อนหลัง” คำนวณจากข้อมูลจริงทุกครั้ง
พร้อมเทียบกับโอกาสเมื่อสุ่มล้วน และแอปนี้ใช้เพื่อความบันเทิงเท่านั้น

## ดึงผลรางวัลอัตโนมัติ (Vercel Cron → Supabase)
งานตั้งเวลาดึงผลมาเก็บในตาราง `official_draws` แล้วหน้าเว็บอ่านมาแสดงเองทุกครั้งที่เปิด

| งาน | เวลา (ไทย) | ที่มาข้อมูล |
|---|---|---|
| `/api/cron/thai` | ทุกวัน 18:00 (ย้อนดู 4 วันเผื่อพลาด) | API ของ glo.or.th |
| `/api/cron/lao` | จันทร์–ศุกร์ 22:00 | หน้าหวยลาวของข่าวสด (khaosod.co.th) |

ตั้งค่า (ครั้งเดียว):
1. Supabase → SQL Editor → รันส่วน `official_draws` ท้ายไฟล์ `supabase/schema.sql`
2. Vercel → Settings → Environment Variables เพิ่ม (ห้ามขึ้นต้นด้วย `VITE_`):
   - `SUPABASE_URL` = URL ของโปรเจกต์
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (Supabase → Project Settings → API) **เก็บเป็นความลับ**
   - `CRON_SECRET` = สตริงสุ่มยาว ๆ ที่ตั้งเอง (Vercel จะแนบให้เองตอนเรียก cron)
3. Redeploy แล้วดูที่ Vercel → Settings → Cron Jobs

ทดสอบด้วยมือ (ไม่บันทึกข้อมูล เติม `?dry=1`):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://<โดเมนของคุณ>/api/cron/lao?dry=1"
```
หมายเหตุ: แผน Hobby ของ Vercel รันตามชั่วโมงที่ตั้งแต่เวลาอาจเหลื่อมได้ไม่เกิน 59 นาที (เช่น 18:00–18:59)
ถ้าแหล่งข้อมูลเปลี่ยนรูปแบบหน้าเว็บ งาน lao จะรายงานในช่อง `unreadable` และต้องปรับ `api/_lib/parse.js`
