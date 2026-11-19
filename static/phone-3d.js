// โมเดลมือถือ 3 มิติ (three.js)
//  - รุ่นทั่วไป: สร้างด้วยโค้ดจากสเปก — กรอบโลหะ, ฝาหลังกระจก, จอดำขอบมน, ชุดกล้องตามสไตล์แบรนด์ (cameraLayout ใน phone-art.js),
//    ปุ่มข้าง, เส้นเสาอากาศ, ช่อง USB-C, รูลำโพง และเงาใต้เครื่อง
//  - รุ่นที่มีโมเดลจริง (REAL_MODELS): โหลดไฟล์ .dae พร้อมพื้นผิว PBR
//  - เปลี่ยนสีได้พร้อมแอนิเมชัน: สีค่อยๆ เปลี่ยน + แสงกวาดผ่านตัวเครื่อง
// โหลด three.js เฉพาะตอนเปิดหน้ารายละเอียด เพื่อให้หน้าแรกเปิดเร็ว

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const COLLADA_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/ColladaLoader.js";

// รุ่นที่มีโมเดล 3D จริง (ไฟล์อยู่ใน static/models/)
// rotation = หมุนให้หน้าจอหันเข้าหากล้อง | baseColor = ชื่อสีของพื้นผิวต้นฉบับ | credit = ต้องแสดงตามสัญญาอนุญาต CC BY
const REAL_MODELS = {
  "apple-apple-iphone-14-pro": {
    dir: "models/iphone-14-pro/", file: "model.dae", rotation: [0, Math.PI, 0], baseColor: "Space Black",
    credit: {
      title: "iPhone 14 Pro", author: "mister dude",
      url: "https://sketchfab.com/3d-models/iphone-14-pro-5cb0778041a34f09b409a38c687bb1d4",
      license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
};

const COLOR_ANIM_MS = 900;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const scriptLoads = {};
function loadScript(url) {
  if (!scriptLoads[url]) {
    scriptLoads[url] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      s.onerror = () => { delete scriptLoads[url]; reject(new Error("โหลดสคริปต์ไม่สำเร็จ: " + url)); };
      document.head.appendChild(s);
    });
  }
  return scriptLoads[url];
}
const loadThree = () => (window.THREE ? Promise.resolve(window.THREE) : loadScript(THREE_URL).then(() => window.THREE));

function roundedRectShape(T, w, h, r) {
  const s = new T.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// แผ่นเรียบรูปสี่เหลี่ยมมุมมน พร้อม UV 0–1 (ใช้กับจอที่มีภาพ)
function roundedPlane(T, w, h, r) {
  const g = new T.ShapeGeometry(roundedRectShape(T, w, h, r), 32);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}

// ---------- มือถือจอพับ ----------
// book = พับข้างแบบหนังสือ (Fold), flip = พับบน-ล่าง (Flip/razr), tri = พับสามทบ (Mate XT)
function foldType(p) {
  const panel = (p.specs && p.specs.panel) || "";
  if (!/พับ/.test(panel)) return null;
  if (/สามทบ/.test(panel)) return "tri";
  return /Flip|razr/i.test(p.name) ? "flip" : "book";
}

// สี่เหลี่ยมที่กำหนดความโค้งแต่ละมุมได้ [บนซ้าย, บนขวา, ล่างขวา, ล่างซ้าย] (ฝั่งบานพับใช้มุมเหลี่ยม)
function cornerRectShape(T, w, h, radii) {
  const s = new T.Shape(), x = -w / 2, y = -h / 2;
  const [tl, tr, br, bl] = radii.map((r) => Math.max(0.0005, Math.min(r, w / 2, h / 2)));
  s.moveTo(x + bl, y);
  s.lineTo(x + w - br, y); s.quadraticCurveTo(x + w, y, x + w, y + br);
  s.lineTo(x + w, y + h - tr); s.quadraticCurveTo(x + w, y + h, x + w - tr, y + h);
  s.lineTo(x + tl, y + h); s.quadraticCurveTo(x, y + h, x, y + h - tl);
  s.lineTo(x, y + bl); s.quadraticCurveTo(x, y, x + bl, y);
  return s;
}

function uvPlane(T, w, h, radii, uvFn) {
  const g = new T.ShapeGeometry(cornerRectShape(T, w, h, radii), 24);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) { const [u, v] = uvFn(pos.getX(i), pos.getY(i)); uv.setXY(i, u, v); }
  return g;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const FOLD_MS = 1300;

function hexMix(a, b, t) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// ภาพบนหน้าจอล็อก: วอลเปเปอร์ไล่สี + นาฬิกา + แถบสถานะ + กล้องหน้า
function screenTexture(T, p, color) {
  const c = document.createElement("canvas");
  c.width = 600; c.height = 1280;
  const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 600, 1280);
  bg.addColorStop(0, shade(color, 0.35));
  bg.addColorStop(0.5, shade(color, -0.3));
  bg.addColorStop(1, "#04040a");
  g.fillStyle = bg; g.fillRect(0, 0, 600, 1280);
  [[440, 360, 420, "rgba(255,255,255,.35)"], [120, 980, 380, "rgba(255,255,255,.12)"]].forEach(([x, y, r, col]) => {
    const glow = g.createRadialGradient(x, y, 10, x, y, r);
    glow.addColorStop(0, col); glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow; g.fillRect(0, 0, 600, 1280);
  });
  g.fillStyle = "rgba(255,255,255,.95)";
  g.font = "600 30px -apple-system, 'Segoe UI', sans-serif";
  g.fillText("9:41", 52, 70);
  g.fillRect(470, 50, 52, 24);                         // แบตเตอรี่
  g.textAlign = "center";
  g.font = "500 34px -apple-system, 'Segoe UI', 'Noto Sans Thai', sans-serif";
  g.fillText("วันพุธที่ 19 พฤศจิกายน", 300, 250);
  g.font = "700 190px -apple-system, 'Segoe UI', sans-serif";
  g.fillText("9:41", 300, 430);
  // กล้องหน้า: Dynamic Island / รอยบาก / รูเจาะ
  g.fillStyle = "#000";
  const round = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill(); };
  if (p.brand === "Apple" && !/1[34]$|1[34] (Plus|mini)|16e/.test(p.name)) round(222, 30, 156, 46, 23);
  else if (p.brand === "Apple") round(170, 0, 260, 60, 30);
  else { g.beginPath(); g.arc(300, 58, 18, 0, Math.PI * 2); g.fill(); }
  const tex = new T.CanvasTexture(c);
  tex.encoding = T.sRGBEncoding;
  tex.anisotropy = 8;
  return tex;
}

