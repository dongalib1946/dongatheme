
(function(){
  const posterArea = document.getElementById('posterArea');
  const posterImg  = document.getElementById('posterImg');

  function applyPosterBg(){
    if(!posterImg || !posterArea) return;
    const url = posterImg.currentSrc || posterImg.src;
    if(url){
      posterArea.style.setProperty('--poster-bg', `url("${url}")`);
    }
  }
  if(posterImg.complete){ applyPosterBg(); }
  posterImg.addEventListener('load', applyPosterBg);
})();


document.addEventListener('contextmenu', (e)=>{ if(e.target.tagName==='IMG') e.preventDefault(); }, {capture:true});
document.addEventListener('dragstart', (e)=>{ if(e.target.tagName==='IMG') e.preventDefault(); }, {capture:true});

(function(){
  const MUSIC_SRC = 'assets/music/Lakeside%20Serenity%20-%20Gentle%20Cafe%20Piano%20Jazz%20for%20Work%2C%20Focus%20%26%20Relaxation%20-%20Glasshouse%20Keys.mp3';
  const VOLUME_KEY = 'kioskBgmVolume';
  const bgm = new Audio(MUSIC_SRC);
  bgm.loop = true;
  bgm.preload = 'auto';
  bgm.volume = readStoredVolume();

  const controls = document.createElement('div');
  controls.className = 'kiosk-bgm-controls';

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'kiosk-bgm-toggle';
  toggleButton.setAttribute('aria-label', 'Background music play or pause');
  toggleButton.innerHTML = '<span class="fa fa-pause" aria-hidden="true"></span>';

  const volumeControl = document.createElement('input');
  volumeControl.type = 'range';
  volumeControl.className = 'kiosk-bgm-volume';
  volumeControl.min = '0';
  volumeControl.max = '1';
  volumeControl.step = '0.01';
  volumeControl.value = String(bgm.volume);
  volumeControl.setAttribute('aria-label', 'Background music volume');

  controls.appendChild(volumeControl);
  controls.appendChild(toggleButton);
  document.body.appendChild(controls);

  let userPaused = false;
  let retryTimer = null;
  let resilientObjectUrl = '';
  let usingResilientSource = false;

  function readStoredVolume(){
    try{
      const stored = Number(localStorage.getItem(VOLUME_KEY));
      if(Number.isFinite(stored)) return Math.max(0, Math.min(1, stored));
    }catch(err){
      console.warn('[BGM] volume preference unavailable.', err);
    }
    return 0.42;
  }

  function storeVolume(value){
    try{
      localStorage.setItem(VOLUME_KEY, String(value));
    }catch(err){
      console.warn('[BGM] volume preference unavailable.', err);
    }
  }

  function syncControl(){
    toggleButton.classList.toggle('is-paused', bgm.paused);
    toggleButton.setAttribute('aria-pressed', String(!bgm.paused));
    toggleButton.innerHTML = bgm.paused
      ? '<span class="fa fa-play" aria-hidden="true"></span>'
      : '<span class="fa fa-pause" aria-hidden="true"></span>';
    volumeControl.style.setProperty('--bgm-volume', `${Math.round(bgm.volume * 100)}%`);
  }

  function playMusic(){
    if(userPaused) return;
    bgm.play().then(syncControl).catch(syncControl);
  }

  function clearRecovery(){
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  function switchToResilientSource(){
    if(!resilientObjectUrl || usingResilientSource) return;

    const wasPaused = bgm.paused;
    const position = Number.isFinite(bgm.currentTime) ? bgm.currentTime : 0;
    usingResilientSource = true;
    bgm.pause();
    bgm.src = resilientObjectUrl;
    bgm.load();

    bgm.addEventListener('loadedmetadata', ()=>{
      if(Number.isFinite(bgm.duration) && bgm.duration > 0){
        bgm.currentTime = position % bgm.duration;
      }
      if(!wasPaused && !userPaused) playMusic();
      syncControl();
    }, { once:true });
  }

  function scheduleRecovery(){
    if(userPaused) return;
    clearRecovery();
    retryTimer = setTimeout(()=>{
      if(resilientObjectUrl && !usingResilientSource){
        switchToResilientSource();
        return;
      }
      bgm.load();
      playMusic();
    }, 1800);
  }

  async function warmResilientSource(){
    if(!window.fetch || !window.URL || !window.Blob) return;
    try{
      const res = await fetch(MUSIC_SRC, { cache:'force-cache' });
      if(!res.ok) throw new Error(`BGM preload failed: ${res.status}`);
      const blob = await res.blob();
      resilientObjectUrl = URL.createObjectURL(blob);
      switchToResilientSource();
    }catch(err){
      console.warn('[BGM] resilient preload failed.', err);
    }
  }

  toggleButton.addEventListener('click', (event)=>{
    event.stopPropagation();
    if(bgm.paused){
      userPaused = false;
      playMusic();
    }else{
      userPaused = true;
      bgm.pause();
      syncControl();
    }
  });

  volumeControl.addEventListener('input', ()=>{
    const volume = Math.max(0, Math.min(1, Number(volumeControl.value) || 0));
    bgm.volume = volume;
    storeVolume(volume);
    syncControl();
  });

  ['pointerdown','touchstart','keydown'].forEach((eventName)=>{
    window.addEventListener(eventName, playMusic, { passive:true });
  });

  ['stalled','waiting','error','emptied'].forEach((eventName)=>{
    bgm.addEventListener(eventName, scheduleRecovery);
  });

  ['canplay','canplaythrough','playing'].forEach((eventName)=>{
    bgm.addEventListener(eventName, clearRecovery);
  });

  bgm.addEventListener('play', syncControl);
  bgm.addEventListener('pause', syncControl);
  bgm.addEventListener('ended', playMusic);

  setInterval(()=>{
    if(!userPaused && bgm.paused) playMusic();
  }, 15000);

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', playMusic, { once:true });
  }else{
    playMusic();
  }
  warmResilientSource();
})();

const track = document.getElementById('track');
const viewport = document.querySelector('.carousel');
const prev = document.getElementById('prev');
const next = document.getElementById('next');
const INITIAL_BOOK_ITEMS_HTML = track ? track.innerHTML : '';

let cards = [];

function attachBookClickHandlers(root = track){
  root.querySelectorAll('.book img').forEach(img=>{
    img.addEventListener('click', ()=> openModal(img));
    img.setAttribute('draggable','false');
    img.setAttribute('oncontextmenu','return false;');
  });
}

