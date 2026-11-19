// รูปมือถือ: วาดเองทั้งหมด (ไม่ใช้รูปจากเว็บอื่น จึงไม่มีลายน้ำ)
// cameraLayout() กำหนดตำแหน่งกล้องตามสไตล์ของแต่ละแบรนด์ ใช้ร่วมกันทั้งรูป 2D (SVG) และโมเดล 3D (phone-3d.js)
// พิกัดอ้างอิงกรอบ 120 x 240 (ตัวเครื่องอยู่ที่ x 3–117, y 3–237) มองจากด้านหลัง กล้องอยู่มุมซ้ายบน
// ถ้าต้องการใช้รูปจริง ให้ใส่ "image": "images/xxx.png" ในสเปกของรุ่นนั้น แล้ววางไฟล์ไว้ที่ static/images/

let artSeq = 0;

function phoneImage(p, cls = "") {
  const s = p.specs || {};
  if (s.image) return `<img class="phone-img ${cls}" src="${esc(s.image)}" alt="${esc(p.name)}" loading="lazy">`;
  return phoneSVG(p, cls);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// amt > 0 = สว่างขึ้น, < 0 = เข้มขึ้น
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt)));
  return `rgb(${r},${g},${b})`;
}
function isLight(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** ตำแหน่งชุดกล้องด้านหลัง: plates = ฐานกล้อง, lenses = เลนส์, flashes = แฟลช, deco = ลวดลาย */
function cameraLayout(p) {
  const n = p.name;
  const L = { plates: [], lenses: [], flashes: [], deco: null };
  const lens = (x, y, r = 9) => L.lenses.push({ x, y, r });
  const rect = (x, y, w, h, r) => L.plates.push({ shape: "rect", x, y, w, h, r });
  const circle = (cx, cy, r) => L.plates.push({ shape: "circle", cx, cy, r });

  if (p.brand === "Apple") {
    if (/17 Pro/.test(n)) { rect(6, 10, 108, 56, 16); lens(24, 26); lens(24, 50); lens(46, 38); L.flashes.push({ x: 96, y: 26 }); }
    else if (/Air/.test(n)) { rect(6, 10, 108, 40, 18); lens(26, 30, 10); L.flashes.push({ x: 50, y: 30 }); }
    else if (/Pro/.test(n)) { rect(10, 10, 54, 54, 14); lens(25, 25); lens(25, 49); lens(48, 37); L.flashes.push({ x: 50, y: 18 }); }
    else if (/\de$/.test(n)) { lens(24, 24, 10); L.flashes.push({ x: 24, y: 44 }); }
    else if (/17/.test(n)) { rect(10, 10, 34, 58, 17); lens(27, 27); lens(27, 51); L.flashes.push({ x: 52, y: 24 }); }
    else { rect(10, 10, 50, 50, 13); lens(24, 24); lens(46, 46); L.flashes.push({ x: 48, y: 20 }); }
  } else if (p.brand === "Samsung") {
    lens(22, 24); lens(22, 47); lens(22, 70);
    if (/Ultra/.test(n)) lens(44, 30, 6);
    L.flashes.push({ x: 42, y: 52 });
  } else if (p.brand === "Google") {
    rect(3, 30, 114, 32, 16); lens(28, 46); lens(52, 46);
    if (/Pro/.test(n)) lens(76, 46);
    L.flashes.push({ x: 98, y: 46 });
  } else if (p.brand === "Nothing") {
    rect(14, 14, 32, 64, 16); lens(30, 31); lens(30, 61);
    L.deco = "nothing";
  } else if (/Ultra|X\d00 Pro|Find X\d|Magic\d? ?\d? Pro|OnePlus 1[35]$|1[45]T Pro|^Xiaomi 1\d$|Pura|Mate|P60/.test(n)) {
    const cx = /OnePlus/.test(n) ? 40 : 60;
    circle(cx, 54, 36);
    lens(cx - 14, 40); lens(cx + 14, 40); lens(cx - 14, 68); lens(cx + 14, 68);
  } else {
    rect(12, 12, 42, 68, 15); lens(33, 31); lens(33, 60); L.flashes.push({ x: 62, y: 24 });
  }
  if (p.brand === "ASUS") L.deco = "asus";
  return L;
}

function phoneSVG(p, cls) {
  const c = (p.specs && p.specs.color) || "#8e8e93";
  const gid = `pg${++artSeq}`;
  const mod = isLight(c) ? shade(c, -0.1) : shade(c, 0.12);
  const modEdge = isLight(c) ? shade(c, -0.22) : shade(c, 0.25);
  const L = cameraLayout(p);

  const plates = L.plates.map((pl) => pl.shape === "rect"
    ? `<rect x="${pl.x}" y="${pl.y}" width="${pl.w}" height="${pl.h}" rx="${pl.r}" fill="${mod}"/>`
    : `<circle cx="${pl.cx}" cy="${pl.cy}" r="${pl.r}" fill="${mod}"/><circle cx="${pl.cx}" cy="${pl.cy}" r="${pl.r}" fill="none" stroke="${modEdge}" stroke-width="1.5"/>`).join("");
  const lenses = L.lenses.map(({ x, y, r }) => `
    <circle cx="${x}" cy="${y}" r="${r + 2}" fill="${modEdge}"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#121216"/>
    <circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="#1f2433"/>
    <circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.2}" fill="rgba(255,255,255,.35)"/>`).join("");
  const flashes = L.flashes.map(({ x, y }) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#f4eedf" opacity=".85"/>`).join("");
  const deco = L.deco === "asus" ? `<path d="M3 170 L117 120 L117 136 L3 186 Z" fill="rgba(255,40,60,.35)"/>`
    : L.deco === "nothing" ? `<g stroke="rgba(0,0,0,.18)" stroke-width="2" fill="none" stroke-linecap="round"><path d="M60 110 q30 -20 46 10"/><path d="M20 190 h40"/><circle cx="90" cy="200" r="8"/></g>` : "";

  return `
  <svg class="phone-art ${cls}" viewBox="0 0 120 240" role="img" aria-label="${esc(p.name)}">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${shade(c, 0.12)}"/>
        <stop offset="1" stop-color="${shade(c, -0.14)}"/>
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="114" height="234" rx="22" fill="url(#${gid})" stroke="${shade(c, -0.3)}" stroke-width="1.5"/>
    <rect x="5" y="5" width="110" height="230" rx="20" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1"/>
    ${deco}${plates}${lenses}${flashes}
  </svg>`;
}
