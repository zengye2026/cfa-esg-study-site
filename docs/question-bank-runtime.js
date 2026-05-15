const BANK = window.ESG_QUESTION_BANK;
const QUESTIONS = BANK.questions;
const STORE_KEY = "esg_question_bank_state_v2";
const state = loadState();
let currentChapter = "all";
let currentSource = "all";
let currentFilter = "all";
let query = "";
let visibleLimit = 60;
let order = QUESTIONS.map((q) => q.id);

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch (e) {
    return {};
  }
}
function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
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
function qState(id) {
  state[id] = state[id] || {};
  return state[id];
}
function sourceClass(source) {
  return source === "textbook" ? "source-textbook" : "source-p300";
}
function keywordList(value) {
  return Array.isArray(value)
    ? value.map(String).map((x) => x.trim()).filter(Boolean)
    : String(value || "").split(/[,;|]+|->/).map((x) => x.trim()).filter(Boolean);
}
function isDone(q) {
  const s = qState(q.id);
  return !!(s.revealed || s.grade);
}
function isWrong(q) {
  const s = qState(q.id);
  return q.hasAnswer ? !!(s.revealed && s.choice !== q.answer) : s.grade === "wrong";
}

function renderStats() {
  const done = QUESTIONS.filter(isDone).length;
  const wrong = QUESTIONS.filter(isWrong).length;
  const flagged = QUESTIONS.filter((q) => qState(q.id).flagged).length;
  document.getElementById("stats").innerHTML = [
    `<div class="stat">${BANK.total}<small>总题数</small></div>`,
    `<div class="stat">${BANK.sourceCounts.textbook}<small>教材经典题</small></div>`,
    `<div class="stat">${BANK.sourceCounts.p300}<small>P300题</small></div>`,
    `<div class="stat">${done}<small>已做</small></div>`,
    `<div class="stat">${wrong}<small>错题</small></div>`,
    `<div class="stat">${flagged}<small>收藏</small></div>`,
  ].join("");
}

function renderTabs() {
  document.getElementById("chapterTabs").innerHTML = [
    `<button class="btn ${currentChapter === "all" ? "active" : ""}" onclick="setChapter('all')">全部章节</button>`,
    ...Array.from({ length: 9 }, (_, i) => i + 1).map((ch) =>
      `<button class="btn ${currentChapter === ch ? "active" : ""}" onclick="setChapter(${ch})">Ch.${ch}</button>`
    ),
  ].join("");
  document.getElementById("sourceTabs").innerHTML = [
    `<button class="btn ${currentSource === "all" ? "active" : ""}" onclick="setSource('all')">全部来源</button>`,
    `<button class="btn ${currentSource === "textbook" ? "active" : ""}" onclick="setSource('textbook')">教材经典题</button>`,
    `<button class="btn ${currentSource === "p300" ? "active" : ""}" onclick="setSource('p300')">P300题</button>`,
  ].join("");
}

function setChapter(ch) {
  currentChapter = ch;
  visibleLimit = 60;
  renderAll();
}
function setSource(source) {
  currentSource = source;
  visibleLimit = 60;
  renderAll();
}

