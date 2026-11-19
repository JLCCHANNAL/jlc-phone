"""สร้างรายชื่อรุ่นมือถือทั้งหมด (data/catalog.json) จาก sitemap สาธารณะของ siamphone.com

ใช้เฉพาะ "ชื่อแบรนด์ + ชื่อรุ่น" ที่อยู่ใน URL ของ sitemap เท่านั้น
ไม่ได้ดึงสเปก ราคา รูปภาพ หรือเนื้อหาใดๆ จากหน้าเว็บ (เว็บนั้นสงวนลิขสิทธิ์เนื้อหา)
สเปกต้องค้นจากแหล่งอื่น เช่น เว็บผู้ผลิต แล้วใส่ใน data/phones.json + data/specs.json

รัน:  python scripts/build_catalog.py            (โหลด sitemap ใหม่ 1 ครั้ง)
      python scripts/build_catalog.py file.xml   (ใช้ไฟล์ sitemap ที่โหลดไว้แล้ว)
"""
import json
import os
import re
import sys
import urllib.request

SITEMAP_URL = "https://www.siamphone.com/sitemaps/phones.xml"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "catalog.json")

TABLET = re.compile(r"(^|-)(ipad|pad|matepad|mediapad|tab|tablet)(-|\d|$)")

WORDS = {
    "iphone": "iPhone", "ipad": "iPad", "ipod": "iPod", "5g": "5G", "4g": "4G", "3g": "3G", "lte": "LTE",
    "fe": "FE", "se": "SE", "xl": "XL", "xr": "XR", "xs": "XS", "gt": "GT", "nfc": "NFC", "ai": "AI",
    "tv": "TV", "hd": "HD", "rog": "ROG", "iqoo": "iQOO", "cmf": "CMF", "ii": "II", "iii": "III", "iv": "IV",
}


def title_token(t):
    if t in WORDS:
        return WORDS[t]
    m = re.fullmatch(r"([a-z]{1,2})(\d+[a-z]*)", t)        # a56 -> A56, x200 -> X200, x8s -> X8s
    if m:
        return m.group(1).upper() + m.group(2)
    if re.fullmatch(r"\d+[trsx]", t):                     # 15t, 13r
        return t.upper()
    return t[:1].upper() + t[1:]


def title_model(slug):
    return " ".join(title_token(t) for t in slug.split("-") if t)


def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as f:
            xml = f.read()
    else:
        req = urllib.request.Request(SITEMAP_URL, headers={"User-Agent": "JLCPhone-catalog-builder/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            xml = r.read().decode("utf-8")

    seen, items = set(), []
    for brand, model in re.findall(r"<loc>https?://[^<]*/spec/([^/<]+)/([^/<]+)</loc>", xml):
        key = f"{brand}/{model}"
        if key in seen:
            continue
        seen.add(key)
        # ตัดชื่อแบรนด์ที่ซ้ำอยู่หน้าชื่อรุ่นออก เช่น vivo/vivo-y11d -> Y11d
        name_slug = model[len(brand) + 1:] if model.startswith(brand + "-") and len(model) > len(brand) + 1 else model
        item = {"b": brand, "s": model, "n": title_model(name_slug)}
        if TABLET.search(name_slug):
            item["t"] = "tablet"
        items.append(item)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"_source": "รายชื่อรุ่นจาก sitemap สาธารณะ (ชื่อเท่านั้น)", "models": items},
                  f, ensure_ascii=False, separators=(",", ":"))
    print(f"บันทึก {len(items)} รุ่น จาก {len({i['b'] for i in items})} แบรนด์ -> {OUT}")


if __name__ == "__main__":
    main()
