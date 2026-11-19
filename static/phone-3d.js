// โมเดลมือถือ 3 มิติ (three.js) — สร้างด้วยโค้ดจากสเปกของแต่ละรุ่น: สีตัวเครื่อง, ตำแหน่งกล้องตามสไตล์แบรนด์
// (ใช้ cameraLayout() เดียวกับรูป 2D), ความหนา, จอ และปุ่มด้านข้าง ไม่ได้ใช้ไฟล์โมเดลของผู้ผลิต
// โหลด three.js เฉพาะตอนเปิดหน้ารายละเอียด เพื่อให้หน้าแรกเปิดเร็ว

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const COLLADA_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/ColladaLoader.js";
let threeLoading = null;

// รุ่นที่มีโมเดล 3D จริง (ไฟล์อยู่ใน static/models/) — รุ่นอื่นใช้โมเดลที่สร้างจากสเปก
// key = id ของรุ่น | rotation = หมุนโมเดลให้หน้าจอหันเข้าหากล้อง | credit = ผู้สร้างและสัญญาอนุญาต (ต้องแสดงตาม CC BY)
const REAL_MODELS = {
  "apple-apple-iphone-14-pro": {
    dir: "models/iphone-14-pro/", file: "model.dae", rotation: [0, Math.PI, 0],
    credit: {
      title: "iPhone 14 Pro", author: "mister dude",
      url: "https://sketchfab.com/3d-models/iphone-14-pro-5cb0778041a34f09b409a38c687bb1d4",
      license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
};

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

function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (!threeLoading) {
    threeLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = THREE_URL;
      s.onload = () => resolve(window.THREE);
      s.onerror = () => { threeLoading = null; reject(new Error("โหลด three.js ไม่สำเร็จ")); };
      document.head.appendChild(s);
    });
  }
  return threeLoading;
}

function roundedRectShape(T, w, h, r) {
  const s = new T.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ภาพบนหน้าจอ: วอลเปเปอร์ไล่สีตามสีเครื่อง + นาฬิกา + กล้องหน้า
function screenTexture(T, p) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 1050;
  const g = c.getContext("2d");
  const color = (p.specs && p.specs.color) || "#8e8e93";
  const bg = g.createLinearGradient(0, 0, 512, 1050);
  bg.addColorStop(0, shade(color, 0.25));
  bg.addColorStop(0.55, shade(color, -0.35));
  bg.addColorStop(1, "#05050a");
  g.fillStyle = bg; g.fillRect(0, 0, 512, 1050);
  // วงแสงตกแต่ง
  const glow = g.createRadialGradient(380, 300, 10, 380, 300, 380);
  glow.addColorStop(0, "rgba(255,255,255,.35)"); glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow; g.fillRect(0, 0, 512, 1050);
  // นาฬิกา
  g.fillStyle = "rgba(255,255,255,.95)";
  g.textAlign = "center";
  g.font = "600 150px -apple-system, 'Segoe UI', sans-serif";
  g.fillText("9:41", 256, 330);
  g.font = "500 34px -apple-system, 'Segoe UI', 'Noto Sans Thai', sans-serif";
  g.fillText(p.name, 256, 400);
  // กล้องหน้า: Dynamic Island (iPhone รุ่นใหม่) หรือรูเจาะกลางจอ
  g.fillStyle = "#000";
  if (p.brand === "Apple" && !/1[34]$|1[34] (Plus|mini)|16e/.test(p.name)) {
    g.beginPath(); g.roundRect ? g.roundRect(186, 34, 140, 40, 20) : g.rect(186, 34, 140, 40); g.fill();
  } else if (p.brand === "Apple") {
    g.beginPath(); g.roundRect ? g.roundRect(150, 0, 212, 52, 26) : g.rect(150, 0, 212, 52); g.fill();
  } else {
    g.beginPath(); g.arc(256, 54, 17, 0, Math.PI * 2); g.fill();
  }
  const tex = new T.CanvasTexture(c);
  tex.encoding = T.sRGBEncoding;
  tex.anisotropy = 4;
  return tex;
}

