/* أكاديمية المتون — تطبيق مستقل لحفظ متون طالب العلم بالمستويات والاختبارات */
(() => {
  "use strict";

  // ---------- Constants ----------
  const STORE = "mutoon-academy-v1";
  const PASS = { lesson: 0.8, matn: 0.85, level: 0.9, review: 0.8 };
  const QCOUNT = { lesson: 10, matn: 15, level: 20, review: 6 };
  const INTERVALS = [1, 2, 4, 7, 15, 30, 60]; // days between reviews
  const DAY = 86400000;
  const SIZES = [1.2, 1.45, 1.7, 2];
  const STOP = new Set(["في", "من", "على", "الى", "إلى", "عن", "ان", "أن", "إن", "او", "أو", "ثم", "لا", "ما", "لم", "لن", "قد", "هو", "هي", "به", "له", "لها", "بها", "منه", "فيه", "عليه", "قال", "وهو", "وهي", "ولا", "ومن", "وما", "التي", "الذي", "هذا", "هذه", "ذلك", "كان", "انه", "أنه", "إنه", "الله", "تعالى", "ﷺ"]);
  const TEXTS = window.M.texts;
  const CUR = window.CURRICULUM;

  // ---------- Utilities ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
  const PUNCT = /[،؛:.!؟?«»﴿﴾()\[\]"'*\-–—…,;]/g;
  const strip = (s) => s.replace(MARKS, "");
  const norm = (s) => strip(s).replace(PUNCT, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/\s+/g, " ").trim();
  const cleanWord = (w) => w.replace(PUNCT, "").trim();
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  const ar = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);
  const countWord = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : ar(n) + " " + (n % 100 >= 3 && n % 100 <= 10 ? few : many));
  const lessonsWord = (n) => countWord(n, "درس واحد", "درسان", "دروس", "درساً");
  const pct = (x) => ar(Math.round(x * 100)) + "٪";
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const isHead = (p) => p.startsWith("#");
  const paraText = (p) => (isHead(p) ? p.slice(1).trim() : p);

  // ---------- Persistent state ----------
  const blank = () => ({ v: 1, lessons: {}, matns: {}, levels: {}, reps: {}, streak: { day: 0, count: 0 }, xp: 0, settings: { theme: "auto", size: 1, harakat: true, free: false } });
  let S;
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(STORE) || "{}")); } catch (e) { S = blank(); }
  S.settings = Object.assign(blank().settings, S.settings || {});
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };

  function applySettings() {
    const root = document.documentElement;
    if (S.settings.theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", S.settings.theme);
    root.style.setProperty("--matn-size", SIZES[S.settings.size] + "rem");
    const dark = S.settings.theme === "dark" || (S.settings.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    $('meta[name="theme-color"]').setAttribute("content", dark ? "#11161d" : "#1d3557");
  }

  function bumpStreak() {
    const t = today();
    if (S.streak.day === t) return;
    S.streak.count = S.streak.day === t - DAY ? S.streak.count + 1 : 1;
    S.streak.day = t;
  }
  function streakNow() {
    const t = today();
    return S.streak.day === t || S.streak.day === t - DAY ? S.streak.count : 0;
  }

  // ---------- Text model ----------
  const cache = {};
  function model(id) {
    if (cache[id]) return cache[id];
    const m = TEXTS[id];
    if (!m) return null;
    const phrases = []; // {li, pi, text, words}
    const bank = new Map(); // norm -> display word
    m.lessons.forEach((L, li) => {
      L.paras.forEach((p, pi) => {
        const t = paraText(p);
        const parts = m.poem ? t.split("|").map((x) => x.trim()) : splitPhrases(t);
        parts.forEach((x) => {
          const words = x.split(/\s+/).filter(Boolean);
          if (words.length) phrases.push({ li, pi, text: x, words, head: isHead(p) });
          words.forEach((w) => {
            const c = cleanWord(w), n = norm(c);
            if (n.length >= 3 && !STOP.has(n) && !bank.has(n)) bank.set(n, c);
          });
        });
      });
    });
    const count = new Map();
    phrases.forEach((p) => { p.n = norm(p.text); count.set(p.n, (count.get(p.n) || 0) + 1); });
    return (cache[id] = { m, phrases, bank: [...bank.entries()], count });
  }

  function splitPhrases(t) {
    let parts = t.split(/(?<=[،؛:.!؟?])\s+|\s+\*\s+/).map((x) => x.trim()).filter(Boolean);
    // merge very short parts with the following one
    const merged = [];
    for (let i = 0; i < parts.length; i++) {
      let x = parts[i];
      while (x.split(/\s+/).length < 3 && i + 1 < parts.length) x += " " + parts[++i];
      merged.push(x);
    }
    if (merged.length > 1 && merged[merged.length - 1].split(/\s+/).length < 3) {
      const tail = merged.pop();
      merged[merged.length - 1] += " " + tail;
    }
    // split very long parts into ~8 word chunks
    const out = [];
    merged.forEach((x) => {
      const w = x.split(/\s+/);
      if (w.length <= 13) { out.push(x); return; }
      const n = Math.ceil(w.length / 8), size = Math.ceil(w.length / n);
      for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(" "));
    });
    return out;
  }

  // ---------- Progress logic ----------
  const lkey = (id, i) => id + ":" + i;
  const lesson = (id, i) => S.lessons[lkey(id, i)];
  const mastered = (id, i) => !!(lesson(id, i) && lesson(id, i).mastered);
  const matnDone = (id) => !!(S.matns[id] && S.matns[id].passed);
  const levelDone = (n) => !!(S.levels[n] && S.levels[n].passed);
  const levelOf = (id) => CUR.find((L) => L.matns.some((x) => x.id === id));

  function levelOpen(n) {
    if (S.settings.free || n === 1) return true;
    return levelDone(n - 1);
  }
  function matnOpen(id) {
    const L = levelOf(id);
    if (!L || !TEXTS[id] || !levelOpen(L.n)) return false;
    if (S.settings.free) return true;
    const idx = L.matns.findIndex((x) => x.id === id);
    return idx === 0 || matnDone(L.matns[idx - 1].id);
  }
  function lessonOpen(id, i) {
    if (!matnOpen(id)) return false;
    return S.settings.free || i === 0 || mastered(id, i - 1);
  }
  function matnProgress(id) {
    const m = TEXTS[id];
    if (!m) return 0;
    const n = m.lessons.length;
    let d = 0;
    for (let i = 0; i < n; i++) if (mastered(id, i)) d++;
    return d / n;
  }
  function overall() {
    let total = 0, done = 0;
    CUR.forEach((L) => L.matns.forEach((x) => {
      const m = TEXTS[x.id];
      if (!m) return;
      total += m.lessons.length;
      for (let i = 0; i < m.lessons.length; i++) if (mastered(x.id, i)) done++;
    }));
    return { total, done, p: total ? done / total : 0 };
  }
  function dueReviews() {
    const t = Date.now();
    return Object.entries(S.lessons)
      .filter(([k, v]) => v.mastered && v.due && v.due <= t && TEXTS[k.split(":")[0]])
      .map(([k, v]) => ({ id: k.split(":")[0], i: +k.split(":")[1], v }))
      .sort((a, b) => a.v.due - b.v.due);
  }
  function nextStep() {
    for (const L of CUR) {
      if (!levelOpen(L.n)) return null;
      for (const x of L.matns) {
        const m = TEXTS[x.id];
        if (!m || !matnOpen(x.id)) continue;
        for (let i = 0; i < m.lessons.length; i++) if (!mastered(x.id, i)) return { type: "lesson", id: x.id, i };
        if (!matnDone(x.id)) return { type: "matnExam", id: x.id };
      }
      const allHave = L.matns.every((x) => TEXTS[x.id]);
      if (allHave && !levelDone(L.n) && L.matns.every((x) => matnDone(x.id))) return { type: "levelExam", n: L.n };
      if (!levelDone(L.n) && !S.settings.free) return null;
    }
    return null;
  }
  const starsOf = (score) => (score >= 1 ? 3 : score >= 0.9 ? 2 : score >= 0.8 ? 1 : 0);
  const starsHtml = (n) => '<span class="stars">' + [0, 1, 2].map((k) => (k < n ? "★" : '<span class="off">★</span>')).join("") + "</span>";

  // ---------- Question generation ----------
  function blankQ(ph, typed) {
    const idxs = ph.words.map((w, k) => k).filter((k) => {
      const n = norm(cleanWord(ph.words[k]));
      return n.length >= 3 && !STOP.has(n) && !/\d/.test(n);
    });
    if (!idxs.length) return null;
    const k = pick(idxs);
    const answer = cleanWord(ph.words[k]);
    return { kind: typed ? "type" : "blank", ph, k, answer, key: (typed ? "t" : "b") + ph.text + k };
  }
  function withOptions(q, md) {
    if (q.kind !== "blank") return q;
    const an = norm(q.answer);
    const near = md.bank.filter(([n]) => n !== an && Math.abs(n.length - an.length) <= 2);
    const pool = shuffle(near.length >= 3 ? near : md.bank.filter(([n]) => n !== an));
    const seen = new Set([an]), opts = [];
    for (const [n, w] of pool) {
      if (seen.has(n) || formsPhrase(md, q, w)) continue;
      seen.add(n); opts.push(w);
      if (opts.length === 3) break;
    }
    if (opts.length < 3) return null;
    q.options = shuffle([q.answer, ...opts]);
    return q;
  }
  function formsPhrase(md, q, w) {
    const t = norm(q.ph.words.map((x, k) => (k === q.k ? w : x)).join(" "));
    return md.count.has(t);
  }
  function nextQ(md, idx) {
    const a = md.phrases[idx], b = md.phrases[idx + 1];
    if (!b || a.li !== b.li || md.count.get(a.n) > 1) return null;
    const bn = norm(b.text);
    const pool = shuffle(md.phrases.filter((p) => norm(p.text) !== bn && norm(p.text) !== norm(a.text)));
    const seen = new Set([bn]), opts = [];
    for (const p of pool) { const n = norm(p.text); if (!seen.has(n)) { seen.add(n); opts.push(p.text); } if (opts.length === 3) break; }
    if (opts.length < 3) return null;
    return { kind: "next", ph: a, answer: b.text, options: shuffle([b.text, ...opts]), key: "n" + idx };
  }
  function orderQ(md, list) {
    // list: indexes of phrases within one lesson
    const cands = [];
    for (let s = 0; s + 2 < list.length; s++) cands.push(s);
    if (!cands.length) return null;
    const s = pick(cands);
    const len = Math.min(4, list.length - s);
    const items = list.slice(s, s + len).map((i) => md.phrases[i].text);
    if (new Set(items.map(norm)).size !== items.length || items.some((x) => x.split(/\s+/).length > 16)) return null;
    let sh = shuffle(items), guard = 0;
    while (sh.every((x, i) => x === items[i]) && guard++ < 10) sh = shuffle(items);
    return { kind: "order", items, shuffled: sh, key: "o" + list[s] };
  }
  function whichQ(md, ph, level) {
    const titles = level.matns.filter((x) => TEXTS[x.id]).map((x) => TEXTS[x.id].title);
    if (titles.length < 2) return null;
    return { kind: "which", ph, answer: md.m.title, options: shuffle(titles), key: "w" + ph.text };
  }

  // Build a quiz from a set of {id, lessons:[i...]} with given count & mix.
  function buildQuiz(sources, count, opts = {}) {
    const qs = [], keys = new Set();
    const pools = sources.map((s) => {
      const md = model(s.id);
      const idx = md.phrases.map((p, i) => i).filter((i) => s.lessons.includes(md.phrases[i].li) && !md.phrases[i].head);
      return { md, idx, lessons: s.lessons };
    }).filter((p) => p.idx.length);
    if (!pools.length) return qs;
    const plan = [];
    const mix = opts.mix || ["blank", "next", "blank", "order", "next", "blank", "type", "next", "blank", "blank"];
    for (let i = 0; i < count; i++) plan.push(mix[i % mix.length]);
    if (opts.which) for (let i = 2; i < count; i += 5) plan[i] = "which";
    let tries = 0;
    for (let pi = 0; qs.length < count && tries < count * 40; tries++) {
      const want = plan[pi % plan.length];
      const P = pick(pools);
      let q = null;
      const ix = pick(P.idx);
      const ph = P.md.phrases[ix];
      if (want === "blank") q = withOptions(blankQ(ph, false) || {}, P.md);
      else if (want === "type") q = blankQ(ph, true);
      else if (want === "next") q = nextQ(P.md, ix);
      else if (want === "which") q = whichQ(P.md, ph, levelOf(P.md.m.id));
      else if (want === "order") {
        const li = pick(P.lessons);
        q = orderQ(P.md, P.idx.filter((i) => P.md.phrases[i].li === li));
      }
      if (!q || !q.kind) { if (tries % 6 === 5) pi++; continue; } // fall through to another kind after a few failures
      if (keys.has(q.key)) continue;
      keys.add(q.key); q.src = P.md.m.id; qs.push(q); pi++;
    }
    return shuffle(qs);
  }

  // ---------- Rendering helpers ----------
  const app = $("#app");
  function setTop(title, back) {
    $("#topTitle").textContent = title || "أكاديمية المتون";
    $("#backBtn").hidden = !back;
    $("#streak").innerHTML = "🔥 <b>" + ar(streakNow()) + "</b>";
    document.title = title ? title + " — أكاديمية المتون" : "أكاديمية المتون";
  }
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  const show = (txt) => (S.settings.harakat ? txt : strip(txt));

  // Render paragraphs as words with Quran/hadith colouring. mode: read | hide | first | all
  function renderMatn(m, paras, mode = "read", baseKey = 0) {
    let inQ = false, inH = false, wi = 0;
    const out = paras.map((p) => {
      const head = isHead(p);
      const t = paraText(p);
      const basm = strip(t).replace(/\s+/g, " ") === "بسم الله الرحمن الرحيم";
      const wordsHtml = (str) => str.split(/\s+/).filter(Boolean).map((w) => {
        if (w.includes("﴿")) inQ = true;
        if (w.includes("«")) inH = true;
        const cls = ["w"];
        if (inQ) cls.push("q"); else if (inH) cls.push("h");
        if (w.includes("﴾")) inQ = false;
        if (w.includes("»")) inH = false;
        const id = baseKey + wi++;
        const n = norm(w);
        let html = esc(show(w));
        if (!head && !basm && n && mode !== "read") {
          const hide = mode === "all" || mode === "first" || (mode === "hide" && hash(id) % 100 < 55);
          if (hide) {
            if (mode === "first") {
              const first = (w.match(/^[«﴿(]*[^ً-ٰٟ][ً-ٰٟ]*/) || [w])[0];
              return '<span class="' + cls.join(" ") + ' hint" data-w="' + esc(show(w)) + '">' + esc(show(first)) + "</span>";
            }
            cls.push("hid");
            return '<span class="' + cls.join(" ") + '" data-w="1">' + html + "</span>";
          }
        }
        return '<span class="' + cls.join(" ") + '">' + html + "</span>";
      }).join(" ");
      if (m.poem && t.includes("|")) {
        const [a, b] = t.split("|");
        return '<div class="bayt"><span>' + wordsHtml(a.trim()) + "</span><span>" + wordsHtml(b.trim()) + "</span></div>";
      }
      const cls = head ? "head" : basm ? "basmala" : "";
      return "<p" + (cls ? ' class="' + cls + '"' : "") + ">" + wordsHtml(t) + "</p>";
    });
    return '<div class="matn' + (m.poem ? " poem" : "") + '">' + out.join("") + "</div>";
  }
  function hash(n) { let x = (n + 1) * 2654435761; x ^= x >>> 13; return Math.abs(x) >>> 0; }

  // ---------- Views ----------
  function viewHome() {
    setTop("", false);
    const o = overall();
    const due = dueReviews();
    const step = nextStep();
    const mastCount = Object.values(S.lessons).filter((v) => v.mastered).length;
    const certs = Object.values(S.matns).filter((v) => v.passed).length;
    let stepHtml = "";
    if (step) {
      let title, sub, href;
      if (step.type === "lesson") {
        const m = TEXTS[step.id];
        title = m.lessons[step.i].title; sub = m.title + " · الدرس " + ar(step.i + 1) + " من " + ar(m.lessons.length);
        href = "#/lesson/" + step.id + "/" + step.i;
      } else if (step.type === "matnExam") {
        title = "الاختبار النهائي: " + TEXTS[step.id].title; sub = "أتقنت جميع الدروس — اجتز الاختبار لتنال شهادة المتن";
        href = "#/exam/matn/" + step.id;
      } else {
        title = "اختبار " + CUR[step.n - 1].name; sub = "اجتز اختبار المستوى لينفتح المستوى التالي";
        href = "#/exam/level/" + step.n;
      }
      stepHtml = '<div class="card fade-in"><div class="muted small">تابع من حيث توقفت</div><h2 style="margin:4px 0 2px">' + esc(title) + '</h2><div class="muted small">' + esc(sub) + '</div><div class="btns" style="margin-top:12px"><a class="btn" href="' + href + '">ابدأ الآن</a></div></div>';
    } else if (o.total && o.done === o.total) {
      stepHtml = '<div class="card tip">أتممت جميع الدروس المتاحة — بارك الله فيك. واظب على المراجعة ليبقى الحفظ متقناً.</div>';
    }
    const reviewHtml = due.length
      ? '<a class="card row fade-in" href="#/review" style="text-decoration:none;color:inherit"><span class="level-num" style="background:var(--good-soft);color:var(--good)">↻</span><div class="grow"><h3>مراجعة اليوم</h3><div class="muted small">' + ar(due.length) + " " + (due.length === 1 ? "درس حان موعد مراجعته" : "دروس حان موعد مراجعتها") + '</div></div><span class="pill good">راجع</span></a>'
      : "";
    const levels = CUR.map((L) => {
      const open = levelOpen(L.n);
      const done = levelDone(L.n);
      const items = L.matns.map((x, k) => {
        const m = TEXTS[x.id];
        const op = m && matnOpen(x.id);
        const p = matnProgress(x.id);
        let pill;
        if (!m) pill = '<span class="pill lock">قيد الإعداد</span>';
        else if (matnDone(x.id)) pill = '<span class="pill good">مُجاز ✓</span>';
        else if (!op) pill = '<span class="pill lock">🔒</span>';
        else pill = '<span class="pill blue">' + pct(p) + "</span>";
        return '<button class="matn-item" data-go="#/matn/' + x.id + '"' + (m ? "" : " disabled") + '><span class="matn-ico">' + ar(k + 1) + '</span><span class="grow"><b>' + esc(x.title) + "</b>" +
          (m ? '<div class="muted small">' + lessonsWord(m.lessons.length) + " · " + esc(m.author) + '</div><div class="bar"><i style="width:' + Math.round(p * 100) + '%"></i></div>' : "") +
          "</span>" + pill + "</button>";
      }).join("");
      return '<section class="card level' + (open ? "" : " locked") + ' fade-in"><div class="level-head"><span class="level-num">' + ar(L.n) + '</span><div class="grow"><h2>' + L.name + '</h2><div class="muted small">' + L.desc + "</div></div>" +
        (done ? '<span class="pill good">مُتقن ✓</span>' : open ? "" : '<span class="pill lock">🔒 مقفل</span>') + '</div><div class="matn-list">' + items + "</div></section>";
    }).join("");
    app.innerHTML =
      '<div class="stack">' +
      '<section class="card hero fade-in"><div class="row"><div class="grow"><div class="muted small">متون طالب العلم</div><h1>رحلتك إلى الإتقان</h1><div class="muted small" style="margin-top:4px">احفظ المتون درساً درساً، واجتز الاختبارات لتنتقل من مستوى إلى مستوى.</div></div><div class="ring" style="--p:' + Math.round(o.p * 100) + '"><span>' + pct(o.p) + "</span></div></div>" +
      '<div class="stats"><div class="stat"><b>' + ar(mastCount) + '</b><span>درس متقن</span></div><div class="stat"><b>' + ar(certs) + '</b><span>متن مُجاز</span></div><div class="stat"><b>' + ar(S.xp) + "</b><span>نقطة</span></div></div></section>" +
      reviewHtml + stepHtml +
      '<div class="section-title"><h2>المستويات</h2><a class="small" href="#/method">منهج الأكاديمية</a></div>' + levels +
      '<p class="muted small" style="text-align:center;margin-top:22px">النصوص من كتاب «متون طالب العلم» — جمع وترتيب وتحقيق د. عبد المحسن بن محمد القاسم</p>' +
      "</div>";
  }

  function viewMatn(id) {
    const m = TEXTS[id];
    if (!m) return go("#/");
    const L = levelOf(id);
    setTop(m.title, true);
    const open = matnOpen(id);
    const p = matnProgress(id);
    const allMastered = p === 1;
    const lessons = m.lessons.map((Ls, i) => {
      const done = mastered(id, i);
      const op = lessonOpen(id, i);
      const cur = op && !done && (i === 0 || mastered(id, i - 1));
      const st = lesson(id, i);
      return '<button class="lesson-item' + (done ? " done" : "") + (cur ? " current" : "") + '" data-go="#/lesson/' + id + "/" + i + '"' + (op ? "" : " disabled") + '><span class="num">' + (done ? "✓" : op ? ar(i + 1) : "🔒") + '</span><span class="grow"><b>' + esc(Ls.title) + "</b>" +
        (st && st.best ? '<div class="muted small">أفضل نتيجة: ' + pct(st.best) + "</div>" : "") + "</span>" + (done ? starsHtml(st.stars || 1) : "") + "</button>";
    }).join("");
    const examDone = matnDone(id);
    const exam = '<button class="lesson-item exam-item' + (examDone ? " done" : allMastered ? " current" : "") + '" data-go="#/exam/matn/' + id + '"' + (allMastered && open ? "" : " disabled") + '><span class="num">' + (examDone ? "✓" : "🎓") + '</span><span class="grow"><b>الاختبار النهائي للمتن</b><div class="muted small">' + ar(QCOUNT.matn) + " سؤالاً من كل الدروس · النجاح " + pct(PASS.matn) + "</div></span>" + (examDone ? '<span class="pill good">' + pct(S.matns[id].score) + "</span>" : "") + "</button>";
    app.innerHTML =
      '<div class="stack fade-in"><section class="card"><div class="muted small">' + esc(L.name) + "</div><h1>" + esc(m.fullTitle || m.title) + '</h1><div class="muted">' + esc(m.author) + (m.died ? " (ت " + esc(m.died) + ")" : "") + "</div>" +
      '<div class="row" style="margin-top:12px"><div class="grow"><div class="bar"><i style="width:' + Math.round(p * 100) + '%"></i></div></div><b>' + pct(p) + "</b></div>" +
      (open ? "" : '<div class="tip" style="margin-top:12px">هذا المتن مقفل حتى تُجاز في المتن الذي قبله. يمكنك قراءته الآن، وتُفتح الاختبارات عند وصولك إليه.</div>') +
      '<div class="btns" style="margin-top:12px"><a class="btn secondary" href="#/read/' + id + '">قراءة المتن كاملاً</a></div></section>' +
      (examDone ? '<a class="btn gold block" href="#/cert/matn/' + id + '">عرض شهادة الإجازة في المتن</a>' : "") +
      '<div class="section-title"><h2>الدروس</h2><span class="muted small">' + ar(m.lessons.filter((_, i) => mastered(id, i)).length) + " / " + ar(m.lessons.length) + '</span></div><div class="path">' + lessons + exam + "</div></div>";
  }

  function viewRead(id) {
    const m = TEXTS[id];
    if (!m) return go("#/");
    setTop(m.title, true);
    app.innerHTML = '<div class="stack fade-in"><section class="card"><h1 style="text-align:center;font-family:Amiri,serif">' + esc(m.fullTitle || m.title) + '</h1><div class="muted" style="text-align:center">' + esc(m.author) + '</div></section>' +
      m.lessons.map((L, i) => '<section class="card"><div class="row" style="margin-bottom:8px"><span class="pill">الدرس ' + ar(i + 1) + '</span><h3 class="grow">' + esc(L.title) + "</h3></div>" + renderMatn(m, L.paras) + "</section>").join("") + "</div>";
  }

  // Lesson view with tabs: read / memorize / test
  function viewLesson(id, i, tab) {
    const m = TEXTS[id];
    if (!m || !m.lessons[i]) return go("#/");
    const L = m.lessons[i];
    setTop(m.title, true);
    const open = lessonOpen(id, i);
    tab = tab || (mastered(id, i) ? "read" : "read");
    const st = lesson(id, i);
    const head = '<section class="card"><div class="row"><span class="pill">الدرس ' + ar(i + 1) + " من " + ar(m.lessons.length) + '</span>' + (st && st.mastered ? '<span class="pill good">متقن ✓</span>' + starsHtml(st.stars || 1) : "") + '</div><h2 style="margin-top:8px">' + esc(L.title) + "</h2></section>";
    const tabs = '<div class="tabs" role="tablist">' + [["read", "اقرأ"], ["hifz", "احفظ"], ["test", "اختبر"]].map(([k, v]) => '<button class="tab' + (tab === k ? " active" : "") + '" data-go="#/lesson/' + id + "/" + i + "/" + k + '">' + v + "</button>").join("") + "</div>";
    let body = "";
    if (tab === "read") {
      body = '<section class="card">' + renderMatn(m, L.paras) + '</section><div class="tip small">اقرأ الدرس بتأنٍّ مع ضبط الحركات، ثم انتقل إلى «احفظ».</div><div class="btns"><a class="btn" href="#/lesson/' + id + "/" + i + '/hifz">انتقل إلى الحفظ</a></div>';
    } else if (tab === "hifz") {
      const mode = viewLesson.mode || "read";
      const reps = S.reps[lkey(id, i)] || 0;
      body =
        '<div class="toolbar">' + [["read", "النص كاملاً"], ["hide", "إخفاء جزئي"], ["first", "أوائل الكلمات"], ["all", "إخفاء الكل"]].map(([k, v]) => '<button class="chip' + (mode === k ? " active" : "") + '" data-mode="' + k + '">' + v + "</button>").join("") + "</div>" +
        '<section class="card" id="hifzText">' + renderMatn(m, L.paras, mode) + "</section>" +
        (mode !== "read" ? '<div class="muted small" style="text-align:center">اضغط على أي كلمة مخفية لكشفها · <button class="btn ghost" id="rehide" style="min-height:0;padding:2px 6px">أعد الإخفاء</button></div>' : "") +
        '<section class="card counter"><div><h3>عدّاد التكرار</h3><div class="muted small">كرّر الدرس حفظاً عشرين مرة حتى يثبت، ثم اختبر نفسك.</div><div class="bar" style="margin-top:8px"><i style="width:' + Math.min(100, reps * 5) + '%"></i></div></div><button class="count-btn" id="countBtn" aria-label="تكرار">' + ar(reps) + "</button></section>" +
        '<div class="btns"><a class="btn" href="#/lesson/' + id + "/" + i + '/test">أنا جاهز للاختبار</a></div>';
    } else {
      body = open
        ? '<section class="card stack"><h3>اختبار الدرس</h3><div class="muted">' + ar(QCOUNT.lesson) + " أسئلة متنوعة: أكمل الكلمة، وما الذي يلي، ورتّب المقاطع، واكتب الكلمة الناقصة.</div><div class=\"tip small\">النجاح بنسبة " + pct(PASS.lesson) + " فأكثر يجعل الدرس «متقناً» ويفتح الدرس التالي، ثم يدخل جدول المراجعة.</div><button class=\"btn block\" data-start=\"lesson\">ابدأ الاختبار</button></section>"
        : '<section class="card empty"><h3>🔒 الاختبار مقفل</h3><p class="muted">أتقن الدرس السابق أولاً ليُفتح هذا الاختبار.</p></section>';
    }
    const nav = '<div class="btns">' + (i > 0 ? '<a class="btn secondary" href="#/lesson/' + id + "/" + (i - 1) + '">الدرس السابق</a>' : "") + (i + 1 < m.lessons.length && lessonOpen(id, i + 1) ? '<a class="btn secondary" href="#/lesson/' + id + "/" + (i + 1) + '">الدرس التالي</a>' : "") + "</div>";
    app.innerHTML = '<div class="stack fade-in">' + head + tabs + body + nav + "</div>";
    if (tab === "hifz") bindHifz(id, i);
    const sb = app.querySelector("[data-start]");
    if (sb) sb.onclick = () => startQuiz({ type: "lesson", id, i });
  }

  function bindHifz(id, i) {
    app.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { viewLesson.mode = b.dataset.mode; viewLesson(id, i, "hifz"); }));
    const box = $("#hifzText");
    box.onclick = (e) => {
      const w = e.target.closest(".w.hid, .w.hint");
      if (!w) return;
      if (w.classList.contains("hint")) { w.textContent = w.dataset.w; w.classList.remove("hint"); }
      else w.classList.remove("hid");
      w.classList.add("shown");
    };
    const rh = $("#rehide");
    if (rh) rh.onclick = () => viewLesson(id, i, "hifz");
    $("#countBtn").onclick = () => {
      const k = lkey(id, i);
      S.reps[k] = (S.reps[k] || 0) + 1;
      save();
      $("#countBtn").textContent = ar(S.reps[k]);
      $("#countBtn").previousElementSibling.querySelector(".bar i").style.width = Math.min(100, S.reps[k] * 5) + "%";
      if (S.reps[k] === 20) toast("أحسنت! عشرون تكراراً — جرّب الاختبار الآن");
    };
  }

  // ---------- Quiz engine ----------
  let Q = null;
  function startQuiz(ctx) {
    let sources, count, opts = {};
    if (ctx.type === "lesson" || ctx.type === "review") {
      sources = [{ id: ctx.id, lessons: [ctx.i] }];
      count = QCOUNT[ctx.type];
    } else if (ctx.type === "matn") {
      sources = [{ id: ctx.id, lessons: TEXTS[ctx.id].lessons.map((_, k) => k) }];
      count = QCOUNT.matn;
      opts.mix = ["blank", "next", "type", "blank", "order", "next"];
    } else {
      const L = CUR[ctx.n - 1];
      sources = L.matns.filter((x) => TEXTS[x.id]).map((x) => ({ id: x.id, lessons: TEXTS[x.id].lessons.map((_, k) => k) }));
      count = QCOUNT.level;
      opts = { which: true, mix: ["blank", "next", "type", "blank", "next", "order"] };
    }
    const qs = buildQuiz(sources, count, opts);
    if (!qs.length) { toast("تعذّر إنشاء الاختبار"); return; }
    Q = { ctx, qs, i: 0, right: 0, wrong: [], answered: false };
    renderQ();
  }

  function quizTitle(ctx) {
    if (ctx.type === "lesson") return "اختبار: " + TEXTS[ctx.id].lessons[ctx.i].title;
    if (ctx.type === "review") return "مراجعة: " + TEXTS[ctx.id].lessons[ctx.i].title;
    if (ctx.type === "matn") return "الاختبار النهائي: " + TEXTS[ctx.id].title;
    return "اختبار " + CUR[ctx.n - 1].name;
  }

  function context(q) {
    const md = model(q.src), i = md.phrases.indexOf(q.ph), prev = md.phrases[i - 1];
    return prev && prev.li === q.ph.li && !prev.head ? '<span class="muted">' + esc(show(prev.text)) + "</span> " : "";
  }
  function phraseWithBlank(q) {
    return context(q) + q.ph.words.map((w, k) => (k === q.k ? '<span class="blank"></span>' : esc(show(w)))).join(" ");
  }

  function renderQ() {
    const q = Q.qs[Q.i];
    setTop(quizTitle(Q.ctx), true);
    const prog = '<div class="q-top"><div class="grow"><div class="bar"><i style="width:' + Math.round((Q.i / Q.qs.length) * 100) + '%"></i></div></div><b class="small">' + ar(Q.i + 1) + " / " + ar(Q.qs.length) + "</b></div>";
    let kind = "", prompt = "", area = "";
    if (q.kind === "blank") {
      kind = "اختر الكلمة الناقصة";
      prompt = phraseWithBlank(q);
      area = '<div class="opts">' + q.options.map((o, k) => '<button class="opt" data-o="' + k + '">' + esc(show(o)) + "</button>").join("") + "</div>";
    } else if (q.kind === "type") {
      kind = "اكتب الكلمة الناقصة";
      prompt = phraseWithBlank(q);
      area = '<input class="type-in" id="typeIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="اكتب الكلمة (بلا تشكيل)"><div class="btns"><button class="btn" id="checkType">تحقق</button><button class="btn secondary" id="hintType">تلميح</button></div>';
    } else if (q.kind === "next") {
      kind = "ما الذي يلي هذا المقطع؟";
      prompt = esc(show(q.ph.text)) + " …";
      area = '<div class="opts">' + q.options.map((o, k) => '<button class="opt" data-o="' + k + '">' + esc(show(o)) + "</button>").join("") + "</div>";
    } else if (q.kind === "which") {
      kind = "من أي متن هذا النص؟";
      prompt = "«" + esc(show(q.ph.text)) + "»";
      area = '<div class="opts">' + q.options.map((o, k) => '<button class="opt ui" data-o="' + k + '">' + esc(o) + "</button>").join("") + "</div>";
    } else if (q.kind === "order") {
      kind = "رتّب المقاطع كما وردت في المتن";
      prompt = "";
      area = '<div class="order-picked" id="picked"></div><div class="opts" id="pool">' + q.shuffled.map((o, k) => '<button class="opt" data-k="' + k + '">' + esc(show(o)) + "</button>").join("") + '</div><button class="btn block" id="checkOrder" disabled>تحقق</button>';
    }
    app.innerHTML = '<div class="stack fade-in">' + prog + '<section class="card stack"><div class="q-kind">' + kind + "</div>" + (prompt ? '<div class="q-prompt">' + prompt + "</div>" : "") + "</section>" + area + '<div id="fb"></div></div>';
    Q.answered = false;
    bindQ(q);
  }

  function bindQ(q) {
    if (q.kind === "blank" || q.kind === "next" || q.kind === "which") {
      app.querySelectorAll(".opt[data-o]").forEach((b) => (b.onclick = () => {
        if (Q.answered) return;
        const chosen = q.options[+b.dataset.o];
        const ok = chosen === q.answer;
        app.querySelectorAll(".opt[data-o]").forEach((x) => { x.disabled = true; if (q.options[+x.dataset.o] === q.answer) x.classList.add("correct"); });
        if (!ok) b.classList.add("wrong");
        answer(ok, q);
      }));
    } else if (q.kind === "type") {
      const inp = $("#typeIn");
      setTimeout(() => inp.focus(), 50);
      const check = () => {
        if (Q.answered) return;
        const v = inp.value.trim();
        if (!v) { inp.focus(); return; }
        const ok = norm(v) === norm(q.answer) || (v.split(/\s+/).length === 1 && formsPhrase(model(q.src), q, v));
        inp.disabled = true; $("#checkType").disabled = true; $("#hintType").disabled = true;
        inp.style.borderColor = ok ? "var(--good)" : "var(--bad)";
        answer(ok, q);
      };
      $("#checkType").onclick = check;
      inp.onkeydown = (e) => { if (e.key === "Enter") check(); };
      $("#hintType").onclick = () => {
        const a = strip(q.answer);
        q.hinted = (q.hinted || 0) + 1;
        inp.placeholder = a.slice(0, Math.min(a.length - 1, q.hinted)) + "…";
        inp.focus();
      };
    } else if (q.kind === "order") {
      const picked = [];
      const pool = $("#pool"), pk = $("#picked"), btn = $("#checkOrder");
      const redraw = () => {
        pk.innerHTML = picked.map((k, n) => '<button class="opt" data-p="' + n + '">' + ar(n + 1) + ". " + esc(show(q.shuffled[k])) + "</button>").join("");
        pool.querySelectorAll(".opt").forEach((b) => (b.hidden = picked.includes(+b.dataset.k)));
        btn.disabled = picked.length !== q.shuffled.length;
        pk.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { if (Q.answered) return; picked.splice(+b.dataset.p, 1); redraw(); }));
      };
      pool.querySelectorAll(".opt").forEach((b) => (b.onclick = () => { if (Q.answered) return; picked.push(+b.dataset.k); redraw(); }));
      btn.onclick = () => {
        if (Q.answered) return;
        const ok = picked.every((k, n) => q.shuffled[k] === q.items[n]);
        pk.querySelectorAll(".opt").forEach((b, n) => b.classList.add(q.shuffled[picked[n]] === q.items[n] ? "correct" : "wrong"));
        btn.hidden = true;
        answer(ok, q);
      };
    }
  }

  function correctText(q) {
    if (q.kind === "order") return q.items.map((x, n) => ar(n + 1) + ". " + esc(show(x))).join("<br>");
    if (q.kind === "blank" || q.kind === "type") return q.ph.words.map((w, k) => (k === q.k ? "<b style=\"color:var(--good)\">" + esc(show(w)) + "</b>" : esc(show(w)))).join(" ");
    if (q.kind === "next") return esc(show(q.ph.text)) + " <b style=\"color:var(--good)\">" + esc(show(q.answer)) + "</b>";
    return esc(q.answer);
  }

  function answer(ok, q) {
    Q.answered = true;
    if (ok) Q.right++; else Q.wrong.push(q);
    const last = Q.i + 1 >= Q.qs.length;
    $("#fb").innerHTML = '<div class="feedback ' + (ok ? "good" : "bad") + ' fade-in">' + (ok ? pick(["أحسنت! ✓", "إجابة صحيحة ✓", "بارك الله فيك ✓", "ممتاز ✓"]) : "ليست الإجابة الصحيحة — الصواب:") +
      (ok ? "" : '<div class="answer">' + correctText(q) + "</div>") + '</div><button class="btn block" id="nextQ" style="margin-top:12px">' + (last ? "عرض النتيجة" : "السؤال التالي") + "</button>";
    const nb = $("#nextQ");
    nb.onclick = () => { if (last) finishQuiz(); else { Q.i++; renderQ(); window.scrollTo(0, 0); } };
    nb.scrollIntoView({ behavior: "smooth", block: "nearest" });
    nb.focus({ preventScroll: true });
  }

  function finishQuiz() {
    const { ctx } = Q;
    Q.done = true;
    const score = Q.right / Q.qs.length;
    S.xp += Q.right * 10;
    bumpStreak();
    let passed = false, msg = "", extra = "", nextHref = "#/";
    if (ctx.type === "lesson" || ctx.type === "review") {
      const k = lkey(ctx.id, ctx.i);
      const rec = S.lessons[k] || { best: 0, stars: 0, mastered: false, box: 0, tries: 0 };
      rec.tries = (rec.tries || 0) + 1;
      rec.best = Math.max(rec.best || 0, score);
      passed = score >= PASS[ctx.type];
      if (ctx.type === "lesson") {
        if (passed) {
          const first = !rec.mastered;
          rec.mastered = true; rec.stars = Math.max(rec.stars || 0, starsOf(score));
          if (first) { rec.box = 0; rec.due = today() + INTERVALS[0] * DAY; }
        }
      } else {
        if (passed) rec.box = Math.min(INTERVALS.length - 1, (rec.box || 0) + 1);
        else rec.box = 0;
        rec.due = today() + INTERVALS[rec.box] * DAY;
        rec.stars = Math.max(rec.stars || 0, starsOf(score));
      }
      S.lessons[k] = rec;
      const m = TEXTS[ctx.id];
      if (ctx.type === "lesson") {
        if (passed) {
          msg = "أتقنت هذا الدرس! ";
          if (ctx.i + 1 < m.lessons.length) { nextHref = "#/lesson/" + ctx.id + "/" + (ctx.i + 1); msg += "انفتح الدرس التالي."; }
          else { nextHref = "#/exam/matn/" + ctx.id; msg += "أتممت دروس المتن — حان وقت الاختبار النهائي."; }
          extra = '<div class="muted small">سيذكّرك التطبيق بمراجعته غداً بإذن الله.</div>';
        } else { msg = "تحتاج إلى " + pct(PASS.lesson) + " للإتقان. راجع الحفظ ثم أعد المحاولة."; nextHref = "#/lesson/" + ctx.id + "/" + ctx.i + "/hifz"; }
      } else {
        msg = passed ? "مراجعة موفقة — الموعد القادم بعد " + ar(INTERVALS[rec.box]) + " " + (INTERVALS[rec.box] === 1 ? "يوم" : INTERVALS[rec.box] <= 10 ? "أيام" : "يوماً") + "." : "يحتاج هذا الدرس إلى تثبيت؛ سنعيده عليك غداً.";
        nextHref = "#/review";
      }
    } else if (ctx.type === "matn") {
      passed = score >= PASS.matn;
      const prev = S.matns[ctx.id];
      if (passed) S.matns[ctx.id] = { passed: true, score: Math.max(score, prev && prev.score || 0), at: Date.now() };
      msg = passed ? "مبارك! أُجزت في متن «" + TEXTS[ctx.id].title + "»." : "النجاح يحتاج " + pct(PASS.matn) + ". راجع الدروس التي أخطأت فيها ثم أعد المحاولة.";
      nextHref = passed ? "#/cert/matn/" + ctx.id : "#/matn/" + ctx.id;
    } else {
      passed = score >= PASS.level;
      if (passed) S.levels[ctx.n] = { passed: true, score, at: Date.now() };
      msg = passed ? "مبارك! أتممت " + CUR[ctx.n - 1].name + (ctx.n < CUR.length ? " وانفتح " + CUR[ctx.n].name + "." : ".") : "النجاح يحتاج " + pct(PASS.level) + ". راجع المتون ثم أعد المحاولة.";
      nextHref = passed ? "#/cert/level/" + ctx.n : "#/";
    }
    save();
    const st = starsOf(score);
    const mistakes = Q.wrong.length
      ? '<section class="card"><h3>راجع أخطاءك</h3>' + Q.wrong.map((q) => '<div class="review-item"><div class="q-prompt" style="font-size:1.1rem">' + correctText(q) + "</div></div>").join("") + "</section>"
      : "";
    app.innerHTML = '<div class="stack fade-in"><section class="card result stack"><div class="big-score" style="color:' + (passed ? "var(--good)" : "var(--bad)") + '">' + pct(score) + "</div>" + starsHtml(st) +
      "<h2>" + (passed ? "ناجح 🎉" : "لم تبلغ درجة الإتقان بعد") + '</h2><div>' + esc(msg) + "</div>" + extra + '<div class="muted small">' + ar(Q.right) + " إجابة صحيحة من " + ar(Q.qs.length) + " · +" + ar(Q.right * 10) + " نقطة</div>" +
      '<div class="btns"><a class="btn" href="' + nextHref + '">' + (passed ? "متابعة" : "عودة للحفظ") + '</a><button class="btn secondary" id="retry">أعد الاختبار</button></div></section>' + mistakes + "</div>";
    $("#retry").onclick = () => startQuiz(ctx);
    setTop(quizTitle(ctx), true);
    if (passed) toast("+" + ar(Q.right * 10) + " نقطة");
  }

  function viewExam(kind, arg) {
    if (kind === "matn") {
      const m = TEXTS[arg];
      if (!m) return go("#/");
      setTop("الاختبار النهائي", true);
      const ready = matnProgress(arg) === 1 && matnOpen(arg);
      app.innerHTML = '<div class="stack fade-in"><section class="card stack"><div class="muted small">الإجازة في المتن</div><h1>' + esc(m.title) + "</h1>" +
        (ready ? '<p>اختبار شامل من ' + ar(QCOUNT.matn) + " سؤالاً من جميع دروس المتن. النجاح بنسبة " + pct(PASS.matn) + ' فأكثر يمنحك شهادة الإجازة في المتن.</p><button class="btn block" id="go">ابدأ الاختبار النهائي</button>'
          : '<p class="muted">أتقن جميع دروس المتن أولاً (' + pct(matnProgress(arg)) + ' حتى الآن).</p><a class="btn secondary" href="#/matn/' + arg + '">عودة إلى الدروس</a>') + "</section></div>";
      if (ready) $("#go").onclick = () => startQuiz({ type: "matn", id: arg });
    } else {
      const n = +arg, L = CUR[n - 1];
      if (!L) return go("#/");
      setTop("اختبار المستوى", true);
      const ready = L.matns.every((x) => TEXTS[x.id] && matnDone(x.id));
      app.innerHTML = '<div class="stack fade-in"><section class="card stack"><div class="muted small">اختبار الانتقال</div><h1>' + L.name + "</h1>" +
        (ready ? "<p>اختبار شامل من " + ar(QCOUNT.level) + " سؤالاً من جميع متون المستوى. النجاح بنسبة " + pct(PASS.level) + ' فأكثر يفتح المستوى التالي.</p><button class="btn block" id="go">ابدأ اختبار المستوى</button>'
          : '<p class="muted">احصل على الإجازة في جميع متون المستوى أولاً.</p><a class="btn secondary" href="#/">عودة</a>') + "</section></div>";
      if (ready) $("#go").onclick = () => startQuiz({ type: "level", n });
    }
  }

  function viewReview() {
    setTop("المراجعة", true);
    const due = dueReviews();
    const upcoming = Object.entries(S.lessons).filter(([k, v]) => v.mastered && v.due > Date.now() && TEXTS[k.split(":")[0]]).sort((a, b) => a[1].due - b[1].due).slice(0, 8);
    const item = (id, i, v, now) => {
      const m = TEXTS[id];
      const days = Math.round((v.due - today()) / DAY);
      return '<div class="review-item"><div class="grow"><b>' + esc(m.lessons[i].title) + '</b><div class="muted small">' + esc(m.title) + (now ? "" : " · بعد " + ar(days) + " " + (days === 1 ? "يوم" : days <= 10 ? "أيام" : "يوماً")) + "</div></div>" +
        (now ? '<button class="btn" data-rev="' + id + ":" + i + '" style="min-height:38px;padding:6px 14px">راجع</button>' : "") + "</div>";
    };
    app.innerHTML = '<div class="stack fade-in"><section class="card"><h2>مراجعة اليوم</h2><div class="muted small" style="margin-bottom:6px">المراجعة المتباعدة تثبّت المحفوظ: كل مراجعة ناجحة تؤخر الموعد القادم، والإخفاق يعيده إلى الغد.</div>' +
      (due.length ? due.map((d) => item(d.id, d.i, d.v, true)).join("") : '<div class="empty muted">لا مراجعات مستحقة الآن — أحسنت!</div>') + "</section>" +
      (upcoming.length ? '<section class="card"><h3>القادم</h3>' + upcoming.map(([k, v]) => item(k.split(":")[0], +k.split(":")[1], v, false)).join("") + "</section>" : "") + "</div>";
    app.querySelectorAll("[data-rev]").forEach((b) => (b.onclick = () => { const [id, i] = b.dataset.rev.split(":"); startQuiz({ type: "review", id, i: +i }); }));
  }

  function viewCert(kind, arg) {
    setTop("الشهادة", true);
    let title, name, score, at;
    if (kind === "matn") {
      const m = TEXTS[arg];
      if (!m || !matnDone(arg)) return go("#/");
      title = "شهادة إتقان متن"; name = m.title;
      score = S.matns[arg].score; at = S.matns[arg].at;
    } else {
      const L = CUR[+arg - 1];
      if (!L || !levelDone(+arg)) return go("#/");
      title = "شهادة إتمام مستوى"; name = L.name + " — " + L.matns.map((x) => x.title).join("، ");
      score = S.levels[arg].score; at = S.levels[arg].at;
    }
    const date = new Date(at || Date.now()).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
    app.innerHTML = '<div class="stack fade-in"><div class="cert stack"><div style="font-size:2.2rem">🎓</div><h2>' + title + '</h2><div class="muted">تشهد أكاديمية المتون بأن حامل هذه الشهادة قد أتمّ حفظ</div><h1 style="font-family:Amiri,serif">' + esc(name) + '</h1><div>واجتاز الاختبار بنسبة <b>' + pct(score) + '</b></div><div class="muted small">' + esc(date) + '</div><div class="muted small">«مَنْ يُرِدِ اللَّهُ بِهِ خَيْراً يُفَقِّهْهُ فِي الدِّينِ»</div></div><a class="btn block" href="#/">العودة إلى المستويات</a></div>';
  }

  function viewMethod() {
    setTop("منهج الأكاديمية", true);
    app.innerHTML = '<div class="stack fade-in"><section class="card stack"><h2>كيف تتقدم في الأكاديمية؟</h2>' +
      "<p>المتون مرتبة في أربعة مستويات كما رتّبها كتاب «متون طالب العلم»، يُبنى كل مستوى على ما قبله.</p>" +
      "<ol style=\"padding-inline-start:20px;margin:0\"><li><b>اقرأ</b> الدرس مضبوطاً بالشكل.</li><li><b>احفظ</b> بالتكرار وإخفاء الكلمات تدريجياً، واستعمل عدّاد التكرار (عشرون مرة).</li><li><b>اختبر</b> نفسك: النجاح بـ" + pct(PASS.lesson) + " يجعل الدرس متقناً ويفتح التالي.</li><li>بعد إتقان كل الدروس: <b>الاختبار النهائي للمتن</b> (" + pct(PASS.matn) + ") وتنال شهادة الإجازة فيه.</li><li>بعد الإجازة في كل متون المستوى: <b>اختبار المستوى</b> (" + pct(PASS.level) + ") فينفتح المستوى التالي.</li><li><b>راجع</b> يومياً ما يظهر في «مراجعة اليوم»؛ فالمواعيد تتباعد كلما ثبت حفظك.</li></ol></section>" +
      '<section class="card stack"><h3>نصائح من مقدمة الكتاب</h3><div class="tip">المداومة على الحفظ وعدم الإكثار من المحفوظ اليومي؛ فالقليل الدائم خير من الكثير المنقطع.</div><div class="tip">كرّر المقطع الجديد حفظاً مرات كثيرة، ثم اقرأ ما حفظته قبل أن تبدأ بالجديد.</div><div class="tip">إذا أتممت المتن فلا تنقطع عن مراجعته؛ فبالتكرار يرسخ الحفظ.</div></section>' +
      '<section class="card small muted">مصدر النصوص: «متون طالب العلم» — المستويات الأربعة مع الحواشي، جمع وترتيب وتحقيق د. عبد المحسن بن محمد القاسم، إمام وخطيب المسجد النبوي، الطبعة الأولى ١٤٣٨هـ.</section></div>';
  }

  // ---------- Settings ----------
  function openSettings() {
    const md = $("#modal");
    const seg = (name, opts, cur) => '<div class="seg">' + opts.map(([v, l]) => '<button data-set="' + name + '" data-v="' + v + '" class="' + (String(cur) === String(v) ? "active" : "") + '">' + l + "</button>").join("") + "</div>";
    md.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="الإعدادات"><div class="row"><h2 class="grow">الإعدادات</h2><button class="icon-btn" id="closeSet" aria-label="إغلاق">✕</button></div>' +
      '<div class="set-row"><span>المظهر</span>' + seg("theme", [["auto", "تلقائي"], ["light", "فاتح"], ["dark", "داكن"]], S.settings.theme) + "</div>" +
      '<div class="set-row"><span>حجم خط المتن</span>' + seg("size", [[0, "ص"], [1, "م"], [2, "ك"], [3, "ك+"]], S.settings.size) + "</div>" +
      '<div class="set-row"><span>إظهار التشكيل</span>' + seg("harakat", [["true", "نعم"], ["false", "لا"]], S.settings.harakat) + "</div>" +
      '<div class="set-row"><span>فتح كل المستويات<div class="muted small">للمتقدمين: يتجاوز شرط التدرّج</div></span>' + seg("free", [["false", "لا"], ["true", "نعم"]], S.settings.free) + "</div>" +
      '<div class="set-row"><span>نسخة احتياطية للتقدّم</span><div class="btns" style="flex:none"><button class="btn secondary" id="exportBtn" style="min-height:36px;padding:6px 12px">حفظ</button><button class="btn secondary" id="importBtn" style="min-height:36px;padding:6px 12px">استرجاع</button></div></div>' +
      '<div class="set-row"><span>مسح التقدّم</span><button class="btn secondary" id="resetBtn" style="min-height:36px;padding:6px 12px;color:var(--bad)">مسح</button></div>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden></div>';
    md.hidden = false;
    md.onclick = (e) => { if (e.target === md) closeSettings(); };
    $("#closeSet").onclick = closeSettings;
    md.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.set; let v = b.dataset.v;
      if (k === "size") v = +v; if (k === "harakat" || k === "free") v = v === "true";
      S.settings[k] = v; save(); applySettings(); openSettings();
      if (Q && !Q.done) renderQ(); else if (!Q) route();
    }));
    $("#resetBtn").onclick = () => {
      if (!confirm("سيُمسح كل تقدّمك في الأكاديمية. هل أنت متأكد؟")) return;
      const keep = S.settings; S = blank(); S.settings = keep; save(); closeSettings(); go("#/"); toast("تم مسح التقدّم");
    };
    $("#exportBtn").onclick = () => {
      const blob = new Blob([JSON.stringify(S)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "mutoon-academy-backup.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $("#importBtn").onclick = () => $("#importFile").click();
    $("#importFile").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!d || d.v !== 1 || typeof d.lessons !== "object") throw 0;
        S = Object.assign(blank(), d); S.settings = Object.assign(blank().settings, d.settings || {});
        save(); applySettings(); closeSettings(); route(); toast("تم استرجاع التقدّم");
      } catch (err) { toast("الملف غير صالح"); }
    };
  }
  function closeSettings() { $("#modal").hidden = true; $("#modal").innerHTML = ""; }

  // ---------- Router ----------
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  let lastRoute = "";
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const p = h.split("/").filter(Boolean);
    if (p[0] !== "lesson" || lastRoute.split("/").slice(0, 3).join("/") !== p.slice(0, 3).join("/")) viewLesson.mode = "read";
    lastRoute = p.join("/");
    Q = null;
    window.scrollTo(0, 0);
    if (!p.length) viewHome();
    else if (p[0] === "matn") viewMatn(p[1]);
    else if (p[0] === "read") viewRead(p[1]);
    else if (p[0] === "lesson") viewLesson(p[1], +p[2] || 0, p[3]);
    else if (p[0] === "exam") viewExam(p[1], p[2]);
    else if (p[0] === "review") viewReview();
    else if (p[0] === "cert") viewCert(p[1], p[2]);
    else if (p[0] === "method") viewMethod();
    else viewHome();
  }

  app.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b && !b.disabled) go(b.dataset.go);
  });
  $("#backBtn").onclick = () => {
    if (Q && !Q.done && !confirm("هل تريد الخروج من الاختبار؟ لن تُحفظ نتيجته.")) return;
    const p = location.hash.replace(/^#\/?/, "").split("/");
    if (Q) { Q = null; route(); return; }
    if (p[0] === "lesson" || p[0] === "read" || (p[0] === "exam" && p[1] === "matn") || (p[0] === "cert" && p[1] === "matn")) go("#/matn/" + (p[0] === "lesson" || p[0] === "read" ? p[1] : p[2]));
    else go("#/");
  };
  $("#brand").onclick = () => go("#/");
  $("#settingsBtn").onclick = openSettings;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeSettings(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);
  window.addEventListener("hashchange", route);

  applySettings();
  route();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // expose for tests
  window.__academy = { model, buildQuiz, norm, splitPhrases, state: () => S, quiz: () => Q };
})();
