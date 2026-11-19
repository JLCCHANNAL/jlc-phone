"""สร้างเวอร์ชันออนไลน์ (ไม่ต้องมีเซิร์ฟเวอร์ Python) ไว้ในโฟลเดอร์ dist/

รัน:  python scripts/build_static.py

ผลลัพธ์:
  dist/data.json    ข้อมูลทั้งหมดที่เบราว์เซอร์ใช้คำนวณเอง (สร้างจากข้อมูลเดียวกับ server.py)
  dist/index.html   หน้าเว็บสำหรับเผยแพร่เป็นลิงก์ claude.ai (ไม่มีแท็ก html/head/body เพราะระบบใส่ให้)
  dist/local.html   หน้าเว็บแบบเต็ม ไว้ทดสอบบนเครื่อง:  python -m http.server 8080 -d dist  แล้วเปิด /local.html
  dist/*.js, style.css, logos/  ไฟล์ประกอบ

ทุกครั้งที่แก้ข้อมูลใน data/ ให้รันสคริปต์นี้ใหม่ก่อนเผยแพร่
"""
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import server  # noqa: E402  ใช้ข้อมูลและสูตรเดียวกับเซิร์ฟเวอร์

STATIC = os.path.join(ROOT, "static")
DIST = os.path.join(ROOT, "dist")

PHONE_FIELDS = ("id", "brand", "brandSlug", "brandName", "name", "price", "priceEst", "chip", "battery",
                "weight", "updates", "launch", "scores", "specs", "colors")


def build_data():
    phones = [{k: p[k] for k in PHONE_FIELDS if k in p} for p in server.PHONES]
    catalog = []
    for i in server.CATALOG:
        row = {"b": i["b"], "s": i["s"], "n": i["n"]}
        if i.get("t"):
            row["t"] = 1
        if i.get("phoneId"):
            row["p"] = i["phoneId"]
        catalog.append(row)
    return {
        "meta": {
            "groups": server.meta_groups(),
            "totalModels": len(server.CATALOG),
            "totalWithSpecs": len(server.PHONES),
            "criteria": server.CRITERIA,
            "presets": server.PRESETS,
            "categories": server.CATEGORIES,
        },
        "constants": {
            "valueBase": server.VALUE_BASE,
            "maxUpdateYears": server.MAX_UPDATE_YEARS,
            "weightBest": server.WEIGHT_BEST,
            "weightWorst": server.WEIGHT_WORST,
        },
        "brandNames": {b: server.brand_name(b) for b in {i["b"] for i in server.CATALOG}},
        "phones": phones,
        "catalog": catalog,
    }


def main():
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)

    with open(os.path.join(DIST, "data.json"), "w", encoding="utf-8") as f:
        json.dump(build_data(), f, ensure_ascii=False, separators=(",", ":"))

    for name in os.listdir(STATIC):
        src = os.path.join(STATIC, name)
        if name == "index.html":
            continue
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(DIST, name))
        else:
            shutil.copy2(src, DIST)

    with open(os.path.join(STATIC, "index.html"), encoding="utf-8") as f:
        html = f.read()
    shutil.copy2(os.path.join(STATIC, "index.html"), os.path.join(DIST, "local.html"))

    # เวอร์ชันลิงก์ claude.ai: ตัดโครง html/head/body และ meta charset/viewport ออก (ระบบใส่ให้เอง)
    page = re.sub(r"<!doctype html>\s*", "", html, flags=re.I)
    page = re.sub(r"</?(html|head|body)\b[^>]*>\s*", "", page, flags=re.I)
    page = re.sub(r'<meta (charset|name="viewport")[^>]*>\s*', "", page, flags=re.I)
    with open(os.path.join(DIST, "index.html"), "w", encoding="utf-8") as f:
        f.write(page.strip() + "\n")

    files = sorted(os.path.relpath(os.path.join(d, n), DIST).replace("\\", "/")
                   for d, _, ns in os.walk(DIST) for n in ns)
    size = sum(os.path.getsize(os.path.join(DIST, p)) for p in files)
    print(f"สร้าง dist/ แล้ว: {len(files)} ไฟล์, รวม {size // 1024} KB")


if __name__ == "__main__":
    main()
