import { Tour, PLACES } from './tour.js?v=56';
const $=id=>document.getElementById(id);
const tour=window.TOUR=new Tour($('stage'),{onStatus:s=>{$('status').textContent=s},onInfo:p=>showInfo(p)});
const bar=document.querySelector('#loading .bar i');let prog=0;const step=s=>{prog=Math.min(95,prog+22);bar.style.width=prog+'%';document.querySelector('#loading .lt').textContent=s};
tour.basilica.onProgress=step;
// places strip
const pl=$('places');pl.innerHTML=PLACES.map(p=>`<button data-k="${p.id}">${p.name}</button>`).join('');
pl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;tour.goTo(b.dataset.k);pl.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));const p=PLACES.find(q=>q.id===b.dataset.k);setTimeout(()=>showInfo(p),1200)});
function showInfo(p){if(!p)return;const i=$('info');i.querySelector('h2').textContent=p.title;i.querySelector('p').textContent=p.text;i.hidden=false}
$('info').querySelector('.x').onclick=()=>{$('info').hidden=true};
$('modeBtn').onclick=()=>{tour.setMode(tour.mode==='Walk'?'Free':'Walk');$('modeBtn').textContent=tour.mode==='Walk'?'Walk':'Free cam'};
$('menuBtn').onclick=()=>$('menu').classList.add('open');
$('mStart').onclick=()=>{$('menu').classList.remove('open')};
fetch('ASSETS.md').then(r=>r.ok?r.text():'').then(t=>{const items=[...t.matchAll(/^- \*\*(.+?)\*\* — (.+)$/gm)].map(m=>`<li><b>${m[1]}</b> — ${m[2].replace(/<(https?:[^>]+)>/g,'<a href="$1" target="_blank" rel="noopener">source</a>')}</li>`);$('credits').innerHTML='<ul>'+items.join('')+'</ul>'}).catch(()=>{});
const ro=new ResizeObserver(()=>tour.resize());ro.observe($('stage'));
tour.init().then(()=>{bar.style.width='100%';$('loading').classList.add('done');$('status').textContent='The nave';
  if(!new URLSearchParams(location.search).has('play'))$('menu').classList.add('open');document.body.classList.add('ready')}).catch(e=>{console.error(e);$('status').textContent='Could not load: '+e.message});
// full screen (native API, or a CSS pseudo-fullscreen on iOS), as in the chapel game
{const de=document.documentElement,b=$('fsBtn'),fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement,isAndroid=/Android/i.test(navigator.userAgent),api=!isAndroid&&!!(de.requestFullscreen||de.webkitRequestFullscreen);let pseudo=false;
  const x=document.createElement('button');x.id='fsX';x.textContent='✕';x.setAttribute('aria-label','Exit full screen');$('stage').appendChild(x);x.addEventListener('pointerdown',e=>e.stopPropagation());
  const isFull=()=>!!fsEl()||pseudo;
  const upd=()=>{document.body.classList.toggle('full',isFull());b.textContent=isFull()?'✕':'⛶';tour.resetJoy&&tour.resetJoy();tour.resize();setTimeout(()=>tour.resize(),150)};
  const enterPseudo=()=>{pseudo=true;try{history.pushState({pfs:1},'')}catch(_){}upd()};
  const exitPseudo=fromPop=>{if(!pseudo)return;pseudo=false;if(!fromPop&&history.state&&history.state.pfs)try{history.back()}catch(_){}upd()};
  const exit=()=>{if(fsEl())(document.exitFullscreen||document.webkitExitFullscreen).call(document);else exitPseudo()};
  const enter=()=>{if(!api){enterPseudo();return}try{const r=(de.requestFullscreen||de.webkitRequestFullscreen).call(de,{navigationUI:'hide'});if(r&&r.catch)r.catch(enterPseudo)}catch(_){enterPseudo()}};
  b.onclick=()=>isFull()?exit():enter();x.onclick=e=>{e.stopPropagation();exit()};
  addEventListener('popstate',()=>exitPseudo(true));document.addEventListener('fullscreenchange',upd);document.addEventListener('webkitfullscreenchange',upd);
  window.TOUR.fullscreen=on=>on?enterPseudo():exit()}
