// JLC Phone frontend — คุยกับ backend ผ่าน /api/meta และ /api/recommend

const state = {
  brands: new Set(),
  weights: {},      // { cpu: 1, gpu: 2, ... }  1 = ปกติ, 2 = สำคัญมาก
  presets: new Set(), // เลือกรูปแบบการใช้งานได้หลายแบบ
  sort: "value",
};
let meta = null;

const $ = (sel) => document.querySelector(sel);
const fmt = (n) => Number(n).toLocaleString("th-TH");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

async function init() {
  try {
    meta = await api.meta();
  } catch {
    $("#formError").textContent = "โหลดข้อมูลไม่ได้ — ถ้ารันบนเครื่อง ให้รัน python server.py ก่อน";
    return;
  }
  renderBrands();
  renderPresets();
  renderCriteria();
  bindBudget();
  togglePreset("balanced");

  $("#clearBrands").onclick = () => { state.brands.clear(); renderBrands(); };
  $("#catalogSearch").oninput = debounce(() => loadCatalog(true), 250);
  $("#catalogMore").onclick = () => loadCatalog(false);
  bindNavSearch();
  $("#catalogTotal").textContent = fmt(meta.totalModels);
  $("#catalogSpecTotal").textContent = fmt(meta.totalWithSpecs);
  $("#findBtn").onclick = () => findPhones(true);
  document.querySelectorAll("#sortGroup button").forEach((b) => {
    b.onclick = () => {
      state.sort = b.dataset.sort;
      document.querySelectorAll("#sortGroup button").forEach((x) => x.classList.toggle("active", x === b));
      findPhones(false);
    };
  });
}

// ---------- เลือกแบรนด์: แบรนด์ต้น → แบรนด์ย่อย ----------
// state.brands เก็บ slug ของแบรนด์ย่อย (เช่น xiaomi, redmi, poco)
// โลโก้จาก Simple Icons (ผ่าน CDN) ข้อมูลโลโก้/สี/กลุ่มอยู่ใน data/brands.json
const LOGO_CDN = "logos/";  // ไฟล์ SVG จาก Simple Icons (CC0) เก็บไว้ในเว็บเอง ใช้ได้ทั้งบนเครื่องและเวอร์ชันออนไลน์
let othersOpen = false;
let othersQuery = "";

const groupState = (g) => {
  const n = g.members.filter((m) => state.brands.has(m.slug)).length;
  return n === 0 ? "none" : n === g.members.length ? "all" : "some";
};

function brandMark(g) {
  if (g.logo) {
    const shape = g.wide ? "wide" : "icon";
    return `<span class="brand-logo ${shape} logo-${esc(g.logo)}" style="--logo:url('${LOGO_CDN}${esc(g.logo)}.svg')" aria-hidden="true"></span>`;
  }
  return `<span class="brand-word ${g.wordClass ? "brand-word-" + esc(g.wordClass) : ""}" aria-hidden="true">${esc(g.word || g.name)}</span>`;
}

function toggleGroup(id) {
  const g = meta.groups.find((x) => x.id === id);
  const select = groupState(g) !== "all";
  g.members.forEach((m) => (select ? state.brands.add(m.slug) : state.brands.delete(m.slug)));
  renderBrands();
}

