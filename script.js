// ================= CONFIG =================
const API_URL = "https://script.google.com/macros/s/AKfycbzx32ukTgnxurO3rWLcLuMYcTE-ueRCYQmr_IXfievPalf3PGz0Ocu62eNBW58RimrkFQ/exec";
const bannedURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREhew_r4KSC5plsfCVyKtmCp98MIINzoR-ZGdFYjNXbKCaiEf8GkYEwEvMvYAphrZB5ipDeSvqyVhr/pub?gid=0&single=true&output=csv";
const LOG_API = "https://script.google.com/macros/s/AKfycbze3yVdySjDVy2MOi9SuZgzAOGe09VMx5d8RruXMemn7_IdG8B7LLDLOPDa1ApNvDmvvQ/exec";

// ================= STATE =================
let knowledgeBase = [];
let bannedWords = [];
let isDataLoaded = false;
let isProcessing = false;

// ================= LOAD DATA =================
async function loadSheetData() {
  const response = await fetch(API_URL + "?t=" + Date.now());
  const data = await response.json();

  knowledgeBase = data.map(row => ({
    question: row.question.toLowerCase(),
    answer: row.answer
  }));
}

async function loadBannedWords() {
  const response = await fetch(bannedURL + "&t=" + Date.now());
  const csv = await response.text();

  const rows = csv.split("\n").slice(1);
  bannedWords = rows.map(r => r.trim().toLowerCase()).filter(Boolean);
}

async function refreshData() {
  await loadSheetData();
  await loadBannedWords();
  isDataLoaded = true;
  console.log("🔄 Data refreshed");
}

// Initial load
refreshData();

// Auto refresh every 30 sec
setInterval(refreshData, 30000);

// ================= CHAT UI =================
function addMessage(text, sender) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "message " + sender;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function showTyping() {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "message bot";
  div.id = "typing";
  div.innerText = "Typing...";
  chat.appendChild(div);
}

function removeTyping() {
  const typing = document.getElementById("typing");
  if (typing) typing.remove();
}

// ================= SEARCH =================
function searchSheet(question) {
  question = question.toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  for (const row of knowledgeBase) {
    const q = row.question;

    const qWords = q.split(" ");
    const inputWords = question.split(" ");

    let match = 0;

    inputWords.forEach(word => {
      if (qWords.includes(word)) match++;
    });

    const score = match / qWords.length;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = row.answer;
    }
  }

  return bestScore > 0.3 ? bestMatch : null;
}

// ================= FILTER =================
function containsBannedWord(text) {
  const lower = text.toLowerCase();
  return bannedWords.some(word => lower.includes(word));
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
  } catch (e) {
    console.log("Log error:", e);
  }
}

// ================= MAIN =================
async function sendMessage() {
  if (isProcessing) return;
  isProcessing = true;

  const input = document.getElementById("userInput");
  const message = input.value.trim();

  if (!message) return;

  if (!isDataLoaded) {
    addMessage("⏳ Loading data, please wait...", "bot");
    isProcessing = false;
    return;
  }

  if (containsBannedWord(message)) {
    addMessage("⚠️ Message contains banned words.", "bot");
    input.value = "";
    isProcessing = false;
    return;
  }

  addMessage(message, "user");
  input.value = "";

  showTyping();

  setTimeout(() => {
    removeTyping();

    const answer = searchSheet(message);

    if (answer) {
      addMessage(answer, "bot");
      logQuestion(message, "Yes", answer);
    } else {
      const fallback = "Sorry, I don't have an answer yet.";
      addMessage(fallback, "bot");
      logQuestion(message, "No", fallback);
    }

    isProcessing = false;
  }, 500);
}

// ================= EVENTS =================
document.getElementById("userInput").addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

document.getElementById("darkToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});
