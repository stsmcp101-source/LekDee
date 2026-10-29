# วิเคราะห์เลขกำลังวัน (Mobile-first PWA)

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
