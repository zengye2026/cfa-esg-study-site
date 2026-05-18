(() => {
  const cfg = window.CHAPTER_PRACTICE_CONFIG || {};
  const bank = window.ESG_QUESTION_BANK || { questions: [] };
  const chapter = Number(cfg.chapter || 1);
  const allQuestions = bank.questions || [];
  const questions = allQuestions
    .filter((q) => q.source === "textbook" && Number(q.chapter) === chapter)
    .sort((a, b) => Number(a.localId) - Number(b.localId));
  const byLocal = new Map(questions.map((q) => [Number(q.localId), q]));
  const storageKey = `esg_chapter_practice_v2_ch${chapter}`;
  const colors = ["#0f6cbd", "#0f7b7b", "#5b5fc7", "#8a5a00", "#c42b1c", "#8764b8"];
  let mode = "group";
  let groupIndex = 0;
  let visibleLimit = 60;
  let randomOrder = shuffle(questions.map((q) => q.id));
  let redoState = {};
  let state = loadState();

  const chapterTitles = {
    1: "Introduction to ESG Investing",
    2: "The ESG Market",
    3: "Environmental Factors",
    4: "Social Factors",
    5: "Governance Factors",
    6: "Engagement and Stewardship",
    7: "ESG Analysis, Valuation, and Integration",
    8: "ESG Integrated Portfolio Construction and Management",
    9: "Investment Mandates, Portfolio Analytics, and Client Reporting",
  };

  const groups = normalizeGroups(cfg.groups || []);
  migrateState();
  injectStyle();
  renderApp();

  function normalizeGroups(rawGroups) {
    const seen = new Set();
    const normalized = rawGroups.map((g, i) => {
      const ids = (g.qids || g.qs || [])
        .map(Number)
        .filter((id) => byLocal.has(id))
        .filter((id) => {
          const key = `${id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      return {
        id: g.id || `g${i + 1}`,
        label: g.label || g.name || g.title || `第 ${i + 1} 组`,
        hint: g.hint || g.memory || g.hook || "",
        color: g.color || colors[i % colors.length],
        qids: ids,
      };
    }).filter((g) => g.qids.length);
    const missing = questions.map((q) => Number(q.localId)).filter((id) => !seen.has(`${id}`));
    if (missing.length) {
      normalized.push({ id: "other", label: "其他重点", hint: "原分组未覆盖的题目，统一放在这里复习。", color: "#616161", qids: missing });
    }
    return normalized.length ? normalized : [{ id: "all", label: "本章题目", hint: "本章全部教材经典题。", color: colors[0], qids: questions.map((q) => Number(q.localId)) }];
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "null") || {};
    } catch (e) {
      return {};
    }
  }
  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }
  function qState(id) {
    state[id] = state[id] || {};
    return state[id];
  }
  function migrateState() {
    let changed = false;
    questions.forEach((q) => {
      const s = state[q.id];
      if (!s) return;
      if (isCurrentWrong(q, s) && !s.everWrong) {
        s.everWrong = true;
        s.mastered = false;
        changed = true;
      }
    });
    if (changed) saveState();
  }
  function esc(v) {
    return String(v ?? "").replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[c]);
  }
  function keywordList(value) {
    return Array.isArray(value)
      ? value.map(String).map((x) => x.trim()).filter(Boolean)
      : String(value || "").split(/[,;|]+|->/).map((x) => x.trim()).filter(Boolean);
  }
  function shuffle(items) {
    return items.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }
  function isDone(q) {
    return !!qState(q.id).revealed;
  }
  function isCurrentWrong(q, s) {
    return !!(s && s.revealed && s.choice && s.choice !== q.answer);
  }
  function isWrong(q) {
    const s = qState(q.id);
    return !!(s.everWrong && !s.mastered);
  }
  function isRedoMode() {
    return mode === "wrong" || mode === "favorite";
  }
  function redoKey(id) {
    return `${mode}:${id}`;
  }
  function displayState(q) {
    const base = qState(q.id);
    if (!isRedoMode()) return base;
    return { flagged: base.flagged, everWrong: base.everWrong, mastered: base.mastered, ...(redoState[redoKey(q.id)] || {}) };
  }
  function optionLabel(q, letter) {
    const opt = q.options.find((o) => o.letter === letter);
    return opt ? `${letter}. ${opt.text}${opt.zh ? ` / ${opt.zh}` : ""}` : letter || "未做";
  }

  function injectStyle() {
    const style = document.createElement("style");
    style.textContent = `
      :root{--ink:#242424;--muted:#424242;--soft:#616161;--bg:#f5f5f5;--card:#fff;--line:#d1d1d1;--line2:#e0e0e0;--blue:#0f6cbd;--blue-hover:#115ea3;--blue-soft:#ebf3fc;--ok:#107c10;--ok-bg:#f1faf1;--ok-line:#9fd89f;--bad:#c42b1c;--bad-bg:#fff5f5;--bad-line:#f1bbbc;--warn:#8a5a00;--warn-bg:#fff4ce;--warn-line:#f1c21b;--purple:#5b5fc7;--shadow2:0 1px 2px rgba(0,0,0,.12);--shadow4:0 2px 8px rgba(0,0,0,.14)}
      *{box-sizing:border-box}body{margin:0;font-family:"Segoe UI","Microsoft YaHei",Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.62}.wrap{max-width:1180px;margin:0 auto;padding:28px 18px 82px}.topline{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}h1{font-size:clamp(34px,5vw,62px);line-height:1.05;margin:0;font-weight:700;letter-spacing:0;color:#111827}.lead{margin:10px 0 0;color:var(--muted);font-size:16px}.home-links{display:flex;gap:8px;flex-wrap:wrap}.home-links a,.btn{min-height:40px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--muted);padding:9px 13px;font-size:14px;font-weight:650;text-decoration:none;cursor:pointer}.home-links a:hover,.btn:hover{background:var(--blue-soft);border-color:#b4d6fa;color:var(--blue-hover)}.btn.primary,.mode-tab.active{background:var(--blue);border-color:var(--blue);color:#fff}.btn.warn{background:var(--bad-bg);border-color:var(--bad-line);color:var(--bad)}.btn.bookmark{background:var(--warn-bg);border-color:var(--warn-line);color:var(--warn)}.btn.ok{background:var(--ok-bg);border-color:var(--ok-line);color:var(--ok)}.stats{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.stat{min-width:82px;background:#fff;border:1px solid var(--line2);border-radius:8px;padding:12px 14px;box-shadow:var(--shadow2);position:relative;overflow:hidden}.stat::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--blue)}.stat.wrong::before{background:var(--bad)}.stat.flagged::before{background:var(--warn)}.stat strong{display:block;font-size:28px;line-height:1;font-weight:700}.stat small{display:block;margin-top:7px;color:var(--soft);font-size:13px;font-weight:650}.panel{background:#fff;border:1px solid var(--line2);border-radius:8px;box-shadow:var(--shadow2);padding:14px;margin-bottom:14px}.modebar,.row,.meta,.actions,.hooks{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.modebar{margin:12px 0 14px}.mode-tab{border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--muted);padding:10px 13px;font-size:14px;font-weight:700;cursor:pointer}.group-tabs{display:flex;gap:8px;flex-wrap:wrap}.group-tab{border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--muted);padding:8px 12px;font-size:13px;font-weight:700;cursor:pointer}.group-tab.active{color:#fff;border-color:transparent}.hint{margin-top:10px;background:var(--blue-soft);border-left:4px solid var(--blue);border-radius:0 8px 8px 0;padding:10px 12px;color:var(--muted);font-size:14px}.countline,.copy-status{color:var(--soft);font-size:13px;font-weight:650}.copy-status{color:var(--ok)}.grid{display:grid;gap:14px}.qcard{background:#fff;border:1px solid var(--line2);border-radius:8px;box-shadow:var(--shadow4);padding:18px;position:relative;overflow:hidden}.qcard.correct{border-color:var(--ok-line);background:linear-gradient(90deg,rgba(16,124,16,.08),#fff 18%)}.qcard.correct::before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:var(--ok)}.qcard.wrong{border-color:var(--bad-line);background:linear-gradient(90deg,rgba(196,43,28,.08),#fff 18%)}.qcard.wrong::before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:var(--bad)}.qcard.flagged{box-shadow:0 0 0 1px rgba(138,90,0,.18),var(--shadow4)}.chip{display:inline-flex;align-items:center;min-height:26px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:650;color:var(--muted)}.qno{background:var(--blue-soft);border-color:#b4d6fa;color:var(--blue)}.knowledge{background:var(--warn-bg);border-color:var(--warn-line);color:var(--warn)}.wrong-chip{background:var(--bad-bg);border-color:var(--bad-line);color:var(--bad)}.stem{font-size:18px;font-weight:650;line-height:1.5;margin:14px 0 12px;color:var(--ink);white-space:pre-wrap}.stem-zh{margin:-2px 0 12px;color:var(--muted);background:var(--blue-soft);border-left:3px solid var(--blue);padding:10px 12px;border-radius:0 8px 8px 0}.options{display:grid;gap:9px;margin:12px 0}.opt{width:100%;text-align:left;border:1px solid var(--line);background:#fff;border-radius:8px;padding:11px 12px;font-size:15.5px;line-height:1.55;cursor:pointer;display:grid;grid-template-columns:32px 1fr;gap:8px;align-items:start}.opt b{color:var(--blue)}.opt:hover{border-color:var(--blue);background:#f8fbff}.opt.selected{border-color:var(--blue);background:var(--blue-soft)}.opt.answer{border-color:var(--ok-line);background:var(--ok-bg);box-shadow:inset 4px 0 0 var(--ok)}.opt.bad{border-color:var(--bad-line);background:var(--bad-bg);box-shadow:inset 4px 0 0 var(--bad)}.opt-text{display:grid;gap:4px}.opt-zh{color:var(--soft);font-size:14px;border-top:1px dashed var(--line);padding-top:4px;margin-top:2px}.answerbox{border:1px solid var(--line2);border-radius:8px;background:#fff;margin-top:14px;overflow:hidden}.answer-head{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:11px 13px;border-bottom:1px solid var(--line2);font-weight:650;background:#fafafa}.answer-head.answer-correct{background:var(--ok-bg);border-bottom-color:var(--ok-line)}.answer-head.answer-wrong{background:var(--bad-bg);border-bottom-color:var(--bad-line)}.result-correct{border-color:var(--ok-line);color:var(--ok)}.result-wrong{border-color:var(--bad-line);color:var(--bad)}.answer-body{display:grid;gap:12px;padding:14px}.block{border-top:1px solid var(--line2);padding-top:12px}.block:first-child{border-top:0;padding-top:0}.block h3{font-size:13px;margin:0 0 6px;color:var(--soft);font-weight:650}.block p{margin:0;white-space:pre-wrap}.pair{display:grid;gap:8px}.pair .en{color:var(--ink);font-weight:500}.pair .zh{color:var(--muted);border-top:1px dashed var(--line);padding-top:8px}.hook{display:inline-flex;border:1px solid #b4d6fa;background:var(--blue-soft);color:var(--blue);border-radius:999px;padding:4px 8px;font-size:12px;font-weight:650}.logic{background:#fafafa;border:1px solid var(--line2);border-radius:8px;padding:10px 12px;color:var(--muted)}.empty{background:#fff;border:1px dashed var(--line);border-radius:8px;padding:24px;text-align:center;color:var(--muted)}.loadrow{text-align:center;margin-top:16px}.float{position:fixed;right:16px;bottom:16px;z-index:20;border:1px solid var(--line);border-radius:999px;background:#fff;padding:10px 13px;box-shadow:var(--shadow4);font-weight:700;color:var(--muted);cursor:pointer}@media(max-width:720px){.wrap{padding:18px 10px 76px}h1{font-size:38px}.qcard{padding:14px}.stem{font-size:16.5px}.opt{font-size:14px;grid-template-columns:28px 1fr}.home-links{width:100%}.home-links a{flex:1;text-align:center}.modebar{display:grid;grid-template-columns:1fr 1fr}.mode-tab{min-height:42px}.float{right:10px;bottom:10px}}
    `;
    document.head.appendChild(style);
  }

  function renderApp() {
    const app = document.getElementById("app");
    app.innerHTML = `
      <main class="wrap">
        <header>
          <div class="topline">
            <div>
              <h1>Ch.${chapter} 章节练习</h1>
              <p class="lead">${esc(cfg.title || chapterTitles[chapter] || "")} · 第一轮分组练习，第二轮本章乱序，错题和收藏都按重做逻辑处理。</p>
            </div>
            <nav class="home-links">
              <a href="../index.html">返回主页</a>
              <a href="../question-bank.html?v=20260517b">综合题库</a>
            </nav>
          </div>
          <div class="stats" id="stats"></div>
        </header>
        <section class="panel">
          <div class="modebar">
            <button class="mode-tab active" data-mode="group">第一轮分组</button>
            <button class="mode-tab" data-mode="random">本章乱序</button>
            <button class="mode-tab" data-mode="wrong">错题</button>
            <button class="mode-tab" data-mode="favorite">收藏</button>
          </div>
          <div id="groupPanel"></div>
          <div class="row">
            <button class="btn primary" id="shuffleBtn">重新随机</button>
            <button class="btn" id="copyWrongBtn">复制错题</button>
            <button class="btn warn" id="clearAnswersBtn">清空作答</button>
            <span class="countline" id="countLine"></span>
            <span class="copy-status" id="copyStatus"></span>
          </div>
        </section>
        <section class="grid" id="questionGrid"></section>
        <div class="loadrow"><button class="btn primary" id="loadMoreBtn">加载更多</button></div>
      </main>
      <button class="float" id="toTop">回到顶部</button>
    `;
    bindEvents();
    renderAll();
  }

  function bindEvents() {
    document.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.mode;
        if (next === "wrong" || next === "favorite") {
          Object.keys(redoState).filter((key) => key.startsWith(`${next}:`)).forEach((key) => delete redoState[key]);
        }
        mode = next;
        visibleLimit = 60;
        renderAll();
      });
    });
    document.getElementById("shuffleBtn").addEventListener("click", () => {
      randomOrder = shuffle(questions.map((q) => q.id));
      visibleLimit = 60;
      renderAll();
    });
    document.getElementById("copyWrongBtn").addEventListener("click", () => copyText(buildWrongText()));
    document.getElementById("clearAnswersBtn").addEventListener("click", clearAnswers);
    document.getElementById("loadMoreBtn").addEventListener("click", () => {
      visibleLimit += 60;
      renderQuestions();
    });
    document.getElementById("toTop").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
  }

  function currentList() {
    if (mode === "group") {
      const g = groups[groupIndex] || groups[0];
      return (g.qids || []).map((id) => byLocal.get(Number(id))).filter(Boolean);
    }
    if (mode === "random") {
      const map = new Map(questions.map((q) => [q.id, q]));
      return randomOrder.map((id) => map.get(id)).filter(Boolean);
    }
    if (mode === "wrong") return questions.filter(isWrong);
    if (mode === "favorite") return questions.filter((q) => qState(q.id).flagged);
    return questions;
  }
  function renderStats() {
    const done = questions.filter(isDone).length;
    const wrong = questions.filter(isWrong).length;
    const flagged = questions.filter((q) => qState(q.id).flagged).length;
    document.getElementById("stats").innerHTML = [
      `<div class="stat"><strong>${questions.length}</strong><small>本章题</small></div>`,
      `<div class="stat"><strong>${groups.length}</strong><small>分组</small></div>`,
      `<div class="stat"><strong>${done}</strong><small>已做</small></div>`,
      `<div class="stat wrong"><strong>${wrong}</strong><small>错题</small></div>`,
      `<div class="stat flagged"><strong>${flagged}</strong><small>收藏</small></div>`,
    ].join("");
  }
  function renderGroupPanel() {
    const panel = document.getElementById("groupPanel");
    if (mode !== "group") {
      panel.innerHTML = "";
      return;
    }
    const g = groups[groupIndex] || groups[0];
    panel.innerHTML = `
      <div class="group-tabs">
        ${groups.map((item, i) => `<button class="group-tab ${i === groupIndex ? "active" : ""}" style="${i === groupIndex ? `background:${item.color};border-color:${item.color}` : `border-color:${item.color};color:${item.color}`}" data-group="${i}">${esc(item.label)} · ${item.qids.length}</button>`).join("")}
      </div>
      ${g?.hint ? `<div class="hint">${esc(g.hint)}</div>` : ""}
    `;
    panel.querySelectorAll("[data-group]").forEach((btn) => {
      btn.addEventListener("click", () => {
        groupIndex = Number(btn.dataset.group);
        visibleLimit = 60;
        renderAll();
      });
    });
  }
  function renderQuestions() {
    const list = currentList();
    const shown = list.slice(0, visibleLimit);
    const modeName = { group: "第一轮分组", random: "本章乱序", wrong: "错题", favorite: "收藏" }[mode];
    document.getElementById("countLine").textContent = `${modeName}：${list.length} 题，已显示 ${shown.length} 题`;
    document.getElementById("questionGrid").innerHTML = shown.length ? shown.map(renderQuestion).join("") : `<div class="empty">这里暂时没有题目</div>`;
    document.getElementById("loadMoreBtn").style.display = list.length > shown.length ? "" : "none";
  }
  function renderAll() {
    renderStats();
    renderGroupPanel();
    renderQuestions();
    document.querySelectorAll("[data-mode]").forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
    document.getElementById("shuffleBtn").style.display = mode === "random" ? "" : "none";
  }

  function choose(id, letter) {
    const q = questions.find((item) => item.id === id);
    const base = qState(id);
    const target = isRedoMode() ? (redoState[redoKey(id)] = redoState[redoKey(id)] || { flagged: base.flagged }) : base;
    if (target.revealed) return;
    target.choice = letter;
    target.revealed = true;
    target.grade = letter === q.answer ? "correct" : "wrong";
    base.choice = letter;
    base.revealed = true;
    base.grade = target.grade;
    if (target.grade === "wrong") {
      base.everWrong = true;
      base.mastered = false;
      base.wrongCount = (base.wrongCount || 0) + 1;
      base.lastWrongAt = new Date().toISOString();
    }
    saveState();
    renderAll();
  }
  function clearOne(id) {
    const s = qState(id);
    state[id] = {
      flagged: !!s.flagged,
      everWrong: !!s.everWrong,
      mastered: !!s.mastered,
      wrongCount: s.wrongCount || 0,
      lastWrongAt: s.lastWrongAt,
      masteredAt: s.masteredAt,
    };
    delete redoState[`wrong:${id}`];
    delete redoState[`favorite:${id}`];
    saveState();
    renderAll();
  }
  function toggleFlag(id) {
    const s = qState(id);
    s.flagged = !s.flagged;
    saveState();
    renderAll();
  }
  function markMastered(id) {
    const s = qState(id);
    s.mastered = true;
    s.masteredAt = new Date().toISOString();
    delete redoState[`wrong:${id}`];
    delete redoState[`favorite:${id}`];
    saveState();
    renderAll();
  }
  function clearAnswers() {
    if (!confirm("确定清空本章作答记录吗？收藏、错题本和已掌握标记会保留。")) return;
    const kept = {};
    questions.forEach((q) => {
      const s = state[q.id];
      if (!s) return;
      const item = {};
      if (s.flagged) item.flagged = true;
      if (s.everWrong) item.everWrong = true;
      if (s.mastered) item.mastered = true;
      if (s.wrongCount) item.wrongCount = s.wrongCount;
      if (s.lastWrongAt) item.lastWrongAt = s.lastWrongAt;
      if (s.masteredAt) item.masteredAt = s.masteredAt;
      if (Object.keys(item).length) kept[q.id] = item;
    });
    state = kept;
    redoState = {};
    saveState();
    renderAll();
  }

  function renderQuestion(q) {
    const base = qState(q.id);
    const s = displayState(q);
    const revealed = !!s.revealed;
    const correct = revealed && s.choice === q.answer;
    const wrongBook = isWrong(q);
    const classes = ["qcard"];
    if (revealed) classes.push(correct ? "correct" : "wrong");
    if (base.flagged) classes.push("flagged");
    const opts = q.options.map((o) => {
      const cls = ["opt"];
      if (s.choice === o.letter) cls.push("selected");
      if (revealed && o.letter === q.answer) cls.push("answer");
      if (revealed && s.choice === o.letter && s.choice !== q.answer) cls.push("bad");
      return `<button class="${cls.join(" ")}" onclick="ChapterPractice.choose('${q.id}','${o.letter}')"><b>${o.letter}.</b><span class="opt-text"><span>${esc(o.text)}</span>${revealed && o.zh ? `<span class="opt-zh">${esc(o.zh)}</span>` : ""}</span></button>`;
    }).join("");
    return `
      <article class="${classes.join(" ")}" id="${esc(q.id)}">
        <div class="meta">
          <span class="chip qno">教材 Q${q.localId}</span>
          <span class="chip">Ch.${q.chapter}</span>
          ${q.knowledgePoint ? `<span class="chip knowledge">${esc(q.knowledgePoint)}</span>` : ""}
          ${wrongBook ? `<span class="chip wrong-chip">错题本</span>` : ""}
          ${base.flagged ? `<span class="chip">已收藏</span>` : ""}
        </div>
        <p class="stem">${esc(q.stem)}</p>
        ${revealed && q.stemZh ? `<p class="stem-zh">${esc(q.stemZh)}</p>` : ""}
        <div class="options">${opts}</div>
        <div class="actions">
          <button class="btn bookmark" onclick="ChapterPractice.toggleFlag('${q.id}')">${base.flagged ? "取消收藏" : "收藏"}</button>
          <button class="btn" onclick="ChapterPractice.clearOne('${q.id}')">重做本题</button>
          ${revealed && wrongBook ? `<button class="btn ok" onclick="ChapterPractice.markMastered('${q.id}')">已掌握</button>` : ""}
        </div>
        ${revealed ? answerBoxHtml(q, s, correct) : ""}
      </article>`;
  }
  function answerBoxHtml(q, s, correct) {
    return `
      <div class="answerbox">
        <div class="answer-head ${correct ? "answer-correct" : "answer-wrong"}">
          <span class="chip ${correct ? "result-correct" : "result-wrong"}">${correct ? "回答正确" : "回答错误"}</span>
          <span class="chip">正确答案：${esc(q.answer)}</span>
          ${s.choice ? `<span class="chip">你的选择：${esc(s.choice)}</span>` : ""}
        </div>
        <div class="answer-body">
          ${explanationHtml(q)}
          ${hookHtml(q.keywordEn)}
          ${q.reverseZh ? `<div class="block"><h3>中文反推</h3><p>${esc(q.reverseZh)}</p></div>` : ""}
          ${q.logic ? `<div class="block"><h3>逻辑等式</h3><div class="logic">${esc(q.logic)}</div></div>` : ""}
          ${q.trap ? `<div class="block"><h3>易错提醒</h3><p>${esc(q.trap)}</p></div>` : ""}
        </div>
      </div>`;
  }
  function explanationHtml(q) {
    const parts = [];
    if (q.explanationEn) parts.push(`<p class="en">${esc(q.explanationEn)}</p>`);
    if (q.explanationZh) parts.push(`<p class="zh">${esc(q.explanationZh)}</p>`);
    return `<div class="block"><h3>解析</h3><div class="pair">${parts.join("") || "<p>暂无解析</p>"}</div></div>`;
  }
  function hookHtml(value) {
    const parts = keywordList(value);
    if (!parts.length) return "";
    return `<div class="block"><h3>英文题眼</h3><div class="hooks">${parts.slice(0, 8).map((x) => `<span class="hook">${esc(x)}</span>`).join("")}</div></div>`;
  }
  function formatRecord(q) {
    const s = qState(q.id);
    return [
      `教材 Q${q.localId} | Ch.${q.chapter} | ${q.knowledgePoint || ""}`,
      `题干：${q.stem}`,
      `中文题干：${q.stemZh || ""}`,
      `你的答案：${s.choice ? optionLabel(q, s.choice) : "未做"}`,
      `正确答案：${optionLabel(q, q.answer)}`,
      `解析：${q.explanationEn || ""}`,
      `中文解析：${q.explanationZh || ""}`,
      `英文题眼：${keywordList(q.keywordEn).join(" / ")}`,
      `中文反推：${q.reverseZh || ""}`,
      `易错提醒：${q.trap || ""}`,
    ].join("\n");
  }
  function buildWrongText() {
    const items = questions.filter(isWrong);
    if (!items.length) return `Ch.${chapter} 错题记录\n生成时间：${new Date().toLocaleString()}\n\n暂无错题。`;
    return [`Ch.${chapter} 错题记录`, `生成时间：${new Date().toLocaleString()}`, `题目数量：${items.length}`, "", items.map(formatRecord).join("\n\n---\n\n")].join("\n");
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyStatus("已复制");
    } catch (e) {
      setCopyStatus("复制失败，请手动选择错题内容");
    }
  }
  function setCopyStatus(message) {
    const el = document.getElementById("copyStatus");
    el.textContent = message;
    clearTimeout(setCopyStatus.timer);
    setCopyStatus.timer = setTimeout(() => { el.textContent = ""; }, 2600);
  }

  window.ChapterPractice = { choose, clearOne, toggleFlag, markMastered };
})();
