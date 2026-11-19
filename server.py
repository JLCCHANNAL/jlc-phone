"""JLC Phone backend — เซิร์ฟเวอร์ Python ล้วน ไม่ต้องติดตั้งไลบรารีเพิ่ม

รัน:  python server.py   แล้วเปิด http://localhost:8000
API:
  GET  /api/meta              -> กลุ่มแบรนด์ (แบรนด์ต้น + แบรนด์ย่อย), เกณฑ์ให้คะแนน, รูปแบบการใช้งาน
  GET  /api/catalog?brands=&q=&offset=&limit=   -> ค้นรายชื่อรุ่นทั้งหมด (มี/ไม่มีสเปก)
  GET  /api/phones/<id>       -> รายละเอียดรุ่นที่มีสเปก
  POST /api/recommend         -> รับ {brands, minPrice, maxPrice, weights, sort} คืนรายการจัดอันดับ
"""
import datetime
import gzip
import json
import math
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(ROOT, "static")
DATA_DIR = os.path.join(ROOT, "data")
PORT = int(os.environ.get("PORT", "8000"))
# บนเครื่องตัวเอง: รับเฉพาะเครื่องนี้ (127.0.0.1) / บน Render (มีตัวแปร PORT): รับจากอินเทอร์เน็ต (0.0.0.0)
HOST = os.environ.get("HOST") or ("0.0.0.0" if "PORT" in os.environ else "127.0.0.1")


