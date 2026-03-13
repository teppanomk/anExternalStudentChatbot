const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSfUYEYX8MIGIYW5hTWf2hz_j0VT7TBiZlAWkB183PuT25msmPFtizLvmD9ktXgV4aMj2e8E6IACs6U/pub?gid=0&single=true&output=csv";

const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

const LOG_API = "https://script.google.com/macros/s/AKfycbze3yVdySjDVy2MOi9SuZgzAOGe09VMx5d8RruXMemn7_IdG8B7LLDLOPDa1ApNvDmvvQ/exec";

let knowledgeBase = [];

const blockedWords = [
"sex",
"porn",
"kill",
"hate",
"violence"
];

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

div.className = "message " + sender;

div.innerText = text;

chat.appendChild(div);

chat.scrollTop = chat.scrollHeight;

}



function normalize(text){

return text
.toLowerCase()
.replace(/[^\w\s]/gi,"");

}



function isValidQuestion(question){

const q = normalize(question);

for(const word of blockedWords){

if(q.includes(word)){
return false;
}

}

return true;

}



function searchSheet(question){

const q = normalize(question);

for(const row of knowledgeBase){

if(!row["User Question"]) continue;

const sheetQ = normalize(row["User Question"]);

if(q.includes(sheetQ) || sheetQ.includes(q)){
return row["Bot Answer"];
}

}

return null;

}



async function askGemini(question){

const response = await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
contents:[
{
parts:[
{
text:`You are a helpful university assistant chatbot.
Answer clearly and briefly.

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



async function logQuestion(question,found,answer){

try{

await fetch(LOG_API,{
method:"POST",
mode:"no-cors",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
question:question,
found:found,
answer:answer
})
});

}catch(error){

console.log("Logging error:",error);

}

}



async function sendMessage(){

const input = document.getElementById("userInput");

const message = input.value.trim();

if(!message) return;


if(!isValidQuestion(message)){

addMessage("⚠️ This question is not allowed.","bot");

input.value="";
return;

}


addMessage(message,"user");

input.value="";

document.getElementById("suggestionBox").innerHTML="";


let sheetAnswer = searchSheet(message);

if(sheetAnswer){

addMessage(sheetAnswer,"bot");

logQuestion(message,"Yes",sheetAnswer);

return;

}


addMessage("Thinking...","bot");

let aiAnswer = await askGemini(message);

document.querySelector("#chat .bot:last-child").innerText = aiAnswer;

logQuestion(message,"No",aiAnswer);

}



document.getElementById("userInput").addEventListener("keypress",function(event){

if(event.key==="Enter"){

event.preventDefault();

sendMessage();

}

});



/* AUTOCOMPLETE SUGGESTIONS */

document.getElementById("userInput").addEventListener("input",function(){

const keyword = this.value.toLowerCase();

const box = document.getElementById("suggestionBox");

box.innerHTML="";

if(keyword.length < 2) return;

const matches = knowledgeBase
.filter(row => row["User Question"] && row["User Question"].toLowerCase().includes(keyword))
.slice(0,5);

matches.forEach(row => {

const div = document.createElement("div");

div.className="suggestion-item";

div.innerText=row["User Question"];

div.onclick=()=>{

document.getElementById("userInput").value=row["User Question"];

box.innerHTML="";

};

box.appendChild(div);

});

});



document.getElementById("darkToggle").addEventListener("click",()=>{

document.body.classList.toggle("dark");

});



window.onload = () => {

document.getElementById("userInput").focus();

};
