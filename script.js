// ========= CONFIG =========
const API_URL = "https://script.google.com/macros/s/AKfycbzN_sJtQzw_MvgJ59G8tOnrOsTc2Uutq8hfeD-Rw-Ktrph8My6kn1IIm7_rQkX7ZnJclQ/exec";
const bannedURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREhew_r4KSC5plsfCVyKtmCp98MIINzoR-ZGdFYjNXbKCaiEf8GkYEwEvMvYAphrZB5ipDeSvqyVhr/pub?gid=0&single=true&output=csv";

let knowledgeBase = [];
let bannedWords = [];
let isDataLoaded = false;
let isProcessing = false;

// ========= LOAD =========
async function loadSheetData() {
  const res = await fetch(API_URL + "?t=" + Date.now());
  const data = await res.json();

  knowledgeBase = data.map(row => ({
    question: row.question.toLowerCase(),
    answer: row.answer
  }));
}

async function loadBannedWords() {
  const res = await fetch(bannedURL + "&t=" + Date.now());
  const text = await res.text();

  bannedWords = text.split("\n")
    .slice(1)
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
}

async function refreshData() {
  await loadSheetData();
  await loadBannedWords();
  isDataLoaded = true;
}

refreshData();
setInterval(refreshData, 30000);

// ========= UI =========
function addMessage(text, sender) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "message " + sender;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ========= SEARCH =========
function searchSheet(input) {
  input = input.toLowerCase();

  let best = null;
  let bestScore = 0;

  for (const row of knowledgeBase) {
    const words1 = input.split(" ");
    const words2 = row.question.split(" ");

    let match = 0;
    words1.forEach(w => {
      if (words2.includes(w)) match++;
    });

    const score = match / words2.length;

    if (score > bestScore) {
      bestScore = score;
      best = row.answer;
    }
  }

  return bestScore > 0.3 ? best : null;
}

// ========= AI =========
async function getAIResponse(message) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    return data.reply;
  } catch {
    return "⚠️ AI unavailable.";
  }
}

// ========= LOG =========
function logQuestion(q, found, a) {
  fetch(API_URL, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      type: "log",
      question: q,
      found: found,
      answer: a
    })
  });
}

// ========= MAIN =========
async function sendMessage() {
  if (isProcessing) return;
  isProcessing = true;

  const input = document.getElementById("userInput");
  const msg = input.value.trim();
  if (!msg) return;

  addMessage(msg, "user");
  input.value = "";

  if (!isDataLoaded) {
    addMessage("Loading...", "bot");
    isProcessing = false;
    return;
  }

  if (bannedWords.some(w => msg.toLowerCase().includes(w))) {
    addMessage("⚠️ Banned content.", "bot");
    isProcessing = false;
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

  isProcessing = false;
}

// ========= EVENTS =========
document.getElementById("sendBtn").onclick = sendMessage;

document.getElementById("userInput").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

// ========= SUGGESTIONS =========
const box = document.getElementById("suggestions");

document.getElementById("userInput").addEventListener("input", function() {
  const val = this.value.toLowerCase();
  box.innerHTML = "";

  if (!val) return;

  knowledgeBase
    .filter(k => k.question.includes(val))
    .slice(0,5)
    .forEach(k => {
      const div = document.createElement("div");
      div.className = "suggestion";
      div.innerText = k.question;

      div.onclick = () => {
        document.getElementById("userInput").value = k.question;
        box.innerHTML = "";
      };

      box.appendChild(div);
    });
});

// ========= DARK MODE =========
document.getElementById("darkToggle").onclick = () => {
  document.body.classList.toggle("dark-mode");
};
