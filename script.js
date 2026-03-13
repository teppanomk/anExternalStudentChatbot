const sheetURL = "YOUR_KNOWLEDGE_BASE_CSV";

const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

const LOG_API = "YOUR_LOG_SCRIPT_API";

let knowledgeBase = [];

let suggestions = [];
let selectedIndex = -1;

const blockedWords = [
"sex","porn","kill","hate","violence"
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

div.className="message "+sender;

div.innerText=text;

chat.appendChild(div);

chat.scrollTop=chat.scrollHeight;

}



function normalize(text){

return text.toLowerCase().replace(/[^\w\s]/gi,"");

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



function keywordSearch(question){

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

if(!LOG_API) return;

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

console.log("Log error:",error);

}

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


let sheetAnswer = keywordSearch(message);

if(sheetAnswer){

document.querySelector("#chat .bot:last-child").innerText = sheetAnswer;

logQuestion(message,"Yes",sheetAnswer);

return;

}


let aiAnswer = await askGemini(message);

document.querySelector("#chat .bot:last-child").innerText = aiAnswer;

logQuestion(message,"No",aiAnswer);

}



const input=document.getElementById("userInput");

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

if(selectedIndex>-1 && items[selectedIndex]){

items[selectedIndex].classList.add("active");

}

});



document.getElementById("darkToggle").addEventListener("click",()=>{

document.body.classList.toggle("dark");

});



window.onload=()=>{

document.getElementById("userInput").focus();

};
