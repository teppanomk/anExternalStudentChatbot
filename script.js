const API_URL = "https://script.google.com/macros/s/AKfycbyyzHdgQVib2M2tV_kYjuAwUiejdganuuyfB59UGDAIWay-odZnZbR-EDYgOCco8AZXWA/exec"; 
const bannedURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREhew_r4KSC5plsfCVyKtmCp98MIINzoR-ZGdFYjNXbKCaiEf8GkYEwEvMvYAphrZB5ipDeSvqyVhr/pub?gid=0&single=true&output=csv";

let knowledgeBase = [];
let bannedWords = [];
let isDataLoaded = false;
let isProcessing = false;

// ========== LOAD SHEETS ==========
async function loadSheetData() {
  const res = await fetch(API_URL + "?t=" + Date.now());
  knowledgeBase = await res.json();
  isDataLoaded = true;
}

async function loadBannedWords() {
  const res = await fetch(bannedURL + "&t=" + Date.now());
  const text = await res.text();
  bannedWords = text.split("\n").slice(1).map(x => x.trim().toLowerCase()).filter(Boolean);
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
  let best = null;
  let bestScore = 0;
  for (const row of knowledgeBase) {
    const words1 = input.split(" ");
    const words2 = row.question.toLowerCase().split(" ");
    let match = 0;
    words1.forEach(w => { if (words2.includes(w)) match++; });
    const score = match / words2.length;
    if (score > bestScore) { bestScore = score; best = row.answer; }
  }
  return bestScore > 0.3 ? best : null;
}

// ========== AI ==========
async function getAIResponse(message) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({message})
    });
    const data = await res.json();
    return data.reply;
  } catch {
    return "⚠️ AI unavailable.";
  }
}

// ========== LOG ==========
function logQuestion(q, found, a) {
  fetch(API_URL, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({type:"log", question:q, found:found, answer:a})
  });
}

// ========== SEND MESSAGE ==========
async function sendMessage() {
  if (isProcessing) return;
  isProcessing = true;

  const input = document.getElementById("userInput");
  const msg = input.value.trim();
  if (!msg) { isProcessing=false; return; }

  addMessage(msg, "user");
  input.value = "";

  if (!isDataLoaded) { addMessage("Loading...", "bot"); isProcessing=false; return; }

  if (bannedWords.some(w => msg.toLowerCase().includes(w))) {
    addMessage("⚠️ Banned content.", "bot"); 
    isProcessing=false; 
    return;
  }

  const answer = searchSheet(msg);
  if (answer) {
    addMessage(answer, "bot"); 
    logQuestion(msg, "Yes", answer);
  } else {
    const ai = await getAIResponse(msg);
    addMessage(ai, "bot"); 
    logQuestion(msg, "AI", ai);
  }
  isProcessing=false;
}

// ========== EVENT LISTENERS ==========
document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("userInput").addEventListener("keypress", e => { if(e.key==="Enter") sendMessage(); });

// ========== SUGGESTIONS ==========
window.onload = () => {
  const inputEl = document.getElementById("userInput");
  const suggestionBox = document.getElementById("suggestions");

  inputEl.addEventListener("input", function () {
    const value = this.value.toLowerCase().trim();
    suggestionBox.innerHTML = "";

    if (!isDataLoaded || knowledgeBase.length === 0 || !value) return;

    const matches = knowledgeBase
      .filter(item => item.question && item.question.toLowerCase().includes(value))
      .slice(0, 5);

    matches.forEach(item => {
      const div = document.createElement("div");
      div.className = "suggestion";
      div.innerText = item.question;

      div.onclick = () => {
        inputEl.value = item.question;
        suggestionBox.innerHTML = "";
        inputEl.focus();
      };

      suggestionBox.appendChild(div);
    });
  });
};

// ========== DARK MODE ==========
document.getElementById("darkToggle").onclick = () => {
  document.body.classList.toggle("dark-mode");
};