// แสงสะท้อนบนตัวเครื่อง: ใช้ภาพไล่สีแทนห้องสตูดิโอ
function studioEnvironment(T, renderer) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, "#ffffff"); sky.addColorStop(0.45, "#9aa0a8"); sky.addColorStop(1, "#16161a");
  g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "rgba(255,255,255,.9)";
  g.fillRect(60, 40, 70, 120); g.fillRect(330, 30, 120, 60);  // ไฟสตูดิโอ
  const tex = new T.CanvasTexture(c);
  tex.mapping = T.EquirectangularReflectionMapping;
  tex.encoding = T.sRGBEncoding;
  const pmrem = new T.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

class Phone3DViewer {
  constructor(container, phone) {
    this.container = container;
    this.phone = phone;
    this.auto = false;      // ไม่หมุนเอง: ผู้ใช้หมุนด้วยนิ้วหรือเมาส์เท่านั้น
    this.credit = null;
    this.vel = { x: 0, y: 0 };
    this.target = null;   // มุมที่จะหมุนไปหา (ปุ่มด้านหน้า/หลัง)
    this.disposed = false;
  }

  async start() {
    const T = await loadThree();
    if (this.disposed) return;
    this.T = T;
    const { width, height } = this.container.getBoundingClientRect();

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;
    this.container.appendChild(renderer.domElement);

    const scene = new T.Scene();
    scene.environment = studioEnvironment(T, renderer);
    this.scene = scene;

    const camera = new T.PerspectiveCamera(30, width / height, 0.1, 50);
    camera.position.set(0, 0, 5.4);
    this.camera = camera;

    scene.add(new T.HemisphereLight(0xffffff, 0x333340, 0.55));
    const key = new T.DirectionalLight(0xffffff, 0.9); key.position.set(3, 4, 5); scene.add(key);
    const fill = new T.DirectionalLight(0xffffff, 0.45); fill.position.set(-4, -1, 3); scene.add(fill);
    const rim = new T.DirectionalLight(0xffffff, 0.7); rim.position.set(0, 3, -5); scene.add(rim);

    // ใช้โมเดลจริงถ้ามี ไม่งั้นสร้างจากสเปก
    const real = REAL_MODELS[this.phone.id];
    this.group = null;
    if (real) {
      try {
        this.group = await this.buildRealModel(real);
        this.credit = real.credit;
      } catch (e) {
        console.warn("โหลดโมเดลจริงไม่สำเร็จ ใช้โมเดลจำลองแทน", e);
      }
      if (this.disposed) return;
    }
    if (!this.group) this.group = this.buildPhone();
    // ท่าเริ่มต้น: ด้านหน้าเอียงเล็กน้อย แล้วอยู่นิ่ง จนกว่าผู้ใช้จะลากหมุน
    this.group.rotation.set(0.06, -0.35, 0);
    scene.add(this.group);

    this.bindControls();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.container);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  buildPhone() {
    const T = this.T, p = this.phone, s = p.specs || {};
    const hex = s.color || "#8e8e93";
    const lin = (c) => new T.Color(c).convertSRGBToLinear();
    const foldable = /จอพับ/.test(s.panel || "");

    const H = 2.0, W = H * 114 / 234;
    const D = foldable ? 0.13 : 0.09;          // ความหนา
    const R = 0.16, B = 0.028;                  // รัศมีมุม, ขอบมน
    const group = new T.Group();

    const bodyMat = new T.MeshPhysicalMaterial({
      color: lin(hex), metalness: 0.35, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.9,
    });
    const bodyGeo = new T.ExtrudeGeometry(roundedRectShape(T, W - 2 * B, H - 2 * B, R), {
      depth: D - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 8, curveSegments: 32,
    });
    bodyGeo.center();
    group.add(new T.Mesh(bodyGeo, bodyMat));

    // หน้าจอ
    const sw = W - 0.05, sh = H - 0.05;
    const screenGeo = new T.ShapeGeometry(roundedRectShape(T, sw, sh, R - 0.02), 32);
    const uv = screenGeo.attributes.uv, pos = screenGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / sw + 0.5, pos.getY(i) / sh + 0.5);
    const screen = new T.Mesh(screenGeo, new T.MeshPhysicalMaterial({
      map: screenTexture(T, p), roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
      emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0,
    }));
    screen.material.emissiveMap = screen.material.map;
    screen.material.emissiveIntensity = 0.55;   // ให้จอดูสว่างเหมือนเปิดอยู่
    screen.position.z = D / 2 + 0.002;
    group.add(screen);

