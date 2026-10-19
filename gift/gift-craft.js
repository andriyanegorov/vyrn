/* ================= data ================= */
const MODELS={
  Classic:{a:'#b9692f',b:'#e3a36a',c:'#f6d9b0',r:12},
  Bonecake:{a:'#8a5a3b',b:'#f0c9a0',c:'#ffffff',r:2.4},
  Berry:{a:'#d63a6a',b:'#ff8fb1',c:'#ffffff',r:8},
  Choco:{a:'#4b2a1a',b:'#7a4528',c:'#e8b98a',r:9},
  Lemon:{a:'#f2cf3a',b:'#ffe57a',c:'#ffffff',r:10},
  Ghost:{a:'#cfd3d8',b:'#9aa0a8',c:'#2b2d31',r:3},
  Grape:{a:'#7b3fc4',b:'#b07be8',c:'#ffffff',r:6},
  Burnt:{a:'#2c2c31',b:'#3d3d44',c:'#55555c',r:0}
};
const SYMBOLS={Cow:['🐮',20],Pig:['🐷',14],Cat:['🐱',9],Fox:['🦊',6],Frog:['🐸',11],Star:['⭐',4]};
const BACKDROPS={
  Emerald:['#4fb64c','#2f8a3a',1.5],Amethyst:['#9b59e0','#6a2fb0',2],Sapphire:['#5b6be0','#3a43b0',2.5],
  Burgundy:['#b0585f','#7b343c',1.8],Teal:['#2fb3a8','#1b7c78',3],Amber:['#f0a030','#b8661a',3.5],Rose:['#ee6fa0','#b53c6e',2.8]
};
const MODEL_NAMES={Classic:'Классический',Bonecake:'Костяной торт',Berry:'Ягодный',Choco:'Шоколадный',Lemon:'Лимонный',Ghost:'Призрачный',Grape:'Виноградный',Burnt:'Сгоревший'};
const SYMBOL_NAMES={Cow:'Корова',Pig:'Свинья',Cat:'Кошка',Fox:'Лиса',Frog:'Лягушка',Star:'Звезда'};
const BACKDROP_NAMES={Emerald:'Изумрудный',Amethyst:'Аметистовый',Sapphire:'Сапфировый',Burgundy:'Бордовый',Teal:'Бирюзовый',Amber:'Янтарный',Rose:'Розовый'};
const keys=o=>Object.keys(o);
const rnd=(a,b)=>a+Math.random()*(b-a);
const pickR=a=>a[Math.floor(Math.random()*a.length)];
const $=s=>document.querySelector(s);
const fmt=n=>n.toLocaleString('ru-RU');

function cakeSVG(model,flames=true){
  const p=MODELS[model];
  return `<svg class="cake" viewBox="0 0 100 100">
  <ellipse cx="50" cy="84" rx="42" ry="8" fill="#fff" opacity=".95"/>
  <ellipse cx="50" cy="86" rx="14" ry="2.4" fill="#fff" opacity=".7"/>
  <rect x="24" y="52" width="52" height="30" rx="9" fill="${p.a}"/>
  <path d="M24 60c4 6 7 0 11 6s7-2 11 5 7-3 11 4 7-4 11 1 6-3 8-2v-8c0-5-4-8-9-8H33c-5 0-9 3-9 8z" fill="${p.c}" opacity=".85"/>
  <rect x="33" y="33" width="34" height="21" rx="7" fill="${p.b}"/>
  <path d="M33 42c4 5 6 0 9 4s6-2 9 3 6-3 9 1 5-2 7 0v-5c0-4-3-6-7-6H40c-4 0-7 2-7 6z" fill="${p.c}" opacity=".8"/>
  ${[42,50,58].map(x=>`<rect x="${x-1.4}" y="22" width="2.8" height="12" rx="1" fill="#f4e3c4"/>${flames?`<ellipse cx="${x}" cy="19" rx="2.4" ry="3.6" fill="#ffb21e"/><ellipse cx="${x}" cy="19.8" rx="1.1" ry="1.9" fill="#fff3b0"/>`:''}`).join('')}
  </svg>`;
}

