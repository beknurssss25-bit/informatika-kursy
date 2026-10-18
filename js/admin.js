(function(){'use strict';
var $=function(i){return document.getElementById(i)};
function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e}

/* ---------- SHA-256 (small pure-JS implementation, works without a secure context) ---------- */
function sha256(str){
 function rr(n,x){return(x>>>n)|(x<<(32-n))}
 var K=[],H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],p=2,c=0,i,j;
 for(;c<64;p++){for(i=2;i<=p/2&&p%i;i++);if(i>p/2){K[c]=(Math.pow(p,1/3)*4294967296)|0;if(c<8)H[c]=(Math.pow(p,.5)*4294967296)|0;c++}}
 var b=unescape(encodeURIComponent(str)),l=b.length,w=[],nw=(((l+8)>>6)+1)*16;
 for(i=0;i<nw;i++)w[i]=0;
 for(i=0;i<l;i++)w[i>>2]|=b.charCodeAt(i)<<(24-(i%4)*8);
 w[l>>2]|=128<<(24-(l%4)*8);w[(((l+8)>>6)+1)*16-1]=l*8;
 for(j=0;j<w.length;j+=16){var W=w.slice(j,j+16),h=H.slice(0),a;
  for(i=0;i<64;i++){var w15=W[i-15],w2=W[i-2];
   if(i>=16)W[i]=(W[i-16]+(rr(7,w15)^rr(18,w15)^(w15>>>3))+W[i-7]+(rr(17,w2)^rr(19,w2)^(w2>>>10)))|0;
   var t1=(h[7]+(rr(6,h[4])^rr(11,h[4])^rr(25,h[4]))+((h[4]&h[5])^(~h[4]&h[6]))+K[i]+W[i])|0,
       t2=((rr(2,h[0])^rr(13,h[0])^rr(22,h[0]))+((h[0]&h[1])^(h[0]&h[2])^(h[1]&h[2])))|0;
   h=[(t1+t2)|0,h[0],h[1],h[2],(h[3]+t1)|0,h[4],h[5],h[6]]}
  for(i=0;i<8;i++)H[i]=(H[i]+h[i])|0}
 var o='';for(i=0;i<8;i++)for(j=3;j>=0;j--){a=(H[i]>>(j*8))&255;o+=(a<16?'0':'')+a.toString(16)}return o}
function pinHash(pin){return sha256('ik-admin:'+pin)}
window.adminHash=pinHash;

/* ---------- PIN (light, client-side protection) ---------- */
/* Built-in PIN hash = sha256('ik-admin:'+PIN). Initial PIN 2580. A changed PIN is stored (as a hash) in the shared store, see Pin below. */
var PIN_HASH='43ca8963425078a134cf7b463c2a03e81fd67335f7b8db506d5564dbeca1a363';

/* ---------- Config: MUST match js/app.js ---------- */
var CFG={api:'https://keyvalue.immanuel.co/api/KeyVal',appKey:'10y0bwsv',prefix:'d',
 hours:[10,11,12,13,14,15,16,17,18,19],days:30,minNoticeMin:60,tzOffsetH:5};
/* Owner entries in the shared store use tok 'adm' and plan: 'student' (manually occupied by a student) or a "no lessons" code:
   'busy' (teacher busy), 'off' (day off), 'blocked' (other; also what older admin versions wrote). Serialised e.g. "12-adm-busy".
   The public calendar treats ANY entry for an hour as busy. Names/phones/notes are NOT stored here (see Labels, localStorage only). */
var OWN='adm',REASONS={busy:'Учитель занят',off:'Выходной',blocked:'Другое'};
var PLANS={1:'1 месяц',2:'2 месяца',5:'5 месяцев'};
var MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
var MON3=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
var DOW=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