function resetCarouselItems(){
  if(!track) return;
  cards = Array.from(track.children);
  cards.forEach(card=> track.appendChild(card.cloneNode(true)));
  attachBookClickHandlers(track);
  offset = 0;
  speed = -40;
  targetSpeed = -40;
  track.style.transform = 'translateX(0px)';
}

let offset = 0;
let speed = -40;
let targetSpeed = -40;
let last = performance.now();

resetCarouselItems();

function contentWidth(){ return track.scrollWidth / 2; }
function viewWidth(){ return viewport.clientWidth; }

function wrapOffset(){
  const half = contentWidth();
  while (offset <= -half) offset += half;
  while (offset > 0) offset -= half;
}

function loop(now){
  const dt = (now - last) / 1000; last = now;
  if(!draggingCarousel){
    const blend = 1 - Math.pow(0.985, Math.max(1, dt*60));
    speed = speed + (targetSpeed - speed) * blend;
    offset += speed * dt;
    wrapOffset();
    track.style.transform = `translateX(${offset}px)`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame((t)=>{ last=t; loop(t); });

let draggingCarousel = false;
let startX = 0, startOffset = 0, lastX = 0, lastT = 0, vx = 0;

function pointerX(e){ return (e.touches ? e.touches[0].clientX : e.clientX); }

function onPointerDown(e){
  draggingCarousel = true;
  startX = pointerX(e); startOffset = offset;
  lastX = startX; lastT = performance.now();
  speed = 0; bumpInteract();
}
function onPointerMove(e){
  if(!draggingCarousel) return;
  const x = pointerX(e);
  offset = startOffset + (x - startX);
  wrapOffset();
  track.style.transform = `translateX(${offset}px)`;
  const now = performance.now(); const dx = x - lastX; const dt = Math.max(0.001, (now - lastT) / 1000);
  vx = dx / dt; lastX = x; lastT = now;
}
function onPointerUp(){
  if(!draggingCarousel) return;
  draggingCarousel = false;
  const maxSpeed = 600;
  speed = Math.max(-maxSpeed, Math.min(maxSpeed, vx));
  targetSpeed = -40; bumpInteract();
}
viewport.addEventListener('mousedown', onPointerDown, {passive:true});
window.addEventListener('mousemove', onPointerMove, {passive:true});
window.addEventListener('mouseup', onPointerUp, {passive:true});
viewport.addEventListener('touchstart', onPointerDown, {passive:true});
window.addEventListener('touchmove', onPointerMove, {passive:false});
window.addEventListener('touchend', onPointerUp, {passive:true});

function nudge(dir){
  const step = viewWidth();
  const impulse = (dir < 0 ? -1 : 1) * 500;
  offset += dir * step * 0.02; wrapOffset();
  track.style.transform = `translateX(${offset}px)`;
  speed = impulse; targetSpeed = -40; bumpInteract();
}
prev.addEventListener('click', ()=> nudge(+1));
next.addEventListener('click', ()=> nudge(-1));


const modal = document.getElementById('bookModal');
const mCover = document.getElementById('mCover');
const mTitle = document.getElementById('mTitle');
const mAuthor = document.getElementById('mAuthor');
const mDesc = document.getElementById('mDesc');
const mLoc = document.getElementById('mLoc');
const mClose = document.getElementById('mClose');
const mCountdown = document.getElementById('mCountdown');

let countdownTimer = null; let lastInteract = Date.now();

function openModal(img){
  mCover.src = img.src; mCover.draggable = false;
  mTitle.textContent = img.dataset.title || '';
  mAuthor.textContent = img.dataset.author || '';
  mDesc.textContent = img.dataset.desc || '';
  mLoc.textContent = '';
  if(img.dataset.loc){
    mLoc.appendChild(document.createTextNode(img.dataset.loc));
  }
  modal.setAttribute('aria-hidden','false');
  mCountdown.textContent = 15;
  lastInteract = Date.now();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(()=>{
    const idleSec = Math.floor((Date.now()-lastInteract)/1000);
    const left = Math.max(0, 15 - idleSec);
    mCountdown.textContent = left;
    if(left <= 0){ closeModal(); }
  }, 250);
}
function closeModal(){
  modal.setAttribute('aria-hidden','true');
  clearInterval(countdownTimer); countdownTimer=null;
}
modal.addEventListener('mousemove', ()=> lastInteract = Date.now());
modal.addEventListener('touchstart', ()=> lastInteract = Date.now(), {passive:true});
mClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e)=>{ if(e.target === modal) closeModal(); });

const ALADIN_BOOK_CONFIG = {
  queryType: 'Bestseller',
  maxResults: 20,
  searchTarget: 'Book',
  cover: 'Big',
  version: 'aladin-bestseller-v1',
};

const BOOK_COVER_FALLBACK = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 viewBox%3D%220 0 300 420%22%3E%3Crect width%3D%22300%22 height%3D%22420%22 fill%3D%22%23eef2f7%22/%3E%3Crect x%3D%2236%22 y%3D%2240%22 width%3D%22228%22 height%3D%22340%22 rx%3D%2218%22 fill%3D%22%23ffffff%22 stroke%3D%22%23cbd5e1%22 stroke-width%3D%224%22/%3E%3Ctext x%3D%22150%22 y%3D%22208%22 text-anchor%3D%22middle%22 font-family%3D%22Arial%2C sans-serif%22 font-size%3D%2228%22 font-weight%3D%22700%22 fill%3D%22%2364758b%22%3ENo Cover%3C/text%3E%3C/svg%3E';

