/* ============================================================
   KoreanLang — app.js
   Structure modeled on the cherrypow/japanlang GrowLANG engine,
   adapted for Korean (SOV, topic/subject/object particles baked
   into word tokens, descriptive verbs as self-contained predicates).
   ============================================================ */

function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function pick(a){return a[Math.floor(Math.random()*a.length)];}

/* ---------- persistence ---------- */
var KL_KEY='koreanlang_v1';
var xp=0, streak=0, lastPlayDate=null;
var quizPassed={}; // {lv: {mode1:bool, mode2:bool, mode3:bool}}
var grammarViewed={};
function saveState(){
  try{
    localStorage.setItem(KL_KEY, JSON.stringify({xp:xp,streak:streak,lastPlayDate:lastPlayDate,quizPassed:quizPassed,grammarViewed:grammarViewed}));
  }catch(e){}
}
function loadState(){
  try{
    var raw=localStorage.getItem(KL_KEY);
    if(!raw)return;
    var d=JSON.parse(raw);
    xp=d.xp||0; streak=d.streak||0; lastPlayDate=d.lastPlayDate||null;
    quizPassed=d.quizPassed||{}; grammarViewed=d.grammarViewed||{};
  }catch(e){}
}
function updateXP(){ saveState(); }
function bumpStreak(){
  var today=new Date().toDateString();
  if(lastPlayDate===today)return;
  if(lastPlayDate){
    var y=new Date(); y.setDate(y.getDate()-1);
    if(lastPlayDate===y.toDateString())streak++; else streak=1;
  } else { streak=1; }
  lastPlayDate=today; saveState();
}

/* ---------- level unlock ---------- */
var LEVEL_REQ={1:0,2:1,3:2,4:3,5:4}; // level N requires level N-1 fully passed (all 3 quiz modes)
function levelPassed(lv){
  var q=quizPassed[lv];
  return !!(q && q.mode1 && q.mode2 && q.mode3);
}
function isLevelUnlocked(lv){
  if(devMode)return true;
  if(lv===1)return true;
  return levelPassed(lv-1);
}
var GROWKOR_UNLOCK={1:1,2:2,3:4};
function isGrowKORLevelUnlocked(lv){ return isLevelUnlocked(GROWKOR_UNLOCK[lv]||1); }

/* ---------- dev mode (5 taps on the mascot within 2s) ---------- */
var devMode=false, devTapCount=0, devTapTimer=null;
function devTap(){
  devTapCount++;
  if(devTapTimer)clearTimeout(devTapTimer);
  devTapTimer=setTimeout(function(){devTapCount=0;},2000);
  if(devTapCount<5)return;
  devTapCount=0;
  devMode=!devMode;
  showToast(devMode?'Dev mode ON — all levels unlocked':'Dev mode OFF');
  var qb=document.getElementById('dev-quiz-btn');
  if(devMode&&!qb){
    qb=document.createElement('button');
    qb.id='dev-quiz-btn';
    qb.style.cssText='position:fixed;bottom:80px;right:16px;background:#8F1A1A;color:#fff;padding:10px 16px;border-radius:20px;font-size:12px;font-weight:700;z-index:10000;cursor:pointer;font-family:inherit;border:none;box-shadow:0 2px 10px rgba(0,0,0,.4)';
    qb.textContent='Quiz →';
    qb.onclick=function(){goTo('quiz');};
    document.body.appendChild(qb);
  } else if(!devMode&&qb){
    qb.remove();
  }
  if(curSec==='home')renderHome();
}

/* ---------- nav ---------- */
var curSec='home';
function goTo(sec, btn){
  curSec=sec;
  var secs=document.querySelectorAll('.sec');
  for(var i=0;i<secs.length;i++)secs[i].classList.remove('on');
  var el=document.getElementById('sec-'+sec);
  if(el)el.classList.add('on');
  var navs=document.querySelectorAll('.nav-item');
  for(var i=0;i<navs.length;i++)navs[i].classList.remove('on');
  if(btn)btn.classList.add('on');
  else{
    var map={home:0,games:1,growkor:2,bank:3};
    if(map[sec]!==undefined && navs[map[sec]])navs[map[sec]].classList.add('on');
  }
  if(sec==='home')renderHome();
  if(sec==='grammar')renderGrammarHome();
  if(sec==='bank')renderBank();
  if(sec==='games')renderGamePicker();
  if(sec==='growkor'){grtInitDom();grtUpdateLvButtons();if(!grtRows.length)grtReset();}
  if(sec==='quiz' && !quizQueue.length)startQuiz(quizLevel||currentGLevel||1);
  window.scrollTo(0,0);
}

/* ---------- speech (best-effort, silently no-ops if unavailable) ---------- */
var _koVoice=null;
function _pickKoVoice(){
  if(!('speechSynthesis' in window))return;
  var vs=speechSynthesis.getVoices();
  for(var i=0;i<vs.length;i++){ if(vs[i].lang && vs[i].lang.indexOf('ko')===0){_koVoice=vs[i];return;} }
}
if('speechSynthesis' in window){
  _pickKoVoice();
  speechSynthesis.onvoiceschanged=_pickKoVoice;
}
function speakKorean(text){
  try{
    if(!('speechSynthesis' in window))return;
    speechSynthesis.cancel();
    var u=new SpeechSynthesisUtterance(text);
    u.lang='ko-KR';
    if(_koVoice)u.voice=_koVoice;
    speechSynthesis.speak(u);
  }catch(e){}
}

