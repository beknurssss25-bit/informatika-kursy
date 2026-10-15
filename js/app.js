(function(){'use strict';
var $=function(i){return document.getElementById(i)};
function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e}
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Navigation ---------- */
var nav=$('nav'),menu=$('menu'),burger=$('burger');
function onScroll(){nav.classList.toggle('solid',scrollY>40)}addEventListener('scroll',onScroll,{passive:true});onScroll();
burger.onclick=function(){var o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',String(o))};
[].forEach.call(menu.querySelectorAll('a'),function(a){a.onclick=function(){menu.classList.remove('open');burger.setAttribute('aria-expanded','false')}});
/* reveal on scroll */
var rev=document.querySelectorAll('.reveal');
if('IntersectionObserver' in window&&!reduce){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -30px 0px'});[].forEach.call(rev,function(r){io.observe(r)})}
else[].forEach.call(rev,function(r){r.classList.add('in')});

/* ---------- Config ---------- */
var CFG={api:'https://keyvalue.immanuel.co/api/KeyVal',appKey:'10y0bwsv',prefix:'d',
 hours:[10,11,12,13,14,15,16,17,18,19],      /* start hours; last lesson ends at 20:00 */
 days:30,minNoticeMin:60,tzOffsetH:5,           /* Asia/Almaty, UTC+5 */
 phone:'77056468307'};
var PLANS={1:{name:'1 месяц',price:'25 000 ₸'},2:{name:'2 месяца',price:'50 000 ₸'},5:{name:'5 месяцев',price:'100 000 ₸'}};
var MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
var DOW=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],DOWL=['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

/* ---------- Time helpers (Almaty) ---------- */
function almatyNow(){return new Date(Date.now()+CFG.tzOffsetH*3600e3)}      /* read with getUTC* */
function pad(n){return n<10?'0'+n:''+n}
function dkey(d){return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())}
function dayStart(d){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()))}
function addDays(d,n){return new Date(d.getTime()+n*864e5)}
function human(d){return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]+' ('+['вс','пн','вт','ср','чт','пт','сб'][d.getUTCDay()]+')'}
function isPast(d,h){var n=almatyNow();if(dkey(d)!==dkey(n))return d<dayStart(n);return h*60<n.getUTCHours()*60+n.getUTCMinutes()+CFG.minNoticeMin}

