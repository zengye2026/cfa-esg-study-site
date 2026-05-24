const BANK = window.ESG_QUESTION_BANK;
const QUESTIONS = BANK.questions;
const PRACTICE_KEY = "esg_question_bank_state_v3";
const PRACTICE_STABLE_KEY = "esg_question_bank_state_latest";
const MOCK_STATE_KEY = "esg_question_bank_mock_current_v1";
const MOCK_STATE_STABLE_KEY = "esg_question_bank_mock_current_latest";
const MOCK_RECORDS_KEY = "esg_question_bank_mock_records_v1";
const MOCK_RECORDS_STABLE_KEY = "esg_question_bank_mock_records_latest";
const MOCK_SECONDS = 140 * 60;
const TARGET_COUNTS = { 1: 6, 2: 3, 3: 13, 4: 10, 5: 11, 6: 9, 7: 24, 8: 17, 9: 7 };

let mode = "practice";
let currentChapter = "all";
let currentSource = "all";
let currentFilter = "all";
let query = "";
let visibleLimit = 60;
let order = QUESTIONS.map((q) => q.id);
let practiceState = loadBest([PRACTICE_KEY, PRACTICE_STABLE_KEY, "esg_question_bank_state_v2", "esg_question_bank_state_v1"], {});
let mockState = loadBest([MOCK_STATE_KEY, MOCK_STATE_STABLE_KEY], freshMockState());
let mockRecords = loadBest([MOCK_RECORDS_KEY, MOCK_RECORDS_STABLE_KEY], []);
let mockReviewFilter = "all";
let redoState = {};
let timerId = null;
mergeChapterPracticeIntoBank();
migratePracticeState();

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch (e) {
    return fallback;
  }
}
function scoreSavedValue(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value ? 1 : 0;
}
function loadBest(keys, fallback) {
  let best = fallback;
  let bestScore = scoreSavedValue(fallback);
  keys.forEach((key) => {
    const value = load(key, null);
    const score = scoreSavedValue(value);
    if (score > bestScore) {
      best = value;
      bestScore = score;
    }
  });
  return best;
}
function newerTime(a, b) {
  if (!a) return b;
  if (!b) return a;
  return String(a) > String(b) ? a : b;
}
function mergeQuestionState(base = {}, extra = {}) {
  const out = { ...base };
  if (extra.flagged) out.flagged = true;
  if (extra.everWrong) out.everWrong = true;
  if (extra.mastered) out.mastered = true;
  if (extra.everWrong && !extra.mastered) out.mastered = false;
  if (extra.revealed && !out.revealed) {
    out.revealed = true;
    if (extra.choice) out.choice = extra.choice;
    if (extra.grade) out.grade = extra.grade;
  }
  if (!out.choice && extra.choice) out.choice = extra.choice;
  if (!out.grade && extra.grade) out.grade = extra.grade;
  if (extra.wrongCount) out.wrongCount = Math.max(out.wrongCount || 0, extra.wrongCount || 0);
  out.lastWrongAt = newerTime(out.lastWrongAt, extra.lastWrongAt);
  out.masteredAt = newerTime(out.masteredAt, extra.masteredAt);
  return out;
}
function mergeChapterPracticeIntoBank() {
  let changed = false;
  for (let chapter = 1; chapter <= 9; chapter += 1) {
    [
      `esg_chapter_practice_v2_ch${chapter}`,
      `esg_chapter_practice_latest_ch${chapter}`,
      `esg_chapter_practice_v1_ch${chapter}`,
    ].forEach((key) => {
      const chapterState = load(key, {});
      Object.entries(chapterState || {}).forEach(([id, value]) => {
        const before = JSON.stringify(practiceState[id] || {});
        practiceState[id] = mergeQuestionState(practiceState[id] || {}, value || {});
        if (JSON.stringify(practiceState[id] || {}) !== before) changed = true;
      });
    });
  }
  if (changed) savePractice();
}
function syncTextbookPracticeToChapter() {
  const byChapter = {};
  QUESTIONS.forEach((q) => {
    if (q.source !== "textbook" || !practiceState[q.id]) return;
    byChapter[q.chapter] = byChapter[q.chapter] || {};
    byChapter[q.chapter][q.id] = practiceState[q.id];
  });
  Object.entries(byChapter).forEach(([chapter, entries]) => {
    const keys = [`esg_chapter_practice_v2_ch${chapter}`, `esg_chapter_practice_latest_ch${chapter}`];
    const chapterState = loadBest(keys, {});
    Object.entries(entries).forEach(([id, value]) => {
      chapterState[id] = mergeQuestionState(chapterState[id] || {}, value || {});
    });
    saveMany(keys, chapterState);
  });
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Study record could not be saved:", e);
  }
}
function saveMany(keys, value) {
  keys.forEach((key) => save(key, value));
}
function savePractice() {
  saveMany([PRACTICE_KEY, PRACTICE_STABLE_KEY], practiceState);
  syncTextbookPracticeToChapter();
}
function saveMock() {
  saveMany([MOCK_STATE_KEY, MOCK_STATE_STABLE_KEY], mockState);
}
function saveRecords() {
  saveMany([MOCK_RECORDS_KEY, MOCK_RECORDS_STABLE_KEY], mockRecords);
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
  practiceState[id] = practiceState[id] || {};
  return practiceState[id];
}
function byId(id) {
  return QUESTIONS.find((q) => q.id === id);
}
function sourceClass(source) {
  if (source === "textbook") return "source-textbook";
  if (source === "official") return "source-official";
  return "source-p300";
}
function questionLabel(q) {
  if (q.source === "official") return `官方 M${q.mockExam || ""}-Q${q.localId}`;
  if (q.source === "p300") return `P300 Q${q.localId}`;
  return `教材 Q${q.localId}`;
}
function sourceName(q) {
  if (q.source === "official") return "官方";
  if (q.source === "p300") return "P300";
  return "教材";
}
function knowledgeLabel(q) {
  return q.knowledgePoint || q.topic || "";
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
  const s = qState(q.id);
  return !!(s.revealed || s.grade);
}
function isWrong(q) {
  const s = qState(q.id);
  return !!(s.everWrong && !s.mastered);
}
function isCurrentWrong(q, state) {
  if (!state || !state.revealed) return false;
  return q.hasAnswer ? !!(state.choice && state.choice !== q.answer) : state.grade === "wrong";
}
function migratePracticeState() {
  let changed = false;
  QUESTIONS.forEach((q) => {
    const s = practiceState[q.id];
    if (!s) return;
    if (isCurrentWrong(q, s) && !s.everWrong) {
      s.everWrong = true;
      s.mastered = false;
      changed = true;
    }
  });
  if (changed) savePractice();
}
function isRedoFilter() {
  return currentFilter === "wrong" || currentFilter === "flagged";
}
function redoKey(id) {
  return `${currentFilter}:${id}`;
}
function displayState(q) {
  const base = qState(q.id);
  if (!isRedoFilter()) return base;
  return { flagged: base.flagged, everWrong: base.everWrong, mastered: base.mastered, ...(redoState[redoKey(q.id)] || {}) };
}