/* ---------- Time helpers (same as app.js) ---------- */
function almatyNow(){return new Date(Date.now()+CFG.tzOffsetH*3600e3)}
function pad(n){return n<10?'0'+n:''+n}
function dkey(d){return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())}
function dayStart(d){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()))}
function addDays(d,n){return new Date(d.getTime()+n*864e5)}
function human(d){return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]+' ('+['вс','пн','вт','ср','чт','пт','сб'][d.getUTCDay()]+')'}
function isPast(d,h){var n=almatyNow();if(dkey(d)!==dkey(n))return d<dayStart(n);return h*60<n.getUTCHours()*60+n.getUTCMinutes()+CFG.minNoticeMin}
function ended(d,h){var n=almatyNow();if(dkey(d)!==dkey(n))return d<dayStart(n);return (h+1)*60<=n.getUTCHours()*60+n.getUTCMinutes()}

/* ---------- Storage: identical format & calls as app.js (Remote.read / Remote.write) ---------- */
function parse(v){var m={};if(typeof v!=='string'||v==='-'||!v)return m;v.split('_').forEach(function(x){var p=x.split('-');if(p.length>=2&&/^\d+$/.test(p[0])&&/^[a-z0-9]+$/.test(p[1]))m[+p[0]]={tok:p[1],plan:p[2]||''}});return m}
function ser(m){var o=Object.keys(m).sort(function(a,b){return a-b}).map(function(h){return h+'-'+m[h].tok+'-'+(m[h].plan||'')});return o.length?o.join('_'):'-'}
function timed(url,opt,ms){var c=window.AbortController?new AbortController():null,t=setTimeout(function(){c&&c.abort()},ms||9000);opt=opt||{};if(c)opt.signal=c.signal;opt.cache='no-store';
 return fetch(url,opt).then(function(r){clearTimeout(t);if(!r.ok)throw new Error('http '+r.status);return r},function(e){clearTimeout(t);throw e})}
var Remote={
 read:function(key){return timed(CFG.api+'/GetValue/'+CFG.appKey+'/'+CFG.prefix+key).then(function(r){return r.json()}).then(function(v){return parse(v)})},
 write:function(key,map){return timed(CFG.api+'/UpdateValue/'+CFG.appKey+'/'+CFG.prefix+key+'/'+encodeURIComponent(ser(map)),{method:'POST'}).then(function(r){return r.text()})}};
function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
function isOwn(e){return !!e&&e.tok===OWN}
function isStudent(e){return isOwn(e)&&e.plan==='student'}
function isBlock(e){return isOwn(e)&&!!REASONS[e.plan]}      /* owner "no lessons" entry */
/* Labels (name/phone/note/reason text) live ONLY in this browser's localStorage, keyed by day+hour; never sent to the store. */
var Lab={all:function(){try{return JSON.parse(localStorage.getItem('ik-adm-labels')||'{}')}catch(e){return {}}},
 get:function(k,h,e){var l=(this.all()[k]||{})[h];return l&&e&&l.plan===e.plan?l:null},
 set:function(k,h,o){var a=this.all();(a[k]=a[k]||{})[h]=o;this.save(a)},
 del:function(k,h){var a=this.all();if(a[k]){delete a[k][h];if(!Object.keys(a[k]).length)delete a[k]}this.save(a)},
 save:function(a){try{localStorage.setItem('ik-adm-labels',JSON.stringify(a))}catch(e){}}};

/* Race-safe mutation, same approach as app.js book(): read fresh -> apply change to the fresh map -> write whole day ->
   re-read after a short random delay (twice) and make sure the change is still there; if another writer overwrote it,
   retry from a fresh read (max 3 retries). fn(map) returns {map} to write, {skip:true} if nothing to do, or {abort:'reason'}.
   check(map) says whether the desired state is present. Writes are serialised through a queue. */