/* ---------- sound effects (Web Audio oscillator tones, no assets) ---------- */
var _ac=null;
function _getAC(){
  if(_ac&&_ac.state!=='closed')return _ac;
  try{_ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}
  return _ac;
}
document.addEventListener('touchstart',function(){var a=_getAC();if(a&&a.state==='suspended')a.resume();},{once:true});
document.addEventListener('click',function(){var a=_getAC();if(a&&a.state==='suspended')a.resume();},{once:true});
function _playTone(freq,type,vol,dur){
  try{
    var c=_getAC();if(!c)return;
    var o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);
    o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);
    g.gain.setValueAtTime(vol,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
    o.start(c.currentTime);o.stop(c.currentTime+dur);
  }catch(e){}
}
function playTap(){_playTone(600,'sine',0.15,0.08);}
function playCorrect(){_playTone(880,'sine',0.3,0.2);}
function playWrong(){_playTone(200,'square',0.2,0.3);}
function playLevelUp(){
  try{var c=_getAC();if(!c)return;var t=c.currentTime;
    [523,659,784].forEach(function(f,i){var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(f,t+i*0.15);g.gain.setValueAtTime(0.3,t+i*0.15);g.gain.exponentialRampToValueAtTime(0.001,t+i*0.15+0.3);o.start(t+i*0.15);o.stop(t+i*0.15+0.3);});
  }catch(e){}
}
function playVictoryFanfare(){
  try{var c=_getAC();if(!c)return;var t=c.currentTime;
    [523,659,784,1047,1319].forEach(function(f,i){var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='triangle';o.frequency.setValueAtTime(f,t+i*0.12);g.gain.setValueAtTime(0.25,t+i*0.12);g.gain.exponentialRampToValueAtTime(0.001,t+i*0.12+0.4);o.start(t+i*0.12);o.stop(t+i*0.12+0.4);});
  }catch(e){}
}
function playFailBuzz(){
  try{var c=_getAC();if(!c)return;var t=c.currentTime;
    [300,200].forEach(function(f,i){var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sawtooth';o.frequency.setValueAtTime(f,t+i*0.2);g.gain.setValueAtTime(0.15,t+i*0.2);g.gain.exponentialRampToValueAtTime(0.001,t+i*0.2+0.3);o.start(t+i*0.2);o.stop(t+i*0.2+0.3);});
  }catch(e){}
}

/* ============================================================
   GRAMMAR SCENE ILLUSTRATIONS — reusable inline-SVG builder library.
   A small set of actor/prop generator functions composed per example,
   rather than 60 fully bespoke illustrations (see langapp_launch_process.md).
   ============================================================ */
function gsWrap(bg,content){
  return '<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px;display:block;margin:0 auto 8px;border-radius:12px">'+
    '<rect width="200" height="150" rx="14" fill="'+bg+'"/>'+content+
    '<rect x="3" y="3" width="194" height="144" rx="12" fill="none" stroke="#8F1A1A" stroke-width="2.5" opacity=".6"/></svg>';
}
function gsActor(x,robe){
  return '<circle cx="'+x+'" cy="55" r="13" fill="#e8b890"/>'+
    '<path d="M'+(x-15)+',97 Q'+(x-15)+',71 '+x+',71 Q'+(x+15)+',71 '+(x+15)+',97 Z" fill="'+robe+'"/>'+
    '<circle cx="'+(x-5)+'" cy="53" r="1.8" fill="#3a2a1a"/><circle cx="'+(x+5)+'" cy="53" r="1.8" fill="#3a2a1a"/>'+
    '<path d="M'+(x-4)+',60 Q'+x+',63 '+(x+4)+',60" fill="none" stroke="#3a2a1a" stroke-width="1.3"/>'+
    '<path d="M'+(x-13)+',47 Q'+x+',37 '+(x+13)+',47 Q'+(x+13)+',51 '+x+',49 Q'+(x-13)+',51 '+(x-13)+',47" fill="#1a1a1a"/>';
}
function gsActorRun(x,robe){ // leaning-forward running pose
  return '<circle cx="'+x+'" cy="52" r="12" fill="#e8b890"/>'+
    '<path d="M'+(x-16)+',95 Q'+(x-18)+',70 '+(x-2)+',68 Q'+(x+16)+',68 '+(x+10)+',95 Z" fill="'+robe+'"/>'+
    '<circle cx="'+(x+2)+'" cy="50" r="1.6" fill="#3a2a1a"/>'+
    '<path d="M'+(x-12)+',44 Q'+x+',34 '+(x+12)+',44 Q'+(x+12)+',48 '+x+',46 Q'+(x-12)+',48 '+(x-12)+',44" fill="#1a1a1a"/>'+
    '<line x1="'+(x-16)+'" y1="100" x2="'+(x-26)+'" y2="115" stroke="'+robe+'" stroke-width="5" stroke-linecap="round"/>'+
    '<line x1="'+(x+8)+'" y1="100" x2="'+(x+20)+'" y2="112" stroke="'+robe+'" stroke-width="5" stroke-linecap="round"/>';
}
function gsBowl(x,y){
  return '<ellipse cx="'+x+'" cy="'+y+'" rx="26" ry="9" fill="#f0e8d0"/>'+
    '<path d="M'+(x-26)+','+y+' Q'+x+','+(y+24)+' '+(x+26)+','+y+' Z" fill="#d4e4f0"/>'+
    '<ellipse cx="'+x+'" cy="'+(y-6)+'" rx="20" ry="7" fill="#fffdf8"/>'+
    '<rect x="'+(x-38)+'" y="'+(y-20)+'" width="4" height="22" rx="2" fill="#ccc" transform="rotate(30 '+(x-36)+' '+(y-10)+')"/>';
}
function gsCup(x,y,liquid){
  return '<ellipse cx="'+x+'" cy="'+y+'" rx="18" ry="7" fill="#6B3E1C"/>'+
    '<path d="M'+(x-18)+','+y+' Q'+x+','+(y+17)+' '+(x+18)+','+y+' Z" fill="'+(liquid||'#8B5E3C')+'"/>'+
    '<path d="M'+(x-8)+','+(y-15)+' Q'+(x-12)+','+(y-23)+' '+(x-8)+','+(y-31)+'" fill="none" stroke="#fff" stroke-width="2" opacity=".4" stroke-linecap="round"/>'+
    '<path d="M'+(x+2)+','+(y-15)+' Q'+(x-2)+','+(y-23)+' '+(x+2)+','+(y-31)+'" fill="none" stroke="#fff" stroke-width="2" opacity=".4" stroke-linecap="round"/>';
}
function gsGlass(x,y,liquid){
  return '<path d="M'+(x-12)+','+(y-40)+' L'+(x-9)+','+y+' L'+(x+9)+','+y+' L'+(x+12)+','+(y-40)+' Z" fill="#d8eef8" opacity=".5"/>'+
    '<path d="M'+(x-10)+','+(y-26)+' L'+(x-8.5)+','+y+' L'+(x+8.5)+','+y+' L'+(x+10)+','+(y-26)+' Z" fill="'+(liquid||'#a8d8f0')+'"/>'+
    '<path d="M'+(x-12)+','+(y-40)+' L'+(x-9)+','+y+' L'+(x+9)+','+y+' L'+(x+12)+','+(y-40)+'" fill="none" stroke="#a0c0d0" stroke-width="1.5"/>';
}
function gsBook(x,y){
  return '<rect x="'+(x-22)+'" y="'+(y-27)+'" width="44" height="54" rx="3" fill="#e8d4a0"/>'+
    '<rect x="'+(x-22)+'" y="'+(y-27)+'" width="22" height="54" fill="#f0e8d0"/>'+
    '<line x1="'+x+'" y1="'+(y-27)+'" x2="'+x+'" y2="'+(y+27)+'" stroke="#c0a060" stroke-width="1.5"/>'+
    '<line x1="'+(x-14)+'" y1="'+(y-12)+'" x2="'+(x-3)+'" y2="'+(y-12)+'" stroke="#999" stroke-width="1"/>'+
    '<line x1="'+(x-14)+'" y1="'+(y-4)+'" x2="'+(x-5)+'" y2="'+(y-4)+'" stroke="#999" stroke-width="1"/>';
}
function gsPhone(x,y){
  return '<rect x="'+(x-17)+'" y="'+(y-27)+'" width="34" height="55" rx="5" fill="#2a2a3a"/>'+
    '<rect x="'+(x-14)+'" y="'+(y-20)+'" width="28" height="38" rx="2" fill="#4a7ab0"/>'+
    '<circle cx="'+x+'" cy="'+(y+23)+'" r="3" fill="#3a3a4a"/>';
}
function gsTV(x,y){
  return '<rect x="'+(x-29)+'" y="'+(y-20)+'" width="58" height="40" rx="4" fill="#1a1a1a"/>'+
    '<rect x="'+(x-25)+'" y="'+(y-16)+'" width="50" height="32" rx="2" fill="#2a6a9a"/>'+
    '<polygon points="'+(x-8)+','+(y-8)+' '+(x-8)+','+(y+8)+' '+(x+6)+','+y+'" fill="#fff" opacity=".85"/>'+
    '<rect x="'+(x-10)+'" y="'+(y+20)+'" width="20" height="4" rx="2" fill="#1a1a1a"/>';
}
function gsQuestion(x,y,col){return '<text x="'+x+'" y="'+y+'" font-size="34" fill="'+(col||'#C9333B')+'" font-family="Georgia" font-weight="bold" text-anchor="middle">?</text>';}
function gsExclaim(x,y,col){return '<text x="'+x+'" y="'+y+'" font-size="34" fill="'+(col||'#C9333B')+'" font-family="Georgia" font-weight="bold" text-anchor="middle">!</text>';}
function gsCheck(x,y){return '<path d="M'+(x-14)+','+y+' l9,10 l19,-24" fill="none" stroke="#3a9a3a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>';}
function gsX(x,y){return '<line x1="'+(x-16)+'" y1="'+(y-16)+'" x2="'+(x+16)+'" y2="'+(y+16)+'" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/><line x1="'+(x+16)+'" y1="'+(y-16)+'" x2="'+(x-16)+'" y2="'+(y+16)+'" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/>';}
function gsArrow(x1,y1,x2,y2){
  var ang=Math.atan2(y2-y1,x2-x1),ah=8;
  var ax1=x2-ah*Math.cos(ang-0.5),ay1=y2-ah*Math.sin(ang-0.5);
  var ax2=x2-ah*Math.cos(ang+0.5),ay2=y2-ah*Math.sin(ang+0.5);
  return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#C9333B" stroke-width="4" stroke-linecap="round"/>'+
    '<polygon points="'+x2+','+y2+' '+ax1+','+ay1+' '+ax2+','+ay2+'" fill="#C9333B"/>';
}
function gsCat(x,y){
  return '<ellipse cx="'+x+'" cy="'+(y+17)+'" rx="16" ry="12" fill="#c0a060"/>'+
    '<circle cx="'+x+'" cy="'+y+'" r="12" fill="#c0a060"/>'+
    '<polygon points="'+(x-9)+','+(y-8)+' '+(x-9)+','+y+' '+(x-3)+','+(y-4)+'" fill="#c0a060"/>'+
    '<polygon points="'+(x+9)+','+(y-8)+' '+(x+9)+','+y+' '+(x+3)+','+(y-4)+'" fill="#c0a060"/>'+
    '<circle cx="'+(x-4)+'" cy="'+(y-2)+'" r="2" fill="#3a2a1a"/><circle cx="'+(x+4)+'" cy="'+(y-2)+'" r="2" fill="#3a2a1a"/>'+
    '<path d="M'+(x-2)+','+(y+2)+' Q'+x+','+(y+4)+' '+(x+2)+','+(y+2)+'" fill="none" stroke="#3a2a1a" stroke-width="1"/>';
}
function gsHouse(x,y){
  return '<rect x="'+(x-27)+'" y="'+y+'" width="54" height="34" fill="#5a4a7a"/>'+
    '<polygon points="'+(x-30)+','+y+' '+x+','+(y-22)+' '+(x+30)+','+y+'" fill="#C9333B"/>'+
    '<rect x="'+(x-9)+'" y="'+(y+9)+'" width="18" height="25" fill="#3a2a4a"/>';
}
function gsBus(x,y){
  return '<rect x="'+(x-30)+'" y="'+(y-14)+'" width="60" height="30" rx="5" fill="#3D6BC4"/>'+
    '<rect x="'+(x-24)+'" y="'+(y-9)+'" width="16" height="12" rx="1" fill="#cfe6f7"/>'+
    '<rect x="'+(x-2)+'" y="'+(y-9)+'" width="16" height="12" rx="1" fill="#cfe6f7"/>'+
    '<circle cx="'+(x-18)+'" cy="'+(y+18)+'" r="6" fill="#1a1a1a"/><circle cx="'+(x+18)+'" cy="'+(y+18)+'" r="6" fill="#1a1a1a"/>';
}
function gsSpeedLines(x,y){
  return '<line x1="'+(x-38)+'" y1="'+(y-8)+'" x2="'+(x-20)+'" y2="'+(y-8)+'" stroke="#C9333B" stroke-width="3" stroke-linecap="round" opacity=".7"/>'+
    '<line x1="'+(x-42)+'" y1="'+y+'" x2="'+(x-20)+'" y2="'+y+'" stroke="#C9333B" stroke-width="3" stroke-linecap="round" opacity=".5"/>'+
    '<line x1="'+(x-38)+'" y1="'+(y+8)+'" x2="'+(x-20)+'" y2="'+(y+8)+'" stroke="#C9333B" stroke-width="3" stroke-linecap="round" opacity=".7"/>';
}
function gsZzz(x,y){return '<text x="'+x+'" y="'+y+'" font-size="20" fill="#C9333B" font-family="Georgia" font-style="italic">z</text><text x="'+(x+13)+'" y="'+(y-12)+'" font-size="14" fill="#C9333B" font-family="Georgia" font-style="italic">z</text>';}
function gsRainCloud(x,y){
  return '<ellipse cx="'+x+'" cy="'+y+'" rx="26" ry="14" fill="#6a7a9a"/>'+
    '<ellipse cx="'+(x-14)+'" cy="'+(y+4)+'" rx="16" ry="11" fill="#6a7a9a"/>'+
    '<ellipse cx="'+(x+14)+'" cy="'+(y+4)+'" rx="16" ry="11" fill="#8a9ab5"/>'+
    '<line x1="'+(x-14)+'" y1="'+(y+22)+'" x2="'+(x-18)+'" y2="'+(y+34)+'" stroke="#a8d8f0" stroke-width="3" stroke-linecap="round"/>'+
    '<line x1="'+x+'" y1="'+(y+22)+'" x2="'+(x-4)+'" y2="'+(y+34)+'" stroke="#a8d8f0" stroke-width="3" stroke-linecap="round"/>'+
    '<line x1="'+(x+14)+'" y1="'+(y+22)+'" x2="'+(x+10)+'" y2="'+(y+34)+'" stroke="#a8d8f0" stroke-width="3" stroke-linecap="round"/>';
}
function gsClock(x,y,alarmed){
  return '<circle cx="'+x+'" cy="'+y+'" r="18" fill="#e8d4a0"/><circle cx="'+x+'" cy="'+y+'" r="15" fill="#f0e8d0"/>'+
    '<line x1="'+x+'" y1="'+y+'" x2="'+x+'" y2="'+(y-10)+'" stroke="#3a2a1a" stroke-width="1.5"/>'+
    '<line x1="'+x+'" y1="'+y+'" x2="'+(x+7)+'" y2="'+(y+3)+'" stroke="#3a2a1a" stroke-width="1.5"/>'+
    (alarmed?('<line x1="'+(x-24)+'" y1="'+(y-20)+'" x2="'+(x-18)+'" y2="'+(y-14)+'" stroke="#C9333B" stroke-width="2" stroke-linecap="round"/><line x1="'+(x+24)+'" y1="'+(y-20)+'" x2="'+(x+18)+'" y2="'+(y-14)+'" stroke="#C9333B" stroke-width="2" stroke-linecap="round"/>'):'');
}
function gsHeart(x,y,col){
  col=col||'#C9333B';
  return '<path d="M'+x+','+(y+16)+' C'+(x-22)+','+(y-6)+' '+(x-10)+','+(y-22)+' '+x+','+(y-8)+' C'+(x+10)+','+(y-22)+' '+(x+22)+','+(y-6)+' '+x+','+(y+16)+' Z" fill="'+col+'"/>';
}
function gsStar(x,y,sz,col){
  sz=sz||3;col=col||'#C9333B';
  return '<path d="M'+x+','+(y-sz)+' L'+(x+sz*0.22)+','+(y-sz*0.28)+' L'+(x+sz)+','+(y-sz*0.28)+' L'+(x+sz*0.36)+','+(y+sz*0.14)+' L'+(x+sz*0.58)+','+(y+sz)+' L'+x+','+(y+sz*0.44)+' L'+(x-sz*0.58)+','+(y+sz)+' L'+(x-sz*0.36)+','+(y+sz*0.14)+' L'+(x-sz)+','+(y-sz*0.28)+' L'+(x-sz*0.22)+','+(y-sz*0.28)+' Z" fill="'+col+'"/>';
}
function gsBag(x,y){
  return '<path d="M'+(x-18)+','+(y-4)+' L'+(x-22)+','+(y+30)+' L'+(x+22)+','+(y+30)+' L'+(x+18)+','+(y-4)+' Z" fill="'+(y%2?'#C9333B':'#3D6BC4')+'"/>'+
    '<path d="M'+(x-10)+','+(y-4)+' Q'+(x-10)+','+(y-20)+' '+x+','+(y-20)+' Q'+(x+10)+','+(y-20)+' '+(x+10)+','+(y-4)+'" fill="none" stroke="#8a6a3a" stroke-width="3"/>';
}
function gsPriceTag(x,y,txt){
  return '<circle cx="'+x+'" cy="'+y+'" r="18" fill="#8F1A1A22" stroke="#C9333B" stroke-width="2"/>'+
    '<text x="'+x+'" y="'+(y+7)+'" font-size="16" fill="#C9333B" font-family="sans-serif" font-weight="700" text-anchor="middle">'+txt+'</text>';
}
function gsTaegeuk(x,y,r){
  r=r||16;
  return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#0d1025" stroke="#3a2a2a" stroke-width="1"/>'+
    '<path d="M'+x+','+(y-r*0.75)+' a'+(r*0.37)+' '+(r*0.37)+' 0 0 1 0 '+(r*0.75)+' a'+(r*0.37)+' '+(r*0.37)+' 0 0 0 0 '+(r*0.75)+' a'+(r*0.75)+' '+(r*0.75)+' 0 0 0 0 -'+(r*1.5)+'" fill="#C9333B"/>'+
    '<path d="M'+x+','+(y-r*0.75)+' a'+(r*0.37)+' '+(r*0.37)+' 0 0 0 0 '+(r*0.75)+' a'+(r*0.37)+' '+(r*0.37)+' 0 0 1 0 '+(r*0.75)+' a'+(r*0.75)+' '+(r*0.75)+' 0 0 1 0 -'+(r*1.5)+'" fill="#3D6BC4"/>';
}
var GRAMMAR_IMGS={};
(function(){
  var A=gsActor,ARed='#C9333B',ABlue='#3D6BC4',AGreen='#3a7a3a',APink='#d8709a',AGold='#c0973a';
  function set(phon,bg,content){GRAMMAR_IMGS[phon]=gsWrap(bg,content);}
  set('annyeonghaseyo','#1a1035',A(58,ARed)+A(140,ABlue)+'<path d="M74,58 Q82,48 90,58" fill="none" stroke="#C9333B" stroke-width="2" stroke-linecap="round"/><path d="M108,58 Q116,48 124,58" fill="none" stroke="#C9333B" stroke-width="2" stroke-linecap="round"/>');
  set('gamsahamnida','#1a1035',A(70,ARed)+gsHeart(140,60,'#e84030'));
  set('jeoneun meogeoyo','#1a1035',A(55,ARed)+gsBowl(140,95));
  set('geuneun masyeoyo','#0a1628',A(55,ABlue)+gsGlass(140,100,'#a8d8f0'));
  set('jeoneun babeul meogeoyo','#1a1035',A(50,ARed)+gsBowl(140,95));
  set('geunyeoneun mureul masyeoyo','#0a1628',A(50,APink)+gsGlass(140,100,'#a8d8f0'));
  set('jeoneun haksaengieyo','#1a1035',A(55,ARed)+gsBook(140,80));
  set('hangugeoneun jaemiisseoyo','#1a1035',gsBook(70,80)+gsStar(140,60,10)+gsStar(160,80,6));
  set('keopireul masyeoyo','#0a1628',gsCup(100,95,'#6B3E1C'));
  set('chaegeul ilgeoyo','#1a1035',A(55,AGreen)+gsBook(140,85));
  set('gayo','#16213a',A(60,AGreen)+gsArrow(90,80,150,80));
  set('gongbuhaeyo','#1a1035',A(55,ABlue)+gsBook(140,85));
  set('meogeosseoyo','#1a2a1a',gsBowl(100,90)+gsCheck(100,55));
  set('eoje hakgyoe gasseoyo','#16213a',A(45,AGreen)+gsArrow(75,80,105,80)+gsHouse(150,75));
  set('meokgo isseoyo','#1a1035',A(55,ARed)+gsBowl(140,95)+gsSpeedLines(140,60));
  set('geuneun ttwigo isseoyo','#16213a',gsActorRun(70,AGreen)+gsSpeedLines(30,80));
  set('meokgo sipeoyo','#1a1035',gsBowl(100,95)+gsHeart(150,55,'#e84030'));
  set('hanguge gago sipeoyo','#1a1035',A(45,ARed)+gsArrow(75,75,110,75)+gsTaegeuk(155,60,18));
  set('hangugeoreul hal su isseoyo','#1a1035',A(50,ABlue)+gsCheck(150,60));
  set('suyeonghal su eopseoyo','#0a1628',gsGlass(90,95,'#a8d8f0')+gsX(150,65));
  set('mwo meogeoyo?','#3a2500',gsBowl(90,90)+gsQuestion(155,55));
  set('eodie gayo?','#16213a',gsArrow(50,80,110,80)+gsQuestion(155,55));
  set('goyangiga isseoyo','#1a1035',gsCat(100,75));
  set('babi masisseoyo','#3a2500',gsBowl(90,90)+gsStar(150,50,8)+gsStar(165,70,5));
  set('gidaryeo juseyo','#1a1035',A(60,ARed)+gsClock(150,65));
  set('cheoncheonhi malhae juseyo','#1a1035',A(60,AGreen)+'<path d="M90,55 Q98,45 106,55" fill="none" stroke="#C9333B" stroke-width="2" stroke-linecap="round"/><path d="M90,68 Q100,60 110,68" fill="none" stroke="#C9333B" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>');
  set('an meogeoyo','#3a1a1a',gsBowl(100,90)+gsX(100,55));
  set('gaji anayo','#16213a',gsArrow(60,80,110,80)+gsX(150,80));
  set('babeul meokgo keopireul masyeoyo','#1a1035',gsBowl(65,95)+gsCup(150,95,'#6B3E1C'));
  set('jibe gago jayo','#1a1a3a',gsHouse(70,80)+gsZzz(150,60));
  set('biga omyeon jibe isseoyo','#16213a',gsRainCloud(65,60)+gsHouse(150,90));
  set('sigani isseumyeon mannayo','#1a1035',gsClock(60,70)+A(115,ARed)+A(150,ABlue));
  set('jeoboda keoyo','#1a1035',A(60,ABlue,'small')+'<circle cx="150" cy="45" r="15" fill="#e8b890"/><path d="M132,95 Q132,63 150,63 Q168,63 168,95 Z" fill="'+ARed+'"/>');
  set('beoseuboda ppallayo','#16213a',gsBus(80,85)+gsSpeedLines(155,85));
  set('geokjeonghaji maseyo','#1a1035',A(70,AGreen)+gsHeart(140,65,'#3a9a3a')+gsX(140,40));
  set('neutji maseyo','#1a1035',gsClock(90,75)+gsX(150,75));
  set('jagi jeone chaegeul ilgeoyo','#1a1a3a',gsZzz(60,55)+gsBook(140,90));
  set('meogeun hue swieoyo','#1a2a1a',gsBowl(70,90)+gsCheck(70,55)+A(150,AGreen));
  set('gaya dwaeyo','#1a1035',gsArrow(70,80,130,80)+gsExclaim(165,60));
  set('sukjereul haeya dwaeyo','#1a1035',gsBook(90,85)+gsExclaim(155,55));
  set('masinneyo','#3a2500',gsBowl(100,90)+gsExclaim(150,50)+gsStar(165,75,6));
  set('bissaneyo','#3a2500',gsPriceTag(100,70,'₩')+gsExclaim(155,55));
  set('bissajiman masisseoyo','#3a2500',gsPriceTag(65,65,'₩')+gsBowl(150,95));
  set('bappeujiman gal geoyeyo','#1a1035',gsClock(65,65)+gsArrow(100,90,155,90));
  set('yorihaneun geoseul joahaeyo','#3a2500',gsBowl(90,90)+gsHeart(155,55,'#e84030'));
  set('yeonghwa boneun geoseul joahaeyo','#0f0f28',gsTV(90,75)+gsHeart(160,55,'#e84030'));
  set('babeul meogeureo gayo','#1a1035',gsArrow(55,90,105,90)+gsBowl(150,90));
  set('syopinghareo gayo','#1a1035',gsArrow(55,85,100,85)+gsBag(150,80));
  set('bappaseo mot gayo','#1a1035',gsClock(60,65)+gsX(115,65)+gsArrow(145,90,180,90));
  set('baegopaseo babeul meogeoyo','#3a2500',gsHeart(60,60,'#f0944a')+gsArrow(90,80,120,80)+gsBowl(160,90));
  set('naeil gal geoyeyo','#1a1a4a',gsClock(60,60)+gsArrow(105,85,160,85));
  set('biga ol geoyeyo','#16213a',gsRainCloud(100,70)+gsExclaim(160,90));
  set('gachi galkkayo?','#1a1035',A(80,ARed)+A(115,ABlue)+gsQuestion(160,55));
  set('mwo meogeulkkayo?','#3a2500',gsBowl(90,90)+gsQuestion(155,55));
  set('yeogi anjeuseyo','#1a1035','<rect x="80" y="60" width="40" height="8" rx="2" fill="#8B5E3C"/><rect x="82" y="68" width="6" height="30" fill="#6B3E1C"/><rect x="112" y="68" width="6" height="30" fill="#6B3E1C"/><rect x="80" y="30" width="8" height="38" rx="2" fill="#8B5E3C"/>');
  set('seonsaengnimeun keopireul deuseyo','#1a1035',A(55,AGold)+gsCup(130,90,'#6B3E1C')+gsStar(165,50,7));
  set('bi ttaemune an gayo','#16213a',gsRainCloud(65,55)+gsArrow(105,90,150,90)+gsX(150,90));
  set('sigani eopgi ttaemune mot gayo','#1a1035',gsClock(60,65)+gsX(60,65)+gsArrow(105,90,155,90));
  set('bissande sago sipeoyo','#3a2500',gsPriceTag(65,65,'₩')+gsBag(150,80)+gsHeart(150,45,'#e84030'));
  set('baegopeunde sigani eopseoyo','#1a1035',gsBowl(65,90)+gsClock(150,60)+gsX(150,60));
})();

/* ============================================================
   GRAMMAR CONTENT — 5 levels
   ============================================================ */
var grammarLevels=[
{level:1,icon:'🌱',label:'Elementary',subtitle:'Greetings · SOV · Particles · Polite form',color:'lv1',
 desc:'Level 1 is your foundation. Korean uses Subject-Object-Verb order, with particles attached directly to nouns. Master these 6 patterns to survive any basic Korean interaction.',
 patterns:[
  {title:'① Greetings',
   rule:'안녕하세요 · 감사합니다 · 죄송합니다 — the three phrases you will use every single day.',
   examples:[
    {thai:'안녕하세요',phon:'annyeonghaseyo',eng:'Hello',words:[{t:'안녕하세요',p:'annyeonghaseyo',e:'hello',c:'wc-v'}]},
    {thai:'감사합니다',phon:'gamsahamnida',eng:'Thank you',words:[{t:'감사합니다',p:'gamsahamnida',e:'thank you',c:'wc-v'}]},
   ]},
  {title:'② 저 / 그 / 그녀 — Pronouns',
   rule:'저 (jeo) = I (polite). 그 (geu) = he. 그녀 (geunyeo) = she. 우리 (uri) = we. Korean often drops the pronoun entirely once context is clear — but beginners should include it.',
   examples:[
    {thai:'저는 먹어요',phon:'jeoneun meogeoyo',eng:'I eat',words:[{t:'저',p:'jeo',e:'I',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:'먹어요',p:'meogeoyo',e:'eat',c:'wc-v'}]},
    {thai:'그는 마셔요',phon:'geuneun masyeoyo',eng:'He drinks',words:[{t:'그',p:'geu',e:'he',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:'마셔요',p:'masyeoyo',e:'drink',c:'wc-v'}]},
   ]},
  {title:'③ S + O + V — Basic sentence (SOV)',
   rule:'Korean word order is Subject → Object → Verb. The verb always comes LAST. 는/은 marks the topic; 을/를 marks the object.',
   examples:[
    {thai:'저는 밥을 먹어요',phon:'jeoneun babeul meogeoyo',eng:'I eat rice',words:[{t:'저',p:'jeo',e:'I',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:'밥',p:'bap',e:'rice',c:'wc-o'},{t:'을',p:'eul',e:'(object)',c:'wc-p'},{t:'먹어요',p:'meogeoyo',e:'eat',c:'wc-v'}]},
    {thai:'그녀는 물을 마셔요',phon:'geunyeoneun mureul masyeoyo',eng:'She drinks water',words:[{t:'그녀',p:'geunyeo',e:'she',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:'물',p:'mul',e:'water',c:'wc-o'},{t:'을',p:'eul',e:'(object)',c:'wc-p'},{t:'마셔요',p:'masyeoyo',e:'drink',c:'wc-v'}]},
   ]},
  {title:'④ 는 / 은 — Topic particle',
   rule:'는 attaches after a vowel-final noun, 은 after a consonant-final noun. Marks "as for X..."',
   examples:[
    {thai:'저는 학생이에요',phon:'jeoneun haksaengieyo',eng:'I am a student',words:[{t:'저',p:'jeo',e:'I',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:'학생이에요',p:'haksaengieyo',e:'am a student',c:'wc-v'}]},
    {thai:'한국어는 재미있어요',phon:'hangugeoneun jaemiisseoyo',eng:'Korean is fun',words:[{t:'한국어',p:'hangugeo',e:'Korean',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:'재미있어요',p:'jaemiisseoyo',e:'is fun',c:'wc-a'}]},
   ]},
  {title:'⑤ 을 / 를 — Object particle',
   rule:'를 after a vowel-final noun, 을 after a consonant-final noun. Marks the direct object — the thing being acted on.',
   examples:[
    {thai:'커피를 마셔요',phon:'keopireul masyeoyo',eng:'(I) drink coffee',words:[{t:'커피',p:'keopi',e:'coffee',c:'wc-o'},{t:'를',p:'reul',e:'(object)',c:'wc-p'},{t:'마셔요',p:'masyeoyo',e:'drink',c:'wc-v'}]},
    {thai:'책을 읽어요',phon:'chaegeul ilgeoyo',eng:'(I) read a book',words:[{t:'책',p:'chaek',e:'book',c:'wc-o'},{t:'을',p:'eul',e:'(object)',c:'wc-p'},{t:'읽어요',p:'ilgeoyo',e:'read',c:'wc-v'}]},
   ]},
  {title:'⑥ -아요 / -어요 — Polite present',
   rule:'Verb stems ending in ㅏ or ㅗ take -아요; everything else takes -어요. 하다 verbs become 해요. This is the everyday polite ending you will use constantly.',
   examples:[
    {thai:'가요',phon:'gayo',eng:'(I) go',words:[{t:'가요',p:'gayo',e:'go',c:'wc-v'}]},
    {thai:'공부해요',phon:'gongbuhaeyo',eng:'(I) study',words:[{t:'공부해요',p:'gongbuhaeyo',e:'study',c:'wc-v'}]},
   ]},
 ]
},
{level:2,icon:'📖',label:'Pre-intermediate',subtitle:'Past · Progressive · Question words · Want · Can',color:'lv2',
 desc:'Level 2 adds tense, ongoing actions, and expressions of desire and ability, plus the question words you need to ask anything.',
 patterns:[
  {title:'① -았어요 / -었어요 — Past tense',
   rule:'ㅏ/ㅗ stems take -았어요; everything else takes -었어요. 하다 verbs become 했어요.',
   examples:[
    {thai:'먹었어요',phon:'meogeosseoyo',eng:'(I) ate',words:[{t:'먹었어요',p:'meogeosseoyo',e:'ate',c:'wc-v'}]},
    {thai:'어제 학교에 갔어요',phon:'eoje hakgyoe gasseoyo',eng:'Yesterday I went to school',words:[{t:'어제',p:'eoje',e:'yesterday',c:'wc-t'},{t:'학교',p:'hakgyo',e:'school',c:'wc-o'},{t:'에',p:'e',e:'(to)',c:'wc-p'},{t:'갔어요',p:'gasseoyo',e:'went',c:'wc-v'}]},
   ]},
  {title:'② -고 있어요 — Progressive',
   rule:'Verb stem + 고 있어요 = is/are doing right now.',
   examples:[
    {thai:'먹고 있어요',phon:'meokgo isseoyo',eng:'(I) am eating',words:[{t:'먹고',p:'meokgo',e:'eating',c:'wc-v'},{t:'있어요',p:'isseoyo',e:'(progressive)',c:'wc-v'}]},
    {thai:'그는 뛰고 있어요',phon:'geuneun ttwigo isseoyo',eng:'He is running',words:[{t:'그',p:'geu',e:'he',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:'뛰고',p:'ttwigo',e:'running',c:'wc-v'},{t:'있어요',p:'isseoyo',e:'(progressive)',c:'wc-v'}]},
   ]},
  {title:'③ -고 싶어요 — Want to',
   rule:'Verb stem + 고 싶어요 = want to. The object still takes 을/를 as normal.',
   examples:[
    {thai:'먹고 싶어요',phon:'meokgo sipeoyo',eng:'(I) want to eat',words:[{t:'먹고',p:'meokgo',e:'eat',c:'wc-v'},{t:'싶어요',p:'sipeoyo',e:'want to',c:'wc-v'}]},
    {thai:'한국에 가고 싶어요',phon:'hanguge gago sipeoyo',eng:'(I) want to go to Korea',words:[{t:'한국',p:'hanguk',e:'Korea',c:'wc-o'},{t:'에',p:'e',e:'(to)',c:'wc-p'},{t:'가고',p:'gago',e:'go',c:'wc-v'},{t:'싶어요',p:'sipeoyo',e:'want to',c:'wc-v'}]},
   ]},
  {title:'④ -ㄹ/을 수 있어요 — Can / ability',
   rule:'Verb stem + ㄹ/을 수 있어요 = can. Negative: -ㄹ/을 수 없어요 = cannot.',
   examples:[
    {thai:'한국어를 할 수 있어요',phon:'hangugeoreul hal su isseoyo',eng:'(I) can speak Korean',words:[{t:'한국어',p:'hangugeo',e:'Korean',c:'wc-o'},{t:'를',p:'reul',e:'(object)',c:'wc-p'},{t:'할 수 있어요',p:'hal su isseoyo',e:'can do',c:'wc-v'}]},
    {thai:'수영할 수 없어요',phon:'suyeonghal su eopseoyo',eng:'(I) cannot swim',words:[{t:'수영할 수',p:'suyeonghal su',e:'swim + can',c:'wc-v'},{t:'없어요',p:'eopseoyo',e:'cannot',c:'wc-n'}]},
   ]},
  {title:'⑤ 뭐 · 어디 · 누구 — Question words',
   rule:'뭐 (mwo) = what. 어디 (eodi) = where. 누구 (nugu) = who. 언제 (eonje) = when. Add 요 for a full polite question.',
   examples:[
    {thai:'뭐 먹어요?',phon:'mwo meogeoyo?',eng:'What will you eat?',words:[{t:'뭐',p:'mwo',e:'what',c:'wc-q'},{t:'먹어요',p:'meogeoyo',e:'eat',c:'wc-v'}]},
    {thai:'어디에 가요?',phon:'eodie gayo?',eng:'Where are you going?',words:[{t:'어디',p:'eodi',e:'where',c:'wc-q'},{t:'에',p:'e',e:'(to)',c:'wc-p'},{t:'가요',p:'gayo',e:'go',c:'wc-v'}]},
   ]},
  {title:'⑥ 이 / 가 — Subject particle',
   rule:'이/가 marks the grammatical subject, used with 있어요/없어요 (existence) and 좋아해요-type verbs. 가 after a vowel, 이 after a consonant.',
   examples:[
    {thai:'고양이가 있어요',phon:'goyangiga isseoyo',eng:'There is a cat',words:[{t:'고양이',p:'goyangi',e:'cat',c:'wc-s'},{t:'가',p:'ga',e:'(subject)',c:'wc-p'},{t:'있어요',p:'isseoyo',e:'exists',c:'wc-v'}]},
    {thai:'밥이 맛있어요',phon:'babi masisseoyo',eng:'The rice is delicious',words:[{t:'밥',p:'bap',e:'rice',c:'wc-s'},{t:'이',p:'i',e:'(subject)',c:'wc-p'},{t:'맛있어요',p:'masisseoyo',e:'is delicious',c:'wc-a'}]},
   ]},
 ]
},
{level:3,icon:'🌳',label:'Intermediate',subtitle:'Requests · Negation · Connectors · Conditionals',color:'lv3',
 desc:'Level 3 builds real fluency — polite requests, correct negation, connecting two ideas, and if/then conditionals.',
 patterns:[
  {title:'① -아/어 주세요 — Please do',
   rule:'Verb stem + 아/어 주세요 = please do (for me). A polite request.',
   examples:[
    {thai:'기다려 주세요',phon:'gidaryeo juseyo',eng:'Please wait',words:[{t:'기다려',p:'gidaryeo',e:'wait',c:'wc-v'},{t:'주세요',p:'juseyo',e:'please',c:'wc-v'}]},
    {thai:'천천히 말해 주세요',phon:'cheoncheonhi malhae juseyo',eng:'Please speak slowly',words:[{t:'천천히',p:'cheoncheonhi',e:'slowly',c:'wc-a'},{t:'말해',p:'malhae',e:'speak',c:'wc-v'},{t:'주세요',p:'juseyo',e:'please',c:'wc-v'}]},
   ]},
  {title:'② 안 / -지 않아요 — Negation',
   rule:'안 + verb = simple negation (do not). -지 않아요 attached to the verb stem is the more formal alternative.',
   examples:[
    {thai:'안 먹어요',phon:'an meogeoyo',eng:'(I) do not eat',words:[{t:'안',p:'an',e:'not',c:'wc-n'},{t:'먹어요',p:'meogeoyo',e:'eat',c:'wc-v'}]},
    {thai:'가지 않아요',phon:'gaji anayo',eng:'(I) do not go',words:[{t:'가지',p:'gaji',e:'go',c:'wc-v'},{t:'않아요',p:'anayo',e:'do not',c:'wc-n'}]},
   ]},
  {title:'③ -고 — And / then',
   rule:'Verb stem + 고 links two clauses: "does X, and then does Y."',
   examples:[
    {thai:'밥을 먹고 커피를 마셔요',phon:'babeul meokgo keopireul masyeoyo',eng:'(I) eat rice and drink coffee',words:[{t:'밥',p:'bap',e:'rice',c:'wc-o'},{t:'을',p:'eul',e:'(object)',c:'wc-p'},{t:'먹고',p:'meokgo',e:'eat, then',c:'wc-v'},{t:'커피',p:'keopi',e:'coffee',c:'wc-o'},{t:'를',p:'reul',e:'(object)',c:'wc-p'},{t:'마셔요',p:'masyeoyo',e:'drink',c:'wc-v'}]},
    {thai:'집에 가고 자요',phon:'jibe gago jayo',eng:'(I) go home and sleep',words:[{t:'집',p:'jip',e:'home',c:'wc-o'},{t:'에',p:'e',e:'(to)',c:'wc-p'},{t:'가고',p:'gago',e:'go, then',c:'wc-v'},{t:'자요',p:'jayo',e:'sleep',c:'wc-v'}]},
   ]},
  {title:'④ -면 — If / conditional',
   rule:'Verb stem + 면 = if / when. Sets up a condition before the main clause.',
   examples:[
    {thai:'비가 오면 집에 있어요',phon:'biga omyeon jibe isseoyo',eng:'If it rains, (I) stay home',words:[{t:'비',p:'bi',e:'rain',c:'wc-s'},{t:'가',p:'ga',e:'(subject)',c:'wc-p'},{t:'오면',p:'omyeon',e:'if it comes',c:'wc-v'},{t:'집에',p:'jibe',e:'at home',c:'wc-o'},{t:'있어요',p:'isseoyo',e:'stay',c:'wc-v'}]},
    {thai:'시간이 있으면 만나요',phon:'sigani isseumyeon mannayo',eng:'If (you) have time, let’s meet',words:[{t:'시간',p:'sigan',e:'time',c:'wc-s'},{t:'이',p:'i',e:'(subject)',c:'wc-p'},{t:'있으면',p:'isseumyeon',e:'if there is',c:'wc-v'},{t:'만나요',p:'mannayo',e:'meet',c:'wc-v'}]},
   ]},
  {title:'⑤ 보다 — Comparison',
   rule:'N 보다 = more than N. Place it right after the noun you are comparing against.',
   examples:[
    {thai:'저보다 커요',phon:'jeoboda keoyo',eng:'(He) is bigger than me',words:[{t:'저',p:'jeo',e:'me',c:'wc-o'},{t:'보다',p:'boda',e:'than',c:'wc-p'},{t:'커요',p:'keoyo',e:'is bigger',c:'wc-a'}]},
    {thai:'버스보다 빨라요',phon:'beoseuboda ppallayo',eng:'(It) is faster than the bus',words:[{t:'버스',p:'beoseu',e:'bus',c:'wc-o'},{t:'보다',p:'boda',e:'than',c:'wc-p'},{t:'빨라요',p:'ppallayo',e:'is faster',c:'wc-a'}]},
   ]},
  {title:'⑥ -지 마세요 — Please don’t',
   rule:'Verb stem + 지 마세요 = please don’t (do this). The polite negative command.',
   examples:[
    {thai:'걱정하지 마세요',phon:'geokjeonghaji maseyo',eng:'Please don’t worry',words:[{t:'걱정하지',p:'geokjeonghaji',e:'worry',c:'wc-v'},{t:'마세요',p:'maseyo',e:'please don’t',c:'wc-n'}]},
    {thai:'늦지 마세요',phon:'neutji maseyo',eng:'Please don’t be late',words:[{t:'늦지',p:'neutji',e:'be late',c:'wc-v'},{t:'마세요',p:'maseyo',e:'please don’t',c:'wc-n'}]},
   ]},
 ]
},
{level:4,icon:'🏙',label:'Upper-intermediate',subtitle:'Sequencing · Obligation · Reactions · Contrast',color:'lv4',
 desc:'Level 4 covers the connectors and reactive expressions that make longer, natural conversation possible.',
 patterns:[
  {title:'① -기 전에 / -은 후에 — Before / after',
   rule:'Verb stem + 기 전에 = before doing. Verb stem + 은/ㄴ 후에 = after doing.',
   examples:[
    {thai:'자기 전에 책을 읽어요',phon:'jagi jeone chaegeul ilgeoyo',eng:'(I) read a book before sleeping',words:[{t:'자기',p:'jagi',e:'sleeping',c:'wc-v'},{t:'전에',p:'jeone',e:'before',c:'wc-p'},{t:'책',p:'chaek',e:'book',c:'wc-o'},{t:'을',p:'eul',e:'(object)',c:'wc-p'},{t:'읽어요',p:'ilgeoyo',e:'read',c:'wc-v'}]},
    {thai:'먹은 후에 쉬어요',phon:'meogeun hue swieoyo',eng:'(I) rest after eating',words:[{t:'먹은',p:'meogeun',e:'ate',c:'wc-v'},{t:'후에',p:'hue',e:'after',c:'wc-p'},{t:'쉬어요',p:'swieoyo',e:'rest',c:'wc-v'}]},
   ]},
  {title:'② -아/어야 돼요 — Must / have to',
   rule:'Verb stem + 아/어야 돼요 = must / have to.',
   examples:[
    {thai:'가야 돼요',phon:'gaya dwaeyo',eng:'(I) have to go',words:[{t:'가야',p:'gaya',e:'must go',c:'wc-v'},{t:'돼요',p:'dwaeyo',e:'(obligation)',c:'wc-v'}]},
    {thai:'숙제를 해야 돼요',phon:'sukjereul haeya dwaeyo',eng:'(I) have to do homework',words:[{t:'숙제',p:'sukje',e:'homework',c:'wc-o'},{t:'를',p:'reul',e:'(object)',c:'wc-p'},{t:'해야',p:'haeya',e:'must do',c:'wc-v'},{t:'돼요',p:'dwaeyo',e:'(obligation)',c:'wc-v'}]},
   ]},
  {title:'③ -네요 — Realization',
   rule:'Attached to a verb/adjective stem, -네요 expresses noticing something in the moment — "oh, it’s...!"',
   examples:[
    {thai:'맛있네요',phon:'masinneyo',eng:'Oh, this is delicious!',words:[{t:'맛있네요',p:'masinneyo',e:'is delicious (realization)',c:'wc-a'}]},
    {thai:'비싸네요',phon:'bissaneyo',eng:'Oh, that’s expensive!',words:[{t:'비싸네요',p:'bissaneyo',e:'is expensive (realization)',c:'wc-a'}]},
   ]},
  {title:'④ -지만 — But / however',
   rule:'Verb/adjective stem + 지만 connects two contrasting clauses.',
   examples:[
    {thai:'비싸지만 맛있어요',phon:'bissajiman masisseoyo',eng:'It’s expensive but delicious',words:[{t:'비싸지만',p:'bissajiman',e:'expensive but',c:'wc-a'},{t:'맛있어요',p:'masisseoyo',e:'is delicious',c:'wc-a'}]},
    {thai:'바쁘지만 갈 거예요',phon:'bappeujiman gal geoyeyo',eng:'I’m busy but I’ll go',words:[{t:'바쁘지만',p:'bappeujiman',e:'busy but',c:'wc-a'},{t:'갈 거예요',p:'gal geoyeyo',e:'will go',c:'wc-v'}]},
   ]},
  {title:'⑤ -는 것을 좋아해요 — Like doing',
   rule:'Verb stem + 는 것을 좋아해요 turns the verb into a noun ("the act of doing") and expresses liking it.',
   examples:[
    {thai:'요리하는 것을 좋아해요',phon:'yorihaneun geoseul joahaeyo',eng:'(I) like cooking',words:[{t:'요리하는 것',p:'yorihaneun geot',e:'cooking',c:'wc-o'},{t:'을',p:'eul',e:'(object)',c:'wc-p'},{t:'좋아해요',p:'joahaeyo',e:'like',c:'wc-v'}]},
    {thai:'영화 보는 것을 좋아해요',phon:'yeonghwa boneun geoseul joahaeyo',eng:'(I) like watching movies',words:[{t:'영화 보는 것',p:'yeonghwa boneun geot',e:'watching movies',c:'wc-o'},{t:'을',p:'eul',e:'(object)',c:'wc-p'},{t:'좋아해요',p:'joahaeyo',e:'like',c:'wc-v'}]},
   ]},
  {title:'⑥ -러 가요 — Go in order to',
   rule:'Verb stem + 러/으러 가요 = go (somewhere) in order to do something.',
   examples:[
    {thai:'밥을 먹으러 가요',phon:'babeul meogeureo gayo',eng:'(I) go to eat',words:[{t:'밥',p:'bap',e:'rice',c:'wc-o'},{t:'을',p:'eul',e:'(object)',c:'wc-p'},{t:'먹으러',p:'meogeureo',e:'to eat',c:'wc-v'},{t:'가요',p:'gayo',e:'go',c:'wc-v'}]},
    {thai:'쇼핑하러 가요',phon:'syopinghareo gayo',eng:'(I) go shopping',words:[{t:'쇼핑하러',p:'syopinghareo',e:'to shop',c:'wc-v'},{t:'가요',p:'gayo',e:'go',c:'wc-v'}]},
   ]},
 ]
},
{level:5,icon:'🏔',label:'Advanced',subtitle:'Reasoning · Future · Suggestions · Honorifics',color:'lv5',
 desc:'Level 5 rounds out real fluency — giving reasons, talking about the future, making suggestions, and speaking respectfully to elders and strangers.',
 patterns:[
  {title:'① -아/어서 — Because / and then',
   rule:'Verb stem + 아/어서 gives a reason for what follows, or shows one action leading naturally into the next.',
   examples:[
    {thai:'바빠서 못 가요',phon:'bappaseo mot gayo',eng:'(I) can’t go because I’m busy',words:[{t:'바빠서',p:'bappaseo',e:'because busy',c:'wc-a'},{t:'못 가요',p:'mot gayo',e:'can’t go',c:'wc-n'}]},
    {thai:'배고파서 밥을 먹어요',phon:'baegopaseo babeul meogeoyo',eng:'(I) eat because I’m hungry',words:[{t:'배고파서',p:'baegopaseo',e:'because hungry',c:'wc-a'},{t:'밥',p:'bap',e:'rice',c:'wc-o'},{t:'을',p:'eul',e:'(object)',c:'wc-p'},{t:'먹어요',p:'meogeoyo',e:'eat',c:'wc-v'}]},
   ]},
  {title:'② -ㄹ/을 거예요 — Future / intention',
   rule:'Verb stem + ㄹ/을 거예요 expresses a future plan or a prediction.',
   examples:[
    {thai:'내일 갈 거예요',phon:'naeil gal geoyeyo',eng:'(I) will go tomorrow',words:[{t:'내일',p:'naeil',e:'tomorrow',c:'wc-t'},{t:'갈 거예요',p:'gal geoyeyo',e:'will go',c:'wc-v'}]},
    {thai:'비가 올 거예요',phon:'biga ol geoyeyo',eng:'It will probably rain',words:[{t:'비',p:'bi',e:'rain',c:'wc-s'},{t:'가',p:'ga',e:'(subject)',c:'wc-p'},{t:'올 거예요',p:'ol geoyeyo',e:'will come',c:'wc-v'}]},
   ]},
  {title:'③ -ㄹ/을까요? — Shall we?',
   rule:'Verb stem + ㄹ/을까요? proposes an action together, or wonders aloud.',
   examples:[
    {thai:'같이 갈까요?',phon:'gachi galkkayo?',eng:'Shall we go together?',words:[{t:'같이',p:'gachi',e:'together',c:'wc-a'},{t:'갈까요?',p:'galkkayo?',e:'shall we go?',c:'wc-q'}]},
    {thai:'뭐 먹을까요?',phon:'mwo meogeulkkayo?',eng:'What shall we eat?',words:[{t:'뭐',p:'mwo',e:'what',c:'wc-q'},{t:'먹을까요?',p:'meogeulkkayo?',e:'shall we eat?',c:'wc-q'}]},
   ]},
  {title:'④ -(으)세요 — Honorific / polite request',
   rule:'-(으)세요 raises the subject with respect — used for elders, strangers, and polite commands.',
   examples:[
    {thai:'여기 앉으세요',phon:'yeogi anjeuseyo',eng:'Please sit here',words:[{t:'여기',p:'yeogi',e:'here',c:'wc-o'},{t:'앉으세요',p:'anjeuseyo',e:'please sit',c:'wc-v'}]},
    {thai:'선생님은 커피를 드세요',phon:'seonsaengnimeun keopireul deuseyo',eng:'The teacher drinks coffee (honorific)',words:[{t:'선생님',p:'seonsaengnim',e:'teacher',c:'wc-s'},{t:'은',p:'eun',e:'(topic)',c:'wc-p'},{t:'커피',p:'keopi',e:'coffee',c:'wc-o'},{t:'를',p:'reul',e:'(object)',c:'wc-p'},{t:'드세요',p:'deuseyo',e:'drinks (honorific)',c:'wc-v'}]},
   ]},
  {title:'⑤ -기 때문에 — Because of',
   rule:'Clause + 기 때문에 = because of / due to the fact that. More formal than -아/어서.',
   examples:[
    {thai:'비 때문에 안 가요',phon:'bi ttaemune an gayo',eng:'(I) am not going because of the rain',words:[{t:'비',p:'bi',e:'rain',c:'wc-o'},{t:'때문에',p:'ttaemune',e:'because of',c:'wc-p'},{t:'안',p:'an',e:'not',c:'wc-n'},{t:'가요',p:'gayo',e:'go',c:'wc-v'}]},
    {thai:'시간이 없기 때문에 못 가요',phon:'sigani eopgi ttaemune mot gayo',eng:'(I) can’t go because there’s no time',words:[{t:'시간',p:'sigan',e:'time',c:'wc-s'},{t:'이',p:'i',e:'(subject)',c:'wc-p'},{t:'없기 때문에',p:'eopgi ttaemune',e:'because there is none',c:'wc-p'},{t:'못 가요',p:'mot gayo',e:'can’t go',c:'wc-n'}]},
   ]},
  {title:'⑥ -는데 — Background / contrast',
   rule:'Verb/adjective stem + 는데/은데 sets up background information or a soft contrast before the main point.',
   examples:[
    {thai:'비싼데 사고 싶어요',phon:'bissande sago sipeoyo',eng:'It’s expensive, but I want to buy it',words:[{t:'비싼데',p:'bissande',e:'is expensive, but',c:'wc-a'},{t:'사고 싶어요',p:'sago sipeoyo',e:'want to buy',c:'wc-v'}]},
    {thai:'배고픈데 시간이 없어요',phon:'baegopeunde sigani eopseoyo',eng:'I’m hungry, but there’s no time',words:[{t:'배고픈데',p:'baegopeunde',e:'am hungry, but',c:'wc-a'},{t:'시간',p:'sigan',e:'time',c:'wc-s'},{t:'이',p:'i',e:'(subject)',c:'wc-p'},{t:'없어요',p:'eopseoyo',e:'there is none',c:'wc-v'}]},
   ]},
 ]
},
];

/* ============================================================
   SVG ICON LIBRARY — small line-icon set used for level badges
   and UI chrome instead of emoji, matching the cherrypow house style.
   ============================================================ */
function svgI(name,sz){
  sz=sz||16;var s='xmlns="http://www.w3.org/2000/svg" width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var paths={
    fire:'<svg '+s+'><path d="M12 12c2-2.96 0-7-1-8 0 3.04-2.74 5.47-4 7-1.26 1.53-2 3.5-2 5.5a7 7 0 0014 0c0-1.15-.22-2.24-.63-3.22"/></svg>',
    lock:'<svg '+s+'><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    check:'<svg '+s+'><polyline points="20 6 9 17 4 12"/></svg>',
    x:'<svg '+s+'><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    zap:'<svg '+s+'><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    sprout:'<svg '+s+'><path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8zM14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>',
    book:'<svg '+s+'><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    globe:'<svg '+s+'><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    star:'<svg '+s+'><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    speaker:'<svg '+s+'><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    puzzle:'<svg '+s+'><path d="M19.44 12.85a2.5 2.5 0 0 0 0-3.7 2.75 2.75 0 0 0-1.71-.75H16v-1.7A2.75 2.75 0 0 0 15.25 5a2.5 2.5 0 0 0-3.7 0 2.75 2.75 0 0 0-.75 1.71V8.4H8.9A2.75 2.75 0 0 0 7.15 4.9a2.5 2.5 0 0 0-3.7 3.7 2.75 2.75 0 0 0 1.7.75H6.85v2.1A2.75 2.75 0 0 0 4.9 15.1a2.5 2.5 0 0 0 3.7 3.7 2.75 2.75 0 0 0 .75-1.7V16"/></svg>',
  };
  return paths[name]||'';
}
var LEVEL_ICON=['sprout','book','globe','zap','star'];
var LEVEL_COLOR_VAR=['green','blue','amber','red','purple'];

/* ============================================================
   HOME RENDERING
   ============================================================ */
function levelStatusText(lv){
  if(!isLevelUnlocked(lv))return 'Locked — finish Level '+(lv-1);
  if(levelPassed(lv))return 'Complete';
  if(grammarViewed[lv])return 'Grammar reviewed — take the quiz';
  return 'Start with grammar';
}
function renderHome(){
  bumpStreak();
  var root=document.getElementById('home-road');
  var h='<div class="home-hero"><img src="'+MASCOT_IMG+'" alt="" onclick="devTap()" style="width:64px;height:64px;border-radius:50%;cursor:pointer;margin-bottom:8px"><h2>한국어 KoreanLang</h2><p>Learn real, everyday Korean — five levels, from greetings to fluent reasoning.</p></div>';
  h+='<div class="stats-row">'+
     '<div class="stat-card"><div class="sv" style="color:var(--purple)">'+svgI('zap',16)+' '+xp+'</div><div class="sl">XP</div></div>'+
     '<div class="stat-card"><div class="sv" style="color:var(--amber)">'+streak+'🔥</div><div class="sl">Day streak</div></div>'+
     '<div class="stat-card"><div class="sv" style="color:var(--green)">'+countLevelsPassed()+'/5</div><div class="sl">Levels done</div></div>'+
     '</div>';
  h+='<div class="section-title">Levels</div>';
  for(var i=0;i<grammarLevels.length;i++){
    var lv=grammarLevels[i];
    var unlocked=isLevelUnlocked(lv.level);
    var passed=levelPassed(lv.level);
    var colVar=LEVEL_COLOR_VAR[i];
    var icon=LEVEL_ICON[i];
    h+='<div class="lvl-card" style="animation-delay:'+(i*0.06)+'s;border-color:'+(unlocked?'var(--'+colVar+'-bg)':'var(--border)')+';opacity:'+(unlocked?'1':'.55')+'" onclick="'+(unlocked?"openLevel("+lv.level+")":"showLockToast("+lv.level+")")+'">'+
       '<div class="lvl-card-badge" style="color:var(--'+colVar+');background:var(--'+colVar+'-bg);border-color:var(--'+colVar+')">'+(unlocked?svgI(icon,24):svgI('lock',20))+'</div>'+
       '<div style="flex:1;min-width:0">'+
       '<div style="font-size:15px;font-weight:700;color:'+(unlocked?'var(--'+colVar+')':'var(--text3)')+'">Level '+lv.level+' — '+lv.label+'</div>'+
       '<div style="font-size:12px;color:var(--text2);margin-top:2px;line-height:1.5">'+lv.subtitle+'</div>'+
       '<div class="progress-row"><div class="prog-bar"><div class="prog-fill" style="width:'+(passed?100:(grammarViewed[lv.level]?40:0))+'%;background:var(--'+(passed?'green':colVar)+')"></div></div>'+
       '<div style="font-size:11px;color:var(--text3);white-space:nowrap">'+levelStatusText(lv.level)+'</div></div>'+
       '</div>'+
       (passed?'<div style="color:var(--green);flex-shrink:0">'+svgI('check',18)+'</div>':'')+
       '</div>';
  }
  root.innerHTML=h;
  document.getElementById('sec-home').style.visibility='visible';
  var splash=document.getElementById('splash-screen');
  if(splash){splash.style.opacity='0';setTimeout(function(){splash.style.display='none';},650);}
}
function countLevelsPassed(){var c=0;for(var i=1;i<=5;i++)if(levelPassed(i))c++;return c;}
function showLockToast(lv){showToast('Complete Level '+(lv-1)+' to unlock Level '+lv);}
function showToast(msg){
  var old=document.getElementById('lock-toast');if(old)old.remove();
  var t=document.createElement('div');t.id='lock-toast';
  t.style.cssText='position:fixed;top:60px;left:50%;transform:translateX(-50%);background:var(--amber);color:#1a1200;padding:8px 18px;border-radius:20px;font-size:12px;font-weight:700;z-index:10000;font-family:inherit;pointer-events:none;animation:toastFade 2.1s forwards';
  t.textContent=msg;
  document.body.appendChild(t);
  t.addEventListener('animationend',function(){t.remove();});
}

/* ============================================================
   GRAMMAR RENDERING — paginated, one pattern per page,
   interactive tap-to-build word order puzzles per example.
   ============================================================ */
var currentGLevel=1;
var gramPages=[], gramPageIdx=0, gramPagesLvl=0;
function openLevel(lv){
  currentGLevel=lv;
  if(gramPagesLvl!==lv){gramPages=[];gramPageIdx=0;}
  goTo('grammar');
  renderGrammarLesson(lv);
}
function renderGrammarHome(){renderGrammarLesson(currentGLevel);}
function buildGramPages(L){
  return L.patterns.map(function(pat){return {pat:pat};});
}
function renderGrammarLesson(lv){
  currentGLevel=lv;
  grammarViewed[lv]=true; saveState();
  var L=null;for(var i=0;i<grammarLevels.length;i++)if(grammarLevels[i].level===lv)L=grammarLevels[i];
  if(!L)return;
  if(!gramPages.length||gramPagesLvl!==lv){gramPages=buildGramPages(L);gramPagesLvl=lv;gramPageIdx=0;}
  var root=document.getElementById('grammar-content');
  var colVar=LEVEL_COLOR_VAR[lv-1];
  var page=gramPages[gramPageIdx];
  if(!page){grammarLevelComplete(lv);return;}
  var h='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'+
    '<button onclick="goTo(\'home\')" style="padding:5px 10px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-size:11px;font-family:inherit">&larr;</button>'+
    '<div style="display:flex;align-items:center;gap:6px;color:var(--'+colVar+');flex:1"><span style="display:flex">'+svgI(LEVEL_ICON[lv-1],16)+'</span><span style="font-size:12px;font-weight:700">'+L.label+'</span></div>'+
    '<div style="font-size:10px;color:var(--text3)">'+(gramPageIdx+1)+' / '+gramPages.length+'</div></div>'+
    '<div style="height:4px;background:var(--bg3);border-radius:10px;overflow:hidden;margin-bottom:14px">'+
    '<div style="height:100%;width:'+Math.round((gramPageIdx+1)/gramPages.length*100)+'%;background:var(--'+colVar+');border-radius:10px;transition:width .3s"></div></div>';

  var pat=page.pat;
  h+='<div style="text-align:center;margin-bottom:14px"><div class="pat-title" style="justify-content:center">'+pat.title+'</div><div class="pat-rule" style="display:inline-block">'+pat.rule+'</div></div>';
  h+='<div class="card" style="padding:16px 14px">';
  for(var e=0;e<pat.examples.length;e++){
    if(e>0)h+='<div style="margin:14px 0;height:1px;background:linear-gradient(90deg,transparent,var(--border2),transparent)"></div>';
    var ex=pat.examples[e];
    var img=GRAMMAR_IMGS[ex.phon];
    if(img)h+=img;
    h+='<div style="text-align:center;margin-bottom:10px">'+
       '<button onclick="speakKorean(\''+ex.thai.replace(/'/g,"\\'")+'\')" style="background:none;border:none;cursor:pointer;color:var(--purple);display:inline-flex;align-items:center;gap:6px;margin-bottom:4px">'+svgI('speaker',14)+'</button>'+
       '<div style="font-size:15px;color:var(--text);font-weight:600;line-height:1.5;margin-bottom:2px">'+ex.eng+'</div>'+
       '<div style="font-size:12px;color:var(--purple);font-weight:500">'+ex.phon+'</div></div>';
    h+='<div id="gram-interact-'+e+'" style="margin-bottom:6px"></div>';
  }
  h+='</div>';
  h+='<div id="gram-feedback" style="font-size:14px;font-weight:600;text-align:center;min-height:20px;margin-top:10px"></div>';
  h+='<button id="gram-next-btn" style="display:none;width:100%;padding:13px;border-radius:var(--rsm);border:1.5px solid var(--'+colVar+');background:var(--'+colVar+'-bg);color:var(--'+colVar+');cursor:pointer;font-size:14px;font-family:inherit;font-weight:600;margin-top:6px">Next →</button>';
  root.innerHTML=h;

  var doneCount=0, total=pat.examples.length;
  for(var e=0;e<pat.examples.length;e++)(function(ex,idx){
    var area=document.getElementById('gram-interact-'+idx);
    if(!area)return;
    setupGramBuild(area,ex,function(){
      doneCount++;
      if(doneCount>=total)gramPageDone(lv,colVar);
    });
  })(pat.examples[e],e);
}
function setupGramBuild(area,ex,onDone){
  area.innerHTML='<div class="gb" style="min-height:38px;background:var(--bg3);border:1.5px dashed var(--border2);border-radius:var(--rsm);padding:6px;display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;justify-content:center"></div>'+
    '<div class="gt" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center"></div>';
  var built=[], correct=ex.words.map(function(w){return w.t;});
  var jumbled=shuffle(ex.words.slice());
  var tilesEl=area.querySelector('.gt'), builtEl=area.querySelector('.gb');
  jumbled.forEach(function(w,i){
    var btn=document.createElement('button');
    btn.className='word-chip '+w.c;
    btn.style.cssText='cursor:pointer;border:1px solid transparent;transition:opacity .2s;animation:tileBounce .3s ease-out both;animation-delay:'+(i*0.05)+'s';
    btn.innerHTML='<div class="wt">'+w.t+'</div><div class="wp">'+w.p+'</div><div class="we">'+w.e+'</div>';
    btn.onclick=function(){
      if(btn.classList.contains('used'))return;
      if(w.t!==correct[built.length]){
        btn.style.animation='wrongShake .3s';setTimeout(function(){btn.style.animation='';},300);
        playWrong();
        return;
      }
      btn.classList.add('used');btn.style.opacity='.25';btn.style.pointerEvents='none';
      playTap();
      speakKorean(w.t);
      built.push(w.t);
      var chip=document.createElement('div');
      chip.className='word-chip '+w.c;
      chip.style.cssText='animation:tileBounce .25s ease-out both';
      chip.innerHTML='<div class="wt">'+w.t+'</div><div class="wp">'+w.p+'</div>';
      builtEl.appendChild(chip);
      if(built.length===correct.length)onDone();
    };
    tilesEl.appendChild(btn);
  });
}
var _gramPageDoneFlag=false;
function gramPageDone(lv,colVar){
  if(_gramPageDoneFlag)return;_gramPageDoneFlag=true;
  playCorrect();
  var fb=document.getElementById('gram-feedback');
  if(fb){fb.style.color='var(--green)';fb.innerHTML=svgI('check',16)+' Nice!';}
  var btn=document.getElementById('gram-next-btn');
  if(btn){
    btn.style.display='block';
    btn.textContent=gramPageIdx>=gramPages.length-1?'Finish level →':'Next →';
    btn.onclick=function(){
      _gramPageDoneFlag=false;
      gramPageIdx++;
      if(gramPageIdx>=gramPages.length){gramPages=[];grammarLevelComplete(lv);}
      else renderGrammarLesson(lv);
      var gs=document.getElementById('sec-grammar');if(gs)gs.scrollTop=0;
    };
  }
}
function grammarLevelComplete(lv){
  grammarViewed[lv]=true; saveState();
  playLevelUp();
  var root=document.getElementById('grammar-content');
  if(!root)return;
  var colVar=LEVEL_COLOR_VAR[lv-1];
  root.innerHTML='<div style="text-align:center;padding:30px 0">'+
    '<div style="display:flex;justify-content:center;color:var(--'+colVar+');margin-bottom:14px">'+svgI('star',48)+'</div>'+
    '<div style="font-size:20px;font-weight:700;color:var(--'+colVar+');margin-bottom:10px">Level '+lv+' grammar complete!</div>'+
    '<div style="font-size:14px;color:var(--text2);margin-bottom:22px;line-height:1.6">Ready for the quiz? Pass all 3 tests to unlock the next level.</div>'+
    '<button onclick="goTo(\'quiz\');startQuiz('+lv+')" style="display:block;width:100%;padding:15px;border-radius:var(--rsm);border:none;background:linear-gradient(135deg,#8F1A1A,#C9333B);color:#fff;cursor:pointer;font-size:15px;font-family:inherit;font-weight:700;margin-bottom:12px">Go to Quiz →</button>'+
    '<button onclick="gramPages=[];gramPageIdx=0;renderGrammarLesson('+lv+')" style="width:100%;padding:13px;border-radius:var(--rsm);border:1.5px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-size:14px;font-family:inherit;margin-bottom:10px">Review grammar again</button>'+
    '<button onclick="goTo(\'home\')" style="width:100%;padding:13px;border-radius:var(--rsm);border:1.5px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-size:13px;font-family:inherit">&larr; Back to levels</button>'+
    '</div>';
}

/* ============================================================
   MASTER VOCABULARY — 30+ words per level (150+ total)
   Used by: translation quiz, phonetics quiz, word match, flashcards, word bank
   cat: nouns | verbs | descriptors | feelings | time | modals | questions | conditionals | particles
   ============================================================ */
var MASTER_VOCAB=[
// ── LEVEL 1 ──
{t:'밥',p:'bap',e:'rice',lv:1,cat:'nouns'},{t:'물',p:'mul',e:'water',lv:1,cat:'nouns'},
{t:'커피',p:'keopi',e:'coffee',lv:1,cat:'nouns'},{t:'책',p:'chaek',e:'book',lv:1,cat:'nouns'},
{t:'집',p:'jip',e:'house',lv:1,cat:'nouns'},{t:'학교',p:'hakgyo',e:'school',lv:1,cat:'nouns'},
{t:'친구',p:'chingu',e:'friend',lv:1,cat:'nouns'},{t:'선생님',p:'seonsaengnim',e:'teacher',lv:1,cat:'nouns'},
{t:'학생',p:'haksaeng',e:'student',lv:1,cat:'nouns'},{t:'가족',p:'gajok',e:'family',lv:1,cat:'nouns'},
{t:'가요',p:'gayo',e:'go',lv:1,cat:'verbs'},{t:'와요',p:'wayo',e:'come',lv:1,cat:'verbs'},
{t:'먹어요',p:'meogeoyo',e:'eat',lv:1,cat:'verbs'},{t:'마셔요',p:'masyeoyo',e:'drink',lv:1,cat:'verbs'},
{t:'봐요',p:'bwayo',e:'watch / see',lv:1,cat:'verbs'},{t:'읽어요',p:'ilgeoyo',e:'read',lv:1,cat:'verbs'},
{t:'자요',p:'jayo',e:'sleep',lv:1,cat:'verbs'},{t:'해요',p:'haeyo',e:'do',lv:1,cat:'verbs'},
{t:'사요',p:'sayo',e:'buy',lv:1,cat:'verbs'},{t:'말해요',p:'malhaeyo',e:'speak',lv:1,cat:'verbs'},
{t:'오늘',p:'oneul',e:'today',lv:1,cat:'time'},{t:'내일',p:'naeil',e:'tomorrow',lv:1,cat:'time'},
{t:'어제',p:'eoje',e:'yesterday',lv:1,cat:'time'},{t:'지금',p:'jigeum',e:'now',lv:1,cat:'time'},
{t:'아침',p:'achim',e:'morning',lv:1,cat:'time'},{t:'저',p:'jeo',e:'I',lv:1,cat:'nouns'},
{t:'그',p:'geu',e:'he',lv:1,cat:'nouns'},{t:'이것',p:'igeot',e:'this',lv:1,cat:'nouns'},
{t:'그것',p:'geugeot',e:'that',lv:1,cat:'nouns'},{t:'누구',p:'nugu',e:'who',lv:1,cat:'questions'},
// ── LEVEL 2 ──
{t:'좋아요',p:'joayo',e:'good / like',lv:2,cat:'descriptors'},{t:'나빠요',p:'nappayo',e:'bad',lv:2,cat:'descriptors'},
{t:'행복해요',p:'haengbokhaeyo',e:'happy',lv:2,cat:'feelings'},{t:'슬퍼요',p:'seulpeoyo',e:'sad',lv:2,cat:'feelings'},
{t:'피곤해요',p:'pigonhaeyo',e:'tired',lv:2,cat:'feelings'},{t:'바빠요',p:'bappayo',e:'busy',lv:2,cat:'feelings'},
{t:'배고파요',p:'baegopayo',e:'hungry',lv:2,cat:'feelings'},{t:'졸려요',p:'jollyeoyo',e:'sleepy',lv:2,cat:'feelings'},
{t:'엄마',p:'eomma',e:'mom',lv:2,cat:'nouns'},{t:'아빠',p:'appa',e:'dad',lv:2,cat:'nouns'},
{t:'언니',p:'eonni',e:'older sister (of a girl)',lv:2,cat:'nouns'},{t:'형',p:'hyeong',e:'older brother (of a boy)',lv:2,cat:'nouns'},
{t:'동생',p:'dongsaeng',e:'younger sibling',lv:2,cat:'nouns'},{t:'병원',p:'byeongwon',e:'hospital',lv:2,cat:'nouns'},
{t:'시장',p:'sijang',e:'market',lv:2,cat:'nouns'},{t:'공원',p:'gongwon',e:'park',lv:2,cat:'nouns'},
{t:'할 수 있어요',p:'hal su isseoyo',e:'can do',lv:2,cat:'modals'},{t:'알아요',p:'arayo',e:'know',lv:2,cat:'modals'},
{t:'몰라요',p:'mollayo',e:'don’t know',lv:2,cat:'modals'},{t:'걸어요',p:'georeoyo',e:'walk',lv:2,cat:'verbs'},
{t:'뛰어요',p:'ttwieoyo',e:'run',lv:2,cat:'verbs'},{t:'일어나요',p:'ireonayo',e:'wake up',lv:2,cat:'verbs'},
{t:'씻어요',p:'ssiseoyo',e:'wash',lv:2,cat:'verbs'},{t:'쉬어요',p:'swieoyo',e:'rest',lv:2,cat:'verbs'},
{t:'기다려요',p:'gidaryeoyo',e:'wait',lv:2,cat:'verbs'},{t:'매일',p:'maeil',e:'every day',lv:2,cat:'time'},
{t:'항상',p:'hangsang',e:'always',lv:2,cat:'time'},{t:'가끔',p:'gakkeum',e:'sometimes',lv:2,cat:'time'},
{t:'나중에',p:'najunge',e:'later',lv:2,cat:'time'},{t:'오후',p:'ohu',e:'afternoon',lv:2,cat:'time'},
// ── LEVEL 3 ──
{t:'김치',p:'gimchi',e:'kimchi',lv:3,cat:'nouns'},{t:'비빔밥',p:'bibimbap',e:'bibimbap',lv:3,cat:'nouns'},
{t:'불고기',p:'bulgogi',e:'bulgogi',lv:3,cat:'nouns'},{t:'라면',p:'ramyeon',e:'ramen noodles',lv:3,cat:'nouns'},
{t:'빵',p:'ppang',e:'bread',lv:3,cat:'nouns'},{t:'과일',p:'gwail',e:'fruit',lv:3,cat:'nouns'},
{t:'야채',p:'yachae',e:'vegetables',lv:3,cat:'nouns'},{t:'고기',p:'gogi',e:'meat',lv:3,cat:'nouns'},
{t:'공항',p:'gonghang',e:'airport',lv:3,cat:'nouns'},{t:'기차',p:'gicha',e:'train',lv:3,cat:'nouns'},
{t:'버스',p:'beoseu',e:'bus',lv:3,cat:'nouns'},{t:'지하철',p:'jihacheol',e:'subway',lv:3,cat:'nouns'},
{t:'비행기',p:'bihaenggi',e:'airplane',lv:3,cat:'nouns'},{t:'호텔',p:'hotel',e:'hotel',lv:3,cat:'nouns'},
{t:'여권',p:'yeogwon',e:'passport',lv:3,cat:'nouns'},{t:'가게',p:'gage',e:'store',lv:3,cat:'nouns'},
{t:'옷',p:'ot',e:'clothes',lv:3,cat:'nouns'},{t:'신발',p:'sinbal',e:'shoes',lv:3,cat:'nouns'},
{t:'가격',p:'gagyeok',e:'price',lv:3,cat:'nouns'},{t:'돈',p:'don',e:'money',lv:3,cat:'nouns'},
{t:'비싸요',p:'bissayo',e:'expensive',lv:3,cat:'descriptors'},{t:'싸요',p:'ssayo',e:'cheap',lv:3,cat:'descriptors'},
{t:'커요',p:'keoyo',e:'big',lv:3,cat:'descriptors'},{t:'작아요',p:'jagayo',e:'small',lv:3,cat:'descriptors'},
{t:'예뻐요',p:'yeppeoyo',e:'pretty',lv:3,cat:'descriptors'},{t:'귀여워요',p:'gwiyeowoyo',e:'cute',lv:3,cat:'descriptors'},
{t:'이번 주',p:'ibeon ju',e:'this week',lv:3,cat:'time'},{t:'주말',p:'jumal',e:'weekend',lv:3,cat:'time'},
{t:'시간',p:'sigan',e:'time',lv:3,cat:'nouns'},{t:'여행',p:'yeohaeng',e:'travel',lv:3,cat:'nouns'},
// ── LEVEL 4 ──
{t:'회사',p:'hoesa',e:'company',lv:4,cat:'nouns'},{t:'사무실',p:'samusil',e:'office',lv:4,cat:'nouns'},
{t:'회의',p:'hoeui',e:'meeting',lv:4,cat:'nouns'},{t:'월급',p:'wolgeup',e:'salary',lv:4,cat:'nouns'},
{t:'동료',p:'dongnyo',e:'colleague',lv:4,cat:'nouns'},{t:'시험',p:'siheom',e:'exam',lv:4,cat:'nouns'},
{t:'숙제',p:'sukje',e:'homework',lv:4,cat:'nouns'},{t:'대학교',p:'daehakgyo',e:'university',lv:4,cat:'nouns'},
{t:'전공',p:'jeongong',e:'major (of study)',lv:4,cat:'nouns'},{t:'목표',p:'mokpyo',e:'goal',lv:4,cat:'nouns'},
{t:'계획',p:'gyehoek',e:'plan',lv:4,cat:'nouns'},{t:'걱정해요',p:'geokjeonghaeyo',e:'worry',lv:4,cat:'feelings'},
{t:'긴장해요',p:'ginjanghaeyo',e:'nervous',lv:4,cat:'feelings'},{t:'놀라요',p:'nollayo',e:'surprised',lv:4,cat:'feelings'},
{t:'화나요',p:'hwanayo',e:'angry',lv:4,cat:'feelings'},{t:'편안해요',p:'pyeonanhaeyo',e:'comfortable',lv:4,cat:'feelings'},
{t:'자신있어요',p:'jasinisseoyo',e:'confident',lv:4,cat:'feelings'},{t:'결정해요',p:'gyeoljeonghaeyo',e:'decide',lv:4,cat:'verbs'},
{t:'준비해요',p:'junbihaeyo',e:'prepare',lv:4,cat:'verbs'},{t:'시작해요',p:'sijakhaeyo',e:'start',lv:4,cat:'verbs'},
{t:'끝나요',p:'kkeutnayo',e:'finish / end',lv:4,cat:'verbs'},{t:'도와줘요',p:'dowajwoyo',e:'help',lv:4,cat:'verbs'},
{t:'설명해요',p:'seolmyeonghaeyo',e:'explain',lv:4,cat:'verbs'},{t:'성공해요',p:'seonggonghaeyo',e:'succeed',lv:4,cat:'verbs'},
{t:'실패해요',p:'silpaehaeyo',e:'fail',lv:4,cat:'verbs'},{t:'그래서',p:'geuraeseo',e:'so / therefore',lv:4,cat:'conditionals'},
{t:'하지만',p:'hajiman',e:'but',lv:4,cat:'conditionals'},{t:'그리고',p:'geurigo',e:'and',lv:4,cat:'conditionals'},
{t:'왜냐하면',p:'waenyahamyeon',e:'because',lv:4,cat:'conditionals'},{t:'그런데',p:'geureonde',e:'however / by the way',lv:4,cat:'conditionals'},
// ── LEVEL 5 ──
{t:'사회',p:'sahoe',e:'society',lv:5,cat:'nouns'},{t:'경제',p:'gyeongje',e:'economy',lv:5,cat:'nouns'},
{t:'정부',p:'jeongbu',e:'government',lv:5,cat:'nouns'},{t:'문화',p:'munhwa',e:'culture',lv:5,cat:'nouns'},
{t:'전통',p:'jeontong',e:'tradition',lv:5,cat:'nouns'},{t:'환경',p:'hwangyeong',e:'environment',lv:5,cat:'nouns'},
{t:'기술',p:'gisul',e:'technology',lv:5,cat:'nouns'},{t:'미래',p:'mirae',e:'future',lv:5,cat:'nouns'},
{t:'과거',p:'gwageo',e:'past',lv:5,cat:'nouns'},{t:'역사',p:'yeoksa',e:'history',lv:5,cat:'nouns'},
{t:'결과',p:'gyeolgwa',e:'result',lv:5,cat:'nouns'},{t:'이유',p:'iyu',e:'reason',lv:5,cat:'nouns'},
{t:'기회',p:'gihoe',e:'opportunity',lv:5,cat:'nouns'},{t:'선택',p:'seontaek',e:'choice',lv:5,cat:'nouns'},
{t:'발전해요',p:'baljeonhaeyo',e:'develop',lv:5,cat:'verbs'},{t:'변해요',p:'byeonhaeyo',e:'change',lv:5,cat:'verbs'},
{t:'참여해요',p:'chamyeohaeyo',e:'participate',lv:5,cat:'verbs'},{t:'해결해요',p:'haegyeolhaeyo',e:'solve',lv:5,cat:'verbs'},
{t:'주장해요',p:'jujanghaeyo',e:'argue / claim',lv:5,cat:'verbs'},{t:'중요해요',p:'jungyohaeyo',e:'important',lv:5,cat:'descriptors'},
{t:'필요해요',p:'pillyohaeyo',e:'necessary',lv:5,cat:'descriptors'},{t:'가능해요',p:'ganeunghaeyo',e:'possible',lv:5,cat:'descriptors'},
{t:'불가능해요',p:'bulganeunghaeyo',e:'impossible',lv:5,cat:'descriptors'},{t:'복잡해요',p:'bokjaphaeyo',e:'complicated',lv:5,cat:'descriptors'},
{t:'간단해요',p:'gandanhaeyo',e:'simple',lv:5,cat:'descriptors'},{t:'따라서',p:'ttaraseo',e:'therefore',lv:5,cat:'conditionals'},
{t:'예를 들면',p:'yereul deulmyeon',e:'for example',lv:5,cat:'conditionals'},{t:'반면에',p:'banmyeone',e:'on the other hand',lv:5,cat:'conditionals'},
{t:'만약',p:'manyak',e:'if / in the event that',lv:5,cat:'conditionals'},{t:'결국',p:'gyeolguk',e:'in the end',lv:5,cat:'conditionals'},
// ── Expansion pass (HardScan vs. ManLang, 2026-08-04) — verbs ──
{t:'만나요',p:'mannayo',e:'meet',lv:1,cat:'verbs'},{t:'전화해요',p:'jeonhwahaeyo',e:'call / phone',lv:1,cat:'verbs'},
{t:'보내요',p:'bonaeyo',e:'send',lv:2,cat:'verbs'},{t:'받아요',p:'badayo',e:'receive',lv:2,cat:'verbs'},
{t:'열어요',p:'yeoreoyo',e:'open',lv:2,cat:'verbs'},{t:'닫아요',p:'dadayo',e:'close',lv:2,cat:'verbs'},
{t:'켜요',p:'kyeoyo',e:'turn on',lv:2,cat:'verbs'},{t:'꺼요',p:'kkeoyo',e:'turn off',lv:2,cat:'verbs'},
{t:'찾아요',p:'chajayo',e:'find / look for',lv:3,cat:'verbs'},{t:'잃어버려요',p:'ireobeoryeoyo',e:'lose (something)',lv:3,cat:'verbs'},
{t:'빌려요',p:'billyeoyo',e:'borrow',lv:3,cat:'verbs'},{t:'빌려줘요',p:'billyeojwoyo',e:'lend',lv:3,cat:'verbs'},
{t:'고쳐요',p:'gochyeoyo',e:'fix / repair',lv:4,cat:'verbs'},{t:'바꿔요',p:'bakkwoyo',e:'change / exchange',lv:4,cat:'verbs'},
{t:'기억해요',p:'gieokhaeyo',e:'remember',lv:4,cat:'verbs'},{t:'잊어버려요',p:'ijeobeoryeoyo',e:'forget',lv:4,cat:'verbs'},
// ── nouns ──
{t:'나라',p:'nara',e:'country',lv:1,cat:'nouns'},{t:'도시',p:'dosi',e:'city',lv:1,cat:'nouns'},
{t:'마을',p:'maeul',e:'town / village',lv:1,cat:'nouns'},{t:'산',p:'san',e:'mountain',lv:1,cat:'nouns'},
{t:'강',p:'gang',e:'river',lv:1,cat:'nouns'},{t:'바다',p:'bada',e:'sea',lv:1,cat:'nouns'},
{t:'하늘',p:'haneul',e:'sky',lv:1,cat:'nouns'},{t:'나무',p:'namu',e:'tree',lv:1,cat:'nouns'},
{t:'꽃',p:'kkot',e:'flower',lv:1,cat:'nouns'},{t:'동물',p:'dongmul',e:'animal',lv:1,cat:'nouns'},
{t:'강아지',p:'gangaji',e:'puppy / dog',lv:1,cat:'nouns'},{t:'고양이',p:'goyangi',e:'cat',lv:1,cat:'nouns'},
{t:'새',p:'sae',e:'bird',lv:1,cat:'nouns'},{t:'길',p:'gil',e:'road / way',lv:2,cat:'nouns'},
{t:'다리',p:'dari',e:'bridge',lv:2,cat:'nouns'},{t:'건물',p:'geonmul',e:'building',lv:2,cat:'nouns'},
{t:'방',p:'bang',e:'room',lv:2,cat:'nouns'},{t:'창문',p:'changmun',e:'window',lv:2,cat:'nouns'},
{t:'문',p:'mun',e:'door',lv:2,cat:'nouns'},{t:'의자',p:'uija',e:'chair',lv:2,cat:'nouns'},
{t:'책상',p:'chaeksang',e:'desk',lv:2,cat:'nouns'},{t:'침대',p:'chimdae',e:'bed',lv:2,cat:'nouns'},
{t:'거울',p:'geoul',e:'mirror',lv:3,cat:'nouns'},{t:'우산',p:'usan',e:'umbrella',lv:3,cat:'nouns'},
{t:'지갑',p:'jigap',e:'wallet',lv:3,cat:'nouns'},
// ── feelings ──
{t:'무서워요',p:'museowoyo',e:'scared',lv:2,cat:'feelings'},{t:'외로워요',p:'oeroweoyo',e:'lonely',lv:2,cat:'feelings'},
{t:'심심해요',p:'simsimhaeyo',e:'bored',lv:2,cat:'feelings'},{t:'편해요',p:'pyeonhaeyo',e:'comfortable',lv:2,cat:'feelings'},
{t:'불편해요',p:'bulpyeonhaeyo',e:'uncomfortable',lv:3,cat:'feelings'},{t:'부끄러워요',p:'bukkeureowoyo',e:'embarrassed',lv:3,cat:'feelings'},
{t:'자랑스러워요',p:'jarangseureowoyo',e:'proud',lv:3,cat:'feelings'},{t:'감사해요',p:'gamsahaeyo',e:'grateful',lv:2,cat:'feelings'},
{t:'속상해요',p:'soksanghaeyo',e:'upset',lv:3,cat:'feelings'},{t:'답답해요',p:'dapdaphaeyo',e:'frustrated',lv:4,cat:'feelings'},
{t:'설레요',p:'seollaeyo',e:'excited / thrilled',lv:3,cat:'feelings'},
// ── time ──
{t:'지난주',p:'jinanju',e:'last week',lv:2,cat:'time'},{t:'다음 주',p:'daeum ju',e:'next week',lv:2,cat:'time'},
{t:'지난달',p:'jinandal',e:'last month',lv:2,cat:'time'},{t:'다음 달',p:'daeum dal',e:'next month',lv:2,cat:'time'},
{t:'작년',p:'jangnyeon',e:'last year',lv:3,cat:'time'},{t:'내년',p:'naenyeon',e:'next year',lv:3,cat:'time'},
{t:'올해',p:'olhae',e:'this year',lv:3,cat:'time'},{t:'잠시 후',p:'jamsi hu',e:'in a moment',lv:3,cat:'time'},
{t:'곧',p:'got',e:'soon',lv:2,cat:'time'},{t:'아직',p:'ajik',e:'still / yet',lv:2,cat:'time'},
// ── modals ──
{t:'해도 돼요',p:'haedo dwaeyo',e:'may do',lv:3,cat:'modals'},{t:'하면 안 돼요',p:'hamyeon an dwaeyo',e:'must not do',lv:3,cat:'modals'},
{t:'할 필요 없어요',p:'hal pillyo eopseoyo',e:'don’t need to',lv:3,cat:'modals'},{t:'해야만 해요',p:'haeyaman haeyo',e:'absolutely must',lv:4,cat:'modals'},
{t:'하려고 해요',p:'haryeogo haeyo',e:'intend to',lv:4,cat:'modals'},{t:'할 것 같아요',p:'hal geot gatayo',e:'seems like it will',lv:4,cat:'modals'},
{t:'하는 게 좋아요',p:'haneun ge joayo',e:'it’s better to',lv:3,cat:'modals'},{t:'할 줄 알아요',p:'hal jul arayo',e:'know how to',lv:3,cat:'modals'},
{t:'할 줄 몰라요',p:'hal jul mollayo',e:'don’t know how to',lv:3,cat:'modals'},{t:'해 본 적 있어요',p:'hae bon jeok isseoyo',e:'have tried before',lv:4,cat:'modals'},
{t:'해 본 적 없어요',p:'hae bon jeok eopseoyo',e:'have never tried',lv:4,cat:'modals'},{t:'믿어요',p:'mideoyo',e:'believe',lv:4,cat:'modals'},
{t:'확신해요',p:'hwaksinhaeyo',e:'be certain',lv:5,cat:'modals'},{t:'추측해요',p:'chucheukhaeyo',e:'guess',lv:5,cat:'modals'},
{t:'상상해요',p:'sangsanghaeyo',e:'imagine',lv:5,cat:'modals'},
// ── questions ──
{t:'뭐',p:'mwo',e:'what',lv:1,cat:'questions'},{t:'어디',p:'eodi',e:'where',lv:1,cat:'questions'},
{t:'언제',p:'eonje',e:'when',lv:1,cat:'questions'},{t:'왜',p:'wae',e:'why',lv:1,cat:'questions'},
{t:'어떻게',p:'eotteoke',e:'how',lv:2,cat:'questions'},{t:'얼마나',p:'eolmana',e:'how much / how long',lv:2,cat:'questions'},
{t:'몇',p:'myeot',e:'how many',lv:2,cat:'questions'},{t:'어느',p:'eoneu',e:'which',lv:2,cat:'questions'},
{t:'무엇',p:'mueot',e:'what (formal)',lv:3,cat:'questions'},{t:'어느 것',p:'eoneu geot',e:'which one',lv:2,cat:'questions'},
{t:'얼마',p:'eolma',e:'how much (price)',lv:1,cat:'questions'},{t:'몇 시',p:'myeot si',e:'what time',lv:2,cat:'questions'},
{t:'며칠',p:'myeochil',e:'what day / how many days',lv:3,cat:'questions'},{t:'얼마 동안',p:'eolma dongan',e:'for how long',lv:3,cat:'questions'},
// ── conditionals / connectors ──
{t:'그러면',p:'geureomyeon',e:'then / in that case',lv:3,cat:'conditionals'},{t:'그러나',p:'geureona',e:'but (formal)',lv:4,cat:'conditionals'},
{t:'또는',p:'ttoneun',e:'or',lv:2,cat:'conditionals'},{t:'혹은',p:'hogeun',e:'or else',lv:4,cat:'conditionals'},
{t:'게다가',p:'gedaga',e:'moreover',lv:5,cat:'conditionals'},{t:'그래도',p:'geuraedo',e:'even so',lv:4,cat:'conditionals'},
{t:'대신에',p:'daesine',e:'instead of',lv:4,cat:'conditionals'},{t:'동안',p:'dongan',e:'while / during',lv:3,cat:'conditionals'},
// ── particles (new category) ──
{t:'은',p:'eun',e:'topic marker (after consonant)',lv:1,cat:'particles'},{t:'는',p:'neun',e:'topic marker (after vowel)',lv:1,cat:'particles'},
{t:'이',p:'i',e:'subject marker (after consonant)',lv:1,cat:'particles'},{t:'가',p:'ga',e:'subject marker (after vowel)',lv:1,cat:'particles'},
{t:'을',p:'eul',e:'object marker (after consonant)',lv:1,cat:'particles'},{t:'를',p:'reul',e:'object marker (after vowel)',lv:1,cat:'particles'},
{t:'에',p:'e',e:'at / to (place, time)',lv:1,cat:'particles'},{t:'에서',p:'eseo',e:'at / from (place of action)',lv:2,cat:'particles'},
{t:'도',p:'do',e:'also / too',lv:2,cat:'particles'},{t:'만',p:'man',e:'only',lv:2,cat:'particles'},
{t:'과',p:'gwa',e:'and / with (after consonant)',lv:2,cat:'particles'},{t:'와',p:'wa',e:'and / with (after vowel)',lv:2,cat:'particles'},
{t:'한테',p:'hante',e:'to (a person)',lv:3,cat:'particles'},{t:'께',p:'kke',e:'to (honorific)',lv:5,cat:'particles'},
{t:'로',p:'ro',e:'by / toward (after vowel)',lv:3,cat:'particles'},{t:'으로',p:'euro',e:'by / toward (after consonant)',lv:3,cat:'particles'},
{t:'까지',p:'kkaji',e:'until / up to',lv:3,cat:'particles'},
// ── descriptors ──
{t:'길어요',p:'gireoyo',e:'long',lv:2,cat:'descriptors'},{t:'짧아요',p:'jjalbayo',e:'short',lv:2,cat:'descriptors'},
{t:'높아요',p:'nopayo',e:'high',lv:2,cat:'descriptors'},{t:'낮아요',p:'najayo',e:'low',lv:2,cat:'descriptors'},
{t:'무거워요',p:'mugeowoyo',e:'heavy',lv:2,cat:'descriptors'},{t:'가벼워요',p:'gabyeowoyo',e:'light (weight)',lv:2,cat:'descriptors'},
{t:'빨라요',p:'ppallayo',e:'fast',lv:1,cat:'descriptors'},{t:'느려요',p:'neuryeoyo',e:'slow',lv:1,cat:'descriptors'},
{t:'깨끗해요',p:'kkaekkeuthaeyo',e:'clean',lv:2,cat:'descriptors'},{t:'더러워요',p:'deoreowoyo',e:'dirty',lv:2,cat:'descriptors'},
{t:'조용해요',p:'joyonghaeyo',e:'quiet',lv:2,cat:'descriptors'},{t:'시끄러워요',p:'sikkeureowoyo',e:'loud',lv:2,cat:'descriptors'},
{t:'따뜻해요',p:'ttatteuthaeyo',e:'warm',lv:1,cat:'descriptors'},{t:'시원해요',p:'siwonhaeyo',e:'cool / refreshing',lv:1,cat:'descriptors'},
{t:'더워요',p:'deowoyo',e:'hot (weather)',lv:1,cat:'descriptors'},{t:'추워요',p:'chuwoyo',e:'cold (weather)',lv:1,cat:'descriptors'},
{t:'똑똑해요',p:'ttokttokhaeyo',e:'smart',lv:2,cat:'descriptors'},{t:'멋있어요',p:'meositsseoyo',e:'cool / stylish',lv:2,cat:'descriptors'},
{t:'아름다워요',p:'areumdawoyo',e:'beautiful',lv:2,cat:'descriptors'},{t:'강해요',p:'ganghaeyo',e:'strong',lv:2,cat:'descriptors'},
{t:'약해요',p:'yakhaeyo',e:'weak',lv:2,cat:'descriptors'},{t:'넓어요',p:'neolbeoyo',e:'wide',lv:3,cat:'descriptors'},
{t:'좁아요',p:'jobayo',e:'narrow',lv:3,cat:'descriptors'},{t:'두꺼워요',p:'dukkeowoyo',e:'thick',lv:3,cat:'descriptors'},
{t:'얇아요',p:'yalbayo',e:'thin',lv:3,cat:'descriptors'},{t:'단단해요',p:'dandanhaeyo',e:'solid / hard',lv:3,cat:'descriptors'},
{t:'부드러워요',p:'budeureowoyo',e:'soft',lv:3,cat:'descriptors'},{t:'편리해요',p:'pyeollihaeyo',e:'convenient',lv:4,cat:'descriptors'},
];
function vocabByLevel(lv){return MASTER_VOCAB.filter(function(w){return w.lv===lv;});}
function vocabUpTo(lv){return MASTER_VOCAB.filter(function(w){return w.lv<=lv;});}

/* ============================================================
   QUIZ ENGINE — 3 modes per level: Translation, Phonetics, Match
   ============================================================ */
var QUIZ_MODE_LABEL={1:'Translation',2:'Phonetics',3:'Word Match'};
var quizLevel=1, quizMode=1, quizQueue=[], quizIdx=0, quizScore=0, quizAnswered=false;

function startQuiz(lv){
  quizLevel=lv;
  if(!quizPassed[lv])quizPassed[lv]={mode1:false,mode2:false,mode3:false};
  var nextMode=1;
  if(quizPassed[lv].mode1 && !quizPassed[lv].mode2)nextMode=2;
  else if(quizPassed[lv].mode1 && quizPassed[lv].mode2 && !quizPassed[lv].mode3)nextMode=3;
  startQuizMode(nextMode);
}
function renderModeChecklist(){
  var el=document.getElementById('q-mode-checklist');
  var qp=quizPassed[quizLevel]||{};
  var h='';
  for(var m=1;m<=3;m++){
    var done=qp['mode'+m];
    h+='<button class="fbtn'+(quizMode===m?' on':'')+'" onclick="startQuizMode('+m+')" style="'+(done?'border-color:var(--green);color:var(--green)':'')+'">'+(done?'✓ ':'')+QUIZ_MODE_LABEL[m]+'</button>';
  }
  el.innerHTML=h;
  document.getElementById('q-lv-display').textContent='Level '+quizLevel;
}
function startQuizMode(m){
  quizMode=m; quizScore=0; quizIdx=0;
  var pool=vocabByLevel(quizLevel);
  if(pool.length<4)pool=vocabUpTo(quizLevel);
  quizQueue=shuffle(pool).slice(0,10);
  if(quizQueue.length<10){ // pad by re-sampling if a level has fewer than 10 words
    while(quizQueue.length<10 && pool.length)quizQueue.push(pick(pool));
  }
  renderModeChecklist();
  renderQuizQuestion();
}
function renderQuizQuestion(){
  quizAnswered=false;
  document.getElementById('q-set-label').textContent='Question '+(quizIdx+1)+' of 10';
  document.getElementById('q-set-score').textContent=quizScore+' / 10';
  document.getElementById('q-set-bar').style.width=((quizIdx)/10*100)+'%';
  var item=quizQueue[quizIdx];
  var pool=vocabUpTo(quizLevel).length>=4?vocabUpTo(quizLevel):MASTER_VOCAB;
  var distractors=shuffle(pool.filter(function(w){return w.e!==item.e;})).slice(0,3);
  var opts=shuffle([item].concat(distractors));
  var qThai=document.getElementById('q-thai'), qPhon=document.getElementById('q-phon'), qLabel=document.getElementById('q-label');
  var optsEl=document.getElementById('q-opts');
  document.getElementById('q-breakdown').style.display='none';
  optsEl.innerHTML='';
  if(quizMode===1){ // Korean -> English
    qLabel.textContent='What does this mean?';
    qThai.textContent=item.t; qPhon.textContent=item.p;
    for(var i=0;i<opts.length;i++)(function(o){
      var b=document.createElement('button'); b.className='qbtn'; b.textContent=o.e;
      b.onclick=function(){answerQuiz(o.e===item.e,b);}; optsEl.appendChild(b);
    })(opts[i]);
  } else if(quizMode===2){ // Korean -> correct romanization
    qLabel.textContent='Choose the correct pronunciation';
    qThai.textContent=item.t; qPhon.textContent='';
    for(var i=0;i<opts.length;i++)(function(o){
      var b=document.createElement('button'); b.className='qbtn'; b.textContent=o.p;
      b.onclick=function(){answerQuiz(o.p===item.p,b);}; optsEl.appendChild(b);
    })(opts[i]);
  } else { // Mode 3: English -> Korean
    qLabel.textContent='Which word means this?';
    qThai.textContent=item.e; qPhon.textContent='';
    for(var i=0;i<opts.length;i++)(function(o){
      var b=document.createElement('button'); b.className='qbtn'; b.innerHTML=o.t+'<div style="font-size:11px;color:var(--purple);margin-top:3px">'+o.p+'</div>';
      b.onclick=function(){answerQuiz(o.t===item.t,b);}; optsEl.appendChild(b);
    })(opts[i]);
  }
  document.getElementById('q-result').textContent='';
  var nb=document.getElementById('q-next'); nb.disabled=true; nb.style.opacity='0.3'; nb.style.cursor='not-allowed';
}
function answerQuiz(correct,btn){
  if(quizAnswered)return;
  quizAnswered=true;
  var opts=document.querySelectorAll('#q-opts .qbtn');
  for(var i=0;i<opts.length;i++)opts[i].disabled=true;
  if(correct){
    quizScore++; xp+=5; updateXP();
    btn.classList.add('correct'); playCorrect();
    document.getElementById('q-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';
  } else {
    btn.classList.add('wrong'); playWrong();
    document.getElementById('q-result').innerHTML='<span style="color:var(--red)">Not quite</span>';
  }
  document.getElementById('q-set-score').textContent=quizScore+' / 10';
  var nb=document.getElementById('q-next'); nb.disabled=false; nb.style.opacity='1'; nb.style.cursor='pointer';
}
function nextQ(){
  quizIdx++;
  if(quizIdx>=10){ finishQuizRound(); return; }
  renderQuizQuestion();
}
function finishQuizRound(){
  document.getElementById('q-set-bar').style.width='100%';
  var passed=quizScore>=7;
  if(passed){
    if(!quizPassed[quizLevel])quizPassed[quizLevel]={mode1:false,mode2:false,mode3:false};
    quizPassed[quizLevel]['mode'+quizMode]=true;
    saveState();
  }
  var qOpts=document.getElementById('q-opts');
  qOpts.innerHTML='';
  var msg=passed?'🎉 Passed! '+quizScore+'/10 — mode complete.':'Scored '+quizScore+'/10 — need 7 to pass. Try again!';
  document.getElementById('q-result').innerHTML='<div style="font-size:16px;font-weight:700;color:'+(passed?'var(--green)':'var(--amber)')+'">'+msg+'</div>';
  document.getElementById('q-thai').textContent=''; document.getElementById('q-phon').textContent='';
  document.getElementById('q-label').textContent=passed?'Nice work!':'Keep practicing';
  if(passed && quizScore===10){showVictory();} else if(passed){playLevelUp();} else {playFailBuzz();}
  var nb=document.getElementById('q-next');
  nb.textContent = passed ? (allModesDone(quizLevel)?'Back to Home →':'Next mode →') : 'Try again →';
  nb.disabled=false; nb.style.opacity='1'; nb.style.cursor='pointer';
  nb.onclick=function(){
    nb.onclick=function(){nextQ();};
    nb.textContent='Next →';
    if(passed){
      if(allModesDone(quizLevel)){ goTo('home'); }
      else { startQuiz(quizLevel); }
    } else {
      startQuizMode(quizMode);
    }
  };
  renderModeChecklist();
}
function allModesDone(lv){var q=quizPassed[lv];return !!(q&&q.mode1&&q.mode2&&q.mode3);}

/* ============================================================
   PHRASE BANK — everyday phrases by category
   ============================================================ */
var PHRASE_DATA={
  'Greetings':[
    {t:'안녕하세요',p:'annyeonghaseyo',e:'Hello'},
    {t:'안녕히 가세요',p:'annyeonghi gaseyo',e:'Goodbye (to someone leaving)'},
    {t:'안녕히 계세요',p:'annyeonghi gyeseyo',e:'Goodbye (to someone staying)'},
    {t:'감사합니다',p:'gamsahamnida',e:'Thank you'},
    {t:'천만에요',p:'cheonmaneyo',e:'You’re welcome'},
    {t:'죄송합니다',p:'joesonghamnida',e:'I’m sorry'},
    {t:'괜찮아요',p:'gwaenchanayo',e:'It’s okay / I’m fine'},
    {t:'처음 뵙겠습니다',p:'cheoeum boepgesseumnida',e:'Nice to meet you'},
    {t:'좋은 아침이에요',p:'joeun achimieyo',e:'Good morning'},
    {t:'안녕히 주무세요',p:'annyeonghi jumuseyo',e:'Good night'},
  ],
  'Food & Dining':[
    {t:'메뉴판 주세요',p:'menyupan juseyo',e:'The menu, please'},
    {t:'이거 주세요',p:'igeo juseyo',e:'I’ll have this, please'},
    {t:'잘 먹겠습니다',p:'jal meokgesseumnida',e:'(said before eating) I will eat well'},
    {t:'잘 먹었습니다',p:'jal meogeotseumnida',e:'(said after eating) I ate well'},
    {t:'맛있어요',p:'masisseoyo',e:'It’s delicious'},
    {t:'계산서 주세요',p:'gyesanseo juseyo',e:'The check, please'},
    {t:'물 좀 주세요',p:'mul jom juseyo',e:'Water, please'},
    {t:'하나 더 주세요',p:'hana deo juseyo',e:'One more, please'},
    {t:'안 매워요?',p:'an maewoyo?',e:'Is it not spicy?'},
    {t:'저는 채식주의자예요',p:'jeoneun chaesikjuuijayeyo',e:'I am a vegetarian'},
  ],
  'Travel':[
    {t:'화장실이 어디예요?',p:'hwajangsiri eodiyeyo?',e:'Where is the bathroom?'},
    {t:'여기가 어디예요?',p:'yeogiga eodiyeyo?',e:'Where am I?'},
    {t:'얼마예요?',p:'eolmayeyo?',e:'How much is it?'},
    {t:'길을 잃었어요',p:'gireul ireosseoyo',e:'I’m lost'},
    {t:'표 한 장 주세요',p:'pyo han jang juseyo',e:'One ticket, please'},
    {t:'왼쪽으로 가세요',p:'oenjjogeuro gaseyo',e:'Go left'},
    {t:'오른쪽으로 가세요',p:'oreunjjogeuro gaseyo',e:'Go right'},
    {t:'직진하세요',p:'jikjinhaseyo',e:'Go straight'},
    {t:'다 왔어요',p:'da wasseoyo',e:'We’ve arrived'},
    {t:'여권을 보여 주세요',p:'yeogwoneul boyeo juseyo',e:'Please show your passport'},
  ],
  'Transport':[
    {t:'택시를 불러 주세요',p:'taeksireul bulleo juseyo',e:'Please call a taxi'},
    {t:'여기서 내려 주세요',p:'yeogiseo naeryeo juseyo',e:'Please let me off here'},
    {t:'이 버스 시청에 가요?',p:'i beoseu sicheonge gayo?',e:'Does this bus go to City Hall?'},
    {t:'다음 역이 어디예요?',p:'daeum yeogi eodiyeyo?',e:'What is the next station?'},
    {t:'여기로 가 주세요',p:'yeogiro ga juseyo',e:'Please take me here (to a taxi driver)'},
    {t:'환승해야 돼요?',p:'hwanseunghaeya dwaeyo?',e:'Do I need to transfer?'},
    {t:'공항까지 얼마나 걸려요?',p:'gonghangkkaji eolmana geollyeoyo?',e:'How long to the airport?'},
    {t:'막차가 몇 시예요?',p:'makchaga myeot siyeyo?',e:'What time is the last train/bus?'},
    {t:'교통카드 어디서 사요?',p:'gyotongkadeu eodiseo sayo?',e:'Where do I buy a transit card?'},
    {t:'천천히 가 주세요',p:'cheoncheonhi ga juseyo',e:'Please drive slowly'},
  ],
  'Shopping':[
    {t:'이거 얼마예요?',p:'igeo eolmayeyo?',e:'How much is this?'},
    {t:'더 싼 거 있어요?',p:'deo ssan geo isseoyo?',e:'Do you have a cheaper one?'},
    {t:'입어 봐도 돼요?',p:'ibeo bwado dwaeyo?',e:'Can I try it on?'},
    {t:'카드 돼요?',p:'kadeu dwaeyo?',e:'Do you take cards?'},
    {t:'이거 살게요',p:'igeo salgeyo',e:'I’ll buy this'},
    {t:'다른 색 있어요?',p:'dareun saek isseoyo?',e:'Do you have another color?'},
    {t:'다른 사이즈 있어요?',p:'dareun saijeu isseoyo?',e:'Do you have another size?'},
    {t:'좀 깎아 주세요',p:'jom kkakka juseyo',e:'Please give me a discount'},
    {t:'환불하고 싶어요',p:'hwanbulhago sipeoyo',e:'I’d like a refund'},
    {t:'봉투 주세요',p:'bongtu juseyo',e:'A bag, please'},
  ],
  'Social':[
    {t:'이름이 뭐예요?',p:'ireumi mwoyeyo?',e:'What is your name?'},
    {t:'제 이름은 ...예요',p:'je ireumeun ...yeyo',e:'My name is ...'},
    {t:'어느 나라 사람이에요?',p:'eoneu nara saramieyo?',e:'What country are you from?'},
    {t:'저는 미국 사람이에요',p:'jeoneun miguk saramieyo',e:'I am American'},
    {t:'몇 살이에요?',p:'myeot sarieyo?',e:'How old are you?'},
    {t:'취미가 뭐예요?',p:'chwimiga mwoyeyo?',e:'What is your hobby?'},
    {t:'연락처 좀 알려 주세요',p:'yeollakcheo jom allyeo juseyo',e:'Please give me your contact info'},
    {t:'또 만나요',p:'tto mannayo',e:'See you again'},
    {t:'재미있었어요',p:'jaemiisseosseoyo',e:'That was fun'},
    {t:'축하해요',p:'chukhahaeyo',e:'Congratulations'},
  ],
  'Daily Life':[
    {t:'몇 시예요?',p:'myeot siyeyo?',e:'What time is it?'},
    {t:'오늘 무슨 요일이에요?',p:'oneul museun yoirieyo?',e:'What day is it today?'},
    {t:'날씨가 좋아요',p:'nalssiga joayo',e:'The weather is nice'},
    {t:'저는 피곤해요',p:'jeoneun pigonhaeyo',e:'I am tired'},
    {t:'배고파요',p:'baegopayo',e:'I am hungry'},
    {t:'졸려요',p:'jollyeoyo',e:'I am sleepy'},
    {t:'다녀오겠습니다',p:'danyeoogesseumnida',e:'(leaving home) I’m off / see you later'},
    {t:'다녀왔습니다',p:'danyeowatseumnida',e:'(arriving home) I’m back'},
    {t:'수고하셨습니다',p:'sugohasyeotseumnida',e:'Thanks for your hard work'},
    {t:'조심하세요',p:'josimhaseyo',e:'Be careful'},
  ],
  'Work':[
    {t:'회의가 몇 시예요?',p:'hoeuiga myeot siyeyo?',e:'What time is the meeting?'},
    {t:'이메일 보내 드릴게요',p:'imeil bonae deurilgeyo',e:'I’ll send you an email'},
    {t:'오늘까지 끝내야 돼요',p:'oneulkkaji kkeutnaeya dwaeyo',e:'It has to be finished by today'},
    {t:'잠깐 시간 있으세요?',p:'jamkkan sigan isseuseyo?',e:'Do you have a moment?'},
    {t:'제가 확인해 볼게요',p:'jega hwaginhae bolgeyo',e:'I’ll check on it'},
    {t:'죄송하지만 늦을 것 같아요',p:'joesonghajiman neujeul geot gatayo',e:'Sorry, I think I’ll be late'},
    {t:'명함 있으세요?',p:'myeongham isseuseyo?',e:'Do you have a business card?'},
    {t:'오늘 휴가예요',p:'oneul hyugayeyo',e:'I’m on vacation today'},
    {t:'월급날이에요',p:'wolgeupnarieyo',e:'It’s payday'},
    {t:'수고 많으셨어요',p:'sugo manheusyeosseoyo',e:'Great work today'},
  ],
  'Relationships':[
    {t:'사랑해요',p:'saranghaeyo',e:'I love you'},
    {t:'보고 싶어요',p:'bogo sipeoyo',e:'I miss you'},
    {t:'저랑 결혼해 줄래요?',p:'jerang gyeolhonhae jullaeyo?',e:'Will you marry me?'},
    {t:'우리 친구 해요',p:'uri chingu haeyo',e:'Let’s be friends'},
    {t:'저 남자친구 있어요',p:'jeo namjachingu isseoyo',e:'I have a boyfriend'},
    {t:'저 여자친구 있어요',p:'jeo yeojachingu isseoyo',e:'I have a girlfriend'},
    {t:'가족이 몇 명이에요?',p:'gajogi myeot myeongieyo?',e:'How many are in your family?'},
    {t:'저는 형제가 없어요',p:'jeoneun hyeongjega eopseoyo',e:'I don’t have siblings'},
    {t:'화해해요',p:'hwahaehaeyo',e:'Let’s make up'},
    {t:'같이 있어 줘서 고마워요',p:'gachi isseo jwoseo gomawoyo',e:'Thank you for being with me'},
  ],
  'Emergencies & Help':[
    {t:'도와주세요',p:'dowajuseyo',e:'Please help me'},
    {t:'한국어를 잘 못해요',p:'hangugeoreul jal motaeyo',e:'I don’t speak Korean well'},
    {t:'영어 할 수 있어요?',p:'yeongeo hal su isseoyo?',e:'Can you speak English?'},
    {t:'다시 말해 주세요',p:'dasi malhae juseyo',e:'Please say that again'},
    {t:'천천히 말해 주세요',p:'cheoncheonhi malhae juseyo',e:'Please speak slowly'},
    {t:'병원에 가야 돼요',p:'byeongwone gaya dwaeyo',e:'I need to go to the hospital'},
    {t:'무슨 뜻이에요?',p:'museun tteusieyo?',e:'What does that mean?'},
    {t:'경찰을 불러 주세요',p:'gyeongchareul bulleo juseyo',e:'Please call the police'},
    {t:'지갑을 잃어버렸어요',p:'jigabeul ireobeoryeosseoyo',e:'I lost my wallet'},
    {t:'여기가 아파요',p:'yeogiga apayo',e:'It hurts here'},
  ],
};
function renderBank(){renderBankWords();renderPhrasesPicker();}
var bankActiveCat='nouns';
var BANK_CATS=['nouns','verbs','descriptors','feelings','time','modals','questions','conditionals','particles'];
var BANK_CAT_LABEL={nouns:'Nouns',verbs:'Verbs',descriptors:'Descriptors',feelings:'Feelings',time:'Time',modals:'Modals',questions:'Questions',conditionals:'Connectors',particles:'Particles'};
function showBankTab(tab){
  document.getElementById('bank-tab-words').classList.toggle('on',tab==='words');
  document.getElementById('bank-tab-phrases').classList.toggle('on',tab==='phrases');
  document.getElementById('bank-words').style.display=tab==='words'?'':'none';
  document.getElementById('bank-phrases').style.display=tab==='phrases'?'':'none';
}
function renderBankWords(){
  var catsEl=document.getElementById('bank-cats');
  var h='';
  for(var i=0;i<BANK_CATS.length;i++){
    var c=BANK_CATS[i];
    h+='<button class="fbtn cat-'+c+(bankActiveCat===c?' on':'')+'" onclick="setBankCat(\''+c+'\')">'+BANK_CAT_LABEL[c]+'</button>';
  }
  catsEl.innerHTML=h;
  renderBankGrid(MASTER_VOCAB.filter(function(w){return w.cat===bankActiveCat;}));
}
function setBankCat(c){bankActiveCat=c;renderBankWords();}
var _bankShown=[];
function renderBankGrid(list){
  _bankShown=list;
  var grid=document.getElementById('bank-grid');
  var h='<div class="bank-grid">';
  for(var i=0;i<list.length;i++){
    var w=list[i];
    h+='<div class="bank-card" onclick="openWordModal(_bankShown['+i+'])"><div class="bt">'+w.t+'</div><div class="bp">'+w.p+'</div><div class="be">'+w.e+'</div></div>';
  }
  h+='</div>';
  grid.innerHTML=h;
}
function shuffleBank(){renderBankGrid(shuffle(MASTER_VOCAB.filter(function(w){return w.cat===bankActiveCat;})));}
function random10cat(){renderBankGrid(shuffle(MASTER_VOCAB.filter(function(w){return w.cat===bankActiveCat;})).slice(0,10));}
function random10all(){renderBankGrid(shuffle(MASTER_VOCAB).slice(0,10));}
function renderPhrasesPicker(){
  var el=document.getElementById('phrases-cat-list');
  var h='';
  for(var cat in PHRASE_DATA){
    h+='<button class="fc-cat-btn" onclick="openPhraseCat(\''+cat+'\')">'+cat+' <span style="opacity:.5;margin-left:8px;font-size:12px">('+PHRASE_DATA[cat].length+')</span></button>';
  }
  el.innerHTML=h;
}
function openPhraseCat(cat){
  document.getElementById('phrases-picker').style.display='none';
  document.getElementById('phrases-view').style.display='';
  document.getElementById('phrases-cat-title').textContent=cat;
  var list=PHRASE_DATA[cat];
  var h='';
  for(var i=0;i<list.length;i++){
    var p=list[i];
    h+='<div class="bank-card" style="margin-bottom:8px;text-align:left" onclick="speakKorean(\''+p.t.replace(/'/g,"\\'")+'\')"><div class="bt" style="font-size:18px">'+p.t+'</div><div class="bp">'+p.p+'</div><div class="be">'+p.e+'</div></div>';
  }
  document.getElementById('phrases-list').innerHTML=h;
}
function showPhrasesPicker(){
  document.getElementById('phrases-picker').style.display='';
  document.getElementById('phrases-view').style.display='none';
}

/* ============================================================
   GAMES — picker + 5 games
   ============================================================ */
var GAME_LIST=[
  {id:'builder',icon:'🧩',title:'Sentence Builder',desc:'Drag words into the correct Korean order'},
  {id:'opposite',icon:'🃏',title:'Opposite Game',desc:'Tap the opposite meaning'},
  {id:'convo',icon:'🗣',title:'Conversation Fill',desc:'Complete the missing line'},
  {id:'match',icon:'🎯',title:'Word Match',desc:'Match Korean to English against the clock'},
  {id:'flash',icon:'⚡',title:'Flashcard Quiz',desc:'Study any category, 10 at a time'},
];
function renderGamePicker(){
  document.getElementById('game-picker').style.display='';
  ['builder','opposite','convo','match','flash'].forEach(function(id){document.getElementById('game-'+id).style.display='none';});
  var el=document.getElementById('game-list');
  var h='';
  for(var i=0;i<GAME_LIST.length;i++){
    var g=GAME_LIST[i];
    h+='<div class="game-card" onclick="openGame(\''+g.id+'\')"><div class="game-icon">'+g.icon+'</div><div><div class="game-title">'+g.title+'</div><div class="game-desc">'+g.desc+'</div></div></div>';
  }
  el.innerHTML=h;
}
function backToGames(){renderGamePicker();}
function openGame(id){
  document.getElementById('game-picker').style.display='none';
  document.getElementById('game-'+id).style.display='flex';
  if(id==='builder')startBuilder();
  if(id==='opposite')startOpposite();
  if(id==='convo')startConvo();
  if(id==='match')startMatch();
  if(id==='flash'){document.getElementById('flash-picker').style.display='';document.getElementById('flash-quiz').style.display='none';renderFlashCatList();}
}

/* ---------- Opposite Game ---------- */
var OPP_DATA=[
  {a:{t:'커요',p:'keoyo',e:'big'},b:{t:'작아요',p:'jagayo',e:'small'},lv:1},
  {a:{t:'많아요',p:'manayo',e:'many'},b:{t:'적어요',p:'jeogeoyo',e:'few'},lv:1},
  {a:{t:'뜨거워요',p:'tteugeowoyo',e:'hot (to touch)'},b:{t:'차가워요',p:'chagawoyo',e:'cold (to touch)'},lv:1},
  {a:{t:'빨라요',p:'ppallayo',e:'fast'},b:{t:'느려요',p:'neuryeoyo',e:'slow'},lv:1},
  {a:{t:'높아요',p:'nopayo',e:'high'},b:{t:'낮아요',p:'najayo',e:'low'},lv:1},
  {a:{t:'길어요',p:'gireoyo',e:'long'},b:{t:'짧아요',p:'jjalbayo',e:'short'},lv:1},
  {a:{t:'무거워요',p:'mugeowoyo',e:'heavy'},b:{t:'가벼워요',p:'gabyeowoyo',e:'light (weight)'},lv:1},
  {a:{t:'좋아요',p:'joayo',e:'good'},b:{t:'나빠요',p:'nappayo',e:'bad'},lv:1},
  {a:{t:'쉬워요',p:'swiwoyo',e:'easy'},b:{t:'어려워요',p:'eoryeowoyo',e:'difficult'},lv:1},
  {a:{t:'예뻐요',p:'yeppeoyo',e:'pretty'},b:{t:'못생겼어요',p:'motsaenggyeosseoyo',e:'ugly'},lv:2},
  {a:{t:'강해요',p:'ganghaeyo',e:'strong'},b:{t:'약해요',p:'yakhaeyo',e:'weak'},lv:2},
  {a:{t:'부자예요',p:'bujayeyo',e:'rich'},b:{t:'가난해요',p:'gananhaeyo',e:'poor'},lv:2},
  {a:{t:'행복해요',p:'haengbokhaeyo',e:'happy'},b:{t:'슬퍼요',p:'seulpeoyo',e:'sad'},lv:1},
  {a:{t:'매워요',p:'maewoyo',e:'spicy'},b:{t:'싱거워요',p:'singeowoyo',e:'bland'},lv:2},
  {a:{t:'넓어요',p:'neolbeoyo',e:'wide'},b:{t:'좁아요',p:'jobayo',e:'narrow'},lv:2},
  {a:{t:'두꺼워요',p:'dukkeowoyo',e:'thick'},b:{t:'얇아요',p:'yalbayo',e:'thin'},lv:2},
  {a:{t:'깨끗해요',p:'kkaekkeuthaeyo',e:'clean'},b:{t:'더러워요',p:'deoreowoyo',e:'dirty'},lv:2},
  {a:{t:'열어요',p:'yeoreoyo',e:'open'},b:{t:'닫아요',p:'dadayo',e:'close'},lv:2},
  {a:{t:'시작해요',p:'sijakhaeyo',e:'start'},b:{t:'끝나요',p:'kkeutnayo',e:'end'},lv:2},
  {a:{t:'사요',p:'sayo',e:'buy'},b:{t:'팔아요',p:'parayo',e:'sell'},lv:1},
  {a:{t:'줘요',p:'jwoyo',e:'give'},b:{t:'받아요',p:'badayo',e:'receive'},lv:2},
  {a:{t:'앉아요',p:'anjayo',e:'sit'},b:{t:'서요',p:'seoyo',e:'stand'},lv:1},
  {a:{t:'웃어요',p:'useoyo',e:'laugh'},b:{t:'울어요',p:'ureoyo',e:'cry'},lv:1},
  {a:{t:'켜요',p:'kyeoyo',e:'turn on'},b:{t:'꺼요',p:'kkeoyo',e:'turn off'},lv:2},
  {a:{t:'밝아요',p:'balgayo',e:'bright'},b:{t:'어두워요',p:'eoduwoyo',e:'dark'},lv:2},
  {a:{t:'조용해요',p:'joyonghaeyo',e:'quiet'},b:{t:'시끄러워요',p:'sikkeureowoyo',e:'loud'},lv:2},
  {a:{t:'일러요',p:'illeoyo',e:'early'},b:{t:'늦어요',p:'neujeoyo',e:'late'},lv:2},
  {a:{t:'안',p:'an',e:'inside'},b:{t:'밖',p:'bakk',e:'outside'},lv:1},
  {a:{t:'위',p:'wi',e:'up'},b:{t:'아래',p:'arae',e:'down'},lv:1},
  {a:{t:'앞',p:'ap',e:'front'},b:{t:'뒤',p:'dwi',e:'back'},lv:1},
  {a:{t:'왼쪽',p:'oenjjok',e:'left'},b:{t:'오른쪽',p:'oreunjjok',e:'right'},lv:1},
  {a:{t:'남자',p:'namja',e:'man'},b:{t:'여자',p:'yeoja',e:'woman'},lv:1},
  {a:{t:'어른',p:'eoreun',e:'adult'},b:{t:'아이',p:'ai',e:'child'},lv:1},
  {a:{t:'첫 번째',p:'cheot beonjjae',e:'first'},b:{t:'마지막',p:'majimak',e:'last'},lv:2},
  {a:{t:'아침',p:'achim',e:'morning'},b:{t:'저녁',p:'jeonyeok',e:'evening'},lv:1},
  {a:{t:'더워요',p:'deowoyo',e:'hot (weather)'},b:{t:'추워요',p:'chuwoyo',e:'cold (weather)'},lv:1},
  {a:{t:'있어요',p:'isseoyo',e:'have / exists'},b:{t:'없어요',p:'eopseoyo',e:'don’t have / doesn’t exist'},lv:1},
  {a:{t:'알아요',p:'arayo',e:'know'},b:{t:'몰라요',p:'mollayo',e:'don’t know'},lv:2},
  {a:{t:'가벼워요',p:'gabyeowoyo',e:'easy-going / light'},b:{t:'심각해요',p:'simgakhaeyo',e:'serious'},lv:3},
  {a:{t:'새로워요',p:'saeroweoyo',e:'new'},b:{t:'오래됐어요',p:'oraedwaesseoyo',e:'old (things)'},lv:2},
];
var oppQueue=[], oppIdx=0, oppScore=0, oppTotal=0, oppAnswered=false;
function startOpposite(){
  oppQueue=shuffle(OPP_DATA.filter(function(o){return o.lv<=Math.max(1,Math.min(3,currentGLevel||1));}));
  if(oppQueue.length<8)oppQueue=shuffle(OPP_DATA);
  oppIdx=0; oppScore=0; oppTotal=0;
  document.getElementById('opp-lv').textContent='Lv '+(currentGLevel||1);
  renderOppQuestion();
}
function renderOppQuestion(){
  oppAnswered=false;
  var pair=oppQueue[oppIdx%oppQueue.length];
  var showA=Math.random()<0.5;
  var q=showA?pair.a:pair.b, correct=showA?pair.b:pair.a;
  document.getElementById('opp-word').textContent=q.t;
  document.getElementById('opp-phon').textContent=q.p;
  document.getElementById('opp-eng').textContent=q.e;
  var distractors=shuffle(OPP_DATA.filter(function(o){return o!==pair;})).slice(0,3).map(function(o){return Math.random()<0.5?o.a:o.b;});
  var opts=shuffle([correct].concat(distractors));
  var el=document.getElementById('opp-opts'); el.innerHTML='';
  for(var i=0;i<opts.length;i++)(function(o){
    var b=document.createElement('button'); b.className='opp-btn';
    b.innerHTML=o.t+'<span class="opp-phon">'+o.p+'</span>';
    b.onclick=function(){
      if(oppAnswered)return; oppAnswered=true;
      var all=el.querySelectorAll('.opp-btn'); for(var k=0;k<all.length;k++)all[k].disabled=true;
      oppTotal++;
      if(o.t===correct.t){oppScore++;xp+=5;updateXP();b.classList.add('correct');playCorrect();document.getElementById('opp-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';}
      else{b.classList.add('wrong');playWrong();document.getElementById('opp-result').innerHTML='<span style="color:var(--red)">The answer was '+correct.t+'</span>';}
      document.getElementById('opp-next').style.display='block';
    };
    el.appendChild(b);
  })(opts[i]);
  document.getElementById('opp-result').textContent='';
  document.getElementById('opp-next').style.display='none';
  document.getElementById('opp-score').textContent='Score: '+oppScore+' / '+oppTotal;
}
function nextOpposite(){oppIdx++;renderOppQuestion();}

/* ---------- Conversation Fill ---------- */
var CONVO_DATA=[
  {lv:1,lines:[
    {spk:'A',t:'안녕하세요!',p:'annyeonghaseyo!',e:'Hello!'},
    {spk:'B',t:'안녕하세요! 만나서 반가워요.',p:'annyeonghaseyo! mannaseo bangawoyo.',e:'Hello! Nice to meet you.',blank:true},
    {spk:'A',t:'저도 반가워요.',p:'jeodo bangawoyo.',e:'Nice to meet you too.'},
  ],wrong:['어디에 가요?','얼마예요?']},
  {lv:1,lines:[
    {spk:'A',t:'이름이 뭐예요?',p:'ireumi mwoyeyo?',e:'What is your name?'},
    {spk:'B',t:'제 이름은 민수예요.',p:'je ireumeun minsuyeyo.',e:'My name is Minsu.',blank:true},
    {spk:'A',t:'만나서 반가워요, 민수 씨.',p:'mannaseo bangawoyo, minsu ssi.',e:'Nice to meet you, Minsu.'},
  ],wrong:['오늘 바빠요.','저는 학생이 아니에요.']},
  {lv:1,lines:[
    {spk:'A',t:'뭐 먹어요?',p:'mwo meogeoyo?',e:'What are you eating?'},
    {spk:'B',t:'밥을 먹어요.',p:'babeul meogeoyo.',e:'I’m eating rice.',blank:true},
    {spk:'A',t:'맛있어요?',p:'masisseoyo?',e:'Is it good?'},
  ],wrong:['학교에 가요.','책을 읽어요.']},
  {lv:1,lines:[
    {spk:'A',t:'감사합니다!',p:'gamsahamnida!',e:'Thank you!'},
    {spk:'B',t:'천만에요.',p:'cheonmaneyo.',e:'You’re welcome.',blank:true},
  ],wrong:['죄송합니다.','안녕히 가세요.']},
  {lv:1,lines:[
    {spk:'A',t:'어디에 가요?',p:'eodie gayo?',e:'Where are you going?'},
    {spk:'B',t:'학교에 가요.',p:'hakgyoe gayo.',e:'I’m going to school.',blank:true},
  ],wrong:['커피를 마셔요.','저는 학생이에요.']},
  {lv:2,lines:[
    {spk:'A',t:'오늘 뭐 했어요?',p:'oneul mwo haesseoyo?',e:'What did you do today?'},
    {spk:'B',t:'친구를 만났어요.',p:'chingureul mannasseoyo.',e:'I met a friend.',blank:true},
    {spk:'A',t:'재미있었어요?',p:'jaemiisseosseoyo?',e:'Was it fun?'},
  ],wrong:['내일 갈 거예요.','지금 바빠요.']},
  {lv:2,lines:[
    {spk:'A',t:'커피 마시고 싶어요?',p:'keopi masigo sipeoyo?',e:'Do you want to drink coffee?'},
    {spk:'B',t:'네, 좋아요.',p:'ne, joayo.',e:'Yes, sounds good.',blank:true},
  ],wrong:['아니요, 몰라요.','저는 학생이에요.']},
  {lv:2,lines:[
    {spk:'A',t:'배고파요?',p:'baegopayo?',e:'Are you hungry?'},
    {spk:'B',t:'네, 아주 배고파요.',p:'ne, aju baegopayo.',e:'Yes, I’m very hungry.',blank:true},
    {spk:'A',t:'같이 먹으러 가요.',p:'gachi meogeureo gayo.',e:'Let’s go eat together.'},
  ],wrong:['아니요, 피곤해요.','네, 알아요.']},
  {lv:2,lines:[
    {spk:'A',t:'한국어를 할 수 있어요?',p:'hangugeoreul hal su isseoyo?',e:'Can you speak Korean?'},
    {spk:'B',t:'네, 조금 할 수 있어요.',p:'ne, jogeum hal su isseoyo.',e:'Yes, I can speak a little.',blank:true},
  ],wrong:['아니요, 안 가요.','내일 갈 거예요.']},
  {lv:2,lines:[
    {spk:'A',t:'뭐 하고 있어요?',p:'mwo hago isseoyo?',e:'What are you doing?'},
    {spk:'B',t:'책을 읽고 있어요.',p:'chaegeul ilkko isseoyo.',e:'I’m reading a book.',blank:true},
  ],wrong:['어제 갔어요.','내일 만나요.']},
  {lv:3,lines:[
    {spk:'A',t:'이거 얼마예요?',p:'igeo eolmayeyo?',e:'How much is this?'},
    {spk:'B',t:'만 원이에요.',p:'man wonieyo.',e:'It’s 10,000 won.',blank:true},
    {spk:'A',t:'너무 비싸요.',p:'neomu bissayo.',e:'That’s too expensive.'},
  ],wrong:['화장실이 저기예요.','내일 열어요.']},
  {lv:3,lines:[
    {spk:'A',t:'주말에 뭐 할 거예요?',p:'jumare mwo hal geoyeyo?',e:'What will you do this weekend?'},
    {spk:'B',t:'친구 만나러 갈 거예요.',p:'chingu mannareo gal geoyeyo.',e:'I’m going to meet a friend.',blank:true},
  ],wrong:['어제 집에 있었어요.','저는 피곤해요.']},
  {lv:3,lines:[
    {spk:'A',t:'비가 오면 어떻게 해요?',p:'biga omyeon eotteoke haeyo?',e:'What do you do if it rains?'},
    {spk:'B',t:'집에 있어요.',p:'jibe isseoyo.',e:'I stay home.',blank:true},
  ],wrong:['공원에 가요.','친구를 만나요.']},
  {lv:3,lines:[
    {spk:'A',t:'왜 늦었어요?',p:'wae neujeosseoyo?',e:'Why were you late?'},
    {spk:'B',t:'버스가 안 왔어요.',p:'beoseuga an wasseoyo.',e:'The bus didn’t come.',blank:true},
    {spk:'A',t:'아, 괜찮아요.',p:'a, gwaenchanayo.',e:'Oh, it’s okay.'},
  ],wrong:['날씨가 좋았어요.','오늘 바쁘지 않아요.']},
  {lv:3,lines:[
    {spk:'A',t:'이 옷 어때요?',p:'i ot eottaeyo?',e:'How is this outfit?'},
    {spk:'B',t:'예뻐요! 잘 어울려요.',p:'yeppeoyo! jal eoullyeoyo.',e:'It’s pretty! It suits you.',blank:true},
  ],wrong:['너무 비싸요.','저는 몰라요.']},
];
var convoIdx=0, convoScore=0, convoTotal=0, convoAnswered=false;
function startConvo(){
  convoIdx=Math.floor(Math.random()*CONVO_DATA.length); convoScore=0; convoTotal=0;
  renderConvo();
}
function renderConvo(){
  convoAnswered=false;
  var d=CONVO_DATA[convoIdx%CONVO_DATA.length];
  document.getElementById('convo-lv').textContent='Lv '+d.lv;
  var linesEl=document.getElementById('convo-lines');
  var h='', blankLine=null;
  for(var i=0;i<d.lines.length;i++){
    var l=d.lines[i];
    if(l.blank){ blankLine=l; h+='<div class="convo-blank">? ? ?</div>'; }
    else h+='<div class="convo-line"><div class="speaker">'+l.spk+'</div><div class="cthai">'+l.t+'</div><div class="cphon">'+l.p+'</div><div class="ceng">'+l.e+'</div></div>';
  }
  linesEl.innerHTML=h;
  var opts=shuffle([blankLine.t].concat(d.wrong));
  var optsEl=document.getElementById('convo-opts'); optsEl.innerHTML='';
  for(var i=0;i<opts.length;i++)(function(txt){
    var b=document.createElement('button'); b.className='qbtn'; b.textContent=txt;
    b.onclick=function(){
      if(convoAnswered)return; convoAnswered=true; convoTotal++;
      var all=optsEl.querySelectorAll('.qbtn'); for(var k=0;k<all.length;k++)all[k].disabled=true;
      if(txt===blankLine.t){convoScore++;xp+=5;updateXP();b.classList.add('correct');playCorrect();document.getElementById('convo-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';}
      else{b.classList.add('wrong');playWrong();document.getElementById('convo-result').innerHTML='<span style="color:var(--red)">Correct answer: '+blankLine.t+'</span>';}
      document.getElementById('convo-next').style.display='block';
    };
    optsEl.appendChild(b);
  })(opts[i]);
  document.getElementById('convo-result').textContent='';
  document.getElementById('convo-next').style.display='none';
  document.getElementById('convo-score').textContent='Score: '+convoScore+' / '+convoTotal;
}
function nextConvo(){convoIdx=Math.floor(Math.random()*CONVO_DATA.length);renderConvo();}

/* ---------- Sentence Builder ---------- */
var SB_DATA=[
  {lv:1,eng:'I eat rice',words:[{t:'저',p:'jeo'},{t:'는',p:'neun'},{t:'밥',p:'bap'},{t:'을',p:'eul'},{t:'먹어요',p:'meogeoyo'}],distract:[{t:'물',p:'mul'},{t:'가요',p:'gayo'}]},
  {lv:1,eng:'She drinks water',words:[{t:'그녀',p:'geunyeo'},{t:'는',p:'neun'},{t:'물',p:'mul'},{t:'을',p:'eul'},{t:'마셔요',p:'masyeoyo'}],distract:[{t:'책',p:'chaek'},{t:'먹어요',p:'meogeoyo'}]},
  {lv:1,eng:'He reads a book',words:[{t:'그',p:'geu'},{t:'는',p:'neun'},{t:'책',p:'chaek'},{t:'을',p:'eul'},{t:'읽어요',p:'ilgeoyo'}],distract:[{t:'커피',p:'keopi'},{t:'가요',p:'gayo'}]},
  {lv:1,eng:'I go to school',words:[{t:'저',p:'jeo'},{t:'는',p:'neun'},{t:'학교',p:'hakgyo'},{t:'에',p:'e'},{t:'가요',p:'gayo'}],distract:[{t:'집',p:'jip'},{t:'먹어요',p:'meogeoyo'}]},
  {lv:1,eng:'Korean is fun',words:[{t:'한국어',p:'hangugeo'},{t:'는',p:'neun'},{t:'재미있어요',p:'jaemiisseoyo'}],distract:[{t:'어려워요',p:'eoryeowoyo'},{t:'책',p:'chaek'}]},
  {lv:2,eng:'I ate rice yesterday',words:[{t:'어제',p:'eoje'},{t:'저',p:'jeo'},{t:'는',p:'neun'},{t:'밥',p:'bap'},{t:'을',p:'eul'},{t:'먹었어요',p:'meogeosseoyo'}],distract:[{t:'내일',p:'naeil'},{t:'가요',p:'gayo'}]},
  {lv:2,eng:'I want to go to Korea',words:[{t:'저',p:'jeo'},{t:'는',p:'neun'},{t:'한국',p:'hanguk'},{t:'에',p:'e'},{t:'가고',p:'gago'},{t:'싶어요',p:'sipeoyo'}],distract:[{t:'일본',p:'ilbon'},{t:'싫어요',p:'silheoyo'}]},
  {lv:2,eng:'He is watching TV',words:[{t:'그',p:'geu'},{t:'는',p:'neun'},{t:'텔레비전',p:'tellebijeon'},{t:'을',p:'eul'},{t:'보고',p:'bogo'},{t:'있어요',p:'isseoyo'}],distract:[{t:'라디오',p:'radio'},{t:'읽어요',p:'ilgeoyo'}]},
  {lv:2,eng:'The rice is delicious',words:[{t:'밥',p:'bap'},{t:'이',p:'i'},{t:'맛있어요',p:'masisseoyo'}],distract:[{t:'비싸요',p:'bissayo'},{t:'커피',p:'keopi'}]},
  {lv:2,eng:'I can speak Korean',words:[{t:'저',p:'jeo'},{t:'는',p:'neun'},{t:'한국어',p:'hangugeo'},{t:'를',p:'reul'},{t:'할 수 있어요',p:'hal su isseoyo'}],distract:[{t:'영어',p:'yeongeo'},{t:'할 수 없어요',p:'hal su eopseoyo'}]},
  {lv:3,eng:'Please wait',words:[{t:'기다려',p:'gidaryeo'},{t:'주세요',p:'juseyo'}],distract:[{t:'가세요',p:'gaseyo'},{t:'천천히',p:'cheoncheonhi'}]},
  {lv:3,eng:'I eat rice and drink coffee',words:[{t:'밥',p:'bap'},{t:'을',p:'eul'},{t:'먹고',p:'meokgo'},{t:'커피',p:'keopi'},{t:'를',p:'reul'},{t:'마셔요',p:'masyeoyo'}],distract:[{t:'물',p:'mul'},{t:'가요',p:'gayo'}]},
  {lv:3,eng:'If it rains, I stay home',words:[{t:'비',p:'bi'},{t:'가',p:'ga'},{t:'오면',p:'omyeon'},{t:'집',p:'jip'},{t:'에',p:'e'},{t:'있어요',p:'isseoyo'}],distract:[{t:'눈',p:'nun'},{t:'가요',p:'gayo'}]},
  {lv:3,eng:'It is bigger than me',words:[{t:'저',p:'jeo'},{t:'보다',p:'boda'},{t:'커요',p:'keoyo'}],distract:[{t:'작아요',p:'jagayo'},{t:'그',p:'geu'}]},
  {lv:3,eng:'Please don’t worry',words:[{t:'걱정하지',p:'geokjeonghaji'},{t:'마세요',p:'maseyo'}],distract:[{t:'슬퍼요',p:'seulpeoyo'},{t:'주세요',p:'juseyo'}]},
];
var sbIdx=0, sbSlots=[], sbChosen=[], sbCorrect=0, sbTotal=0;
function startBuilder(){sbIdx=Math.floor(Math.random()*SB_DATA.length);sbCorrect=0;sbTotal=0;renderBuilder();}
function renderBuilder(){
  var s=SB_DATA[sbIdx%SB_DATA.length];
  document.getElementById('gb-lv').textContent='Lv '+s.lv;
  document.getElementById('gb-prompt').textContent='Build: "'+s.eng+'"';
  sbChosen=[];
  document.getElementById('gb-slots').innerHTML='';
  var tiles=shuffle(s.words.concat(s.distract));
  var tilesEl=document.getElementById('gb-tiles'); tilesEl.innerHTML='';
  for(var i=0;i<tiles.length;i++)(function(w,idx){
    var el=document.createElement('div'); el.className='tile'; el.innerHTML=w.t+'<div class="tphon">'+w.p+'</div>';
    el.onclick=function(){
      if(el.classList.contains('used'))return;
      el.classList.add('used');
      sbChosen.push({t:w.t,p:w.p,el:el});
      renderSlots();
    };
    tilesEl.appendChild(el);
  })(tiles[i],i);
  document.getElementById('gb-result').textContent='';
  document.getElementById('gb-next').style.display='none';
  document.getElementById('gb-score').textContent='Score: '+sbCorrect+' / '+sbTotal;
}
function renderSlots(){
  var el=document.getElementById('gb-slots'); el.innerHTML='';
  for(var i=0;i<sbChosen.length;i++)(function(c,idx){
    var s=document.createElement('div'); s.className='slot-word'; s.innerHTML=c.t+'<div class="tphon">'+c.p+'</div>';
    s.onclick=function(){ c.el.classList.remove('used'); sbChosen.splice(idx,1); renderSlots(); };
    el.appendChild(s);
  })(sbChosen[i],i);
}
function clearBuilder(){
  for(var i=0;i<sbChosen.length;i++)sbChosen[i].el.classList.remove('used');
  sbChosen=[]; renderSlots();
}
function checkBuilder(){
  var s=SB_DATA[sbIdx%SB_DATA.length];
  var built=sbChosen.map(function(c){return c.t;}).join('');
  var target=s.words.map(function(w){return w.t;}).join('');
  sbTotal++;
  if(built===target){
    sbCorrect++; xp+=10; updateXP(); playCorrect();
    document.getElementById('gb-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';
  } else {
    playWrong();
    document.getElementById('gb-result').innerHTML='<span style="color:var(--red)">Not quite — correct order: '+s.words.map(function(w){return w.t;}).join(' ')+'</span>';
  }
  document.getElementById('gb-score').textContent='Score: '+sbCorrect+' / '+sbTotal;
  document.getElementById('gb-next').style.display='block';
}
function nextBuilder(){sbIdx=Math.floor(Math.random()*SB_DATA.length);renderBuilder();}

/* ---------- Word Match ---------- */
var matchLv=1, matchLeft=[], matchRight=[], matchSel=null, matchFound=0, matchTotal=0, matchTimer=null, matchTimeLeft=30;
function startMatch(){
  matchLv=currentGLevel||1;
  document.getElementById('match-lv').textContent='Lv '+matchLv;
  matchFound=0; matchTimeLeft=30;
  runMatchRound();
}
function runMatchRound(){
  var pool=shuffle(vocabUpTo(matchLv)).slice(0,5);
  matchTotal=pool.length;
  matchLeft=shuffle(pool.map(function(w){return {t:w.t,p:w.p,e:w.e,side:'kr',matched:false};}));
  matchRight=shuffle(pool.map(function(w){return {t:w.t,p:w.p,e:w.e,side:'en',matched:false};}));
  matchSel=null;
  renderMatchGrid();
  clearInterval(matchTimer);
  matchTimer=setInterval(function(){
    matchTimeLeft--; document.getElementById('match-timer').textContent=matchTimeLeft;
    if(matchTimeLeft<=0){clearInterval(matchTimer);document.getElementById('match-result').innerHTML='<span style="color:var(--amber)">Time’s up! Tap Back and try again.</span>';}
  },1000);
}
function renderMatchGrid(){
  var el=document.getElementById('match-grid'); el.innerHTML='';
  var combined=[];
  for(var i=0;i<matchLeft.length;i++)combined.push(matchLeft[i]);
  for(var i=0;i<matchRight.length;i++)combined.push(matchRight[i]);
  for(var i=0;i<combined.length;i++)(function(item){
    var b=document.createElement('button'); b.className='match-btn'; b.setAttribute('data-side',item.side==='kr'?'thai':'eng');
    if(item.matched)b.classList.add('matched');
    b.innerHTML=item.side==='kr'?(item.t+'<div class="match-phon">'+item.p+'</div>'):item.e;
    b.onclick=function(){matchTap(item,b);};
    el.appendChild(b);
  })(combined[i]);
  document.getElementById('match-score').textContent='Matched '+matchFound+' / '+matchTotal;
}
function matchTap(item,btn){
  if(item.matched || matchTimeLeft<=0)return;
  if(!matchSel){ matchSel={item:item,btn:btn}; btn.classList.add('selected'); return; }
  if(matchSel.item===item){ matchSel.btn.classList.remove('selected'); matchSel=null; return; }
  if(matchSel.item.t===item.t){
    matchSel.item.matched=true; item.matched=true; matchFound++;
    xp+=3; updateXP(); playCorrect();
    renderMatchGrid();
    matchSel=null;
    document.getElementById('match-score').textContent='Matched '+matchFound+' / '+matchTotal;
    if(matchFound>=matchTotal){
      clearInterval(matchTimer);
      playLevelUp();
      document.getElementById('match-result').innerHTML='<span style="color:var(--green)">Round complete! ✓</span>';
      setTimeout(function(){ matchTimeLeft=Math.min(30,matchTimeLeft+15); document.getElementById('match-result').textContent=''; runMatchRound(); },1200);
    }
  } else {
    btn.classList.add('wrong-flash'); matchSel.btn.classList.add('wrong-flash'); playWrong();
    var a=matchSel.btn,bb=btn;
    setTimeout(function(){a.classList.remove('wrong-flash','selected');bb.classList.remove('wrong-flash');},350);
    matchSel=null;
  }
}

/* ---------- Flashcard Quiz ---------- */
var flashCat=null, flashQueue=[], flashIdx=0, flashScore=0, flashAnswered=false;
function renderFlashCatList(){
  var el=document.getElementById('flash-cat-list'); var h='';
  for(var i=0;i<BANK_CATS.length;i++){
    var c=BANK_CATS[i];
    h+='<button class="fc-cat-btn cat-'+c+'" onclick="startFlash(\''+c+'\')">'+BANK_CAT_LABEL[c]+'</button>';
  }
  el.innerHTML=h;
}
function startFlash(cat){
  flashCat=cat;
  document.getElementById('flash-picker').style.display='none';
  document.getElementById('flash-quiz').style.display='';
  document.getElementById('flash-cat-name').textContent=BANK_CAT_LABEL[cat];
  newSet();
}
function newSet(){
  var pool=MASTER_VOCAB.filter(function(w){return w.cat===flashCat;});
  flashQueue=shuffle(pool).slice(0,10); flashIdx=0; flashScore=0;
  renderFlashCard();
}
function renderFlashCard(){
  flashAnswered=false;
  document.getElementById('fc-score-lbl').textContent=flashScore+' / 10';
  document.getElementById('fc-bar').style.width=(flashIdx/10*100)+'%';
  var item=flashQueue[flashIdx];
  document.getElementById('fc-word').textContent=item.t;
  document.getElementById('fc-phon').textContent=item.p;
  var pool=MASTER_VOCAB.filter(function(w){return w.e!==item.e;});
  var opts=shuffle([item].concat(shuffle(pool).slice(0,3)));
  var el=document.getElementById('fc-opts'); el.innerHTML='';
  for(var i=0;i<opts.length;i++)(function(o){
    var b=document.createElement('button'); b.className='fc-btn'; b.textContent=o.e;
    b.onclick=function(){
      if(flashAnswered)return; flashAnswered=true;
      var all=el.querySelectorAll('.fc-btn'); for(var k=0;k<all.length;k++)all[k].disabled=true;
      if(o.e===item.e){flashScore++;xp+=4;updateXP();b.classList.add('correct');playCorrect();document.getElementById('fc-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';}
      else{b.classList.add('wrong');playWrong();document.getElementById('fc-result').innerHTML='<span style="color:var(--red)">Answer: '+item.e+'</span>';}
      document.getElementById('fc-next').style.display='block';
    };
    el.appendChild(b);
  })(opts[i]);
  document.getElementById('fc-result').textContent='';
  document.getElementById('fc-next').style.display='none';
}
function nextCard(){
  flashIdx++;
  if(flashIdx>=flashQueue.length){
    document.getElementById('fc-bar').style.width='100%';
    document.getElementById('fc-word').textContent='🎉';
    document.getElementById('fc-phon').textContent='';
    document.getElementById('fc-opts').innerHTML='';
    document.getElementById('fc-result').innerHTML='Set complete — '+flashScore+' / '+flashQueue.length;
    document.getElementById('fc-next').style.display='none';
    return;
  }
  renderFlashCard();
}
function backToPicker(){document.getElementById('flash-picker').style.display='';document.getElementById('flash-quiz').style.display='none';}

/* ============================================================
   GrowKOR — branching sentence builder (SOV, particles baked in)
   Korean descriptive verbs (adjectives) are self-contained
   predicates — no separate copula step is needed, unlike Japanese
   い-adj + です. See §11 of process_langapp.md for language notes.
   ============================================================ */
// ── Pool A: Core / Everyday ──
var grtW=[
{t:'저는',p:'jeoneun',e:'I',s:'subject',lv:1},{t:'그는',p:'geuneun',e:'he',s:'subject',lv:1},
{t:'그녀는',p:'geunyeoneun',e:'she',s:'subject',lv:1},{t:'우리는',p:'urineun',e:'we',s:'subject',lv:1},
{t:'오늘',p:'oneul',e:'today',s:'time',lv:2},{t:'내일',p:'naeil',e:'tomorrow',s:'time',lv:2},
{t:'어제',p:'eoje',e:'yesterday',s:'time',lv:2},{t:'지금',p:'jigeum',e:'now',s:'time',lv:2},
{t:'매일',p:'maeil',e:'every day',s:'time',lv:2},
{t:'밥을',p:'babeul',e:'rice',s:'object',lv:1,c:'fd'},{t:'물을',p:'mureul',e:'water',s:'object',lv:1,c:'bv'},
{t:'생선을',p:'saengseoneul',e:'fish',s:'object',lv:1,c:'fd'},{t:'커피를',p:'keopireul',e:'coffee',s:'object',lv:1,c:'bv'},
{t:'책을',p:'chaegeul',e:'book',s:'object',lv:1,c:'rd'},{t:'텔레비전을',p:'tellebijeoneul',e:'TV',s:'object',lv:1,c:'wt'},
{t:'한국어를',p:'hangugeoreul',e:'Korean',s:'object',lv:2,c:'ln'},{t:'차를',p:'chareul',e:'tea',s:'object',lv:2,c:'bv'},
{t:'고기를',p:'gogireul',e:'meat',s:'object',lv:2,c:'fd'},
{t:'먹어요',p:'meogeoyo',e:'eat',s:'verb',lv:1,va:'fd'},{t:'마셔요',p:'masyeoyo',e:'drink',s:'verb',lv:1,va:'bv'},
{t:'가요',p:'gayo',e:'go',s:'verb',lv:1,vi:true},{t:'와요',p:'wayo',e:'come',s:'verb',lv:1,vi:true},
{t:'봐요',p:'bwayo',e:'watch',s:'verb',lv:1,va:'wt'},{t:'읽어요',p:'ilgeoyo',e:'read',s:'verb',lv:1,va:'rd'},
{t:'자요',p:'jayo',e:'sleep',s:'verb',lv:1,vi:true},{t:'해요',p:'haeyo',e:'do',s:'verb',lv:1},
{t:'말해요',p:'malhaeyo',e:'speak',s:'verb',lv:2,va:'ln'},{t:'사요',p:'sayo',e:'buy',s:'verb',lv:2},
{t:'공부해요',p:'gongbuhaeyo',e:'study',s:'verb',lv:2,va:'ln'},
{t:'안 먹어요',p:'an meogeoyo',e:'not eat',s:'verb',lv:1,va:'fd'},{t:'안 마셔요',p:'an masyeoyo',e:'not drink',s:'verb',lv:1,va:'bv'},
{t:'안 가요',p:'an gayo',e:'not go',s:'verb',lv:2,vi:true},
{t:'맛있어요',p:'masisseoyo',e:'is delicious',s:'adj',lv:1},{t:'새로워요',p:'saeroweoyo',e:'is new',s:'adj',lv:1},
{t:'커요',p:'keoyo',e:'is big',s:'adj',lv:2},{t:'작아요',p:'jagayo',e:'is small',s:'adj',lv:2},
{t:'비싸요',p:'bissayo',e:'is expensive',s:'adj',lv:2},
{t:'아주',p:'aju',e:'very',s:'degree',lv:1},
];
// ── Pool B: School / Study ──
var grtWB=[
{t:'선생님은',p:'seonsaengnimeun',e:'the teacher',s:'subject',lv:1},
{t:'학생은',p:'haksaengeun',e:'the student',s:'subject',lv:1},
{t:'친구는',p:'chinguneun',e:'my friend',s:'subject',lv:1},
{t:'형은',p:'hyeongeun',e:'my older brother',s:'subject',lv:1},
{t:'동생은',p:'dongsaengeun',e:'my younger sibling',s:'subject',lv:1},
{t:'아침에',p:'achime',e:'in the morning',s:'time',lv:2},
{t:'밤에',p:'bame',e:'at night',s:'time',lv:2},
{t:'매일 아침',p:'maeil achim',e:'every morning',s:'time',lv:2},
{t:'매일 밤',p:'maeil bam',e:'every night',s:'time',lv:2},
{t:'숙제를',p:'sukjereul',e:'homework',s:'object',lv:1,c:'rd'},
{t:'영어를',p:'yeongeoreul',e:'English',s:'object',lv:1,c:'ln'},
{t:'공책을',p:'gongchaegeul',e:'a notebook',s:'object',lv:1,c:'rd'},
{t:'시험을',p:'siheomeul',e:'a test',s:'object',lv:2,c:'rd'},
{t:'한자를',p:'hanjareul',e:'hanja',s:'object',lv:2,c:'ln'},
{t:'써요',p:'sseoyo',e:'write',s:'verb',lv:1,va:'rd'},
{t:'읽어요',p:'ilgeoyo',e:'read',s:'verb',lv:1,va:'rd'},
{t:'공부해요',p:'gongbuhaeyo',e:'study',s:'verb',lv:1,va:'ln'},
{t:'가르쳐요',p:'gareuchyeoyo',e:'teach',s:'verb',lv:2,va:'ln'},
{t:'일어나요',p:'ireonayo',e:'wake up',s:'verb',lv:1,vi:true},
{t:'집에 가요',p:'jibe gayo',e:'go home',s:'verb',lv:1,vi:true},
{t:'안 써요',p:'an sseoyo',e:'not write',s:'verb',lv:1,va:'rd'},
{t:'안 읽어요',p:'an ilgeoyo',e:'not read',s:'verb',lv:1,va:'rd'},
{t:'어려워요',p:'eoryeowoyo',e:'is difficult',s:'adj',lv:1},
{t:'쉬워요',p:'swiwoyo',e:'is easy',s:'adj',lv:1},
{t:'재미있어요',p:'jaemiisseoyo',e:'is fun',s:'adj',lv:1},
{t:'흥미로워요',p:'heungmiroweoyo',e:'is interesting',s:'adj',lv:2},
{t:'바빠요',p:'bappayo',e:'is busy',s:'adj',lv:2},
{t:'아주',p:'aju',e:'very',s:'degree',lv:1},
];
// ── Pool C: Food / Restaurant ──
var grtWC=[
{t:'저는',p:'jeoneun',e:'I',s:'subject',lv:1},
{t:'요리사는',p:'yorisaneun',e:'the chef',s:'subject',lv:1},
{t:'어머니는',p:'eomeonineun',e:'my mother',s:'subject',lv:1},
{t:'모두는',p:'moduneun',e:'everyone',s:'subject',lv:2},
{t:'그녀는',p:'geunyeoneun',e:'she',s:'subject',lv:1},
{t:'아침에',p:'achime',e:'in the morning',s:'time',lv:2},
{t:'밤에',p:'bame',e:'at night',s:'time',lv:2},
{t:'매일',p:'maeil',e:'every day',s:'time',lv:2},
{t:'항상',p:'hangsang',e:'always',s:'time',lv:2},
{t:'초밥을',p:'chobabeul',e:'sushi',s:'object',lv:1,c:'fd'},
{t:'라면을',p:'ramyeoneul',e:'ramen',s:'object',lv:1,c:'fd'},
{t:'빵을',p:'ppangeul',e:'bread',s:'object',lv:1,c:'fd'},
{t:'케이크를',p:'keikeureul',e:'cake',s:'object',lv:2,c:'fd'},
{t:'주스를',p:'juseureul',e:'juice',s:'object',lv:1,c:'bv'},
{t:'된장국을',p:'doenjangguk-eul',e:'doenjang soup',s:'object',lv:2,c:'bv'},
{t:'먹어요',p:'meogeoyo',e:'eat',s:'verb',lv:1,va:'fd'},
{t:'마셔요',p:'masyeoyo',e:'drink',s:'verb',lv:1,va:'bv'},
{t:'만들어요',p:'mandeureoyo',e:'make',s:'verb',lv:2,va:'fd'},
{t:'사요',p:'sayo',e:'buy',s:'verb',lv:2},
{t:'가요',p:'gayo',e:'go',s:'verb',lv:1,vi:true},
{t:'안 먹어요',p:'an meogeoyo',e:'not eat',s:'verb',lv:1,va:'fd'},
{t:'안 마셔요',p:'an masyeoyo',e:'not drink',s:'verb',lv:1,va:'bv'},
{t:'재미있어요',p:'jaemiisseoyo',e:'is fun',s:'adj',lv:1},
{t:'바빠요',p:'bappayo',e:'is busy',s:'adj',lv:1},
{t:'훌륭해요',p:'hullyunghaeyo',e:'is wonderful',s:'adj',lv:2},
{t:'커요',p:'keoyo',e:'is big',s:'adj',lv:2},
{t:'아주',p:'aju',e:'very',s:'degree',lv:1},
];
// ── Pool D: Sport / Hobbies ──
var grtWD=[
{t:'저는',p:'jeoneun',e:'I',s:'subject',lv:1},
{t:'그는',p:'geuneun',e:'he',s:'subject',lv:1},
{t:'친구는',p:'chinguneun',e:'my friend',s:'subject',lv:1},
{t:'팀은',p:'timeun',e:'the team',s:'subject',lv:2},
{t:'주말에',p:'jumare',e:'on weekends',s:'time',lv:2},
{t:'매일',p:'maeil',e:'every day',s:'time',lv:2},
{t:'가끔',p:'gakkeum',e:'sometimes',s:'time',lv:2},
{t:'자주',p:'jaju',e:'often',s:'time',lv:2},
{t:'축구를',p:'chukgureul',e:'soccer',s:'object',lv:1,c:'sp'},
{t:'테니스를',p:'teniseureul',e:'tennis',s:'object',lv:1,c:'sp'},
{t:'농구를',p:'nonggureul',e:'basketball',s:'object',lv:2,c:'sp'},
{t:'음악을',p:'eumageul',e:'music',s:'object',lv:1,c:'mu'},
{t:'기타를',p:'gitareul',e:'guitar',s:'object',lv:2,c:'mu'},
{t:'그림을',p:'geurimeul',e:'a picture',s:'object',lv:1,c:'mu'},
{t:'해요',p:'haeyo',e:'play/do',s:'verb',lv:1,va:'sp'},
{t:'쳐요',p:'chyeoyo',e:'play (instrument)',s:'verb',lv:2,va:'mu'},
{t:'그려요',p:'geuryeoyo',e:'draw',s:'verb',lv:1,va:'mu'},
{t:'봐요',p:'bwayo',e:'watch',s:'verb',lv:1,va:'sp'},
{t:'사요',p:'sayo',e:'buy',s:'verb',lv:2},
{t:'뛰어요',p:'ttwieoyo',e:'run',s:'verb',lv:1,vi:true},
{t:'놀아요',p:'norayo',e:'hang out',s:'verb',lv:1,vi:true},
{t:'안 해요',p:'an haeyo',e:'not play',s:'verb',lv:1,va:'sp'},
{t:'재미있어요',p:'jaemiisseoyo',e:'is fun',s:'adj',lv:1},
{t:'빨라요',p:'ppallayo',e:'is fast',s:'adj',lv:1},
{t:'어려워요',p:'eoryeowoyo',e:'is difficult',s:'adj',lv:1},
{t:'대단해요',p:'daedanhaeyo',e:'is amazing',s:'adj',lv:2},
{t:'흥미로워요',p:'heungmiroweoyo',e:'is interesting',s:'adj',lv:2},
{t:'아주',p:'aju',e:'very',s:'degree',lv:1},
];
// ── Pool E: Daily Routine ──
var grtWE=[
{t:'저는',p:'jeoneun',e:'I',s:'subject',lv:1},
{t:'그녀는',p:'geunyeoneun',e:'she',s:'subject',lv:1},
{t:'아버지는',p:'abeojineun',e:'my father',s:'subject',lv:1},
{t:'어머니는',p:'eomeonineun',e:'my mother',s:'subject',lv:1},
{t:'그는',p:'geuneun',e:'he',s:'subject',lv:1},
{t:'아침에',p:'achime',e:'in the morning',s:'time',lv:2},
{t:'밤에',p:'bame',e:'at night',s:'time',lv:2},
{t:'매일 아침',p:'maeil achim',e:'every morning',s:'time',lv:2},
{t:'매일 밤',p:'maeil bam',e:'every night',s:'time',lv:2},
{t:'샤워를',p:'syaworeul',e:'a shower',s:'object',lv:2,c:'ba'},
{t:'커피를',p:'keopireul',e:'coffee',s:'object',lv:1,c:'bv'},
{t:'버스를',p:'beoseureul',e:'the bus',s:'object',lv:1,c:'tr'},
{t:'지하철을',p:'jihacheoreul',e:'the subway',s:'object',lv:2,c:'tr'},
{t:'텔레비전을',p:'tellebijeoneul',e:'TV',s:'object',lv:1,c:'wt'},
{t:'이메일을',p:'imeireul',e:'an email',s:'object',lv:2,c:'rd'},
{t:'해요',p:'haeyo',e:'take (a shower)',s:'verb',lv:2,va:'ba'},
{t:'마셔요',p:'masyeoyo',e:'drink',s:'verb',lv:1,va:'bv'},
{t:'타요',p:'tayo',e:'ride',s:'verb',lv:2,va:'tr'},
{t:'봐요',p:'bwayo',e:'watch',s:'verb',lv:1,va:'wt'},
{t:'읽어요',p:'ilgeoyo',e:'read',s:'verb',lv:1,va:'rd'},
{t:'써요',p:'sseoyo',e:'write',s:'verb',lv:1,va:'rd'},
{t:'일어나요',p:'ireonayo',e:'wake up',s:'verb',lv:1,vi:true},
{t:'자요',p:'jayo',e:'sleep',s:'verb',lv:1,vi:true},
{t:'집에 가요',p:'jibe gayo',e:'go home',s:'verb',lv:1,vi:true},
{t:'안 마셔요',p:'an masyeoyo',e:'not drink',s:'verb',lv:1,va:'bv'},
{t:'바빠요',p:'bappayo',e:'is busy',s:'adj',lv:2},
{t:'재미있어요',p:'jaemiisseoyo',e:'is fun',s:'adj',lv:1},
{t:'빨라요',p:'ppallayo',e:'is fast/early',s:'adj',lv:1},
{t:'길어요',p:'gireoyo',e:'is long',s:'adj',lv:2},
{t:'졸려요',p:'jollyeoyo',e:'is sleepy',s:'adj',lv:1},
{t:'아주',p:'aju',e:'very',s:'degree',lv:1},
];
// ── Pool F: Shopping / Town ──
var grtWF=[
{t:'저는',p:'jeoneun',e:'I',s:'subject',lv:1},
{t:'그는',p:'geuneun',e:'he',s:'subject',lv:1},
{t:'어머니는',p:'eomeonineun',e:'my mother',s:'subject',lv:1},
{t:'모두는',p:'moduneun',e:'everyone',s:'subject',lv:2},
{t:'오늘',p:'oneul',e:'today',s:'time',lv:2},
{t:'내일',p:'naeil',e:'tomorrow',s:'time',lv:2},
{t:'주말에',p:'jumare',e:'on weekends',s:'time',lv:2},
{t:'항상',p:'hangsang',e:'always',s:'time',lv:2},
{t:'과일을',p:'gwaireul',e:'fruit',s:'object',lv:1,c:'fd'},
{t:'야채를',p:'yachaereul',e:'vegetables',s:'object',lv:1,c:'fd'},
{t:'신발을',p:'sinbareul',e:'shoes',s:'object',lv:1,c:'cl'},
{t:'옷을',p:'oseul',e:'clothes',s:'object',lv:1,c:'cl'},
{t:'가방을',p:'gabangeul',e:'a bag',s:'object',lv:2,c:'cl'},
{t:'선물을',p:'seonmureul',e:'a gift',s:'object',lv:2,c:'cl'},
{t:'사요',p:'sayo',e:'buy',s:'verb',lv:1,va:'fd,cl'},
{t:'먹어요',p:'meogeoyo',e:'eat',s:'verb',lv:1,va:'fd'},
{t:'찾아요',p:'chajayo',e:'look for',s:'verb',lv:2,va:'fd,cl'},
{t:'봐요',p:'bwayo',e:'look at',s:'verb',lv:1,va:'cl'},
{t:'가요',p:'gayo',e:'go',s:'verb',lv:1,vi:true},
{t:'집에 가요',p:'jibe gayo',e:'go home',s:'verb',lv:1,vi:true},
{t:'안 사요',p:'an sayo',e:'not buy',s:'verb',lv:1,va:'fd,cl'},
{t:'싸요',p:'ssayo',e:'is cheap',s:'adj',lv:1},
{t:'비싸요',p:'bissayo',e:'is expensive',s:'adj',lv:1},
{t:'예뻐요',p:'yeppeoyo',e:'is pretty',s:'adj',lv:1},
{t:'새로워요',p:'saeroweoyo',e:'is new',s:'adj',lv:1},
{t:'커요',p:'keoyo',e:'is big',s:'adj',lv:2},
{t:'아주',p:'aju',e:'very',s:'degree',lv:1},
];
// ── Pool G: Entertainment / Media ──
var grtWG=[
{t:'저는',p:'jeoneun',e:'I',s:'subject',lv:1},
{t:'친구는',p:'chinguneun',e:'my friend',s:'subject',lv:1},
{t:'그는',p:'geuneun',e:'he',s:'subject',lv:1},
{t:'그녀는',p:'geunyeoneun',e:'she',s:'subject',lv:1},
{t:'모두는',p:'moduneun',e:'everyone',s:'subject',lv:2},
{t:'오늘',p:'oneul',e:'today',s:'time',lv:2},
{t:'주말에',p:'jumare',e:'on weekends',s:'time',lv:2},
{t:'매일 밤',p:'maeil bam',e:'every night',s:'time',lv:2},
{t:'자주',p:'jaju',e:'often',s:'time',lv:2},
{t:'영화를',p:'yeonghwareul',e:'a movie',s:'object',lv:1,c:'wt'},
{t:'드라마를',p:'deuramareul',e:'a drama',s:'object',lv:2,c:'wt'},
{t:'게임을',p:'geimeul',e:'a game',s:'object',lv:1,c:'sp'},
{t:'만화를',p:'manhwareul',e:'manhwa',s:'object',lv:1,c:'rd'},
{t:'사진을',p:'sajineul',e:'photos',s:'object',lv:2,c:'ph'},
{t:'동영상을',p:'dongyeongsangeul',e:'a video',s:'object',lv:2,c:'wt'},
{t:'봐요',p:'bwayo',e:'watch',s:'verb',lv:1,va:'wt'},
{t:'읽어요',p:'ilgeoyo',e:'read',s:'verb',lv:1,va:'rd'},
{t:'해요',p:'haeyo',e:'play',s:'verb',lv:1,va:'sp'},
{t:'찍어요',p:'jjigeoyo',e:'take (photos)',s:'verb',lv:2,va:'ph'},
{t:'사요',p:'sayo',e:'buy',s:'verb',lv:2},
{t:'놀아요',p:'norayo',e:'hang out',s:'verb',lv:1,vi:true},
{t:'안 봐요',p:'an bwayo',e:'not watch',s:'verb',lv:1,va:'wt'},
{t:'재미있어요',p:'jaemiisseoyo',e:'is fun',s:'adj',lv:1},
{t:'무서워요',p:'museowoyo',e:'is scary',s:'adj',lv:2},
{t:'슬퍼요',p:'seulpeoyo',e:'is sad',s:'adj',lv:2},
{t:'훌륭해요',p:'hullyunghaeyo',e:'is wonderful',s:'adj',lv:2},
{t:'아주',p:'aju',e:'very',s:'degree',lv:1},
];
var grtPools=[grtW,grtWB,grtWC,grtWD,grtWE,grtWF,grtWG];
var grtPoolIdx=0,grtPlayCount=0;
function grtActivePool(){return grtPools[grtPoolIdx];}
function grtRotatePool(){grtPoolIdx=(grtPoolIdx+1)%grtPools.length;grtPlayCount++;}
function grtOtherPools(){var o=[];for(var i=0;i<grtPools.length;i++){if(i!==grtPoolIdx)o=o.concat(grtPools[i]);}return o;}
var grtT={
  START:['time','subject'],
  time:['subject'],
  subject:['object','adj','degree','verb'],
  object:['verb'],
  adj:[],
  degree:['adj'],
  verb:[],
};
var grtPatterns=[[3,2,3,3],[2,3,3,2],[3,3,2,3],[3,2,3,2]];
var grtMaxDepth={1:3,2:4,3:5};
var grtLevel=1,grtMode='free',grtGameScore=0,grtGameTotal=0;
var grtChosen=[],grtRows=[],grtShown={},grtLastSlot='START',grtLastWord=null;
var grtPattern=grtPatterns[0];
function grtPickPattern(){grtPattern=grtPatterns[Math.floor(Math.random()*grtPatterns.length)];}
function grtSetLevel(lv){
  if(!isGrowKORLevelUnlocked(lv)){
    var req=GROWKOR_UNLOCK[lv];
    var old=document.getElementById('grt-lock-toast');if(old)old.remove();
    var toast=document.createElement('div');toast.id='grt-lock-toast';
    toast.style.cssText='position:fixed;top:60px;left:50%;transform:translateX(-50%);background:var(--amber);color:#fff;padding:8px 18px;border-radius:20px;font-size:12px;font-weight:700;z-index:10000;font-family:inherit;animation:toastFade 2.1s forwards;pointer-events:none';
    toast.textContent='Language Level '+req+' required';
    toast.addEventListener('animationend',function(){toast.remove();});
    document.body.appendChild(toast);
    return;
  }
  grtLevel=lv;var b=document.querySelectorAll('#grt-lv-select .grt-lv-btn');for(var i=0;i<b.length;i++){if(i+1===lv)b[i].classList.add('on');else b[i].classList.remove('on');}grtReset();
}
function grtSetMode(m){grtMode=m;document.getElementById('grt-mode-free').classList.toggle('on',m==='free');document.getElementById('grt-mode-game').classList.toggle('on',m==='game');document.getElementById('grt-score').classList.toggle('show',m==='game');grtGameScore=0;grtGameTotal=0;grtUpdateScore();grtReset();}
function grtUpdateScore(){document.getElementById('grt-score').textContent=grtGameScore+'/'+grtGameTotal;}
function grtIsComplete(){var s=false,v=false;for(var i=0;i<grtChosen.length;i++){if(grtChosen[i].word.s==='subject')s=true;if(grtChosen[i].word.s==='verb'||grtChosen[i].word.s==='adj')v=true;}return s&&v;}
function grtUsedSlots(){var s={};for(var i=0;i<grtChosen.length;i++)s[grtChosen[i].word.s]=true;return s;}
function grtExpandCats(c){return c.split(',');}
function grtGetCandidates(depth){
  if(depth>=grtMaxDepth[grtLevel])return{good:[],bad:[]};
  var possible=grtT[grtLastSlot]||grtT.START;if(!possible||!possible.length)return{good:[],bad:[]};
  var used=grtUsedSlots();var noR=['time','subject','degree'];
  var filt=possible.filter(function(s){return !(noR.indexOf(s)!==-1&&used[s]);});
  if(!filt.length)filt=possible;
  var _gw=grtActivePool();
  var pool=_gw.filter(function(w){return w.lv<=grtLevel&&filt.indexOf(w.s)!==-1&&!grtShown[w.t];});
  if(!pool.length)pool=_gw.filter(function(w){return w.lv<=grtLevel&&filt.indexOf(w.s)!==-1;});
  if(grtLastWord&&grtLastWord.s==='verb'&&grtLastWord.va){
    var va=grtExpandCats(grtLastWord.va);
    var s=pool.filter(function(w){return w.s!=='object'||(w.c&&va.indexOf(w.c)!==-1);});
    if(s.length)pool=s;
  }
  if(used.object){
    var objCat=null;
    for(var oi=0;oi<grtChosen.length;oi++){if(grtChosen[oi].word.s==='object'){objCat=grtChosen[oi].word.c||null;break;}}
    var sv=pool.filter(function(w){
      if(w.s!=='verb')return true;
      if(w.vi)return false;
      if(objCat&&w.va){var va=grtExpandCats(w.va);return va.indexOf(objCat)!==-1;}
      return true;
    });
    if(sv.length)pool=sv;
  }
  var ct=grtPattern[Math.min(depth,grtPattern.length-1)];var good=shuffle(pool).slice(0,ct);var bad=[];
  if(grtMode==='game'&&depth>0){
    var wc=grtLevel;var _oth=grtOtherPools();
    var wp=_oth.filter(function(w){
      if(w.lv>grtLevel||grtShown[w.t])return false;
      for(var i=0;i<good.length;i++){if(good[i].t===w.t)return false;}
      if(filt.indexOf(w.s)===-1)return false;
      if(w.s==='object'&&grtLastWord&&grtLastWord.s==='verb'&&grtLastWord.va){
        var va=grtExpandCats(grtLastWord.va);
        if(w.c&&va.indexOf(w.c)===-1)return true;
        return false;
      }
      return true;
    });
    bad=shuffle(wp).slice(0,wc);
  }
  return{good:good,bad:bad};
}
var grtGrow,grtSentDisp,grtSentBar;
function grtInitDom(){grtGrow=document.getElementById('grt-grow');grtSentDisp=document.getElementById('grt-sent-display');grtSentBar=document.getElementById('grt-sent-bar');}
function grtRenderSentence(){
  var c=grtIsComplete();
  if(c)grtSentBar.classList.add('complete');else grtSentBar.classList.remove('complete');
  var h='';
  for(var i=0;i<grtChosen.length;i++){var w=grtChosen[i].word;h+='<div class="grt-sent-word"><span class="sw-t">'+w.t+'</span><span class="sw-p">'+w.p+'</span><span class="sw-e">'+w.e+'</span></div>';}
  grtSentDisp.innerHTML=h;
  document.getElementById('grt-badge').textContent=c?'valid sentence':'';
}
function grtCreateNode(word,depth,idx,isWrong){
  var el=document.createElement('div');el.className='grt-node s-'+word.s;el.style.animationDelay=(idx*0.07)+'s';
  el.innerHTML='<div class="nt">'+word.t+'</div><div class="np">'+word.p+'</div><div class="ne">'+word.e+'</div><div class="ns">'+word.s+'</div>';
  el.onclick=isWrong?function(){grtTapWrong(el);}:function(){playTap();speakKorean(word.t);grtTapNode(depth,word,el);};
  return el;
}
function grtShowBranches(depth){
  var r=grtGetCandidates(depth);if(!r.good.length&&!r.bad.length)return;
  var conn=document.createElement('div');conn.className='grt-conn';grtGrow.appendChild(conn);
  var row=document.createElement('div');row.className='grt-depth-row';row.setAttribute('data-depth',depth);
  var rd={depth:depth,nodes:[],savedSlot:grtLastSlot,savedWord:grtLastWord};
  var all=[];for(var i=0;i<r.good.length;i++)all.push({word:r.good[i],wrong:false});for(var i=0;i<r.bad.length;i++)all.push({word:r.bad[i],wrong:true});
  all=shuffle(all);
  for(var i=0;i<all.length;i++){var el=grtCreateNode(all[i].word,depth,i,all[i].wrong);row.appendChild(el);rd.nodes.push({word:all[i].word,el:el,state:'active',wrong:all[i].wrong});grtShown[all[i].word.t]=true;}
  grtGrow.appendChild(row);grtRows.push(rd);
  setTimeout(function(){grtGrow.scrollTop=grtGrow.scrollHeight;},50);
}
function grtTapWrong(el){el.classList.add('wrong','revealed');el.style.pointerEvents='none';playWrong();if(grtMode==='game'){grtGameTotal++;grtUpdateScore();}}
function grtTapNode(depth,word,el){
  var ri=-1;for(var i=0;i<grtRows.length;i++){if(grtRows[i].depth===depth){ri=i;break;}}if(ri===-1)return;
  var row=grtRows[ri];
  for(var i=0;i<row.nodes.length;i++){var n=row.nodes[i];n.el.classList.add('revealed');if(n.word.t===word.t){n.state='chosen';n.el.classList.add('chosen');n.el.classList.remove('faded');}else{n.state='faded';n.el.classList.add('faded');n.el.classList.remove('chosen');}}
  while(grtRows.length>ri+1){var rem=grtRows.pop();var re=grtGrow.querySelector('.grt-depth-row[data-depth="'+rem.depth+'"]');if(re){if(re.previousElementSibling&&re.previousElementSibling.classList.contains('grt-conn'))re.previousElementSibling.remove();re.remove();}for(var j=0;j<rem.nodes.length;j++)delete grtShown[rem.nodes[j].word.t];}
  grtChosen=grtChosen.filter(function(c){return c.depth<depth;});
  grtChosen.push({word:word,depth:depth});grtChosen.sort(function(a,b){return a.depth-b.depth;});
  grtLastSlot=word.s;grtLastWord=word;
  if(grtMode==='game'){grtGameScore++;grtGameTotal++;grtUpdateScore();xp+=5;updateXP();}
  grtRenderSentence();
  if(grtIsComplete()&&grtMode==='game'){xp+=20;updateXP();}
  grtShowBranches(depth+1);
}
function grtUpdateLvButtons(){
  var btns=document.querySelectorAll('#grt-lv-select .grt-lv-btn');
  for(var i=0;i<btns.length;i++){var lv=i+1;var unlocked=isGrowKORLevelUnlocked(lv);btns[i].style.opacity=unlocked?'':'0.4';}
}
function grtReset(){
  grtInitDom();grtChosen=[];grtRows=[];grtShown={};grtLastSlot='START';grtLastWord=null;
  if(grtGrow)grtGrow.innerHTML='';if(grtSentDisp)grtSentDisp.innerHTML='';if(grtSentBar)grtSentBar.classList.remove('complete');
  grtRotatePool();grtPickPattern();grtStart();grtUpdateLvButtons();
}
function grtStart(){
  var _gw=grtActivePool();
  var starters=_gw.filter(function(w){return w.lv<=grtLevel&&(w.s==='subject'||(grtLevel>=2&&w.s==='time'));});
  var ct=grtPattern[0]||3;var picks=shuffle(starters).slice(0,ct);
  var row=document.createElement('div');row.className='grt-depth-row';row.setAttribute('data-depth',0);
  var rd={depth:0,nodes:[],savedSlot:'START',savedWord:null};
  for(var i=0;i<picks.length;i++){var el=grtCreateNode(picks[i],0,i,false);row.appendChild(el);rd.nodes.push({word:picks[i],el:el,state:'active',wrong:false});grtShown[picks[i].t]=true;}
  grtGrow.appendChild(row);grtRows.push(rd);
}

/* ============================================================
   Victory / Failure overlays + Modal + Onboarding + Init
   ============================================================ */
function showVictory(){
  var img=pick(_winImgs);
  document.getElementById('victory-img').style.backgroundImage="url('"+img+"')";
  document.getElementById('victory-overlay').style.display='flex';
  playVictoryFanfare();
}
function closeVictory(){document.getElementById('victory-overlay').style.display='none';}
function showFailure(){
  var img=pick(_loseImgs);
  document.getElementById('failure-img').style.backgroundImage="url('"+img+"')";
  document.getElementById('failure-overlay').style.display='flex';
  playFailBuzz();
}
function closeFailure(){document.getElementById('failure-overlay').style.display='none';}
function closeModal(){document.getElementById('modal-bg').classList.remove('open');}
function openModal(html){document.getElementById('modal-body').innerHTML=html;document.getElementById('modal-bg').classList.add('open');}

/* ---------- Hangul particle helpers (final-consonant / batchim check) ---------- */
function hasBatchim(s){
  var c=s.charCodeAt(s.length-1)-0xAC00;
  if(c<0||c>11171)return false;
  return (c%28)!==0;
}
function topicP(w){return hasBatchim(w)?{t:'은',p:'eun'}:{t:'는',p:'neun'};}
function objP(w){return hasBatchim(w)?{t:'을',p:'eul'}:{t:'를',p:'reul'};}

/* ---------- curated examples for idiomatic words a template can't safely cover ---------- */
var BANK_EXTRA_EXAMPLES={
  '에서':{thai:'학교에서 공부해요',phon:'hakgyoeseo gongbuhaeyo',eng:'I study at school',words:[{t:'학교',p:'hakgyo',e:'school',c:'wc-o'},{t:'에서',p:'eseo',e:'at',c:'wc-p'},{t:'공부해요',p:'gongbuhaeyo',e:'study',c:'wc-v'}]},
  '도':{thai:'저도 가요',phon:'jeodo gayo',eng:'I go too',words:[{t:'저',p:'jeo',e:'I',c:'wc-s'},{t:'도',p:'do',e:'also',c:'wc-p'},{t:'가요',p:'gayo',e:'go',c:'wc-v'}]},
  '만':{thai:'이것만 있어요',phon:'igeotman isseoyo',eng:'I only have this',words:[{t:'이것',p:'igeot',e:'this',c:'wc-o'},{t:'만',p:'man',e:'only',c:'wc-p'},{t:'있어요',p:'isseoyo',e:'have',c:'wc-v'}]},
  '과':{thai:'밥과 물',phon:'bapgwa mul',eng:'rice and water',words:[{t:'밥',p:'bap',e:'rice',c:'wc-o'},{t:'과',p:'gwa',e:'and',c:'wc-p'},{t:'물',p:'mul',e:'water',c:'wc-o'}]},
  '와':{thai:'커피와 차',phon:'keopiwa cha',eng:'coffee and tea',words:[{t:'커피',p:'keopi',e:'coffee',c:'wc-o'},{t:'와',p:'wa',e:'and',c:'wc-p'},{t:'차',p:'cha',e:'tea',c:'wc-o'}]},
  '한테':{thai:'친구한테 말해요',phon:'chinguhante malhaeyo',eng:'I tell my friend',words:[{t:'친구',p:'chingu',e:'friend',c:'wc-o'},{t:'한테',p:'hante',e:'to',c:'wc-p'},{t:'말해요',p:'malhaeyo',e:'tell',c:'wc-v'}]},
  '께':{thai:'선생님께 드려요',phon:'seonsaengnimkke deuryeoyo',eng:'I give it to the teacher (honorific)',words:[{t:'선생님',p:'seonsaengnim',e:'teacher',c:'wc-o'},{t:'께',p:'kke',e:'to (honorific)',c:'wc-p'},{t:'드려요',p:'deuryeoyo',e:'give (honorific)',c:'wc-v'}]},
  '로':{thai:'학교로 가요',phon:'hakgyoro gayo',eng:'I go to school',words:[{t:'학교',p:'hakgyo',e:'school',c:'wc-o'},{t:'로',p:'ro',e:'toward',c:'wc-p'},{t:'가요',p:'gayo',e:'go',c:'wc-v'}]},
  '으로':{thai:'손으로 써요',phon:'soneuro sseoyo',eng:'I write by hand',words:[{t:'손',p:'son',e:'hand',c:'wc-o'},{t:'으로',p:'euro',e:'by',c:'wc-p'},{t:'써요',p:'sseoyo',e:'write',c:'wc-v'}]},
  '까지':{thai:'여기까지 가요',phon:'yeogikkaji gayo',eng:'I go up to here',words:[{t:'여기',p:'yeogi',e:'here',c:'wc-o'},{t:'까지',p:'kkaji',e:'until',c:'wc-p'},{t:'가요',p:'gayo',e:'go',c:'wc-v'}]},
  '누구':{thai:'저 사람은 누구예요?',phon:'jeo sarameun nuguyeyo?',eng:'Who is that person?',words:[{t:'저 사람',p:'jeo saram',e:'that person',c:'wc-s'},{t:'은',p:'eun',e:'(topic)',c:'wc-p'},{t:'누구예요?',p:'nuguyeyo?',e:'who is it?',c:'wc-q'}]},
  '언제':{thai:'언제 가요?',phon:'eonje gayo?',eng:'When are you going?',words:[{t:'언제',p:'eonje',e:'when',c:'wc-q'},{t:'가요?',p:'gayo?',e:'go?',c:'wc-v'}]},
  '왜':{thai:'왜 안 가요?',phon:'wae an gayo?',eng:'Why aren’t you going?',words:[{t:'왜',p:'wae',e:'why',c:'wc-q'},{t:'안',p:'an',e:'not',c:'wc-n'},{t:'가요?',p:'gayo?',e:'go?',c:'wc-v'}]},
  '어떻게':{thai:'어떻게 가요?',phon:'eotteoke gayo?',eng:'How do I get there?',words:[{t:'어떻게',p:'eotteoke',e:'how',c:'wc-q'},{t:'가요?',p:'gayo?',e:'go?',c:'wc-v'}]},
  '얼마나':{thai:'얼마나 걸려요?',phon:'eolmana geollyeoyo?',eng:'How long does it take?',words:[{t:'얼마나',p:'eolmana',e:'how long',c:'wc-q'},{t:'걸려요?',p:'geollyeoyo?',e:'does it take?',c:'wc-v'}]},
  '몇':{thai:'사과 몇 개예요?',phon:'sagwa myeot gaeyeyo?',eng:'How many apples?',words:[{t:'사과',p:'sagwa',e:'apple',c:'wc-o'},{t:'몇',p:'myeot',e:'how many',c:'wc-q'},{t:'개예요?',p:'gaeyeyo?',e:'items?',c:'wc-q'}]},
  '어느':{thai:'어느 나라예요?',phon:'eoneu narayeyo?',eng:'Which country is it?',words:[{t:'어느',p:'eoneu',e:'which',c:'wc-q'},{t:'나라예요?',p:'narayeyo?',e:'country?',c:'wc-q'}]},
  '무엇':{thai:'이것은 무엇입니까?',phon:'igeoseun mueotimnikka?',eng:'What is this? (formal)',words:[{t:'이것',p:'igeot',e:'this',c:'wc-s'},{t:'은',p:'eun',e:'(topic)',c:'wc-p'},{t:'무엇입니까?',p:'mueotimnikka?',e:'what is it?',c:'wc-q'}]},
  '어느 것':{thai:'어느 것이 좋아요?',phon:'eoneu geosi joayo?',eng:'Which one is good?',words:[{t:'어느 것',p:'eoneu geot',e:'which one',c:'wc-q'},{t:'이',p:'i',e:'(subject)',c:'wc-p'},{t:'좋아요?',p:'joayo?',e:'is good?',c:'wc-a'}]},
  '얼마':{thai:'이거 얼마예요?',phon:'igeo eolmayeyo?',eng:'How much is this?',words:[{t:'이거',p:'igeo',e:'this',c:'wc-s'},{t:'얼마예요?',p:'eolmayeyo?',e:'how much?',c:'wc-q'}]},
  '몇 시':{thai:'지금 몇 시예요?',phon:'jigeum myeot siyeyo?',eng:'What time is it now?',words:[{t:'지금',p:'jigeum',e:'now',c:'wc-t'},{t:'몇 시예요?',p:'myeot siyeyo?',e:'what time?',c:'wc-q'}]},
  '며칠':{thai:'오늘 며칠이에요?',phon:'oneul myeochirieyo?',eng:'What’s the date today?',words:[{t:'오늘',p:'oneul',e:'today',c:'wc-t'},{t:'며칠이에요?',p:'myeochirieyo?',e:'what date?',c:'wc-q'}]},
  '얼마 동안':{thai:'얼마 동안 있어요?',phon:'eolma dongan isseoyo?',eng:'How long will you stay?',words:[{t:'얼마 동안',p:'eolma dongan',e:'for how long',c:'wc-q'},{t:'있어요?',p:'isseoyo?',e:'stay?',c:'wc-v'}]},
  '그래서':{thai:'바빠요. 그래서 못 가요.',phon:'bappayo. geuraeseo mot gayo.',eng:'I’m busy. So I can’t go.',words:[{t:'바빠요',p:'bappayo',e:'busy',c:'wc-a'},{t:'그래서',p:'geuraeseo',e:'so',c:'wc-p'},{t:'못 가요',p:'mot gayo',e:'can’t go',c:'wc-n'}]},
  '하지만':{thai:'비싸요. 하지만 사요.',phon:'bissayo. hajiman sayo.',eng:'It’s expensive. But I’ll buy it.',words:[{t:'비싸요',p:'bissayo',e:'expensive',c:'wc-a'},{t:'하지만',p:'hajiman',e:'but',c:'wc-p'},{t:'사요',p:'sayo',e:'buy',c:'wc-v'}]},
  '그리고':{thai:'밥을 먹어요. 그리고 커피를 마셔요.',phon:'babeul meogeoyo. geurigo keopireul masyeoyo.',eng:'I eat rice. And I drink coffee.',words:[{t:'밥을 먹어요',p:'babeul meogeoyo',e:'eat rice',c:'wc-v'},{t:'그리고',p:'geurigo',e:'and',c:'wc-p'},{t:'커피를 마셔요',p:'keopireul masyeoyo',e:'drink coffee',c:'wc-v'}]},
  '왜냐하면':{thai:'안 가요. 왜냐하면 바빠요.',phon:'an gayo. waenyahamyeon bappayo.',eng:'I’m not going. Because I’m busy.',words:[{t:'안 가요',p:'an gayo',e:'not go',c:'wc-n'},{t:'왜냐하면',p:'waenyahamyeon',e:'because',c:'wc-p'},{t:'바빠요',p:'bappayo',e:'busy',c:'wc-a'}]},
  '그런데':{thai:'맛있어요. 그런데 비싸요.',phon:'masisseoyo. geureonde bissayo.',eng:'It’s tasty. However, it’s expensive.',words:[{t:'맛있어요',p:'masisseoyo',e:'tasty',c:'wc-a'},{t:'그런데',p:'geureonde',e:'however',c:'wc-p'},{t:'비싸요',p:'bissayo',e:'expensive',c:'wc-a'}]},
  '따라서':{thai:'시간이 없어요. 따라서 못 가요.',phon:'sigani eopseoyo. ttaraseo mot gayo.',eng:'There’s no time. Therefore I can’t go.',words:[{t:'시간이 없어요',p:'sigani eopseoyo',e:'no time',c:'wc-n'},{t:'따라서',p:'ttaraseo',e:'therefore',c:'wc-p'},{t:'못 가요',p:'mot gayo',e:'can’t go',c:'wc-n'}]},
  '예를 들면':{thai:'과일을 좋아해요. 예를 들면 사과예요.',phon:'gwaireul joahaeyo. yereul deulmyeon sagwayeyo.',eng:'I like fruit. For example, apples.',words:[{t:'과일을 좋아해요',p:'gwaireul joahaeyo',e:'like fruit',c:'wc-v'},{t:'예를 들면',p:'yereul deulmyeon',e:'for example',c:'wc-p'},{t:'사과예요',p:'sagwayeyo',e:'is apples',c:'wc-v'}]},
  '반면에':{thai:'그는 커요. 반면에 저는 작아요.',phon:'geuneun keoyo. banmyeone jeoneun jagayo.',eng:'He is big. On the other hand, I am small.',words:[{t:'그는 커요',p:'geuneun keoyo',e:'he is big',c:'wc-a'},{t:'반면에',p:'banmyeone',e:'on the other hand',c:'wc-p'},{t:'저는 작아요',p:'jeoneun jagayo',e:'I am small',c:'wc-a'}]},
  '만약':{thai:'만약 비가 오면 집에 있어요',phon:'manyak biga omyeon jibe isseoyo',eng:'If it rains, I’ll stay home',words:[{t:'만약',p:'manyak',e:'if',c:'wc-p'},{t:'비가 오면',p:'biga omyeon',e:'if it rains',c:'wc-v'},{t:'집에 있어요',p:'jibe isseoyo',e:'stay home',c:'wc-v'}]},
  '결국':{thai:'결국 집에 갔어요',phon:'gyeolguk jibe gasseoyo',eng:'In the end, I went home',words:[{t:'결국',p:'gyeolguk',e:'in the end',c:'wc-p'},{t:'집에 갔어요',p:'jibe gasseoyo',e:'went home',c:'wc-v'}]},
  '그러면':{thai:'그러면 같이 가요',phon:'geureomyeon gachi gayo',eng:'Then let’s go together',words:[{t:'그러면',p:'geureomyeon',e:'then',c:'wc-p'},{t:'같이 가요',p:'gachi gayo',e:'go together',c:'wc-v'}]},
  '그러나':{thai:'비싸요. 그러나 좋아요.',phon:'bissayo. geureona joayo.',eng:'It’s expensive. But it’s good.',words:[{t:'비싸요',p:'bissayo',e:'expensive',c:'wc-a'},{t:'그러나',p:'geureona',e:'but',c:'wc-p'},{t:'좋아요',p:'joayo',e:'good',c:'wc-a'}]},
  '또는':{thai:'커피 또는 차를 마셔요',phon:'keopi ttoneun chareul masyeoyo',eng:'I drink coffee or tea',words:[{t:'커피',p:'keopi',e:'coffee',c:'wc-o'},{t:'또는',p:'ttoneun',e:'or',c:'wc-p'},{t:'차를 마셔요',p:'chareul masyeoyo',e:'drink tea',c:'wc-v'}]},
  '혹은':{thai:'집 혹은 회사에 있어요',phon:'jip hogeun hoesae isseoyo',eng:'I’m at home or at the office',words:[{t:'집',p:'jip',e:'home',c:'wc-o'},{t:'혹은',p:'hogeun',e:'or else',c:'wc-p'},{t:'회사에 있어요',p:'hoesae isseoyo',e:'at the office',c:'wc-v'}]},
  '게다가':{thai:'맛있어요. 게다가 싸요.',phon:'masisseoyo. gedaga ssayo.',eng:'It’s delicious. Moreover, it’s cheap.',words:[{t:'맛있어요',p:'masisseoyo',e:'delicious',c:'wc-a'},{t:'게다가',p:'gedaga',e:'moreover',c:'wc-p'},{t:'싸요',p:'ssayo',e:'cheap',c:'wc-a'}]},
  '그래도':{thai:'바빠요. 그래도 가요.',phon:'bappayo. geuraedo gayo.',eng:'I’m busy. Even so, I’ll go.',words:[{t:'바빠요',p:'bappayo',e:'busy',c:'wc-a'},{t:'그래도',p:'geuraedo',e:'even so',c:'wc-p'},{t:'가요',p:'gayo',e:'go',c:'wc-v'}]},
  '대신에':{thai:'커피 대신에 차를 마셔요',phon:'keopi daesine chareul masyeoyo',eng:'I drink tea instead of coffee',words:[{t:'커피',p:'keopi',e:'coffee',c:'wc-o'},{t:'대신에',p:'daesine',e:'instead of',c:'wc-p'},{t:'차를 마셔요',p:'chareul masyeoyo',e:'drink tea',c:'wc-v'}]},
  '동안':{thai:'회의 동안 조용히 하세요',phon:'hoeui dongan joyonghi haseyo',eng:'Please be quiet during the meeting',words:[{t:'회의',p:'hoeui',e:'meeting',c:'wc-o'},{t:'동안',p:'dongan',e:'during',c:'wc-p'},{t:'조용히 하세요',p:'joyonghi haseyo',e:'be quiet',c:'wc-v'}]},
};

/* ---------- templated example generator for the remaining categories ---------- */
function genBankExample(v){
  var tp,op;
  switch(v.cat){
    case 'nouns':
      op=objP(v.t);
      return {thai:'저는 '+v.t+op.t+' 좋아해요',phon:'jeoneun '+v.p+' '+op.p+' joahaeyo',eng:'I like '+v.e,
        words:[{t:'저',p:'jeo',e:'I',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:v.t,p:v.p,e:v.e,c:'wc-o'},{t:op.t,p:op.p,e:'(object)',c:'wc-p'},{t:'좋아해요',p:'joahaeyo',e:'like',c:'wc-v'}]};
    case 'verbs':
      return {thai:'저는 '+v.t,phon:'jeoneun '+v.p,eng:'I '+v.e.replace(/^(to )/,''),
        words:[{t:'저',p:'jeo',e:'I',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:v.t,p:v.p,e:v.e,c:'wc-v'}]};
    case 'descriptors':
      return {thai:'이것은 '+v.t,phon:'igeoseun '+v.p,eng:'This is '+v.e,
        words:[{t:'이것',p:'igeot',e:'this',c:'wc-s'},{t:'은',p:'eun',e:'(topic)',c:'wc-p'},{t:v.t,p:v.p,e:v.e,c:'wc-a'}]};
    case 'feelings':
      return {thai:'저는 '+v.t,phon:'jeoneun '+v.p,eng:'I feel '+v.e,
        words:[{t:'저',p:'jeo',e:'I',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:v.t,p:v.p,e:v.e,c:'wc-a'}]};
    case 'modals':
      return {thai:'저는 '+v.t,phon:'jeoneun '+v.p,eng:'I '+v.e,
        words:[{t:'저',p:'jeo',e:'I',c:'wc-s'},{t:'는',p:'neun',e:'(topic)',c:'wc-p'},{t:v.t,p:v.p,e:v.e,c:'wc-v'}]};
    case 'time':
      return {thai:v.t+', 만나요!',phon:v.p+', mannayo!',eng:(v.e.charAt(0).toUpperCase()+v.e.slice(1))+', let’s meet!',
        words:[{t:v.t,p:v.p,e:v.e,c:'wc-t'},{t:'만나요',p:'mannayo',e:'let’s meet',c:'wc-v'}]};
    default: return null;
  }
}

/* ---------- word-tap example-sentence modal ---------- */
function openWordModal(v){
  playTap();
  var found=null;
  for(var i=0;i<grammarLevels.length&&!found;i++){
    var pats=grammarLevels[i].patterns;
    for(var p=0;p<pats.length&&!found;p++){
      var exs=pats[p].examples;
      for(var e=0;e<exs.length&&!found;e++){
        if(exs[e].words.some(function(w){return w.t===v.t;}))found=exs[e];
      }
    }
  }
  if(!found && BANK_EXTRA_EXAMPLES[v.t]){
    found=BANK_EXTRA_EXAMPLES[v.t];
  } else if(!found && v.cat && genBankExample(v)){
    found=genBankExample(v);
  }
  var h='<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">'+
    '<div style="font-size:32px;font-weight:500">'+v.t+'</div>'+
    '<button onclick="speakKorean(\''+v.t.replace(/'/g,"\\'")+'\')" style="background:var(--purple-bg);border:1.5px solid var(--purple-dim);cursor:pointer;padding:6px 12px;border-radius:20px;color:var(--purple);display:flex;align-items:center">'+svgI('speaker',14)+'</button>'+
    '</div>'+
    '<div style="font-size:16px;color:var(--purple);font-weight:600;margin-bottom:2px">'+v.p+'</div>'+
    '<div style="font-size:14px;color:var(--text2);margin-bottom:14px">'+v.e+'</div>';
  if(found){
    h+='<div style="font-size:11px;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">EXAMPLE SENTENCE</div>';
    h+='<div class="card-sm"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'+
       '<div class="s-thai" style="flex:1;margin-bottom:0">'+found.thai+'</div>'+
       '<button onclick="speakKorean(\''+found.thai.replace(/'/g,"\\'")+'\')" style="background:var(--purple-bg);border:1.5px solid var(--purple-dim);cursor:pointer;padding:4px 10px;border-radius:20px;color:var(--purple);flex-shrink:0;display:flex;align-items:center">'+svgI('speaker',14)+'</button></div>'+
       '<div class="s-phon">'+found.phon+'</div><div class="s-eng">'+found.eng+'</div>';
    h+='<div class="word-row">';
    for(var w=0;w<found.words.length;w++){
      var wd=found.words[w];
      h+='<div class="word-chip '+wd.c+'"><div class="wt">'+wd.t+'</div><div class="wp">'+wd.p+'</div><div class="we">'+wd.e+'</div></div>';
    }
    h+='</div></div>';
  } else {
    h+='<div style="font-size:13px;color:var(--text3);padding:8px 0">No example sentence yet</div>';
  }
  openModal(h);
}

var onboardSteps=[
  {title:'환영합니다! (Welcome!)',body:'KoreanLang teaches real, everyday Korean through five progressive levels — grammar, quizzes, games, and a sentence-growing tool called GrowKOR.'},
  {title:'Grammar → Quiz',body:'Each level starts with a grammar lesson. Tap any example to hear it spoken. Then take the 3-part quiz (Translation, Phonetics, Word Match) — score 7/10 in each to unlock the next level.'},
  {title:'GrowKOR & Games',body:'GrowKOR lets you build real Korean sentences branch by branch. The Games tab has five more ways to practice: Sentence Builder, Opposite Game, Conversation Fill, Word Match, and Flashcards.'},
];
var onboardStep=0;
function showOnboarding(){
  onboardStep=0;
  document.getElementById('onboard-overlay').style.display='flex';
  renderOnboardStep();
}
function renderOnboardStep(){
  var s=onboardSteps[onboardStep];
  document.getElementById('onboard-content').innerHTML='<div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:10px">'+s.title+'</div><div style="font-size:14px;color:var(--text2);line-height:1.6">'+s.body+'</div>';
  document.getElementById('onboard-btn').textContent=(onboardStep===onboardSteps.length-1)?'Start learning':'Next';
}
function nextOnboard(){
  onboardStep++;
  if(onboardStep>=onboardSteps.length){
    document.getElementById('onboard-overlay').style.display='none';
    try{localStorage.setItem('koreanlang_onboarded','1');}catch(e){}
    return;
  }
  renderOnboardStep();
}

function initApp(){
  loadState();
  var sm=document.getElementById('splash-mascot');if(sm)sm.src=MASCOT_IMG;
  goTo('home');
  renderGrammarLesson(1);
  try{
    if(!localStorage.getItem('koreanlang_onboarded'))showOnboarding();
  }catch(e){}
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initApp);}else{initApp();}