let serial=1000;
function newGift(over={}){
  const m=over.model||pickR(keys(MODELS).filter(k=>k!=='Burnt'));
  return Object.assign({
    id:++serial,model:m,symbol:pickR(keys(SYMBOLS)),backdrop:pickR(keys(BACKDROPS)),
    pct:Math.round(rnd(14,30)),num:Math.floor(rnd(1000,590000))
  },over);
}
function tileEl(g,o={}){
  const b=BACKDROPS[g.backdrop]||['#555','#333'];
  const d=document.createElement('div');d.className='tile';
  d.style.setProperty('--c1',b[1]);d.style.setProperty('--c2',b[0]);
  const sym=(SYMBOLS[g.symbol]||['·'])[0];
  d.innerHTML=`<div class="pat">${(sym+' ').repeat(60)}</div>${cakeSVG(g.model,!g.burnt)}`+
    (o.badge!==false&&g.pct!=null?`<span class="badge">${g.pct}%</span>`:'')+(o.x?'<span class="x">✕</span>':'')+(o.num?`<span class="num">#${fmt(g.num)}</span>`:'');
  return d;
}

function emptyFace(){
  const d=document.createElement('div');d.className='tile empty';
  d.innerHTML='<img class="empty-anvil" src="./anvil.svg" alt="">';
  return d;
}
/* ================= state ================= */
let inv=[];for(let i=0;i<12;i++)inv.push(newGift());
let slots=[null,null,null,null];
let craftNo=0,busy=false;

/* ================= inventory ================= */
function renderGrid(){
  const g=$('#grid');g.innerHTML='';
  inv.forEach(x=>{const t=tileEl(x,{num:true});t.onclick=()=>{openCraft(x)};g.appendChild(t)});
  $('#cnt').textContent=inv.length+' подарков';
}
$('#addMore').onclick=()=>{for(let i=0;i<5;i++)inv.unshift(newGift());renderGrid();toast('+5 новых подарков')};
$('#openCraft').onclick=()=>openCraft();

/* ================= craft modal ================= */
function openCraft(g){
  slots=[null,null,null,null];
  if(g)slots[0]=g;
  craftNo=Math.floor(rnd(400000,499999));
  renderCraft();
  $('#bg1').classList.add('on');$('#craftSheet').classList.add('on');
}
function closeCraft(){$('#bg1').classList.remove('on');$('#craftSheet').classList.remove('on')}
$('#closeCraft').onclick=closeCraft;$('#bg1').onclick=closeCraft;
$('#helpBtn').onclick=()=>toast('Сумма шансов подарков = шанс успеха');

function total(){return Math.min(100,slots.reduce((s,g)=>s+(g?g.pct:0),0))}
function renderCraft(){
  document.querySelectorAll('.slot').forEach((el,i)=>{
    el.innerHTML='';const g=slots[i];
    if(g){
      const t=tileEl(g,{x:i>0||true});el.appendChild(t);
      t.querySelector('.x').onclick=e=>{e.stopPropagation();slots[i]=null;renderCraft()};
      el.onclick=()=>openPicker(i);
    }else{
      el.innerHTML='<img class="plus" src="./add.svg" alt="">';el.onclick=()=>openPicker(i);
    }
  });
  const t=total();
  $('#ringC').style.strokeDashoffset=100-t;
  $('#pcTxt').textContent=t+'%';
  $('#info').innerHTML=`Добавь до <b>4</b> подарков, чтобы создать<br><b>🎂 торт №${fmt(craftNo)}.</b><br><br>При неудаче все выбранные подарки<br>сгорят.`;
  // chips
  const sel=slots.filter(Boolean);
  const bd={},sy={};
  sel.forEach(g=>{bd[g.backdrop]=(bd[g.backdrop]||0)+g.pct;sy[g.symbol]=(sy[g.symbol]||0)+g.pct});
  const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1])[0];
  const ch=$('#chips');ch.innerHTML='';
  if(sel.length){
    const b=top(bd),s=top(sy);
    [[BACKDROPS[b[0]][0],'',Math.round(b[1]*t/100)],['#e9edf3',SYMBOLS[s[0]][0],Math.round(s[1]*t/100)]].forEach(([c,e,p])=>{
      const C=2*Math.PI*23;
      ch.insertAdjacentHTML('beforeend',`<div class="chip"><svg viewBox="0 0 54 54"><circle cx="27" cy="27" r="23" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3"/><circle cx="27" cy="27" r="23" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-Math.min(1,p/40))}"/></svg><div class="in" style="--cc:${c}">${e}</div><small>${p}%</small></div>`);
    });
  }
  const go=$('#goBtn');
  if(!sel.length){go.className='go off';go.innerHTML='Добавь подарки';}
  else{go.className='go '+(t>=50?'green':'blue');go.innerHTML=`Создать торт №${fmt(craftNo)}<small>Шанс успеха: ${t}%</small>`}
}
/* picker */
let pickIdx=0;
function openPicker(i){
  pickIdx=i;const used=new Set(slots.filter(Boolean).map(g=>g.id));
  const box=$('#pick');box.innerHTML='';
  const av=inv.filter(g=>!used.has(g.id));
  if(!av.length)box.innerHTML='<div class="empty">Нет свободных подарков</div>';
  av.forEach(g=>{const t=tileEl(g,{num:true});t.onclick=()=>{slots[pickIdx]=g;closePicker();renderCraft()};box.appendChild(t)});
  $('#bg2').classList.add('on');$('#pickSheet').classList.add('on');$('#pickSheet').style.zIndex=14;
}
function closePicker(){$('#bg2').classList.remove('on');$('#pickSheet').classList.remove('on');$('#varSheet').classList.remove('on')}
$('#bg2').onclick=closePicker;
$('#variants').onclick=()=>{
  const sel=slots.filter(Boolean);if(!sel.length)return toast('Сначала добавь подарки');
  const box=$('#varList');box.innerHTML='';
  const seen=new Set();
  for(let k=0;k<9;k++){
    const g=pickR(sel),m=pickR(sel),s=pickR(sel);
    const v={model:m.model,backdrop:g.backdrop,symbol:s.symbol,pct:null,num:0};
    const key=v.model+v.backdrop+v.symbol;if(seen.has(key))continue;seen.add(key);
    box.appendChild(tileEl(v,{badge:false}));
  }
  $('#bg2').classList.add('on');$('#varSheet').classList.add('on');
};