function setMode(next) {
  mode = next;
  document.getElementById("practiceView").classList.toggle("hide", mode !== "practice");
  document.getElementById("mockView").classList.toggle("hide", mode !== "mock");
  document.getElementById("practiceTab").classList.toggle("active", mode === "practice");
  document.getElementById("mockTab").classList.toggle("active", mode === "mock");
  if (mode === "mock") {
    renderMock();
    startTimer();
  } else {
    renderAll();
    stopTimer();
  }
}

function renderStats() {
  const done = QUESTIONS.filter(isDone).length;
  const wrong = QUESTIONS.filter(isWrong).length;
  const flagged = QUESTIONS.filter((q) => qState(q.id).flagged).length;
  document.getElementById("stats").innerHTML = [
    `<div class="stat total"><strong>${BANK.total}</strong><small>总题</small></div>`,
    `<div class="stat textbook"><strong>${BANK.sourceCounts.textbook}</strong><small>教材</small></div>`,
    `<div class="stat p300"><strong>${BANK.sourceCounts.p300}</strong><small>P300</small></div>`,
    `<div class="stat official"><strong>${BANK.sourceCounts.official || 0}</strong><small>官方</small></div>`,
    `<div class="stat done"><strong>${done}</strong><small>已做</small></div>`,
    `<div class="stat wrong"><strong>${wrong}</strong><small>错题</small></div>`,
    `<div class="stat flagged"><strong>${flagged}</strong><small>收藏</small></div>`,
  ].join("");
}

