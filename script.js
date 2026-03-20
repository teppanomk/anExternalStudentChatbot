// ================= CONFIG =================
const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSfUYEYX8MIGIYW5hTWf2hz_j0VT7TBiZlAWkB183PuT25msmPFtizLvmD9ktXgV4aMj2e8E6IACs6U/pub?gid=0&single=true&output=csv";

const bannedURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREhew_r4KSC5plsfCVyKtmCp98MIINzoR-ZGdFYjNXbKCaiEf8GkYEwEvMvYAphrZB5ipDeSvqyVhr/pub?gid=0&single=true&output=csv";

const LOG_API = "https://script.google.com/macros/s/AKfycbze3yVdySjDVy2MOi9SuZgzAOGe09VMx5d8RruXMemn7_IdG8B7LLDLOPDa1ApNvDmvvQ/exec";

// ================= STATE =================
let knowledgeBase = [];
let bannedWords = [];
let isLoaded = false;

// ================= LOAD DATA =================
async function loadSheetData() {
  try {
    const response = await fetch(sheetURL);
    const csv = await response.text();

    const parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true
    });

    knowledgeBase = parsed.data;
    isLoaded = true;

    console.log("✅ Sheet loaded:", knowledgeBase.length);
  } catch (err) {
    console.error("❌ Sheet error:", err);
  }
}

async function loadBannedWords() {
  try {
    const response = await fetch(bannedURL);
    const csv = await response.text();

    const parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true
    });

    const header = Object.keys(parsed.data[0] || {});
    const bannedColumn = header.find(h =>
      h.toLowerCase().includes("banned")
    );

    if (!bannedColumn) return;

    bannedWords = parsed.data
      .map(row => row[bannedColumn])
      .filter(Boolean)
      .map(w => w.toLowerCase());

  } catch (err) {
    console.error("❌ Banned error:", err);
  }
}

// Initial load
loadSheetData();
loadBannedWords();

// Auto refresh
setInterval(() => {
  loadSheetData();
  loadBannedWords();
  console.log("🔄 Refreshed");
}, 30000);

// ================= UI =================
function addMessage(text, sender) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "message " + sender;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ================= SEARCH =================
function searchSheet(question) {
  const input = question.toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  for (const row of knowledgeBase) {
    if (!row["User Question"]) continue;

    const q = row["User Question"].toLowerCase();
    let score = 0;

    if (input.includes(q)) score += 3;
    if (q.includes(input)) score += 2;

    const inputWords = input.split(/\W+/);
    const qWords = q.split(/\W+/);

    inputWords.forEach(word => {
      if (qWords.includes(word)) score++;
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = row;
    }
  }

  return bestScore > 1 ? bestMatch["Bot Answer"] : null;
}

// ================= BANNED =================
function containsBannedWord(text) {
  const lowerText = text.toLowerCase();

  return bannedWords.some(word => {
    if (!word) return false;

    word = word.toLowerCase().trim();

    // For short words (like Thai), use includes
    if (word.length <= 4) {
      return lowerText.includes(word);
    }

    // For longer words, match whole words (English safe)
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(lowerText);
  });
}

// ================= LOG =================
async function logQuestion(question, found, answer) {
  try {
    await fetch(LOG_API, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, found, answer })
    });
  } catch (err) {
    console.log("Log error:", err);
  }
}

// ================= CHAT =================
async function sendMessage() {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  if (!message) return;

  if (!isLoaded) {
    addMessage("⏳ Loading data, please wait...", "bot");
    return;
  }

  if (containsBannedWord(message)) {
    addMessage("⚠️ Message contains banned words.", "bot");
    input.value = "";
    return;
  }

  addMessage(message, "user");
  input.value = "";

  // typing
  const typing = addTyping();

  let answer = searchSheet(message);

  if (!answer) {
    answer = "Sorry, I don't have an answer for that yet.";
    logQuestion(message, "No", answer);
  } else {
    logQuestion(message, "Yes", answer);
  }

  setTimeout(() => {
    typing.innerText = answer;
  }, 400);
}

function addTyping() {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "message bot";
  div.innerText = "Typing...";
  chat.appendChild(div);
  return div;
}

// ================= SMART KEYWORD SUGGESTIONS =================
const inputBox = document.getElementById("userInput");

const suggestionBox = document.createElement("div");
suggestionBox.style.background = "#fff";
suggestionBox.style.border = "1px solid #ccc";
suggestionBox.style.position = "absolute";
suggestionBox.style.width = "400px";
suggestionBox.style.maxHeight = "150px";
suggestionBox.style.overflowY = "auto";
suggestionBox.style.display = "none";
suggestionBox.style.zIndex = "999";

document.body.appendChild(suggestionBox);

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

    keywords.forEach(word => {
      if (question.includes(word)) score++;
    });

    return {
      text: row["User Question"],
      score: score
    };
  });

  // Filter only relevant matches
  scored = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // top 5

  if (scored.length === 0) {
    suggestionBox.style.display = "none";
    return;
  }

  scored.forEach(item => {
    const div = document.createElement("div");
    div.innerText = item.text;

    div.style.padding = "8px";
    div.style.cursor = "pointer";
    div.style.borderBottom = "1px solid #eee";

    div.onmouseover = () => {
      div.style.background = "#ffe6f0";
    };

    div.onmouseout = () => {
      div.style.background = "#fff";
    };

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
});

// Hide suggestions when clicking outside
document.addEventListener("click", (e) => {
  if (e.target !== inputBox) {
    suggestionBox.style.display = "none";
  }
});

// ================= EVENTS =================
inputBox.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    suggestionBox.style.display = "none";
    sendMessage();
  }
});

document.getElementById("darkToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});
