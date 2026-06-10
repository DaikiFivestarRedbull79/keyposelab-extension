
(() => {
  
  const S = {
    fps: 30,
    frameStep: 1,
    marks: { in: null, out: null },
    loopEnabled: true,
    video: null,

   
    hud: null,         
    dragging: null,    

   
    lastAction: '',          
    stepGuardUntil: 0,       
    guardTimer: null         
  };

  
  const isDisney = () => /(^|\.)disneyplus\.com$/i.test(location.hostname);
  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
  function frameStepSec() {
    const f = Number(S.fps);
    return (isFinite(f) && f > 0) ? (1 / f) : (1 / 30);
  }
 
  const isYouTube = () =>
    /(^|\.)youtube\.com$/i.test(location.hostname) || /(^|\.)youtu\.be$/i.test(location.hostname);

  function dispatchKey(el, { key, code, keyCode }) {
    const opt = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true };
    el.dispatchEvent(new KeyboardEvent('keydown', opt));
    el.dispatchEvent(new KeyboardEvent('keyup', opt));
  }
 
  const DRAW_COLOR_HEX = {
    green: '#4ade80',
    red: '#f91437ff',
    yellow: '#fde047',
    blue: '#0000FF',
    purple: '#812990',
    pink: '#F19EB6',
    cyan: '#7cc7e8',
    orange: '#fb923c',
    black: '#000000',
    white: '#FFFFFF'
  };


 
 
 
  const SEG_COLORS = [
    { key: 'none', title: '未分類' },
    { key: 'green', title: 'OK / 完了' },
    { key: 'red', title: 'リテイク' },
    { key: 'yellow', title: '確認中' },
    { key: 'blue', title: 'メモ' },
    { key: 'purple', title: '参考' },
    { key: 'pink', title: '演出' },
    { key: 'cyan', title: '素材' },
    { key: 'orange', title: '要注意' },
    { key: 'black', title: '保留' },
    { key: 'white', title: '未着手' }
  ];

 
  function getHudRoot() {
    const host = S?.hud?.host;
    return host ? (host.shadowRoot || host) : null;
  }
  function fmtHUD(t) {
    if (t == null || !isFinite(t)) return '--:--';
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  }
  function refreshHudDom() {
    const root = getHudRoot();
    if (!root) { return; }

    const elTimes = root.getElementById('hudTimes');
    const elIn = root.getElementById('hudMarkIn');
    const elOut = root.getElementById('hudMarkOut');

   
    if (elTimes) elTimes.textContent = `In ${fmtHUD(S.marks.in)} / Out ${fmtHUD(S.marks.out)}`;

   
    const hasIn = Number.isFinite(S.marks.in);
    const hasOut = Number.isFinite(S.marks.out);
    elIn?.classList.toggle('pressed', hasIn);
    elOut?.classList.toggle('pressed', hasOut);
    elOut?.classList.toggle('pressed-out', hasOut);

    console.debug('[KFN] HUD refreshed (in=%o, out=%o)', S.marks.in, S.marks.out);
  }


  
  function isGuardActive() {
    return S.lastAction === 'step' && performance.now() < S.stepGuardUntil;
  }
  function startGuard(v, ms = 1200) {
    const duration = isDisney() ? Math.max(ms, 2000) : ms;
    S.lastAction = 'step';
    S.stepGuardUntil = performance.now() + duration;

    stopGuard();
    S.guardTimer = setInterval(() => {
      if (!v || !document.contains(v)) { stopGuard(); return; }
      if (!isGuardActive()) { stopGuard(); return; }
      try { v.pause(); } catch { }
    }, 50);

    try { v.pause(); } catch { }
    setTimeout(() => { try { v.pause(); } catch { } }, 60);
  }
  function stopGuard() {
    if (S.guardTimer) { clearInterval(S.guardTimer); S.guardTimer = null; }
    if (S.lastAction === 'step') S.lastAction = '';
    S.stepGuardUntil = 0;
  }

 
  async function ytSetPaused(desiredPaused) {
    const v = ensureVideo(); if (!v) return false;

   
    const btn = document.querySelector('.ytp-play-button');
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const applyBtn = async () => { btn?.click(); await delay(80); };

   
    if (!!v.paused === !!desiredPaused) return true;

   
    await applyBtn();
    if (!!v.paused === !!desiredPaused) return true;

   
    try {
      if (desiredPaused) v.pause?.(); else await v.play?.();
      await delay(60);
      if (!!v.paused === !!desiredPaused) return true;
    } catch { }

   
    try {
      const t = document.activeElement || document.body || document.documentElement;
      const ev = (type) => new KeyboardEvent(type, { key: 'k', code: 'KeyK', keyCode: 75, which: 75, bubbles: true, cancelable: true, composed: true });
      t.dispatchEvent(ev('keydown')); t.dispatchEvent(ev('keyup'));
      await delay(80);
    } catch { }

    return (!!v.paused === !!desiredPaused);
  }

  
  function getFocusableForDisney(v) {
    const cand = [];
    let p = v?.parentElement;
    while (p && p !== document.documentElement) {
      if (p.tabIndex >= 0) cand.push(p);
      p = p.parentElement;
    }
    if (v) cand.push(v);
    cand.push(document.activeElement || document.body || document.documentElement);
    return cand.find(el => el && el.focus) || v || document.body || document.documentElement;
  }
  function dispatchSpace(el) {
    const opts = { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, cancelable: true, composed: true };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }
  async function disneyEnsurePaused(v) {
    if (!isDisney() || !v) return;
    if (v.paused) return;
    const el = getFocusableForDisney(v);
    try { el.focus?.(); } catch { }
    for (let i = 0; i < 5; i++) {
      if (!document.contains(v)) break;
      if (v.paused) break;
      dispatchSpace(el);
      await new Promise(r => setTimeout(r, 80 + i * 40));
    }
  }
  async function disneyTogglePlay(v) {
    if (!isDisney() || !v) {
      if (v.paused) { try { v.play?.(); } catch { } } else { try { v.pause?.(); } catch { } }
      return;
    }
    const el = getFocusableForDisney(v);
    try { el.focus?.(); } catch { }
    dispatchSpace(el);
    await new Promise(r => setTimeout(r, 120));
  }

  
  function getCandidateVideos() {
    return Array.from(document.getElementsByTagName('video'))
      .filter(v => !isNaN(v.duration) && v.duration > 0);
  }
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0;
  }
  function pickBestVideo(videos) {
    if (!videos.length) return null;
    const playing = videos.filter(v => !v.paused && !v.ended && v.readyState >= 2 && isVisible(v));
    if (playing.length) return playing[0];
    const byArea = [...videos].sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    });
    return byArea[0];
  }

  let onTimeUpdateBound = null;
  let onPlayGuardBound = null;
  let onPlayingGuardBound = null;
  let onSeekedGuardBound = null;
  let onWaitingGuardBound = null;

  function onPlayGuard() {
    const v = S.video;
    if (!v) return;
    if (isGuardActive()) {
      try { v.pause(); } catch { }
    }
  }
  function onPlayingGuard() {
    const v = S.video;
    if (!v) return;
    if (isGuardActive()) {
      try { v.pause(); } catch { }
    }
  }
  function onSeekedGuard() {
    const v = S.video;
    if (!v) return;
    if (isGuardActive()) {
      try { v.pause(); } catch { }
    }
  }
  function onWaitingGuard() {
    const v = S.video;
    if (!v) return;
    if (isGuardActive()) {
      try { v.pause(); } catch { }
    }
  }

  function unbindVideo(v) {
    if (!v) return;
    if (onTimeUpdateBound) { try { v.removeEventListener('timeupdate', onTimeUpdateBound); } catch { } }
    if (onPlayGuardBound) { try { v.removeEventListener('play', onPlayGuardBound, true); } catch { } }
    if (onPlayingGuardBound) { try { v.removeEventListener('playing', onPlayingGuardBound, true); } catch { } }
    if (onSeekedGuardBound) { try { v.removeEventListener('seeked', onSeekedGuardBound, true); } catch { } }
    if (onWaitingGuardBound) { try { v.removeEventListener('waiting', onWaitingGuardBound, true); } catch { } }
  }

  function bindVideo(v) {
    if (!v) return;
    try { v.autoplay = false; } catch { }

    onTimeUpdateBound = onTimeUpdate;
    onPlayGuardBound = onPlayGuard;
    onPlayingGuardBound = onPlayingGuard;
    onSeekedGuardBound = onSeekedGuard;
    onWaitingGuardBound = onWaitingGuard;

    try { v.addEventListener('timeupdate', onTimeUpdateBound); } catch { }
    try { v.addEventListener('play', onPlayGuardBound, true); } catch { }
    try { v.addEventListener('playing', onPlayingGuardBound, true); } catch { }
    try { v.addEventListener('seeked', onSeekedGuardBound, true); } catch { }
    try { v.addEventListener('waiting', onWaitingGuardBound, true); } catch { }
  }

  function ensureVideo() {
    if (S.video && document.contains(S.video) && !isNaN(S.video.duration) && S.video.duration > 0) {
      return S.video;
    }
    const vids = getCandidateVideos();
    const best = pickBestVideo(vids);
    if (best && best !== S.video) {
      unbindVideo(S.video);
      S.video = best;
      bindVideo(S.video);
    }
    return S.video || null;
  }

  try {
    const mo = new MutationObserver(() => { ensureVideo(); });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
  } catch { }
  setInterval(ensureVideo, 1000);
 
 
  async function togglePlaySmart(v = ensureVideo()) {
    if (!v) return false;
    try {
     
      if (typeof stopGuard === 'function') stopGuard();

      if (typeof isDisney === 'function' && isDisney()) {
       
        try {
          const el = (typeof getFocusableForDisney === 'function')
            ? getFocusableForDisney(v)
            : (document.activeElement || document.body || document.documentElement);
          if (typeof dispatchSpace === 'function') dispatchSpace(el);
          else dispatchKey(el, { key: ' ', code: 'Space', keyCode: 32 });
        } catch { }
      } else if (typeof isYouTube === 'function' && isYouTube()) {
       
        try { (document.activeElement || document.body || document.documentElement)?.focus?.(); } catch { }
        const target = document.activeElement || document.body || document.documentElement;
        dispatchKey(target, { key: 'k', code: 'KeyK', keyCode: 75 });
        await new Promise(r => setTimeout(r, 120));
      } else {
       
        if (v.paused) await v.play(); else v.pause();
      }
      return true;
    } catch {
      return false;
    }
  }



  
  function onTimeUpdate() {
    const v = ensureVideo();
    if (!v) return;
    const a = S.marks.in, b = S.marks.out;
    const EPS = 0.0005;
    if (S.loopEnabled && Number.isFinite(a) && Number.isFinite(b) && b > a) {
      if (v.currentTime >= (b - EPS)) {
        try {
          const wasPlaying = !v.paused && !v.ended;
          v.currentTime = Math.max(0, a + 0.00001);
          if (wasPlaying) {
            stopGuard();
            S.lastAction = 'loop';
            if (isDisney()) {
             
              disneyTogglePlay(v);
            } else {
              v.play?.();
            }
          }
        } catch { }
      }
    }
  }

  
  async function saveHudPos(scopeKey, pos) {
    if (!scopeKey) return;
    try { await chrome.storage.local.set({ [`oneframe_hud_pos::${scopeKey}`]: pos }); } catch { }
  }
  async function loadHudPos(scopeKey) {
    if (!scopeKey) return { x: 16, y: 16 };
    try {
      const o = await chrome.storage.local.get([`oneframe_hud_pos::${scopeKey}`]);
      return o?.[`oneframe_hud_pos::${scopeKey}`] || { x: 16, y: 16 };
    } catch { return { x: 16, y: 16 }; }
  }



  function destroyHUD() {
    if (!S.hud) return;
    try { S.hud.host.remove(); } catch { }
    S.hud = null;
    S.dragging = null;
   
    window.__KFNAV_HUD_INIT__ = false;
    try { chrome.runtime.sendMessage({ txt: 'hud-open-state', open: false }); } catch { }
  }
  function setHudPosition(x, y) {
    if (!S.hud) return;
    const box = S.hud.box;
    box.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  async function ensureHUD(opts) {
    const scopeKey = opts?.scopeKey || '';
    const initialPos = opts?.pos || await loadHudPos(scopeKey);

   
    if (S.hud && S.hud.box && document.body.contains(S.hud.host)) {
      setHudPosition(initialPos.x, initialPos.y);
      S.hud.scopeKey = scopeKey;
      S.hud.host.style.display = 'block';
      return S.hud;
    }

   
    if (window.__KFNAV_HUD_INIT__) {
     
      return S.hud;
    }
    window.__KFNAV_HUD_INIT__ = true;

    if (S.hud) {
      setHudPosition(initialPos.x, initialPos.y);
      S.hud.scopeKey = scopeKey;
      return;
    }

    const host = document.createElement('div');
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.inset = 'auto';
    host.style.top = '0';
    host.style.left = '0';
    host.style.pointerEvents = 'none';

    const root = host.attachShadow({ mode: 'open' });
    const box = document.createElement('div');
    box.id = 'oneframe-hud';

    const style = document.createElement('style');
    style.textContent = `
      :host{ all:initial }
      #oneframe-hud{
        position:fixed; top:0; left:0;
        pointer-events:auto;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        display:flex; flex-direction:column; gap:6px;
        background: rgba(20,22,28,.9);
        color:#e5e7eb;
        border:1px solid rgba(255,255,255,.12);
        border-radius:10px;
        backdrop-filter: blur(6px);
        box-shadow: 0 6px 20px rgba(0,0,0,.35);
        padding:8px;
        width: 260px;
        user-select:none;
      }
      .hud-row{ display:flex; gap:6px; align-items:center; justify-content:center; flex-wrap:wrap }
           

      
.hud-row.actions{ display:flex; gap:6px; align-items:center; justify-content:center; flex-wrap:nowrap }

      .titlebar{ display:flex; align-items:center; justify-content:space-between; cursor:grab; font-size:12px; color:#cbd5e1; padding:2px 4px 4px; }
      .titlebar .title{ display:flex; align-items:center; gap:6px; flex:1; min-width:0; }
      #hudTimes.pill{
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;     
  font-variant-numeric: tabular-nums;
  font-size: 11px;      
  padding: 2px 6px;     
}
      .titlebar .btn{ background:transparent; border:0; color:#cbd5e1; cursor:pointer; font-size:14px; padding:2px 4px; }
      .btn{ border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:#e5e7eb; border-radius:8px; padding:6px 10px; font-size:12px; cursor:pointer; }
      .btn:active{ transform:translateY(1px); }
      .btn.red{ background:rgba(255,80,80,.1); border-color:rgba(255,120,120,.3); color:#ffb3b3; }
.btn.addmarks {
  background: #1b2638;
  border-color: #29466f;
  color: #a6c8ff;
}
.btn.addmarks:hover {
  background: #22344f;
  border-color: #3a5b8a;
}

      .titlebar {
        display:flex;
        align-items:center;
        justify-content:space-between;
        cursor:grab;
        font-size:12px;
        color:#cbd5e1;
        padding:2px 4px 4px;
      }
      .titlebar .title{
        display:flex;
        align-items:center;
        gap:6px;
        flex:1;
        min-width:0;
      }

      .hud-right{
        display:flex;
        align-items:center;
        gap:4px;
      }

      .hud-rate-select{
        background:rgba(15,23,42,.95);
        border:1px solid rgba(148,163,184,.7);
        color:#e5e7eb;
        border-radius:6px;
        font-size:11px;
        padding:2px 6px;
        appearance:none;
      }
      .hud-rate-select:focus{
        outline:none;
        border-color:rgba(129,140,248,1);
      }



      .mono{ font-variant-numeric: tabular-nums; font-size:11px; opacity:.85 }
      .pill{ padding:2px 8px; border-radius:999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06);}
      .pressed{ background: rgba(40,180,120,.22) !important; border-color: rgba(40,180,120,.4) !important; }
            .pressed-out{
        background: rgba(220,60,60,0.25) !important;
        border-color: rgba(255,100,100,0.45) !important;
        color: #ffaaaa !important;
      }
        
.btn.addmarks.pulse { animation: kfn-pulse 280ms ease; }
@keyframes kfn-pulse {
  0%   { transform: scale(0.98); }
  50%  { transform: scale(1.02); }
  100% { transform: scale(1.00); }
}


.btn.addmarks.ok{
  position: relative;
  color: transparent;         
  text-shadow: none;            
}
.btn.addmarks.ok::after{
  content: '✔';
  position: absolute;
  right: 8px; top: 50%;
  transform: translateY(-50%) scale(0.7);
  font-size: 12px;
  opacity: 0;
  animation: kfn-tick 700ms ease forwards;
}
  .btn.addmarks{ min-width: 60px; } 
@keyframes kfn-tick{
  0%   { opacity: 0; transform: translateY(-50%) scale(0.6); }
  30%  { opacity: 1; transform: translateY(-50%) scale(1.0); }
  100% { opacity: 0; transform: translateY(-50%) scale(1.0); }
}
        .icon-eraser{
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-right: 4px;
      }
      .icon-eraser svg{
        width: 100%;
        height: 100%;
        display: block;
      }
      .btn .label{
        vertical-align: middle;
      }

            .hud-draw-group{
        display:flex;
        gap:6px;
        padding:4px 6px;
        border-radius:10px;
        border:1px solid rgba(255,255,255,.18);
        background:rgba(15,23,42,.8);
      }
      .hud-draw-group .btn{
        padding-inline:8px;
        font-size:11px;
      }

        .hud-draw-status{
        font-size:10px;
        opacity:.75;
        margin-left:4px;
      }

      .hud-draw-group {
  display: flex;
  flex-wrap: wrap;
  gap:4px 6px;  
}

  .hud-pen-controls label {
    display: flex;
  flex-direction: column; 
  width: 100%;
  margin-top:0px;
  font-size: 12px;
}


#hudDrawColors {
 margin-bottom: 0;
}

.hud-pen-controls {
  width: 100%;
}

.hud-pen-controls {
  margin-top: 2px;
}

.btn.tiny{ padding:4px 6px; font-size:11px; min-width:auto; line-height:1 }

 .hud-row-draw{
        justify-content: space-between;
      }
      .hud-color-bar{
        display:flex;
        gap:4px;
        align-items:center;
      }
      .hud-color-btn{
        width:20px;
        height:14px;
        border-radius:999px;
        padding:0;
        border:1px solid rgba(255,255,255,.4);
        background:transparent;
        cursor:pointer;
      }
      .hud-color-btn .dot{
        display:block;
        width:100%;
        height:100%;
        border-radius:999px;
      }
      .hud-color-btn.active{
        box-shadow:0 0 0 2px #fff;
      }
      .hud-color-dot-yellow{ background:#fde047; }
      .hud-color-dot-green { background:#4ade80; }
      .hud-color-dot-blue  { background:#0000FF; }
      .hud-color-dot-red   { background:#f91437; }
      .hud-color-dot-purple{ background:#812990; }
      .hud-color-dot-pink  { background:#F19EB6; }
      .hud-color-dot-cyan  { background:#7cc7e8; }
      .hud-color-dot-orange{ background:#fb923c; }
      .hud-color-dot-black { background:#000000; }
      .hud-color-dot-white { background:#FFFFFF; }

      .hidden {
        display: none !important;
      }

      .btn-toggle-active {
       background: #444;
       color: #fff;
        }

        #hudToggleDraw.active {
  background: #7cc7e8;
  color: #fff;
}

      `;

    box.innerHTML = `
<div class="titlebar" id="hudDrag">
   <div class="title">
    <span id="hudTimes" class="pill mono">In --:-- / Out --:--</span>
   </div>
   <div class="hud-rate-wrap">
  <button class="btn" id="hudToggleDraw" title="Drawing tools">✏️</button>
</div>
   <div class="hud-rate-wrap">
   <span class="hud-rate-icon" title="Playback speed"></span>
    <select id="hudRateSelect" class="hud-rate-select" title="Playback speed">
      <option value="0.25">0.25×</option>
      <option value="0.5">0.5×</option>
      <option value="0.75">0.75×</option>
      <option value="1" selected>1.0×</option>
      <option value="2">2.0×</option>
    </select>
  <button class="btn" id="hudClose" title="Close">✕</button>
</div>

</div>


<div class="hud-row">
  <button class="btn tiny" id="hudBack1s">◀◀</button>
  <button class="btn"      id="hudBack">◀</button>
  <button class="btn"      id="hudPlay">▶/❚❚</button>
  <button class="btn"      id="hudFwd">▶</button>
  <button class="btn tiny" id="hudFwd1s">▶▶</button>
</div>

  <div class="hud-row actions">
  <button class="btn compact" id="hudMarkIn">[ In</button>
  <button class="btn compact" id="hudMarkOut">Out ]</button>
  <button class="btn compact addmarks" id="hudAddMarks">＋Add</button>
  <button class="btn compact red" id="hudClear">🧹</button>

  </div>
      <div class="hud-row hud-row-draw" id="hudRowDraw">
      <div class="hud-draw-group">
        <button class="btn" id="hudDrawPen">✏️ Pen</button>
                <button class="btn" id="hudDrawErase">
          <span class="icon-eraser" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 15.5L13.5 7C14.3 6.2 15.6 6.2 16.4 7L19 9.6C19.8 10.4 19.8 11.7 19 12.5L10.5 21H7L5 19V15.5Z"
                    fill="#f97373"/>
              <path d="M5 15.5L9.5 20H7L5 18V15.5Z"
                    fill="#fefefe"/>
              <path d="M7 21H16.5" stroke="#d4d4d4" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="label">Erase</span>
        </button>
        <button class="btn red" id="hudDrawClear">🗑️ Clear</button>
        <div class="hud-color-bar" id="hudDrawColors"></div>
          <div class="hud-pen-controls">
    <label>
      Size
      <input id="hudPenSize" type="range" min="1" max="40" value="4">
    </label>
    <label>
      Opacity
      <input id="hudPenOpacity" type="range" min="10" max="100" value="100">
    </label>
      </div>
    </div>
    `;
   

const sizeSlider = box.querySelector('#hudPenSize');

if (sizeSlider) {
  __kfn_pen_size = Number(sizeSlider.value);
  sizeSlider.addEventListener('input', () => {
    __kfn_pen_size = Number(sizeSlider.value);
  });
}

const opacitySlider = box.querySelector('#hudPenOpacity');
if (opacitySlider) {
  __kfn_pen_opacity = Number(opacitySlider.value) / 100;  

  opacitySlider.addEventListener('input', () => {
    __kfn_pen_opacity = Number(opacitySlider.value) / 100;
  });
}




    root.appendChild(style);
    root.appendChild(box);
    document.documentElement.appendChild(host);

    S.hud = { host, root, box, scopeKey };
    setHudPosition(initialPos.x, initialPos.y);

   
    const $ = (sel) => root.getElementById(sel);
    const elTimes = $('hudTimes');
    const elIn = $('hudMarkIn');
    const elOut = $('hudMarkOut');



    $('hudClose').addEventListener('pointerdown', (ev) => { ev.stopPropagation(); });
    $('hudClose').addEventListener('click', async () => {
      const key = S.hud?.scopeKey;
      destroyHUD();
      try { if (key) await chrome.storage.local.set({ [`oneframe_hud_open::${key}`]: false }); } catch { }
    });

    const elToggleDraw = $('hudToggleDraw');
    const elHudRowDraw = $('hudRowDraw');


    if (elToggleDraw && elHudRowDraw) {
     
     
      elToggleDraw.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();

        const nowHidden = elHudRowDraw.classList.toggle('hidden');
        try {
         
          window.__KFN_SYNC_HUD_DRAW__ && window.__KFN_SYNC_HUD_DRAW__();
        } catch {  }
      });
    }
   

    $('hudBack').addEventListener('click', () => {
      const v = ensureVideo(); if (!v) return;
      (async () => {
        try {
          const wasPlaying = !v.paused && !v.ended;
          if (!isYouTube()) {           
            await disneyEnsurePaused(v);
          }
          v.currentTime = Math.max(0, v.currentTime - frameStepSec() * S.frameStep);
          if (isYouTube()) {
            if (wasPlaying) v.play?.().catch(() => { });
          } else {
            startGuard(v, 1200);
          }
        } catch { }
        updateHudTimes();
      })();
    });

    $('hudFwd').addEventListener('click', () => {
      const v = ensureVideo(); if (!v) return;
      (async () => {
        try {
          const wasPlaying = !v.paused && !v.ended;
          if (!isYouTube()) {
            await disneyEnsurePaused(v);
          }
          v.currentTime = Math.min(v.duration || Number.MAX_SAFE_INTEGER, v.currentTime + frameStepSec() * S.frameStep);
          if (isYouTube()) {
            if (wasPlaying) v.play?.().catch(() => { });
          } else {
            startGuard(v, 1200);
          }
        } catch { }
        updateHudTimes();
      })();
    });

   
    $('hudBack1s')?.addEventListener('click', () => {
      const v = ensureVideo(); if (!v) return;
      (async () => {
        try {
          const wasPlaying = !v.paused && !v.ended;

          if (!isYouTube()) {
           
            await disneyEnsurePaused(v);
          }

          const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
          const cur = Number.isFinite(v.currentTime) ? v.currentTime : 0;
          v.currentTime = Math.max(0, cur - 1);

          if (isYouTube()) {
           
            if (wasPlaying) v.play?.().catch(() => { });
          } else {
           
            startGuard(v, 1200);
          }
        } catch { }
        updateHudTimes?.();
      })();
    });

   
    $('hudFwd1s')?.addEventListener('click', () => {
      const v = ensureVideo(); if (!v) return;
      (async () => {
        try {
          const wasPlaying = !v.paused && !v.ended;

          if (!isYouTube()) {
            await disneyEnsurePaused(v);
          }

          const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
          const cur = Number.isFinite(v.currentTime) ? v.currentTime : 0;
          v.currentTime = Math.min(dur, cur + 1);

          if (isYouTube()) {
            if (wasPlaying) v.play?.().catch(() => { });
          } else {
            startGuard(v, 1200);
          }
        } catch { }
        updateHudTimes?.();
      })();
    });



    $('hudPlay').addEventListener('click', () => {
      const v = ensureVideo(); if (!v) return;
      (async () => {
        try {
          stopGuard();
          S.lastAction = 'toggle';
          await disneyTogglePlay(v);
        } catch { }
        updateHudTimes();
      })();
    });

    const hudDrawPen = $('hudDrawPen');
    const hudDrawErase = $('hudDrawErase');
    const hudDrawClear = $('hudDrawClear');
    const hudDrawStatus = $('hudDrawStatus');
    const hudDrawColors = $('hudDrawColors');

    const HUD_DRAW_COLORS = SEG_COLORS
      .filter(c => c.key !== 'none')  
      .map(c => c.key);

    function buildHudColorButtons() {
      if (!hudDrawColors) return;
      hudDrawColors.innerHTML = '';

      HUD_DRAW_COLORS.forEach(colorName => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hud-color-btn';
        btn.dataset.color = colorName;

        const dot = document.createElement('span');
        dot.className = 'dot hud-color-dot-' + colorName;
        btn.appendChild(dot);

        btn.addEventListener('click', () => {
          __kfn_draw_color = colorName;  
         
          syncHudDrawButtons();
        });

        hudDrawColors.appendChild(btn);
      });
    }





   
   
    function syncHudDrawButtons() {
      try {
        const on = !!__kfn_draw_active;
        const mode = __kfn_draw_mode || 'pen';

       
        if (hudDrawPen) {
          hudDrawPen.classList.toggle('pressed', on && mode === 'pen');
        }
        if (hudDrawErase) {
          hudDrawErase.classList.toggle('pressed', on && mode === 'erase');
        }

       
       
       
        const hudToggleDraw = root.getElementById('hudToggleDraw');
        if (hudToggleDraw) {
          hudToggleDraw.classList.toggle('active', on);
         
        }

       
        if (hudDrawStatus) {
          if (!on) {
            hudDrawStatus.textContent = 'draw: off';
          } else if (mode === 'erase') {
            hudDrawStatus.textContent = 'draw: erase';
          } else {
            hudDrawStatus.textContent = 'draw: pen';
          }
        }

       
        if (hudDrawColors) {
          const btns = hudDrawColors.querySelectorAll('.hud-color-btn');
          btns.forEach(btn => {
            const col = btn.dataset.color;
            btn.classList.toggle('active', col === __kfn_draw_color);
          });
        }
      } catch { }
    }

    buildHudColorButtons();
    syncHudDrawButtons();

    window.__KFN_SYNC_HUD_DRAW__ = syncHudDrawButtons;

    function updateHudDrawButtons(mode, on) {
      if (hudDrawPen) {
        hudDrawPen.classList.toggle('pressed', on && mode === 'pen');
      }
      if (hudDrawErase) {
        hudDrawErase.classList.toggle('pressed', on && mode === 'erase');
      }
    }

    if (hudDrawPen) {
      hudDrawPen.addEventListener('click', () => {
       
        const nextOn = !(__kfn_draw_active && __kfn_draw_mode === 'pen');

        setDrawMode(nextOn);
        __kfn_draw_mode = 'pen';
       
        syncHudDrawButtons();
      });
    }

    if (hudDrawErase) {
      hudDrawErase.addEventListener('click', () => {
       
        const nextOn = !(__kfn_draw_active && __kfn_draw_mode === 'erase');

        setDrawMode(nextOn);
        __kfn_draw_mode = 'erase';
       
        syncHudDrawButtons();
      });
    }

    if (hudDrawClear) {
      hudDrawClear.addEventListener('click', () => {
        try {
          if (__kfn_draw_ctx && __kfn_draw_layer) {
            __kfn_draw_ctx.clearRect(
              0, 0,
              __kfn_draw_layer.width, __kfn_draw_layer.height
            );
          }
        } catch { }
      });
    }


   
    function setHudPlaybackRate(rate) {
      const v = ensureVideo(); if (!v) return;
      try { stopGuard?.(); } catch { }
      v.playbackRate = Math.max(0.05, Math.min(4.0, Number(rate) || 1.0));
    }

    const hudRateSelect = $('hudRateSelect');
    if (hudRateSelect) {
     
      hudRateSelect.value = '1';

      hudRateSelect.addEventListener('change', () => {
        setHudPlaybackRate(hudRateSelect.value);
      });
    }

    $('hudMarkIn').addEventListener('click', () => {
      const v = ensureVideo(); if (!v) return;
      S.marks.in = v.currentTime;
      if (Number.isFinite(S.marks.out) && !(S.marks.out > S.marks.in)) S.marks.out = null;
      S.loopEnabled = Number.isFinite(S.marks.in) && Number.isFinite(S.marks.out) && S.marks.out > S.marks.in;
      updateHudTimes(); reflectButtons();
    });

    $('hudMarkOut').addEventListener('click', () => {
      const v = ensureVideo(); if (!v) return;
      const t = v.currentTime;
      S.marks.out = (Number.isFinite(S.marks.in) && t > S.marks.in) ? t : null;
      S.loopEnabled = Number.isFinite(S.marks.in) && Number.isFinite(S.marks.out) && S.marks.out > S.marks.in;
      updateHudTimes(); reflectButtons();
    });

    $('hudClear').addEventListener('click', () => {
      S.marks.in = null; S.marks.out = null; S.loopEnabled = false;
      updateHudTimes(); reflectButtons();
    });

   
    $('hudAddMarks').addEventListener('click', async () => {
      const v = ensureVideo(); if (!v) return;
      if (!Number.isFinite(S.marks.in)) { alert('Mark In is not set.'); return; }

      try {
        await chrome.runtime.sendMessage({
          txt: 'add-current-as-new',
          payload: { in: S.marks.in, out: S.marks.out }
        });
      } catch (e) {
        console.warn('HUD add marks failed', e);
      }
     
      S.marks.in = null;
      S.marks.out = null;
      S.loopEnabled = false;
      updateHudTimes();
      reflectButtons();

     
      const btn = $('hudAddMarks');
      const oldLabel = btn.textContent;

     
      btn.textContent = '✓ Added';
      btn.disabled = true;

     
      setTimeout(() => {
        btn.textContent = oldLabel;
        btn.disabled = false;
      }, 900);

    });


    function fmt(t) {
      if (t == null || isNaN(t)) return '--:--';
      const m = Math.floor(t / 60), s = t % 60;
      return `${String(m).padStart(2, '0')}:${s.toFixed(2, '0').padStart(5, '0')}`;
    }
    function updateHudTimes() {
      elTimes.textContent = `In ${fmt(S.marks.in)} / Out ${fmt(S.marks.out)}`;
    }
    function reflectButtons() {
      elIn.classList.toggle('pressed', Number.isFinite(S.marks.in));
      elOut.classList.toggle('pressed', Number.isFinite(S.marks.out));
      elOut.classList.toggle('pressed-out', Number.isFinite(S.marks.out));
    }
    updateHudTimes(); reflectButtons();

   
    const dragEl = $('hudDrag');
    dragEl.addEventListener('pointerdown', (ev) => {
      const t = ev.target;
     
      if (t && t.closest) {
       
        if (t.closest('#hudClose') ||
          t.closest('#hudRateSelect') ||
          t.closest('#hudToggleDraw')) {
          return;
        }
      }
      ev.preventDefault();
      const rect = box.getBoundingClientRect();
      __kfn_draw_blocked = true;
      S.dragging = { dx: ev.clientX - rect.left, dy: ev.clientY - rect.top };
      dragEl.setPointerCapture(ev.pointerId);
      dragEl.style.cursor = 'grabbing';
    });
    dragEl.addEventListener('pointermove', async (ev) => {
      if (!S.dragging) return;
      const x = clamp(ev.clientX - S.dragging.dx, 0, window.innerWidth - box.offsetWidth);
      const y = clamp(ev.clientY - S.dragging.dy, 0, window.innerHeight - box.offsetHeight);
      setHudPosition(x, y);
    });
    dragEl.addEventListener('pointerup', async (ev) => {
      if (!S.dragging) return;

      dragEl.releasePointerCapture(ev.pointerId);
      dragEl.style.cursor = 'grab';
      const rect = box.getBoundingClientRect();
      S.dragging = null;
      await saveHudPos(S.hud.scopeKey, { x: rect.left, y: rect.top });
      __kfn_draw_blocked = false;
    });
    dragEl.addEventListener("pointercancel", () => {
      __kfn_draw_blocked = false;
    });
    try { chrome.runtime.sendMessage({ txt: 'hud-open-state', open: true }); } catch { }
  }

  
  if (!window.__KFN_MSG_BOUND__) {
    window.__KFN_MSG_BOUND__ = true;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const txt = message?.txt;
      if (!txt) return;
      try { console.log('[KFN][contents] onMessage:', txt); } catch { }
      if (txt === 'ping') {
        setTimeout(() => { try { sendResponse({ pong: true }); } catch { } }, 0);
        return true;
      }

     
      if (txt === 'hud-toggle') {
        const show = !!message.show;
        const scopeKey = message.scopeKey || '';
        const pos = message.pos || null;

        if (show) {
          ensureHUD({ scopeKey, pos }).then(() => sendResponse?.({ ok: true })).catch(() => sendResponse?.({ ok: false }));
        } else {
          destroyHUD();
          try { if (scopeKey) chrome.storage.local.set({ [`oneframe_hud_open::${scopeKey}`]: false }); } catch { }
          setTimeout(() => sendResponse?.({ ok: true }), 0);
        }
        return true;
      }
     
      if (txt === 'draw-toggle') {
        const on = !!message.enable;
        try {
          setDrawMode(on);
          sendResponse?.({ ok: true, active: on });
        } catch {
          sendResponse?.({ ok: false });
        }
        return true;
      }

     
      if (txt === 'draw-mode') {
        const mode = (message.mode === 'erase') ? 'erase' : 'pen';
        __kfn_draw_mode = mode;

       
        buildHudColorButtons();

        try { sendResponse?.({ ok: true, mode }); } catch { }
        return true;
      }

      if (txt === 'draw-clear') {
        try {
          if (__kfn_draw_ctx && __kfn_draw_layer) {
            __kfn_draw_ctx.clearRect(
              0, 0,
              __kfn_draw_layer.width,
              __kfn_draw_layer.height
            );
          }
          sendResponse?.({ ok: true });
        } catch {
          sendResponse?.({ ok: false });
        }
        return true;
      }

     
      if (txt === 'draw-export') {
        try {
         
          ensureDrawLayer();

          if (__kfn_draw_layer && __kfn_draw_ctx) {
            const dataUrl = __kfn_draw_layer.toDataURL('image/png');
            console.log('[contents] draw-export len=', dataUrl.length);
            try {
              sendResponse && sendResponse({ ok: true, dataUrl });
            } catch (e) { }
          } else {
            try {
              sendResponse && sendResponse({ ok: true, dataUrl: null });
            } catch (e) { }
          }
        } catch (e) {
          console.warn('[contents] draw-export failed', e);
          try {
            sendResponse && sendResponse({ ok: false, dataUrl: null, error: String(e) });
          } catch (e2) { }
        }
        return true;
      }

      if (txt === 'draw-import') {
        try {
          ensureDrawLayer();
          if (__kfn_draw_layer && __kfn_draw_ctx) {
            const ctx = __kfn_draw_ctx;

           
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, __kfn_draw_layer.width, __kfn_draw_layer.height);

            const dataUrl = message && message.dataUrl;
            if (typeof dataUrl === 'string' && dataUrl) {
              console.log('[contents] draw-import len=', dataUrl.length);
              const img = new Image();
              img.onload = () => {
                try {
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.clearRect(0, 0, __kfn_draw_layer.width, __kfn_draw_layer.height);
                  ctx.drawImage(
                    img,
                    0, 0,
                    __kfn_draw_layer.width,
                    __kfn_draw_layer.height
                  );
                } catch (e) {
                  console.warn('[contents] draw-import drawImage failed', e);
                }
              };
              img.src = dataUrl;
            } else {
              console.log('[contents] draw-import: no data → clear only');
            }
          }
        } catch (e) {
          console.warn('[contents] draw-import failed', e);
        }
       
        return;
      }



      if (txt === 'get-marks') {
        setTimeout(() => {
          try {
            const v = ensureVideo();
            if (!v) return;
            sendResponse({
              in: (S.marks.in ?? null),
              out: (S.marks.out ?? null),
              time: v.currentTime,
              duration: v.duration,
            });
          } catch { }
        }, 0);
        return true;
      }

      if (txt === 'set-fps') {
        const v = ensureVideo();
        if (isFinite(message.fps) && message.fps > 0 && message.fps <= 240) S.fps = Number(message.fps);
        setTimeout(() => { try { sendResponse({ ok: true, fps: S.fps }); } catch { } }, 0);
        return true;
      }

      if (txt === 'set-step-config') {
        if (Number.isFinite(message.frameStep) && message.frameStep >= 1) {
          S.frameStep = Math.round(message.frameStep);
        }
        setTimeout(() => { try { sendResponse?.({ ok: true }); } catch {} }, 0);
        return true;
      }

      if (txt === 'step-frame-forward' || txt === 'step-frame-backward') {
        const v = ensureVideo(); if (!v) return true;
        const step = frameStepSec() * S.frameStep * (txt === 'step-frame-backward' ? -1 : 1);
        (async () => {
          try {
            const wasPlaying = !v.paused && !v.ended;
            if (!isYouTube()) {           
              await disneyEnsurePaused(v);
            }
            const t = v.currentTime + step;
            v.currentTime = Math.max(0, Math.min(v.duration || Number.MAX_SAFE_INTEGER, t));
            if (isYouTube()) {
              if (wasPlaying) v.play?.().catch(() => { });
            } else {
              startGuard(v, 1200);
            }
          } catch { }
          setTimeout(() => {
            try { sendResponse({ in: S.marks.in, out: S.marks.out, time: v?.currentTime ?? null, duration: v?.duration ?? null }); } catch { }
          }, 0);
        })();
        return true;
      }

      if (message?.txt === 'seek-rel' && typeof message.sec === 'number') {
        const v = ensureVideo(); if (!v) { sendResponse?.({ ok: false }); return true; }
        const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
        const cur = Number.isFinite(v.currentTime) ? v.currentTime : 0;
        v.currentTime = Math.min(dur, Math.max(0, cur + message.sec));
        try { updateHudTimes?.(); } catch { }
        sendResponse?.({ ok: true, time: v.currentTime, duration: dur });
        return true;
      }
      if (message?.txt === 'loop-disable') {
       
        if (typeof stopGuard === 'function') try { stopGuard(); } catch { }
        S.loopEnabled = false;

       
        S.marks.in = null;
        S.marks.out = null;
        S.loopEnabled = false;
        updateHudTimes();
        reflectButtons();
       
        if (typeof stopGuard === 'function') try { stopGuard(); } catch { }
       
        try { updateHudTimes?.(); } catch { }
        try { reflectButtons?.(); } catch { }

        sendResponse?.({ ok: true });
        return true;
      }

     
      if (message?.txt === 'toggle-play' || message?.txt === 'hud-play-toggle') {
        console.log('[KFN][contents] toggle-play received'); 
        const v = ensureVideo();
        if (!v) {
          try { sendResponse?.({ ok: false, reason: 'no-video' }); } catch { }
          return true;
        }

        (async () => {
          try {
            if (typeof stopGuard === 'function') stopGuard();
            S.lastAction = 'toggle';
            await disneyTogglePlay(v);
          } catch { }

          try { updateHudTimes?.(); } catch { }
          try {
            sendResponse?.({
              ok: true,
              paused: !!v.paused,
              time: v.currentTime,
              duration: v.duration
            });
          } catch { }
        })();

        return true;
      }

     
      if (message?.txt === 'rate-set') {
        const v = ensureVideo(); if (!v) { sendResponse?.({ ok: false }); return true; }
        const rate = Number(message.rate);
        if (!Number.isFinite(rate) || rate <= 0) { sendResponse?.({ ok: false }); return true; }
        try { stopGuard?.(); } catch { }
        v.playbackRate = Math.max(0.05, Math.min(4.0, rate));
        setTimeout(() => { try { sendResponse?.({ ok: true, rate: v.playbackRate }); } catch { } }, 0);
        return true;
      }

     
      if (message?.txt === 'rate-reset') {
        const v = ensureVideo(); if (!v) { sendResponse?.({ ok: false }); return true; }
        try { stopGuard?.(); } catch { }
        v.playbackRate = 1.0;
        setTimeout(() => { try { sendResponse?.({ ok: true, rate: v.playbackRate }); } catch { } }, 0);
        return true;
      }

      if (txt === 'set-mark-in' || txt === 'set-mark-out' || txt === 'clear-marks') {
        const v = ensureVideo();
        if (!v) return;
        if (txt === 'set-mark-in') {
          S.marks.in = v.currentTime;
          if (Number.isFinite(S.marks.out) && !(S.marks.out > S.marks.in)) S.marks.out = null;
          try { refreshHudDom(); } catch { }
        } else if (txt === 'set-mark-out') {
          const t = v.currentTime;
          S.marks.out = (Number.isFinite(S.marks.in) && t > S.marks.in) ? t : null;
          try { refreshHudDom(); } catch { }
        } else {
          S.marks.in = null; S.marks.out = null; S.loopEnabled = false;
          try { refreshHudDom(); } catch { }
        }
       
        try { updateHudTimes?.(); reflectButtons?.(); } catch { }
        setTimeout(() => {
          try {
            sendResponse({
              in: S.marks.in, out: S.marks.out,
              time: v.currentTime, duration: v.duration
            });
          } catch { }
        }, 0);
        return true;
      }

      if (txt === 'set-marks') {
        const v = ensureVideo();
        if (!v) return;

        if (typeof message.in === 'number' && isFinite(message.in)) {
          S.marks.in = message.in;
        } else if (!Number.isFinite(S.marks.in)) {
          S.marks.in = null;
        }

        if ('out' in message) {
          const o = message.out;
          const validOut = (typeof o === 'number' && isFinite(o) && o > (S.marks.in ?? -Infinity)) ? o : null;
          S.marks.out = validOut;
        } else {
          S.marks.out = null;
        }
        S.loopEnabled = (Number.isFinite(S.marks.in) && Number.isFinite(S.marks.out) && S.marks.out > S.marks.in);
       
        try { refreshHudDom(); } catch { }
       
        try { updateHudTimes?.(); reflectButtons?.(); } catch { }

        setTimeout(() => { try { sendResponse({ ok: true }); } catch { } }, 0);
        return true;
      }

      if (txt === 'seek-to') {
        const v = ensureVideo();
        if (!v) return;
        (async () => {
          const t = Number(message.time);
          if (isFinite(t)) {
            try {
              const wasPlaying = !v.paused && !v.ended;
              v.currentTime = Math.max(0, Math.min(v.duration || Number.MAX_SAFE_INTEGER, t));
              if (wasPlaying) {
                stopGuard();
                S.lastAction = 'toggle';
                await disneyTogglePlay(v);
              }
            } catch { }
          }
          setTimeout(() => {
            try {
              sendResponse({
                in: S.marks.in, out: S.marks.out,
                time: v.currentTime, duration: v.duration
              });
            } catch { }
          }, 0);
        })();
        try { refreshHudDom(); } catch { }
        return true;
      }
    });
  }
})();






