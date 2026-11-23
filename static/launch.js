// ลูกเล่นตอนเลื่อนจอ
//  1) ส่วน "เปิดตัวล่าสุด": มือถือค่อยๆ ลอยขึ้นมาตามการเลื่อน (แบบงานเปิดตัวสินค้า) แล้วรุ่นอื่นเลื่อนออกมาข้างๆ
//  2) เนื้อหาทั่วหน้าค่อยๆ ลอยขึ้นและชัดขึ้นเมื่อเลื่อนมาถึง
// ส่วนเปิดตัวขยับตามการเลื่อนของผู้ใช้เองเท่านั้น (ไม่เล่นเอง) | ผู้ที่ตั้งค่าลดการเคลื่อนไหว: เนื้อหาแค่ค่อยๆ ชัดขึ้น ไม่ลอย

const REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
// รุ่นเรือธงใหม่ล่าสุด (ตรงกลาง = รุ่นหลัก)
const LAUNCH_IDS = ["google-pixel-11-pro", "apple-apple-iphone-18-pro-max", "xiaomi-17-pro-max"];

const lClamp = (x) => Math.max(0, Math.min(1, x));
const lEase = (t) => 1 - Math.pow(1 - t, 3);
const seg = (p, a, b) => lEase(lClamp((p - a) / (b - a)));   // ความคืบหน้าในช่วง a..b

// มือถือด้านหน้า: จอสว่าง วอลเปเปอร์ไล่สีตามสีเครื่อง + นาฬิกา + กล้องหน้า
function phoneFrontSVG(p) {
  const c = (p.specs && p.specs.color) || "#5a6a8a";
  const id = `lf${Math.random().toString(36).slice(2, 7)}`;
  const d = new Date();
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  const apple = p.brand === "Apple";
  const cut = apple
    ? `<rect x="46" y="12" width="28" height="8" rx="4" fill="#000"/>`
    : `<circle cx="60" cy="15" r="3.2" fill="#000"/>`;
  return `
  <svg class="launch-svg" viewBox="0 0 120 240" role="img" aria-label="${esc(p.name)}">
    <defs>
      <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(c, 0.25)}"/><stop offset="1" stop-color="${shade(c, -0.25)}"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="${hexMix(c, "#2E8BFF", 0.55)}"/><stop offset=".5" stop-color="${hexMix(c, "#8A4DFF", 0.5)}"/><stop offset="1" stop-color="${hexMix(c, "#1a0b2e", 0.75)}"/>
      </linearGradient>
      <radialGradient id="${id}g" cx=".7" cy=".25" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <rect x="2" y="2" width="116" height="236" rx="23" fill="url(#${id}f)"/>
    <rect x="5" y="5" width="110" height="230" rx="20" fill="#050507"/>
    <rect x="8" y="8" width="104" height="224" rx="17" fill="url(#${id}s)"/>
    <rect x="8" y="8" width="104" height="224" rx="17" fill="url(#${id}g)"/>
    <text x="60" y="62" text-anchor="middle" fill="#fff" font-size="26" font-weight="600" font-family="-apple-system, 'Segoe UI', sans-serif">${time}</text>
    <text x="60" y="38" text-anchor="middle" fill="rgba(255,255,255,.85)" font-size="6.5" font-weight="500" font-family="'Noto Sans Thai', sans-serif">${esc(p.brandName || p.brand)}</text>
    <rect x="44" y="225" width="32" height="2.4" rx="1.2" fill="rgba(255,255,255,.8)"/>
    ${cut}
    <rect x="8" y="8" width="104" height="224" rx="17" fill="url(#${id}r)"/>
  </svg>`;
}

