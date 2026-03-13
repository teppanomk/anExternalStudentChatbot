const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSfUYEYX8MIGIYW5hTWf2hz_j0VT7TBiZlAWkB183PuT25msmPFtizLvmD9ktXgV4aMj2e8E6IACs6U/pub?gid=0&single=true&output=csv";
const GEMINI_API_KEY = "AIzaSyBG1Kdmld1m-GLcKvpJyzBpn5aG6XBL16U";

let knowledgeBase = [];
let suggestions = [];
let selectedIndex = -1;

const blockedWords = ["sex","porn","kill","hate","violence"];



async function loadSheetData(){

const response = await fetch(sheetURL);
const csv = await response.text();

const parsed = Papa.parse(csv,{
header:true,
skipEmptyLines:true
});

knowledgeBase = parsed.data;

}

loadSheetData();



function addMessage(text,sender){

const chat = document.getElementById("chat");

const div = document.createElement("div");

div.className="message "+sender;

div.innerText=text;

chat.appendChild(div);

chat.scrollTop=chat.scrollHeight;

}



function normalize(text){

return text.toLowerCase().replace(/[^\w\s]/gi,"");

}



function isValidQuestion(question){

const q=normalize(question);

for(const word of blockedWords){

if(q.includes(word)) return false;

}

return true;

}



async function semanticSearch(question){

const response = await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${GEMINI_API_KEY}`,
{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({
content:{ parts:[{ text:question }] }
})
});

const data = await response.json();

const userEmbedding = data.embedding.values;

let bestScore = 0;
let bestAnswer = null;

for(const row of knowledgeBase){

if(!row["User Question"]) continue;

const q=row["User Question"];

const emb = await getEmbedding(q);

const score = cosineSimilarity(userEmbedding,emb);

if(score > bestScore){

bestScore = score;
bestAnswer = row["Bot Answer"];

}

}

if(bestScore > 0.75) return bestAnswer;

return null;

}



async function getEmbedding(text){

const response = await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${GEMINI_API_KEY}`,
{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({
content:{ parts:[{ text:text }] }
})
});

const data = await response.json();

return data.embedding.values;

}



function cosineSimilarity(a,b){

let dot=0;
let magA=0;
let magB=0;

for(let i=0;i<a.length;i++){

dot+=a[i]*b[i];
magA+=a[i]*a[i];
magB+=b[i]*b[i];

}

magA=Math.sqrt(magA);
magB=Math.sqrt(magB);

return dot/(magA*magB);

}



async function askGemini(question){

const response = await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({
contents:[
{
parts:[
{
text:`You are a helpful university assistant chatbot.

Question: ${question}`
}
]
}
]
})
});

const data = await response.json();

return data?.candidates?.[0]?.content?.parts?.[0]?.text
|| "Sorry, I couldn't find an answer.";

}



async function sendMessage(){

const input=document.getElementById("userInput");
const message=input.value.trim();

if(!message) return;

if(!isValidQuestion(message)){

addMessage("⚠️ This question is not allowed.","bot");

input.value="";
return;

}

addMessage(message,"user");

input.value="";
document.getElementById("suggestionBox").innerHTML="";

addMessage("Thinking...","bot");

let sheetAnswer = await semanticSearch(message);

if(sheetAnswer){

document.querySelector("#chat .bot:last-child").innerText=sheetAnswer;

return;

}

let aiAnswer = await askGemini(message);

document.querySelector("#chat .bot:last-child").innerText=aiAnswer;

}



const input = document.getElementById("userInput");

input.addEventListener("input",function(){

const keyword=this.value.toLowerCase();

const box=document.getElementById("suggestionBox");

box.innerHTML="";
selectedIndex=-1;

if(keyword.length<2) return;

suggestions = knowledgeBase
.filter(row=>row["User Question"] && row["User Question"].toLowerCase().includes(keyword))
.slice(0,5);

suggestions.forEach((row,index)=>{

const div=document.createElement("div");

div.className="suggestion-item";
div.innerText=row["User Question"];

div.onclick=()=>{

input.value=row["User Question"];
box.innerHTML="";

};

box.appendChild(div);

});

});



input.addEventListener("keydown",function(e){

const items=document.querySelectorAll(".suggestion-item");

if(!items.length) return;

if(e.key==="ArrowDown"){

selectedIndex++;
if(selectedIndex>=items.length) selectedIndex=0;

}

if(e.key==="ArrowUp"){

selectedIndex--;
if(selectedIndex<0) selectedIndex=items.length-1;

}

if(e.key==="Enter"){

if(selectedIndex>-1){

e.preventDefault();

input.value=items[selectedIndex].innerText;

document.getElementById("suggestionBox").innerHTML="";

return;

}

sendMessage();

}

items.forEach(i=>i.classList.remove("active"));

if(selectedIndex>-1){

items[selectedIndex].classList.add("active");

}

});



document.getElementById("darkToggle").addEventListener("click",()=>{

document.body.classList.toggle("dark");

});