function cleanBookText(value){
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value || '');
  return textarea.value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function createBookCard(book){
  const wrap = document.createElement('div');
  wrap.className = 'book';

  const img = document.createElement('img');
  const title = cleanBookText(book.title);
  const author = cleanBookText(book.author);
  const publisher = cleanBookText(book.publisher);
  const pubDate = cleanBookText(book.pubDate);
  const status = cleanBookText(book.stockStatus || book.customerReviewRank || '');
  const desc = cleanBookText(book.description);
  const librarySource = cleanBookText(book.librarySource || '');
  const libraryCollection = cleanBookText(book.libraryCollection || '');

  img.src = book.cover || BOOK_COVER_FALLBACK;
  img.alt = title || 'Book cover';
  img.dataset.title = title || '제목 정보 없음';
  img.dataset.author = [author, publisher].filter(Boolean).join(' | ') || '저자 정보 없음';
  img.dataset.desc = desc || '알라딘에서 책 소개를 제공하지 않았습니다.';
  /*
  img.dataset.loc = [
    pubDate ? `출간일: ${pubDate}` : '',
    '도서 DB 제공: 알라딘 인터넷서점',
    status && Number.isNaN(Number(status)) ? status : '',
  ].filter(Boolean).join(' | ');
  */
  img.dataset.title = title || '\uC81C\uBAA9 \uC815\uBCF4 \uC5C6\uC74C';
  img.dataset.author = [author, publisher].filter(Boolean).join(' | ') || '\uC800\uC790 \uC815\uBCF4 \uC5C6\uC74C';
  img.dataset.desc = desc || 'No description from Aladin.';
  img.dataset.loc = [
    pubDate ? `\uCD9C\uAC04\uC77C: ${pubDate}` : '',
    librarySource || '\uB3C4\uC11C DB \uC81C\uACF5: \uC54C\uB77C\uB518 \uC778\uD130\uB137\uC11C\uC810',
    libraryCollection ? `\uCEEC\uB809\uC158: ${libraryCollection}` : '',
    librarySource ? '\uC0C1\uC138\uC815\uBCF4: \uC54C\uB77C\uB518 \uC778\uD130\uB137\uC11C\uC810' : '',
    status && Number.isNaN(Number(status)) ? status : '',
  ].filter(Boolean).join(' | ');
  img.dataset.url = book.link || '';
  img.onerror = () => { img.src = BOOK_COVER_FALLBACK; };

  wrap.appendChild(img);
  return wrap;
}

function renderAladinBooks(items){
  const books = (items || []).filter(item=> item && (item.title || item.cover));
  if(!books.length) return false;

  track.innerHTML = '';
  books.forEach(book=> track.appendChild(createBookCard(book)));
  resetCarouselItems();
  return true;
}

function renderBookStatus(message){
  if(!track) return;
  track.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'book';
  wrap.style.flex = '1 0 100%';
  wrap.style.display = 'grid';
  wrap.style.placeItems = 'center';
  wrap.style.color = '#111827';
  wrap.style.fontWeight = '900';
  wrap.style.fontSize = 'clamp(18px, 2vw, 30px)';
  wrap.style.textAlign = 'center';
  wrap.textContent = message;
  track.appendChild(wrap);
  resetCarouselItems();
}

function restoreInitialBookItems(){
  if(!track || !INITIAL_BOOK_ITEMS_HTML) return false;
  track.innerHTML = INITIAL_BOOK_ITEMS_HTML;
  resetCarouselItems();
  return true;
}

async function fetchJsonWithStaticFallback(primaryUrl, fallbackUrl, options = {}){
  try{
    const res = await fetch(primaryUrl, options);
    if(!res.ok) throw new Error(`${primaryUrl} failed: ${res.status}`);
    return await res.json();
  }catch(primaryError){
    if(!fallbackUrl) throw primaryError;
    console.warn('[StaticFallback] primary request failed; trying static JSON.', primaryError);
    const res = await fetch(fallbackUrl, { cache: 'no-store' });
    if(!res.ok) throw new Error(`${fallbackUrl} failed: ${res.status}`);
    return await res.json();
  }
}

