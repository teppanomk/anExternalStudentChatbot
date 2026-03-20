// ================= CONFIG =================
const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSfUYEYX8MIGIYW5hTWf2hz_j0VT7TBiZlAWkB183PuT25msmPFtizLvmD9ktXgV4aMj2e8E6IACs6U/pub?gid=0&single=true&output=csv";
const bannedURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREhew_r4KSC5plsfCVyKtmCp98MIINzoR-ZGdFYjNXbKCaiEf8GkYEwEvMvYAphrZB5ipDeSvqyVhr/pub?gid=0&single=true&output=csv";
const LOG_API = "https://script.google.com/macros/s/AKfycbze3yVdySjDVy2MOi9SuZgzAOGe09VMx5d8RruXMemn7_IdG8B7LLDLOPDa1ApNvDmvvQ/exec";

// ================= STATE =================
let knowledgeBase = [];
let bannedWords = [];
let isLoaded = false;

// ================= NORMALIZATION =================
function normalizeThai(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")            // remove spaces
    .replace(/[\u200B-\u200D\uFEFF]/g, ""); // remove zero-width chars
}

// ================= LOAD DATA =================
async function loadSheetData() {
  try {
    const response = await fetch(sheetURL);
    const csv = await response.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    knowledgeBase = parsed.data;
    console.log("✅ Sheet loaded:", knowledgeBase.length);
  } catch (err) {
    console.error("❌ Sheet error:", err);
  }
}

async function loadBannedWords() {
  try {
    const response = await fetch(bannedURL);
    const csv = await response.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

    if (!parsed.data.length) return;

    const firstColumn = Object.keys(parsed.data[0])[0];
    bannedWords = parsed.data
      .map(row => row[firstColumn])
      .filter(Boolean)
      .map(word => normalizeThai(word));

    console.log("🚫 Banned words loaded:", bannedWords);
  } catch (err) {
    console.error("❌ Error loading banned words:", err);
  }
}

// ================= INITIAL LOAD =================
async function initData() {
  await loadSheetData();
  await loadBannedWords();
  isLoaded = true;
  console.log("✅ All data loaded");
}

initData();
setInterval(initData, 30000); // refresh every 30 sec

// ================= UI =================
function addMessage(text, sender) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "message " + sender;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function addTyping() {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "message bot";
  div.innerText = "Typing...";
  chat.appendChild(div);
  return div;
}

// ================= SEARCH =================
function searchSheet(question) {
  const normalizedInput = normalizeThai(question);

  // Exact match first
  for (const row of knowledgeBase) {
    if (!row["User Question"]) continue;
    const q = normalizeThai(row["User Question"]);
    if (q === normalizedInput) return row["Bot Answer"];
  }

  // Keyword match
  const inputWords = normalizedInput.split(/\W+/).filter(Boolean);
  let bestMatch = null;
  let bestScore = 0;

  for (const row of knowledgeBase) {
    if (!row["User Question"]) continue;
    const q = normalizeThai(row["User Question"]);
    const qWords = q.split(/\W+/).filter(Boolean);

    let matchCount = 0;
    inputWords.forEach(word => { if (qWords.includes(word)) matchCount++; });
    const score = matchCount / inputWords.length;

    if (score > bestScore) { bestScore = score; bestMatch = row; }
  }

  if (bestScore >= 0.6) return bestMatch["Bot Answer"];
  return null;
}

// ================= BANNED WORD CHECK =================
function containsBannedWord(text) {
  const cleanText = normalizeThai(text);
  return bannedWords.some(word => cleanText.includes(word));
}

// ================= LOGGING =================
async function logQuestion(question, found, answer) {
  try {
    await fetch(LOG_API, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, found, answer })
    });
  } catch (err) {
    console.log("Logging error:", err);
  }
}

