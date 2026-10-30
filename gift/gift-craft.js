/* ================= inventory data ================= */
const rnd=(a,b)=>a+Math.random()*(b-a);
const pickR=a=>a[Math.floor(Math.random()*a.length)];
const $=s=>document.querySelector(s);
const fmt=n=>n.toLocaleString('ru-RU');
const loginStreakPromise=window.VyrnApi?.recordLoginStreak
  ?window.VyrnApi.recordLoginStreak().catch(error=>{
    console.error('Не удалось записать вход для серии:',error);
    return null;
  })
  :Promise.resolve(null);
const createStarsIcon=()=>{
  const icon=document.createElement('img');
  icon.className='stars-inline-icon';
  icon.src='../assets/stars.png';
  icon.alt='звёзд';
  return icon;
};
const getCraftChance=({attributes={}}={})=>{
  const value=Number(attributes.fragment_price_stars);
  if(!Number.isFinite(value)||value<0)return 18;
  if(value<=100)return 18;
  if(value<=200)return 20;
  if(value<300)return 20+(value-200)*.05;
  return 25;
};
const mapNft=item=>{
  const model=item.nft_models||{},collection=model.nft_collections||{};
  const id=item.external_id||item.id.slice(0,8);
  const slug=collection.slug||'';
  const visualId=item.attributes?.crafting?.visual_external_id||item.external_id;
  return {
    itemId:item.id,
    modelId:model.id||'',
    id,
    name:model.name||collection.name||'NFT',
    previewUrl:slug&&visualId
      ?`https://nft.fragment.com/gift/${slug}-${visualId}.webp`
      :model.preview_url||'../assets/placeholder.png',
    animationUrl:model.animation_url||(slug&&visualId
      ?`https://nft.fragment.com/gift/${slug}-${visualId}.tgs`
      :''),
    modelSlug:model.slug||'',
    collectionName:collection.name||'VYRN',
    collectionSlug:slug,
    attributes:item.attributes||{},
    pct:getCraftChance(item),
    isListed:(item.market_listings||[]).some(listing=>listing.status==='active')
  };
};
function tileEl(g,o={}){
  if(g.burnt){
    const burned=emptyFace();
    burned.classList.add('burnt');
    return burned;
  }
  const d=document.createElement('div');d.className='tile';
  d.style.setProperty('--c1','#26344a');d.style.setProperty('--c2','#42617e');
  const image=document.createElement('img');
  image.src=g.previewUrl||'../assets/placeholder.png';
  image.alt=`${g.name||'NFT'} #${g.id||''}`;
  image.style.cssText='position:absolute;inset:0%;width:100%;border-radius:20%;height:100%;object-fit:contain;z-index:1';
  d.appendChild(image);
  if(o.badge!==false&&g.pct!=null){
    const badge=document.createElement('span');badge.className='badge';badge.textContent=`${Number(g.pct.toFixed(1))}%`;d.appendChild(badge);
  }
  if(o.x){
    const remove=document.createElement('span');remove.className='x';remove.textContent='✕';d.appendChild(remove);
  }
  if(o.num){
    const number=document.createElement('span');number.className='num';number.textContent=`#${g.id}`;d.appendChild(number);
  }
  return d;
}

function emptyFace(){
  const d=document.createElement('div');d.className='tile empty';
  d.innerHTML='<img class="empty-anvil" src="./anvil.svg" alt="">';
  return d;
}
/* ================= state ================= */
let inv=[];
let slots=[null,null,null,null];
let busy=false;
let inventoryLoaded=false;