/* ================= crafting animation ================= */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TARGET=[[0,0],[0,-90],[0,180],[0,90],[-90,0],[90,0]]; // [rx,ry] to show face i
function fwd(cur,t,turns){return cur+(((t-cur)%360)+360)%360+360*turns}

$('#goBtn').onclick=startCraft;
async function startCraft(){
  const sel=slots.filter(Boolean);
  if(!sel.length||busy)return;busy=true;
  const t=total();
  const mode=$('#mode').value;
  let success=mode==='win'?true:mode==='lose'?false:Math.random()*100<t;

  // outcome
  const wsum=sel.reduce((s,g)=>s+g.pct,0);
  let r=Math.random()*wsum,win=sel[0];for(const g of sel){if((r-=g.pct)<=0){win=g;break}}
  const result={id:++serial,model:pickR(sel).model,symbol:pickR(sel).symbol,backdrop:win.backdrop,pct:Math.round(rnd(14,30)),num:craftNo};

  closeCraft();
  const cr=$('#crafting'),stage=$('#stage');
  $('#cNum').textContent='Торт №'+fmt(craftNo);
  $('#cPc').textContent='Шанс успеха: '+t+'%';
  stage.innerHTML='';cr.classList.add('on');

  // floating tiles
  const n=sel.length,tiles=[];
  const dx=Math.min(150,stage.clientWidth/2-42);
  const SLOTS=[[-dx,12],[dx,12],[-92,-128],[92,-128]]; // слева, справа, сверху слева, сверху справа
  sel.forEach((g,i)=>{
    const d=document.createElement('div');d.className='ft';
    d.appendChild(tileEl(g,{badge:false}));
    const [x,y]=SLOTS[i];
    d.style.transform=`translate(${x}px,${y}px)`;
    stage.appendChild(d);tiles.push(d);
  });
  // cube
  const faces=[];
  const order=[0,1,2,3,4,5].sort(()=>Math.random()-.5);
  const faceData=Array(6).fill(null);
  sel.forEach((g,i)=>faceData[order[i]]=g);
  const failBd=['Burgundy','Teal','Amber'];
  for(let i=0;i<6;i++)if(!faceData[i])faceData[i]={model:'Burnt',burnt:true,symbol:'Cow',backdrop:'Burgundy',pct:null};
  let winFace;
  if(success)winFace=order[sel.indexOf(win)];
  else winFace=pickR([0,1,2,3,4,5].filter(i=>faceData[i].burnt));
  const scene=document.createElement('div');scene.className='scene';
  const cube=document.createElement('div');cube.className='cube';
  faceData.forEach((g,i)=>{
    const f=document.createElement('div');f.className='face';
    f.appendChild(emptyFace());cube.appendChild(f);faces.push(f);
  });
  const fillFace=i=>{
    const g=faceData[i];const tl=tileEl(g,{badge:false});
    if(g.burnt){tl.style.setProperty('--c1','#2a1a1d');tl.style.setProperty('--c2','#4a2b30')}
    tl.classList.add('fill');faces[i].innerHTML='';faces[i].appendChild(tl);
  };
  scene.appendChild(cube);stage.appendChild(scene);
  // sparks
  const sparks=[];for(let i=0;i<14;i++){const s=document.createElement('i');s.className='spark';stage.appendChild(s);sparks.push(s)}

  await sleep(300);
  scene.classList.add('on');
  let cur={rx:-12,ry:-35};
  cube.style.transition='none';
  cube.style.transform=`rotateX(${cur.rx}deg) rotateY(${cur.ry}deg)`;
  await sleep(500);

  // поворот к нужной грани: направление и число оборотов случайные
  const toward=(c,t,dir,turns)=>{
    let d=(((t-c)%360)+360)%360;
    if(dir<0)d=d===0?-360:d-360;
    return c+d+360*turns*dir;
  };
  const rotate=async(face,dur,ease,opt={})=>{
    const tg=TARGET[face];
    const dir=opt.dir||(Math.random()<.5?1:-1);
    const turns=opt.turns??(Math.random()<.4?1:0);
    const tilt=opt.exact||tg[0]!==0?0:-8;
    cur={rx:toward(cur.rx,tg[0]+tilt,dir,turns),ry:toward(cur.ry,tg[1],dir*(Math.random()<.5?1:-1),turns)};
    cube.style.transition=`transform ${dur}ms ${ease}`;
    cube.style.transform=`rotateX(${cur.rx}deg) rotateY(${cur.ry}deg)`;
    await sleep(dur);
  };

  // каждый подарок: куб случайно крутится к пустой ячейке, подарок прилетает спереди и прикрепляется
  for(let k=0;k<n;k++){
    const f=order[k];
    await rotate(f,800+Math.random()*250,'cubic-bezier(.45,.05,.25,1)',{exact:true});
    await sleep(250); // кубик полностью остановился
    const tl=tiles[k];
    tl.style.transition='transform .6s cubic-bezier(.3,.1,.2,1),opacity .15s';
    tl.style.transform='translate(0,0) scale(1.95)';
    await sleep(600);
    fillFace(f);burst(sparks);
    tl.style.opacity='0';
    if(navigator.vibrate)navigator.vibrate(12);
    await sleep(220);
  }

  // ещё пара случайных прокрутов, затем остановка на выпавшей ячейке
  let last=-1;
  for(let i=0;i<2;i++){
    let f;do{f=Math.floor(Math.random()*6)}while(f===last||f===winFace);last=f;
    await rotate(f,650,'cubic-bezier(.45,.05,.25,1)',{turns:0});
  }
  await rotate(winFace,2300,'cubic-bezier(.2,.65,.2,1)',{turns:1,dir:Math.random()<.5?1:-1,exact:true});
  await sleep(250);
  faces[winFace].classList.add('win');
  scene.classList.add('pop');
  if(navigator.vibrate)navigator.vibrate([30,40,60]);
  await sleep(1100);

  // apply result to inventory
  const ids=new Set(sel.map(g=>g.id));
  inv=inv.filter(g=>!ids.has(g.id));
  if(success)inv.unshift(result);
  renderGrid();
  cr.classList.remove('on');
  showResult(success,result);
  busy=false;
}
function burst(sparks){
  sparks.forEach(s=>{
    const a=Math.random()*Math.PI*2,d=rnd(70,150);
    s.style.transition='none';s.style.opacity='1';s.style.transform='translate(-50%,-50%)';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      s.style.transition='transform .6s ease-out,opacity .6s';
      s.style.transform=`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d}px)) scale(.3)`;
      s.style.opacity='0';
    }));
  });
}