function renderBrands() {
  const featured = meta.groups.filter((g) => g.featured);
  const others = meta.groups.filter((g) => !g.featured);
  const othersSelected = others.filter((g) => groupState(g) !== "none").length;

  $("#brandGrid").innerHTML = featured.map((g) => {
    const st = groupState(g);
    const color = g.color ? `--lc:${g.color[0]};--dc:${g.color[1]}` : "";
    const sub = g.members.length > 1 ? g.members.map((m) => m.name).join(" · ") : `${fmt(g.count)} รุ่น`;
    return `
    <button type="button" class="brand-card ${st === "all" ? "selected" : st === "some" ? "partial" : ""}" data-group="${esc(g.id)}" aria-pressed="${st !== "none"}">
      <span class="check">${st === "some" ? "–" : "✓"}</span>
      <span class="brand-mark" style="${color}">${brandMark(g)}</span>
      <strong>${esc(g.name)}</strong>
      <small>${esc(sub)}</small>
    </button>`;
  }).join("") + `
    <button type="button" class="brand-card more-card ${othersOpen || othersSelected ? "partial" : ""}" id="othersCard" aria-expanded="${othersOpen}">
      <span class="brand-mark"><span class="brand-word">+${others.length}</span></span>
      <strong>แบรนด์อื่นๆ</strong>
      <small>${othersSelected ? `เลือกแล้ว ${othersSelected} แบรนด์` : "รวมแบรนด์ไทยและรุ่นเก่า"}</small>
    </button>`;

  document.querySelectorAll(".brand-card[data-group]").forEach((el) => (el.onclick = () => toggleGroup(el.dataset.group)));
  $("#othersCard").onclick = () => { othersOpen = !othersOpen; renderBrands(); };

  renderOthers(others);
  renderSubBrands();
  refreshCatalogSoon();
}

// แผงแบรนด์อื่นๆ (ไม่ได้อยู่ในการ์ดโลโก้) พร้อมช่องค้นหา
function renderOthers(others) {
  const panel = $("#othersPanel");
  panel.hidden = !othersOpen;
  if (!othersOpen) return;
  const q = othersQuery.trim().toLowerCase();
  const list = others.filter((g) => !q || g.name.toLowerCase().includes(q) || g.members.some((m) => m.name.toLowerCase().includes(q)));
  panel.innerHTML = `
    <input type="search" id="othersSearch" class="search-input" placeholder="ค้นหาแบรนด์ เช่น i-mobile, Wiko" value="${esc(othersQuery)}">
    <div class="chips left">
      ${list.map((g) => {
        const st = groupState(g);
        return `<button type="button" class="chip ${st !== "none" ? "selected" : ""}" data-group="${esc(g.id)}">${esc(g.name)} <span class="chip-count">${fmt(g.count)}</span></button>`;
      }).join("") || `<p class="hint">ไม่พบแบรนด์</p>`}
    </div>`;
  panel.querySelectorAll(".chip[data-group]").forEach((el) => (el.onclick = () => toggleGroup(el.dataset.group)));
  const input = $("#othersSearch");
  input.oninput = () => {
    othersQuery = input.value;
    renderOthers(others);
    const again = $("#othersSearch");
    again.focus();
    again.setSelectionRange(again.value.length, again.value.length);
  };
}

// แบรนด์ย่อยของแบรนด์ต้นที่เลือก — กดเพื่อเปิด/ปิดทีละแบรนด์ย่อย
function renderSubBrands() {
  const groups = meta.groups.filter((g) => g.members.length > 1 && groupState(g) !== "none");
  const panel = $("#subBrands");
  panel.hidden = !groups.length;
  panel.innerHTML = groups.map((g) => `
    <div class="sub-row">
      <span class="sub-title">${esc(g.name)}</span>
      <div class="chips left">
        ${g.members.map((m) => `
          <button type="button" class="chip ${state.brands.has(m.slug) ? "selected" : ""}" data-slug="${esc(m.slug)}">
            ${state.brands.has(m.slug) ? "✓ " : ""}${esc(m.name)} <span class="chip-count">${fmt(m.count)}</span>
          </button>`).join("")}
      </div>
    </div>`).join("");
  panel.querySelectorAll(".chip[data-slug]").forEach((el) => {
    el.onclick = () => {
      const s = el.dataset.slug;
      state.brands.has(s) ? state.brands.delete(s) : state.brands.add(s);
      renderBrands();
    };
  });
}

function selectedBrandNames() {
  const names = [];
  meta.groups.forEach((g) => {
    const st = groupState(g);
    if (st === "all") names.push(g.name);
    else if (st === "some") g.members.filter((m) => state.brands.has(m.slug)).forEach((m) => names.push(m.name));
  });
  return names;
}