/* ================= inventory ================= */
function renderGrid(){
  const g=$('#grid');g.innerHTML='';g.setAttribute('aria-busy','false');
  inv.forEach(x=>{const t=tileEl(x,{num:true});t.onclick=()=>{openCraft(x)};g.appendChild(t)});
  $('#cnt').textContent=inv.length+' NFT';
  if(!inv.length){
    const empty=document.createElement('div');
    empty.className='inventory-empty';
    empty.textContent='В коллекции пока нет NFT для крафта';
    g.appendChild(empty);
  }
}
async function refreshCraftBalance(){
  const balance=document.querySelector('.star-balance');
  balance?.classList.add('balance-skeleton');
  try{
    await loginStreakPromise;
    const {wallets=[]}=await window.VyrnApi.me();
    const stars=wallets.find(wallet=>wallet.currency==='stars');
    if(!stars)return;
    const label=balance?.querySelector('span');
    if(!balance||!label)return;
    label.textContent=Number(stars.balance).toLocaleString('ru-RU');
    balance.setAttribute('aria-label',`Баланс: ${label.textContent} звёзд`);
  }catch(error){
    console.error('Не удалось загрузить баланс звёзд:',error);
  }finally{
    balance?.classList.remove('balance-skeleton');
  }
}
$('#openCraft').onclick=()=>openCraft();
async function loadInventory(notify=true){
  const grid=$('#grid');
  if(notify&&!inventoryLoaded){
    $('#cnt').classList.add('inventory-count-skeleton');
    grid.setAttribute('aria-busy','true');
    grid.replaceChildren(...Array.from({length:9},()=>{
      const skeleton=document.createElement('div');
      skeleton.className='tile inventory-skeleton';
      skeleton.setAttribute('aria-hidden','true');
      return skeleton;
    }));
  }
  try{
    const {items}=await window.VyrnApi.myNfts();
    inv=items.map(mapNft).filter(item=>!item.isListed);
    inventoryLoaded=true;
    renderGrid();
    $('#cnt').classList.remove('inventory-count-skeleton');
    return true;
  }catch(error){
    renderGrid();
    $('#cnt').classList.remove('inventory-count-skeleton');
    if(notify)toast(error.message||'Не удалось загрузить NFT');
    return false;
  }
}
async function refreshFragmentPrice(g){
  if(g.priceRefreshStarted)return;
  g.priceRefreshStarted=true;
  g.priceLoading=true;
  renderCraft();
  try{
    const {item}=await window.VyrnApi.refreshNftPrice(g.itemId);
    g.attributes=item.attributes||{};
    g.pct=getCraftChance(g);
  }catch(error){
    g.priceErrorMessage=error.message||'Не удалось загрузить цену Fragment.';
    if(slots.includes(g))toast(g.priceErrorMessage);
  }finally{
    g.priceLoading=false;
    if(slots.includes(g))renderCraft();
  }
}

/* ================= craft modal ================= */
function openCraft(g){
  slots=[null,null,null,null];
  if(g)slots[0]=g;
  renderCraft();
  if(g)refreshFragmentPrice(g);
  $('#bg1').classList.add('on');$('#craftSheet').classList.add('on');
}
function closeCraft(){$('#bg1').classList.remove('on');$('#craftSheet').classList.remove('on')}
$('#closeCraft').onclick=closeCraft;$('#bg1').onclick=closeCraft;
$('#helpBtn').onclick=()=>toast('Шансы суммируются. 4 подарка с чёрным фоном редкостью до 1% дают 100%.');