async function loadAladinBooks(){
  try{
    const params = new URLSearchParams({
      queryType: ALADIN_BOOK_CONFIG.queryType,
      maxResults: String(ALADIN_BOOK_CONFIG.maxResults),
      searchTarget: ALADIN_BOOK_CONFIG.searchTarget,
      cover: ALADIN_BOOK_CONFIG.cover,
      v: ALADIN_BOOK_CONFIG.version,
    });
    const data = await fetchJsonWithStaticFallback(
      `/.netlify/functions/aladin-books?${params.toString()}`,
      `data/aladin-books.json?v=${encodeURIComponent(ALADIN_BOOK_CONFIG.version)}`,
      { cache: 'default' }
    );
    if(!renderAladinBooks(data.items)){
      if(!restoreInitialBookItems()){
        renderBookStatus('\uD45C\uC2DC\uD560 \uC54C\uB77C\uB518 \uBCA0\uC2A4\uD2B8 \uB3C4\uC11C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.');
      }
    }
  }catch(err){
    console.warn('[Aladin] live book loading failed.', err);
    if(!restoreInitialBookItems()){
      renderBookStatus('\uC54C\uB77C\uB518 \uBCA0\uC2A4\uD2B8 \uB3C4\uC11C\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
    }
  }
}

function scheduleBookRefresh(){
  const run = () => loadAladinBooks();
  if('requestIdleCallback' in window){
    requestIdleCallback(run, { timeout: 3500 });
  }else{
    setTimeout(run, 2200);
  }
}

renderBookStatus('\uC54C\uB77C\uB518 \uBCA0\uC2A4\uD2B8 \uB3C4\uC11C\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.');
scheduleBookRefresh();

const gestureHint = document.getElementById('gestureHint');
const IDLE_BEFORE_HINT_MS = 10000; // 10초
function showSwipeHint(){ if (gestureHint) gestureHint.setAttribute('aria-hidden','false'); }
function hideSwipeHint(){ if (gestureHint) gestureHint.setAttribute('aria-hidden','true'); }
function bumpInteract(){ lastInteract = Date.now(); hideSwipeHint(); }
['mousemove','keydown','click','touchstart','wheel'].forEach(evt=> window.addEventListener(evt, bumpInteract, {passive:true}));
viewport.addEventListener('touchstart', bumpInteract, {passive:true});
viewport.addEventListener('mousedown',  bumpInteract, {passive:true});
prev.addEventListener('click', bumpInteract);
next.addEventListener('click', bumpInteract);
setInterval(()=>{ const idleFor = Date.now() - lastInteract; if (idleFor >= IDLE_BEFORE_HINT_MS) showSwipeHint(); }, 1000);


(function(){
  const INTERVAL_MS = 20000;
  const REFRESH_MS = 10 * 60 * 1000;
  const POSTER_PAGE_CAMPUS = (() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('campus') || params.get('library');
    if(requested === 'bumin') return 'bumin';
    return window.location.pathname.toLowerCase().includes('bumin') ? 'bumin' : 'hallim';
  })();
  const posterArea = document.getElementById('posterArea');
  const posterImg  = document.getElementById('posterImg');

  let files = [];
  let idx = 0;
  let timer = null;
  let refreshTimer = null;
  let refreshing = false;

  
  let nextReady = null;

  function preloadPoster(i){
    if(!files.length) return;
    const n = (i + files.length) % files.length;
    const f = files[n];
    const tried = (f.tried || 0);
    const url = f.candidates && f.candidates[tried];
    if(!url) return;

    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { nextReady = { index: n, url, tried }; };
    im.onerror = () => { if(nextReady && nextReady.index === n) nextReady = null; };
    im.src = url;
  }

  async function fetchStaticPosterImages(){
    const res = await fetch(`data/posters.json?v=${Date.now()}`, { cache: 'no-store' });
    if(!res.ok) throw new Error(`Static poster data failed: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  }

  async function fetchPosterImages(){
    try{
      return await fetchStaticPosterImages();
    }catch(err){
      console.warn('[Drive] static poster data unavailable.', err);
    }

    return [];
  }

  function sortDriveImages(list){
    return list.sort((a,b)=> a.name.localeCompare(b.name, 'ko', {numeric:true, sensitivity:'base'}));
  }

  function normalizePosterName(value){
    const text = String(value || '');
    const normalized = typeof text.normalize === 'function' ? text.normalize('NFKC') : text;
    return normalized
      .replace(/[‐‑‒–—―−]/g, '-')
      .trim();
  }

  function parsePosterDateKey(value){
    const text = normalizePosterName(value);
    const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if(compact) return Number(`${compact[1]}${compact[2]}${compact[3]}`);
    const dashed = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(dashed) return Number(`${dashed[1]}${dashed[2]}${dashed[3]}`);
    return null;
  }

  function currentPosterDateKey(now = new Date()){
    const year = now.getFullYear();
    const month = `0${now.getMonth() + 1}`.slice(-2);
    const day = `0${now.getDate()}`.slice(-2);
    return Number(`${year}${month}${day}`);
  }

  function normalizePosterCampus(value){
    const text = normalizePosterName(value).toLowerCase();
    if(text === '부민' || text === 'bumin') return 'bumin';
    if(text === '승학' || text === '한림' || text === 'hallim') return 'hallim';
    return '';
  }

  function getPosterRules(name){
    const baseName = normalizePosterName(name).replace(/\.[^.]+$/, '');
    const prefix = baseName.split('_')[0] || '';
    const rules = { start: null, end: null, campus: '' };

    const campusOnly = normalizePosterCampus(prefix);
    if(campusOnly){
      rules.campus = campusOnly;
      return rules;
    }

    const datePattern = '(\\d{8}|\\d{4}-\\d{2}-\\d{2})';
    const campusPattern = '(부민|승학|한림|bumin|hallim)';
    const rangeCampus = prefix.match(new RegExp(`^${datePattern}[-~]${datePattern}[-~]${campusPattern}$`, 'i'));
    const range = rangeCampus || prefix.match(new RegExp(`^${datePattern}[-~]${datePattern}$`, 'i'));
    const dateCampus = prefix.match(new RegExp(`^${datePattern}[-~]${campusPattern}$`, 'i'));
    const startOnly = prefix.match(new RegExp(`^${datePattern}$`, 'i'));

    if(range){
      rules.start = parsePosterDateKey(range[1]);
      rules.end = parsePosterDateKey(range[2]);
      if(rangeCampus) rules.campus = normalizePosterCampus(range[3]);
      return rules;
    }

    if(dateCampus){
      rules.start = parsePosterDateKey(dateCampus[1]);
      rules.campus = normalizePosterCampus(dateCampus[2]);
      return rules;
    }

    if(startOnly){
      rules.start = parsePosterDateKey(startOnly[1]);
      return rules;
    }

    return rules;
  }

  function isPosterVisible(file, now = new Date()){
    try{
      const rules = getPosterRules(file && file.name);
      const today = currentPosterDateKey(now);
      if(rules.campus && rules.campus !== POSTER_PAGE_CAMPUS) return false;
      if(rules.start && today < rules.start) return false;
      if(rules.end && today > rules.end) return false;
      return true;
    }catch(err){
      console.warn('[Drive] poster rule skipped:', file && file.name, err);
      return true;
    }
  }

  function preloadInitialPosters(list){
    list.slice(0, Math.min(list.length, 6)).forEach(f=>{
      const im = new Image();
      im.decoding = 'async';
      im.src = f.candidates[0];
    });
  }

  async function refreshDriveImages({ initial = false } = {}){
    if(refreshing) return;
    refreshing = true;
    try{
      const driveFiles = await fetchPosterImages();
      const nextFiles = sortDriveImages(driveFiles.filter(file => isPosterVisible(file)));
      if(!nextFiles.length){
        if(initial){
          console.info('[Drive] 폴더에 이미지가 없거나 접근 불가. 로컬 포스터로 유지합니다.');
        }
        return;
      }

      const current = files[idx];
      files = nextFiles;
      nextReady = null;
      preloadInitialPosters(files);

      if(initial){
        setPoster(0);
        startLoop();
        return;
      }

      if(!current){
        setPoster(0);
        startLoop();
        return;
      }

      const sameIndex = current ? files.findIndex(f => f.id === current.id) : -1;
      if(sameIndex >= 0){
        idx = sameIndex;
        preloadPoster(idx + 1);
      }else{
        setPoster(Math.min(idx, files.length - 1));
      }
    }finally{
      refreshing = false;
    }
  }

  function setPoster(i){
    if(!files.length) return;
    idx = (i + files.length) % files.length;
    const f = files[idx];
    posterImg.alt = f.name || '포스터';
    posterImg.src = f.candidates[f.tried || 0];
    preloadPoster(idx + 1);
  }

  function nextPoster(){
    if(!files.length) return;
    const want = (idx + 1) % files.length;
    if(nextReady && nextReady.index === want){
      idx = want;
      const f = files[idx];
      posterImg.alt = f.name || '포스터';
      posterImg.src = nextReady.url;
      nextReady = null;
      preloadPoster(idx + 1);
      return;
    }
    setPoster(idx + 1);
  }
  function prevPoster(){ setPoster(idx - 1); }

  function startLoop(){
    clearInterval(timer);
    timer = setInterval(()=> { nextPoster(); }, INTERVAL_MS);
  }

  let swiping = false, startX = 0, deltaX = 0;

  const MIN_SWIPE_PX  = 110;
  const MIN_SWIPE_PCT = 0.15;
  function thresholdPx(){
    const W = posterArea.clientWidth || window.innerWidth || 1;
    return Math.max(MIN_SWIPE_PX, Math.floor(W * MIN_SWIPE_PCT));
  }

  function resist(dx){
    const W = posterArea.clientWidth || window.innerWidth || 1;
    const limit = W * 0.35;
    const clamped = Math.max(-limit, Math.min(limit, dx));
    return clamped * 0.85;
  }
  function setImgX(px){
    posterImg.style.transform = `translateX(${px}px)`;
  }
  function px(e){ return e.touches ? e.touches[0].clientX : e.clientX; }

  function onDown(e){
    swiping = true; startX = px(e); deltaX = 0;
    clearInterval(timer);
    posterImg.classList.add('dragging');
    if(typeof bumpInteract === 'function') bumpInteract();
  }
  function onMove(e){
    if(!swiping) return;
    deltaX = px(e) - startX;
    setImgX(resist(deltaX));
    e.preventDefault?.();
  }

  let isAnimating = false;
  function animateTo(direction){
    if(isAnimating) return;
    isAnimating = true;

    const W = posterArea.clientWidth || window.innerWidth || 1;
    const outX = direction * W;
    posterImg.classList.remove('dragging');
    setImgX(outX);

    const handleOut = () => {
      posterImg.removeEventListener('transitionend', handleOut);
      posterImg.classList.add('dragging');
      if(direction < 0) nextPoster(); else prevPoster();
      const inStart = -direction * Math.min(W * 0.25, 220);
      setImgX(inStart);

      requestAnimationFrame(()=>{
        posterImg.classList.remove('dragging');
        setImgX(0);
        posterImg.addEventListener('transitionend', function handleIn(){
          posterImg.removeEventListener('transitionend', handleIn);
          startLoop();
          if(typeof bumpInteract === 'function') bumpInteract();
          isAnimating = false;
        }, { once:true });
      });
    };
    posterImg.addEventListener('transitionend', handleOut, { once:true });
  }

  function onUp(){
    if(!swiping) return;
    swiping = false;
    posterImg.classList.remove('dragging');

    const dx = deltaX; deltaX = 0;
    if(Math.abs(dx) >= thresholdPx()){
      animateTo(dx < 0 ? -1 : +1);
    }else{
      setImgX(0);
      startLoop();
      if(typeof bumpInteract === 'function') bumpInteract();
    }
  }

  posterArea.addEventListener('mousedown', onDown, {passive:true});
  window.addEventListener('mousemove', onMove, {passive:false});
  window.addEventListener('mouseup',   onUp,   {passive:true});
  posterArea.addEventListener('touchstart', onDown, {passive:true});
  window.addEventListener('touchmove',  onMove, {passive:false});
  window.addEventListener('touchend',   onUp,   {passive:true});

  const pPrev = document.getElementById('pPrev');
  const pNext = document.getElementById('pNext');
  if (pPrev) pPrev.addEventListener('click', () => animateTo(+1));
  if (pNext) pNext.addEventListener('click', () => animateTo(-1));

  posterImg.onerror = () => {
    nextReady = null;
    const f = files[idx];
    if (!f) return;
    f.tried = (f.tried || 0) + 1;
    if (f.tried < (f.candidates?.length || 0)) {
      posterImg.src = f.candidates[f.tried];
      preloadPoster(idx + 1);
    } else {
      f.tried = 0;
      nextPoster();
    }
  };

  (async function initPoster(){
    await refreshDriveImages({ initial: true });
    clearInterval(refreshTimer);
    refreshTimer = setInterval(()=> refreshDriveImages(), REFRESH_MS);
  })();
})();


const VIDEO_HUB_URL = 'https://dongatube.netlify.app/embed';
const VIDEO_IDLE_SECONDS = 120;
const videoHubBtn = document.getElementById('videoHubBtn');
const videoModal = document.getElementById('videoModal');
const videoFrame = document.getElementById('videoFrame');
const videoClose = document.getElementById('videoClose');
const videoCountdown = document.getElementById('videoCountdown');
let videoTimer = null;
let videoLastInteract = Date.now();

function videoBumpInteract(){
  videoLastInteract = Date.now();
}

function openVideoHub(){
  if(!videoModal || !videoFrame) return;
  videoModal.setAttribute('aria-hidden','false');
  videoFrame.src = 'about:blank';
  requestAnimationFrame(()=>{
    videoFrame.src = `${VIDEO_HUB_URL}?kiosk=1&t=${Date.now()}`;
  });
  videoCountdown.textContent = VIDEO_IDLE_SECONDS;
  videoBumpInteract();
  clearInterval(videoTimer);
  videoTimer = setInterval(()=>{
    const idleSec = Math.floor((Date.now() - videoLastInteract) / 1000);
    const left = Math.max(0, VIDEO_IDLE_SECONDS - idleSec);
    videoCountdown.textContent = left;
    if(left <= 0) closeVideoHub();
  }, 250);
}

function closeVideoHub(){
  if(!videoModal || !videoFrame) return;
  videoModal.setAttribute('aria-hidden','true');
  videoFrame.src = 'about:blank';
  clearInterval(videoTimer);
  videoTimer = null;
}

if(videoHubBtn){
  ['mousedown','touchstart','pointerdown'].forEach(evt=>{
    videoHubBtn.addEventListener(evt, (e)=> e.stopPropagation(), {passive:true});
  });
  videoHubBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    openVideoHub();
  });
  videoHubBtn.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' ') openVideoHub();
  });
}
if(videoModal){
  if(videoClose) videoClose.addEventListener('click', closeVideoHub);
  videoModal.addEventListener('click', (e)=>{ if(e.target === videoModal) closeVideoHub(); });
  ['mousemove','mousedown','touchstart','keydown','wheel'].forEach(evt=>{
    videoModal.addEventListener(evt, videoBumpInteract, {passive:true});
  });
  window.addEventListener('blur', ()=>{
    if(videoModal.getAttribute('aria-hidden') === 'false') videoBumpInteract();
  });
  window.addEventListener('message', (event)=>{
    if(event.origin !== new URL(VIDEO_HUB_URL).origin) return;
    if(event.data?.type === 'dau-embed-activity') videoBumpInteract();
  });
}

const AI_BOOK_URL = 'https://donga-ai-book-finder.netlify.app/';
const AI_BOOK_IDLE_SECONDS = 120;
const aiBookHubBtn = document.getElementById('aiBookHubBtn');
const aiBookModal = document.getElementById('aiBookModal');
let aiBookFrame = document.getElementById('aiBookFrame');
const aiBookClose = document.getElementById('aiBookClose');
const aiBookCountdown = document.getElementById('aiBookCountdown');
let aiBookTimer = null;
let aiBookLastInteract = Date.now();

function aiBookBumpInteract(){
  aiBookLastInteract = Date.now();
}

function nudgeAiBookFrame(){
  if(!aiBookFrame) return;
  aiBookFrame.style.opacity = '0.999';
  aiBookFrame.style.transform = 'translate3d(0,0,0) scale(1.0001)';
  void aiBookFrame.offsetHeight;
  requestAnimationFrame(()=>{
    if(!aiBookFrame) return;
    aiBookFrame.style.opacity = '1';
    aiBookFrame.style.transform = 'translate3d(0,0,0) scale(1)';
  });
}

function resetAiBookFrame(){
  if(!aiBookFrame || !aiBookFrame.parentNode) return null;
  const nextFrame = aiBookFrame.cloneNode(false);
  nextFrame.removeAttribute('src');
  nextFrame.style.opacity = '1';
  nextFrame.style.visibility = 'visible';
  nextFrame.style.transform = 'translate3d(0,0,0)';
  nextFrame.addEventListener('load', ()=>{
    aiBookBumpInteract();
    nudgeAiBookFrame();
    setTimeout(nudgeAiBookFrame, 350);
    setTimeout(nudgeAiBookFrame, 1200);
  });
  aiBookFrame.replaceWith(nextFrame);
  aiBookFrame = nextFrame;
  return aiBookFrame;
}

function openAiBookHub(){
  if(!aiBookModal || !aiBookFrame) return;
  if(typeof closeVideoHub === 'function') closeVideoHub();
  aiBookModal.setAttribute('aria-hidden','false');
  resetAiBookFrame();
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      if(!aiBookFrame) return;
      aiBookFrame.src = `${AI_BOOK_URL}kiosk?kiosk=1&embed=1&t=${Date.now()}`;
      nudgeAiBookFrame();
    });
  });
  aiBookCountdown.textContent = AI_BOOK_IDLE_SECONDS;
  aiBookBumpInteract();
  clearInterval(aiBookTimer);
  aiBookTimer = setInterval(()=>{
    if(document.activeElement === aiBookFrame) aiBookBumpInteract();
    const idleSec = Math.floor((Date.now() - aiBookLastInteract) / 1000);
    const left = Math.max(0, AI_BOOK_IDLE_SECONDS - idleSec);
    aiBookCountdown.textContent = left;
    if(left <= 0) closeAiBookHub();
  }, 250);
}

function closeAiBookHub(){
  if(!aiBookModal || !aiBookFrame) return;
  aiBookModal.setAttribute('aria-hidden','true');
  aiBookFrame.removeAttribute('src');
  clearInterval(aiBookTimer);
  aiBookTimer = null;
}

if(aiBookHubBtn){
  ['mousedown','touchstart','pointerdown'].forEach(evt=>{
    aiBookHubBtn.addEventListener(evt, (e)=> e.stopPropagation(), {passive:true});
  });
  aiBookHubBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    openAiBookHub();
  });
  aiBookHubBtn.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      openAiBookHub();
    }
  });
}
if(aiBookModal){
  if(aiBookClose) aiBookClose.addEventListener('click', closeAiBookHub);
  aiBookModal.addEventListener('click', (e)=>{ if(e.target === aiBookModal) closeAiBookHub(); });
  ['mousemove','mousedown','touchstart','keydown','wheel'].forEach(evt=>{
    aiBookModal.addEventListener(evt, aiBookBumpInteract, {passive:true});
  });
  window.addEventListener('blur', ()=>{
    if(aiBookModal.getAttribute('aria-hidden') === 'false') aiBookBumpInteract();
  });
  window.addEventListener('message', (event)=>{
    if(event.origin !== new URL(AI_BOOK_URL).origin) return;
    aiBookBumpInteract();
  });
}


const KIOSK_CONTROL_URL = '/.netlify/functions/kiosk-control';
const KIOSK_CONTROL_POLL_MS = 30000;
const KIOSK_PAGE_CAMPUS = (() => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('campus') || params.get('library');
  if(requested === 'bumin') return 'bumin';
  return window.location.pathname.toLowerCase().includes('bumin') ? 'bumin' : 'hallim';
})();
const KIOSK_CONTROL_ENDPOINT = `${KIOSK_CONTROL_URL}?${new URLSearchParams({ campus: KIOSK_PAGE_CAMPUS }).toString()}`;
const KIOSK_LIBRARIES = {
  hallim: {
    name: '한림도서관',
    sub: 'Hallim Library',
    modalSub: '한림도서관 · 실시간',
    fallbackHours: [
      { name: '제1자료실', time: '평일 09:00~20:00 · 주말·공휴일 휴실' },
      { name: '제2자료실', time: '평일 09:00~20:00 · 주말·공휴일 휴실' },
      { name: '열람실', time: '매일 07:00~24:00' },
      { name: '열람실(시험기간)', time: '평일·주말·공휴일 24시간' },
    ],
  },
  bumin: {
    name: '부민도서관',
    sub: 'Bumin Library',
    modalSub: '부민도서관 · 실시간',
    fallbackHours: [
      { name: '부민 자료실', time: '평일 09:00~20:00 · 주말·공휴일 휴실' },
      { name: '열람실', time: '매일 07:00~24:00' },
      { name: '열람실(시험기간)', time: '평일·주말·공휴일 24시간' },
    ],
  },
};
const KIOSK_THEMES = new Set(['navy-glass', 'aurora', 'midnight', 'slate', 'daylight', 'mint', 'coral']);
const kioskState = {
  library: KIOSK_PAGE_CAMPUS,
  theme: 'navy-glass',
  reloadVersion: null,
  initializedControl: false,
};

function applyKioskPageChrome(){
  const info = KIOSK_LIBRARIES[KIOSK_PAGE_CAMPUS] || KIOSK_LIBRARIES.hallim;
  document.title = `${info.name} 로비 안내 디스플레이`;

  const settingsLink = document.querySelector('.kiosk-settings-link');
  if(settingsLink){
    settingsLink.href = KIOSK_PAGE_CAMPUS === 'bumin' ? 'admin-bumin.html' : 'admin.html';
    settingsLink.setAttribute('aria-label', `${info.name} 관리자 설정`);
  }
}

function applyTheme(theme){
  const nextTheme = KIOSK_THEMES.has(theme) ? theme : 'navy-glass';
  kioskState.theme = nextTheme;
  document.body.setAttribute('data-kiosk-theme', nextTheme);
}

function applyLibrary(library){
  const nextLibrary = KIOSK_LIBRARIES[library] ? library : 'hallim';
  kioskState.library = nextLibrary;
  const info = KIOSK_LIBRARIES[nextLibrary];
  const dockTitle = document.querySelector('.dock-title');
  const dockSub = document.querySelector('.dock-sub');
  const modalSub = hoursModal?.querySelector('.hours-sub');
  if(dockTitle) dockTitle.textContent = info.name;
  if(dockSub) dockSub.textContent = info.sub;
  if(modalSub) modalSub.textContent = info.modalSub;
  renderLibraryHoursItems(info.fallbackHours);
}

const hoursBtn   = document.getElementById('hoursBtn');
const hoursTopBtn = document.getElementById('noticeBar');
const hoursModal = document.getElementById('hoursModal');
const hClose     = document.getElementById('hClose');
const hCountdown = document.getElementById('hCountdown');

let hTimer = null, hLast = Date.now();

function openHours(){
  if(!hoursModal) return;
  hoursModal.setAttribute('aria-hidden','false');
  hCountdown.textContent = 15;
  hLast = Date.now();
  clearInterval(hTimer);
  hTimer = setInterval(()=>{
    const left = Math.max(0, 15 - Math.floor((Date.now()-hLast)/1000));
    hCountdown.textContent = left;
    if(left <= 0) closeHours();
  }, 250);
}
function closeHours(){
  if(!hoursModal) return;
  hoursModal.setAttribute('aria-hidden','true');
  clearInterval(hTimer); hTimer=null;
}

if(hoursBtn){
  hoursBtn.addEventListener('click', openHours);
  hoursBtn.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' ') openHours();
  });
}

if(hoursTopBtn){
  hoursTopBtn.addEventListener('click', openHours);
  hoursTopBtn.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' ') openHours();
  });
}

if(hoursModal){
  hClose.addEventListener('click', closeHours);
  hoursModal.addEventListener('click', (e)=>{ if(e.target === hoursModal) closeHours(); });
  hoursModal.addEventListener('mousemove', ()=> hLast = Date.now());
  hoursModal.addEventListener('touchstart', ()=> hLast = Date.now(), {passive:true});
}

function renderLibraryHoursItems(items){
  if(!hoursModal) return;
  const rows = Array.from(hoursModal.querySelectorAll('.hours-row'));
  const nextItems = Array.isArray(items) ? items : [];
  rows.forEach((row, index)=>{
    const item = nextItems[index];
    row.style.display = item ? '' : 'none';
    if(!item) return;
    const label = row.querySelector('.hours-label');
    const time = row.querySelector('.hours-time');
    if(label) label.textContent = item.name || '';
    if(time) time.textContent = item.time || '';
  });
}

async function loadLibraryHours(){
  if(!hoursModal) return;

  try{
    const params = new URLSearchParams({ library: kioskState.library });
    const data = await fetchJsonWithStaticFallback(
      `/.netlify/functions/library-hours?${params.toString()}`,
      `data/library-hours-${encodeURIComponent(kioskState.library)}.json`,
      { cache: 'no-store' }
    );
    const items = Array.isArray(data.items) ? data.items : [];
    renderLibraryHoursItems(items);

    const sub = hoursModal.querySelector('.hours-sub');
    if(sub) sub.textContent = `${data.libraryName || KIOSK_LIBRARIES[kioskState.library].name} · 실시간`;

    const note = hoursModal.querySelector('.hours-note');
    if(note){
      const stamp = data.updatedAt
        ? new Date(data.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        : '';
      note.textContent = `동아대학교 도서관 홈페이지 실시간 이용시간 기준${stamp ? ` · ${stamp} 갱신` : ''}`;
    }
  }catch(e){
    console.warn('[LibraryHours] update failed. Keeping fallback hours.', e);
  }
}

loadLibraryHours();
setInterval(loadLibraryHours, 10 * 60 * 1000);

async function loadKioskControl(){
  try{
    const rawData = await fetchJsonWithStaticFallback(
      KIOSK_CONTROL_ENDPOINT,
      `kiosk-control.json?campus=${encodeURIComponent(KIOSK_PAGE_CAMPUS)}`,
      { cache: 'no-store' }
    );
    const data = rawData?.campuses
      ? (rawData.campuses[KIOSK_PAGE_CAMPUS] || rawData.campuses.hallim || {})
      : rawData;

    applyTheme(data.theme || kioskState.theme);

    if(!kioskState.initializedControl){
      kioskState.reloadVersion = data.reloadVersion || null;
      kioskState.initializedControl = true;
      return;
    }

    if(data.reloadVersion && data.reloadVersion !== kioskState.reloadVersion){
      kioskState.reloadVersion = data.reloadVersion;
      window.location.reload();
    }
  }catch(e){
    console.warn('[KioskControl] update failed.', e);
  }
}

applyTheme(kioskState.theme);
applyLibrary(KIOSK_PAGE_CAMPUS);
applyKioskPageChrome();
loadKioskControl();
setInterval(loadKioskControl, KIOSK_CONTROL_POLL_MS);




(function(){
  const els = {
    updated: document.getElementById('weatherUpdated'),
    temp:    document.getElementById('weatherTemp'),
    desc:    document.getElementById('weatherDesc'),
    feels:   document.getElementById('weatherFeels'),
    wind:    document.getElementById('weatherWind'),
    minmax:  document.getElementById('weatherMinMax'),
    pm10:    document.getElementById('pm10'),
    pm25:    document.getElementById('pm25'),
    pm10Badge: document.getElementById('pm10Badge'),
    pm25Badge: document.getElementById('pm25Badge'),
    aqInline: document.getElementById('aqInline'),
  };
  const widget = document.getElementById('weatherWidget');
  if(!widget || !els.temp) return;

  const FALLBACK = { name: '부산', latitude: 35.1796, longitude: 129.0756, timezone: 'Asia/Seoul' };
  const GEO_URL  = 'https://geocoding-api.open-meteo.com/v1/search';
  const API_URL  = 'https://api.open-meteo.com/v1/forecast';
  const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

  const UPDATE_MS = 10 * 60 * 1000; // 10분

  const WMO = {
    0:  ['☀️','맑음'],
    1:  ['🌤️','대체로 맑음'],
    2:  ['⛅','부분적으로 흐림'],
    3:  ['☁️','흐림'],
    45: ['🌫️','안개'],
    48: ['🌫️','짙은 안개'],
    51: ['🌦️','이슬비(약)'],
    53: ['🌦️','이슬비(보통)'],
    55: ['🌧️','이슬비(강)'],
    56: ['🌧️','어는 이슬비(약)'],
    57: ['🌧️','어는 이슬비(강)'],
    61: ['🌧️','비(약)'],
    63: ['🌧️','비(보통)'],
    65: ['🌧️','비(강)'],
    66: ['🌧️','어는 비(약)'],
    67: ['🌧️','어는 비(강)'],
    71: ['🌨️','눈(약)'],
    73: ['🌨️','눈(보통)'],
    75: ['❄️','눈(강)'],
    77: ['❄️','싸락눈'],
    80: ['🌦️','소나기(약)'],
    81: ['🌧️','소나기(보통)'],
    82: ['⛈️','소나기(강)'],
    85: ['🌨️','눈 소나기(약)'],
    86: ['❄️','눈 소나기(강)'],
    95: ['⛈️','뇌우'],
    96: ['⛈️','뇌우(우박)'],
    99: ['⛈️','뇌우(강한 우박)'],
  };

  function safeNum(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function fmt2(n){
    if(n === null) return '--';
    return String(Math.round(n));
  }
  function fmtWind(n){
    if(n === null) return '--';
    return String(Math.round(n));
  }
  function formatUpdated(ts){

    if(!ts) return '--';
    const m = String(ts).match(/T(\d{2}:\d{2})/);
    return m ? `${m[1]} 업데이트` : '업데이트';
  }


  function aqGrade(kind, v){
    if(v == null || Number.isNaN(v)) return { label: '--', cls: 'is-unknown' };

    if(kind === 'pm10'){
      if(v <= 30)  return { label: '좋음', cls: 'is-good' };
      if(v <= 80)  return { label: '보통', cls: 'is-normal' };
      if(v <= 150) return { label: '나쁨', cls: 'is-bad' };
      return        { label: '매우 나쁨', cls: 'is-very-bad' };
    }

    if(v <= 15)  return { label: '좋음', cls: 'is-good' };
    if(v <= 35)  return { label: '보통', cls: 'is-normal' };
    if(v <= 75)  return { label: '나쁨', cls: 'is-bad' };
    return        { label: '매우 나쁨', cls: 'is-very-bad' };
  }

  function setPill(el, grade){
    if(!el) return;
    el.textContent = grade.label;
    el.className = `aq-pill ${grade.cls}`;
  }

  function setMainPill(el, grade){
    if(!el) return;
    el.textContent = grade.label;
    el.className = `aq-main-pill ${grade.cls}`;
  }

  async function geocodeBusan(){
    try{
      const url = `${GEO_URL}?name=${encodeURIComponent('부산')}&count=1&language=ko&format=json`;
      const res = await fetch(url, { cache: 'no-store' });
      if(!res.ok) throw new Error('geocoding ' + res.status);
      const data = await res.json();
      const r = data && data.results && data.results[0];
      if(r && typeof r.latitude === 'number' && typeof r.longitude === 'number'){
        return {
          name: r.name || FALLBACK.name,
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone || FALLBACK.timezone,
        };
      }
    }catch(e){
      console.warn('[Weather] geocoding failed:', e);
    }
    return FALLBACK;
  }

  async function fetchWeather(lat, lon, tz){
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily: 'temperature_2m_max,temperature_2m_min',
      forecast_days: '1',
      timezone: tz || 'Asia/Seoul',
    });
    const url = `${API_URL}?${params.toString()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error('forecast ' + res.status);
    return await res.json();
  }
async function fetchAirQuality(lat, lon, tz){
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'pm10,pm2_5',
    timezone: tz || 'Asia/Seoul',
  });
  const url = `${AQ_URL}?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error('air-quality ' + res.status);
  return await res.json();
}

  let resolvedLoc = null;
  async function update(){
    try{
      if(!resolvedLoc) resolvedLoc = await geocodeBusan();

      const data = await fetchWeather(resolvedLoc.latitude, resolvedLoc.longitude, resolvedLoc.timezone);

      const cur = data && data.current ? data.current : null;
      const daily = data && data.daily ? data.daily : null;

      const t = safeNum(cur?.temperature_2m);
      const f = safeNum(cur?.apparent_temperature);
      const w = safeNum(cur?.wind_speed_10m);
      const code = safeNum(cur?.weather_code);

      const iconText = WMO[code]?.[0] || '🌡️';
      const descText = WMO[code]?.[1] || '날씨';

      const tMin = safeNum(daily?.temperature_2m_min?.[0]);
      const tMax = safeNum(daily?.temperature_2m_max?.[0]);

      els.temp.textContent = fmt2(t);
      els.feels.textContent = fmt2(f);
      els.wind.textContent = fmtWind(w);
      els.minmax.textContent = (tMin !== null && tMax !== null) ? `${Math.round(tMin)}° / ${Math.round(tMax)}°` : '--';
      els.desc.textContent = `${iconText} ${descText}`;
      els.updated.textContent = formatUpdated(cur?.time);

    }catch(e){
      console.warn('[Weather] update failed:', e);
      els.desc.textContent = '날씨 정보를 불러오지 못했습니다';
      els.updated.textContent = '--';
    }


try{
  if(els.pm10 && els.pm25){
    const aq = await fetchAirQuality(resolvedLoc.latitude, resolvedLoc.longitude, resolvedLoc.timezone);
    const pm10 = safeNum(aq?.current?.pm10);
    const pm25 = safeNum(aq?.current?.pm2_5);

    els.pm10.textContent = (pm10 === null) ? '--' : String(Math.round(pm10));
    els.pm25.textContent = (pm25 === null) ? '--' : String(Math.round(pm25));

    const g10 = aqGrade('pm10', pm10);
    const g25 = aqGrade('pm25', pm25);
    if(els.aqInline){
  els.aqInline.textContent = `대기질:${g25.label}`;
  els.aqInline.className = `aq-inline ${g25.cls}`;
}
    setPill(els.pm10Badge, g10);
    setPill(els.pm25Badge, g25);
  }
}catch(e){
  console.warn('[AirQuality] update failed:', e);
  if(els.pm10) els.pm10.textContent = '--';
  if(els.pm25) els.pm25.textContent = '--';
  setPill(els.pm10Badge, { label: '--', cls: 'is-unknown' });
  setPill(els.pm25Badge, { label: '--', cls: 'is-unknown' });
}
  }

  update();
  setInterval(update, UPDATE_MS);
})();
