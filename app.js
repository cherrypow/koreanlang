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
  if(lv===1)return true;
  return levelPassed(lv-1);
}
var GROWKOR_UNLOCK={1:1,2:2,3:4};
function isGrowKORLevelUnlocked(lv){ return isLevelUnlocked(GROWKOR_UNLOCK[lv]||1); }

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
   HOME + GRAMMAR RENDERING
   ============================================================ */
function levelStatusText(lv){
  if(!isLevelUnlocked(lv))return 'Locked — finish Level '+(lv-1);
  if(levelPassed(lv))return 'Complete';
  var g=grammarViewed[lv]?'Grammar reviewed':'Start with grammar';
  return g;
}
function renderHome(){
  bumpStreak();
  var root=document.getElementById('home-road');
  var h='<div class="home-hero"><h2>한국어 KoreanLang</h2><p>Learn real, everyday Korean — five levels, from greetings to fluent reasoning.</p></div>';
  h+='<div class="stats-row">'+
     '<div class="stat-card"><div class="sv">'+xp+'</div><div class="sl">XP</div></div>'+
     '<div class="stat-card"><div class="sv">'+streak+'🔥</div><div class="sl">Day streak</div></div>'+
     '<div class="stat-card"><div class="sv">'+countLevelsPassed()+'/5</div><div class="sl">Levels done</div></div>'+
     '</div>';
  h+='<div class="section-title">Levels</div>';
  for(var i=0;i<grammarLevels.length;i++){
    var lv=grammarLevels[i];
    var unlocked=isLevelUnlocked(lv.level);
    var passed=levelPassed(lv.level);
    h+='<div class="level-card" style="'+(unlocked?'':'opacity:.45')+'" onclick="'+(unlocked?"openLevel("+lv.level+")":"")+'">'+
       '<div class="lc-icon">'+(unlocked?lv.icon:'🔒')+'</div>'+
       '<div class="lc-body"><div class="lc-title">Level '+lv.level+' — '+lv.label+'</div>'+
       '<div class="lc-sub">'+lv.subtitle+'</div>'+
       '<div class="progress-row"><div class="prog-bar"><div class="prog-fill" style="width:'+(passed?100:(grammarViewed[lv.level]?40:0))+'%;background:var(--'+(passed?'green':'purple')+')"></div></div>'+
       '<div style="font-size:11px;color:var(--text3)">'+levelStatusText(lv.level)+'</div></div>'+
       '</div></div>';
  }
  h+='<div class="section-title" style="margin-top:6px">Quick links</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">'+
     '<button class="home-sec-btn" onclick="goTo(\'games\')"><div class="home-sec-icon">🎮</div><div class="home-sec-label" style="color:#333">Games</div></button>'+
     '<button class="home-sec-btn" onclick="goTo(\'growkor\')"><div class="home-sec-icon">🌱</div><div class="home-sec-label" style="color:#333">GrowKOR</div></button>'+
     '<button class="home-sec-btn" onclick="goTo(\'bank\')"><div class="home-sec-icon">📚</div><div class="home-sec-label" style="color:#333">Library</div></button>'+
     '</div>';
  root.innerHTML=h;
  document.getElementById('sec-home').style.visibility='visible';
  var splash=document.getElementById('splash-screen');
  if(splash){splash.style.opacity='0';setTimeout(function(){splash.style.display='none';},650);}
}
function countLevelsPassed(){var c=0;for(var i=1;i<=5;i++)if(levelPassed(i))c++;return c;}
var currentGLevel=1;
function openLevel(lv){currentGLevel=lv;goTo('grammar');renderGrammarLesson(lv);}
function renderGrammarHome(){renderGrammarLesson(currentGLevel);}
function renderGrammarLesson(lv){
  currentGLevel=lv;
  grammarViewed[lv]=true; saveState();
  var L=null;for(var i=0;i<grammarLevels.length;i++)if(grammarLevels[i].level===lv)L=grammarLevels[i];
  if(!L)return;
  var root=document.getElementById('grammar-content');
  var h='<div class="level-tabs">';
  for(var i=0;i<grammarLevels.length;i++){
    var g=grammarLevels[i];
    var unlocked=isLevelUnlocked(g.level);
    h+='<button class="ltab lv'+g.level+(g.level===lv?' on':'')+'" '+(unlocked?"onclick=\"renderGrammarLesson("+g.level+")\"":'style="opacity:.4"')+'>'+g.icon+' Lv'+g.level+'</button>';
  }
  h+='</div>';
  h+='<div class="level-badge lv'+lv+'">'+L.icon+' Level '+lv+' — '+L.label+'</div>';
  h+='<div class="card"><div style="font-size:13px;color:var(--text2);line-height:1.6">'+L.desc+'</div></div>';
  for(var p=0;p<L.patterns.length;p++){
    var pat=L.patterns[p];
    h+='<div class="card"><div class="pat-title">'+pat.title+'</div><div class="pat-rule">'+pat.rule+'</div>';
    for(var e=0;e<pat.examples.length;e++){
      var ex=pat.examples[e];
      h+='<div class="card-sm" style="cursor:pointer" onclick="speakKorean(\''+ex.thai.replace(/'/g,"\\'")+'\')">';
      h+='<div class="s-thai">'+ex.thai+'</div><div class="s-phon">'+ex.phon+'</div><div class="s-eng">'+ex.eng+'</div>';
      h+='<div class="word-row">';
      for(var w=0;w<ex.words.length;w++){
        var wd=ex.words[w];
        h+='<div class="word-chip '+wd.c+'"><div class="wt">'+wd.t+'</div><div class="wp">'+wd.p+'</div><div class="we">'+wd.e+'</div></div>';
      }
      h+='</div></div>';
    }
    h+='</div>';
  }
  h+='<button class="q-next-btn" onclick="goTo(\'quiz\');startQuiz('+lv+')" style="margin-top:6px">Take the Level '+lv+' quiz →</button>';
  root.innerHTML=h;
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
    btn.classList.add('correct');
    document.getElementById('q-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';
  } else {
    btn.classList.add('wrong');
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
  if(passed && quizScore===10){showVictory();} else if(!passed){/* no failure overlay for quiz, keep it light */}
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
  ],
  'Dining':[
    {t:'메뉴판 주세요',p:'menyupan juseyo',e:'The menu, please'},
    {t:'이거 주세요',p:'igeo juseyo',e:'I’ll have this, please'},
    {t:'잘 먹겠습니다',p:'jal meokgesseumnida',e:'(said before eating) I will eat well'},
    {t:'잘 먹었습니다',p:'jal meogeotseumnida',e:'(said after eating) I ate well'},
    {t:'맛있어요',p:'masisseoyo',e:'It’s delicious'},
    {t:'계산서 주세요',p:'gyesanseo juseyo',e:'The check, please'},
    {t:'물 좀 주세요',p:'mul jom juseyo',e:'Water, please'},
    {t:'하나 더 주세요',p:'hana deo juseyo',e:'One more, please'},
  ],
  'Getting around':[
    {t:'화장실이 어디예요?',p:'hwajangsiri eodiyeyo?',e:'Where is the bathroom?'},
    {t:'여기가 어디예요?',p:'yeogiga eodiyeyo?',e:'Where am I?'},
    {t:'이 버스 시청에 가요?',p:'i beoseu sicheonge gayo?',e:'Does this bus go to City Hall?'},
    {t:'얼마예요?',p:'eolmayeyo?',e:'How much is it?'},
    {t:'택시를 불러 주세요',p:'taeksireul bulleo juseyo',e:'Please call a taxi'},
    {t:'여기서 내려 주세요',p:'yeogiseo naeryeo juseyo',e:'Please let me off here'},
    {t:'길을 잃었어요',p:'gireul ireosseoyo',e:'I’m lost'},
  ],
  'Shopping':[
    {t:'이거 얼마예요?',p:'igeo eolmayeyo?',e:'How much is this?'},
    {t:'더 싼 거 있어요?',p:'deo ssan geo isseoyo?',e:'Do you have a cheaper one?'},
    {t:'입어 봐도 돼요?',p:'ibeo bwado dwaeyo?',e:'Can I try it on?'},
    {t:'카드 돼요?',p:'kadeu dwaeyo?',e:'Do you take cards?'},
    {t:'이거 살게요',p:'igeo salgeyo',e:'I’ll buy this'},
    {t:'다른 색 있어요?',p:'dareun saek isseoyo?',e:'Do you have another color?'},
  ],
  'Emergencies & help':[
    {t:'도와주세요',p:'dowajuseyo',e:'Please help me'},
    {t:'한국어를 잘 못해요',p:'hangugeoreul jal motaeyo',e:'I don’t speak Korean well'},
    {t:'영어 할 수 있어요?',p:'yeongeo hal su isseoyo?',e:'Can you speak English?'},
    {t:'다시 말해 주세요',p:'dasi malhae juseyo',e:'Please say that again'},
    {t:'천천히 말해 주세요',p:'cheoncheonhi malhae juseyo',e:'Please speak slowly'},
    {t:'병원에 가야 돼요',p:'byeongwone gaya dwaeyo',e:'I need to go to the hospital'},
    {t:'무슨 뜻이에요?',p:'museun tteusieyo?',e:'What does that mean?'},
  ],
};
function renderBank(){renderBankWords();renderPhrasesPicker();}
var bankActiveCat='nouns';
var BANK_CATS=['nouns','verbs','descriptors','feelings','time','modals','questions','conditionals'];
var BANK_CAT_LABEL={nouns:'Nouns',verbs:'Verbs',descriptors:'Descriptors',feelings:'Feelings',time:'Time',modals:'Modals',questions:'Questions',conditionals:'Connectors'};
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
function renderBankGrid(list){
  var grid=document.getElementById('bank-grid');
  var h='<div class="bank-grid">';
  for(var i=0;i<list.length;i++){
    var w=list[i];
    h+='<div class="bank-card" onclick="speakKorean(\''+w.t.replace(/'/g,"\\'")+'\')"><div class="bt">'+w.t+'</div><div class="bp">'+w.p+'</div><div class="be">'+w.e+'</div></div>';
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
      if(o.t===correct.t){oppScore++;xp+=5;updateXP();b.classList.add('correct');document.getElementById('opp-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';}
      else{b.classList.add('wrong');document.getElementById('opp-result').innerHTML='<span style="color:var(--red)">The answer was '+correct.t+'</span>';}
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
      if(txt===blankLine.t){convoScore++;xp+=5;updateXP();b.classList.add('correct');document.getElementById('convo-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';}
      else{b.classList.add('wrong');document.getElementById('convo-result').innerHTML='<span style="color:var(--red)">Correct answer: '+blankLine.t+'</span>';}
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
    sbCorrect++; xp+=10; updateXP();
    document.getElementById('gb-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';
  } else {
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
    xp+=3; updateXP();
    renderMatchGrid();
    matchSel=null;
    document.getElementById('match-score').textContent='Matched '+matchFound+' / '+matchTotal;
    if(matchFound>=matchTotal){
      clearInterval(matchTimer);
      document.getElementById('match-result').innerHTML='<span style="color:var(--green)">Round complete! ✓</span>';
      setTimeout(function(){ matchTimeLeft=Math.min(30,matchTimeLeft+15); document.getElementById('match-result').textContent=''; runMatchRound(); },1200);
    }
  } else {
    btn.classList.add('wrong-flash'); matchSel.btn.classList.add('wrong-flash');
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
      if(o.e===item.e){flashScore++;xp+=4;updateXP();b.classList.add('correct');document.getElementById('fc-result').innerHTML='<span style="color:var(--green)">Correct! ✓</span>';}
      else{b.classList.add('wrong');document.getElementById('fc-result').innerHTML='<span style="color:var(--red)">Answer: '+item.e+'</span>';}
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
  el.onclick=isWrong?function(){grtTapWrong(el);}:function(){speakKorean(word.t);grtTapNode(depth,word,el);};
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
function grtTapWrong(el){el.classList.add('wrong','revealed');el.style.pointerEvents='none';if(grtMode==='game'){grtGameTotal++;grtUpdateScore();}}
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
}
function closeVictory(){document.getElementById('victory-overlay').style.display='none';}
function showFailure(){
  var img=pick(_loseImgs);
  document.getElementById('failure-img').style.backgroundImage="url('"+img+"')";
  document.getElementById('failure-overlay').style.display='flex';
}
function closeFailure(){document.getElementById('failure-overlay').style.display='none';}
function closeModal(){document.getElementById('modal-bg').classList.remove('open');}
function openModal(html){document.getElementById('modal-body').innerHTML=html;document.getElementById('modal-bg').classList.add('open');}

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
  goTo('home');
  renderGrammarLesson(1);
  try{
    if(!localStorage.getItem('koreanlang_onboarded'))showOnboarding();
  }catch(e){}
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initApp);}else{initApp();}