var queue=Promise.resolve();
function mutate(k,fn,check){var job=queue.then(function(){return run(k,fn,check)});queue=job.then(function(){},function(){});return job}
function run(k,fn,check){var attempt=0;
 function go(){return Remote.read(k).then(function(fresh){var m={},x;for(x in fresh)m[x]=fresh[x];var r=fn(m);
  if(r.abort)return {ok:false,reason:r.abort,map:fresh};if(r.skip)return {ok:true,map:fresh};
  return Remote.write(k,r.map).then(function(){return verify(0)})})}
 function verify(n){return wait(650+Math.random()*450).then(function(){return Remote.read(k)}).then(function(v){
  if(check(v))return n>=1?{ok:true,map:v}:verify(n+1);
  if(++attempt>3)throw new Error('lost');return go()})}
 return go()}

/* ---------- State ---------- */
var today=dayStart(almatyNow()),last=addDays(today,CFG.days);
var state={days:{},sel:null,remoteOk:true,busy:0};
function bookable(d){return d.getUTCDay()!==0&&d>=today&&d<=last}
function slotInfo(d,h){var m=state.days[dkey(d)];if(!m)return 'unknown';var e=m[h];
 if(e)return isBlock(e)?'closed':isStudent(e)?'student':'booked';return isPast(d,h)?'past':'free'}
function counts(d){var m=state.days[dkey(d)];if(!m)return null;var c={free:0,booked:0,closed:0};CFG.hours.forEach(function(h){var s=slotInfo(d,h);if(s==='student')s='booked';if(c[s]!=null)c[s]++});return c}

/* ---------- Gate ---------- */
var Pin={
 cacheKey:'ik-adm-pin',key:'pin',
 /* stored value: "v1.<first 8 of built-in hash>.<hash of changed PIN>"; ignored if the built-in hash was changed in the code (reset) */
 tag:function(){return 'v1.'+PIN_HASH.slice(0,8)+'.'},
 fetchHash:function(){var self=this;
  return timed(CFG.api+'/GetValue/'+CFG.appKey+'/'+CFG.prefix+self.key,null,7000).then(function(r){return r.json()}).then(function(v){
   var h=PIN_HASH;if(typeof v==='string'&&v.indexOf(self.tag())===0&&/^[0-9a-f]{64}$/.test(v.slice(self.tag().length)))h=v.slice(self.tag().length);
   try{localStorage.setItem(self.cacheKey,JSON.stringify({t:self.tag(),h:h}))}catch(e){}return h},
  function(){try{var c=JSON.parse(localStorage.getItem(self.cacheKey)||'null');if(c&&c.t===self.tag()&&/^[0-9a-f]{64}$/.test(c.h))return c.h}catch(e){}return PIN_HASH})},
 save:function(h){var self=this;return timed(CFG.api+'/UpdateValue/'+CFG.appKey+'/'+CFG.prefix+self.key+'/'+encodeURIComponent(self.tag()+h),{method:'POST'}).then(function(){return wait(700)}).then(function(){
  return timed(CFG.api+'/GetValue/'+CFG.appKey+'/'+CFG.prefix+self.key).then(function(r){return r.json()})}).then(function(v){
  if(v!==self.tag()+h)throw new Error('not saved');try{localStorage.setItem(self.cacheKey,JSON.stringify({t:self.tag(),h:h}))}catch(e){}})}
};
var LK={get:function(){try{return JSON.parse(localStorage.getItem('ik-adm-fail')||'{"n":0,"until":0}')}catch(e){return{n:0,until:0}}},set:function(v){try{localStorage.setItem('ik-adm-fail',JSON.stringify(v))}catch(e){}}};
function showMsg(id,t,cls){var e=$(id);e.hidden=!t;e.textContent=t||'';if(cls)e.className='msg '+cls}
function enter(){$('gate').hidden=true;$('app').hidden=false;if(!state.started)start()}
function lock(){try{sessionStorage.removeItem('ik-adm-ok')}catch(e){}$('app').hidden=true;$('gate').hidden=false;$('pin').value='';state.started=false;clearInterval(state.timer)}
$('pinForm').addEventListener('submit',function(ev){ev.preventDefault();var lk=LK.get(),now=Date.now();
 if(lk.until>now){showMsg('pinErr','Слишком много попыток. Подождите '+Math.ceil((lk.until-now)/1000)+' с.','err');return}
 var h=pinHash($('pin').value);$('pinGo').disabled=true;
 Pin.fetchHash().then(function(cur){$('pinGo').disabled=false;
  if(h===cur){LK.set({n:0,until:0});try{sessionStorage.setItem('ik-adm-ok',cur)}catch(e){}showMsg('pinErr','');enter();return}
  lk.n++;var wt=lk.n>=5?Math.min(300,15*Math.pow(2,lk.n-5))*1000:0;LK.set({n:lk.n,until:wt?Date.now()+wt:0});
  $('pin').value='';showMsg('pinErr','Неверный PIN'+(wt?'. Подождите '+Math.round(wt/1000)+' с.':''),'err')})});