    // ปุ่มด้านข้าง
    const btnMat = new T.MeshStandardMaterial({ color: lin(hex), metalness: 0.6, roughness: 0.3 });
    const btn = (x, y, h) => {
      const m = new T.Mesh(new T.BoxGeometry(0.03, h, 0.035), btnMat);
      m.position.set(x, y, 0); group.add(m);
    };
    if (p.brand === "Apple") { btn(W / 2, 0.42, 0.22); btn(-W / 2, 0.55, 0.16); btn(-W / 2, 0.33, 0.16); }
    else { btn(W / 2, 0.55, 0.32); btn(W / 2, 0.18, 0.14); }

    // ชุดกล้องด้านหลัง (พิกัดจาก cameraLayout มองจากด้านหลัง → กลับซ้ายขวา)
    const L = cameraLayout(p);
    const X = (x) => -((x - 3) / 114 - 0.5) * W;
    const Y = (y) => (0.5 - (y - 3) / 234) * H;
    const S = (v) => (v / 114) * W;
    const back = -D / 2;
    const plateCol = isLight(hex) ? shade(hex, -0.08) : shade(hex, 0.1);
    const plateMat = new T.MeshPhysicalMaterial({ color: lin(rgbToHex(plateCol)), metalness: 0.4, roughness: 0.25, clearcoat: 1 });
    const plateD = L.plates.length ? 0.022 : 0;

    L.plates.forEach((pl) => {
      let m;
      if (pl.shape === "rect") {
        const g = new T.ExtrudeGeometry(roundedRectShape(T, S(pl.w), S(pl.h), Math.min(S(pl.r), S(pl.w) / 2, S(pl.h) / 2) * 0.98),
          { depth: plateD, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 3, curveSegments: 24 });
        m = new T.Mesh(g, plateMat);
        m.position.set(X(pl.x + pl.w / 2), Y(pl.y + pl.h / 2), back);
        m.rotation.y = Math.PI;   // ยื่นออกทางด้านหลัง
      } else {
        m = new T.Mesh(new T.CylinderGeometry(S(pl.r), S(pl.r), plateD, 64), plateMat);
        m.rotation.x = Math.PI / 2;
        m.position.set(X(pl.cx), Y(pl.cy), back - plateD / 2);
      }
      group.add(m);
    });