// สภาพแวดล้อมแบบสตูดิโอถ่ายสินค้า: ไล่สีพื้นหลัง + ไฟซอฟต์บ็อกซ์ (ทำให้โลหะและกระจกสะท้อนสวย)
function studioEnvironment(T, renderer) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#f4f4f6"); sky.addColorStop(0.42, "#8e939b"); sky.addColorStop(0.55, "#3a3c42"); sky.addColorStop(1, "#0d0d10");
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  const box = (x, y, w, h, a) => {
    const grd = g.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, `rgba(255,255,255,0)`); grd.addColorStop(0.5, `rgba(255,255,255,${a})`); grd.addColorStop(1, `rgba(255,255,255,0)`);
    g.fillStyle = grd; g.fillRect(x, y, w, h);
  };
  box(90, 60, 170, 260, 1); box(560, 40, 260, 120, 0.95); box(880, 120, 90, 240, 0.7); box(380, 330, 300, 40, 0.35);
  const tex = new T.CanvasTexture(c);
  tex.mapping = T.EquirectangularReflectionMapping;
  tex.encoding = T.sRGBEncoding;
  const pmrem = new T.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

// เงานุ่มใต้เครื่อง
function contactShadow(T) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grd.addColorStop(0, "rgba(0,0,0,.42)"); grd.addColorStop(0.6, "rgba(0,0,0,.12)"); grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const m = new T.Mesh(new T.PlaneGeometry(1.9, 0.55), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -1.18;
  return m;
}

class Phone3DViewer {
  constructor(container, phone) {
    this.container = container;
    this.phone = phone;
    this.auto = false;      // ไม่หมุนเอง: ผู้ใช้หมุนด้วยนิ้วหรือเมาส์เท่านั้น
    this.credit = null;
    this.vel = { x: 0, y: 0 };
    this.target = null;
    this.disposed = false;
    this.tween = null;      // แอนิเมชันเปลี่ยนสีที่กำลังเล่น
    const colors = phone.colors || [];
    this.colorName = colors.length ? colors[0].name : null;
    this.colorHex = colors.length ? colors[0].hex : (phone.specs && phone.specs.color) || "#8e8e93";
  }

  async start() {
    const T = await loadThree();
    if (this.disposed) return;
    this.T = T;
    this.lin = (c) => new T.Color(c).convertSRGBToLinear();
    const { width, height } = this.container.getBoundingClientRect();

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.physicallyCorrectLights = false;
    this.renderer = renderer;
    this.container.appendChild(renderer.domElement);

    const scene = new T.Scene();
    scene.environment = studioEnvironment(T, renderer);
    this.scene = scene;

    const camera = new T.PerspectiveCamera(28, width / height, 0.1, 50);
    camera.position.set(0, 0.05, 5.6);
    this.camera = camera;

    scene.add(new T.HemisphereLight(0xffffff, 0x2a2a33, 0.45));
    const key = new T.DirectionalLight(0xffffff, 0.85); key.position.set(3, 4, 5); scene.add(key);
    const fill = new T.DirectionalLight(0xdfe8ff, 0.35); fill.position.set(-4, -1, 3); scene.add(fill);
    const rimL = new T.DirectionalLight(0xffffff, 0.6); rimL.position.set(-3, 2, -4); scene.add(rimL);
    const rimR = new T.DirectionalLight(0xffffff, 0.45); rimR.position.set(4, 1, -3); scene.add(rimR);
    // แสงกวาดตอนเปลี่ยนสี
    this.sweep = new T.PointLight(0xffffff, 0, 5, 2);
    scene.add(this.sweep);
    scene.add(contactShadow(T));

    // ระบบจำลองหน้าจอ (หน้าล็อก / Home) ตามระบบปฏิบัติการของรุ่นนี้
    try {
      await loadOSIcons();
      this.os = new PhoneOS(this.phone, this.colorHex);
      this.os.onState = (s) => this.onOSState && this.onOSState(s);
    } catch (e) {
      this.os = null;
    }
    if (this.disposed) return;
    this.raycaster = new T.Raycaster();

    const real = REAL_MODELS[this.phone.id];
    this.group = null;
    if (real) {
      try {
        this.group = await this.buildRealModel(real);
        this.credit = real.credit;
        this.real = real;
        if (real.baseColor && (this.phone.colors || []).some((c) => c.name === real.baseColor)) {
          this.colorName = real.baseColor;
          this.colorHex = this.phone.colors.find((c) => c.name === real.baseColor).hex;
        }
      } catch (e) {
        console.warn("โหลดโมเดลจริงไม่สำเร็จ ใช้โมเดลจำลองแทน", e);
      }
      if (this.disposed) return;
    }
    if (!this.group) this.group = foldType(this.phone) ? this.buildFoldable() : this.buildPhone();
    else if (this.os) this.addScreenOverlay(this.group);   // โมเดลจริง: วางจอจำลองทับจอเดิม
    this.group.rotation.set(0.06, -0.35, 0);   // ท่าเริ่มต้น: ด้านหน้าเอียงเล็กน้อย
    scene.add(this.group);

    this.bindControls();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.container);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // สีกรอบโลหะจากสีตัวเครื่อง: iPhone Pro/ไทเทเนียมใช้โทนเดียวกัน รุ่นอื่นผสมเทาโลหะ
  frameHex(hex) {
    const p = this.phone;
    if (p.brand === "Apple") return /Pro/.test(p.name) ? hexMix(hex, "#9a9a9e", 0.25) : hex;
    return hexMix(hex, isLight(hex) ? "#c8c9cc" : "#5a5c60", 0.45);
  }

