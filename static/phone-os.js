// ระบบจำลองหน้าจอมือถือบนโมเดล 3D: หน้าล็อก / หน้า Home / ปัดเปลี่ยนหน้าแอป / เปิด-ปิดจอ
// วาดด้วยโค้ดตามแบบของระบบปฏิบัติการจริงของแต่ละรุ่น (iOS, One UI, Pixel, HyperOS, ColorOS, OxygenOS, realme UI,
// OriginOS/Funtouch OS, MagicOS, HarmonyOS, Nothing OS ฯลฯ) — ไม่ใช้ภาพหน้าจอจริงหรือโลโก้แอปของบริษัทอื่น (ติดลิขสิทธิ์)
// ไอคอนแอปเป็นไอคอนทั่วไปจาก Lucide (static/icons/app/)

const OS_W = 600, OS_H = 1300;

// ---------- รูปแบบของแต่ละระบบปฏิบัติการ ----------
// shape: รูปไอคอน | lock: แบบหน้าล็อก | search: ตำแหน่งช่องค้นหา | dockBg: พื้นหลังแถบแอปล่าง | mono: ไอคอนขาวดำ
const OS_THEMES = {
  ios:       { name: "iOS", shape: "squircle", r: 0.23, rows: 5, lock: "ios", dockBg: "glass", indicator: "search", hint: "ปัดขึ้นเพื่อเปิด", gesture: true },
  oneui:     { name: "One UI", shape: "squircle", r: 0.32, rows: 5, lock: "oneui", indicator: "dots", hint: "ปัดหน้าจอเพื่อปลดล็อก", gesture: true },
  pixel:     { name: "Android (Pixel)", shape: "circle", rows: 4, lock: "pixel", indicator: "none", search: "bottom", glance: true, tonal: true, hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
  hyperos:   { name: "HyperOS", shape: "rounded", r: 0.27, rows: 5, lock: "left-thin", indicator: "dots", hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
  coloros:   { name: "ColorOS", shape: "rounded", r: 0.3, rows: 5, lock: "center", indicator: "dots", hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
  oxygenos:  { name: "OxygenOS", shape: "rounded", r: 0.3, rows: 5, lock: "center-bold", indicator: "dots", hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
  realmeui:  { name: "realme UI", shape: "rounded", r: 0.3, rows: 5, lock: "center", indicator: "dots", hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
  originos:  { name: "OriginOS / Funtouch OS", shape: "rounded", r: 0.24, rows: 5, lock: "left-bold", indicator: "dots", hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
  magicos:   { name: "MagicOS", shape: "rounded", r: 0.28, rows: 5, lock: "center", indicator: "dots", hint: "ปัดเพื่อปลดล็อก", gesture: true },
  harmonyos: { name: "HarmonyOS", shape: "squircle", r: 0.28, rows: 5, lock: "harmony", indicator: "dots", hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
  nothingos: { name: "Nothing OS", shape: "circle", rows: 5, lock: "nothing", indicator: "dots", mono: true, hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
  gaming:    { name: "ROG UI / REDMAGIC OS", shape: "rounded", r: 0.22, rows: 5, lock: "center-bold", indicator: "dots", dark: true, hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
  android:   { name: "Android", shape: "circle", rows: 5, lock: "center", indicator: "dots", hint: "ปัดขึ้นเพื่อปลดล็อก", gesture: true },
};

function detectOS(p) {
  const os = ((p.specs && p.specs.os) || "").toLowerCase();
  if (p.brand === "Apple") return "ios";
  if (p.brand === "Samsung") return "oneui";
  if (p.brand === "Google") return "pixel";
  if (os.includes("hyperos")) return "hyperos";
  if (os.includes("oxygen")) return "oxygenos";
  if (os.includes("coloros")) return "coloros";
  if (os.includes("realme")) return "realmeui";
  if (os.includes("originos") || os.includes("funtouch")) return "originos";
  if (os.includes("magicos")) return "magicos";
  if (os.includes("harmony") || os.includes("emui")) return "harmonyos";
  if (os.includes("nothing")) return "nothingos";
  if (os.includes("rog") || os.includes("redmagic")) return "gaming";
  return "android";
}

// แอปบนหน้า Home (ชื่อไทย, ไอคอน, สีพื้นไอคอน)
const OS_APPS = [
  ["รูปภาพ", "image", "#FF9F0A"], ["ตั้งค่า", "settings", "#8E8E93"], ["นาฬิกา", "clock", "#1C1C1E"], ["ปฏิทิน", "calendar", "#FF3B30"],
  ["สภาพอากาศ", "cloud-sun", "#0A84FF"], ["เพลง", "music", "#FF2D55"], ["อีเมล", "mail", "#0A84FF"], ["เครื่องคิดเลข", "calculator", "#FF9500"],
  ["โน้ต", "notebook-pen", "#E5B000"], ["สโตร์", "shopping-bag", "#5E5CE6"], ["รายชื่อ", "user", "#8E8E93"], ["ไฟล์", "folder", "#0A84FF"],
  ["วอลเล็ต", "wallet", "#1C1C1E"], ["แผนที่", "map", "#30B0C7"], ["วิดีโอ", "play", "#FF3B30"], ["บันทึกเสียง", "mic", "#FF453A"],
  ["สุขภาพ", "heart-pulse", "#FF375F"], ["เกม", "gamepad-2", "#AF52DE"], ["หนังสือ", "book-open", "#FF9500"], ["ไฟฉาย", "flashlight", "#636366"],
  ["ร้านแอป", "store", "#0A84FF"], ["วิดีโอคอล", "video", "#34C759"],
];
const OS_DOCK = [["โทรศัพท์", "phone", "#34C759"], ["ข้อความ", "message-circle", "#30D158"], ["เบราว์เซอร์", "compass", "#0A84FF"], ["กล้อง", "camera", "#636366"]];

// iPhone: จัดแอปตามหน้า Home จริงของ iOS (ไอคอนวาดเองให้ใกล้เคียง ไม่ใช้ไฟล์ไอคอนของ Apple)
// "widget" กินพื้นที่ 2x2 ช่อง
const IOS_PAGES = [
  [["แบตเตอรี่", "widget-battery"], ["FaceTime", "facetime"], ["ปฏิทิน", "calendar-ios"], ["รูปภาพ", "photos"], ["กล้อง", "camera-ios"],
   ["เมล", "mail-ios"], ["โน้ต", "notes"], ["เตือนความจำ", "reminders"], ["นาฬิกา", "clock-ios"],
   ["หุ้น", "stocks"], ["ทีวี", "tv"], ["พ็อดคาสท์", "podcasts"], ["App Store", "appstore"],
   ["แผนที่", "maps"], ["สุขภาพ", "health"], ["Wallet", "wallet-ios"], ["การตั้งค่า", "settings-ios"]],
  [["สภาพอากาศ", "cloud-sun", "#2F8CF5"], ["เครื่องคิดเลข", "calculator", "#1C1C1E"], ["ไฟล์", "folder", "#1E7CF2"], ["รายชื่อ", "user", "#8E8E93"],
   ["หนังสือ", "book-open", "#FF9500"], ["บันทึกเสียง", "mic", "#1C1C1E"], ["เกม", "gamepad-2", "#5E5CE6"], ["ไฟฉาย", "flashlight", "#636366"]],
];
const IOS_DOCK = [["โทรศัพท์", "phone-ios"], ["Safari", "safari"], ["ข้อความ", "messages"], ["เพลง", "music-ios"]];

const OS_FONT ="-apple-system, 'SF Pro Display', 'Segoe UI', 'Noto Sans Thai', sans-serif";
const TH_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const TH_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ---------- โหลดไอคอนแอป (SVG เส้น → รูปภาพสีขาว/ดำ) ใช้ร่วมกันทุกเครื่อง ----------
const osIconCache = {};
let osIconsLoading = null;
function loadOSIcons() {
  if (osIconsLoading) return osIconsLoading;
  const names = [...new Set([...OS_APPS, ...OS_DOCK].map((a) => a[1]).concat(["search", "flashlight", "camera", "lock", "phone", "mic"]))];
  osIconsLoading = Promise.all(names.map(async (n) => {
    const svg = await (await fetch(`icons/app/${n}.svg`)).text();
    await Promise.all(["#ffffff", "#1c1c1e"].map((col) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { osIconCache[n + col] = img; resolve(); };
      img.onerror = resolve;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/currentColor/g, col).replace(/stroke-width="2"/, 'stroke-width="2.1"'));
    })));
  }));
  return osIconsLoading;
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

class PhoneOS {
  constructor(phone, accentHex) {
    this.phone = phone;
    this.key = detectOS(phone);
    this.theme = OS_THEMES[this.key];
    this.accent = accentHex || "#5a6a8a";
    this.canvas = document.createElement("canvas");
    this.canvas.width = OS_W; this.canvas.height = OS_H;
    this.g = this.canvas.getContext("2d");
    this.state = "home";          // off | lock | home  (เปิดหน้ามาเจอหน้า Home)
    this.brightness = 1;
    this.page = 0;
    this.dragX = 0;               // เลื่อนหน้าแอปขณะลากนิ้ว
    this.lockY = 0;               // ปัดหน้าล็อกขึ้น
    this.anims = [];
    this.dirty = true;
    this.lastMinute = -1;
    // แบ่งแอปเป็นหน้าๆ ตามจำนวนแถวของแต่ละระบบ
    const perPage = 4 * this.theme.rows;
    this.pages = [];
    if (this.key === "ios") this.pages = IOS_PAGES;
    else {
      for (let i = 0; i < OS_APPS.length; i += perPage) this.pages.push(OS_APPS.slice(i, i + perPage));
      if (this.pages.length < 2) this.pages.push(OS_APPS.slice(0, 6));
    }
    this.dock = this.key === "ios" ? IOS_DOCK : OS_DOCK;
    this.onState = null;
  }

  // ---------- การควบคุม ----------
  togglePower() {
    if (this.state === "off") {
      this.state = "lock"; this.lockY = 0; this.page = 0; this.dragX = 0;
      this.animate("brightness", 0, 1, 320);
    } else {
      this.animate("brightness", this.brightness, 0, 260, () => { this.state = "off"; this.emit(); });
    }
    this.emit();
  }

  setAccent(hex) { this.accent = hex; this.wallpaper = null; this.dirty = true; }

  pointerDown(u, v) {
    if (this.state === "off") return;
    this.anims = this.anims.filter((a) => a.prop === "brightness");
    this.drag = { x0: u * OS_W, y0: (1 - v) * OS_H, t0: performance.now(), base: this.state === "lock" ? this.lockY : this.dragX };
  }

  pointerMove(u, v) {
    if (!this.drag) return;
    const x = u * OS_W, y = (1 - v) * OS_H;
    if (this.state === "lock") this.lockY = Math.min(0, this.drag.base + (y - this.drag.y0));
    else {
      let dx = this.drag.base + (x - this.drag.x0);
      // หน้าแรก/หน้าสุดท้ายลากต่อได้นิดเดียว (ความรู้สึกแบบมือถือจริง)
      if ((this.page === 0 && dx > 0) || (this.page === this.pages.length - 1 && dx < 0)) dx *= 0.3;
      this.dragX = dx;
    }
    this.dirty = true;
  }

  pointerUp() {
    if (!this.drag) return;
    const dt = performance.now() - this.drag.t0;
    if (this.state === "lock") {
      const fast = this.lockY < -60 && dt < 300;
      if (this.lockY < -OS_H * 0.22 || fast) {
        this.animate("lockY", this.lockY, -OS_H, 280, () => { this.state = "home"; this.lockY = 0; this.emit(); });
      } else this.animate("lockY", this.lockY, 0, 220);
    } else {
      const flick = Math.abs(this.dragX) > 40 && dt < 300;
      let target = this.page;
      if (this.dragX < -OS_W * 0.25 || (flick && this.dragX < 0)) target = Math.min(this.pages.length - 1, this.page + 1);
      if (this.dragX > OS_W * 0.25 || (flick && this.dragX > 0)) target = Math.max(0, this.page - 1);
      const from = this.dragX + (target - this.page) * OS_W;
      this.page = target;
      this.dragX = from;
      this.animate("dragX", from, 0, 300);
    }
    this.drag = null;
  }

  animate(prop, from, to, dur, done) {
    this.anims = this.anims.filter((a) => a.prop !== prop);
    this[prop] = from;
    this.anims.push({ prop, from, to, t0: performance.now(), dur, done });
    this.dirty = true;
  }

  emit() { if (this.onState) this.onState(this.state); }

  // คืนค่า true ถ้าภาพบนจอเปลี่ยน (ให้ three.js อัปโหลดพื้นผิวใหม่)
  update(now) {
    for (const a of [...this.anims]) {
      const t = Math.min(1, (now - a.t0) / a.dur);
      this[a.prop] = a.from + (a.to - a.from) * easeOut(t);
      if (t >= 1) { this.anims.splice(this.anims.indexOf(a), 1); a.done && a.done(); }
      this.dirty = true;
    }
    const nowD = new Date();
    // iPhone: เข็มวินาทีบนไอคอนนาฬิกาเดินทุกวินาที / ระบบอื่นอัปเดตทุกนาที
    const tick = this.key === "ios" && this.state === "home" ? nowD.getSeconds() : nowD.getMinutes();
    if (tick !== this.lastMinute) { this.lastMinute = tick; this.dirty = true; }
    if (!this.dirty) return false;
    this.draw();
    this.dirty = false;
    return true;
  }

  // ---------- การวาด ----------
  draw() {
    const g = this.g;
    g.save();
    g.clearRect(0, 0, OS_W, OS_H);
    if (this.state === "off" && this.brightness <= 0.001) {
      g.fillStyle = "#000"; g.fillRect(0, 0, OS_W, OS_H);
      g.restore();
      return;
    }
    if (this.state === "lock") {
      // หน้า Home อยู่ข้างใต้ เผยขึ้นมาตอนปัดหน้าล็อกขึ้น
      const p = Math.min(1, -this.lockY / OS_H);
      if (p > 0) {
        g.save();
        const s = 0.92 + 0.08 * p;
        g.translate(OS_W / 2, OS_H / 2); g.scale(s, s); g.translate(-OS_W / 2, -OS_H / 2);
        this.drawHome();
        g.restore();
      }
      g.save();
      g.translate(0, this.lockY);
      g.globalAlpha = 1 - p * 0.6;
      this.drawLock();
      g.restore();
    } else {
      this.drawHome();
    }
    this.drawStatusBar();
    this.drawCutout();
    if (this.theme.gesture) this.drawHomeBar();
    if (this.brightness < 1) { g.fillStyle = `rgba(0,0,0,${1 - this.brightness})`; g.fillRect(0, 0, OS_W, OS_H); }
    g.restore();
  }

  drawWallpaper(dim) {
    if (!this.wallpaper) {
      const c = document.createElement("canvas");
      c.width = OS_W; c.height = OS_H;
      const g = c.getContext("2d");
      const a = this.accent;
      if (this.key === "ios") {
        // วอลเปเปอร์ภูเขาและทะเลสาบ (วาดเอง) โทนสีอิงสีตัวเครื่อง
        const sky = g.createLinearGradient(0, 0, 0, OS_H * 0.55);
        sky.addColorStop(0, shade(a, -0.35)); sky.addColorStop(0.55, "#9fb6c8"); sky.addColorStop(1, "#f1d9b8");
        g.fillStyle = sky; g.fillRect(0, 0, OS_W, OS_H * 0.55);
        const sun = g.createRadialGradient(OS_W * 0.62, OS_H * 0.46, 5, OS_W * 0.62, OS_H * 0.46, 260);
        sun.addColorStop(0, "rgba(255,236,200,.85)"); sun.addColorStop(1, "rgba(255,236,200,0)");
        g.fillStyle = sun; g.fillRect(0, 0, OS_W, OS_H * 0.55);
        const horizon = OS_H * 0.55;
        const ridge = (pts, col) => {
          // สันเขาโค้งนุ่ม (ลากเส้นโค้งผ่านจุดกึ่งกลางของแต่ละคู่จุด)
          const P = pts.map(([px, py]) => [px * OS_W, horizon - py * OS_H]);
          g.fillStyle = col; g.beginPath(); g.moveTo(0, horizon); g.lineTo(P[0][0], P[0][1]);
          for (let i = 1; i < P.length - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
          g.lineTo(P[P.length - 1][0], P[P.length - 1][1]); g.lineTo(OS_W, horizon); g.closePath(); g.fill();
        };
        const far = [[0, .12], [.12, .2], [.22, .16], [.34, .27], [.46, .2], [.58, .31], [.7, .22], [.82, .26], [.92, .17], [1, .2]];
        const near = [[0, .08], [.1, .13], [.2, .07], [.3, .15], [.42, .09], [.55, .16], [.66, .1], [.78, .14], [.9, .06], [1, .1]];
        ridge(far, "rgba(70,86,110,.85)");
        ridge(near, "rgba(32,40,52,.95)");
        // ทะเลสาบ: สะท้อนภาพด้านบนแบบกลับหัว + จางลง
        g.save();
        g.translate(0, horizon * 2); g.scale(1, -1);
        g.globalAlpha = 0.55;
        g.drawImage(c, 0, 0, OS_W, horizon, 0, 0, OS_W, horizon);
        g.restore();
        const water = g.createLinearGradient(0, horizon, 0, OS_H);
        water.addColorStop(0, "rgba(20,40,60,.25)"); water.addColorStop(1, "rgba(5,12,22,.85)");
        g.fillStyle = water; g.fillRect(0, horizon, OS_W, OS_H - horizon);
        g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(0, 0, OS_W, OS_H);
      } else if (this.key === "nothingos") {
        g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, OS_W, OS_H);
        g.fillStyle = "rgba(255,255,255,.08)";
        for (let y = 20; y < OS_H; y += 26) for (let x = 20; x < OS_W; x += 26) { g.beginPath(); g.arc(x, y, 2.2, 0, 6.3); g.fill(); }
      } else if (this.theme.dark) {
        const bg = g.createLinearGradient(0, 0, OS_W, OS_H);
        bg.addColorStop(0, "#1a0508"); bg.addColorStop(1, "#050507");
        g.fillStyle = bg; g.fillRect(0, 0, OS_W, OS_H);
        g.strokeStyle = "rgba(255,40,60,.35)"; g.lineWidth = 6;
        g.beginPath(); g.moveTo(0, 820); g.lineTo(OS_W, 520); g.stroke();
      } else {
        const bg = g.createLinearGradient(0, 0, OS_W * 0.6, OS_H);
        bg.addColorStop(0, shade(a, 0.45)); bg.addColorStop(0.45, shade(a, -0.1)); bg.addColorStop(1, shade(a, -0.65));
        g.fillStyle = bg; g.fillRect(0, 0, OS_W, OS_H);
        // วงแสงนุ่มแบบวอลเปเปอร์ของระบบ
        const blobs = this.key === "pixel" ? [[120, 300, 380, 0.5], [520, 900, 420, 0.35]] : [[470, 260, 420, 0.45], [80, 1000, 460, 0.28], [300, 640, 260, 0.18]];
        blobs.forEach(([x, y, r, al]) => {
          const gl = g.createRadialGradient(x, y, 5, x, y, r);
          gl.addColorStop(0, `rgba(255,255,255,${al})`); gl.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = gl; g.fillRect(0, 0, OS_W, OS_H);
        });
        // เครื่องสีอ่อน (ขาว/เงิน): ทำวอลเปเปอร์ให้เข้มขึ้น ตัวอักษรสีขาวจะได้อ่านง่าย
        if (isLight(a)) {
          const dim = g.createLinearGradient(0, 0, 0, OS_H);
          dim.addColorStop(0, "rgba(20,24,34,.38)"); dim.addColorStop(1, "rgba(10,12,18,.55)");
          g.fillStyle = dim; g.fillRect(0, 0, OS_W, OS_H);
        }
      }
      this.wallpaper = c;
    }
    this.g.drawImage(this.wallpaper, 0, 0);
    if (dim) { this.g.fillStyle = `rgba(0,0,0,${dim})`; this.g.fillRect(0, 0, OS_W, OS_H); }
  }

  now() {
    const d = new Date();
    return { d, hh: String(d.getHours()).padStart(2, "0"), mm: String(d.getMinutes()).padStart(2, "0") };
  }

  text(str, x, y, size, weight = 500, align = "center", color = "#fff", font = OS_FONT) {
    const g = this.g;
    g.font = `${weight} ${size}px ${font}`;
    g.textAlign = align; g.textBaseline = "alphabetic";
    g.fillStyle = color;
    g.fillText(str, x, y);
  }

  // ---------- หน้าล็อก (แต่ละระบบจัดนาฬิกาต่างกัน) ----------
  drawLock() {
    this.drawWallpaper(0.12);
    const { d, hh, mm } = this.now();
    const dateFull = `วัน${TH_DAYS[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS_FULL[d.getMonth()]}`;
    const dateShort = `${TH_DAYS_SHORT[d.getDay()]} ${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]}`;
    const t = this.theme;
    switch (t.lock) {
      case "ios":
        this.text(dateFull, OS_W / 2, 215, 34, 600);
        this.text(`${+hh}:${mm}`, OS_W / 2, 400, 196, 700);
        this.roundButton(110, 1155, "flashlight"); this.roundButton(490, 1155, "camera");
        break;
      case "oneui":
        this.text(`${hh}:${mm}`, OS_W / 2, 380, 170, 600);
        this.text(dateShort, OS_W / 2, 440, 34, 500);
        this.glyph("phone", 70, 1165, 46); this.glyph("camera", 484, 1165, 46);
        break;
      case "pixel":
        this.text(`${dateShort} · 27°`, 56, 170, 32, 500, "left");
        this.text(hh, OS_W / 2, 470, 260, 400);
        this.text(mm, OS_W / 2, 720, 260, 400);
        this.glyph("lock", OS_W / 2 - 20, 1080, 40);
        break;
      case "left-thin":
        this.text(`${hh}:${mm}`, 50, 400, 180, 200, "left");
        this.text(dateShort + " · 27°", 56, 460, 32, 500, "left");
        this.glyph("flashlight", 70, 1165, 42); this.glyph("camera", 488, 1165, 42);
        break;
      case "left-bold":
        this.text(`${hh}:${mm}`, 50, 380, 170, 700, "left");
        this.text(dateFull, 56, 440, 30, 500, "left");
        this.glyph("camera", 488, 1165, 42);
        break;
      case "harmony":
        this.text(`${hh}:${mm}`, OS_W / 2, 400, 200, 200);
        this.text(dateFull, OS_W / 2, 460, 30, 400);
        this.glyph("camera", 488, 1165, 42);
        break;
      case "nothing":
        this.text(`${hh}:${mm}`, OS_W / 2, 420, 150, 800, "center", "#fff", "'Doto', monospace");
        this.text(dateShort.toUpperCase(), OS_W / 2, 480, 30, 800, "center", "rgba(255,255,255,.75)", "'Doto', monospace");
        break;
      case "center-bold":
        this.text(`${hh}:${mm}`, OS_W / 2, 380, 170, 700);
        this.text(dateFull, OS_W / 2, 440, 30, 500);
        this.glyph("camera", 488, 1165, 42);
        break;
      default:
        this.text(`${hh}:${mm}`, OS_W / 2, 380, 170, 500);
        this.text(dateFull, OS_W / 2, 440, 30, 400);
        this.glyph("camera", 488, 1165, 42);
    }
    this.text(t.hint, OS_W / 2, 1225, 24, 500, "center", "rgba(255,255,255,.8)");
  }

  roundButton(cx, cy, icon) {
    const g = this.g;
    g.fillStyle = "rgba(20,20,24,.45)";
    g.beginPath(); g.arc(cx, cy, 48, 0, Math.PI * 2); g.fill();
    this.glyph(icon, cx - 22, cy - 22, 44);
  }

  glyph(name, x, y, size, color = "#ffffff") {
    const img = osIconCache[name + color];
    if (img) this.g.drawImage(img, x, y, size, size);
  }

  // ---------- หน้า Home ----------
  drawHome() {
    const g = this.g, t = this.theme;
    this.drawWallpaper(0);
    const top = t.glance ? 300 : 150;
    if (t.glance) {
      const { d } = this.now();
      this.text(`${TH_DAYS[d.getDay()]} ${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]}`, 56, 190, 40, 500, "left");
      this.glyph("cloud-sun", 56, 215, 40); this.text("27°", 106, 248, 32, 500, "left");
    }
    // หน้าแอปเรียงต่อกันในแนวนอน เลื่อนตามนิ้ว
    this.pages.forEach((apps, i) => {
      const ox = (i - this.page) * OS_W + this.dragX;
      if (ox <= -OS_W || ox >= OS_W) return;
      g.save(); g.translate(ox, 0);
      this.drawGrid(apps, top, t.rows);
      g.restore();
    });
    // ตัวบอกหน้า
    const iy = 1018;
    if (t.indicator === "search") {
      g.fillStyle = "rgba(255,255,255,.22)";
      this.roundRect(OS_W / 2 - 74, iy - 24, 148, 48, 24); g.fill();
      this.glyph("search", OS_W / 2 - 52, iy - 14, 28);
      this.text("ค้นหา", OS_W / 2 + 14, iy + 9, 24, 600);
    } else if (t.indicator === "dots") {
      const n = this.pages.length, gap = 22, x0 = OS_W / 2 - ((n - 1) * gap) / 2;
      const cur = this.page - this.dragX / OS_W;
      for (let i = 0; i < n; i++) {
        const on = 1 - Math.min(1, Math.abs(cur - i));
        g.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * on})`;
        g.beginPath(); g.arc(x0 + i * gap, iy, 6 + 2 * on, 0, Math.PI * 2); g.fill();
      }
    }
    // แถบแอปด้านล่าง
    const dy = t.search === "bottom" ? 1060 : 1080;
    if (t.dockBg === "glass") {
      g.fillStyle = "rgba(255,255,255,.24)";
      this.roundRect(22, dy - 12, OS_W - 44, 150, 48); g.fill();
    }
    const cw = (OS_W - 60) / 4;
    this.dock.forEach((app, i) => this.drawIcon(app, 30 + cw * i + cw / 2, dy + 62, false));
    if (t.search === "bottom") {
      g.fillStyle = "rgba(255,255,255,.88)";
      this.roundRect(40, 1190, OS_W - 80, 70, 35); g.fill();
      this.glyph("search", 66, 1208, 34, "#1c1c1e");
      this.text("ค้นหา", 116, 1236, 26, 500, "left", "#3a3a3c");
      this.glyph("mic", OS_W - 100, 1208, 34, "#1c1c1e");
    }
  }

  drawGrid(apps, top, rows) {
    const cw = (OS_W - 60) / 4, rh = (980 - top) / rows;
    const used = new Set();
    let slot = 0;
    apps.forEach((app) => {
      while (used.has(slot)) slot++;
      const c = slot % 4, r = Math.floor(slot / 4);
      if (app[1].startsWith("widget")) {
        // วิดเจ็ตขนาด 2x2
        [slot, slot + 1, slot + 4, slot + 5].forEach((s) => used.add(s));
        this.drawWidget(app, 30 + cw * c, top + rh * r, cw * 2, rh * 2);
      } else {
        used.add(slot);
        this.drawIcon(app, 30 + cw * c + cw / 2, top + rh * r + rh * 0.42, true);
      }
    });
  }

  // วิดเจ็ตแบตเตอรี่แบบ iOS: วงแหวน 4 ช่อง (มือถือ 100% + อุปกรณ์อื่นที่ยังไม่เชื่อมต่อ)
  drawWidget([label], x, y, w, h) {
    const g = this.g;
    const pad = 10, size = w - pad * 2;
    g.save();
    g.fillStyle = "rgba(30,30,34,.38)";
    this.roundRect(x + pad, y + 6, size, size, 34); g.fill();
    const cell = size / 2;
    for (let i = 0; i < 4; i++) {
      const cx = x + pad + cell * (i % 2) + cell / 2, cy = y + 6 + cell * Math.floor(i / 2) + cell / 2;
      g.lineWidth = 9;
      g.strokeStyle = "rgba(255,255,255,.18)";
      g.beginPath(); g.arc(cx, cy, cell * 0.33, 0, Math.PI * 2); g.stroke();
      if (i === 0) {
        g.strokeStyle = "#34C759";
        g.beginPath(); g.arc(cx, cy, cell * 0.33, -Math.PI / 2, Math.PI * 1.5); g.stroke();
        this.glyph("phone", cx - 16, cy - 16, 32);
      }
    }
    g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 6;
    this.text(label, x + w / 2, y + size + 40, 23, 500);
    g.restore();
  }

  // ---------- ไอคอนสไตล์ iOS (วาดเอง) ----------
  iosIconBg(x, y, s, top, bottom) {
    const g = this.g;
    const gr = g.createLinearGradient(0, y, 0, y + s);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom || top);
    g.fillStyle = gr;
    this.roundRect(x, y, s, s, s * 0.23); g.fill();
  }

  paintIOS(key, x, y, s) {
    const g = this.g, cx = x + s / 2, cy = y + s / 2;
    const glyphW = (name, k = 0.5) => this.glyph(name, cx - (s * k) / 2, cy - (s * k) / 2, s * k);
    const d = new Date();
    switch (key) {
      case "facetime": this.iosIconBg(x, y, s, "#5BF675", "#0CBD2A"); glyphW("video"); return true;
      case "calendar-ios":
        this.iosIconBg(x, y, s, "#ffffff");
        this.text(TH_DAYS_SHORT[d.getDay()], cx, y + 30, 20, 600, "center", "#FF3B30");
        this.text(String(d.getDate()), cx, y + s - 18, 58, 300, "center", "#1c1c1e");
        return true;
      case "photos": {
        this.iosIconBg(x, y, s, "#ffffff");
        const cols = ["#FF9500", "#FFCC00", "#9BDB3A", "#34C759", "#30B0C7", "#5E5CE6", "#AF52DE", "#FF2D55"];
        g.save(); g.globalCompositeOperation = "multiply";
        cols.forEach((c, i) => {
          g.save(); g.translate(cx, cy); g.rotate((i * Math.PI) / 4);
          g.fillStyle = c; g.globalAlpha = 0.85;
          g.beginPath(); g.ellipse(0, -s * 0.17, s * 0.1, s * 0.19, 0, 0, Math.PI * 2); g.fill();
          g.restore();
        });
        g.restore();
        return true;
      }
      case "camera-ios":
        this.iosIconBg(x, y, s, "#E4E4E9", "#A5A5AD");
        g.fillStyle = "#3a3a3c"; this.roundRect(x + s * 0.18, y + s * 0.3, s * 0.64, s * 0.44, 10); g.fill();
        g.fillStyle = "#e9e9ee"; g.beginPath(); g.arc(cx, cy + 4, s * 0.15, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#1c1c1e"; g.beginPath(); g.arc(cx, cy + 4, s * 0.1, 0, Math.PI * 2); g.fill();
        return true;
      case "mail-ios": this.iosIconBg(x, y, s, "#3FA9FF", "#1A6CF5"); glyphW("mail", 0.56); return true;
      case "notes":
        this.iosIconBg(x, y, s, "#ffffff");
        g.fillStyle = "#FFD60A"; g.fillRect(x, y, s, s * 0.24);
        g.fillStyle = "#d1d1d6"; for (let i = 0; i < 4; i++) g.fillRect(x + 14, y + s * 0.42 + i * 15, s - 28, 3);
        return true;
      case "reminders":
        this.iosIconBg(x, y, s, "#ffffff");
        ["#0A84FF", "#FF453A", "#FF9F0A"].forEach((c, i) => {
          g.fillStyle = c; g.beginPath(); g.arc(x + 26, y + 30 + i * 24, 7, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#e5e5ea"; g.fillRect(x + 42, y + 27 + i * 24, s - 60, 5);
        });
        return true;
      case "clock-ios": {
        this.iosIconBg(x, y, s, "#1c1c1e");
        g.fillStyle = "#fff"; g.beginPath(); g.arc(cx, cy, s * 0.4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#1c1c1e"; g.lineCap = "round";
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          g.lineWidth = 2; g.beginPath();
          g.moveTo(cx + Math.sin(a) * s * 0.33, cy - Math.cos(a) * s * 0.33);
          g.lineTo(cx + Math.sin(a) * s * 0.37, cy - Math.cos(a) * s * 0.37); g.stroke();
        }
        const hand = (ang, len, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); g.stroke(); };
        const h = d.getHours() % 12, m = d.getMinutes(), sec = d.getSeconds();
        hand(((h + m / 60) * Math.PI) / 6, s * 0.2, 5, "#1c1c1e");
        hand((m * Math.PI) / 30, s * 0.3, 4, "#1c1c1e");
        hand((sec * Math.PI) / 30, s * 0.32, 2, "#FF9500");
        return true;
      }
      case "stocks":
        this.iosIconBg(x, y, s, "#1c1c1e");
        g.strokeStyle = "#34C759"; g.lineWidth = 4; g.lineJoin = "round"; g.beginPath();
        [[0.15, 0.68], [0.32, 0.55], [0.45, 0.62], [0.6, 0.4], [0.72, 0.48], [0.86, 0.3]].forEach(([px, py], i) => (i ? g.lineTo : g.moveTo).call(g, x + s * px, y + s * py));
        g.stroke();
        return true;
      case "tv": this.iosIconBg(x, y, s, "#2c2c2e", "#000000"); glyphW("play", 0.42); return true;
      case "podcasts": this.iosIconBg(x, y, s, "#D56CF5", "#8A2BE2"); glyphW("mic", 0.5); return true;
      case "appstore": this.iosIconBg(x, y, s, "#22C3FF", "#1A6CF5"); glyphW("store", 0.52); return true;
      case "maps":
        this.iosIconBg(x, y, s, "#E8F1DA", "#CFE3B4");
        g.strokeStyle = "#ffffff"; g.lineWidth = 10; g.beginPath(); g.moveTo(x, y + s * 0.7); g.lineTo(x + s, y + s * 0.3); g.stroke();
        g.strokeStyle = "#F5C342"; g.lineWidth = 7; g.beginPath(); g.moveTo(x + s * 0.35, y); g.lineTo(x + s * 0.5, y + s); g.stroke();
        g.fillStyle = "#0A84FF"; g.beginPath(); g.arc(cx + 10, cy - 6, 9, 0, Math.PI * 2); g.fill();
        return true;
      case "health": {
        this.iosIconBg(x, y, s, "#ffffff");
        g.fillStyle = "#FF2D55"; g.beginPath();
        const hs = s * 0.25;
        g.moveTo(cx, cy + hs * 0.95);
        g.bezierCurveTo(cx - hs * 1.6, cy - hs * 0.2, cx - hs * 0.7, cy - hs * 1.4, cx, cy - hs * 0.45);
        g.bezierCurveTo(cx + hs * 0.7, cy - hs * 1.4, cx + hs * 1.6, cy - hs * 0.2, cx, cy + hs * 0.95);
        g.fill();
        return true;
      }
      case "wallet-ios":
        this.iosIconBg(x, y, s, "#1c1c1e");
        ["#34C759", "#FF9F0A", "#0A84FF", "#FF453A"].forEach((c, i) => {
          g.fillStyle = c; this.roundRect(x + 16, y + 22 + i * 12, s - 32, 34, 6); g.fill();
        });
        g.fillStyle = "#2c2c2e"; this.roundRect(x + 12, y + s * 0.58, s - 24, s * 0.3, 8); g.fill();
        return true;
      case "settings-ios": this.iosIconBg(x, y, s, "#C8C8CE", "#8E8E95"); this.glyph("settings", cx - s * 0.32, cy - s * 0.32, s * 0.64, "#1c1c1e"); return true;
      case "phone-ios": this.iosIconBg(x, y, s, "#5BF675", "#0CBD2A"); glyphW("phone"); return true;
      case "messages":
        this.iosIconBg(x, y, s, "#5BF675", "#0CBD2A");
        g.fillStyle = "#fff"; g.beginPath(); g.ellipse(cx, cy - 2, s * 0.32, s * 0.26, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(cx - s * 0.2, cy + s * 0.14); g.lineTo(cx - s * 0.27, cy + s * 0.3); g.lineTo(cx - s * 0.05, cy + s * 0.2); g.fill();
        return true;
      case "safari":
        this.iosIconBg(x, y, s, "#ffffff");
        g.fillStyle = "#1A8CFF"; g.beginPath(); g.arc(cx, cy, s * 0.38, 0, Math.PI * 2); g.fill();
        g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4);
        g.fillStyle = "#FF3B30"; g.beginPath(); g.moveTo(0, -s * 0.3); g.lineTo(7, 0); g.lineTo(-7, 0); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.moveTo(0, s * 0.3); g.lineTo(7, 0); g.lineTo(-7, 0); g.fill();
        g.restore();
        return true;
      case "music-ios": this.iosIconBg(x, y, s, "#FF6482", "#FA2D48"); glyphW("music"); return true;
    }
    return false;
  }

  drawIcon([label, icon, color], cx, cy, withLabel) {
    const g = this.g, t = this.theme;
    const s = 104, x = cx - s / 2, y = cy - s / 2;
    if (this.key === "ios" && !color) {
      g.save();
      g.shadowColor = "rgba(0,0,0,.2)"; g.shadowBlur = 10; g.shadowOffsetY = 3;
      this.roundRect(x, y, s, s, s * 0.23); g.fillStyle = "#000"; g.fill();
      g.restore();
      g.save(); this.roundRect(x, y, s, s, s * 0.23); g.clip();
      this.paintIOS(icon, x, y, s);
      g.restore();
      if (withLabel) { g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 6; this.text(label, cx, cy + s / 2 + 34, 23, 500); g.restore(); }
      return;
    }
    let bg = color, fg = "#ffffff";
    if (t.mono) { bg = "#f2f2f2"; fg = "#1c1c1e"; }
    else if (t.tonal) { bg = shade(this.accent, 0.78); fg = "#1c1c1e"; }
    g.save();
    g.shadowColor = "rgba(0,0,0,.18)"; g.shadowBlur = 10; g.shadowOffsetY = 3;
    g.fillStyle = bg;
    if (t.shape === "circle") { g.beginPath(); g.arc(cx, cy, s / 2, 0, Math.PI * 2); }
    else this.roundRect(x, y, s, s, s * (t.r || 0.25));
    g.fill();
    g.restore();
    if (!t.mono && !t.tonal) {   // เงาไล่ระดับบนไอคอนเล็กน้อยให้ดูมีมิติ
      const gl = g.createLinearGradient(0, y, 0, y + s);
      gl.addColorStop(0, "rgba(255,255,255,.18)"); gl.addColorStop(1, "rgba(0,0,0,.06)");
      g.fillStyle = gl;
      if (t.shape === "circle") { g.beginPath(); g.arc(cx, cy, s / 2, 0, Math.PI * 2); } else this.roundRect(x, y, s, s, s * (t.r || 0.25));
      g.fill();
    }
    if (icon === "calendar") {   // ไอคอนปฏิทินแสดงวันที่จริง
      const d = new Date();
      this.text(TH_DAYS_SHORT[d.getDay()], cx, cy - 16, 20, 600, "center", fg);
      this.text(String(d.getDate()), cx, cy + 32, 50, 400, "center", fg);
    } else this.glyph(icon, cx - 26, cy - 26, 52, fg === "#ffffff" ? "#ffffff" : "#1c1c1e");
    if (withLabel) {
      g.save();
      g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 6;
      this.text(label, cx, cy + s / 2 + 34, 23, 500);
      g.restore();
    }
  }

  drawStatusBar() {
    if (this.state === "off" && this.brightness <= 0.001) return;
    const g = this.g;
    const { hh, mm } = this.now();
    const ios = this.key === "ios";
    const y = ios ? 62 : 52;
    const time = ios ? `${+hh}:${mm}` : `${hh}:${mm}`;
    if (!(this.state === "lock" && ios)) this.text(time, ios ? 96 : 44, y, 28, 600, ios ? "center" : "left");
    // สัญญาณ, Wi-Fi, แบตเตอรี่
    const rx = OS_W - (ios ? 64 : 44);
    g.fillStyle = "#fff";
    this.roundRect(rx - 44, y - 21, 44, 22, 6); g.fill();
    g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(rx + 1, y - 14, 4, 8);
    g.strokeStyle = "#fff"; g.lineWidth = 4; g.lineCap = "round";
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(rx - 82, y - 2, 6 + i * 8, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); }
    for (let i = 0; i < 4; i++) { g.fillStyle = "#fff"; g.fillRect(rx - 150 + i * 10, y - 6 - i * 5, 6, 8 + i * 5); }
  }

  // กล้องหน้า: Dynamic Island / รอยบาก / รูเจาะ ตามรุ่นจริง
  drawCutout() {
    const g = this.g, p = this.phone;
    g.fillStyle = "#000";
    if (p.brand === "Apple") {
      if (/1[34]$|1[34] (Plus|mini)|16e/.test(p.name)) { this.roundRect(168, -30, 264, 88, 30); g.fill(); }
      else { this.roundRect(220, 26, 160, 50, 25); g.fill(); }
    } else { g.beginPath(); g.arc(OS_W / 2, 50, 18, 0, Math.PI * 2); g.fill(); }
  }

  drawHomeBar() {
    if (this.state === "off") return;
    const g = this.g;
    g.fillStyle = "rgba(255,255,255,.85)";
    this.roundRect(OS_W / 2 - 90, OS_H - 26, 180, 9, 4.5); g.fill();
  }

  roundRect(x, y, w, h, r) {
    const g = this.g;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  }
}