    const ringMat = new T.MeshStandardMaterial({ color: 0x9a9aa2, metalness: 0.95, roughness: 0.25 });
    const glassMat = new T.MeshPhysicalMaterial({ color: 0x050508, metalness: 0.2, roughness: 0.02, clearcoat: 1 });
    const coatMat = new T.MeshPhysicalMaterial({ color: 0x1c2440, metalness: 0.5, roughness: 0.1, clearcoat: 1 });
    L.lenses.forEach(({ x, y, r }) => {
      const z = back - plateD;
      const ring = new T.Mesh(new T.CylinderGeometry(S(r + 2), S(r + 2), 0.035, 48), ringMat);
      const glass = new T.Mesh(new T.CylinderGeometry(S(r), S(r), 0.04, 48), glassMat);
      const inner = new T.Mesh(new T.CylinderGeometry(S(r * 0.5), S(r * 0.5), 0.042, 32), coatMat);
      [ring, glass, inner].forEach((m, i) => {
        m.rotation.x = Math.PI / 2;
        m.position.set(X(x), Y(y), z - 0.017 - i * 0.002);
        group.add(m);
      });
    });
    const flashMat = new T.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff1cc, emissiveIntensity: 0.35, roughness: 0.4 });
    L.flashes.forEach(({ x, y }) => {
      const m = new T.Mesh(new T.CylinderGeometry(S(3.4), S(3.4), 0.012, 24), flashMat);
      m.rotation.x = Math.PI / 2;
      m.position.set(X(x), Y(y), back - plateD - 0.004);
      group.add(m);
    });
    return group;
  }

  // โหลดโมเดลจริง (Collada .dae) แล้วใส่พื้นผิว PBR: สี, normal, roughness, metallic, AO, จอเรืองแสง, ความโปร่งใส
  async buildRealModel(info) {
    const T = this.T;
    await loadScript(COLLADA_URL);
    const collada = await new Promise((resolve, reject) =>
      new T.ColladaLoader().load(info.dir + info.file, resolve, undefined, reject));
    const tl = new T.TextureLoader().setPath(info.dir + "textures/");
    const tex = (file, srgb) => {
      const t = tl.load(file);
      if (srgb) t.encoding = T.sRGBEncoding;
      t.anisotropy = 8;
      return t;
    };
    const mat = new T.MeshStandardMaterial({
      map: tex("Material_albedo.jpg", true),
      normalMap: tex("Material_normal.png"),
      roughnessMap: tex("Material_roughness.jpg"), roughness: 1,
      metalnessMap: tex("Material_metallic.jpg"), metalness: 1,
      aoMap: tex("Material_AO.jpg"),
      emissiveMap: tex("Material_emissive.jpg", true), emissive: 0xffffff, emissiveIntensity: 1,
      alphaMap: tex("Material_opacity.jpg"), transparent: true,
      envMapIntensity: 1,
    });
    const root = collada.scene;
    const lights = [];
    root.traverse((o) => {
      if (o.isLight || o.isCamera) lights.push(o);
      if (o.isMesh) {
        o.material = mat;
        const g = o.geometry;
        if (g.attributes.uv && !g.attributes.uv2) g.setAttribute("uv2", g.attributes.uv);  // ให้ AO map ทำงาน
      }
    });
    lights.forEach((o) => o.parent && o.parent.remove(o));

    // จัดให้อยู่กลางจอและสูง 2 หน่วย เท่ากับโมเดลจำลอง
    const pivot = new T.Group();
    pivot.add(root);
    root.rotation.set(...info.rotation);
    root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(root);
    const size = box.getSize(new T.Vector3());
    const center = box.getCenter(new T.Vector3());
    root.position.sub(center);
    pivot.scale.setScalar(2.0 / Math.max(size.x, size.y, size.z));
    const group = new T.Group();
    group.add(pivot);
    return group;
  }

  bindControls() {
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";
    let last = null;
    el.addEventListener("pointerdown", (e) => {
      last = { x: e.clientX, y: e.clientY };
      this.auto = false; this.target = null; this.dragging = true;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
      this.autoAfterIntro = false;
      this.onUserRotate && this.onUserRotate();
    });
    el.addEventListener("pointermove", (e) => {
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      this.vel.y = dx * 0.01; this.vel.x = dy * 0.01;
      this.group.rotation.y += this.vel.y;
      this.group.rotation.x = Math.max(-0.9, Math.min(0.9, this.group.rotation.x + this.vel.x));
    });
    const up = () => { last = null; this.dragging = false; el.style.cursor = "grab"; };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.camera.position.z = Math.max(3.6, Math.min(8, this.camera.position.z + e.deltaY * 0.004));
    }, { passive: false });
    el.addEventListener("dblclick", () => this.face("back"));
  }

  face(side) {
    this.auto = false;
    const base = Math.round(this.group.rotation.y / (2 * Math.PI)) * 2 * Math.PI;
    this.target = { x: 0.08, y: base + (side === "back" ? Math.PI - 0.35 : 0.35) };
  }

  setAuto(on) { this.auto = on; if (on) this.target = null; }

  resize() {
    if (!this.renderer) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  loop() {
    if (this.disposed) return;
    const r = this.group.rotation;
    if (this.target) {
      r.x += (this.target.x - r.x) * 0.08;
      r.y += (this.target.y - r.y) * 0.08;
      if (Math.abs(this.target.y - r.y) < 0.002) { this.target = null; if (this.autoAfterIntro) { this.auto = true; this.autoAfterIntro = false; } }
    } else if (this.auto) {
      r.y += 0.006;
      r.x += (0.12 - r.x) * 0.02;
    } else if (!this.dragging) {
      // แรงเฉื่อยหลังปล่อยนิ้ว (หมุนต่ออีกนิดแล้วหยุดเอง)
      r.y += this.vel.y; this.vel.y *= 0.92;
      this.vel.x *= 0.85;
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.resizeObs) this.resizeObs.disconnect();
    if (!this.renderer) return;
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"].forEach((k) => o.material[k] && o.material[k].dispose());
        o.material.dispose();
      }
    });
    if (this.scene.environment) this.scene.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function rgbToHex(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