  buildPhone() {
    const T = this.T, p = this.phone, s = p.specs || {};
    const hex = this.colorHex;
    const lin = this.lin;
    const foldable = /จอพับ/.test(s.panel || "");
    const apple = p.brand === "Apple";
    const ultra = /Ultra/.test(p.name) && p.brand === "Samsung";
    const premium = /Pro|Ultra|Fold|Magic|Find X/.test(p.name);

    // สัดส่วนใกล้เครื่องจริง (สูง:กว้าง ≈ 2.13:1, หนา ~8 มม.)
    const H = 2.0, W = foldable ? 0.98 : H / 2.13;
    const D = foldable ? 0.15 : 0.098;
    const R = ultra ? 0.05 : p.brand === "Sony" ? 0.06 : apple ? 0.16 : 0.14;   // รัศมีมุมตามแบรนด์
    const B = apple ? 0.012 : 0.034;            // iPhone ขอบข้างแบน รุ่นอื่นขอบโค้ง
    const group = new T.Group();

    this.mats = {
      frame: new T.MeshPhysicalMaterial({ color: lin(this.frameHex(hex)), metalness: 0.9, roughness: apple && /Pro/.test(p.name) ? 0.42 : 0.24, envMapIntensity: 1.2 }),
      // รุ่นท็อปกระจกฝ้า (สะท้อนแสงน้อย สีชัด) รุ่นอื่นกระจกเงา
      back: new T.MeshPhysicalMaterial({
        color: lin(hex), metalness: 0, roughness: premium ? 0.55 : 0.2,
        clearcoat: premium ? 0.25 : 0.8, clearcoatRoughness: premium ? 0.45 : 0.06, envMapIntensity: premium ? 0.5 : 0.65,
      }),
      plate: new T.MeshPhysicalMaterial({ color: lin(hex), metalness: 0.15, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.05, envMapIntensity: 0.7 }),
      ring: new T.MeshPhysicalMaterial({ color: lin(this.frameHex(hex)), metalness: 1, roughness: 0.18 }),
    };
    const dark = new T.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.6, metalness: 0.2 });

    // กรอบโลหะ (ตัวเครื่องทั้งก้อน)
    const frameGeo = new T.ExtrudeGeometry(roundedRectShape(T, W - 2 * B, H - 2 * B, R), {
      depth: D - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: apple ? 3 : 10, curveSegments: 40,
    });
    frameGeo.center();
    group.add(new T.Mesh(frameGeo, this.mats.frame));

    const inW = W - 2 * B, inH = H - 2 * B, inR = Math.max(0.02, R - B);
    // ฝาหลังกระจก
    const back = new T.Mesh(roundedPlane(T, inW - 0.006, inH - 0.006, inR), this.mats.back);
    back.rotation.y = Math.PI;
    back.position.z = -D / 2 - 0.0012;
    group.add(back);
    // กระจกหน้าสีดำ (ขอบจอ) + จอภาพ
    const front = new T.Mesh(roundedPlane(T, inW - 0.002, inH - 0.002, inR),
      new T.MeshPhysicalMaterial({ color: 0x030304, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 }));
    front.position.z = D / 2 + 0.0012;
    group.add(front);
    const bezel = foldable ? 0.03 : apple ? 0.05 : 0.04;
    const screenMap = this.os ? this.osTexture() : screenTexture(T, p, hex);
    const screen = new T.Mesh(roundedPlane(T, inW - bezel, inH - bezel, Math.max(0.02, inR - bezel / 2)),
      new T.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenMap, emissiveIntensity: 0.95, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }));
    screen.position.z = D / 2 + 0.0022;
    group.add(screen);
    this.screenMesh = screen;

    // ปุ่มข้าง (ปุ่มเปิด-ปิดจอกดได้จริง: iPhone อยู่ขวาบน, Android อยู่ขวาล่างใต้ปุ่มเสียง)
    const btn = (x, y, h) => {
      const m = new T.Mesh(new T.BoxGeometry(0.022, h, D * 0.36), this.mats.frame);
      m.position.set(x, y, 0); group.add(m);
      return m;
    };
    if (apple) { this.powerBtn = btn(W / 2 + 0.006, 0.36, 0.26); btn(-W / 2 - 0.006, 0.55, 0.1); btn(-W / 2 - 0.006, 0.32, 0.16); btn(-W / 2 - 0.006, 0.12, 0.16); }
    else { btn(W / 2 + 0.006, 0.52, 0.34); this.powerBtn = btn(W / 2 + 0.006, 0.16, 0.15); }

    // เส้นเสาอากาศบนกรอบ (แถบพลาสติกเล็กๆ)
    const antenna = new T.MeshStandardMaterial({ color: lin(hexMix(this.frameHex(hex), "#777777", 0.5)), roughness: 0.7 });
    [[W / 2, H / 2 - 0.18], [-W / 2, H / 2 - 0.18], [W / 2, -H / 2 + 0.2], [-W / 2, -H / 2 + 0.2]].forEach(([x, y]) => {
      const m = new T.Mesh(new T.BoxGeometry(0.012, 0.014, D * 0.62), antenna);
      m.position.set(x + Math.sign(x) * 0.0015, y, 0); group.add(m);
    });
    [-W / 2 + 0.22, W / 2 - 0.22].forEach((x) => {
      const m = new T.Mesh(new T.BoxGeometry(0.014, 0.012, D * 0.62), antenna);
      m.position.set(x, H / 2 + 0.0015, 0); group.add(m);
    });

    // ด้านล่าง: ช่อง USB-C + รูลำโพง
    const port = new T.Mesh(new T.BoxGeometry(0.1, 0.012, 0.032), dark);
    port.position.set(0, -H / 2 - 0.001, 0); group.add(port);
    const hole = new T.CylinderGeometry(0.0075, 0.0075, 0.01, 12);
    for (let i = 0; i < 6; i++) {
      [-1, 1].forEach((side) => {
        const m = new T.Mesh(hole, dark);
        m.position.set(side * (0.1 + i * 0.026), -H / 2 - 0.001, 0);
        group.add(m);
      });
    }

    this.addCameras(group, W, H, -D / 2, 0, 0);
    return group;
  }

  // ชุดกล้องด้านหลัง (พิกัดจาก cameraLayout มองจากด้านหลัง → กลับซ้ายขวา) วางบนพื้นที่กว้าง W สูง H กึ่งกลางที่ (cx, cy)
  addCameras(group, W, H, backZ, cx, cy) {
    const T = this.T, p = this.phone;
    const L = cameraLayout(p);
    const X = (x) => cx - ((x - 3) / 114 - 0.5) * W;
    const Y = (y) => cy + (0.5 - (y - 3) / 234) * H;
    const S = (v) => (v / 114) * W;
    const plateD = L.plates.length ? 0.026 : 0;
    L.plates.forEach((pl) => {
      let m;
      if (pl.shape === "rect") {
        const g = new T.ExtrudeGeometry(roundedRectShape(T, S(pl.w), S(pl.h), S(pl.r)),
          { depth: plateD, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 4, curveSegments: 24 });
        m = new T.Mesh(g, this.mats.plate);
        m.position.set(X(pl.x + pl.w / 2), Y(pl.y + pl.h / 2), backZ);
        m.rotation.y = Math.PI;
      } else {
        m = new T.Mesh(new T.CylinderGeometry(S(pl.r), S(pl.r) + 0.004, plateD, 72), this.mats.ring);
        m.rotation.x = Math.PI / 2;
        m.position.set(X(pl.cx), Y(pl.cy), backZ - plateD / 2);
      }
      group.add(m);
    });
    const glass = new T.MeshPhysicalMaterial({ color: 0x050508, metalness: 0.3, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0 });
    const coat = new T.MeshPhysicalMaterial({ color: 0x0d1020, metalness: 0.5, roughness: 0.06, clearcoat: 1 });
    const sapphire = new T.MeshPhysicalMaterial({ color: 0xc8ccd8, metalness: 1, roughness: 0.15 });
    L.lenses.forEach(({ x, y, r }) => {
      const z = backZ - plateD;
      const parts = [
        [new T.CylinderGeometry(S(r + 2.2), S(r + 2.6), 0.03, 64), this.mats.ring, 0.015],
        [new T.CylinderGeometry(S(r), S(r), 0.034, 64), glass, 0.017],
        [new T.CylinderGeometry(S(r * 0.55), S(r * 0.55), 0.036, 48), coat, 0.018],
      ];
      parts.forEach(([geo, mat, dz]) => {
        const m = new T.Mesh(geo, mat);
        m.rotation.x = Math.PI / 2;
        m.position.set(X(x), Y(y), z - dz);
        group.add(m);
      });
      const ringIn = new T.Mesh(new T.TorusGeometry(S(r * 0.78), 0.0025, 8, 48), sapphire);
      ringIn.position.set(X(x), Y(y), z - 0.0345);
      group.add(ringIn);
    });
    const flashMat = new T.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff1cc, emissiveIntensity: 0.3, roughness: 0.3 });
    L.flashes.forEach(({ x, y }) => {
      const m = new T.Mesh(new T.CylinderGeometry(S(3.6), S(3.6), 0.012, 32), flashMat);
      m.rotation.x = Math.PI / 2;
      m.position.set(X(x), Y(y), backZ - plateD - 0.005);
      group.add(m);
    });
  }

  screenMaterial(map) {
    const m = new this.T.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.95, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 });
    (this.screenMats = this.screenMats || []).push(m);
    return m;
  }

  // ---------- มือถือจอพับ: แผ่นตัวเครื่องต่อกันด้วยบานพับ พับ/กางได้จริง ----------
  buildFoldable() {
    const T = this.T, p = this.phone, lin = this.lin, hex = this.colorHex;
    const type = this.foldType = foldType(p);
    // ขนาดอิงเครื่องจริง: Fold7 กาง 143×158×4.2 มม. พับ 8.9 มม. | Flip7 กาง 75×167×6.5 มม. | Mate XT กาง 219×157×3.6 มม.
    const H = 2.0;
    const ratio = type === "flip" ? 0.45 : /Pixel Fold$/.test(p.name) ? 0.57 : /Pixel .*Pro Fold/.test(p.name) ? 0.5 : 0.465;
    const w = H * ratio;
    const mm = H / (type === "flip" ? 167 : 158);
    const d = (type === "flip" ? 6.7 : type === "tri" ? 3.8 : 4.4) * mm;   // ความหนาแต่ละแผ่นตอนกาง
    const B = 0.008;
    const R = type === "flip" ? 0.12 : p.brand === "Samsung" ? 0.07 : 0.11;
    const bz = 0.025;   // ขอบจอ
    const premium = true;

    this.mats = {
      frame: new T.MeshPhysicalMaterial({ color: lin(this.frameHex(hex)), metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2 }),
      back: new T.MeshPhysicalMaterial({ color: lin(hex), metalness: 0, roughness: premium ? 0.5 : 0.2, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.55 }),
      plate: new T.MeshPhysicalMaterial({ color: lin(hex), metalness: 0.15, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.05, envMapIntensity: 0.7 }),
      ring: new T.MeshPhysicalMaterial({ color: lin(this.frameHex(hex)), metalness: 1, roughness: 0.18 }),
    };
    const blackGlass = new T.MeshPhysicalMaterial({ color: 0x030304, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 });
    const hingeMat = new T.MeshPhysicalMaterial({ color: lin(hexMix(this.frameHex(hex), "#3a3a3e", 0.35)), metalness: 0.85, roughness: 0.35 });

    const root = new T.Group();      // ผู้ใช้หมุนกลุ่มนี้
    const spin = new T.Group();      // หมุนโชว์ด้านจอนอกตอนพับ
    const rig = new T.Group();       // เลื่อนให้จุดศูนย์กลางอยู่กลางเครื่องเสมอ
    root.add(spin); spin.add(rig);
    this.foldParts = { type, w, H, d, spin, rig };

    // แผ่นตัวเครื่อง (z จาก -d ถึง 0 ด้านหน้าคือจอ)
    const slab = (parent, x0, x1, y0, y1, radii) => {
      const g = new T.ExtrudeGeometry(cornerRectShape(T, x1 - x0 - 2 * B, y1 - y0 - 2 * B, radii.map((r) => r - B)), {
        depth: d - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 6, curveSegments: 24,
      });
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, -d + B);
      parent.add(new T.Mesh(g, this.mats.frame));
    };
    // แผ่นหน้า/หลัง: back=true คือด้านหลัง (หมุนกลับด้าน → มุมซ้ายขวาสลับกัน)
    const face = (parent, x0, x1, y0, y1, radii, z, back, mat, uvFn) => {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, fw = x1 - x0, fh = y1 - y0;
      const rr = back ? [radii[1], radii[0], radii[3], radii[2]] : radii;
      const g = uvFn ? uvPlane(T, fw, fh, rr, (x, y) => uvFn(x, y, fw, fh, cx, cy)) : new T.ShapeGeometry(cornerRectShape(T, fw, fh, rr), 24);
      const m = new T.Mesh(g, mat);
      m.position.set(cx, cy, z);
      if (back) m.rotation.y = Math.PI;
      parent.add(m);
      return m;
    };
    // บานพับ: ครึ่งทรงกระบอกที่หมุนตามครึ่งมุมพับ → ตอนพับกลายเป็นสันโค้งด้านนอก
    const hinge = (parent, pos, axis, side, len) => {
      const g = new T.CylinderGeometry(d, d, len, 40, 1, false, side < 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI);
      const m = new T.Mesh(g, hingeMat);
      const pivot = new T.Group();
      pivot.position.set(...pos);
      if (axis === "x") m.rotation.z = Math.PI / 2;
      pivot.add(m); parent.add(pivot);
      return pivot;
    };
    const lens = (parent, x, y, z, r) => {
      const ring = new T.Mesh(new T.CylinderGeometry(r + 0.012, r + 0.014, 0.02, 48), this.mats.ring);
      const glass = new T.Mesh(new T.CylinderGeometry(r, r, 0.022, 48), new T.MeshPhysicalMaterial({ color: 0x050508, metalness: 0.3, roughness: 0.02, clearcoat: 1 }));
      const coat = new T.Mesh(new T.CylinderGeometry(r * 0.55, r * 0.55, 0.024, 32), new T.MeshPhysicalMaterial({ color: 0x0d1020, metalness: 0.5, roughness: 0.06, clearcoat: 1 }));
      [ring, glass, coat].forEach((m, i) => { m.rotation.x = Math.PI / 2; m.position.set(x, y, z - 0.01 - i * 0.001); parent.add(m); });
    };

    const osTex = this.os ? this.osTexture() : screenTexture(T, p, hex);
    const toOSDirect = (uv) => ({ x: uv.x, y: uv.y });
    const btn = (parent, x, y, h) => {
      const m = new T.Mesh(new T.BoxGeometry(0.02, h, d * 0.5), this.mats.frame);
      m.position.set(x, y, -d / 2); parent.add(m);
      return m;
    };
    this.innerScreens = []; this.coverScreens = [];

    if (type === "book" || type === "tri") {
      const n = type === "tri" ? 3 : 2;
      const totalW = n * w, X0 = -totalW / 2 + bz, Wt = totalW - 2 * bz, Y0 = -H / 2 + bz, Ht = H - 2 * bz;
      // จอใหญ่ด้านใน: วาดหน้าจอระบบไว้กลางจอกว้าง + พื้นหลังเบลอจากวอลเปเปอร์
      const inner = this.makeWideScreen(Wt / Ht);
      const innerMat = this.screenMaterial(inner.tex);
      const uvWide = (ox) => (x, y, fw, fh, cx, cy) => [(x + cx + ox - X0) / Wt, (y + cy - Y0) / Ht];
      const toOSWide = (uv) => inner.toOS(uv);
      const innerFace = (parent, x0, x1, ox, radii) => {
        const m = face(parent, x0, x1, -H / 2 + bz, H / 2 - bz, radii, 0.0022, false, innerMat, uvWide(ox));
        m.userData.toOS = toOSWide; this.innerScreens.push(m);
        face(parent, x0 - bz + 0.002, x1 + bz - 0.002, -H / 2 + 0.002, H / 2 - 0.002, radii, 0.0012, false, blackGlass);
        return m;
      };
      const r = R - bz;
      if (type === "book") {
        // แผ่นขวา (ยึดอยู่กับที่): จอในครึ่งขวา + ฝาหลังสี + กล้อง + ปุ่ม
        const right = new T.Group(); rig.add(right);
        slab(right, 0, w, -H / 2, H / 2, [0.01, R, R, 0.01]);
        innerFace(right, 0, w - bz, 0, [0, r, r, 0]);
        face(right, 0.004, w - 0.004, -H / 2 + 0.004, H / 2 - 0.004, [0.01, R, R, 0.01], -d - 0.0012, true, this.mats.back);
        this.addCameras(right, w, H, -d, w / 2, 0);
        btn(right, w + 0.006, 0.55, 0.3);
        this.powerBtn = btn(right, w + 0.006, 0.18, 0.16);
        // แผ่นซ้าย (หมุนรอบบานพับ): จอในครึ่งซ้าย + จอนอกด้านหลัง
        const left = new T.Group(); rig.add(left);
        slab(left, -w, 0, -H / 2, H / 2, [R, 0.01, 0.01, R]);
        innerFace(left, -w + bz, 0, 0, [r, 0, 0, r]);
        face(left, -w + 0.004, -0.004, -H / 2 + 0.004, H / 2 - 0.004, [R, 0.01, 0.01, R], -d - 0.0012, true, blackGlass);
        const cover = face(left, -w + bz, -bz, -H / 2 + bz * 1.6, H / 2 - bz * 1.6, [r, r, r, r], -d - 0.0022, true,
          this.screenMaterial(osTex), (x, y, fw, fh) => [x / fw + 0.5, y / fh + 0.5]);
        cover.userData.toOS = toOSDirect; this.coverScreens.push(cover);
        this.foldParts.left = left;
        this.foldParts.spineL = hinge(rig, [0, 0, 0], "y", -1, H - 0.03);
      } else {
        // สามทบ: แผ่นกลางยึดไว้, แผ่นขวาพับไปด้านหลัง (จอหันออก), แผ่นซ้ายพับมาทับด้านหน้า
        const mid = new T.Group(); rig.add(mid);
        slab(mid, -w / 2, w / 2, -H / 2, H / 2, [0.01, 0.01, 0.01, 0.01]);
        innerFace(mid, -w / 2, w / 2, 0, [0, 0, 0, 0]);
        face(mid, -w / 2 + 0.004, w / 2 - 0.004, -H / 2 + 0.004, H / 2 - 0.004, [0.01, 0.01, 0.01, 0.01], -d - 0.0012, true, this.mats.back);

        const rightPivot = new T.Group(); rightPivot.position.set(w / 2, 0, -d); rig.add(rightPivot);
        const right = new T.Group(); right.position.z = d; rightPivot.add(right);
        slab(right, 0, w, -H / 2, H / 2, [0.01, R, R, 0.01]);
        const innerR = innerFace(right, 0, w - bz, w / 2, [0, r, r, 0]);
        // ตอนพับเสร็จ แผ่นขวากลายเป็นจอโทรศัพท์ปกติ: ใช้ภาพหน้าจอเต็มแทนส่วนของจอกว้าง
        const cover = face(right, bz, w - bz, -H / 2 + bz, H / 2 - bz, [r, r, r, r], 0.0024, false,
          this.screenMaterial(osTex), (x, y, fw, fh) => [x / fw + 0.5, y / fh + 0.5]);
        cover.userData.toOS = toOSDirect; cover.visible = false; this.coverScreens.push(cover);
        face(right, 0.004, w - 0.004, -H / 2 + 0.004, H / 2 - 0.004, [0.01, R, R, 0.01], -d - 0.0012, true, this.mats.back);
        btn(right, w + 0.006, 0.55, 0.3);
        this.powerBtn = btn(right, w + 0.006, 0.18, 0.16);

        const leftPivot = new T.Group(); leftPivot.position.set(-w / 2, 0, 0); rig.add(leftPivot);
        slab(leftPivot, -w, 0, -H / 2, H / 2, [R, 0.01, 0.01, R]);
        innerFace(leftPivot, -w + bz, 0, -w / 2, [r, 0, 0, r]);
        face(leftPivot, -w + 0.004, -0.004, -H / 2 + 0.004, H / 2 - 0.004, [R, 0.01, 0.01, R], -d - 0.0012, true, this.mats.back);
        this.addCameras(leftPivot, w, H, -d, -w / 2, 0);

        Object.assign(this.foldParts, {
          left: leftPivot, right: rightPivot, innerR, coverR: cover,
          spineL: hinge(rig, [-w / 2, 0, 0], "y", -1, H - 0.03),
          spineR: hinge(rig, [w / 2, 0, -d], "y", 1, H - 0.03),
        });
      }
    } else {
      // Flip: แผ่นล่างยึดไว้ แผ่นบนพับลงมาทับ จอนอก + กล้องอยู่หลังแผ่นบน
      const Hh = H / 2, X0 = -w / 2 + bz, Wt = w - 2 * bz, Y0 = -H / 2 + bz, Ht = H - 2 * bz;
      const innerMat = this.screenMaterial(osTex);
      const uvTall = (x, y, fw, fh, cx, cy) => [(x + cx - X0) / Wt, (y + cy - Y0) / Ht];
      const r = R - bz;
      const bottom = new T.Group(); rig.add(bottom);
      slab(bottom, -w / 2, w / 2, -Hh, 0, [0.01, 0.01, R, R]);
      const ib = face(bottom, -w / 2 + bz, w / 2 - bz, -Hh + bz, 0, [0, 0, r, r], 0.0022, false, innerMat, uvTall);
      face(bottom, -w / 2 + 0.002, w / 2 - 0.002, -Hh + 0.002, 0, [0.01, 0.01, R, R], 0.0012, false, blackGlass);
      face(bottom, -w / 2 + 0.004, w / 2 - 0.004, -Hh + 0.004, -0.004, [0.01, 0.01, R, R], -d - 0.0012, true, this.mats.back);
      btn(bottom, w / 2 + 0.006, -0.22, 0.2);
      const top = new T.Group(); rig.add(top);
      slab(top, -w / 2, w / 2, 0, Hh, [R, R, 0.01, 0.01]);
      const it = face(top, -w / 2 + bz, w / 2 - bz, 0, Hh - bz, [r, r, 0, 0], 0.0022, false, innerMat, uvTall);
      face(top, -w / 2 + 0.002, w / 2 - 0.002, 0, Hh - 0.002, [R, R, 0.01, 0.01], 0.0012, false, blackGlass);
      [ib, it].forEach((m) => { m.userData.toOS = toOSDirect; this.innerScreens.push(m); });
      this.powerBtn = btn(top, w / 2 + 0.006, 0.2, 0.16);
      btn(top, w / 2 + 0.006, 0.5, 0.26);
      // ด้านหลังแผ่นบน: กระจกดำ + จอนอกเกือบเต็มแผ่น + กล้องคู่
      face(top, -w / 2 + 0.004, w / 2 - 0.004, 0.004, Hh - 0.004, [R, R, 0.01, 0.01], -d - 0.0012, true, blackGlass);
      const cw = w - 2 * bz, ch = Hh - 2 * bz;
      const coverTex = this.makeCoverScreen(cw / ch);
      const cover = face(top, -w / 2 + bz, w / 2 - bz, bz, Hh - bz, [r, r, 0.03, 0.03], -d - 0.0022, true,
        this.screenMaterial(coverTex.tex), (x, y, fw, fh) => [x / fw + 0.5, y / fh + 0.5]);
      cover.userData.toOS = coverTex.toOS; this.coverScreens.push(cover);
      // กล้องหลังมุมบน (มองจากหลังอยู่ซ้ายบน = พิกัดหน้าเครื่องขวาบน)
      lens(top, w / 2 - 0.17, Hh - 0.17, -d - 0.004, 0.065);
      lens(top, w / 2 - 0.36, Hh - 0.17, -d - 0.004, 0.065);
      Object.assign(this.foldParts, { top, spine: hinge(rig, [0, 0, 0], "x", -1, w - 0.03) });
    }

    this.screenMesh = this.innerScreens[0];
    this.foldLin = 0; this.foldTarget = 0;   // เริ่มแบบกางออก โชว์จอใหญ่
    this.applyFold(0);
    return root;
  }

  // จอกว้าง (Fold / สามทบ): หน้าจอระบบตรงกลาง + พื้นหลังเบลอ อัปเดตทุกครั้งที่หน้าจอระบบเปลี่ยน
  makeWideScreen(aspect) {
    const T = this.T;
    const c = document.createElement("canvas");
    c.height = 1300; c.width = Math.round(1300 * aspect);
    const small = document.createElement("canvas"); small.width = 8; small.height = 17;
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
    const src = this.os ? this.os.canvas : null;
    const off = (c.width - 600) / 2;
    const draw = () => {
      const g = c.getContext("2d");
      if (!src) { g.fillStyle = "#111"; g.fillRect(0, 0, c.width, c.height); return; }
      small.getContext("2d").drawImage(src, 0, 0, small.width, small.height);
      g.imageSmoothingEnabled = true;
      g.drawImage(small, 0, 0, c.width, c.height);
      g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(src, off, 0);
      tex.needsUpdate = true;
    };
    draw();
    (this.screenDraws = this.screenDraws || []).push(draw);
    const toOS = (uv) => {
      const x = (uv.x * c.width - off) / 600;
      return x >= 0 && x <= 1 ? { x, y: uv.y } : null;
    };
    return { tex, toOS };
  }

  // จอนอกของ Flip: ตัดส่วนบนของหน้าจอระบบ (นาฬิกา/วันที่) มาแสดง
  makeCoverScreen(aspect) {
    const T = this.T;
    const c = document.createElement("canvas");
    c.width = 600; c.height = Math.round(600 / aspect);
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
    const src = this.os ? this.os.canvas : null, sy = 40;
    const draw = () => {
      const g = c.getContext("2d");
      if (!src) { g.fillStyle = "#111"; g.fillRect(0, 0, c.width, c.height); return; }
      g.drawImage(src, 0, sy, 600, c.height, 0, 0, 600, c.height);
      tex.needsUpdate = true;
    };
    draw();
    (this.screenDraws = this.screenDraws || []).push(draw);
    const toOS = (uv) => ({ x: uv.x, y: 1 - ((1 - uv.y) * c.height + sy) / 1300 });
    return { tex, toOS };
  }

  // f = 0 กางออก, 1 พับสนิท
  applyFold(f) {
    const P = this.foldParts;
    if (!P) return;
    const { w, H, d } = P;
    let minX, maxX, halfH = H / 2;
    if (P.type === "book") {
      P.left.rotation.y = Math.PI * f;
      P.spineL.rotation.y = (Math.PI * f) / 2;
      minX = -w + (w - d) * f; maxX = w;
      P.rig.position.set(-(minX + maxX) / 2, 0, (d / 2) * (1 - f));
    } else if (P.type === "tri") {
      const f1 = easeInOut(clamp01(f * 2)), f2 = easeInOut(clamp01(f * 2 - 1));
      P.right.rotation.y = Math.PI * f1; P.spineR.rotation.y = (Math.PI * f1) / 2;
      P.left.rotation.y = Math.PI * f2; P.spineL.rotation.y = (Math.PI * f2) / 2;
      minX = -1.5 * w + (w - d) * f2; maxX = 1.5 * w - (w - d) * f1;
      P.rig.position.set(-(minX + maxX) / 2, 0, d / 2);
      P.spin.rotation.y = Math.PI * f1;          // หมุนให้จอนอกหันมาหาผู้ชม
      P.innerR.visible = f < 0.999; P.coverR.visible = f >= 0.999;
    } else {
      P.top.rotation.x = Math.PI * f;
      P.spine.rotation.x = (Math.PI * f) / 2;
      minX = -w / 2; maxX = w / 2;
      halfH = H / 2 - (H / 4 - d / 2) * f;
      P.rig.position.set(0, ((H / 2 - d) / 2) * f, (d / 2) * (1 - f));
      P.spin.rotation.z = Math.PI * easeInOut(clamp01((f - 0.6) / 0.4));   // ช่วงท้ายค่อยกลับหัว ให้กล้องอยู่ด้านบนแบบที่ถือจริง
    }
    this.folded = f >= 0.999;
    this.foldMoving = f > 0.001 && f < 0.999;
    // ถอยกล้องให้เห็นทั้งเครื่อง (จอกาง 3 แผ่นกว้างมาก)
    if (this.camera) {
      const t = Math.tan((this.camera.fov * Math.PI) / 360);
      const need = (Math.max(halfH, ((maxX - minX) / 2) / this.camera.aspect) * 1.4) / t;
      this.camera.position.z = Math.max(5.6, need);
    }
  }

  isFoldable() { return !!this.foldParts; }

  toggleFold() {
    if (!this.foldParts) return;
    this.foldTarget = this.foldTarget ? 0 : 1;
    this.foldT0 = performance.now();
    this.foldFrom = this.foldLin;
    if (this.onFold) this.onFold(this.foldTarget === 1);
  }

  stepFold(now) {
    if (!this.foldParts || this.foldLin === this.foldTarget) return;
    const dir = this.foldTarget > this.foldFrom ? 1 : -1;
    const lin = clamp01(this.foldFrom + (dir * (now - this.foldT0)) / FOLD_MS);
    this.foldLin = dir > 0 ? Math.min(lin, this.foldTarget) : Math.max(lin, this.foldTarget);
    this.applyFold(easeInOut(this.foldLin));
  }

  // จอที่แตะได้ตอนนี้: กาง = จอใน, พับ = จอนอก, ระหว่างพับ = ไม่มี
  activeScreens() {
    if (!this.foldParts) return this.screenMesh ? [this.screenMesh] : [];
    if (this.foldMoving) return [];
    return (this.folded ? this.coverScreens : this.innerScreens).filter((m) => m.visible);
  }

  screenHit(e) {
    const hit = this.hitTest(e, this.activeScreens());
    if (!hit || !hit.uv) return null;
    const map = hit.object.userData.toOS;
    return map ? map(hit.uv) : hit.uv;
  }

  // ---------- หน้าจอจำลอง ----------
  osTexture() {
    const tex = new this.T.CanvasTexture(this.os.canvas);
    tex.encoding = this.T.sRGBEncoding;
    tex.anisotropy = 8;
    this.screenTex = tex;
    return tex;
  }

  // โมเดลจริง: วางจอจำลองทับพื้นที่จอของโมเดล (วัดจากขนาดตัวเครื่อง)
  addScreenOverlay(group) {
    const T = this.T;
    group.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(group);
    const size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
    const fit = this.real.screen || { w: 0.905, h: 0.955, r: 0.115, dy: 0 };
    const map = this.osTexture();
    const m = new T.Mesh(roundedPlane(T, size.x * fit.w, size.y * fit.h, fit.r),
      new T.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.95, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }));
    m.position.set(center.x, center.y + (fit.dy || 0), box.max.z + 0.002);
    group.add(m);
    this.screenMesh = m;
  }

  togglePower() { if (this.os) this.os.togglePower(); }

  // หาจุดที่นิ้ว/เมาส์ชี้บนวัตถุ 3D (ใช้รู้ว่าแตะจอหรือกดปุ่มข้าง)
  hitTest(e, objects) {
    const list = objects.filter(Boolean);
    if (!list.length || !this.raycaster) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new this.T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(list, false)[0] || null;
  }

  // ---------- โมเดลจริง (.dae) ----------
  async buildRealModel(info) {
    const T = this.T;
    await loadScript(COLLADA_URL);
    const collada = await new Promise((resolve, reject) =>
      new T.ColladaLoader().load(info.dir + info.file, resolve, undefined, reject));
    const tl = new T.TextureLoader().setPath(info.dir + "textures/");
    const load = (file, srgb) => new Promise((resolve) => {
      const t = tl.load(file, () => resolve(t), undefined, () => resolve(t));
      if (srgb) t.encoding = T.sRGBEncoding;
      t.anisotropy = 8;
    });
    const [albedo, normal, rough, metal, ao, emis, alpha] = await Promise.all([
      load("Material_albedo.jpg", true), load("Material_normal.png"), load("Material_roughness.jpg"),
      load("Material_metallic.jpg"), load("Material_AO.jpg"), load("Material_emissive.jpg", true), load("Material_opacity.jpg"),
    ]);
    this.albedoImage = albedo.image;
    this.recolorCache = {};

    const mat = new T.MeshStandardMaterial({
      map: albedo, normalMap: normal, roughnessMap: rough, roughness: 1, metalnessMap: metal, metalness: 1,
      aoMap: ao, emissiveMap: emis, emissive: 0xffffff, emissiveIntensity: 1, alphaMap: alpha, transparent: true,
    });
    // ผสมพื้นผิวสองชุดใน shader เพื่อทำแอนิเมชันเปลี่ยนสีแบบไล่ระดับ
    this.mixUniforms = { map2: { value: albedo }, uMix: { value: 0 } };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.map2 = this.mixUniforms.map2;
      shader.uniforms.uMix = this.mixUniforms.uMix;
      shader.fragmentShader = "uniform sampler2D map2;\nuniform float uMix;\n" + shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          vec4 texelColor = mix( texture2D( map, vUv ), texture2D( map2, vUv ), uMix );
          texelColor = mapTexelToLinear( texelColor );
          diffuseColor *= texelColor;
        #endif`);
    };
    this.realMat = mat;

    const root = collada.scene;
    const extras = [];
    root.traverse((o) => {
      if (o.isLight || o.isCamera) extras.push(o);
      if (o.isMesh) {
        o.material = mat;
        const g = o.geometry;
        if (g.attributes.uv && !g.attributes.uv2) g.setAttribute("uv2", g.attributes.uv);
      }
    });
    extras.forEach((o) => o.parent && o.parent.remove(o));

    const pivot = new T.Group();
    pivot.add(root);
    root.rotation.set(...info.rotation);
    root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(root);
    const size = box.getSize(new T.Vector3());
    root.position.sub(box.getCenter(new T.Vector3()));
    pivot.scale.setScalar(2.0 / Math.max(size.x, size.y, size.z));
    const group = new T.Group();
    group.add(pivot);
    return group;
  }

  // สร้างพื้นผิวสีใหม่: เปลี่ยนเฉพาะพิกเซลตัวเครื่อง (สีเทาไม่อิ่มตัว) โดยรักษาแสงเงาเดิม ไม่แตะเลนส์ จอ และโลโก้
  recoloredTexture(hex) {
    if (this.recolorCache[hex]) return this.recolorCache[hex];
    const img = this.albedoImage;
    const size = 2048;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, size, size);
    const data = g.getImageData(0, 0, size, size);
    const d = data.data;
    const [tr, tg, tb] = hexToRgb(hex);
    const BASE = 0.3;                         // ความสว่างเฉลี่ยของตัวเครื่องต้นฉบับ (Space Black)
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
      const v = max / 255, sat = max ? (max - min) / max : 0;
      if (sat > 0.16 || v < 0.12 || v > 0.62) continue;
      // น้ำหนักการเปลี่ยนสี ค่อยๆ ลดลงใกล้ขอบเงื่อนไข เพื่อไม่ให้เห็นรอยต่อ
      const w = Math.min(1, (0.16 - sat) / 0.06) * Math.min(1, (v - 0.12) / 0.05) * Math.min(1, (0.62 - v) / 0.08);
      const k = Math.max(0.78, Math.min(1.12, v / BASE));   // รักษาแสงเงาเดิมแต่ไม่ให้สีอ่อนกลายเป็นขาว
      d[i] = r + (Math.min(255, tr * k) - r) * w;
      d[i + 1] = gg + (Math.min(255, tg * k) - gg) * w;
      d[i + 2] = b + (Math.min(255, tb * k) - b) * w;
    }
    g.putImageData(data, 0, 0);
    const tex = new this.T.CanvasTexture(c);
    tex.encoding = this.T.sRGBEncoding;
    tex.anisotropy = 8;
    tex.flipY = this.realMat.map.flipY;
    this.recolorCache[hex] = tex;
    return tex;
  }

  // ---------- เปลี่ยนสีพร้อมแอนิเมชัน ----------
  setColor(hex, name) {
    if (!this.group || hex === this.colorHex) return;
    this.colorHex = hex; this.colorName = name;
    if (this.os) this.os.setAccent(hex);   // วอลเปเปอร์เปลี่ยนตามสีเครื่อง (แบบที่ผู้ผลิตทำ)
    const now = performance.now();
    if (this.real && this.realMat) {
      const isBase = name === this.real.baseColor;
      const tex = isBase ? this.realMat.userData.baseMap || this.realMat.map : this.recoloredTexture(hex);
      if (!this.realMat.userData.baseMap) this.realMat.userData.baseMap = this.realMat.map;
      this.mixUniforms.map2.value = tex;
      this.mixUniforms.uMix.value = 0;
      this.tween = { t0: now, real: true, tex };
    } else {
      const T = this.T;
      const pick = (m) => ({ mat: m, from: m.color.clone() });
      this.tween = {
        t0: now,
        parts: [
          { ...pick(this.mats.back), to: this.lin(hex) },
          { ...pick(this.mats.plate), to: this.lin(hex) },
          { ...pick(this.mats.frame), to: this.lin(this.frameHex(hex)) },
          { ...pick(this.mats.ring), to: this.lin(this.frameHex(hex)) },
        ],
      };
      void T;
    }
  }

  stepTween(now) {
    const tw = this.tween;
    if (!tw) return;
    const t = Math.min(1, (now - tw.t0) / COLOR_ANIM_MS);
    const e = easeInOut(t);
    if (tw.real) this.mixUniforms.uMix.value = e;
    else tw.parts.forEach((p) => p.mat.color.copy(p.from).lerp(p.to, e));
    // แสงกวาดจากซ้ายไปขวาด้านที่หันหาผู้ชม + ตัวเครื่องขยายขึ้นเล็กน้อยแล้วกลับ
    const bell = Math.sin(Math.PI * t);
    this.sweep.intensity = 2.2 * bell;
    this.sweep.position.set(-2 + 4 * e, 0.6 - 0.8 * e, 1.6);
    this.group.scale.setScalar(1 + 0.03 * bell);
    if (t >= 1) {
      if (tw.real) { this.realMat.map = tw.tex; this.mixUniforms.uMix.value = 0; }
      this.sweep.intensity = 0;
      this.group.scale.setScalar(1);
      this.tween = null;
    }
  }

  bindControls() {
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";
    // นิ้วเดียว/เมาส์ = หมุน, สองนิ้ว = ถ่างเพื่อซูม, ลูกกลิ้ง = ซูม
    const pts = new Map();
    let pinchDist = 0;
    const zoomTo = (z) => { this.camera.position.z = Math.max(3.8, Math.min(12, z)); };
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

    el.addEventListener("pointerdown", (e) => {
      if (this.os && pts.size === 0) {
        // กดปุ่มข้างบนโมเดล = เปิด/ปิดจอ
        if (this.hitTest(e, [this.powerBtn])) { this.os.togglePower(); return; }
        // แตะบนจอที่เปิดอยู่ = ปัดหน้าจอ (ไม่หมุนเครื่อง)
        const uv = this.screenHit(e);
        if (uv && this.os.state !== "off") {
          this.screenPointer = e.pointerId;
          el.setPointerCapture(e.pointerId);
          this.os.pointerDown(uv.x, uv.y);
          el.style.cursor = "grabbing";
          return;
        }
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      this.target = null; this.dragging = true;
      this.vel.x = this.vel.y = 0;
      el.style.cursor = "grabbing";
      if (pts.size === 2) pinchDist = dist();
    });
    el.addEventListener("pointermove", (e) => {
      if (this.screenPointer === e.pointerId) {
        const uv = this.screenHit(e);
        if (uv) this.os.pointerMove(uv.x, uv.y);
        return;
      }
      // เอาเมาส์ชี้จอ/ปุ่มข้าง → เปลี่ยนเคอร์เซอร์ให้รู้ว่ากดได้
      if (this.os && pts.size === 0 && e.pointerType === "mouse") {
        el.style.cursor = this.hitTest(e, [this.powerBtn]) ? "pointer" : this.screenHit(e) && this.os.state !== "off" ? "ew-resize" : "grab";
      }
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pts.set(e.pointerId, cur);
      if (pts.size >= 2) {
        const d = dist();
        if (pinchDist) zoomTo(this.camera.position.z * (pinchDist / d));
        pinchDist = d;
        return;
      }
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      this.vel.y = dx * 0.01; this.vel.x = dy * 0.01;
      this.group.rotation.y += this.vel.y;
      this.group.rotation.x = Math.max(-0.9, Math.min(0.9, this.group.rotation.x + this.vel.x));
    });
    const up = (e) => {
      if (this.screenPointer === e.pointerId) {
        this.screenPointer = null;
        this.os.pointerUp();
        el.style.cursor = "grab";
        return;
      }
      pts.delete(e.pointerId);
      if (pts.size < 2) pinchDist = 0;
      if (pts.size === 0) { this.dragging = false; el.style.cursor = "grab"; }
      else this.vel.x = this.vel.y = 0;
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomTo(this.camera.position.z + e.deltaY * 0.004);
    }, { passive: false });
  }

  resize() {
    if (!this.renderer) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.foldParts) this.applyFold(easeInOut(this.foldLin));
  }

  loop(now) {
    if (this.disposed) return;
    const r = this.group.rotation;
    if (!this.dragging) {
      // แรงเฉื่อยหลังปล่อยนิ้ว (หมุนต่ออีกนิดแล้วหยุดเอง)
      r.y += this.vel.y; this.vel.y *= 0.92;
      this.vel.x *= 0.85;
    }
    const t = now || performance.now();
    this.stepTween(t);
    this.stepFold(t);
    if (this.os && this.screenMesh) {
      if (this.os.update(t)) {
        this.screenTex.needsUpdate = true;
        (this.screenDraws || []).forEach((fn) => fn());
      }
      // จอดับ = กระจกดำสะท้อนแสง
      (this.screenMats || [this.screenMesh.material]).forEach((m) => (m.emissiveIntensity = 0.95 * this.os.brightness));
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.resizeObs) this.resizeObs.disconnect();
    if (!this.renderer) return;
    const seen = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m && !seen.has(m)) {
        seen.add(m);
        ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"].forEach((k) => m[k] && m[k].dispose());
        m.dispose();
      }
    });
    Object.values(this.recolorCache || {}).forEach((t) => t.dispose());
    if (this.scene.environment) this.scene.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