const hasRareBlackBackdrop=g=>{
  const backdrop=g?.attributes?.fragment_traits?.backdrop;
  const rarity=Number(backdrop?.rarity_percent);
  return typeof backdrop?.name==='string'
    &&backdrop.name.toLowerCase().includes('black')
    &&Number.isFinite(rarity)
    &&rarity<=1;
};
function total(){
  const selected=slots.filter(Boolean);
  if(selected.length===4&&selected.every(hasRareBlackBackdrop))return 100;
  return Math.min(100,selected.reduce((sum,g)=>sum+g.pct,0));
}
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
  $('#pcTxt').textContent=`${Number(t.toFixed(1))}%`;
  const collection=slots.find(Boolean)?.collectionName;
  $('#info').textContent=collection
    ?`Одна коллекция: «${collection}». При неудаче NFT сгорят.`
    :'Выбери NFT из одной коллекции, её можно изменить. При неудаче NFT сгорят.';
  const sel=slots.filter(Boolean);
  const ch=$('#chips');ch.replaceChildren();
  sel.forEach(g=>{
    const chip=document.createElement('div');chip.className='chip';
    const ring=document.createElementNS('http://www.w3.org/2000/svg','svg');
    ring.setAttribute('viewBox','0 0 54 54');
    ring.innerHTML='<circle cx="27" cy="27" r="23" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3"/>';
    const image=document.createElement('img');image.src=g.previewUrl;image.alt='';
    image.style.cssText='width:100%;height:100%;object-fit:contain;border-radius:50%';
    const face=document.createElement('div');face.className='in';face.appendChild(image);
    const chance=document.createElement('small');chance.textContent=`${Number(g.pct.toFixed(1))}%`;
    chip.append(ring,face,chance);ch.appendChild(chip);
  });
  const go=$('#goBtn');
  if(!sel.length){go.className='go off';go.innerHTML='Добавь NFT';}
  else{go.className='go green';go.innerHTML=`Скрафтить NFT<small>Шанс успеха: ${Number(t.toFixed(1))}%</small>`}
}
/* picker */
let pickIdx=0;
function openPicker(i){
  pickIdx=i;const used=new Set(slots.filter(Boolean).map(g=>g.itemId));
  const box=$('#pick');box.innerHTML='';
  const collectionSlug=slots.find(Boolean)?.collectionSlug;
  const av=inv.filter(g=>!used.has(g.itemId)&&(!collectionSlug||g.collectionSlug===collectionSlug));
  if(!av.length)box.innerHTML=collectionSlug
    ?'<div class="empty">Нет свободных подарков из этой коллекции</div>'
    :'<div class="empty">Нет свободных подарков</div>';
  av.forEach(g=>{const t=tileEl(g,{num:true});t.onclick=()=>{slots[pickIdx]=g;closePicker();renderCraft();refreshFragmentPrice(g)};box.appendChild(t)});
  $('#bg2').classList.add('on');$('#pickSheet').classList.add('on');$('#pickSheet').style.zIndex=14;
}
function closePicker(){$('#bg2').classList.remove('on');$('#pickSheet').classList.remove('on');$('#varSheet').classList.remove('on')}
$('#bg2').onclick=closePicker;
$('#variants').onclick=()=>{
  const sel=slots.filter(Boolean);if(!sel.length)return toast('Сначала добавь NFT');
  const box=$('#varList');box.innerHTML='';
  sel.forEach(g=>box.appendChild(tileEl(g,{badge:false,num:true})));
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
  if(sel.some(g=>g.priceLoading===true||!Number.isFinite(Number(g.attributes.fragment_price_stars))
    ||Number(g.attributes.fragment_price_stars)<=0)){
    busy=false;
    const failedPrice=sel.find(g=>g.priceErrorMessage);
    toast(failedPrice?.priceErrorMessage||'Дождись загрузки цены Fragment для выбранных NFT');
    return;
  }
  let outcome;
  try{
    outcome=await window.VyrnApi.craftNfts(sel.map(g=>g.itemId));
  }catch(error){
    busy=false;
    const synced=await loadInventory(false);
    toast(synced
      ?error.message||'Не удалось выполнить крафт'
      :`${error.message||'Не удалось выполнить крафт'}. Не удалось обновить коллекцию.`);
    return;
  }
  const success=outcome.success===true;
  const t=Number(outcome.chance);
  const result=success&&outcome.item?mapNft(outcome.item):null;
  if(!Number.isFinite(t)||(success&&!result)){
    busy=false;
    const synced=await loadInventory(false);
    toast(synced
      ?'Сервер вернул некорректный результат крафта'
      :'Сервер вернул некорректный результат крафта. Не удалось обновить коллекцию.');
    return;
  }
  const win=result?sel.find(g=>g.modelId===result.modelId)||sel[0]:null;

  closeCraft();
  const cr=$('#crafting'),stage=$('#stage');
  $('#cPc').textContent=`Шанс успеха: ${Number(t.toFixed(1))}%`;
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
  for(let i=0;i<6;i++)if(!faceData[i])faceData[i]={burnt:true,pct:null};
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
  const ids=new Set(outcome.consumed_ids||sel.map(g=>g.itemId));
  inv=inv.filter(g=>!ids.has(g.itemId));
  if(success)inv.unshift(result);
  renderGrid();
  cr.classList.remove('on');
  const inputTotal=sel.reduce((sum,g)=>sum+Number(g.attributes.fragment_price_stars),0);
  showResult(success,result,t,sel[0],inputTotal,sel.length);
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
function showResult(ok,g,chance,consumedNft,inputTotal,inputCount){
  const res=$('#result');res.className='';res.innerHTML='';
  if(!ok){
    res.classList.add('on','bad');
    res.innerHTML=`<div class="failbox"></div><button class="ok">Хорошо</button>`;
    const fb=res.querySelector('.failbox');
    if(consumedNft)fb.appendChild(tileEl(consumedNft,{badge:false,num:true}));
    const title=document.createElement('h2');title.textContent='Крафт не удался';
    const description=document.createElement('p');
    description.append(
      document.createTextNode(`Шанс успеха не сработал. Сгорели все ${inputCount} NFT на сумму ${fmt(inputTotal)} `),
      createStarsIcon(),
      document.createTextNode('.')
    );
    fb.append(title,description);
    res.querySelector('.ok').onclick=()=>res.classList.remove('on');
    return;
  }
  res.classList.add('on');
  res.innerHTML=`
  <section class="craft-result-modal" role="dialog" aria-modal="true" aria-label="Скрафтченный NFT">
    <div class="nft-modal-art">
      <div class="nft-modal-backdrop" aria-hidden="true"></div>
      <button class="nft-modal-close" type="button" aria-label="Закрыть окно">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
      <div class="nft-modal-animation" aria-hidden="true"></div>
      <div class="nft-modal-heading">
        <h2></h2><p class="nft-modal-collection"></p>
      </div>
    </div>
    <div class="nft-modal-details">
      <dl class="nft-modal-metadata"></dl>
      <button class="nft-modal-confirm" type="button">OK</button>
    </div>
  </section>`;
  const modal=res.querySelector('.craft-result-modal');
  const art=res.querySelector('.nft-modal-art');
  const animation=res.querySelector('.nft-modal-animation');
  const backdrop=res.querySelector('.nft-modal-backdrop');
  res.querySelector('.nft-modal-heading h2').textContent=`${g.name} #${g.id}`;
  res.querySelector('.nft-modal-collection').textContent=`Коллекция ${g.collectionName}`;
  const value=g.attributes.fragment_price_stars;
  const rows=[
    ['Коллекция',g.collectionName],
    [g.attributes.fragment_price_crafted_total===true?'Цена (сумма входных NFT)':'Ценность (FRAGMENT)',value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))?fmt(Number(value)):'Не указана',value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))],
    ['Фон',g.attributes.fragment_traits?.backdrop?.name||'Не указан'],
    ['Эффект / символ',[
      g.attributes.fragment_traits?.model?.name,
      g.attributes.fragment_traits?.symbol?.name
    ].filter(Boolean).join(' · ')||'Не указан']
  ];
  const table=res.querySelector('.nft-modal-metadata');
  rows.forEach(([label,text,hasStars])=>{
    const row=document.createElement('div');
    const heading=document.createElement('dt');heading.textContent=label;
    const entry=document.createElement('dd');entry.textContent=text;
    if(hasStars)entry.append(' ',createStarsIcon());
    row.append(heading,entry);table.appendChild(row);
  });
  const closeResult=()=>{
    res.classList.remove('on');
    resultAnimations.forEach(instance=>instance.destroy());
    resultAnimations=[];
    stopConf();
  };
  res.querySelector('.nft-modal-close').onclick=closeResult;
  res.querySelector('.nft-modal-confirm').onclick=closeResult;
  const resultPreview=()=>{
    const image=document.createElement('img');
    image.className='nft-modal-preview';
    image.src=g.previewUrl||'../assets/placeholder.png';
    image.alt=`${g.name} #${g.id}`;
    animation.replaceChildren(image);
    animation.classList.add('is-ready');
    const backdropImage=image.cloneNode();
    backdropImage.className='nft-modal-backdrop-preview';
    backdrop.replaceChildren(backdropImage);
    backdrop.classList.add('is-ready');
    art.classList.add('is-ready');
  };
  loadCraftResultAnimation(g,animation,backdrop,art,modal,resultPreview);
  confetti();
}