(function autologin(){var s;try{s=sessionStorage.getItem('ik-adm-ok')}catch(e){}if(!s)return;
 Pin.fetchHash().then(function(cur){if(cur===s)enter();else lock()})})();
$('logout').onclick=lock;

/* ---------- Calendar ---------- */
var cal=$('cal'),dayBtns={};
function buildCal(){cal.innerHTML='';dayBtns={};DOW.forEach(function(n){cal.appendChild(el('div','dow',n))});
 var wd=(today.getUTCDay()+6)%7,start=addDays(today,-wd),endD=addDays(last,((7-((last.getUTCDay()+6)%7))-1)),d;
 for(d=start;d<=endD;d=addDays(d,1)){(function(d){var inr=d>=today&&d<=last,b=el('button','day'+(inr?'':' out')+(dkey(d)===dkey(today)?' today':''),'<span>'+d.getUTCDate()+'</span><small></small><span class="dots"></span>');
  b.type='button';b.dataset.k=dkey(d);
  if(!inr){b.disabled=true;b.tabIndex=-1;b.setAttribute('aria-hidden','true')}
  else{if(d.getUTCDate()===1||dkey(d)===dkey(today))b.appendChild(el('em','mon',MON3[d.getUTCMonth()]));b.setAttribute('aria-label',human(d));
   if(!bookable(d)){b.disabled=true;b.querySelector('small').textContent='выходной'}else b.onclick=function(){selectDay(d)}}
  dayBtns[b.dataset.k]=b;cal.appendChild(b)})(d)}}
function paintDay(d){var k=dkey(d),b=dayBtns[k];if(!b||!bookable(d))return;var c=counts(d),s=b.querySelector('small'),dots=b.querySelector('.dots');b.classList.remove('loading');dots.innerHTML='';
 if(!c){b.classList.add('loading');s.textContent='…';return}
 s.textContent=c.free+' св.';if(c.booked)dots.appendChild(el('i','b'));if(c.closed)dots.appendChild(el('i','c'));
 b.setAttribute('aria-label',human(d)+', свободно '+c.free+(c.booked?', записей '+c.booked:'')+(c.closed?', закрыто '+c.closed:''))}
function paintAll(){for(var d=today;d<=last;d=addDays(d,1))paintDay(d)}

/* ---------- Loading ---------- */
function loadDay(d){var k=dkey(d);return Remote.read(k).then(function(r){state.days[k]=r;return true},function(){state.remoteOk=false;return false}).then(function(ok){paintDay(d);if(state.sel&&dkey(state.sel)===k)renderDay();return ok})}
function loadAll(){var ds=[],d,i=0;for(d=today;d<=last;d=addDays(d,1))if(bookable(d))ds.push(d);state.remoteOk=true;
 function pump(){var batch=ds.slice(i,i+7);i+=7;if(!batch.length)return Promise.resolve();return Promise.all(batch.map(loadDay)).then(pump)}
 return pump().then(function(){showMsg('net',state.remoteOk?'':'⚠️ Не удалось загрузить часть данных с сервера записи. Нажмите «Обновить». Дни без данных показаны как «…» и не редактируются.','warn');renderBookings();if(state.sel)renderDay()})}