/* ================= result ================= */
function showResult(ok,g){
  const res=$('#result');res.className='';res.innerHTML='';
  if(!ok){
    res.classList.add('on','bad');
    res.innerHTML=`<div class="failbox"></div><button class="ok">Хорошо</button>`;
    const fb=res.querySelector('.failbox');
    const t=tileEl({model:'Burnt',burnt:true,symbol:'Cow',backdrop:'Burgundy',pct:null},{badge:false});
    t.style.setProperty('--c1','#2a1a1d');t.style.setProperty('--c2','#4a2b30');
    fb.appendChild(t);
    fb.insertAdjacentHTML('beforeend','<h2>Крафт не удался</h2><p>Не повезло: все выбранные подарки сгорели.</p>');
    res.querySelector('.ok').onclick=()=>res.classList.remove('on');
    return;
  }
  const b=BACKDROPS[g.backdrop],sym=SYMBOLS[g.symbol];
  const rar=m=>m<3?'редкий':m<9?'необычный':'обычный';
  const bdR=BACKDROPS[g.backdrop][2],mR=MODELS[g.model].r;
  const val=Math.round(rnd(9000,60000))+Math.round(Math.random()*99)/100;
  const iss=Math.floor(rnd(300000,599000));
  res.classList.add('on');
  res.innerHTML=`
  <div class="hero" style="background:linear-gradient(${b[0]},${b[1]})">
    <div class="glow" style="background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.35),transparent 60%)"></div>
    <div class="gcake">${cakeSVG(g.model)}</div>
    <h2>Торт</h2><p>Коллекционный подарок №${fmt(g.num)}</p>
  </div>
  <div class="acts" style="background:transparent"><div><span>💎</span>перевести</div><div><span>👑</span>надеть</div><div><span>🏷️</span>продать</div></div>
  <div class="tbl">
    <div class="row"><b>Владелец</b><span style="color:#2a8cf0">@gift_lab</span></div>
    <div class="row"><b>Модель</b><span>${MODEL_NAMES[g.model]}<i>${rar(mR)}</i></span></div>
    <div class="row"><b>Символ</b><span>${SYMBOL_NAMES[g.symbol]} ${sym[0]}<i>${sym[1]}%</i></span></div>
    <div class="row"><b>Фон</b><span>${BACKDROP_NAMES[g.backdrop]}<i>${bdR}%</i></span></div>
    <div class="row"><b>Выпущено</b><span>${fmt(iss)} из 599 519</span></div>
    <div class="row"><b>Стоимость</b><span>~${val.toLocaleString('ru-RU',{minimumFractionDigits:2})} ★<i style="background:#eaf2fd;color:#2a8cf0">подробнее</i></span></div>
  </div>
  <div class="vis">Подарок виден в профиле. <a>Скрыть в профиле ›</a></div>
  <button class="ok">Хорошо</button>`;
  res.querySelector('.ok').onclick=()=>{res.classList.remove('on');stopConf()};
  confetti();
}