function renderPresets() {
  $("#presetGrid").innerHTML = meta.presets.map((p) => `
    <button type="button" class="preset-card ${state.presets.has(p.key) ? "selected" : ""}" data-preset="${p.key}" aria-pressed="${state.presets.has(p.key)}">
      <span class="check">✓</span>
      <strong>${esc(p.label)}</strong>
      <span>${esc(p.desc)}</span>
    </button>`).join("");
  document.querySelectorAll(".preset-card").forEach((el) => {
    el.onclick = () => togglePreset(el.dataset.preset);
  });
}

// เลือก/ยกเลิกรูปแบบการใช้งาน แล้วรวมเกณฑ์ของทุกแบบที่เลือก
// ถ้าเกณฑ์ซ้ำกัน ใช้น้ำหนักที่สูงกว่า (เช่น เกม ★แบต + แบตอึด ★แบต → แบต ★)
function togglePreset(key) {
  state.presets.has(key) ? state.presets.delete(key) : state.presets.add(key);
  state.weights = {};
  for (const p of meta.presets) {
    if (!state.presets.has(p.key)) continue;
    for (const [k, w] of Object.entries(p.weights)) {
      state.weights[k] = Math.max(state.weights[k] || 0, w);
    }
  }
  renderPresets();
  renderCriteria();
}

function renderCriteria() {
  $("#criteriaGrid").innerHTML = meta.criteria.map((c) => {
    const w = state.weights[c.key] || 0;
    return `
    <div class="crit ${w ? "selected" : ""}" data-key="${c.key}" role="checkbox" aria-checked="${!!w}" tabindex="0">
      <span class="box">✓</span>
      <span class="txt"><strong>${esc(c.label)}</strong><small>${esc(c.desc)}</small></span>
      <button type="button" class="star ${w >= 2 ? "on" : ""}" title="สำคัญมาก" aria-label="ตั้ง ${esc(c.label)} เป็นสำคัญมาก">★</button>
    </div>`;
  }).join("");

  document.querySelectorAll(".crit").forEach((el) => {
    const key = el.dataset.key;
    const toggle = () => {
      if (state.weights[key]) delete state.weights[key];
      else state.weights[key] = 1;
      customized();
    };
    el.onclick = (e) => {
      if (e.target.closest(".star")) {
        state.weights[key] = state.weights[key] >= 2 ? 1 : 2;
        customized();
      } else toggle();
    };
    el.onkeydown = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } };
  });
}

// ผู้ใช้ปรับเกณฑ์เอง → ยกเลิกการไฮไลต์ preset
function customized() {
  state.presets.clear();
  renderPresets();
  renderCriteria();
}

function bindBudget() {
  const chips = document.querySelectorAll("#budgetChips .chip");
  chips.forEach((chip) => {
    chip.onclick = () => {
      $("#minPrice").value = chip.dataset.min;
      $("#maxPrice").value = chip.dataset.max;
      chips.forEach((c) => c.classList.toggle("selected", c === chip));
    };
  });
  ["#minPrice", "#maxPrice"].forEach((id) => {
    $(id).oninput = () => chips.forEach((c) => c.classList.remove("selected"));
  });
}

async function findPhones(scroll) {
  const err = $("#formError");
  err.textContent = "";
  const min = $("#minPrice").value;
  const max = $("#maxPrice").value;
  if ((min && Number(min) < 0) || (max && Number(max) < 0)) {
    err.textContent = "ราคาต้องไม่ติดลบ";
    return;
  }
  if (!Object.keys(state.weights).length) {
    err.textContent = "กรุณาเลือกสิ่งที่ให้ความสำคัญอย่างน้อย 1 อย่าง";
    return;
  }

  let data;
  try {
    data = await api.recommend({
      brands: [...state.brands],
      minPrice: min || 0,
      maxPrice: max || null,
      weights: state.weights,
      sort: state.sort,
    });
  } catch (e) {
    err.textContent = "เกิดข้อผิดพลาด: " + e.message;
    return;
  }
  renderResults(data);
  if (scroll) $("#results").scrollIntoView({ behavior: "smooth" });
}

