// แอนิเมชันแบบโฆษณาเปิดตัวมือถือ (ขยับตามการเลื่อนจอ)
//  1) ชิ้นส่วน (กรอบ ฝาหลัง จอ กล้อง ปุ่ม ฯลฯ) ลอยเข้ามาจากรอบทิศ หมุนคว้างแล้วเข้าล็อกทีละชิ้น ขณะตัวเครื่องหมุน
//  2) ประกอบเสร็จ: เครื่องแรกหันหลังเลื่อนไปซ้าย เครื่องที่สองโผล่จากด้านหลังไปขวาโชว์หน้าจอ
//  3) ชื่อรุ่นค่อยๆ ขึ้นทีละตัวอักษร
// ใช้โมเดล 3 มิติตัวเดียวกับหน้ารายละเอียด (Phone3DViewer.buildPhone) แยกเป็นชิ้นๆ

const ASSEMBLE_ID = "apple-apple-iphone-18-pro-max";
const ASSEMBLE_MODEL = "models/iphone-18-pro-max/model.glb";
const GLTF_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";

(function () {
  const sec = document.getElementById("assemble");
  if (!sec) return;
  const aClamp = (x) => Math.max(0, Math.min(1, x));
  const aEase = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const aOut = (t) => 1 - Math.pow(1 - t, 4);
  const span = (p, a, b) => aClamp((p - a) / (b - a));
  // สุ่มแบบคงที่ (ทุกครั้งที่เปิดหน้าได้ท่าเดิม)
  const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const waitFor = (fn) => new Promise((res) => { const t = setInterval(() => { if (fn()) { clearInterval(t); res(); } }, 100); });
  const near = () => new Promise((res) => {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); res(); } }, { rootMargin: "800px 0px" });
    io.observe(sec);
  });

  async function start() {
    await near();
    await waitFor(() => typeof meta !== "undefined" && meta);
    let T, p;
    try { [T, p] = await Promise.all([loadThree(), api.phone(ASSEMBLE_ID)]); } catch (e) { sec.hidden = true; return; }

    // สีขาว/เงินแบบภาพโฆษณา (ถ้ารุ่นนี้มี)
    const light = (p.colors || []).find((c) => isLight(c.hex)) || (p.colors || [])[0];
    const g = meta.groups.find((x) => x.members.some((m) => m.slug === p.brandSlug));
    p.logoFile = g && g.logo && g.members[0].slug === p.brandSlug ? g.logo : null;

    const canvas = document.getElementById("assembleCanvas");
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    const scene = new T.Scene();
    scene.environment = studioEnvironment(T, renderer);
    const camera = new T.PerspectiveCamera(26, 1, 0.1, 80);
    scene.add(new T.HemisphereLight(0xffffff, 0x2a2a33, 0.5));
    const key = new T.DirectionalLight(0xffffff, 0.9); key.position.set(3, 4, 6); scene.add(key);
    const rim = new T.DirectionalLight(0xdfe8ff, 0.7); rim.position.set(-4, 2, -4); scene.add(rim);
    const soft = new T.DirectionalLight(0xffffff, 0.55); soft.position.set(-2, 1, 5); scene.add(soft);   // ไฟหน้าให้สีตัวเครื่องชัด
    // แสงวาบตอนชิ้นส่วนเข้าล็อก
    const flash = new T.PointLight(0x9fc4ff, 0, 6, 2); flash.position.set(0, 0, 2); scene.add(flash);

    const makeViewer = (withOS) => {
      const v = new Phone3DViewer(document.createElement("div"), p);
      v.T = T; v.lin = (c) => new T.Color(c).convertSRGBToLinear();
      // โทนขาว-เงินแบบภาพโฆษณา (ถ้ารุ่นนี้ไม่มีสีอ่อน ใช้สีเงิน)
      v.colorHex = light && isLight(light.hex) ? light.hex : "#e4e4e7";
      v.os = null;
      if (withOS && typeof PhoneOS !== "undefined") { try { v.os = new PhoneOS(p, v.colorHex); v.os.state = "lock"; } catch (e) { v.os = null; } }
      return v;
    };

    // โมเดลจริงของรุ่นนี้ (GLB แยกเป็นชิ้นส่วนตามจริง: กรอบ ฝาหลัง จอ เลนส์ ปุ่ม น็อต ฯลฯ)
    // คืนค่า { wrap, inner, s } — wrap จัดขนาดให้สูง 2 หน่วย หน้าจอหัน +z และอยู่กึ่งกลาง
    const loadRealModel = async () => {
      await loadScript(GLTF_URL);
      const gltf = await new Promise((res, rej) => new T.GLTFLoader().load(ASSEMBLE_MODEL, res, undefined, rej));
      const inner = gltf.scene;
      // ตัดชิ้นช่วยเรนเดอร์ที่ไม่ใช่ชิ้นส่วนจริง (แผ่นสะท้อนแสงแฟลชที่ลอยอยู่นอกตัวเครื่อง)
      ["Back_Flash_Ref", "Gradient"].forEach((n) => { const o = inner.getObjectByName(n); if (o && o.parent) o.parent.remove(o); });
      // ให้แต่ละชิ้นหมุนรอบจุดกึ่งกลางของตัวเอง (ตอนลอยเข้ามาจะดูเป็นชิ้นส่วนจริง)
      inner.updateMatrixWorld(true);
      inner.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry = o.geometry.clone();
        o.geometry.computeBoundingBox();
        const c = o.geometry.boundingBox.getCenter(new T.Vector3());
        o.geometry.translate(-c.x, -c.y, -c.z);
        o.position.add(c.applyEuler(o.rotation).multiply(o.scale));
        if (o.material) { o.material.envMapIntensity = 1.1; }
      });
      const box = new T.Box3().setFromObject(inner);
      const size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
      const s = 2 / size.y;
      const wrap = new T.Group();
      const holder = new T.Group();
      holder.add(inner);
      holder.scale.setScalar(s);
      holder.position.set(-center.x * s, -center.y * s, -center.z * s);
      wrap.add(holder);
      // หาด้านจอ: ถ้าจออยู่ฝั่ง -z ให้หมุนกลับ
      const find = (name) => inner.getObjectByName(name);
      const scr = find("Front_Screen"), back = find("Back_Panel");
      if (scr && back) {
        const zs = new T.Box3().setFromObject(scr).getCenter(new T.Vector3()).z;
        const zb = new T.Box3().setFromObject(back).getCenter(new T.Vector3()).z;
        if (zs < zb) wrap.rotation.y = Math.PI;
      }
      const face = new T.Group(); face.add(wrap);
      return { wrap: face, inner, s };
    };

    let A, B, vB = null, real = null, partRoot, unit = 1;
    try {
      real = await loadRealModel();
      A = real.wrap;
      B = A.clone(true);
      partRoot = real.inner; unit = real.s;
    } catch (e) {
      console.warn("โหลดโมเดลจริงไม่สำเร็จ ใช้โมเดลจำลองแทน", e);
      try { await loadOSIcons(); } catch (e2) { /* ไม่มีไอคอนก็ใช้ภาพหน้าจอธรรมดา */ }
      const vA = makeViewer(false); vB = makeViewer(true);
      A = vA.buildPhone(); B = vB.buildPhone();
      partRoot = A;
    }
    const rigA = new T.Group(), rigB = new T.Group();
    rigA.add(A); rigB.add(B); scene.add(rigA); scene.add(rigB);
    B.visible = false;

    // ชิ้นส่วน: ลำดับเข้าประกอบ = กรอบข้าง → ฝาหลัง → กระจกหน้า → จอ → ชิ้นเล็ก (เลนส์ ปุ่ม น็อต โลโก้ ฯลฯ)
    const FIRST = ["Side_Panel", "Back_Panel", "Front_Panel", "Front_Screen"];
    const parts = [];
    const addPart = (m) => {
      if (m.userData.part) return;
      const i = parts.length;
      const side = i % 2 ? 1 : -1;
      const up = rand(i + 3) - 0.5;
      const big = FIRST.indexOf(m.name);
      m.userData.part = {
        p: m.position.clone(), r: m.rotation.clone(), sc: m.scale.x,
        // ระยะลอยคิดเป็นหน่วยของฉาก แล้วแปลงกลับเป็นหน่วยของโมเดล
        off: new T.Vector3(side * (2.6 + rand(i) * 3.2), up * 4.2, (rand(i + 7) - 0.35) * 5).divideScalar(unit),
        spin: new T.Vector3((rand(i + 11) - 0.5) * 9, (rand(i + 13) - 0.5) * 12, (rand(i + 17) - 0.5) * 9),
        rank: big >= 0 ? big : 4 + i,
      };
      parts.push(m);
    };
    partRoot.children.forEach(addPart);
    // เรียงลำดับใหม่ให้ต่อเนื่อง 0..n-1 (ชิ้นหลักก่อน)
    parts.sort((x, y) => x.userData.part.rank - y.userData.part.rank).forEach((m, i) => (m.userData.part.rank = i));

    // ข้อความ: ชื่อรุ่นแตกเป็นตัวอักษร
    const nameEl = document.getElementById("assembleName");
    nameEl.innerHTML = [...p.name].map((ch) => `<span>${ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("");
    const letters = [...nameEl.children];
    document.getElementById("assembleSpec").textContent =
      `${p.chip} · กล้อง ${(p.specs && p.specs.mainCam) || "-"} MP · แบต ${fmt(p.battery)} mAh · ${p.priceEst ? "≈ " : ""}฿${fmt(p.price)}`;
    const cta = document.getElementById("assembleCta");
    cta.onclick = () => openDetail(p.id);
    const copy = document.getElementById("assembleCopy");
    const eyebrow = document.getElementById("assembleEyebrow");
    const spec = document.getElementById("assembleSpec");
    const hint = document.getElementById("assembleHint");

    let w = 0, h = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height || (r.width === w && r.height === h)) return;
      w = r.width; h = r.height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // ให้เห็นทั้งสองเครื่องตอนแยก (กว้างราว 2.6 หน่วย) และสูงพอดีจอ
      const t = Math.tan((camera.fov * Math.PI) / 360);
      // เครื่องอยู่ครึ่งบนของจอ เหลือที่ด้านล่างให้ชื่อรุ่น
      camera.position.set(0, -0.4, Math.max(2.05 / t, 1.7 / (t * camera.aspect)));
      camera.updateProjectionMatrix();
    };

    let target = 0, cur = 0, lastScreen = 0;
    const readScroll = () => {
      const r = sec.getBoundingClientRect();
      const total = r.height - innerHeight;
      target = total > 0 ? aClamp(-r.top / total) : 1;
    };

    const apply = (P, now) => {
      // ช่วง: 0–0.6 ประกอบ, 0.58–0.8 แยกสองเครื่อง, 0.72–0.95 ชื่อรุ่น
      const a = span(P, 0.02, 0.6), s = aEase(span(P, 0.58, 0.8)), n = span(P, 0.7, 0.95);
      const n2 = parts.length;
      let docking = 0;
      parts.forEach((m, idx) => {
        const d = m.userData.part;
        // ชิ้นหลัก 4 ชิ้นแรกเข้าก่อน (0, 0.08, 0.16, 0.24) แล้วชิ้นเล็กทยอยตามจนครบที่ a = 1
        const startAt = d.rank <= 3 ? d.rank * 0.08 : 0.3 + ((d.rank - 4) / Math.max(1, n2 - 4)) * 0.4;
        const k = aOut(aClamp((a - startAt) / 0.3));
        const inv = 1 - k;
        m.position.set(d.p.x + d.off.x * inv, d.p.y + d.off.y * inv, d.p.z + d.off.z * inv);
        m.rotation.set(d.r.x + d.spin.x * inv, d.r.y + d.spin.y * inv, d.r.z + d.spin.z * inv);
        // ชิ้นเล็กลอยมาแบบขยายใหญ่ แล้วหดลงเข้าที่ (ให้เห็นชัดแบบชุดเกราะประกอบตัว)
        m.scale.setScalar(d.sc * (d.rank > 3 ? 1 + 2.2 * inv : 1));
        m.visible = a > startAt - 0.02 || P > 0.6;
        if (k > 0.86 && k < 1) docking = Math.max(docking, 1 - (k - 0.86) / 0.14);
        void idx;
      });
      flash.intensity = docking * 2.2;
      // ตัวเครื่องหมุนระหว่างประกอบ แล้วค่อยๆ หันด้านหลังเข้าหาผู้ชม (มีเครื่องเดียวก่อน)
      const turn = aEase(span(P, 0.56, 0.68));
      const spinA = (1 - aEase(a)) * Math.PI * 2.2;
      const idle = Math.sin(now / 1600) * 0.03;
      rigA.rotation.set(0.32 * (1 - a) + idle * 0.5, -0.3 * (1 - turn) + spinA + Math.PI * turn + 0.1 * s, 0);
      rigA.position.set(-0.3 * s, 0.04 * Math.sin(now / 1300), 0.12 * s);
      rigA.scale.setScalar(0.92 + 0.08 * aOut(a));
      // เครื่องที่สอง: เลื่อนออกมาจากด้านหลังไปทางขวา โชว์หน้าจอ ซ้อนอยู่หลังเครื่องแรกเล็กน้อย
      B.visible = s > 0.001;
      rigB.position.set(0.42 * s, 0.03 + 0.04 * Math.sin(now / 1500 + 1), -0.42);
      rigB.rotation.set(idle * 0.4, -0.12 - (1 - s) * 0.25, 0);
      rigB.scale.setScalar(0.97);
      // ข้อความ
      eyebrow.style.opacity = String(span(P, 0.0, 0.08) * (1 - span(P, 0.5, 0.6)));
      hint.style.opacity = String(1 - span(P, 0.02, 0.12));
      letters.forEach((el, i) => {
        const t = aOut(span(n, i / (letters.length + 6), (i + 7) / (letters.length + 6)));
        el.style.opacity = String(t);
        el.style.transform = `translateY(${(1 - t) * 0.6}em) rotateX(${(1 - t) * 70}deg)`;
        el.style.filter = `blur(${(1 - t) * 8}px)`;
      });
      const sp = span(P, 0.86, 0.98);
      spec.style.opacity = String(sp);
      spec.style.transform = `translateY(${(1 - sp) * 14}px)`;
      cta.style.opacity = String(span(P, 0.9, 1));
      cta.style.pointerEvents = P > 0.92 ? "auto" : "none";
      copy.classList.toggle("show-name", n > 0);
    };

    let visible = false, raf = 0;
    const loop = (now) => {
      raf = 0;
      if (!visible) return;
      resize();
      cur += (target - cur) * 0.12;   // ไล่ตามการเลื่อนให้นุ่มนวล
      if (Math.abs(target - cur) < 0.0005) cur = target;
      apply(cur, now);
      // หน้าจอเครื่องที่สอง (นาฬิกา/หน้าล็อก)
      if (vB && vB.os && B.visible && now - lastScreen > 500) {
        lastScreen = now;
        if (vB.os.update(now) && vB.screenTex) vB.screenTex.needsUpdate = true;
      }
      // โลโก้หลังเครื่องโหลดเสร็จทีหลัง: นับเป็นชิ้นส่วนด้วย
      if (!real && A.children.length !== parts.length) A.children.forEach(addPart);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (visible && !raf) raf = requestAnimationFrame(loop); };
    new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); kick(); }).observe(sec);
    addEventListener("scroll", () => { readScroll(); kick(); }, { passive: true });
    addEventListener("resize", () => { w = h = 0; kick(); });
    readScroll(); cur = target;
    sec.classList.add("ready");
    visible = true; kick();
  }

  start().catch((e) => { console.warn("assemble animation", e); sec.hidden = true; });
})();