/* confetti */
const cv=$('#conf'),cx=cv.getContext('2d');let parts=[],raf=0;
function confetti(){
  cv.width=cv.clientWidth*devicePixelRatio;cv.height=cv.clientHeight*devicePixelRatio;
  const W=cv.width,H=cv.height,cols=['#ff5b5b','#ffb21e','#34c759','#2a8cf0','#b05be0','#ff6fb0'];
  parts=[];for(let i=0;i<150;i++)parts.push({x:W/2+rnd(-60,60),y:H*.3,vx:rnd(-9,9)*devicePixelRatio,vy:rnd(-16,-2)*devicePixelRatio,r:rnd(3,7)*devicePixelRatio,c:pickR(cols),life:rnd(80,170),rot:rnd(0,6),shape:Math.random()<.5});
  cancelAnimationFrame(raf);
  const tick=()=>{
    cx.clearRect(0,0,W,H);parts=parts.filter(p=>p.life>0&&p.y<H+20);
    parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.35*devicePixelRatio;p.vx*=.99;p.life--;p.rot+=.2;
      cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillStyle=p.c;cx.globalAlpha=Math.min(1,p.life/40);
      p.shape?cx.fillRect(-p.r,-p.r/2,p.r*2,p.r):(cx.beginPath(),cx.arc(0,0,p.r/1.5,0,7),cx.fill());cx.restore()});
    if(parts.length)raf=requestAnimationFrame(tick);
  };tick();
}
function stopConf(){cancelAnimationFrame(raf);cx.clearRect(0,0,cv.width,cv.height)}

function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),1800)}
renderGrid();