function start(){state.started=true;today=dayStart(almatyNow());last=addDays(today,CFG.days);buildCal();paintAll();$('guideUrl').textContent=location.href.split('#')[0].split('?')[0];loadAll();
 clearInterval(state.timer);state.timer=setInterval(function(){if(document.hidden||state.busy)return;loadAll()},45000)}
$('refresh').onclick=function(){if(!state.busy)loadAll()};
document.addEventListener('visibilitychange',function(){if(!document.hidden&&state.started&&!state.busy)loadAll()});

/* ---------- Day view ---------- */
function selectDay(d){state.sel=d;[].forEach.call(cal.querySelectorAll('.day'),function(b){b.classList.toggle('sel',b.dataset.k===dkey(d))});renderDay();loadDay(d)}
function shortLab(t,n){t=String(t||'');return t.length>n?t.slice(0,n-1)+'…':t}
function slotLabel(d,h,e,st){var l=Lab.get(dkey(d),h,e);
 if(st==='student')return {short:l&&l.name?l.name:'ученик',full:'Занято учеником'+(l&&l.name?': '+l.name:'')+(l&&l.note?' ('+l.note+')':'')};
 if(st==='closed'){var r=REASONS[e.plan],t=l&&l.text;return {short:t||r,full:'Нет занятий: '+r+(t?' — '+t:'')}}
 return null}
function renderDay(){var d=state.sel;if(!d)return;$('noSel').hidden=true;$('dayBox').hidden=false;$('dayTitle').textContent=human(d);
 var s=$('slots');s.innerHTML='';var c=counts(d),m=state.days[dkey(d)];
 CFG.hours.forEach(function(h){var st=slotInfo(d,h),e=m&&m[h],sl=e?slotLabel(d,h,e,st):null,
  lab=sl?sl.short:{free:'свободно',booked:'запись',past:'прошло',unknown:'…'}[st],
  b=el('button','slot '+st+(state.busy?' busy':''),pad(h)+':00<em></em>');b.querySelector('em').textContent=shortLab(lab,9);b.type='button';b.dataset.h=h;b.dataset.state=st;
  b.setAttribute('aria-label',pad(h)+':00–'+pad(h+1)+':00, '+(sl?sl.full:lab)+(st==='booked'&&e.plan&&PLANS[e.plan]?' (запись с сайта, '+PLANS[e.plan]+')':''));
  if(sl)b.title=sl.full;
  if(st==='free'||st==='closed'||st==='student')b.onclick=function(){slotDialog(d,h)};
  else if(st==='booked'){b.setAttribute('aria-disabled','true');b.title='Запись с сайта — изменить нельзя';b.onclick=function(){toast('Это запись с сайта'+(e.plan&&PLANS[e.plan]?' (тариф: '+PLANS[e.plan]+')':'')+'. Имя и телефон пришли вам в WhatsApp. Изменить её здесь нельзя.')}}
  else b.disabled=true;
  s.appendChild(b)});
 $('closeDay').disabled=!c||!c.free||!!state.busy;$('closeRange').disabled=$('closeDay').disabled;$('openDay').disabled=!c||!c.closed||!!state.busy}
var tt;function toast(t){var e=$('toast');e.textContent=t;e.hidden=false;clearTimeout(tt);tt=setTimeout(function(){e.hidden=true},4500)}
function setBusy(n){state.busy+=n;if(state.sel)renderDay()}
function after(d,res,okMsg){state.days[dkey(d)]=res.map;paintDay(d);renderBookings();if(state.sel)renderDay();if(res.ok)toast(okMsg);
 else toast(res.reason==='booked'?'😔 На это время только что записался ученик (или оно занято) — изменить нельзя.':'Не удалось изменить: '+res.reason)}
function fail(d){toast('⚠️ Нет связи с сервером или запись не сохранилась. Попробуйте ещё раз.');return loadDay(d)}