/* ---------- Storage layer: shared (keyvalue.immanuel.co, one key per day) + localStorage ---------- */
var LS={get:function(k,d){try{var v=localStorage.getItem('ik-'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:function(k,v){try{localStorage.setItem('ik-'+k,JSON.stringify(v))}catch(e){}}};
function parse(v){var m={};if(typeof v!=='string'||v==='-'||!v)return m;v.split('_').forEach(function(x){var p=x.split('-');if(p.length>=2&&/^\d+$/.test(p[0])&&/^[a-z0-9]+$/.test(p[1]))m[+p[0]]={tok:p[1],plan:p[2]||''}});return m}
function ser(m){var o=Object.keys(m).sort(function(a,b){return a-b}).map(function(h){return h+'-'+m[h].tok+'-'+(m[h].plan||'')});return o.length?o.join('_'):'-'}
function timed(url,opt,ms){var c=window.AbortController?new AbortController():null,t=setTimeout(function(){c&&c.abort()},ms||9000);opt=opt||{};if(c)opt.signal=c.signal;opt.cache='no-store';
 return fetch(url,opt).then(function(r){clearTimeout(t);if(!r.ok)throw new Error('http '+r.status);return r},function(e){clearTimeout(t);throw e})}
var Remote={
 read:function(key){return timed(CFG.api+'/GetValue/'+CFG.appKey+'/'+CFG.prefix+key).then(function(r){return r.json()}).then(function(v){return parse(v)})},
 write:function(key,map){return timed(CFG.api+'/UpdateValue/'+CFG.appKey+'/'+CFG.prefix+key+'/'+encodeURIComponent(ser(map)),{method:'POST'}).then(function(r){return r.text()})}};
var Local={all:function(){return LS.get('bookings',{})},day:function(key){return this.all()[key]||{}},put:function(key,h,rec){var a=this.all();(a[key]=a[key]||{})[h]=rec;LS.set('bookings',a)}};
var state={days:{},remoteOk:true,sel:null,hour:null,busy:false,loaded:false};   /* days[key] = {h:{tok,plan}} merged remote+local */
function merged(key,remote){var m={},h,l=Local.day(key);for(h in remote)m[h]=remote[h];for(h in l)if(!m[h])m[h]={tok:l[h].tok,plan:l[h].plan,local:1};return m}

/* ---------- Calendar ---------- */
var today=dayStart(almatyNow()),last=addDays(today,CFG.days),cal=$('cal'),dayBtns={};
function bookable(d){return d.getUTCDay()!==0&&d>=today&&d<=last}
function freeCount(d){var k=dkey(d),m=state.days[k];if(!m)return null;return CFG.hours.filter(function(h){return !m[h]&&!isPast(d,h)}).length}
function buildCal(){cal.innerHTML='';DOW.forEach(function(n){cal.appendChild(el('div','dow',n))});
 var wd=(today.getUTCDay()+6)%7,start=addDays(today,-wd),endD=addDays(last,((7-((last.getUTCDay()+6)%7))-1)),d;
 for(d=start;d<=endD;d=addDays(d,1)){(function(d){var inr=d>=today&&d<=last,b=el('button','day'+(inr?'':' out')+(dkey(d)===dkey(today)?' today':''),'<span>'+d.getUTCDate()+'</span><small></small>');
  b.type='button';b.dataset.k=dkey(d);if(inr&&(d.getUTCDate()===1||dkey(d)===dkey(today)))b.appendChild(el('em','mon',['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'][d.getUTCMonth()]));if(!inr){b.disabled=true;b.tabIndex=-1;b.setAttribute('aria-hidden','true')}else{b.setAttribute('aria-label',human(d));
  if(!bookable(d)){b.disabled=true;b.querySelector('small').textContent='выходной'}else{b.onclick=function(){selectDay(d)}}dayBtns[b.dataset.k]=b}cal.appendChild(b)})(d)}}
function paintDay(d){var k=dkey(d),b=dayBtns[k];if(!b||!bookable(d))return;var n=freeCount(d),s=b.querySelector('small');b.classList.remove('loading');
 if(n===null){b.classList.add('loading');s.textContent='…';return}
 b.disabled=(n===0);s.textContent=n===0?'занято':n+' св.';b.setAttribute('aria-label',human(d)+(n===0?', свободных нет':', свободно '+n))}
function paintAll(){for(var d=today;d<=last;d=addDays(d,1))paintDay(d)}

/* ---------- Loading availability ---------- */
function note(msg){var n=$('net');n.hidden=!msg;n.textContent=msg||''}
function loadDay(d){var k=dkey(d);return Remote.read(k).then(function(r){state.days[k]=merged(k,r);LS.set('cache-'+k,r);return true},function(){state.remoteOk=false;state.days[k]=merged(k,LS.get('cache-'+k,{}));return false}).then(function(ok){paintDay(d);if(state.sel&&dkey(state.sel)===k)renderSlots();return ok})}
function loadAll(){var ds=[],d,i=0;for(d=today;d<=last;d=addDays(d,1))if(bookable(d))ds.push(d);state.remoteOk=true;
 var res=[];function pump(){var batch=ds.slice(i,i+7);i+=7;if(!batch.length)return Promise.resolve();return Promise.all(batch.map(loadDay)).then(function(r){res=res.concat(r);return pump()})}
 return pump().then(function(){state.loaded=true;note(state.remoteOk?'':'⚠️ Нет связи с сервером записи — показаны данные, сохранённые на этом устройстве. Позвоните, чтобы подтвердить время.')})}
state.remoteOk=true;buildCal();paintAll();
loadAll();
var poll=setInterval(function(){if(document.hidden||state.busy||!state.sel)return;loadDay(state.sel)},20000);
document.addEventListener('visibilitychange',function(){if(!document.hidden&&!state.busy)loadAll()});

/* ---------- Day / slot selection ---------- */
function selectDay(d){state.sel=d;state.hour=null;[].forEach.call(cal.querySelectorAll('.day'),function(b){b.classList.toggle('sel',b.dataset.k===dkey(d))});
 $('dayLabel').textContent='— '+human(d);var s=$('slots');s.innerHTML='';for(var i=0;i<CFG.hours.length;i++)s.appendChild(el('div','skel'));updateSummary();
 loadDay(d)}
function renderSlots(){var d=state.sel,k=dkey(d),m=state.days[k]||{},s=$('slots');s.innerHTML='';var any=false;
 CFG.hours.forEach(function(h){var past=isPast(d,h),busy=!!m[h],b=el('button','slot'+(past?' past':'')+(state.hour===h?' sel':''),pad(h)+':00');b.type='button';b.dataset.h=h;
  b.setAttribute('aria-label',pad(h)+':00–'+pad(h+1)+':00'+(busy?', занято':past?', время прошло':''));b.setAttribute('aria-pressed',String(state.hour===h));
  if(busy||past)b.disabled=true;else{any=true;b.onclick=function(){state.hour=h;renderSlots();updateSummary();hideErr()}}s.appendChild(b)});
 if(state.hour!==null&&(m[state.hour]||isPast(d,state.hour))){state.hour=null;updateSummary()}
 if(!any)s.appendChild(el('p','muted','На этот день свободного времени нет. Выберите другую дату.'))}
function plan(){var r=document.querySelector('input[name=plan]:checked');return r?r.value:'2'}
function updateSummary(){var t=$('summary');if(!state.sel){t.textContent='Выберите дату и время';return}
 t.innerHTML='📅 <b>'+human(state.sel)+'</b>'+(state.hour!==null?', <b>'+pad(state.hour)+':00–'+pad(state.hour+1)+':00</b>':' — выберите время')+'<br>🎓 '+PLANS[plan()].name+' · '+PLANS[plan()].price}
[].forEach.call(document.querySelectorAll('input[name=plan]'),function(r){r.onchange=function(){updateSummary();[].forEach.call(document.querySelectorAll('.plan[data-plan]'),function(p){p.classList.toggle('sel',p.dataset.plan===plan())})}});
[].forEach.call(document.querySelectorAll('[data-pick]'),function(b){b.onclick=function(){var r=document.querySelector('input[name=plan][value="'+b.dataset.pick+'"]');r.checked=true;r.onchange();$('booking').scrollIntoView({behavior:reduce?'auto':'smooth'})}});
updateSummary();

/* ---------- Form ---------- */
var fPhone=$('fPhone'),fName=$('fName');
function digits(s){return s.replace(/\D/g,'')}
fPhone.addEventListener('input',function(){var d=digits(fPhone.value);if(d[0]==='8')d='7'+d.slice(1);if(d&&d[0]!=='7')d='7'+d;d=d.slice(0,11);
 var o='';if(d.length){o='+7';if(d.length>1)o+=' ('+d.slice(1,4);if(d.length>=4)o+=') '+d.slice(4,7);if(d.length>=7)o+='-'+d.slice(7,9);if(d.length>=9)o+='-'+d.slice(9,11)}fPhone.value=o;fPhone.classList.remove('bad')});
fName.addEventListener('input',function(){fName.classList.remove('bad')});
function showErr(t){var e=$('formErr');e.textContent=t;e.hidden=false}function hideErr(){$('formErr').hidden=true}
function token(){var a='abcdefghjkmnpqrstuvwxyz23456789',s='',i;for(i=0;i<6;i++)s+=a[Math.floor(Math.random()*a.length)];return s}
function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
$('bookForm').addEventListener('submit',function(ev){ev.preventDefault();if(state.busy)return;hideErr();
 var name=fName.value.trim(),ph=digits(fPhone.value),bad=false;
 if(!state.sel||state.hour===null){showErr('Выберите дату и время.');return}
 if(name.length<2){fName.classList.add('bad');bad=true}if(ph.length!==11){fPhone.classList.add('bad');bad=true}
 if(bad){showErr('Укажите имя и телефон полностью.');return}
 book(state.sel,state.hour,plan(),name,fPhone.value)});
function setBusy(b){state.busy=b;var s=$('submit');s.disabled=b;s.textContent=b?'Проверяем время…':'Записаться'}
function taken(d){setBusy(false);showErr('😔 Это время только что заняли. Пожалуйста, выберите другое.');loadDay(d)}
function book(d,h,pl,name,phone){var k=dkey(d),tok=token();setBusy(true);
 Remote.read(k).then(function(fresh){
  if(fresh[h]||Local.day(k)[h]){state.days[k]=merged(k,fresh);return taken(d)}
  var mine={tok:tok,plan:pl},attempt=0;
  function put(base){var m={},x;for(x in base)m[x]=base[x];m[h]=mine;return Remote.write(k,m)}
  function verify(n){return wait(650+Math.random()*450).then(function(){return Remote.read(k)}).then(function(v){
    if(v[h]&&v[h].tok===tok){return n>=2?'ok':verify(n+1)}
    if(v[h])return 'taken';
    if(++attempt>3)throw new Error('lost');return put(v).then(function(){return verify(0)})})}
  return put(fresh).then(function(){return verify(1)}).then(function(r){
    if(r==='taken')return taken(d);
    Local.put(k,h,{tok:tok,plan:pl,name:name,phone:phone,ts:Date.now()});state.days[k]=merged(k,v0(k,h,tok,pl));paintDay(d);setBusy(false);confirmed({d:d,h:h,plan:pl,name:name,phone:phone,tok:tok,offline:false})})
 }).catch(function(){ /* backend unreachable: local fallback */
  if(Local.day(k)[h]||(state.days[k]&&state.days[k][h]))return taken(d);
  Local.put(k,h,{tok:tok,plan:pl,name:name,phone:phone,ts:Date.now(),offline:1});state.days[k]=merged(k,{});paintDay(d);setBusy(false);confirmed({d:d,h:h,plan:pl,name:name,phone:phone,tok:tok,offline:true})})}
function v0(k,h,tok,pl){var m={},s=state.days[k]||{},x;for(x in s)if(!s[x].local)m[x]=s[x];m[h]={tok:tok,plan:pl};return m}

/* ---------- Confirmation ---------- */
function ics(c){var s=dkey(c.d),dt=function(h){return s+'T'+pad(h)+'0000'},u=[ 'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//informatika-kursy//RU','BEGIN:VEVENT','UID:'+c.tok+'@informatika-kursy','DTSTAMP:'+new Date().toISOString().replace(/[-:]|\.\d+/g,''),'DTSTART;TZID=Asia/Almaty:'+dt(c.h),'DTEND;TZID=Asia/Almaty:'+dt(c.h+1),'SUMMARY:Занятие по информатике','LOCATION:Школа 250\\, кабинет 3\\, 3 этаж','END:VEVENT','END:VCALENDAR'];
 return 'data:text/calendar;charset=utf-8,'+encodeURIComponent(u.join('\r\n'))}
function confirmed(c){var when=human(c.d)+', '+pad(c.h)+':00–'+pad(c.h+1)+':00',P=PLANS[c.plan];
 var msg='Здравствуйте! Я записался(лась) на занятие по информатике: '+when+'. Тариф: '+P.name+' ('+P.price+'). Имя: '+c.name+'. Телефон: '+c.phone+'. Код записи: '+c.tok.toUpperCase();
 var dn=$('done');dn.innerHTML='<div class="ok">✓</div><h3>Вы записаны!</h3><p class="muted">Ждём вас на занятии. Для оплаты и подтверждения позвоните или напишите нам.</p>'+
 '<div class="ticket"><span>📅 <b>'+when+'</b></span><span>🎓 Тариф: <b>'+P.name+' — '+P.price+'</b></span><span>👤 '+esc(c.name)+' · '+esc(c.phone)+'</span><span>📍 Школа 250, кабинет 3, 3 этаж</span><span>🔑 Код записи: <b class="code">'+c.tok.toUpperCase()+'</b></span></div>'+
 (c.offline?'<p class="warn">⚠️ Сервер записи сейчас недоступен — запись сохранена только на этом устройстве. Пожалуйста, подтвердите время по телефону.</p>':'')+
 '<div class="cta-row"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/'+CFG.phone+'?text='+encodeURIComponent(msg)+'">Отправить данные в WhatsApp</a><a class="btn" href="tel:+'+CFG.phone+'">Позвонить 8 705 646 83 07</a><a class="btn btn-ghost" download="zanyatie-informatika.ics" href="'+ics(c)+'">В календарь</a></div>'+
 '<p><button class="btn btn-ghost btn-sm" id="again" type="button" style="color:var(--p)">Записаться на другое время</button></p>';
 dn.hidden=false;$('bookForm').hidden=true;document.querySelector('.book-main').hidden=true;$('again').onclick=function(){dn.hidden=true;$('bookForm').hidden=false;document.querySelector('.book-main').hidden=false;state.hour=null;fName.value='';fPhone.value='';updateSummary();if(state.sel)renderSlots();loadAll()};
 dn.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'})}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
window.__ik={state:state,CFG:CFG,Remote:Remote};
})();