function filteredQuestions() {
  const byId = new Map(QUESTIONS.map((q) => [q.id, q]));
  return order.map((id) => byId.get(id)).filter((q) => {
    const s = qState(q.id);
    if (currentChapter !== "all" && q.chapter !== currentChapter) return false;
    if (currentSource !== "all" && q.source !== currentSource) return false;
    if (currentFilter === "todo" && isDone(q)) return false;
    if (currentFilter === "wrong" && !isWrong(q)) return false;
    if (currentFilter === "flagged" && !s.flagged) return false;
    if (query) {
      const tableText = q.referenceTable
        ? [q.referenceTable.title, (q.referenceTable.headers || []).join(" "), (q.referenceTable.rows || []).flat().join(" ")].join(" ")
        : "";
      const hay = [
        q.id,
        q.localId,
        q.sourceLabel,
        `Ch.${q.chapter}`,
        q.topic,
        q.lo,
        q.pageRef,
        q.stem,
        q.stemZh,
        q.options.map((o) => `${o.text} ${o.zh}`).join(" "),
        q.explanationEn,
        q.explanationZh,
        (q.detailNotes || []).join(" "),
        tableText,
        keywordList(q.keywordEn).join(" "),
        q.reverseZh,
        q.logic,
        q.trap,
        q.rawText,
      ].join(" ").toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });
}

function choose(id, letter) {
  const q = QUESTIONS.find((x) => x.id === id);
  const s = qState(id);
  if (s.revealed) return;
  s.choice = letter;
  s.revealed = true;
  if (q.hasAnswer) s.grade = s.choice === q.answer ? "correct" : "wrong";
  saveState();
  renderAll();
}

function markSelf(id, grade) {
  const s = qState(id);
  s.revealed = true;
  s.grade = grade;
  saveState();
  renderAll();
}

function clearOne(id) {
  const keepFlag = !!qState(id).flagged;
  state[id] = { flagged: keepFlag };
  saveState();
  renderAll();
}

function toggleFlag(id) {
  const s = qState(id);
  s.flagged = !s.flagged;
  saveState();
  renderAll();
}

function optionClass(q, o, s) {
  const cls = ["opt"];
  if (s.choice === o.letter) cls.push("selected");
  if (s.revealed && q.hasAnswer && o.letter === q.answer) cls.push("answer");
  if (s.revealed && q.hasAnswer && s.choice === o.letter && s.choice !== q.answer) cls.push("bad");
  return cls.join(" ");
}

function hookHtml(value) {
  const parts = keywordList(value);
  if (!parts.length) return "";
  return `<div class="block"><h3>英文题眼</h3><div class="hook-list">${parts.slice(0, 8).map((x) => `<span class="hook">${esc(x)}</span>`).join("")}</div></div>`;
}

function explanationHtml(q) {
  if (!q.explanationEn && !q.explanationZh) {
    return `<div class="block"><h3>解析</h3><p>当前题目没有提取到原始解析，已优先保留详细解析和题眼。</p></div>`;
  }
  const parts = [];
  if (q.explanationEn) parts.push(`<p class="en">${esc(q.explanationEn)}</p>`);
  if (q.explanationZh) parts.push(`<p class="zh">${esc(q.explanationZh)}</p>`);
  return `<div class="block"><h3>解析</h3><div class="pair">${parts.join("")}</div></div>`;
}

function referenceTableHtml(table) {
  if (!table) return "";
  const headers = table.headers || ["项目", "数值", "说明"];
  const rows = table.rows || [];
  return `<h3>${esc(table.title || "图表转文字")}</h3><table class="ref-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function detailHtml(q) {
  const parts = [];
  if (q.referenceTable) parts.push(referenceTableHtml(q.referenceTable));
  if (q.detailNotes && q.detailNotes.length) parts.push(`<p>${esc(q.detailNotes.join("\n"))}</p>`);
  if (!parts.length) return "";
  return `<div class="block"><h3>详细解析</h3>${parts.join("")}</div>`;
}

function optionLabel(q, letter) {
  const opt = q.options.find((o) => o.letter === letter);
  return opt ? `${letter}. ${opt.text}${opt.zh ? ` / ${opt.zh}` : ""}` : letter;
}

function formatRecord(q) {
  const s = qState(q.id);
  const result = q.hasAnswer ? (s.choice === q.answer ? "正确" : "错误") : (s.grade === "wrong" ? "错误" : "未判定");
  return [
    `${q.sourceLabel} ${q.source === "p300" ? "P300" : "教材"} Q${q.localId} | Chapter ${q.chapter} | ${q.pageRef || q.topic || ""} | ${result}`,
    `题干：${q.stem}`,
    `中文题干：${q.stemZh || ""}`,
    `你的答案：${s.choice ? optionLabel(q, s.choice) : "未做"}`,
    `正确答案：${q.hasAnswer ? optionLabel(q, q.answer) : "无标准答案"}`,
    `解析：${q.explanationEn || ""}`,
    `中文解析：${q.explanationZh || ""}`,
    `英文题眼：${keywordList(q.keywordEn).join(" / ")}`,
    `中文反推：${q.reverseZh || ""}`,
    `易错提醒：${q.trap || ""}`,
  ].join("\n");
}

function buildWrongText() {
  const items = QUESTIONS.filter(isWrong);
  if (!items.length) return `综合题库错题记录\n生成时间：${new Date().toLocaleString()}\n\n暂无错题。`;
  return [
    "综合题库错题记录",
    `生成时间：${new Date().toLocaleString()}`,
    `题目数量：${items.length}`,
    "",
    items.map(formatRecord).join("\n\n---\n\n"),
  ].join("\n");
}

function setCopyStatus(message) {
  const el = document.getElementById("copyStatus");
  el.textContent = message;
  clearTimeout(setCopyStatus.timer);
  setCopyStatus.timer = setTimeout(() => { el.textContent = ""; }, 2600);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
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

function renderQuestion(q) {
  const s = qState(q.id);
  const revealed = !!s.revealed;
  const correct = q.hasAnswer && revealed && s.choice === q.answer;
  const classes = ["qcard"];
  if (revealed && q.hasAnswer) classes.push(correct ? "correct" : "wrong");
  if (!q.hasAnswer && s.grade === "correct") classes.push("correct");
  if (!q.hasAnswer && s.grade === "wrong") classes.push("wrong");
  if (s.flagged) classes.push("flagged");
  const opts = q.options.map((o) => `
    <button class="${optionClass(q, o, s)}" onclick="choose('${q.id}','${o.letter}')">
      <b>${o.letter}.</b>
      <span class="opt-text">
        <span>${esc(o.text)}</span>
        ${revealed && o.zh ? `<span class="opt-zh">${esc(o.zh)}</span>` : ""}
      </span>
    </button>`).join("");
  const answerHead = q.hasAnswer
    ? `<span class="chip ${correct ? "source-p300" : "mode-self"}">${correct ? "回答正确" : "回答错误"}</span><span class="chip">正确答案：${esc(q.answer)}</span>${s.choice ? `<span class="chip">你的选择：${esc(s.choice)}</span>` : ""}`
    : `<span class="chip mode-self">自判题</span>${s.choice ? `<span class="chip">你的选择：${esc(s.choice)}</span>` : ""}${s.grade ? `<span class="chip ${s.grade === "correct" ? "source-p300" : "mode-self"}">${s.grade === "correct" ? "已标记正确" : "已标记错误"}</span>` : ""}`;
  const answerBox = revealed ? `
    <div class="answerbox">
      <div class="answer-head">${answerHead}</div>
      <div class="answer-body">
        ${explanationHtml(q)}
        ${detailHtml(q)}
        ${hookHtml(q.keywordEn)}
        ${q.reverseZh ? `<div class="block"><h3>中文反推</h3><p>${esc(q.reverseZh)}</p></div>` : ""}
        ${q.logic ? `<div class="block"><h3>逻辑等式</h3><div class="logic">${esc(q.logic)}</div></div>` : ""}
        ${q.trap ? `<div class="block"><h3>易错提醒</h3><p>${esc(q.trap)}</p></div>` : ""}
        ${q.link ? `<div><a class="jump" href="${esc(q.link)}">查看对应章节练习</a></div>` : ""}
      </div>
    </div>` : "";
  return `
    <article class="${classes.join(" ")}" id="${esc(q.id)}">
      <div class="meta">
        <span class="chip qno">${q.source === "p300" ? "P300" : "教材"} Q${esc(q.localId)}</span>
        <span class="chip ${sourceClass(q.source)}">${esc(q.sourceLabel)}</span>
        <span class="chip">Chapter ${q.chapter}</span>
        ${q.topic ? `<span class="chip">${esc(q.topic)}</span>` : ""}
        ${s.flagged ? `<span class="chip mode-self">已收藏</span>` : ""}
      </div>
      <p class="stem">${esc(q.stem)}</p>
      ${revealed && q.stemZh ? `<p class="stem-zh">${esc(q.stemZh)}</p>` : ""}
      <div class="options">${opts}</div>
      <div class="actions">
        ${!q.hasAnswer && revealed ? `<button class="btn good" onclick="markSelf('${q.id}','correct')">标记正确</button><button class="btn warn" onclick="markSelf('${q.id}','wrong')">标记错误</button>` : ""}
        <button class="btn" onclick="toggleFlag('${q.id}')">${s.flagged ? "取消收藏" : "收藏"}</button>
        <button class="btn" onclick="clearOne('${q.id}')">重做本题</button>
      </div>
      ${answerBox}
    </article>`;
}

function renderQuestions() {
  const list = filteredQuestions();
  const shown = list.slice(0, visibleLimit);
  document.getElementById("countLine").textContent = `当前符合条件 ${list.length} 题，已显示 ${shown.length} 题`;
  document.getElementById("questionGrid").innerHTML = shown.length ? shown.map(renderQuestion).join("") : `<div class="empty">没有符合条件的题目</div>`;
  document.getElementById("loadMore").style.display = list.length > shown.length ? "" : "none";
}

function renderAll() {
  renderStats();
  renderTabs();
  renderQuestions();
  document.querySelectorAll("[data-filter]").forEach((btn) => btn.classList.toggle("active", btn.dataset.filter === currentFilter));
}

document.getElementById("search").addEventListener("input", (e) => {
  query = e.target.value.trim();
  visibleLimit = 60;
  renderAll();
});
document.querySelectorAll("[data-filter]").forEach((btn) => btn.addEventListener("click", () => {
  currentFilter = btn.dataset.filter;
  visibleLimit = 60;
  renderAll();
}));
document.getElementById("shuffle").addEventListener("click", () => {
  order = order.map((id) => [Math.random(), id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  visibleLimit = 60;
  renderAll();
});
document.getElementById("copyWrong").addEventListener("click", () => copyText(buildWrongText()));
document.getElementById("reset").addEventListener("click", () => {
  if (confirm("确定清空综合题库的作答记录吗？")) {
    localStorage.removeItem(STORE_KEY);
    Object.keys(state).forEach((k) => delete state[k]);
    renderAll();
  }
});
document.getElementById("loadMore").addEventListener("click", () => {
  visibleLimit += 60;
  renderQuestions();
});
document.getElementById("toTop").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
renderAll();
