# JLC Phone — เว็บแนะนำมือถือคุ้มค่า

## วิธีรัน
```
python server.py
```
แล้วเปิด http://localhost:8000

## โครงสร้าง
- `server.py` — Backend (Python ล้วน) : API `/api/meta`, `/api/recommend` และคำนวณคะแนน
- `data/phones.json` — ข้อมูลมือถือ (ราคา, คะแนน CPU/GPU/กล้อง/แบต/จอ/ชาร์จ)
- `static/` — Frontend (HTML, CSS, JavaScript)

## เอาขึ้นเป็นเว็บจริงบน Render (ฟรี, Full Stack)
ไม่ต้องติดตั้ง Git — อัปโหลดผ่านหน้าเว็บ GitHub ได้เลย

**1. เอาโค้ดขึ้น GitHub**
1. สมัคร/เข้าสู่ระบบ https://github.com
2. กด **New repository** → ตั้งชื่อ `jlc-phone` → เลือก **Public** → กด **Create repository**
3. ในหน้า repo ใหม่ กดลิงก์ **uploading an existing file**
4. เปิดโฟลเดอร์ `Desktop\JLC Phone` แล้วลากไฟล์และโฟลเดอร์เหล่านี้ไปวาง:
   `server.py`, `render.yaml`, `requirements.txt`, `README.md`, โฟลเดอร์ `data`, `static`, `scripts`
   (ไม่ต้องลาก `dist`, `__pycache__`, `.claude` — โฟลเดอร์ `static` มีโมเดล 3D ด้วย ขนาดรวมประมาณ 13 MB)
5. กด **Commit changes**

**2. สร้างเว็บบน Render**
1. สมัคร https://render.com ด้วยปุ่ม **GitHub** (จะได้เชื่อม repo อัตโนมัติ)
2. กด **New +** → **Blueprint** → เลือก repo `jlc-phone` → กด **Apply**
   (Render อ่าน `render.yaml` แล้วตั้งค่าให้เอง: แพ็กเกจ Free, รันด้วย `python server.py`)
3. รอ 2–3 นาทีจนขึ้น **Live** → ได้ลิงก์เช่น `https://jlc-phone.onrender.com` ส่งให้ใครก็เปิดได้

**อัปเดตเว็บภายหลัง:** อัปโหลดไฟล์ที่แก้ทับใน GitHub (Add file → Upload files) → Render จะ deploy ใหม่เอง
**ข้อจำกัดแพ็กเกจฟรี:** ถ้าไม่มีคนเข้า 15 นาที เซิร์ฟเวอร์จะหลับ คนแรกที่เข้าหลังจากนั้นรอประมาณ 30–60 วินาที
**อยากได้ชื่อเว็บของตัวเอง** (เช่น jlcphone.com): ซื้อโดเมนจากผู้ให้บริการโดเมน แล้วตั้งค่าที่ Render → Settings → Custom Domains

## เวอร์ชันลิงก์ claude.ai (แชร์ให้คนอื่นดู)
- รัน `python scripts/build_static.py` → ได้โฟลเดอร์ `dist/` ที่ไม่ต้องมีเซิร์ฟเวอร์ Python
- เบราว์เซอร์คำนวณเองผ่าน `static/api.js` (สูตรเดียวกับ server.py — ถ้าแก้สูตรใน server.py ต้องแก้ใน api.js ด้วย)
- ทดสอบบนเครื่อง: `python -m http.server 8080 -d dist` แล้วเปิด http://localhost:8080/local.html
- ลิงก์ที่เผยแพร่แล้ว: https://claude.ai/artifact/LUkCekFQ7DBFSZtE7f8xgG (แชร์ได้จากเมนู Share บนหน้าเว็บ)

## โมเดล 3D
- รุ่นที่มีโมเดลจริง: ลงทะเบียนใน `REAL_MODELS` ใน `static/phone-3d.js` และวางไฟล์ไว้ที่ `static/models/<ชื่อรุ่น>/`
- รุ่นอื่นใช้โมเดลที่สร้างจากสเปกอัตโนมัติ
- ผู้ใช้หมุนด้วยนิ้วหรือเมาส์เท่านั้น (ไม่หมุนเอง) ซูมด้วยลูกกลิ้ง
- เครดิต: "iPhone 14 Pro" โดย mister dude — https://sketchfab.com/3d-models/iphone-14-pro-5cb0778041a34f09b409a38c687bb1d4 — สัญญาอนุญาต CC BY 4.0 (ต้องแสดงเครดิตนี้เสมอ ซึ่งเว็บแสดงใต้โมเดลแล้ว)
- ใช้โมเดลจาก Sketchfab: เลือกรุ่นที่สัญญาอนุญาตเป็น CC BY หรือ CC0 และดาวน์โหลดแบบ glTF หรือ Collada (.dae)

## ข้อมูล
- `data/catalog.json` — รายชื่อรุ่นทั้งหมด (ชื่อเท่านั้น) สร้างใหม่ได้ด้วย `python scripts/build_catalog.py`
- `data/brands.json` — แบรนด์ต้น/แบรนด์ย่อย โลโก้ และสี
- `data/phones.json` + `data/specs.json` — รุ่นที่มีสเปกแล้ว (ใช้คำนวณคะแนน) ถ้าชื่อไม่ตรงกับ catalog ให้ใส่ `"catalog": "brand/slug"`

## สูตรคะแนน
- คะแนนสเปก = ค่าเฉลี่ยถ่วงน้ำหนักของเกณฑ์ที่ติ๊ก (★ สำคัญมาก = น้ำหนัก 2)
- ความคุ้มค่า = (คะแนนสเปก − 35)² × (คะแนนด้านที่ติด ★ − 35) ÷ ราคา แล้วปรับให้เครื่องที่คุ้มสุดในผลลัพธ์ = 100
  (35 = ระดับพอใช้ได้ ไม่นับเป็นความคุ้ม / ถ้าไม่มี ★ จะใช้ค่าเฉลี่ยทุกด้านที่เลือก)
- รุ่นในโฟลเดอร์ `data/batches/` คำนวณคะแนน CPU/GPU จากชื่อชิปใน `data/chips.json` อัตโนมัติ ส่วนแบต/จอ/ชาร์จคำนวณจากสเปก
- คะแนน "อัปเดตนาน" ใช้ปีที่เหลือจริง = เดือนเปิดตัว (`data/launch.json`) + ปีที่ผู้ผลิตสัญญา − วันนี้ ถ้าลืมใส่เดือนเปิดตัว เซิร์ฟเวอร์จะแจ้งเตือนตอนเริ่มทำงาน
- เพิ่มรุ่นใหม่: สร้างไฟล์ JSON ใน `data/batches/` และใส่เดือนเปิดตัวใน `data/launch.json` ตามรูปแบบไฟล์ที่มีอยู่ แล้วรีสตาร์ตเซิร์ฟเวอร์