var __kfn_draw_layer = typeof __kfn_draw_layer !== 'undefined' ? __kfn_draw_layer : null;
var __kfn_draw_ctx = typeof __kfn_draw_ctx !== 'undefined' ? __kfn_draw_ctx : null;
var __kfn_draw_active = typeof __kfn_draw_active !== 'undefined' ? __kfn_draw_active : false;

var __kfn_draw_mode = typeof __kfn_draw_mode !== 'undefined' ? __kfn_draw_mode : 'pen';


var __kfn_draw_color = typeof __kfn_draw_color !== 'undefined' ? __kfn_draw_color : 'yellow';



var __kfn_pen_size = typeof __kfn_pen_size !== 'undefined' ? __kfn_pen_size : 6;


var __kfn_pen_opacity = typeof __kfn_pen_opacity !== 'undefined'
  ? __kfn_pen_opacity
  : 1.0;  



const KFN_DRAW_COLOR_MAP = {
  yellow: '#fde047',
  green: '#4ade80',
  blue: '#0000FF',
  red: '#f91437ff',
  purple: '#812990',
  pink: '#F19EB6',
  cyan: '#7cc7e8',
  orange: '#fb923c',
  black: '#000000',
  white: '#ffffff',
};



function setDrawMode(on) {
  ensureDrawLayer();
  __kfn_draw_active = !!on;

  if (__kfn_draw_layer) {
    __kfn_draw_layer.style.pointerEvents = __kfn_draw_active ? 'auto' : 'none';
  }

 
  try {
    if (typeof window.__KFN_SYNC_HUD_DRAW__ === 'function') {
      window.__KFN_SYNC_HUD_DRAW__();
    }
  } catch { }
}
window.__KFN_SET_DRAW_MODE__ = setDrawMode;