function renderResults(data) {
  $("#results").hidden = false;
  const names = selectedBrandNames();
  const brandText = !names.length ? "ทุกแบรนด์" : names.length > 4 ? `${names.slice(0, 4).join(", ")} และอีก ${names.length - 4} แบรนด์` : names.join(", ");
  $("#resultSummary").textContent = `พบ ${data.count} รุ่นที่มีข้อมูลสเปก · ${brandText}` +
    (data.noSpecCount ? ` · อีก ${fmt(data.noSpecCount)} รุ่นยังไม่มีสเปก (ดูได้ในรายชื่อทุกรุ่นด้านล่าง)` : "");

  if (!data.count) {
    $("#resultList").innerHTML = `<div class="empty">ไม่พบมือถือที่ตรงเงื่อนไข ลองขยายงบประมาณหรือเลือกแบรนด์เพิ่ม</div>`;
    return;
  }
  const labels = Object.fromEntries(meta.criteria.map((c) => [c.key, c.label]));

  $("#resultList").innerHTML = data.results.map((p, i) => {
    const bars = Object.entries(p.breakdown).map(([k, v]) => `
      <div class="bar-row">
        <span>${esc(labels[k])}${data.weights[k] >= 2 ? " ★" : ""}</span>
        <div class="bar"><i style="width:${v}%"></i></div>
        <span>${v}</span>
      </div>`).join("");
    const badges = [
      p.bestValue ? `<span class="badge gold">คุ้มค่าที่สุด</span>` : "",
      p.topPerf ? `<span class="badge">สเปกดีที่สุดในผลลัพธ์</span>` : "",
    ].join("");
    lastResults[p.id] = p;
    return `
    <article class="phone" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="ดูรายละเอียด ${esc(p.name)}">
      <div class="thumb"><span class="rank">${i + 1}</span>${phoneImage(p)}</div>
      <div>
        ${badges ? `<div class="badges">${badges}</div>` : ""}
        <div class="phone-brand">${esc(p.brandName || p.brand)}</div>
        <h3>${esc(p.name)}</h3>
        <p class="phone-meta">${esc(p.chip)} · แบต ${fmt(p.battery)} mAh · ${p.weight} g · ${updatesText(p)}</p>
        <div class="bars">${bars}</div>
      </div>
      <div class="score-col">
        <div class="price" ${p.priceEst ? 'title="ราคาประมาณ ไม่ใช่ราคาทางการในไทย"' : ""}>${p.priceEst ? "≈ " : ""}฿${fmt(p.price)}</div>
        <div class="value-num">${p.value}</div>
        <div class="value-label">คะแนนความคุ้มค่า</div>
        <div class="perf">คะแนนสเปก ${p.perf}</div>
        <span class="more">ดูรายละเอียด ›</span>
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll(".phone").forEach((el) => {
    el.onclick = () => openDetail(el.dataset.id);
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(el.dataset.id); } };
  });
}

// ---------- หน้ารายละเอียด (แผ่นสไลด์แบบ Apple) ----------
const lastResults = {};

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const launchText = (l) => { if (!l) return ""; const [y, m] = l.split("-"); return `${TH_MONTHS[+m - 1]} ${y}`; };
const updatesText = (p) => (p.updatesLeft > 0 ? `อัปเดตเหลือ ~${p.updatesLeft} ปี` : "หมดระยะอัปเดตแล้ว");

const SPEC_GROUPS = [
  ["ภาพรวม", (p, s) => [["แบรนด์", p.brandName || p.brand], ["เปิดตัว", launchText(p.launch)], ["ระบบปฏิบัติการ", s.os], ["น้ำหนัก", `${p.weight} กรัม`],
    ["อัปเดตซอฟต์แวร์", `${p.updates} ปีจากวันเปิดตัว`], ["อัปเดตที่เหลือ", p.updatesLeft > 0 ? `ประมาณ ${p.updatesLeft} ปี` : "หมดแล้ว"]]],
  ["หน้าจอ", (p, s) => [["ขนาด", s.screen && `${s.screen} นิ้ว`], ["ชนิดจอ", s.panel], ["รีเฟรชเรต", s.hz && `${s.hz} Hz`]]],
  ["ประสิทธิภาพ", (p, s) => [["ชิปเซ็ต", p.chip], ["RAM", s.ram && `${s.ram} GB`], ["ความจุ", s.storage]]],
  ["กล้อง", (p, s) => [["กล้องหลัก", s.mainCam && `${s.mainCam} MP`], ["กล้องหน้า", s.frontCam && `${s.frontCam} MP`]]],
  ["แบตเตอรี่", (p, s) => [["ความจุ", `${fmt(p.battery)} mAh`], ["ชาร์จเร็ว", s.chargeW && `${s.chargeW} W`]]],
];

async function openDetail(id) {
  const dialog = $("#detail");
  let p;
  try {
    p = await api.phone(id);
  } catch (e) {
    $("#formError").textContent = "โหลดรายละเอียดไม่สำเร็จ: " + e.message;
    return;
  }
  const r = lastResults[id];
  const s = p.specs || {};
  const labels = Object.fromEntries(meta.criteria.map((c) => [c.key, c.label]));

  const scoreRows = Object.entries(p.allScores).map(([k, v]) => `
    <div class="bar-row">
      <span>${esc(labels[k])}</span>
      <div class="bar"><i style="width:${v}%"></i></div>
      <span>${v}</span>
    </div>`).join("");

  const groups = SPEC_GROUPS.map(([title, rows]) => {
    const items = rows(p, s).filter(([, v]) => v);
    return `<section class="spec-group"><h4>${esc(title)}</h4><dl>${items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>`;
  }).join("");

  $("#detailBody").innerHTML = `
    <button type="button" class="close" id="detailClose" aria-label="ปิด">✕</button>
    <div class="detail-hero">
      <div class="detail-art">
        <div class="viewer3d" id="viewer3d"><div class="viewer-fallback">${phoneImage(p, "large")}</div></div>
        <p class="viewer-hint" id="viewerHint" hidden>${matchMedia("(pointer: coarse)").matches
          ? "3D · ลากนิ้วเพื่อหมุน · ถ่างสองนิ้วเพื่อซูม"
          : "3D · ลากเมาส์เพื่อหมุน · ลูกกลิ้งเพื่อซูม"}</p>
        <p class="viewer-credit" id="viewerCredit" hidden></p>
      </div>
      <div class="detail-info">
        <div class="phone-brand">${esc(p.brand)}</div>
        <h2>${esc(p.name)}</h2>
        <p class="detail-sub">${esc(p.chip)} · จอ ${esc(s.screen || "-")} นิ้ว · กล้อง ${esc(s.mainCam || "-")} MP</p>
        <div class="detail-price">${p.priceEst ? "≈ " : ""}฿${fmt(p.price)}</div>
        ${p.priceEst ? `<p class="detail-sub">ราคาประมาณ (ยังไม่มีราคาทางการในไทย หรือเป็นราคาหลังปรับลด)</p>` : ""}
        ${r ? `
        <div class="stats">
          <div><b>${r.value}</b><span>ความคุ้มค่า</span></div>
          <div><b>${r.perf}</b><span>คะแนนสเปก<br>ตามที่คุณเลือก</span></div>
        </div>` : ""}
      </div>
    </div>
    <h3 class="detail-h">คะแนนแต่ละด้าน</h3>
    <div class="bars detail-bars">${scoreRows}</div>
    <h3 class="detail-h">สเปกโดยละเอียด</h3>
    <div class="spec-groups">${groups}</div>
    <p class="detail-note">ข้อมูลสเปกและราคาเป็นค่าประมาณ โปรดตรวจสอบกับผู้จำหน่ายก่อนซื้อ</p>`;

  $("#detailClose").onclick = () => dialog.close();
  dialog.showModal();
  dialog.scrollTop = 0;
  start3D(p);
}

// ---------- โมเดล 3 มิติในหน้ารายละเอียด ----------
let viewer = null;

function stop3D() {
  if (viewer) { viewer.dispose(); viewer = null; }
}

async function start3D(p) {
  stop3D();
  const box = $("#viewer3d");
  const v = new Phone3DViewer(box, p);
  viewer = v;
  try {
    await v.start();
  } catch {
    return;  // โหลด 3D ไม่ได้ (เช่น ออฟไลน์ หรือไม่รองรับ WebGL) → แสดงรูป 2D ต่อไป
  }
  if (viewer !== v) return;
  box.classList.add("ready");
  $("#viewerHint").hidden = false;
  // โมเดลจริงจากผู้สร้างอื่น: ต้องให้เครดิตตามสัญญาอนุญาต CC BY
  const c = v.credit;
  const credit = $("#viewerCredit");
  if (c) {
    credit.innerHTML = `โมเดล 3D: <a href="${esc(c.url)}" target="_blank" rel="noopener">"${esc(c.title)}"</a> โดย ${esc(c.author)} · <a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a>`;
    credit.hidden = false;
  } else {
    credit.textContent = "โมเดลจำลองจากสเปก ไม่ใช่รูปทรงจริงทุกจุด";
    credit.hidden = false;
  }
}

// ---------- รายชื่อมือถือทุกรุ่น (ค้นหาได้) ----------
const catalog = { offset: 0, total: 0, seq: 0 };
const refreshCatalogSoon = debounce(() => loadCatalog(true), 150);

async function loadCatalog(reset) {
  if (reset) catalog.offset = 0;
  const seq = ++catalog.seq;  // กันผลลัพธ์เก่ามาทับผลใหม่ตอนพิมพ์เร็วๆ
  const params = new URLSearchParams({
    brands: [...state.brands].join(","),
    q: $("#catalogSearch").value.trim(),
    offset: catalog.offset,
    limit: 30,
  });
  let data;
  try {
    data = await api.catalog(params);
  } catch {
    return;
  }
  if (seq !== catalog.seq) return;
  catalog.total = data.total;
  catalog.offset += data.items.length;

  const rows = data.items.map((i) => `
    <button type="button" class="cat-row" data-key="${esc(i.key)}" data-phone="${esc(i.phoneId || "")}">
      <span class="cat-name"><small>${esc(i.brandName)}</small>${esc(i.name)}</span>
      <span class="cat-tags">
        ${i.tablet ? `<span class="tag">แท็บเล็ต</span>` : ""}
        ${i.phoneId ? `<span class="tag ok">${i.priceEst ? "≈" : ""}฿${fmt(i.price)}</span>` : `<span class="tag muted">ยังไม่มีสเปก</span>`}
      </span>
    </button>`).join("");
  const list = $("#catalogList");
  if (reset) list.innerHTML = rows || `<div class="empty">ไม่พบรุ่นที่ค้นหา</div>`;
  else list.insertAdjacentHTML("beforeend", rows);

  const names = selectedBrandNames();
  $("#catalogInfo").textContent = `${fmt(data.total)} รุ่น` + (names.length ? ` ใน ${names.slice(0, 3).join(", ")}${names.length > 3 ? " ฯลฯ" : ""}` : " จากทุกแบรนด์");
  $("#catalogMore").hidden = catalog.offset >= catalog.total;

  list.querySelectorAll(".cat-row:not([data-bound])").forEach((el) => {
    el.dataset.bound = "1";
    el.onclick = () => (el.dataset.phone ? openDetail(el.dataset.phone)
      : openNoSpec(el.querySelector(".cat-name small").textContent, el.querySelector(".cat-name").lastChild.textContent));
  });
}

// รุ่นที่ยังไม่มีข้อมูลสเปก
function openNoSpec(brand, name) {
  const q = encodeURIComponent(`${brand} ${name} specs`);
  $("#detailBody").innerHTML = `
    <button type="button" class="close" id="detailClose" aria-label="ปิด">✕</button>
    <div class="nospec">
      <div class="phone-brand">${esc(brand)}</div>
      <h2>${esc(name)}</h2>
      <p>รุ่นนี้ยังไม่มีข้อมูลสเปกในระบบ จึงยังคำนวณความคุ้มค่าไม่ได้</p>
      <a class="btn" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">ค้นหาสเปกบน Google</a>
    </div>`;
  $("#detailClose").onclick = () => $("#detail").close();
  stop3D();
  $("#detail").showModal();
}

// ---------- ช่องค้นหารุ่นบนแถบเมนู (ค้นจากทุกแบรนด์ แสดงรายการแนะนำขณะพิมพ์) ----------
function bindNavSearch() {
  const input = $("#navSearch");
  const box = $("#navSuggest");
  let seq = 0, items = [], active = -1, total = 0;

  const open = (on) => { box.hidden = !on; input.setAttribute("aria-expanded", String(on)); if (!on) active = -1; };
  // ทำตัวหนาให้ส่วนที่ตรงกับคำค้น
  const highlight = (text, q) => {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    return i < 0 || !q ? esc(text) : esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  };

  function render(q) {
    if (!items.length) {
      box.innerHTML = `<div class="sug-empty">ไม่พบรุ่นที่ตรงกับ "${esc(q)}"</div>`;
      return;
    }
    box.innerHTML = items.map((i, n) => `
      <button type="button" class="sug ${n === active ? "active" : ""}" role="option" data-n="${n}">
        <span class="sug-name"><small>${esc(i.brandName)}</small>${highlight(i.name, q)}</span>
        ${i.phoneId ? `<span class="tag ok">${i.priceEst ? "≈" : ""}฿${fmt(i.price)}</span>` : `<span class="tag muted">ยังไม่มีสเปก</span>`}
      </button>`).join("") +
      (total > items.length ? `<button type="button" class="sug sug-all" data-all="1">ดูทั้งหมด ${fmt(total)} รุ่น →</button>` : "");
    box.querySelectorAll(".sug").forEach((b) => {
      b.onmousedown = (e) => e.preventDefault();   // กันช่องค้นหาเสียโฟกัสก่อนคลิกทำงาน
      b.onclick = () => (b.dataset.all ? showAll() : choose(items[+b.dataset.n]));
    });
  }

  function choose(item) {
    open(false);
    input.blur();
    if (item.phoneId) openDetail(item.phoneId);
    else openNoSpec(item.brandName, item.name);
  }

  // กด Enter หรือ "ดูทั้งหมด" → ไปที่รายชื่อทุกรุ่นพร้อมคำค้นเดียวกัน
  function showAll() {
    open(false);
    input.blur();
    $("#catalogSearch").value = input.value.trim();
    state.brands.clear();
    renderBrands();
    loadCatalog(true);
    $("#catalog").scrollIntoView({ behavior: "smooth" });
  }

  input.addEventListener("input", debounce(async () => {
    const q = input.value.trim();
    if (!q) { open(false); return; }
    const my = ++seq;
    let data;
    try {
      data = await api.catalog(new URLSearchParams({ q, offset: 0, limit: 8 }));
    } catch { return; }
    if (my !== seq) return;   // มีคำค้นใหม่กว่าแล้ว
    items = data.items; total = data.total; active = -1;
    render(q);
    open(true);
  }, 150));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { open(false); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) choose(items[active]);
      else if (input.value.trim()) showAll();
      return;
    }
    if (box.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      render(input.value.trim());
      box.querySelector(".sug.active")?.scrollIntoView({ block: "nearest" });
    }
  });
  input.addEventListener("focus", () => { if (input.value.trim() && items.length) open(true); });
  input.addEventListener("blur", () => setTimeout(() => open(false), 120));
}

// ---------- สลับโหมดกลางวัน / กลางคืน ----------
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
function currentTheme() {
  return document.documentElement.dataset.theme || (darkQuery.matches ? "dark" : "light");
}
function syncThemeIcon() {
  document.documentElement.classList.toggle("is-dark", currentTheme() === "dark");
}
$("#themeToggle").onclick = () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
  syncThemeIcon();
};
darkQuery.addEventListener("change", syncThemeIcon);
syncThemeIcon();

document.addEventListener("DOMContentLoaded", () => {
  const dialog = $("#detail");
  // คลิกพื้นหลังเพื่อปิด
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  // ปิดหน้ารายละเอียด → คืนหน่วยความจำ 3D (เหตุการณ์ close มาช้ากว่าจริง จึงเช็กว่ายังปิดอยู่ไหม)
  dialog.addEventListener("close", () => { if (!dialog.open) stop3D(); });
});

init();
