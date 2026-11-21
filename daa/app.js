// رسائل «الداء والدواء» — كل مرة تفتح التطبيق تصلك رسالة جديدة من الكتاب مع شرحها.
(() => {
  "use strict";
  const CARDS = window.CARDS || [];
  const TOTAL = CARDS.length;
  const KEY = "daa-letters-v1";
  const AWAY_MS = 15 * 60 * 1000; // العودة بعد ربع ساعة تُعدّ فتحًا جديدًا
  const $app = document.getElementById("app");
  const ar = (n) => Number(n).toLocaleString("ar-EG");

  // ---------- الحالة ----------
  const defaults = () => ({ mode: "seq", perm: CARDS.map((_, i) => i), pos: 0, got: [], favs: [], font: 21, theme: "auto", away: Date.now() });
  let S = load();
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    s = Object.assign(defaults(), s || {});
    // إن تغيّر عدد الرسائل بعد تحديث: أكمل الترتيب بما أضيف
    const seen = new Set(s.perm.filter((i) => i < TOTAL));
    s.perm = s.perm.filter((i) => i < TOTAL);
    CARDS.forEach((_, i) => { if (!seen.has(i)) s.perm.push(i); });
    s.got = s.got.filter((g) => g.i < TOTAL);
    s.favs = s.favs.filter((i) => i < TOTAL);
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  const latest = () => S.got[S.got.length - 1];
  const gotIdx = (i) => S.got.findIndex((g) => g.i === i);
  const unreadCount = () => S.got.filter((g) => !g.read).length;

  // يُسلّم الرسالة التالية. force: حتى لو لم تُقرأ الأخيرة.
  function deliver(force) {
    const last = latest();
    if (last && !last.read && !force) return false;
    if (S.pos >= S.perm.length) return false;
    const i = S.perm[S.pos++];
    if (gotIdx(i) === -1) S.got.push({ i, at: Date.now(), read: false });
    save();
    return true;
  }
  function markRead(i) {
    const g = S.got[gotIdx(i)];
    if (g && !g.read) { g.read = true; save(); }
    updateBadge();
  }

  // ---------- أدوات ----------
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function fmt(t) {
    return esc(t)
      .replace(/\{([^{}]+)\}/g, '<span class="ayah">﴿$1﴾</span>')
      .replace(/"([^"]+)"/g, '<span class="hadith">«$1»</span>');
  }
  function when(ts) {
    const d = new Date(ts), now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff === 0) return "اليوم";
    if (diff === 1) return "أمس";
    try { return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" }); } catch (e) { return d.toDateString(); }
  }
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function applyPrefs() {
    document.documentElement.style.setProperty("--fs", S.font + "px");
    if (S.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", S.theme);
  }
  function updateBadge() {
    const b = document.getElementById("badge"), n = unreadCount();
    b.hidden = !n; b.textContent = ar(n);
  }
  const heart = (on) => `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 20.3S3.5 15 3.5 8.9A4.4 4.4 0 0 1 12 6.8a4.4 4.4 0 0 1 8.5 2.1C20.5 15 12 20.3 12 20.3z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`;

  // ---------- التنقل ----------
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  window.addEventListener("hashchange", render);
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => go("#" + b.dataset.tab)));
  function setTab(t) { document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t)); }

  function render() {
    const h = location.hash.slice(1) || "today";
    const parts = h.split("/");
    window.scrollTo(0, 0);
    if (parts[0] === "m") { setTab("inbox"); viewLetter(+parts[1], true); }
    else if (parts[0] === "inbox") { setTab("inbox"); viewInbox(parts[1] === "fav"); }
    else if (parts[0] === "book") { setTab("book"); viewBook(); }
    else if (parts[0] === "s") { setTab("book"); viewSection(+parts[1], parts[2] != null ? +parts[2] : null); }
    else if (parts[0] === "q") { setTab("book"); viewSearch(decodeURIComponent(parts.slice(1).join("/"))); }
    else { setTab("today"); viewToday(); }
    updateBadge();
  }

  // ---------- رسالتك ----------
  function progressHTML() {
    const n = S.got.length;
    return `<div class="progress"><span>وصلتك ${ar(n)} من ${ar(TOTAL)} رسالة</span><div class="bar"><i style="width:${(100 * n / TOTAL).toFixed(1)}%"></i></div></div>`;
  }
  function viewToday() {
    const last = latest();
    if (!last) { $app.innerHTML = `<p class="empty">لا توجد رسائل.</p>`; return; }
    if (!last.read) return viewEnvelope(last);
    const done = S.pos >= S.perm.length;
    $app.innerHTML = progressHTML() + letterHTML(last.i) + (done
      ? `<div class="next-row"><button class="btn primary" id="again">أتممتَ رسائل الكتاب — ابدأ من جديد</button></div>`
      : `<div class="next-row"><button class="btn primary" id="next">الرسالة التالية ←</button></div><p class="hint">وكل مرة تفتح التطبيق تصلك رسالة جديدة.</p>`);
    bindLetter(last.i);
    const nx = document.getElementById("next");
    if (nx) nx.onclick = () => { deliver(true); render(); };
    const ag = document.getElementById("again");
    if (ag) ag.onclick = restartCycle;
  }
  function viewEnvelope(g) {
    const c = CARDS[g.i];
    $app.innerHTML = progressHTML() + `
      <div class="envelope-wrap">
        <div class="envelope" id="env" role="button" tabindex="0" aria-label="افتح الرسالة">
          <div class="flap"></div>
          <span class="stamp">رقم ${ar(c.n)}</span>
          <div class="wax">د</div>
        </div>
        <div class="env-text">
          <h2>وصلتك رسالة جديدة</h2>
          <p>من ابن القيم — «الداء والدواء»</p>
          <button class="btn primary" id="open">افتح الرسالة</button>
        </div>
      </div>`;
    const env = document.getElementById("env");
    const open = () => {
      env.classList.add("opening");
      markRead(g.i);
      setTimeout(render, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 520);
    };
    env.onclick = open;
    env.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
    document.getElementById("open").onclick = open;
  }

  function letterHTML(i) {
    const c = CARDS[i], g = S.got[gotIdx(i)], fav = S.favs.includes(i);
    return `
    <article class="letter">
      <div class="meta">
        <span class="from"><span class="seal-mini" aria-hidden="true">د</span><span>من: <b>ابن القيم</b></span></span>
        <span>الرسالة ${ar(c.n)}${g ? " · " + when(g.at) : ""}</span>
      </div>
      <h2>${esc(c.t)}</h2>
      <div class="quote">
        <span class="lead">قال رحمه الله:</span>
        ${c.x.map((p) => `<p>${fmt(p)}</p>`).join("")}
      </div>
      <div class="sharh">
        <h3><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18.4 5.6l-2.1 2.1M21 12h-3M9 17h6M10 20.5h4M8.5 14a4.5 4.5 0 1 1 7 0c-.8.8-1.5 1.6-1.5 3h-4c0-1.4-.7-2.2-1.5-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>الشرح</h3>
        <p>${esc(c.s)}</p>
      </div>
      <div class="source">«الداء والدواء» · ${esc(c.sec)} · ص ${ar(c.p)}</div>
      <div class="actions">
        <button class="btn${fav ? " on" : ""}" data-act="fav">${heart(fav)}<span>${fav ? "محفوظة" : "احفظها"}</span></button>
        <button class="btn" data-act="share"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg><span>مشاركة</span></button>
        <button class="btn" data-act="ctx"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5m0-13C14 5 17 4.6 20.5 5v13c-3.5-.4-6.5 0-8.5 1.5m0-13v13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg><span>اقرأها في الكتاب</span></button>
      </div>
    </article>`;
  }
  function bindLetter(i) {
    const c = CARDS[i];
    $app.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", async () => {
      const a = b.dataset.act;
      if (a === "fav") {
        const k = S.favs.indexOf(i);
        if (k === -1) { S.favs.push(i); toast("حُفظت في رسائلك المحفوظة"); } else { S.favs.splice(k, 1); toast("أزيلت من المحفوظة"); }
        save(); const on = k === -1;
        b.classList.toggle("on", on); b.innerHTML = heart(on) + `<span>${on ? "محفوظة" : "احفظها"}</span>`;
      } else if (a === "share") {
        const text = `${c.t}\n\nقال ابن القيم رحمه الله:\n${c.x.join("\n")}\n\nالشرح: ${c.s}\n\n— «الداء والدواء»، ص ${c.p}`;
        try {
          if (navigator.share) await navigator.share({ title: c.t, text });
          else { await navigator.clipboard.writeText(text); toast("نُسخت الرسالة"); }
        } catch (e) {
          if (e && e.name === "AbortError") return;
          try { await navigator.clipboard.writeText(text); toast("نُسخت الرسالة"); } catch (e2) { toast("تعذّرت المشاركة"); }
        }
      } else if (a === "ctx") {
        const book = await getBook();
        if (!book) return;
        const si = book.secs.findIndex((s) => s.a.some((p) => p[0] === c.pid));
        go(`#s/${si}/${c.pid}`);
      }
    }));
  }

  function viewLetter(n, withBack) {
    const i = CARDS.findIndex((c) => c.n === n);
    if (i === -1 || gotIdx(i) === -1) { go("#inbox"); return; }
    markRead(i);
    $app.innerHTML = (withBack ? `<button class="btn back" id="back">→ كل الرسائل</button>` : "") + letterHTML(i);
    bindLetter(i);
    const bk = document.getElementById("back");
    if (bk) bk.onclick = () => history.length > 1 ? history.back() : go("#inbox");
  }

  // ---------- الرسائل ----------
  function viewInbox(favOnly) {
    const list = S.got.slice().reverse().filter((g) => !favOnly || S.favs.includes(g.i));
    $app.innerHTML = `
      <div class="filters">
        <button class="chip${favOnly ? "" : " on"}" data-f="">كل الرسائل (${ar(S.got.length)})</button>
        <button class="chip${favOnly ? " on" : ""}" data-f="fav">المحفوظة (${ar(S.favs.length)})</button>
      </div>
      <div class="list">${list.length ? list.map((g) => {
        const c = CARDS[g.i];
        return `<button class="item${g.read ? "" : " unread"}" data-n="${c.n}">
          <span class="num">${ar(c.n)}</span>
          <span><span class="ttl">${esc(c.t)}</span>${S.favs.includes(g.i) ? ` <span class="heart">♥</span>` : ""}<span class="pre">${esc(c.s)}</span></span>
          <span class="when">${when(g.at)}</span></button>`;
      }).join("") : `<p class="empty">${favOnly ? "لم تحفظ رسالة بعد. اضغط «احفظها» على أي رسالة لتجدها هنا." : "لا رسائل بعد."}</p>`}</div>
      ${S.pos < S.perm.length ? `<p class="hint">باقي ${ar(S.perm.length - S.pos)} رسالة تصلك تباعًا.</p>` : ""}`;
    $app.querySelectorAll(".chip").forEach((b) => b.onclick = () => go(b.dataset.f ? "#inbox/fav" : "#inbox"));
    $app.querySelectorAll(".item").forEach((b) => b.onclick = () => go("#m/" + b.dataset.n));
  }

  // ---------- الكتاب ----------
  let BOOK = null, BOOKP = null;
  function getBook() {
    if (BOOK) return Promise.resolve(BOOK);
    if (!BOOKP) BOOKP = fetch("data/book.json").then((r) => { if (!r.ok) throw 0; return r.json(); })
      .then((b) => (BOOK = b)).catch(() => { BOOKP = null; toast("تعذّر تحميل الكتاب، تحقّق من الاتصال"); return null; });
    return BOOKP;
  }
  const loading = () => { $app.innerHTML = `<p class="empty">جارٍ تحميل الكتاب…</p>`; };
  const norm = (t) => t.replace(/[ً-ْـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

  async function viewBook() {
    if (!BOOK) loading();
    const b = await getBook();
    if (!b || !/^#book/.test(location.hash || "")) return;
    $app.innerHTML = `
      <form id="sf"><input class="search" id="q" type="search" placeholder="ابحث في الكتاب كاملًا…" autocomplete="off"></form>
      <div class="toc">${b.secs.map((s, i) => `<button data-i="${i}"><span>${esc(s.t)}</span><span class="pg">ص ${ar(s.p)}</span></button>`).join("")}</div>`;
    $app.querySelectorAll(".toc button").forEach((x) => x.onclick = () => go("#s/" + x.dataset.i));
    document.getElementById("sf").onsubmit = (e) => { e.preventDefault(); const q = document.getElementById("q").value.trim(); if (q) go("#q/" + encodeURIComponent(q)); };
  }
  async function viewSection(i, pid) {
    if (!BOOK) loading();
    const b = await getBook();
    if (!b) return;
    const s = b.secs[i];
    if (!s) { go("#book"); return; }
    $app.innerHTML = `
      <button class="btn back" id="toc">→ فهرس الكتاب</button>
      <article class="reader">
        <h2>${esc(s.t)}</h2>
        ${s.a.map((p) => `<p id="p${p[0]}"${p[0] === pid ? ' class="hl"' : ""}>${fmt(p[2])}</p>`).join("")}
        <div class="reader-nav">
          ${i > 0 ? `<button class="btn" data-go="${i - 1}">→ السابق</button>` : "<span></span>"}
          <span class="pgnum">ص ${ar(s.p)}</span>
          ${i < b.secs.length - 1 ? `<button class="btn" data-go="${i + 1}">التالي ←</button>` : "<span></span>"}
        </div>
      </article>`;
    document.getElementById("toc").onclick = () => go("#book");
    $app.querySelectorAll("[data-go]").forEach((x) => x.onclick = () => go("#s/" + x.dataset.go));
    if (pid != null) { const el = document.getElementById("p" + pid); if (el) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 60); }
  }
  async function viewSearch(q) {
    if (!BOOK) loading();
    const b = await getBook();
    if (!b) return;
    const nq = norm(q), out = [];
    b.secs.forEach((s, si) => s.a.forEach((p) => {
      if (out.length >= 80) return;
      const nt = norm(p[2]), k = nt.indexOf(nq);
      if (k === -1) return;
      // norm() يحافظ على الطول تقريبًا إلا بحذف التشكيل؛ النص هنا بلا تشكيل فالمواضع متطابقة
      const a = Math.max(0, k - 60), z = Math.min(p[2].length, k + nq.length + 80);
      const snip = (a ? "…" : "") + esc(p[2].slice(a, k)) + "<mark>" + esc(p[2].slice(k, k + nq.length)) + "</mark>" + esc(p[2].slice(k + nq.length, z)) + (z < p[2].length ? "…" : "");
      out.push(`<div class="result" data-s="${si}" data-p="${p[0]}"><small>${esc(s.t)} · ص ${ar(p[1])}</small><span>${snip}</span></div>`);
    }));
    $app.innerHTML = `
      <form id="sf"><input class="search" id="q" type="search" value="${esc(q).replace(/"/g, "&quot;")}" autocomplete="off"></form>
      <p class="hint" style="margin:0 0 8px">${out.length ? (out.length >= 80 ? "أول ٨٠ نتيجة" : ar(out.length) + " نتيجة") : "لا نتائج"}</p>
      ${out.join("")}`;
    document.getElementById("sf").onsubmit = (e) => { e.preventDefault(); const v = document.getElementById("q").value.trim(); if (v) go("#q/" + encodeURIComponent(v)); };
    $app.querySelectorAll(".result").forEach((x) => x.onclick = () => go(`#s/${x.dataset.s}/${x.dataset.p}`));
  }

  // ---------- الإعدادات ----------
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function setMode(m) {
    if (m === S.mode) return;
    const head = S.perm.slice(0, S.pos), rest = S.perm.slice(S.pos);
    S.perm = head.concat(m === "rand" ? shuffle(rest) : rest.sort((x, y) => x - y));
    S.mode = m; save();
  }
  function restartCycle() {
    S.perm = CARDS.map((_, i) => i);
    if (S.mode === "rand") shuffle(S.perm);
    S.pos = 0; S.got = []; save();
    deliver(true); go("#today"); render();
  }
  function openSettings() {
    const m = document.getElementById("modal");
    const seg = (name, val, opts) => `<span class="seg" data-k="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(val) === v ? "on" : ""}">${l}</button>`).join("")}</span>`;
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="الإعدادات">
      <h2>الإعدادات</h2>
      <div class="row"><label>ترتيب الرسائل</label>${seg("mode", S.mode, [["seq", "حسب الكتاب"], ["rand", "عشوائي"]])}</div>
      <div class="row"><label>حجم الخط</label><span class="seg"><button data-fs="-1">أ−</button><button disabled>${ar(S.font)}</button><button data-fs="1">أ+</button></span></div>
      <div class="row"><label>المظهر</label>${seg("theme", S.theme, [["auto", "تلقائي"], ["light", "فاتح"], ["dark", "داكن"]])}</div>
      <div class="row"><label>البدء من الرسالة الأولى</label><button class="btn danger" id="reset">إعادة البدء</button></div>
      <p class="about">النص منقول حرفيًا من كتاب «الداء والدواء» (الجواب الكافي لمن سأل عن الدواء الشافي) للإمام ابن قيم الجوزية (ت ٧٥١هـ)، طبعة دار عالم الفوائد بتحقيق محمد أجمل الإصلاحي، وأرقام الصفحات منها على وجه التقريب. أما «الشرح» فهو تبسيطٌ للمعنى أُضيف لتقريبه، وليس من كلام المؤلف. والكتاب كاملًا في قسم «الكتاب».</p>
      <div class="next-row"><button class="btn primary" id="close">تم</button></div>
    </div>`;
    m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ""; render(); };
    m.onclick = (e) => { if (e.target === m) close(); };
    m.querySelector("#close").onclick = close;
    m.querySelectorAll(".seg[data-k] button").forEach((b) => b.onclick = () => {
      const k = b.parentElement.dataset.k;
      if (k === "mode") { setMode(b.dataset.v); toast(b.dataset.v === "rand" ? "ستصلك الرسائل القادمة عشوائيًا" : "ستصلك الرسائل بترتيب الكتاب"); }
      else { S.theme = b.dataset.v; save(); applyPrefs(); }
      b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    });
    m.querySelectorAll("[data-fs]").forEach((b) => b.onclick = () => {
      S.font = Math.min(30, Math.max(16, S.font + +b.dataset.fs)); save(); applyPrefs();
      b.parentElement.querySelector("[disabled]").textContent = ar(S.font);
    });
    m.querySelector("#reset").onclick = () => {
      const r = m.querySelector("#reset");
      if (r.dataset.sure) { m.hidden = true; m.innerHTML = ""; restartCycle(); toast("بدأتَ من جديد"); return; }
      r.dataset.sure = "1"; r.textContent = "اضغط مرة أخرى للتأكيد";
    };
  }
  document.getElementById("settingsBtn").onclick = openSettings;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const m = document.getElementById("modal"); if (!m.hidden) { m.hidden = true; m.innerHTML = ""; } } });

  // ---------- عند الفتح ----------
  function onOpen() {
    deliver(false);
    S.away = Date.now(); save();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { S.away = Date.now(); save(); return; }
    if (Date.now() - (S.away || 0) > AWAY_MS && deliver(false)) {
      S.away = Date.now(); save();
      if (!location.hash || location.hash === "#today") render(); else updateBadge();
    }
  });

  applyPrefs();
  onOpen();
  if (location.hash && location.hash !== "#today") history.replaceState(null, "", location.pathname + location.search);
  render();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