// ================= CHAT =================
async function sendMessage() {
  const input = document.getElementById("userInput");
  const rawMessage = input.value.trim();
  if (!rawMessage) return;

  if (!isLoaded) {
    addMessage("⏳ Loading data, please wait...", "bot");
    return;
  }

  if (containsBannedWord(rawMessage)) {
    addMessage("⚠️ Message contains banned words.", "bot");
    input.value = "";
    return;
  }

  addMessage(rawMessage, "user");
  input.value = "";

  const typing = addTyping();
  let answer = searchSheet(rawMessage);

  if (!answer) {
    answer = "Sorry, I don't have an answer for that yet.";
    logQuestion(rawMessage, "No", answer);
  } else {
    logQuestion(rawMessage, "Yes", answer);
  }

  setTimeout(() => { typing.innerText = answer; }, 400);
}

// ================= KEYWORD SUGGESTIONS =================
const inputBox = document.getElementById("userInput");

// Create suggestion box
const suggestionBox = document.createElement("div");
suggestionBox.style.position = "absolute";
suggestionBox.style.width = "400px";
suggestionBox.style.maxHeight = "150px";
suggestionBox.style.overflowY = "auto";
suggestionBox.style.display = "none";
suggestionBox.style.zIndex = "999";
suggestionBox.style.border = "1px solid #ccc";
suggestionBox.style.padding = "0";
document.body.appendChild(suggestionBox);

// Update suggestion colors based on dark mode
function updateSuggestionColors() {
  if (document.body.classList.contains("dark-mode")) {
    suggestionBox.style.background = "#ffe6f0"; // light background
    suggestionBox.style.color = "#000";
  } else {
    suggestionBox.style.background = "#fff";
    suggestionBox.style.color = "#000";
  }
}

// Generate suggestions
inputBox.addEventListener("input", () => {
  const value = inputBox.value.toLowerCase().trim();
  suggestionBox.innerHTML = "";

  if (!value || knowledgeBase.length === 0) {
    suggestionBox.style.display = "none";
    return;
  }

  const keywords = value.split(/\s+/);
  let scored = knowledgeBase.map(row => {
    const question = (row["User Question"] || "").toLowerCase();
    let score = 0;
    keywords.forEach(word => { if (question.includes(word)) score++; });
    return { text: row["User Question"], score };
  });

  scored = scored.filter(item => item.score > 0).sort((a,b)=>b.score-a.score).slice(0,5);
  if (scored.length === 0) { suggestionBox.style.display = "none"; return; }

  scored.forEach(item => {
    const div = document.createElement("div");
    div.innerText = item.text;
    div.style.padding = "8px";
    div.style.cursor = "pointer";
    div.style.borderBottom = "1px solid #eee";

    div.onmouseover = () => { div.style.background = "#ffe6f0"; };
    div.onmouseout = () => { div.style.background = suggestionBox.style.background; };
    div.onclick = () => {
      inputBox.value = item.text;
      suggestionBox.style.display = "none";
      inputBox.focus();
    };

    suggestionBox.appendChild(div);
  });

  const rect = inputBox.getBoundingClientRect();
  suggestionBox.style.left = rect.left + "px";
  suggestionBox.style.top = rect.bottom + window.scrollY + "px";
  suggestionBox.style.display = "block";

  updateSuggestionColors();
});

document.addEventListener("click", (e) => {
  if (e.target !== inputBox) suggestionBox.style.display = "none";
});

// ================= DARK MODE =================
document.getElementById("darkToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  updateSuggestionColors();
});

// ================= SEND BUTTON =================
// Add a modern send button
const sendBtn = document.createElement("button");
sendBtn.id = "sendBtn";
sendBtn.innerText = "Send";
sendBtn.style.marginLeft = "10px";
sendBtn.style.padding = "8px 16px";
sendBtn.style.border = "none";
sendBtn.style.borderRadius = "5px";
sendBtn.style.cursor = "pointer";
sendBtn.style.background = "#ff99cc";
sendBtn.style.color = "#fff";

document.querySelector(".chat-container").appendChild(sendBtn);

sendBtn.addEventListener("click", () => {
  suggestionBox.style.display = "none";
  sendMessage();
});

// Enter key also sends
inputBox.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    suggestionBox.style.display = "none";
    sendMessage();
  }
});
