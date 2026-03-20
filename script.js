// ================= CONFIG =================
const API_URL = "https://script.google.com/macros/s/AKfycbwF-er3hjnbMETDdNqudt8jkaaCQ5MSk4T01DqKGNPEXejn62go9mGMPMoYrFPHk0hpqA/exec";
const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSfUYEYX8MIGIYW5hTWf2hz_j0VT7TBiZlAWkB183PuT25msmPFtizLvmD9ktXgV4aMj2e8E6IACs6U/pub?gid=0&single=true&output=csv"; // ChatData
const bannedURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREhew_r4KSC5plsfCVyKtmCp98MIINzoR-ZGdFYjNXbKCaiEf8GkYEwEvMvYAphrZB5ipDeSvqyVhr/pub?gid=0&single=true&output=csv";

let knowledgeBase = [];
let bannedWords = [];
let isDataLoaded = false;

// ========== LOAD SHEETS ==========
async function loadSheetData() {
  try {
    const res = await fetch(sheetURL + "?t=" + Date.now());
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    knowledgeBase = parsed.data;
    isDataLoaded = true;
  } catch (e) { console.error("Failed to load Q&A:", e); }
}

async function loadBannedWords() {
  try {
    const res = await fetch(bannedURL + "?t=" + Date.now());
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const header = Object.keys(parsed.data[0] || {});
    const bannedColumn = header.find(h => h.toLowerCase().includes("banned"));
    bannedWords = parsed.data.map(r => r[bannedColumn]).filter(Boolean).map(w => w.toLowerCase());
  } catch (e) { console.error("Failed to load banned words:", e); }
}

async function refreshData() {
  await loadSheetData();
  await loadBannedWords();
}
refreshData();
setInterval(refreshData, 30000);

// ========== UI ==========
function addMessage(text, sender) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "message " + sender;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ========== SEARCH ==========
function searchSheet(input) {
  input = input.toLowerCase();
  for (const row of knowledgeBase) {
    if (!row["User Question"]) continue;
    const q = row["User Question"].toLowerCase();
    if (q.includes(input) || input.includes(q)) return row["Bot Answer"];
  }
  return null;
}

// ========== LOG ==========
function logQuestion(q, found, a) {
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "log",
      question: q,
      found: found,
      answer: a
    })
  });
}

// ========== SEND MESSAGE ==========
async function sendMessage() {
  const input = document.getElementById("userInput");
  const msg = input.value.trim();
  if (!msg) return;

  // Banned words check
  if (bannedWords.some(w => msg.toLowerCase().includes(w))) {
    addMessage("⚠️ Your message contains banned words.", "bot");
    input.value = "";
    return; // Do not log banned messages
  }

  addMessage(msg, "user");
  input.value = "";

  let answer = searchSheet(msg);
  if (answer) {
    addMessage(answer, "bot");
    logQuestion(msg, "Yes", answer); // Q&A found
  } else {
    // AI fallback
    let aiReply = "AI unavailable";
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      aiReply = data.reply || "AI unavailable";
      addMessage(aiReply, "bot");
    } catch (e) {
      addMessage("⚠️ AI unavailable", "bot");
    }
    logQuestion(msg, "No", aiReply); // AI fallback, always logged
  }
}

// ========== SUGGESTIONS ==========
window.onload = () => {
  const inputEl = document.getElementById("userInput");
  const suggestionBox = document.getElementById("suggestions");

  inputEl.addEventListener("input", function () {
    const value = this.value.toLowerCase().trim();
    suggestionBox.innerHTML = "";

    if (!isDataLoaded || !value) return;

    const matches = knowledgeBase
      .filter(item => item["User Question"] && item["User Question"].toLowerCase().includes(value))
      .slice(0, 5);

    matches.forEach(item => {
      const div = document.createElement("div");
      div.className = "suggestion";
      div.innerText = item["User Question"];
      div.onclick = () => {
        inputEl.value = item["User Question"];
        suggestionBox.innerHTML = "";
        inputEl.focus();
      };
      suggestionBox.appendChild(div);
    });
  });
};

// ========== EVENT LISTENERS ==========
document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("userInput").addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

// ========== DARK MODE ==========
document.getElementById("darkToggle").onclick = () => {
  document.body.classList.toggle("dark-mode");
};
