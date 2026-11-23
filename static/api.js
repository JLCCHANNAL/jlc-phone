// ช่องทางคุยกับข้อมูล:
//  - รันบนเครื่อง (python server.py) → เรียก API ของเซิร์ฟเวอร์ Python ตามปกติ
//  - เวอร์ชันที่แชร์ออนไลน์ (ไม่มีเซิร์ฟเวอร์) → โหลด data.json แล้วคำนวณในเบราว์เซอร์ด้วยสูตรเดียวกับ server.py
//    data.json สร้างจาก python scripts/build_static.py

const LocalAPI = (() => {
  let D = null;
  const byId = {};
  const groupOf = {};
  const norm = (s) => s.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");
  // ตัวกรองรูปทรงเครื่อง (เหมือน match_tag ใน server.py)
  function matchTag(p, tag) {
    const s = p.specs || {};
    const fold = (s.panel || "").includes("จอพับ");
    const screen = s.screen || 0;
    if (tag === "foldable") return fold;
    if (tag === "bigscreen") return !fold && screen >= 6.7;
    if (tag === "small") return !fold && screen > 0 && screen <= 6.4;
    return true;
  }

  async function init() {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error("ไม่พบ data.json");
    D = await res.json();
    const now = new Date();
    const NOW = now.getFullYear() + now.getMonth() / 12;
    D.phones.forEach((p) => {
      // ปีอัปเดตที่เหลือ คำนวณจากวันนี้ของผู้ชม (เหมือน server.py)
      if (p.launch) {
        const [y, m] = p.launch.split("-").map(Number);
        p.updatesLeft = Math.round(Math.max(0, y + (m - 1) / 12 + p.updates - NOW) * 2) / 2;
      } else p.updatesLeft = p.updates;
      byId[p.id] = p;
    });
    D.meta.groups.forEach((g) => g.members.forEach((m) => (groupOf[m.slug] = g.id)));
    D.catalog.forEach((i) => {
      i.brandName = D.brandNames[i.b] || i.b;
      i.search = norm(i.brandName + i.n);
    });
  }

  function criterionScore(p, key) {
    const c = D.constants;
    if (key === "updates") return Math.min(p.updatesLeft / c.maxUpdateYears, 1) * 100;
    if (key === "weight") return Math.max(0, Math.min(1, (c.weightWorst - p.weight) / (c.weightWorst - c.weightBest))) * 100;
    return p.scores[key];
  }

  function widenBudget(pool, min, max) {
    const hasMin = min > 0, hasMax = max < 1e9;
    const count = (lo, hi) => pool.filter((p) => p.price >= lo && p.price <= hi).length;
    if (!(hasMin || hasMax) || count(min, max) >= 6) return [min, max, null];
    const center = hasMin && hasMax ? (min + max) / 2 : hasMax ? max : min;
    let tol = Math.max(1000, center * 0.05), lo = min, hi = max;
    while (tol <= center * 0.5) {
      lo = hasMin ? Math.max(0, min - tol) : 0;
      hi = hasMax ? max + tol : 1e9;
      if (count(lo, hi) >= 6) break;
      tol *= 1.5;
    }
    if (count(lo, hi) === count(min, max)) return [min, max, null];
    return [lo, hi, { min: hasMin ? Math.round(lo) : null, max: hasMax ? Math.round(hi) : null }];
  }

  function recommend(body) {
    const brands = new Set(body.brands || []);
    let min = Number(body.minPrice) || 0;
    let max = Number(body.maxPrice) || 1e9;
    if (min > max) [min, max] = [max, min];
    const keys = new Set(D.meta.criteria.map((c) => c.key));
    let weights = {};
    for (const [k, w] of Object.entries(body.weights || {})) if (keys.has(k) && Number(w) > 0) weights[k] = Math.min(Number(w), 3);
    if (!Object.keys(weights).length) weights = { ...D.meta.presets[2].weights };
    const base = D.constants.valueBase;

    // รุ่นที่ตรงแบรนด์/หมวด แล้วขยายช่วงราคาถ้างบแคบจนแทบไม่มีรุ่น (เหมือนฝั่งเซิร์ฟเวอร์)
    const pool = D.phones.filter((p) => (!brands.size || brands.has(p.brandSlug)) && matchTag(p, body.tag));
    const [lo, hi, widened] = widenBudget(pool, min, max);
    const results = [];
    for (const p of pool) {
      if (p.price < lo || p.price > hi) continue;
      const breakdown = {};
      for (const k of Object.keys(weights)) breakdown[k] = Math.round(criterionScore(p, k));
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      const perf = Object.entries(weights).reduce((a, [k, w]) => a + breakdown[k] * w, 0) / total;
      const starred = Object.keys(weights).filter((k) => weights[k] >= 2);
      const focusKeys = starred.length ? starred : Object.keys(weights);
      const focus = focusKeys.reduce((a, k) => a + breakdown[k], 0) / focusKeys.length;
      const raw = Math.max(0, perf - base) ** 2 * Math.max(0, focus - base) / p.price;
      results.push({ ...p, breakdown, perf: Math.round(perf * 10) / 10, _raw: raw, nearBudget: p.price < min || p.price > max });
    }
    if (results.length) {
      const bestRaw = Math.max(...results.map((r) => r._raw)) || 1;
      const bestPerf = Math.max(...results.map((r) => r.perf));
      results.forEach((r) => { r.value = Math.round((r._raw / bestRaw) * 100); r.topPerf = r.perf === bestPerf; delete r._raw; });
    }
    const sort = body.sort || "value";
    if (sort === "perf") results.sort((a, b) => b.perf - a.perf || a.price - b.price);
    else if (sort === "price") results.sort((a, b) => a.price - b.price || b.perf - a.perf);
    else results.sort((a, b) => b.value - a.value || b.perf - a.perf);
    if (results.length) {
      const best = results.reduce((a, b) => (b.value > a.value ? b : a));
      results.forEach((r) => (r.bestValue = r.id === best.id));
    }
    let list = results;
    if (body.onePerBrand) {   // แบรนด์ละ 1 รุ่น (นับตามแบรนด์ต้น)
      const seen = new Set();
      list = results.filter((r) => {
        const g = groupOf[r.brandSlug] || r.brandSlug;
        if (seen.has(g)) return false;
        seen.add(g);
        return true;
      });
    }
    const noSpecCount = D.catalog.filter((i) => (!brands.size || brands.has(i.b)) && !i.p).length;
    return { count: list.length, weights, results: list, noSpecCount, widened };
  }

  function catalog(params) {
    const brands = new Set((params.get("brands") || "").split(",").filter(Boolean));
    const q = norm(params.get("q") || "");
    const offset = Math.max(0, Number(params.get("offset")) || 0);
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 30));
    const hits = D.catalog.filter((i) => (!brands.size || brands.has(i.b)) && (!q || i.search.includes(q)));
    const withSpec = hits.filter((i) => i.p), without = hits.filter((i) => !i.p);  // รุ่นที่มีสเปกขึ้นก่อน
    const page = [...withSpec, ...without].slice(offset, offset + limit).map((i) => ({
      key: `${i.b}/${i.s}`, brand: i.b, brandName: i.brandName, name: i.n, tablet: !!i.t, phoneId: i.p || null,
      price: i.p ? byId[i.p].price : null, priceEst: i.p ? !!byId[i.p].priceEst : false,
    }));
    return { total: hits.length, offset, items: page };
  }

  function phone(id) {
    const p = byId[id];
    if (!p) throw new Error("ไม่พบรุ่นนี้");
    const allScores = {};
    D.meta.criteria.forEach((c) => (allScores[c.key] = Math.round(criterionScore(p, c.key))));
    return { ...p, allScores };
  }

  return { init, meta: () => D.meta, recommend, catalog, phone };
})();

const api = {
  local: false,
  async meta() {
    try {
      const res = await fetch("/api/meta");
      if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) throw new Error();
      return await res.json();
    } catch {
      await LocalAPI.init();   // ไม่มีเซิร์ฟเวอร์ → โหมดออนไลน์
      this.local = true;
      return LocalAPI.meta();
    }
  },
  async recommend(body) {
    if (this.local) return LocalAPI.recommend(body);
    const res = await fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
  async catalog(params) {
    if (this.local) return LocalAPI.catalog(params);
    return (await fetch(`/api/catalog?${params}`)).json();
  },
  async phone(id) {
    if (this.local) return LocalAPI.phone(id);
    const res = await fetch(`/api/phones/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
};