let resultAnimations=[];
async function loadCraftResultAnimation(g,animation,backdrop,art,modal,onFallback){
  try{
    if(!window.lottie||typeof DecompressionStream==='undefined'||!g.animationUrl)throw new Error('NFT animation is unavailable');
    const response=await fetch(g.animationUrl,{cache:'no-store'});
    if(!response.ok)throw new Error(`NFT animation request failed: ${response.status}`);
    const source=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
    if(!modal.isConnected||!$('#result').classList.contains('on'))return;
    const giftData=structuredClone(source);
    const giftLayer=giftData.layers.find(layer=>layer.nm==='Gift');
    if(!giftLayer)throw new Error('Gift animation layer is missing');
    const scaleData=giftLayer.ks?.s?.k;
    const shrinkScale=values=>{
      if(Array.isArray(values)&&values.length>=2){values[0]*=.7;values[1]*=.7}
    };
    if(Array.isArray(scaleData)){
      if(typeof scaleData[0]==='number')shrinkScale(scaleData);
      else scaleData.forEach(keyframe=>{shrinkScale(keyframe.s);shrinkScale(keyframe.e)});
    }
    giftData.layers=[giftLayer];
    const backdropData=structuredClone(source);
    backdropData.layers=backdropData.layers.filter(layer=>layer.nm!=='Gift');
    if(!backdropData.layers.length)throw new Error('Gift backdrop animation is missing');
    const backdropAnimation=window.lottie.loadAnimation({
      container:backdrop,renderer:'svg',loop:false,autoplay:false,animationData:backdropData
    });
    const giftAnimation=window.lottie.loadAnimation({
      container:animation,renderer:'svg',loop:false,autoplay:true,animationData:giftData
    });
    resultAnimations=[backdropAnimation,giftAnimation];
    backdropAnimation.addEventListener('DOMLoaded',()=>{
      backdrop.querySelector('svg')?.setAttribute('preserveAspectRatio','xMidYMid slice');
      backdropAnimation.goToAndStop(0,true);
      backdrop.classList.add('is-ready');
    });
    giftAnimation.addEventListener('DOMLoaded',()=>{
      animation.querySelector('svg')?.setAttribute('preserveAspectRatio','xMidYMid slice');
      animation.classList.add('is-ready');
      art.classList.add('is-ready');
    });
  }catch{
    if(modal.isConnected&&$('#result').classList.contains('on'))onFallback();
  }
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
loadInventory();
refreshCraftBalance();