def load(name):
    with open(os.path.join(DATA_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def norm(s):
    """ทำชื่อให้เทียบกันได้: ตัวเล็ก, + เป็น plus, ตัดช่องว่าง/สัญลักษณ์"""
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("+", "plus"))


# ---------- โหลดข้อมูล ----------
PHONES = load("phones.json")["phones"]          # รุ่นที่มีสเปก (ใช้คำนวณคะแนน)
SPECS = load("specs.json")
CATALOG = load("catalog.json")["models"]         # รายชื่อรุ่นทั้งหมด
BRANDS = load("brands.json")

for p in PHONES:
    p["specs"] = SPECS.get(p["id"], {})

# ---------- รุ่นที่เพิ่มเป็นชุด (data/batches/*.json) คำนวณคะแนนจากสเปกอัตโนมัติ ----------
_chipdata = load("chips.json")
CHIPS, CHIP_REF = _chipdata["chips"], _chipdata["_ref"]
SPEC_FIELDS = ("screen", "panel", "hz", "ram", "storage", "mainCam", "frontCam", "chargeW", "os", "color", "image")


def clamp(x, lo=0, hi=100):
    return max(lo, min(hi, x))


def chip_scores(chip):
    """เบนช์มาร์ก -> คะแนน 0-100 แบบลอการิทึม: ชิปแรงสุด ≈ 100, แรงลดลงครึ่งหนึ่ง ≈ -24 (CPU) / -15 (GPU)
    CPU = Geekbench 6 (single 40% + multi 60%), GPU = 3DMark Wild Life Extreme"""
    sc, mc, wle = CHIPS[chip]
    cpu_ratio = 0.4 * sc / CHIP_REF["sc"] + 0.6 * mc / CHIP_REF["mc"]
    cpu = 100 + 34 * math.log(cpu_ratio)
    gpu = 100 + 21.5 * math.log(wle / CHIP_REF["wle"])
    return round(clamp(cpu, 5)), round(clamp(gpu, 5))


def chip_bench(chip):
    sc, mc, wle = CHIPS[chip]
    return {"gb6": [sc, mc], "wle": wle}


def auto_scores(r):
    """แปลงสเปกเป็นคะแนน 0-100: CPU/GPU จากตารางชิป, แบตจาก mAh, จอจากชนิด+รีเฟรชเรต, ชาร์จจากวัตต์"""
    if r["chip"] not in CHIPS:
        raise ValueError(f'ไม่รู้จักชิป "{r["chip"]}" ของ {r["name"]} — เพิ่มใน data/chips.json')
    cpu, gpu = chip_scores(r["chip"])
    battery = 40 + (r["battery"] - 3000) / 4000 * 60 + (15 if r["brand"] == "Apple" else 0)  # iPhone ประหยัดแบตกว่า
    panel = r.get("panel", "")
    display = 62 if "LCD" in panel else 88 if "LTPO" in panel else 82
    hz = r.get("hz", 60)
    display += 6 if hz >= 144 else 4 if hz >= 120 else -8 if hz <= 60 else 0
    charging = 20 + r.get("chargeW", 15) * 0.7
    return {"cpu": cpu, "gpu": gpu, "camera": r["cam"], "battery": round(clamp(battery)),
            "display": round(clamp(display)), "charging": round(clamp(charging))}


# รุ่นเดิม 45 รุ่น: ใช้สูตรเดียวกับรุ่นใหม่ (เก็บไว้เฉพาะคะแนนกล้องที่ตั้งเอง) เพื่อให้เทียบกันได้ยุติธรรม
for p in PHONES:
    s = p["specs"]
    p["scores"] = auto_scores({"name": p["name"], "brand": p["brand"], "chip": p["chip"], "battery": p["battery"],
                               "cam": p["scores"]["camera"], "panel": s.get("panel", ""), "hz": s.get("hz", 60),
                               "chargeW": s.get("chargeW", 15)})

BATCH_DIR = os.path.join(DATA_DIR, "batches")
for fname in sorted(os.listdir(BATCH_DIR)) if os.path.isdir(BATCH_DIR) else []:
    if not fname.endswith(".json"):
        continue
    with open(os.path.join(BATCH_DIR, fname), encoding="utf-8") as f:
        for r in json.load(f)["phones"]:
            PHONES.append({
                "id": r["catalog"].replace("/", "-"), "catalog": r["catalog"], "brand": r["brand"], "name": r["name"],
                "price": r["price"], "priceEst": r.get("priceEst", False), "chip": r["chip"],
                "battery": r["battery"], "weight": r["weight"], "updates": r["updates"],
                "scores": auto_scores(r), "specs": {k: r[k] for k in SPEC_FIELDS if k in r}, "batch": fname,
            })

for p in PHONES:
    p["bench"] = chip_bench(p["chip"])

PHONES_BY_ID = {p["id"]: p for p in PHONES}

# ---------- สีตัวเครื่องที่วางขาย (data/colors.json) ----------
_colors = load("colors.json")
for p in PHONES:
    if p["id"] in _colors:
        p["colors"] = [{"name": n, "hex": h} for n, h in _colors[p["id"]]]

# ---------- ปีอัปเดตที่เหลือจริง = เดือนเปิดตัว + ปีที่ผู้ผลิตสัญญา − วันนี้ ----------
LAUNCH = load("launch.json")
_today = datetime.date.today()
NOW = _today.year + (_today.month - 1) / 12
_missing_launch = []
for p in PHONES:
    launch = LAUNCH.get(p["id"])
    if launch:
        y, m = (int(x) for x in launch.split("-"))
        p["launch"] = launch
        p["updatesLeft"] = round(max(0.0, y + (m - 1) / 12 + p["updates"] - NOW) * 2) / 2  # ปัดทีละครึ่งปี
    else:
        _missing_launch.append(p["id"])
        p["updatesLeft"] = p["updates"]  # ไม่รู้เดือนเปิดตัว: ใช้จำนวนปีเต็มไปก่อน
if _missing_launch:
    print("คำเตือน: ไม่มีเดือนเปิดตัวใน data/launch.json ->", ", ".join(_missing_launch))


def brand_name(slug):
    return BRANDS["names"].get(slug) or " ".join(w.capitalize() for w in slug.split("-"))


# กลุ่มแบรนด์: กลุ่มที่กำหนดไว้ + แบรนด์ที่เหลือเป็นกลุ่มเดี่ยว
GROUPS = [dict(g) for g in BRANDS["groups"]]
GROUP_OF = {m: g["id"] for g in GROUPS for m in g["members"]}
catalog_brands = []
for item in CATALOG:
    if item["b"] not in catalog_brands:
        catalog_brands.append(item["b"])
for slug in catalog_brands:
    if slug not in GROUP_OF:
        GROUPS.append({"id": slug, "name": brand_name(slug), "members": [slug]})
        GROUP_OF[slug] = slug

# จับคู่รุ่นที่มีสเปก (phones.json) กับรายชื่อใน catalog เพื่อรู้ว่าเป็นแบรนด์ย่อยไหน
_catalog_keys = {}
for item in CATALOG:
    item["key"] = f'{item["b"]}/{item["s"]}'
    item["brandName"] = brand_name(item["b"])
    item["search"] = norm(item["brandName"] + item["n"])
    for k in (norm(item["n"]), item["search"]):
        _catalog_keys.setdefault((GROUP_OF[item["b"]], k), item)
_catalog_by_key = {i["key"]: i for i in CATALOG}

for p in PHONES:
    group = GROUP_OF.get(p["brand"].lower(), p["brand"].lower())
    name_key = norm(p["name"])
    short_key = norm(re.sub(rf"^{re.escape(p['brand'])}\s+", "", p["name"], flags=re.I))
    # ระบุ "catalog": "brand/slug" ใน phones.json ได้ ถ้าชื่อไม่ตรงกัน
    match = (_catalog_by_key.get(p.get("catalog", ""))
             or _catalog_keys.get((group, name_key)) or _catalog_keys.get((group, short_key)))
    if match:
        match["phoneId"] = p["id"]
        p["brandSlug"] = match["b"]
    else:
        prefix = p["name"].split()[0].lower()
        p["brandSlug"] = prefix if prefix in GROUP_OF else p["brand"].lower()
    p["brandName"] = brand_name(p["brandSlug"])

# นับจำนวนรุ่น/รุ่นที่มีสเปก ต่อแบรนด์ย่อย
_counts, _spec_counts = {}, {}
for item in CATALOG:
    _counts[item["b"]] = _counts.get(item["b"], 0) + 1
for p in PHONES:
    _spec_counts[p["brandSlug"]] = _spec_counts.get(p["brandSlug"], 0) + 1


def meta_groups():
    out = []
    for g in GROUPS:
        members = [{"slug": m, "name": brand_name(m), "count": _counts.get(m, 0), "specCount": _spec_counts.get(m, 0)}
                   for m in g["members"]]
        out.append({**g, "members": members,
                    "count": sum(m["count"] for m in members),
                    "specCount": sum(m["specCount"] for m in members)})
    featured = [g for g in out if g.get("featured")]
    others = sorted((g for g in out if not g.get("featured")), key=lambda g: -g["count"])
    return featured + others


# ---------- เกณฑ์และการคำนวณ ----------
CRITERIA = [
    {"key": "cpu", "label": "CPU", "desc": "ความเร็วในการประมวลผล เปิดแอปไว"},
    {"key": "gpu", "label": "GPU", "desc": "กราฟิก เล่นเกมลื่น ภาพสวย"},
    {"key": "camera", "label": "กล้อง", "desc": "คุณภาพภาพถ่ายและวิดีโอ"},
    {"key": "battery", "label": "แบตเตอรี่", "desc": "ใช้งานได้นานต่อการชาร์จ"},
    {"key": "display", "label": "หน้าจอ", "desc": "ความสว่าง ความคมชัด รีเฟรชเรต"},
    {"key": "charging", "label": "ชาร์จไว", "desc": "ความเร็วในการชาร์จ"},
    {"key": "updates", "label": "อัปเดตนาน", "desc": "จำนวนปีที่ยังได้อัปเดตซอฟต์แวร์ นับจากวันนี้"},
    {"key": "weight", "label": "น้ำหนักเบา", "desc": "ถือสบาย ไม่หนักมือ"},
]
CRITERIA_KEYS = {c["key"] for c in CRITERIA}

PRESETS = [
    {"key": "gaming", "label": "เล่นเกม", "desc": "เน้นชิปแรง กราฟิกลื่น แบตอึด",
     "weights": {"cpu": 2, "gpu": 2, "battery": 1, "display": 1}},
    {"key": "photo", "label": "ถ่ายรูป", "desc": "เน้นกล้องคุณภาพสูงและหน้าจอสวย",
     "weights": {"camera": 2, "display": 1, "battery": 1}},
    {"key": "balanced", "label": "ใช้งานทั่วไป", "desc": "สมดุลทุกด้าน ไม่เด่นด้านใดด้านหนึ่ง",
     "weights": {"cpu": 1, "gpu": 1, "camera": 1, "battery": 1, "display": 1}},
    {"key": "battery", "label": "แบตอึด", "desc": "ใช้งานทั้งวัน ชาร์จไว",
     "weights": {"battery": 2, "charging": 1}},
    {"key": "longterm", "label": "ใช้ยาวหลายปี", "desc": "อัปเดตนาน ชิปแรงพอใช้ไปอีกนาน",
     "weights": {"updates": 2, "cpu": 2, "battery": 1}},
    {"key": "compact", "label": "พกพาง่าย", "desc": "เบา ถือสบาย กล้องดี",
     "weights": {"weight": 2, "camera": 1, "display": 1}},
]

VALUE_BASE = 35  # คะแนนระดับ "พอใช้ได้" ที่ไม่นับเป็นความคุ้มค่า
MAX_UPDATE_YEARS = 7
WEIGHT_BEST, WEIGHT_WORST = 160, 240  # กรัม

# หมวดมือถือ (ปุ่มลัดบนหน้าแรก): น้ำหนักเกณฑ์ + ช่วงราคา + ตัวกรองรูปทรง (tag) + การเรียงลำดับเริ่มต้น
CATEGORIES = [
    {"key": "gaming", "label": "เกมมิ่ง", "desc": "ชิปแรง จอลื่น เล่นเกมหนักได้", "icon": "gamepad",
     "weights": {"cpu": 2, "gpu": 2, "battery": 1, "display": 1}},
    {"key": "camera", "label": "เน้นกล้อง", "desc": "ถ่ายรูปและวิดีโอสวย", "icon": "camera",
     "weights": {"camera": 2, "display": 1, "battery": 1}},
    {"key": "battery", "label": "แบตอึด", "desc": "ใช้ได้ทั้งวันไม่ต้องพกพาวเวอร์แบงก์", "icon": "battery",
     "weights": {"battery": 2, "charging": 1}},
    {"key": "fastcharge", "label": "ชาร์จไว", "desc": "ชาร์จแป๊บเดียวใช้ได้ยาว", "icon": "bolt",
     "weights": {"charging": 2, "battery": 1}},
    {"key": "everyday", "label": "ใช้งานทั่วไป", "desc": "สมดุลทุกด้าน คุ้มสำหรับคนส่วนใหญ่", "icon": "sliders",
     "weights": {"cpu": 1, "gpu": 1, "camera": 1, "battery": 1, "display": 1}},
    {"key": "budget", "label": "ราคาประหยัด", "desc": "ไม่เกิน 8,000 บาท", "icon": "tag",
     "weights": {"cpu": 1, "camera": 1, "battery": 1, "display": 1}, "maxPrice": 8000},
    {"key": "student", "label": "นักเรียน นักศึกษา", "desc": "ไม่เกิน 12,000 แบตดี เรียนออนไลน์ได้", "icon": "cap",
     "weights": {"battery": 2, "cpu": 1, "camera": 1, "updates": 1}, "maxPrice": 12000},
    {"key": "flagship", "label": "เรือธง", "desc": "รุ่นท็อป 30,000 บาทขึ้นไป", "icon": "crown",
     "weights": {"cpu": 1, "gpu": 1, "camera": 2, "display": 1, "battery": 1}, "minPrice": 30000, "sort": "perf"},
    {"key": "longterm", "label": "ใช้ยาวหลายปี", "desc": "อัปเดตนาน ชิปแรงพอใช้ไปอีกนาน", "icon": "clock",
     "weights": {"updates": 2, "cpu": 2, "battery": 1}},
    {"key": "foldable", "label": "จอพับ", "desc": "พับได้ จอใหญ่ในเครื่องเล็ก", "icon": "fold",
     "weights": {"cpu": 1, "camera": 1, "battery": 1, "display": 1}, "tag": "foldable", "sort": "perf"},
    {"key": "bigscreen", "label": "จอใหญ่ ดูหนัง", "desc": "จอ 6.7 นิ้วขึ้นไป แบตอึด", "icon": "film",
     "weights": {"display": 2, "battery": 2, "cpu": 1}, "tag": "bigscreen"},
    {"key": "compact", "label": "จอเล็ก พกง่าย", "desc": "จอไม่เกิน 6.4 นิ้ว ถือมือเดียวสบาย", "icon": "hand",
     "weights": {"weight": 2, "cpu": 1, "camera": 1}, "tag": "small"},
]


def match_tag(phone, tag):
    """ตัวกรองรูปทรงเครื่อง: จอพับ / จอใหญ่ / จอเล็ก"""
    specs = phone.get("specs", {})
    fold = "จอพับ" in specs.get("panel", "")
    screen = specs.get("screen") or 0
    if tag == "foldable":
        return fold
    if tag == "bigscreen":
        return not fold and screen >= 6.7
    if tag == "small":
        return not fold and 0 < screen <= 6.4
    return True


def criterion_score(phone, key):
    """แปลงสเปกให้เป็นคะแนน 0-100"""
    if key == "updates":
        return min(phone["updatesLeft"] / MAX_UPDATE_YEARS, 1) * 100
    if key == "weight":
        ratio = (WEIGHT_WORST - phone["weight"]) / (WEIGHT_WORST - WEIGHT_BEST)
        return max(0.0, min(1.0, ratio)) * 100
    return phone["scores"][key]


def recommend(body):
    brands = set(body.get("brands") or [])
    min_price = float(body.get("minPrice") or 0)
    max_price = float(body.get("maxPrice") or 10**9)
    if min_price > max_price:
        min_price, max_price = max_price, min_price

    weights = {}
    for key, w in (body.get("weights") or {}).items():
        w = float(w)
        if key in CRITERIA_KEYS and w > 0:
            weights[key] = min(w, 3)
    if not weights:
        weights = dict(PRESETS[2]["weights"])  # ค่าเริ่มต้น: ใช้งานทั่วไป

    results = []
    for p in PHONES:
        if brands and p["brandSlug"] not in brands:
            continue
        if not (min_price <= p["price"] <= max_price):
            continue
        if not match_tag(p, body.get("tag")):
            continue
        breakdown = {k: round(criterion_score(p, k)) for k in weights}
        perf = sum(breakdown[k] * w for k, w in weights.items()) / sum(weights.values())
        # ความคุ้มค่า = (คะแนนรวม − 35)² × (คะแนนด้านที่ติด ★ − 35) ÷ ราคา
        #   - ลบ 35 (ระดับ "พอใช้ได้") เพื่อนับเฉพาะส่วนที่ดีกว่าขั้นต่ำ เครื่องถูกแต่สเปกต่ำจึงไม่ชนะง่ายๆ
        #   - คูณด้วยคะแนนด้าน ★ เพื่อให้เครื่องที่เก่งเรื่องที่ผู้ใช้ให้ความสำคัญที่สุดได้เปรียบ
        #     (เช่น โหมดถ่ายรูป เครื่องแบตใหญ่แต่กล้องธรรมดาจะไม่ขึ้นอันดับต้น)
        starred = [k for k, w in weights.items() if w >= 2] or list(weights)
        focus = sum(breakdown[k] for k in starred) / len(starred)
        raw_value = max(0.0, perf - VALUE_BASE) ** 2 * max(0.0, focus - VALUE_BASE) / p["price"]
        results.append({**p, "breakdown": breakdown, "perf": round(perf, 1), "_raw": raw_value})

    if results:
        best_raw = max(r["_raw"] for r in results) or 1
        best_perf = max(r["perf"] for r in results)
        for r in results:
            r["value"] = round(r.pop("_raw") / best_raw * 100)
            r["topPerf"] = r["perf"] == best_perf

    sort = body.get("sort", "value")
    if sort == "perf":
        results.sort(key=lambda r: (-r["perf"], r["price"]))
    elif sort == "price":
        results.sort(key=lambda r: (r["price"], -r["perf"]))
    else:
        results.sort(key=lambda r: (-r["value"], -r["perf"]))

    best_value_id = max(results, key=lambda r: r["value"])["id"] if results else None
    for r in results:
        r["bestValue"] = r["id"] == best_value_id

    # แบรนด์ละ 1 รุ่น: เก็บเฉพาะรุ่นอันดับดีที่สุดของแต่ละแบรนด์ต้น (เช่น Xiaomi รวม Redmi/POCO)
    if body.get("onePerBrand"):
        seen = set()
        kept = []
        for r in results:
            g = GROUP_OF.get(r["brandSlug"], r["brandSlug"])
            if g not in seen:
                seen.add(g)
                kept.append(r)
        results = kept

    in_brands = [i for i in CATALOG if not brands or i["b"] in brands]
    no_spec = sum(1 for i in in_brands if "phoneId" not in i)
    return {"count": len(results), "weights": weights, "results": results, "noSpecCount": no_spec}


def search_catalog(params):
    brands = {b for b in params.get("brands", [""])[0].split(",") if b}
    q = norm(params.get("q", [""])[0])
    offset = max(0, int(params.get("offset", ["0"])[0] or 0))
    limit = min(100, max(1, int(params.get("limit", ["30"])[0] or 30)))
    hits = [i for i in CATALOG if (not brands or i["b"] in brands) and (not q or q in i["search"])]
    hits.sort(key=lambda i: "phoneId" not in i)  # รุ่นที่มีสเปกขึ้นก่อน (sort แบบคงลำดับเดิม)
    page = [{"key": i["key"], "brand": i["b"], "brandName": i["brandName"], "name": i["n"],
             "tablet": i.get("t") == "tablet", "phoneId": i.get("phoneId"),
             "price": PHONES_BY_ID[i["phoneId"]]["price"] if i.get("phoneId") else None,
             "priceEst": PHONES_BY_ID[i["phoneId"]].get("priceEst", False) if i.get("phoneId") else False}
            for i in hits[offset:offset + limit]]
    return {"total": len(hits), "offset": offset, "items": page}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html; charset=utf-8",
        ".dae": "model/vnd.collada+xml",
    }
    GZIP_TYPES = (".dae", ".js", ".css", ".json", ".html", ".svg")
    _gzip_cache = {}

    def try_send_gzip(self, url_path):
        """ส่งไฟล์ข้อความแบบบีบอัด gzip (เล็กลงหลายเท่า โดยเฉพาะไฟล์โมเดล .dae)"""
        if "gzip" not in (self.headers.get("Accept-Encoding") or ""):
            return False
        rel = url_path.lstrip("/") or "index.html"
        full = os.path.realpath(os.path.join(STATIC_DIR, rel))
        if not full.startswith(os.path.realpath(STATIC_DIR) + os.sep) or not full.endswith(self.GZIP_TYPES):
            return False
        if not os.path.isfile(full):
            return False
        mtime = os.path.getmtime(full)
        cached = self._gzip_cache.get(full)
        if not cached or cached[0] != mtime:
            with open(full, "rb") as f:
                cached = (mtime, gzip.compress(f.read(), 6))
            self._gzip_cache[full] = cached
        body = cached[1]
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(full))
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        # ให้เบราว์เซอร์ตรวจไฟล์ใหม่ทุกครั้ง แก้โค้ดแล้วกด Refresh ก็เห็นผลทันที
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        if path.startswith("/api/phones/"):
            phone = PHONES_BY_ID.get(path[len("/api/phones/"):])
            if not phone:
                return self.send_json(404, {"error": "ไม่พบรุ่นนี้"})
            all_scores = {c["key"]: round(criterion_score(phone, c["key"])) for c in CRITERIA}
            return self.send_json(200, {**phone, "allScores": all_scores})
        if path == "/api/catalog":
            try:
                return self.send_json(200, search_catalog(parse_qs(url.query)))
            except ValueError as e:
                return self.send_json(400, {"error": f"ข้อมูลไม่ถูกต้อง: {e}"})
        if path == "/api/meta":
            return self.send_json(200, {
                "groups": meta_groups(),
                "totalModels": len(CATALOG),
                "totalWithSpecs": len(PHONES),
                "criteria": CRITERIA,
                "presets": PRESETS,
                "categories": CATEGORIES,
            })
        if self.try_send_gzip(path):
            return
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/recommend":
            return self.send_json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            return self.send_json(200, recommend(body))
        except (ValueError, TypeError, AttributeError) as e:
            return self.send_json(400, {"error": f"ข้อมูลไม่ถูกต้อง: {e}"})


if __name__ == "__main__":
    print(f"JLC Phone: {len(CATALOG)} รุ่นในรายชื่อ, {len(PHONES)} รุ่นมีสเปก")
    print(f"กำลังทำงานที่ http://{'localhost' if HOST == '127.0.0.1' else HOST}:{PORT}  (กด Ctrl+C เพื่อหยุด)", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