function ensureDrawLayer() {
  if (__kfn_draw_layer) return __kfn_draw_layer;

  const layer = document.createElement("canvas");
  layer.id = "kfn-draw-layer";
  layer.style.position = "fixed";
  layer.style.left = "0";
  layer.style.top = "0";
  layer.style.width = "100vw";
  layer.style.height = "100vh";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "999999";     
  layer.width = window.innerWidth;
  layer.height = window.innerHeight;

  const ctx = layer.getContext("2d");
  ctx.strokeStyle = "red";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  document.body.appendChild(layer);

  __kfn_draw_layer = layer;
  __kfn_draw_ctx = ctx;

 
  window.addEventListener("resize", () => {
    layer.width = window.innerWidth;
    layer.height = window.innerHeight;
  });

  return layer;
}


chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.txt === "draw-enable") {
    ensureDrawLayer();
    __kfn_draw_active = true;
    __kfn_draw_layer.style.pointerEvents = "auto";
  }
  if (msg?.txt === "draw-disable") {
    __kfn_draw_active = false;
    if (__kfn_draw_layer)
      __kfn_draw_layer.style.pointerEvents = "none";
  }
  if (msg?.txt === "draw-clear") {
    if (__kfn_draw_ctx)
      __kfn_draw_ctx.clearRect(0, 0, __kfn_draw_layer.width, __kfn_draw_layer.height);
  }
});





