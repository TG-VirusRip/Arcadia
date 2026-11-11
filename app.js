const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

let state = {coins:0,packs:[],cards:[],selected:null,qty:1,opened:[],cardIndex:0};
const $ = id => document.getElementById(id);
const demo = !tg || !tg.initData;
const headers = {"Content-Type":"application/json"};
if (tg?.initData) headers["X-Telegram-Init-Data"] = tg.initData;

function haptic(type="light"){
  if(localStorage.getItem("arc_vibe")==="off") return;
  try { if(tg?.HapticFeedback){ if(type==="success") tg.HapticFeedback.notificationOccurred("success"); else tg.HapticFeedback.impactOccurred(type); } else if(navigator.vibrate) navigator.vibrate(type==="heavy"?45:18); } catch(e){}
}
let audioCtx;
function sound(freq=500,duration=.08){
  if(localStorage.getItem("arc_sound")==="off") return;
  try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type="sine";g.gain.setValueAtTime(.06,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch(e){}
}
async function api(path,body){
  const API_BASE = "https://arcadia-backend-ofsa.onrender.com";
  const opts={method:body?"POST":"GET",headers,...(body?{body:JSON.stringify(body)}:{})};
  const url=API_BASE+path+(demo?"?demo=1":"");
  const r=await fetch(url,opts);const data=await r.json();
  if(!r.ok) throw new Error(data.error||"Ошибка сервера");
  return data;
}
function showError(e){alert(e.message||"Что-то пошло не так");}
async function load(){
  try{
    const d=await api("/api/bootstrap");
    state.coins=d.user.coins;state.packs=d.packs;state.cards=d.cards;
    $("coins").textContent=state.coins.toLocaleString("ru-RU");
    $("profileCoins").textContent=state.coins;
    $("username").textContent=d.user.username;
    $("cardCount").textContent=state.cards.length;
    $("dailyBtn").disabled=!d.daily_ready;
    $("dailyBtn").textContent=d.daily_ready?"🎁 Забрать ежедневный бонус · 200 монет":"✓ Ежедневный бонус уже получен";
    renderPacks();renderCards();
  }catch(e){showError(e);}
}
const symbols={Common:"✦",Rare:"✧",Epic:"❖",Legendary:"♛",Mythic:"✹"};
function renderPacks(){
  $("packs").innerHTML=state.packs.map(p=>`<button class="pack-card ${p.theme}" data-pack="${p.id}"><span class="pack-icon">${p.theme==="orange"?"🍥":p.theme==="blue"?"🌌":p.theme==="red"?"☠":p.theme==="gold"?"🎬":"紫"}</span><b>${p.name}</b><small>${p.subtitle}</small><span class="cost">✦ ${p.price} монет</span></button>`).join("");
  document.querySelectorAll("[data-pack]").forEach(b=>b.onclick=()=>choosePack(b.dataset.pack));
}
function renderCards(){
  $("collectionGrid").innerHTML=state.cards.length?state.cards.map(c=>`<div class="mini-card"><div style="font-size:35px">${symbols[c.rarity]||"✦"}</div><b>${c.title}</b><small>${c.rarity} · ${c.serial}</small></div>`).join(""):'<p class="hint">Пока пусто. Открой первый пак!</p>';
}
function choosePack(id){
  state.selected=state.packs.find(p=>p.id===id);state.qty=1;
  $("selectedPack").textContent=state.selected.name;
  updateQty();$("openModal").classList.remove("hidden");haptic();
}
function updateQty(){
  $("qty").textContent=state.qty;$("totalPrice").textContent=`Стоимость: ✦ ${state.qty*state.selected.price} монет`;
}
$("minus").onclick=()=>{state.qty=Math.max(1,state.qty-1);updateQty();sound(350)};
$("plus").onclick=()=>{state.qty=Math.min(10,state.qty+1);updateQty();sound(600)};
document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{state.qty=Math.max(1,Math.min(10,state.qty+Number(b.dataset.add)));updateQty();haptic()});
$("closeModal").onclick=()=>$("openModal").classList.add("hidden");
$("openBtn").onclick=async()=>{
  try{
    const d=await api("/api/open",{pack_id:state.selected.id,quantity:state.qty});
    state.coins=d.coins;state.opened=d.cards;state.cardIndex=0;
    $("coins").textContent=state.coins;$("profileCoins").textContent=state.coins;
    $("openModal").classList.add("hidden");startReveal();
  }catch(e){showError(e);}
};
function startReveal(){
  $("reveal").classList.remove("hidden");$("packWrapper").classList.remove("hidden","torn");
  $("cardStage").classList.add("hidden");$("swipeHint").classList.remove("hidden");
  $("cardCounter").textContent="";$("packWrapper").style.transform="translateX(0)";
}
let startX=0,lastX=0;
$("packWrapper").addEventListener("pointerdown",e=>{startX=e.clientX;lastX=startX;$("packWrapper").setPointerCapture(e.pointerId)});
$("packWrapper").addEventListener("pointermove",e=>{if(!startX)return;lastX=e.clientX;let dx=lastX-startX;$("packWrapper").style.transform=`translateX(${dx*.15}px) rotate(${dx*.025}deg)`});
$("packWrapper").addEventListener("pointerup",e=>{
  if(!startX)return;const dx=lastX-startX;startX=0;
  if(Math.abs(dx)>35 || Math.abs(e.clientX-e.clientX)<0){tearPack();}else{$("packWrapper").style.transform="translateX(0)";}
});
function tearPack(){
  $("packWrapper").classList.add("torn");$("swipeHint").textContent="Пак открыт!";sound(180,.25);haptic("heavy");
  setTimeout(()=>{$("packWrapper").classList.add("hidden");$("swipeHint").classList.add("hidden");$("cardStage").classList.remove("hidden");showCard();},650);
}
function showCard(){
  const c=state.opened[state.cardIndex];if(!c)return;
  const el=$("cardView");el.className="trading-card "+c.rarity;
  el.innerHTML=`<div class="symbol">${symbols[c.rarity]||"✦"}</div><div class="rarity">${c.rarity.toUpperCase()}</div><h2>${c.title}</h2><div class="serial">${c.serial}</div>`;
  $("cardCounter").textContent=`${state.cardIndex+1} / ${state.opened.length}`;
  if(c.rarity==="Mythic"){sound(950,.35);haptic("success")}else if(c.rarity==="Legendary"){sound(760,.2);haptic("success")}else sound(450,.1);
  $("prevCard").disabled=state.cardIndex===0;$("nextCard").disabled=state.cardIndex===state.opened.length-1;
}
$("prevCard").onclick=()=>{if(state.cardIndex>0){state.cardIndex--;showCard();haptic()}};
$("nextCard").onclick=()=>{if(state.cardIndex<state.opened.length-1){state.cardIndex++;showCard();haptic()}};
let touchX=0;
$("cardView").addEventListener("touchstart",e=>touchX=e.changedTouches[0].screenX,{passive:true});
$("cardView").addEventListener("touchend",e=>{let dx=e.changedTouches[0].screenX-touchX;if(Math.abs(dx)>45){state.cardIndex=Math.max(0,Math.min(state.opened.length-1,state.cardIndex+(dx<0?1:-1)));showCard();haptic()}},{passive:true});
$("revealClose").onclick=async()=>{$("reveal").classList.add("hidden");await load()};
$("dailyBtn").onclick=async()=>{try{const d=await api("/api/daily",{});state.coins=d.coins;sound(800,.2);haptic("success");await load();alert("Получено 200 монет!");}catch(e){showError(e)}};
document.querySelectorAll(".bottom button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".bottom button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(b.dataset.page).classList.add("active");haptic()});
$("soundToggle").checked=localStorage.getItem("arc_sound")!=="off";
$("vibeToggle").checked=localStorage.getItem("arc_vibe")!=="off";
$("soundToggle").onchange=e=>localStorage.setItem("arc_sound",e.target.checked?"on":"off");
$("vibeToggle").onchange=e=>localStorage.setItem("arc_vibe",e.target.checked?"on":"off");
$("language").value=localStorage.getItem("arc_lang")||"ru";
$("language").onchange=e=>{localStorage.setItem("arc_lang",e.target.value);alert(e.target.value==="en"?"English interface will be added in the next beta update.":"Язык интерфейса: русский.")};
load();