function renderTabs() {
  document.getElementById("chapterTabs").innerHTML = [
    `<button class="btn ${currentChapter === "all" ? "active" : ""}" onclick="setChapter('all')">全部章节</button>`,
    ...Array.from({ length: 9 }, (_, i) => i + 1).map((ch) =>
      `<button class="btn chapter-filter ${currentChapter === ch ? "active" : ""}" onclick="setChapter(${ch})">Ch.${ch}</button>`
    ),
  ].join("");
  document.getElementById("sourceTabs").innerHTML = [
    `<button class="btn ${currentSource === "all" ? "active" : ""}" onclick="setSource('all')">全部</button>`,
    `<button class="btn source-textbook ${currentSource === "textbook" ? "active" : ""}" onclick="setSource('textbook')">教材</button>`,
    `<button class="btn source-p300 ${currentSource === "p300" ? "active" : ""}" onclick="setSource('p300')">P300</button>`,
    `<button class="btn source-official ${currentSource === "official" ? "active" : ""}" onclick="setSource('official')">官方</button>`,
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
  const map = new Map(QUESTIONS.map((q) => [q.id, q]));
  return order.map((id) => map.get(id)).filter((q) => {
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
        q.id, q.localId, q.sourceLabel, q.officialId, q.mockExam ? `Mock ${q.mockExam}` : "", `Ch.${q.chapter}`,
        q.topic, q.knowledgePoint, q.lo, q.pageRef, q.stem, q.stemZh,
        q.options.map((o) => `${o.text} ${o.zh}`).join(" "), q.explanationEn, q.explanationZh,
        (q.detailNotes || []).join(" "), tableText, keywordList(q.keywordEn).join(" "), q.reverseZh, q.logic, q.trap, q.rawText,
      ].join(" ").toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });
}