/* ---------- Dialogs ---------- */
var dlgBack=$('dlgBack'),dlgBox=$('dlg'),dlgPrev=null;
function openDlg(html){dlgPrev=document.activeElement;dlgBox.innerHTML=html;dlgBack.hidden=false;document.body.style.overflow='hidden';var f=dlgBox.querySelector('input:not([type=radio]),input:checked,select,button');f&&f.focus();return dlgBox}
function closeDlg(){dlgBack.hidden=true;dlgBox.innerHTML='';document.body.style.overflow='';dlgPrev&&dlgPrev.focus&&dlgPrev.focus()}
dlgBack.addEventListener('mousedown',function(e){if(e.target===dlgBack)closeDlg()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!dlgBack.hidden)closeDlg()});
function attr(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function reasonRadios(cur){return '<div class="reasons" role="radiogroup" aria-label="Причина">'+Object.keys(REASONS).map(function(r){return '<label class="opt"><input type="radio" name="reason" value="'+r+'"'+(cur===r?' checked':'')+'><span>'+REASONS[r]+'</span></label>'}).join('')+'</div>'+
 '<label class="fl">Пояснение (необязательно, видно только вам на этом устройстве)<input type="text" id="dText" maxlength="60" autocomplete="off"></label>'}
function hourOpts(from,to,sel){var o='';for(var h=from;h<=to;h++)o+='<option value="'+h+'"'+(h===sel?' selected':'')+'>'+pad(h)+':00</option>';return o}
function dlgNote(){return '<p class="muted small" style="margin:10px 0 0">Имя, телефон и заметки сохраняются <b>только в этом браузере</b> (на других устройствах будет видно лишь «занято»). На сайт уходит только отметка «занято».</p>'}

/* one slot: occupy (student) / no lessons (reason) / edit / free */
function slotDialog(d,h){var k=dkey(d),m=state.days[k]||{},e=m[h],ex=isOwn(e)?e:null,st=ex?(isStudent(ex)?'student':'off'):'student',l=ex?Lab.get(k,h,ex):null,
 reason=ex&&isBlock(ex)?ex.plan:'busy';
 var box=openDlg('<h3 id="dlgTitle">'+pad(h)+':00–'+pad(h+1)+':00 · '+human(d)+'</h3>'+
  '<div class="seg" role="radiogroup" aria-label="Тип"><label class="opt"><input type="radio" name="kind" value="student"'+(st==='student'?' checked':'')+'><span>Занято учеником</span></label><label class="opt"><input type="radio" name="kind" value="off"'+(st==='off'?' checked':'')+'><span>Нет занятий</span></label></div>'+
  '<div id="fStudent"><label class="fl">Имя ученика (необязательно)<input type="text" id="dName" maxlength="40" autocomplete="off"></label>'+
  '<label class="fl">Телефон (необязательно)<input type="text" id="dPhone" inputmode="tel" maxlength="24" autocomplete="off"></label>'+
  '<label class="fl">Заметка (тариф, что изучает…)<input type="text" id="dNote" maxlength="80" autocomplete="off"></label></div>'+
  '<div id="fReason">'+reasonRadios(reason)+'</div>'+dlgNote()+
  '<div class="actions dlgact"><button class="btn" id="dSave" type="button">Сохранить</button>'+(ex?'<button class="btn btn-bad" id="dFree" type="button">Освободить время</button>':'')+'<button class="btn btn-ghost" id="dCancel" type="button">Отмена</button></div>');
 box.querySelector('#dName').value=l&&l.name||'';box.querySelector('#dPhone').value=l&&l.phone||'';box.querySelector('#dNote').value=l&&l.note||'';box.querySelector('#dText').value=l&&l.text||'';
 function kind(){return box.querySelector('input[name=kind]:checked').value}
 function sync(){var s=kind()==='student';box.querySelector('#fStudent').hidden=!s;box.querySelector('#fReason').hidden=s}
 [].forEach.call(box.querySelectorAll('input[name=kind]'),function(r){r.onchange=sync});sync();
 box.querySelector('#dCancel').onclick=closeDlg;
 box.querySelector('#dSave').onclick=function(){var plan,lab,isSt=kind()==='student';
  if(isSt){plan='student';lab={plan:plan,name:box.querySelector('#dName').value.trim(),phone:box.querySelector('#dPhone').value.trim(),note:box.querySelector('#dNote').value.trim()}}
  else{plan=box.querySelector('input[name=reason]:checked').value;lab={plan:plan,text:box.querySelector('#dText').value.trim()}}
  closeDlg();setBusy(1);
  mutate(k,function(mm){if(mm[h]&&!isOwn(mm[h]))return {abort:'booked'};if(mm[h]&&mm[h].plan===plan)return {skip:true};mm[h]={tok:OWN,plan:plan};return {map:mm}},function(v){return !!v[h]&&v[h].tok===OWN&&v[h].plan===plan})
  .then(function(res){setBusy(-1);if(res.ok)Lab.set(k,h,lab);after(d,res,isSt?'✅ '+pad(h)+':00 — занято учеником':'🔒 '+pad(h)+':00 — нет занятий')},function(){setBusy(-1);return fail(d)})};
 if(ex)box.querySelector('#dFree').onclick=function(){closeDlg();freeSlot(d,h)}}
function freeSlot(d,h){var k=dkey(d);setBusy(1);
 mutate(k,function(mm){if(!mm[h])return {skip:true};if(!isOwn(mm[h]))return {abort:'booked'};delete mm[h];return {map:mm}},function(v){return !isOwn(v[h])})
 .then(function(res){setBusy(-1);if(res.ok)Lab.del(k,h);after(d,res,'✅ '+pad(h)+':00 снова свободно')},function(){setBusy(-1);return fail(d)})}

/* several hours / whole day: "no lessons" with a reason */
function rangeDialog(whole){var d=state.sel;if(!d)return;var k=dkey(d),first=CFG.hours[0],lastH=CFG.hours[CFG.hours.length-1]+1;
 if(!whole){var m=state.days[k]||{};for(var i=0;i<CFG.hours.length;i++){var hh=CFG.hours[i];if(!m[hh]&&!isPast(d,hh)){first=hh;break}}}
 var box=openDlg('<h3 id="dlgTitle">'+(whole?'Закрыть весь день':'Закрыть часы')+' · '+human(d)+'</h3>'+
  '<div class="range"><label class="fl">С<select id="rFrom">'+hourOpts(first,lastH-1,first)+'</select></label><label class="fl">До<select id="rTo">'+hourOpts(first+1,lastH,lastH)+'</select></label></div>'+
  '<p class="muted small" style="margin:0 0 8px">Закроются только свободные часы: записи (с сайта или внесённые вручную) и прошедшие часы не меняются.</p>'+
  reasonRadios('busy')+dlgNote()+
  '<div class="actions dlgact"><button class="btn btn-bad" id="rGo" type="button">Закрыть</button><button class="btn btn-ghost" id="dCancel" type="button">Отмена</button></div>');
 var from=box.querySelector('#rFrom'),to=box.querySelector('#rTo');
 from.onchange=function(){var f=+from.value,t=+to.value;to.innerHTML=hourOpts(f+1,lastH,Math.max(t,f+1))};
 box.querySelector('#dCancel').onclick=closeDlg;
 box.querySelector('#rGo').onclick=function(){var f=+from.value,t=+to.value,plan=box.querySelector('input[name=reason]:checked').value,text=box.querySelector('#dText').value.trim(),targets=[];closeDlg();setBusy(1);
  mutate(k,function(mm){var any=false;targets=[];CFG.hours.forEach(function(h){if(h>=f&&h<t&&!mm[h]&&!isPast(d,h)){mm[h]={tok:OWN,plan:plan};targets.push(h);any=true}});return any?{map:mm}:{skip:true}},function(v){return targets.every(function(h){return !!v[h]})})
  .then(function(res){setBusy(-1);if(res.ok)targets.forEach(function(h){if(res.map[h]&&res.map[h].tok===OWN&&res.map[h].plan===plan)Lab.set(k,h,{plan:plan,text:text})});after(d,res,targets.length?'🔒 Закрыто часов: '+targets.length:'Нет свободных часов в этом промежутке')},function(){setBusy(-1);return fail(d)})}}
$('closeDay').onclick=function(){rangeDialog(true)};
$('closeRange').onclick=function(){rangeDialog(false)};
$('openDay').onclick=function(){var d=state.sel;if(!d)return;var k=dkey(d),targets=[];setBusy(1);
 mutate(k,function(m){var any=false;targets=[];Object.keys(m).forEach(function(h){if(isBlock(m[h])){delete m[h];targets.push(+h);any=true}});return any?{map:m}:{skip:true}},function(v){return targets.every(function(h){return !isBlock(v[h])})})
 .then(function(res){setBusy(-1);if(res.ok)targets.forEach(function(h){Lab.del(k,h)});after(d,res,'✅ День открыт (часы «нет занятий»; ученики остаются)')},function(){setBusy(-1);return fail(d)})};

/* ---------- Upcoming bookings (site bookings + hours you marked as "occupied by a student") ---------- */
function renderBookings(){var ul=$('bookings'),rows=[],d;ul.innerHTML='';
 for(d=today;d<=last;d=addDays(d,1)){var k=dkey(d),m=state.days[k];if(!m)continue;CFG.hours.forEach(function(h){var e=m[h];if(e&&!isBlock(e)&&!ended(d,h))rows.push({d:d,h:h,k:k,e:e})})}
 if(!rows.length){ul.appendChild(el('li','muted',state.remoteOk?'Ближайших записей нет.':'Нет данных (проверьте связь и нажмите «Обновить»).'));return}
 rows.forEach(function(r){var own=isStudent(r.e),l=own?Lab.get(r.k,r.h,r.e):null,right,who='';
  if(own){right='внесено вручную';who=l&&(l.name||l.phone||l.note)?[l.name,l.phone,l.note].filter(Boolean).map(attr).join(' · '):'без данных (или данные на другом устройстве)'}
  else right=PLANS[r.e.plan]?'тариф: '+PLANS[r.e.plan]:'тариф не указан';
  var li=el('li','','<b>'+human(r.d)+'</b><span class="t">'+pad(r.h)+':00–'+pad(r.h+1)+':00</span><span class="pl">'+right+'</span>'+(who?'<span class="who">'+who+'</span>':''));
  if(own){li.className='own';li.tabIndex=0;li.setAttribute('role','button');li.title='Изменить';li.onclick=function(){selectDay(r.d);slotDialog(r.d,r.h)};li.onkeydown=function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();li.onclick()}}}
  ul.appendChild(li)})}

/* ---------- Change PIN ---------- */
$('chgForm').addEventListener('submit',function(ev){ev.preventDefault();var o=$('pinOld').value,n=$('pinNew').value,n2=$('pinNew2').value;
 function m(t,c){showMsg('chgMsg',t,c)}
 if(n.length<4){m('Новый PIN слишком короткий (минимум 4 символа).','msg err');return}
 if(n!==n2){m('Новые PIN не совпадают.','msg err');return}
 $('chgGo').disabled=true;m('Проверяем…','msg warn');
 Pin.fetchHash().then(function(cur){if(pinHash(o)!==cur){m('Текущий PIN неверный.','msg err');return}
  return Pin.save(pinHash(n)).then(function(){try{sessionStorage.setItem('ik-adm-ok',pinHash(n))}catch(e){}$('chgForm').reset();m('✅ PIN изменён. На других устройствах войдите с новым PIN.','msg okm')})})
 .catch(function(){m('Не удалось сохранить PIN в общем хранилище (нет связи). PIN не изменён.','msg err')}).then(function(){$('chgGo').disabled=false})});
})();