async function initLaunch() {
  const section = $("#launch");
  if (!section) return;
  const phones = (await Promise.all(LAUNCH_IDS.map((id) => api.phone(id).catch(() => null)))).filter(Boolean);
  if (!phones.length) return;
  const mainIdx = Math.min(1, phones.length - 1);
  const order = phones.map((p, i) => ({ p, role: i === mainIdx ? "main" : i < mainIdx ? "left" : "right" }));

  $("#launchStage").insertAdjacentHTML("beforeend", order.map(({ p, role }) => `
    <button type="button" class="launch-phone ${role}" data-id="${esc(p.id)}" aria-label="ดูรายละเอียด ${esc(p.name)}">
      ${role === "main" ? phoneFrontSVG(p) : phoneSVG(p, "launch-svg")}
      <span class="launch-shadow" aria-hidden="true"></span>
    </button>`).join(""));
  $("#launchInfo").innerHTML = order.map(({ p, role }) => `
    <div class="launch-card ${role}">
      <strong>${esc(p.name)}</strong>
      <span>${esc(p.chip)} · ${esc((p.specs && p.specs.mainCam) || "-")} MP · ${fmt(p.battery)} mAh</span>
      <b>${p.priceEst ? "≈ " : ""}฿${fmt(p.price)}</b>
    </div>`).join("");
  section.querySelectorAll(".launch-phone").forEach((b) => (b.onclick = () => openDetail(b.dataset.id)));
  section.hidden = false;

  const els = {
    head: section.querySelector(".launch-head"),
    glow: section.querySelector(".launch-glow"),
    main: section.querySelector(".launch-phone.main"),
    left: section.querySelector(".launch-phone.left"),
    right: section.querySelector(".launch-phone.right"),
    cards: [...section.querySelectorAll(".launch-card")],
  };

  // p = 0 (เริ่มเข้าส่วนนี้) → 1 (เลื่อนผ่านจบ)
  const apply = (p) => {
    const rise = seg(p, 0.0, 0.42), spread = seg(p, 0.38, 0.7), info = seg(p, 0.62, 0.9);
    els.head.style.opacity = String(0.15 + 0.85 * seg(p, 0.0, 0.2));
    els.head.style.transform = `translateY(${(1 - seg(p, 0, 0.25)) * 30}px) scale(${0.96 + 0.04 * seg(p, 0, 0.25)})`;
    els.glow.style.opacity = String(rise * 0.9);
    els.glow.style.transform = `translate(-50%, -50%) scale(${0.6 + 0.5 * rise})`;
    if (els.main) {
      els.main.style.transform = `translate(-50%, ${(1 - rise) * 70}vh) rotateX(${(1 - rise) * 28}deg) scale(${0.82 + 0.18 * rise})`;
      els.main.style.opacity = String(Math.min(1, rise * 1.6));
    }
    [["left", -1], ["right", 1]].forEach(([k, dir]) => {
      const el = els[k];
      if (!el) return;
      el.style.transform = `translate(calc(-50% + ${dir * spread * 98}%), ${6 + (1 - rise) * 70}vh) rotateY(${dir * -22 * spread}deg) scale(${0.78 + 0.08 * spread})`;
      el.style.opacity = String(spread);
    });
    els.cards.forEach((c, i) => {
      const t = seg(p, 0.62 + i * 0.06, 0.86 + i * 0.05);
      c.style.opacity = String(t);
      c.style.transform = `translateY(${(1 - t) * 18}px)`;
    });
    void info;
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const r = section.getBoundingClientRect();
      const total = r.height - innerHeight;
      apply(total > 0 ? lClamp(-r.top / total) : 1);
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
}

// เนื้อหาค่อยๆ ลอยขึ้นเมื่อเลื่อนมาถึง (รวมการ์ดที่สร้างใหม่ภายหลัง เช่น ผลการแนะนำ)
function initReveal() {
  if (!("IntersectionObserver" in window)) return;
  const soft = REDUCE_MOTION.matches;   // ตั้งค่าลดการเคลื่อนไหว: แค่ค่อยๆ ชัดขึ้น ไม่ลอย
  const SEL = ".step-head, .brand-card, .cat-tile, .preset-grid > *, .criteria-grid > *, .result-list > *, .cat-row, .cta, .budget, .catalog .search-box";
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add("in");
      io.unobserve(el);
      // เล่นจบแล้วคืนสไตล์เดิม (ให้เอฟเฟกต์ hover ของการ์ดทำงานตามปกติ)
      setTimeout(() => { el.classList.remove("rv", "in", "soft"); el.style.removeProperty("--rv-d"); el.dataset.rvDone = "1"; }, 1200);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  let ready = false;   // หลังโหลดหน้าเสร็จ: ชิ้นที่วาดใหม่ในจอที่เห็นอยู่ (เช่น กดเลือกแบรนด์) ไม่ต้องเล่นซ้ำ
  setTimeout(() => (ready = true), 1500);
  const tag = (root) => {
    root.querySelectorAll(SEL).forEach((el) => {
      if (el.classList.contains("rv") || el.dataset.rvDone) return;
      if (ready) {
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) return;
      }
      // ไล่จังหวะทีละชิ้นในกลุ่มเดียวกัน
      const idx = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
      el.style.setProperty("--rv-d", `${Math.min(idx, 8) * 45}ms`);
      el.classList.add("rv");
      if (soft) el.classList.add("soft");
      io.observe(el);
    });
  };
  tag(document);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && tag(n.parentElement || n))))
    .observe(document.querySelector("main"), { childList: true, subtree: true });
}

initReveal();
initLaunch();