function getHudRect() {
  try {
    const divs = document.querySelectorAll('div');
    for (const el of divs) {
      const root = el.shadowRoot;
      if (!root) continue;
      const box = root.getElementById('oneframe-hud');
      if (box) {
        return box.getBoundingClientRect();
      }
    }
    return null;
  } catch (err) {
    console.debug('[HUD RECT ERROR]', err);
    return null;
  }
}


function isPointInHud(x, y) {
  const rect = getHudRect();
  if (!rect) {
   
    return false;
  }

  const inside =
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom;

 
 

  return inside;
}


let drawing = false;
let lastX = 0, lastY = 0;


let __kfn_draw_blocked = false;

document.addEventListener("pointerdown", (e) => {
 
  if (!__kfn_draw_active || !__kfn_draw_ctx) return;

  const x = e.clientX;
  const y = e.clientY;

 
  if (__kfn_draw_blocked) return;

 
  if (isPointInHud(x, y)) {
   
    return;
  }

  const ctx = __kfn_draw_ctx;
 
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = __kfn_pen_size;

  if (__kfn_draw_mode === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    const colHex = KFN_DRAW_COLOR_MAP[__kfn_draw_color] || '#ffeb3b';
     
  const r = parseInt(colHex.slice(1, 3), 16);
  const g = parseInt(colHex.slice(3, 5), 16);
  const b = parseInt(colHex.slice(5, 7), 16);
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${__kfn_pen_opacity})`;

  }

  drawing = true;
  lastX = x;
  lastY = y;
});








document.addEventListener("pointermove", (e) => {
  if (!drawing || !__kfn_draw_ctx) return;

 
  if (__kfn_draw_blocked) return;

  const x = e.clientX;
  const y = e.clientY;

 
  if (isPointInHud(x, y)) {
   
    drawing = false;
    return;
  }
  

  const ctx = __kfn_draw_ctx;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();

  lastX = x;
  lastY = y;
});


document.addEventListener("pointerup", () => {
  drawing = false;
});





window.__KFN_CONTENT_READY__ = true;