function choose(id, letter) {
  const q = byId(id);
  const s = qState(id);
  const target = isRedoFilter() ? (redoState[redoKey(id)] = redoState[redoKey(id)] || { flagged: s.flagged }) : s;
  if (target.revealed) return;
  target.choice = letter;
  target.revealed = true;
  if (q.hasAnswer) target.grade = target.choice === q.answer ? "correct" : "wrong";
  s.choice = letter;
  s.revealed = true;
  if (q.hasAnswer) s.grade = target.grade;
  if (isCurrentWrong(q, target)) {
    s.everWrong = true;
    s.mastered = false;
    s.wrongCount = (s.wrongCount || 0) + 1;
    s.lastWrongAt = new Date().toISOString();
  }
  savePractice();
  renderAll();
}
function clearOne(id) {
  const s = qState(id);
  practiceState[id] = {
    flagged: !!s.flagged,
    everWrong: !!s.everWrong,
    mastered: !!s.mastered,
    wrongCount: s.wrongCount || 0,
    lastWrongAt: s.lastWrongAt,
    masteredAt: s.masteredAt,
  };
  delete redoState[`wrong:${id}`];
  delete redoState[`flagged:${id}`];
  savePractice();
  renderAll();
}
function toggleFlag(id) {
  const s = qState(id);
  s.flagged = !s.flagged;
  savePractice();
  renderAll();
}
function markMastered(id) {
  const s = qState(id);
  s.mastered = true;
  s.masteredAt = new Date().toISOString();
  delete redoState[`wrong:${id}`];
  delete redoState[`flagged:${id}`];
  savePractice();
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
function explanationTags(q) {
  if (q.source !== "official") return "";
  if (q.explanationConfidence === "reference" || q.referenceMatch) return `<span class="explain-tag">相似题参考</span>`;
  if (q.explanationConfidence === "medium") return `<span class="explain-tag">AI解析·中置信</span>`;
  return `<span class="explain-tag">AI解析·高置信</span>`;
}
function explanationHtml(q) {
  if (!q.explanationEn && !q.explanationZh) return `<div class="block"><h3>解析</h3><p>当前题目没有提取到解析。</p></div>`;
  const parts = [];
  if (q.explanationEn) parts.push(`<p class="en">${esc(q.explanationEn)}</p>`);
  if (q.explanationZh) parts.push(`<p class="zh">${esc(q.explanationZh)}</p>`);
  return `<div class="block"><div class="block-title"><h3>解析</h3>${explanationTags(q)}</div><div class="pair">${parts.join("")}</div></div>`;
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
function sourceRefHtml(q) {
  if (q.source === "p300" && q.pageRef) return `<div class="block"><h3>出处</h3><p>P300 PDF ${esc(q.pageRef)}</p></div>`;
  return "";
}
function optionLabel(q, letter) {
  const opt = q.options.find((o) => o.letter === letter);
  return opt ? `${letter}. ${opt.text}${opt.zh ? ` / ${opt.zh}` : ""}` : letter || "未做";
}
function formatRecord(q) {
  const s = qState(q.id);
  const result = q.hasAnswer ? (s.choice === q.answer ? "正确" : "错误") : (s.grade === "wrong" ? "错误" : "未判定");
  return [
    `${questionLabel(q)} | Ch.${q.chapter} | ${knowledgeLabel(q)} | ${result}`,
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
  return ["综合题库错题记录", `生成时间：${new Date().toLocaleString()}`, `题目数量：${items.length}`, "", items.map(formatRecord).join("\n\n---\n\n")].join("\n");
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

function isStudyRecordKey(key) {
  return /^esg_question_bank_|^esg_chapter_practice_/.test(key || "");
}
function collectRecordBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (isStudyRecordKey(key)) data[key] = localStorage.getItem(key);
  }
  return {
    type: "cfa-esg-study-records",
    version: 1,
    exportedAt: new Date().toISOString(),
    href: location.href,
    data,
  };
}
function backupRecords() {
  const backup = collectRecordBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  a.href = url;
  a.download = `cfa-esg-study-records-${day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setCopyStatus("学习记录备份已生成");
}
function restoreRecordsFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(String(reader.result || "{}"));
      const data = backup && backup.data;
      if (!data || typeof data !== "object") throw new Error("Invalid backup");
      let restored = 0;
      Object.entries(data).forEach(([key, value]) => {
        if (!isStudyRecordKey(key) || typeof value !== "string") return;
        localStorage.setItem(key, value);
        restored += 1;
      });
      alert(`学习记录已恢复：${restored} 组。页面将刷新。`);
      location.reload();
    } catch (e) {
      alert("恢复失败：请选择从本题库导出的学习记录备份文件。");
    }
  };
  reader.readAsText(file, "utf-8");
}

function answerBoxHtml(q, s, correct) {
  const answerHeadClass = q.hasAnswer ? (correct ? "answer-correct" : "answer-wrong") : "";
  const answerHead = q.hasAnswer
    ? `<span class="chip ${correct ? "result-correct" : "result-wrong"}">${correct ? "回答正确" : "回答错误"}</span><span class="chip">正确答案：${esc(q.answer)}</span>${s.choice ? `<span class="chip">你的选择：${esc(s.choice)}</span>` : ""}`
    : `<span class="chip">自判题</span>`;
  return `
    <div class="answerbox">
      <div class="answer-head ${answerHeadClass}">${answerHead}</div>
      <div class="answer-body">
        ${explanationHtml(q)}
        ${detailHtml(q)}
        ${sourceRefHtml(q)}
        ${hookHtml(q.keywordEn)}
        ${q.reverseZh ? `<div class="block"><h3>中文反推</h3><p>${esc(q.reverseZh)}</p></div>` : ""}
        ${q.logic ? `<div class="block"><h3>逻辑等式</h3><div class="logic">${esc(q.logic)}</div></div>` : ""}
        ${q.trap ? `<div class="block"><h3>易错提醒</h3><p>${esc(q.trap)}</p></div>` : ""}
      </div>
    </div>`;
}
function renderQuestion(q) {
  const base = qState(q.id);
  const s = displayState(q);
  const revealed = !!s.revealed;
  const correct = q.hasAnswer && revealed && s.choice === q.answer;
  const wrongBook = isWrong(q);
  const classes = ["qcard"];
  if (revealed && q.hasAnswer) classes.push(correct ? "correct" : "wrong");
  if (base.flagged) classes.push("flagged");
  const opts = q.options.map((o) => `
    <button class="${optionClass(q, o, s)}" onclick="choose('${q.id}','${o.letter}')">
      <b>${o.letter}.</b>
      <span class="opt-text"><span>${esc(o.text)}</span>${revealed && o.zh ? `<span class="opt-zh">${esc(o.zh)}</span>` : ""}</span>
    </button>`).join("");
  return `
    <article class="${classes.join(" ")}" id="${esc(q.id)}">
      <div class="meta">
        <span class="chip qno ${sourceClass(q.source)}">${esc(questionLabel(q))}</span>
        <span class="chip chapter-chip">Ch.${q.chapter}</span>
        ${knowledgeLabel(q) ? `<span class="chip knowledge-chip">${esc(knowledgeLabel(q))}</span>` : ""}
        ${wrongBook ? `<span class="chip wrong-chip">错题本</span>` : ""}
        ${base.flagged ? `<span class="chip">已收藏</span>` : ""}
      </div>
      <p class="stem">${esc(q.stem)}</p>
      ${revealed && q.stemZh ? `<p class="stem-zh">${esc(q.stemZh)}</p>` : ""}
      <div class="options">${opts}</div>
      <div class="actions"><button class="btn bookmark" onclick="toggleFlag('${q.id}')">${base.flagged ? "取消收藏" : "收藏"}</button><button class="btn" onclick="clearOne('${q.id}')">重做本题</button>${revealed && wrongBook ? `<button class="btn ok" onclick="markMastered('${q.id}')">已掌握</button>` : ""}</div>
      ${revealed ? answerBoxHtml(q, s, correct) : ""}
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

function freshMockState() {
  return { started: false, submitted: false, type: "official1", index: 0, remaining: MOCK_SECONDS, order: [], answers: {}, uncertain: {}, startedAt: null, submittedAt: null };
}
function mockTypeLabel(type) {
  return { official1: "官方 Mock 1", official2: "官方 Mock 2", p300: "P300 模考", textbook: "教材模考", mixed: "混合模考" }[type] || "模考";
}
function drawWeighted(candidates, total = 100) {
  const selected = [];
  const used = new Set();
  for (const ch of Object.keys(TARGET_COUNTS).map(Number)) {
    const pool = shuffle(candidates.filter((q) => q.chapter === ch));
    for (const q of pool.slice(0, TARGET_COUNTS[ch])) {
      selected.push(q);
      used.add(q.id);
    }
  }
  const rest = shuffle(candidates.filter((q) => !used.has(q.id)));
  return shuffle([...selected, ...rest].slice(0, total));
}
function drawMockQuestions(type) {
  if (type === "official1") return shuffle(QUESTIONS.filter((q) => q.source === "official" && q.mockExam === 1));
  if (type === "official2") return shuffle(QUESTIONS.filter((q) => q.source === "official" && q.mockExam === 2));
  if (type === "p300") return drawWeighted(QUESTIONS.filter((q) => q.source === "p300"));
  if (type === "textbook") return drawWeighted(QUESTIONS.filter((q) => q.source === "textbook"));
  return drawWeighted(QUESTIONS);
}
function startMock() {
  if (mockState.started && !mockState.submitted && !confirm("当前模考尚未提交，确定重新开始吗？")) return;
  const type = document.getElementById("mockType").value;
  const qs = drawMockQuestions(type);
  mockState = { started: true, submitted: false, type, index: 0, remaining: MOCK_SECONDS, order: qs.map((q) => q.id), answers: {}, uncertain: {}, startedAt: new Date().toISOString(), submittedAt: null };
  mockReviewFilter = "all";
  saveMock();
  renderMock();
  startTimer();
}
function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (mode !== "mock" || !mockState.started || mockState.submitted) return;
    mockState.remaining = Math.max(0, (mockState.remaining || 0) - 1);
    if (mockState.remaining === 0) submitMock(false);
    saveMock();
    renderMockHeader();
  }, 1000);
}
function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}
function fmtTime(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  const s = (seconds || 0) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function currentMockQuestion() {
  return byId(mockState.order[mockState.index]);
}
function chooseMock(letter) {
  if (!mockState.started || mockState.submitted) return;
  const q = currentMockQuestion();
  mockState.answers[q.id] = letter;
  saveMock();
  renderMock();
}
function goMock(index) {
  mockState.index = Math.max(0, Math.min(index, mockState.order.length - 1));
  saveMock();
  renderMock();
}
function moveMock(delta) {
  goMock((mockState.index || 0) + delta);
}
function toggleMockUncertain() {
  const q = currentMockQuestion();
  if (!q) return;
  mockState.uncertain[q.id] = !mockState.uncertain[q.id];
  saveMock();
  renderMock();
}
function mockResultData() {
  const rows = mockState.order.map((id) => {
    const q = byId(id);
    const choice = mockState.answers[id] || "";
    return { q, choice, correct: choice === q.answer, uncertain: !!mockState.uncertain[id] };
  });
  const correct = rows.filter((r) => r.correct).length;
  return { rows, correct, total: rows.length, rate: rows.length ? Math.round((correct / rows.length) * 100) : 0 };
}
function submitMock(ask = true) {
  if (!mockState.started || mockState.submitted) return;
  if (ask && !confirm("确定提交本次模考吗？提交后会生成成绩，并把错题同步到练习模式错题中。")) return;
  mockState.submitted = true;
  mockState.submittedAt = new Date().toISOString();
  const result = mockResultData();
  const submittedAt = new Date().toISOString();
  result.rows.forEach(({ q, choice, correct }) => {
    const s = qState(q.id);
    practiceState[q.id] = {
      ...s,
      revealed: true,
      choice: choice || null,
      grade: correct ? "correct" : "wrong",
      everWrong: !!(s.everWrong || !correct),
      mastered: !correct ? false : !!s.mastered,
      wrongCount: (s.wrongCount || 0) + (correct ? 0 : 1),
      lastWrongAt: correct ? s.lastWrongAt : submittedAt,
    };
  });
  savePractice();
  mockRecords.unshift({
    id: `mock-${Date.now()}`,
    type: mockState.type,
    label: mockTypeLabel(mockState.type),
    startedAt: mockState.startedAt,
    submittedAt: mockState.submittedAt,
    total: result.total,
    correct: result.correct,
    rate: result.rate,
    uncertain: Object.values(mockState.uncertain).filter(Boolean).length,
    answers: mockState.answers,
    order: mockState.order,
    uncertainMap: mockState.uncertain,
  });
  mockRecords = mockRecords.slice(0, 20);
  saveRecords();
  saveMock();
  stopTimer();
  renderAll();
  renderMock();
}
function renderMockHeader() {
  document.getElementById("mockTimer").textContent = fmtTime(mockState.remaining || MOCK_SECONDS);
  if (!mockState.started) {
    document.getElementById("mockProgress").textContent = "未开始";
    document.getElementById("mockNav").innerHTML = "";
    return;
  }
  const answered = Object.keys(mockState.answers || {}).length;
  document.getElementById("mockProgress").textContent = `${mockTypeLabel(mockState.type)}｜${mockState.index + 1}/${mockState.order.length}｜已答 ${answered}`;
  document.getElementById("mockNav").innerHTML = mockState.order.map((id, i) => {
    const cls = ["navbtn"];
    if (i === mockState.index) cls.push("current");
    if (mockState.answers[id]) cls.push("answered");
    if (mockState.uncertain[id]) cls.push("uncertain");
    return `<button class="${cls.join(" ")}" onclick="goMock(${i})">${i + 1}</button>`;
  }).join("");
}
function renderMockQuestion() {
  const box = document.getElementById("mockQuestion");
  const resultBox = document.getElementById("mockResult");
  if (!mockState.started) {
    box.classList.remove("hide");
    resultBox.classList.add("hide");
    box.innerHTML = `<h2>模考模式</h2><p>选择一套模考后点击“开始模考”。模考中只显示英文题目和选项，可以标记“不确定”；提交后统一看分数、章节正确率、错题和不确定题。</p>`;
    return;
  }
  if (mockState.submitted) {
    box.classList.add("hide");
    resultBox.classList.remove("hide");
    renderMockResult();
    return;
  }
  const q = currentMockQuestion();
  const chosen = mockState.answers[q.id];
  const unsure = !!mockState.uncertain[q.id];
  const opts = q.options.map((o) => `<button class="opt ${chosen === o.letter ? "selected" : ""}" onclick="chooseMock('${o.letter}')"><b>${o.letter}.</b><span>${esc(o.text)}</span></button>`).join("");
  box.classList.remove("hide");
  resultBox.classList.add("hide");
  box.innerHTML = `
    <p class="stem">${esc(q.stem)}</p>
    <div class="options">${opts}</div>
    <div class="mock-actions">
      <div><button class="btn" onclick="moveMock(-1)">上一题</button><button class="btn" onclick="moveMock(1)">下一题</button></div>
      <button class="btn ${unsure ? "active" : ""}" onclick="toggleMockUncertain()">${unsure ? "已标记不确定" : "标记不确定"}</button>
    </div>`;
}
function groupedStats(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row.q);
    const item = map.get(key) || { total: 0, correct: 0 };
    item.total += 1;
    if (row.correct) item.correct += 1;
    map.set(key, item);
  });
  return [...map.entries()].map(([key, v]) => ({ key, ...v, rate: Math.round((v.correct / v.total) * 100) }));
}
function tableHtml(title, rows) {
  return `<div class="block"><h3>${title}</h3><table class="table"><thead><tr><th>项目</th><th>正确</th><th>总题</th><th>正确率</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.key)}</td><td>${r.correct}</td><td>${r.total}</td><td>${r.rate}%</td></tr>`).join("")}</tbody></table></div>`;
}
function setMockReview(filter) {
  mockReviewFilter = filter;
  renderMockResult();
}
function reviewQuestionHtml(row) {
  const q = row.q;
  const s = { revealed: true, choice: row.choice };
  const opts = q.options.map((o) => {
    const cls = ["opt"];
    if (row.choice === o.letter) cls.push("selected");
    if (o.letter === q.answer) cls.push("answer");
    if (row.choice === o.letter && !row.correct) cls.push("bad");
    return `<div class="${cls.join(" ")}"><b>${o.letter}.</b><span class="opt-text"><span>${esc(o.text)}</span>${o.zh ? `<span class="opt-zh">${esc(o.zh)}</span>` : ""}</span></div>`;
  }).join("");
  return `<article class="qcard ${row.correct ? "correct" : "wrong"}"><div class="meta"><span class="chip qno ${sourceClass(q.source)}">${esc(questionLabel(q))}</span><span class="chip chapter-chip">Ch.${q.chapter}</span><span class="chip knowledge-chip">${esc(knowledgeLabel(q))}</span>${row.uncertain ? `<span class="chip">不确定</span>` : ""}</div><p class="stem">${esc(q.stem)}</p>${q.stemZh ? `<p class="stem-zh">${esc(q.stemZh)}</p>` : ""}<div class="options">${opts}</div>${answerBoxHtml(q, s, row.correct)}</article>`;
}
function renderMockResult() {
  const result = mockResultData();
  const wrong = result.rows.filter((r) => !r.correct);
  const unsure = result.rows.filter((r) => r.uncertain);
  const both = result.rows.filter((r) => r.uncertain && !r.correct);
  const selected = { all: result.rows, wrong, uncertain: unsure, both }[mockReviewFilter] || result.rows;
  const chapterRows = groupedStats(result.rows, (q) => `Ch.${q.chapter}`).sort((a, b) => Number(a.key.slice(3)) - Number(b.key.slice(3)));
  const sourceRows = groupedStats(result.rows, (q) => sourceName(q));
  document.getElementById("mockResult").innerHTML = `
    <div class="mock-head"><div><h2>${esc(mockTypeLabel(mockState.type))} 成绩</h2><div class="score">${result.rate}%</div><p>${result.correct}/${result.total} 题正确</p></div><button class="btn primary" onclick="startMock()">再来一套</button></div>
    <div class="review-cards">
      <button class="review-card ${mockReviewFilter === "all" ? "active" : ""}" onclick="setMockReview('all')"><strong>${result.total}</strong><br>全部解析</button>
      <button class="review-card ${mockReviewFilter === "wrong" ? "active" : ""}" onclick="setMockReview('wrong')"><strong>${wrong.length}</strong><br>本次错题</button>
      <button class="review-card ${mockReviewFilter === "uncertain" ? "active" : ""}" onclick="setMockReview('uncertain')"><strong>${unsure.length}</strong><br>本次不确定</button>
      <button class="review-card ${mockReviewFilter === "both" ? "active" : ""}" onclick="setMockReview('both')"><strong>${both.length}</strong><br>错题且不确定</button>
    </div>
    ${tableHtml("章节正确率", chapterRows)}
    ${tableHtml("来源正确率", sourceRows)}
    <div class="grid">${selected.map(reviewQuestionHtml).join("") || `<div class="empty">没有符合条件的题目</div>`}</div>`;
}
function renderMockHistory() {
  const box = document.getElementById("mockHistory");
  if (!mockRecords.length) {
    box.innerHTML = `<h2>模考记录</h2><p>暂无记录。提交模考后会保存在当前浏览器中。</p>`;
    return;
  }
  box.innerHTML = `<h2>模考记录</h2><div class="history-list">${mockRecords.slice(0, 8).map((r) => `<div class="history-item"><strong>${esc(r.label)}</strong>｜${r.rate}%｜${r.correct}/${r.total}｜不确定 ${r.uncertain}<br><span class="countline">${new Date(r.submittedAt).toLocaleString()}</span></div>`).join("")}</div>`;
}
function renderMock() {
  document.getElementById("mockType").value = mockState.type || "official1";
  renderMockHeader();
  renderMockQuestion();
  renderMockHistory();
}

document.getElementById("practiceTab").addEventListener("click", () => setMode("practice"));
document.getElementById("mockTab").addEventListener("click", () => setMode("mock"));
document.getElementById("search").addEventListener("input", (e) => {
  query = e.target.value.trim();
  visibleLimit = 60;
  renderAll();
});
document.querySelectorAll("[data-filter]").forEach((btn) => btn.addEventListener("click", () => {
  const next = btn.dataset.filter;
  if (next !== currentFilter && (next === "wrong" || next === "flagged")) {
    Object.keys(redoState).filter((key) => key.startsWith(`${next}:`)).forEach((key) => delete redoState[key]);
  }
  currentFilter = next;
  visibleLimit = 60;
  renderAll();
}));
document.getElementById("shuffle").addEventListener("click", () => {
  order = shuffle(order);
  visibleLimit = 60;
  renderAll();
});
document.getElementById("copyWrong").addEventListener("click", () => copyText(buildWrongText()));
document.getElementById("backupRecords").addEventListener("click", backupRecords);
document.getElementById("restoreRecords").addEventListener("click", () => document.getElementById("recordFileInput").click());
document.getElementById("recordFileInput").addEventListener("change", (e) => {
  restoreRecordsFromFile(e.target.files && e.target.files[0]);
  e.target.value = "";
});
document.getElementById("reset").addEventListener("click", () => {
  if (confirm("确定清空作答记录吗？收藏、错题本和已掌握标记会保留。")) {
    const kept = {};
    QUESTIONS.forEach((q) => {
      const s = practiceState[q.id];
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
    practiceState = kept;
    redoState = {};
    savePractice();
    renderAll();
  }
});
document.getElementById("loadMore").addEventListener("click", () => {
  visibleLimit += 60;
  renderQuestions();
});
document.getElementById("startMock").addEventListener("click", startMock);
document.getElementById("submitMock").addEventListener("click", () => submitMock(true));
document.getElementById("mockType").addEventListener("change", (e) => {
  if (!mockState.started || mockState.submitted) mockState.type = e.target.value;
});
document.getElementById("toTop").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

renderAll();
renderMock();
