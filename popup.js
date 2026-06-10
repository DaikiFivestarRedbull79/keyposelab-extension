
const ST = chrome.storage.session;

// === Step Config ===
let cfgFrameStep = 1;
let cfgSecStep   = 1;

function updateStepLabels() {
  const fl = $('labelBack'),  fr = $('labelFwd');
  const sl = $('labelBack1s'), sr = $('labelFwd1s');
  if (fl) fl.textContent = `−${cfgFrameStep}F`;
  if (fr) fr.textContent = `＋${cfgFrameStep}F`;
  if (sl) sl.textContent = `−${cfgSecStep}S`;
  if (sr) sr.textContent = `＋${cfgSecStep}S`;
}

function reflectStepUI() {
  document.querySelectorAll('.cfg-frame-btn').forEach(btn => {
    btn.classList.toggle('is-active', Number(btn.dataset.val) === cfgFrameStep);
  });
  document.querySelectorAll('.cfg-sec-btn').forEach(btn => {
    btn.classList.toggle('is-active', Number(btn.dataset.val) === cfgSecStep);
  });
  const fi = $('cfgFrameStep'), si = $('cfgSecStep');
  if (fi) fi.value = cfgFrameStep;
  if (si) si.value = cfgSecStep;
}

async function applyStepConfig(frameStep, secStep) {
  cfgFrameStep = Math.max(1, Math.round(Number(frameStep) || 1));
  cfgSecStep   = Math.max(1, Math.round(Number(secStep) || 1));
  updateStepLabels();
  reflectStepUI();
  try { await chrome.storage.local.set({ kfn_frame_step: cfgFrameStep, kfn_sec_step: cfgSecStep }); } catch {}
  await sendToActiveOneWay({ txt: 'set-step-config', frameStep: cfgFrameStep, secondStep: cfgSecStep });
}

async function initStepConfig() {
  try {
    const o = await chrome.storage.local.get(['kfn_frame_step', 'kfn_sec_step']);
    if (o?.kfn_frame_step) cfgFrameStep = Number(o.kfn_frame_step);
    if (o?.kfn_sec_step)   cfgSecStep   = Number(o.kfn_sec_step);
  } catch {}
  updateStepLabels();
  reflectStepUI();
  await sendToActiveOneWay({ txt: 'set-step-config', frameStep: cfgFrameStep, secondStep: cfgSecStep });
}

$('configToggle')?.addEventListener('click', async () => {
  const panel = $('configPanel');
  if (!panel) return;
  const on = panel.style.display !== 'block';
  panel.style.display = on ? 'block' : 'none';
  try { await ST.set({ kfn_config_open: on }); } catch {}
});

document.querySelectorAll('.cfg-frame-btn').forEach(btn => {
  btn.addEventListener('click', () => applyStepConfig(btn.dataset.val, cfgSecStep));
});
document.querySelectorAll('.cfg-sec-btn').forEach(btn => {
  btn.addEventListener('click', () => applyStepConfig(cfgFrameStep, btn.dataset.val));
});
$('cfgFrameStep')?.addEventListener('change', () => {
  const v = Number($('cfgFrameStep').value);
  if (v >= 1) applyStepConfig(v, cfgSecStep);
});
$('cfgSecStep')?.addEventListener('change', () => {
  const v = Number($('cfgSecStep').value);
  if (v > 0) applyStepConfig(cfgFrameStep, v);
});

function $(id) { return document.getElementById(id); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function isBlockedUrl(url) { return /^(chrome|edge|about|file):\/\//i.test(url || ''); }


(async () => {
  try { await chrome.storage.session.set({ kfn_popup_open: true }); } catch {}
})();
window.addEventListener('beforeunload', async () => {
  try { await chrome.storage.session.set({ kfn_popup_open: false }); } catch {}
});


async function applyTheme(theme) {
  const root = document.documentElement;
  let mode = theme;
  if (theme === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    mode = prefersDark ? 'dark' : 'light';
  }
  if (mode === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  try { await ST.set({ oneframe_theme: theme }); } catch { }
}





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







let paletteEl = null;
let paletteIdx = -1;

function ensurePalette() {
  if (paletteEl) return paletteEl;
  const el = document.createElement('div');
  el.className = 'seg-palette';
  el.setAttribute('role', 'menu');
  el.style.display = 'none';
  el.innerHTML = SEG_COLORS.map(c =>
    `<div class="seg-swatch" role="menuitem" tabindex="0" data-color="${c.key}" title="${c.title}"></div>`
  ).join('');
  document.body.appendChild(el);

 
  el.addEventListener('click', async (e) => {
    const sw = e.target.closest('.seg-swatch');
    if (!sw) return;
    const color = sw.getAttribute('data-color');
    if (paletteIdx >= 0 && segments[paletteIdx]) {
      segments[paletteIdx].color = color;
      try { await saveSegmentsForActiveTab(segments, segIndex); } catch { }
      renderSegList();
    }
    closePalette();
  });

 
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePalette(); });
  document.addEventListener('click', (e) => {
    if (!el || el.style.display === 'none') return;
    const btn = document.querySelector(`[data-act="color"][data-i="${paletteIdx}"]`);
    if (btn && (e.target === btn || btn.contains(e.target))) return;
    if (!el.contains(e.target)) closePalette();
  });

  paletteEl = el;
  return el;
}

function openPaletteForButton(btn, idx) {
  const el = ensurePalette();
  paletteIdx = idx;

 
  const cur = segments[idx]?.color || 'none';
  el.querySelectorAll('.seg-swatch').forEach(s => {
    s.classList.toggle('is-active', s.getAttribute('data-color') === cur);
  });

 
  const r = btn.getBoundingClientRect();
  const scrollX = document.documentElement.scrollLeft || document.body.scrollLeft || 0;
  const scrollY = document.documentElement.scrollTop || document.body.scrollTop || 0;

  el.style.left = `${Math.max(8, Math.min(r.left + scrollX, window.innerWidth - 176))}px`;
  el.style.top = `${r.bottom + scrollY + 6}px`;
  el.style.display = 'flex';
}

function closePalette() {
  if (!paletteEl) return;
  paletteEl.style.display = 'none';
  paletteIdx = -1;
}



async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}


async function ensureContentInjected() {
  const tabId = await getActiveTabId();
  if (!tabId) return;

 
  let injected = false;
  try {
    const res = await chrome.tabs.sendMessage(tabId, { txt: "ping" });
    injected = !!(res && res.pong);
  } catch (e) {
    injected = false;
  }

  if (!injected) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["contents.js"]
    });
   
    try {
      await new Promise(r => setTimeout(r, 50));
      await chrome.tabs.sendMessage(tabId, { txt: "ping" });
    } catch (e) {
     
    }
  }
}

async function initTheme() {
  try {
    const o = await ST.get(['oneframe_theme']);
    const theme = o?.oneframe_theme || 'system';
    await applyTheme(theme);
    if (theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', () => applyTheme('system'));
    }
    const btn = $('themeToggle');
    if (btn) { btn.textContent = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️'; }
  } catch { }
}
$('themeToggle')?.addEventListener('click', async () => {
  try {
    const o = await ST.get(['oneframe_theme']);
    const cur = o?.oneframe_theme || 'system';
    const next = (cur === 'light') ? 'dark' : (cur === 'dark') ? 'system' : 'light';
    await applyTheme(next);
    const btn = $('themeToggle');
    if (btn) { btn.textContent = next === 'dark' ? '🌙' : next === 'light' ? '☀️' : '🖥️'; }
  } catch { }
});


async function getActiveTab() {
  try {
    let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs && tabs[0] && !isBlockedUrl(tabs[0].url)) return tabs[0];
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && !isBlockedUrl(tabs[0].url)) return tabs[0];
    const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const focused = wins.find(w => w.focused) || wins[0];
    const activeTab = focused?.tabs?.find(t => t.active && !isBlockedUrl(t.url)) || focused?.tabs?.find(t => !isBlockedUrl(t.url));
    return activeTab || null;
  } catch { return null; }
}
async function sendRequest(tabId, msg) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, msg, (res) => { void chrome.runtime.lastError; resolve(res || null); });
    } catch { resolve(null); }
  });
}
function sendOneWay(tabId, msg) { try { chrome.tabs.sendMessage(tabId, msg); } catch { } }
async function ensureContentReady(tab) {
  if (!tab?.id || isBlockedUrl(tab.url)) return false;
  const ping = async () => { const r = await sendRequest(tab.id, { txt: 'ping' }); return !!r?.pong; };
  if (await ping()) return true;
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['contents.js'] }); await sleep(250); } catch { }
  return await ping();
}


async function sendToActiveOneWay(msg) {
  const tab = await getActiveTab();
  if (!tab?.id || isBlockedUrl(tab.url)) return;
  if (!await ensureContentReady(tab)) return;
  sendOneWay(tab.id, msg);
}
async function requestMarks() {
  const tab = await getActiveTab();
  if (!tab?.id || isBlockedUrl(tab.url)) return null;
  const ask = () => new Promise(res => {
    chrome.tabs.sendMessage(tab.id, { txt: 'get-marks' }, (r) => { void chrome.runtime.lastError; res(r || null); });
  });
  for (let i = 0; i < 3; i++) {
    const r = await ask();
    if (r) return r;
    try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['contents.js'] }); } catch { }
    await sleep(120);
  }
  return null;
}


async function getScopeKey() {
  const tab = await getActiveTab();
  const id = (tab && Number.isInteger(tab.id)) ? tab.id : 'unknown';
  const key = `oneframe_segments::tab-${id}`;
  try { await ST.set({ oneframe_last_scope_key: key }); } catch { }
  return key;
}


async function loadSegmentsForActiveTab() {
  const tab = await getActiveTab(); if (!tab?.id) return { segments: [], index: -1 };
  const key = await getScopeKey();
  const bag = await ST.get([key, 'oneframe_migrated']);
  if (!bag[key] && !bag.oneframe_migrated) {
    const legacy = await ST.get(['oneframe_segments', 'oneframe_seg_index']);
    if (legacy?.oneframe_segments) {
      const payload = { segments: legacy.oneframe_segments, index: legacy.oneframe_seg_index ?? -1 };
      await ST.set({ [key]: payload, oneframe_migrated: true });
      await ST.remove(['oneframe_segments', 'oneframe_seg_index']);
      return payload;
    }
  }
  return bag[key] || { segments: [], index: -1 };
}
async function saveSegmentsForActiveTab(segments, index) {
  const key = await getScopeKey();
  const payload = { segments, index };
  await ST.set({ [key]: payload, oneframe_last_scope_key: key });
}


async function getHudState(scopeKey) {
  const o = await ST.get([`oneframe_hud_open::${scopeKey}`, `oneframe_hud_pos::${scopeKey}`]);
  return {
    open: !!o?.[`oneframe_hud_open::${scopeKey}`],
    pos: o?.[`oneframe_hud_pos::${scopeKey}`] || { x: 16, y: 16 }
  };
}
async function setHudOpen(scopeKey, open) {
  await ST.set({ [`oneframe_hud_open::${scopeKey}`]: !!open });
}
async function ensureHudOpenForActiveTab(tab) {
  if (!tab?.id || isBlockedUrl(tab.url)) return;

  const scope = await getScopeKey();
  const state = await getHudState(scope);

  if (!state.open) {
    await setHudOpen(scope, true);
    await sendRequest(tab.id, {
      txt: 'hud-toggle',
      show: true,
      scopeKey: scope,
      pos: state.pos
    });
  }
}



$('toggleHud').addEventListener('click', async () => {
  const tab = await getActiveTab(); if (!tab?.id) return;
  if (!await ensureContentReady(tab)) return;
  const scope = await getScopeKey();
  const state = await getHudState(scope);
  const nextOpen = !state.open;

  await setHudOpen(scope, nextOpen);
  await sendRequest(tab.id, { txt: 'hud-toggle', show: nextOpen, scopeKey: scope, pos: state.pos });
});






const penBtn   = $('drawPenToggle');
const eraseBtn = $('drawEraseToggle');

let drawOn   = false;
let drawMode = 'pen';

function updateDrawButtons() {
  if (penBtn)   penBtn.classList.toggle('is-active', drawOn && drawMode === 'pen');
  if (eraseBtn) eraseBtn.classList.toggle('is-active', drawOn && drawMode === 'erase');
}

async function applyDrawState() {
  const tab = await getActiveTab();
  if (!tab?.id || isBlockedUrl(tab.url)) return;
  const ready = await ensureContentReady(tab);
  if (!ready) return;

 
  if (drawOn) {
    await ensureHudOpenForActiveTab(tab);
  }

 
  try {
    await sendRequest(tab.id, { txt: 'draw-toggle', enable: drawOn });
  } catch (e) {
    console.warn('draw-toggle failed', e);
  }

 
  if (drawOn) {
    try {
      await sendRequest(tab.id, { txt: 'draw-mode', mode: drawMode });
    } catch (e) {
      console.warn('draw-mode failed', e);
    }
  }
}


if (penBtn) {
  penBtn.addEventListener('click', async () => {
    flash(penBtn);
    if (drawOn && drawMode === 'pen') {
     
      drawOn = false;
    } else {
      drawOn = true;
      drawMode = 'pen';
    }
    updateDrawButtons();
    await applyDrawState();
  });
}

if (eraseBtn) {
  eraseBtn.addEventListener('click', async () => {
    flash(eraseBtn);
    if (drawOn && drawMode === 'erase') {
     
      drawOn = false;
    } else {
      drawOn = true;
      drawMode = 'erase';
    }
    updateDrawButtons();
    await applyDrawState();
  });
}



function fmt(t) {
  if (t == null || isNaN(t)) return '--:--';
  const m = Math.floor(t / 60), s = t % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2, '0').padStart(5, '0')}`;
}
function fmtMaybe(t) { return (t == null || !Number.isFinite(t)) ? '—' : fmt(t); }
function reflectUI(st) {
  const tIn = st?.in, tOut = st?.out, t = st?.time, D = st?.duration;
  $('times').textContent = `In ${fmt(tIn)} / Out ${fmt(tOut)}`;
  $('markIn').setAttribute('aria-pressed', String(Number.isFinite(tIn)));
  $('markOut').setAttribute('aria-pressed', String(Number.isFinite(tOut)));
  const w = $('progress').clientWidth || 1;
  const head = $('head'), seg = $('seg');
  if (D && D > 0) {
    const p = Math.max(0, Math.min(1, (t || 0) / D));
    head.style.transform = `translateX(${Math.round(p * w)}px)`;
    head.style.display = 'block';
    if (Number.isFinite(tIn) && Number.isFinite(tOut) && tOut > tIn) {
      const x = Math.max(0, Math.min(1, tIn / D)), y = Math.max(0, Math.min(1, tOut / D));
      seg.style.left = `${Math.round(x * w)}px`;
      seg.style.width = `${Math.round((y - x) * w)}px`;
    } else {
      seg.style.left = '0px'; seg.style.width = '0px';
    }
  } else { head.style.display = 'none'; seg.style.width = '0px'; }
}
function flash(el, ok = true) {
  if (!el) return;
  el.classList.remove('released'); el.classList.add('active');
  el.style.filter = ok ? 'brightness(1.2)' : 'brightness(1.1) saturate(1.2)';
  setTimeout(() => { el.classList.remove('active'); el.classList.add('released'); el.style.filter = ''; }, 140);
}


const fpsPanel = $('fpsPanel'); const chapterPanel = $('chapterPanel');
function togglePanel(el, on) { el.style.display = on ? 'block' : 'none'; }
$('fpsLabel').addEventListener('click', async () => {
  const on = fpsPanel?.style.display !== 'block'; if (fpsPanel) togglePanel(fpsPanel, on);
  try { await ST.set({ oneframe_fps_open: on }); } catch { }
});
$('toggleChapter').addEventListener('click', async () => {
  const on = chapterPanel?.style.display !== 'block'; if (chapterPanel) togglePanel(chapterPanel, on);
  try { await ST.set({ oneframe_chapter_open: on }); } catch { }
});


function updateRateUI(rate){
  document.querySelectorAll('.slow-controls .rate-btn').forEach(btn=>{
    const r = Number(btn.dataset.rate);
    const active = (r === Number(rate));
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.classList.toggle('is-active', active);
  });
}


$('rate025')?.addEventListener('click', async ()=>{
  await sendToActiveOneWay({ txt:'rate-set', rate:0.25 });
  updateRateUI(0.25);
});
$('rate05')?.addEventListener('click', async ()=>{
  await sendToActiveOneWay({ txt:'rate-set', rate:0.5 });
  updateRateUI(0.5);
});
$('rate075')?.addEventListener('click', async ()=>{
  await sendToActiveOneWay({ txt:'rate-set', rate:0.75 });
  updateRateUI(0.75);
});
$('rate1')?.addEventListener('click', async ()=>{
  await sendToActiveOneWay({ txt:'rate-reset' });
  updateRateUI(1);
});
$('rate2')?.addEventListener('click', async ()=>{
  await sendToActiveOneWay({ txt:'rate-set', rate:2 });
  updateRateUI(2);
});


let segments = []; let segIndex = -1;
const segInfo = $('segInfo'), segPrevBtn = $('segPrev'), segNextBtn = $('segNext');

function segCompare(a, b) {
  const ai = Number.isFinite(a?.in) ? a.in : Number.POSITIVE_INFINITY;
  const bi = Number.isFinite(b?.in) ? b.in : Number.POSITIVE_INFINITY;
  return ai - bi;
}
function parseTimeToSeconds(x) {
  if (x == null) return null;
  if (typeof x === 'number' && isFinite(x)) return x;
  const s = String(x).trim(); if (!s) return null;
  const n = Number(s); if (isFinite(n)) return n;
  const m = s.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (m) { const min = +m[1], sec = +m[2], frac = Number('0.' + (m[3] || '0')); if (isFinite(min) && isFinite(sec) && isFinite(frac)) return min * 60 + sec + frac; }
  return null;
}
function normalizeSegments(input) {
  if (!Array.isArray(input)) return [];
  const list = [];
  for (const it of input) {
    const a = parseTimeToSeconds(it?.in);
    const b = parseTimeToSeconds(it?.out);
    const hasIn = (a != null && isFinite(a));
    const hasOut = (b != null && isFinite(b) && (hasIn ? b > a : true));
    list.push({
      label: typeof it?.label === 'string' ? it.label : 'Untitled',
      in: hasIn ? Number(a) : null,
      out: hasOut && hasIn ? Number(b) : null,
      color: (typeof it?.color === 'string') ? it.color : 'none',
     
      draw: (typeof it?.draw === 'string') ? it.draw : null,
    });
  }
  list.sort(segCompare);
  return list;
}

function updateSegIndicator() {
  const total = segments.length;
  const pos = (segIndex >= 0 && segIndex < total) ? (segIndex + 1) : 0;
  if (segInfo) segInfo.textContent = `${pos} / ${total}`;
  const hasSel = (segIndex >= 0 && total > 0);
  if (segPrevBtn) segPrevBtn.disabled = !hasSel || total <= 1;
  if (segNextBtn) segNextBtn.disabled = !hasSel || total <= 1;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

function renderSegList() {
  const listEl = $('segList');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!segments.length) {
    const li = document.createElement('li');
    li.className = 'seg-empty';
    li.innerHTML =
      'No chapters yet.<br>' +
      '＋Add Marks: Save current IN/OUT as chapter.（Not supported on Disney+.)<br>' +
      '＋Add New: Create empty chapter.';

   
   
    listEl.appendChild(li);
    return;
  }
  segments.forEach((seg, i) => {
    const inputId = `chapterLabel-${i}`;
    const inputName = `chapterLabel-${i}`;

    const li = document.createElement('li');
    li.className = 'seg-item' + (i === segIndex ? ' active' : '');
    li.innerHTML = `
      <div class="seg-left">
      <button class="seg-color" data-act="color" data-i="${i}" title="Change label color">
        <span class="seg-color-dot seg-color--${seg.color || 'none'}"></span>
        </button>
        <div class="seg-main">
        <input
          id="${inputId}"
          name="${inputName}"
          class="seg-label"
          data-i="${i}"
          value="${escapeHtml(seg.label || 'Untitled')}"
          placeholder="Untitled"
          aria-label="Chapter label"
          autocomplete="off"
        />
       
          <div class="seg-times">
    <div class="seg-in">In  ${fmtMaybe(seg.in)}</div>
    <div class="seg-out">Out ${fmtMaybe(seg.out)}</div>
 </div>
      </div>
      </div>
      <div class="seg-actions">
        <button class="seg-btn mini micro" data-act="jump" data-i="${i}">
        ${i === segIndex ? '◀ Back' : '▶ Jump'}
        </button>
        <button class="seg-btn mini micro mini--danger delete-btn" data-act="del" data-i="${i}">🗑 Delete</button>
      </div>
    `;
    listEl.appendChild(li);
  });
}
$('segList')?.addEventListener('click', async (e) => {
  const raw = e.target;
  if (!(raw instanceof HTMLElement)) return;

 
  const el = raw.closest('[data-act][data-i]');
  if (!(el instanceof HTMLElement)) return;

  const act = el.dataset.act || '';
  const i = Number(el.dataset.i);
  if (!Number.isFinite(i) || i < 0) return;

 
  if (act === 'color') {
    openPaletteForButton(el, i);
    return;
  }

 
  if (act === 'jump') {
    if (segIndex === i) {
     
      segIndex = -1;
      updateSegIndicator();
      renderSegList();
      await sendToActiveOneWay({ txt: 'loop-disable' });
      const st = await requestMarks();
      if (st) reflectUI(st);
      return;
    }
   
    await applySegment(i);
    renderSegList();
    return;
  }

 
  if (act === 'del') {
    if (!(segments[i])) return;

    const wasSelected = (segIndex === i);
    segments.splice(i, 1);

    if (!segments.length) {
      segIndex = -1;
      renderSegList();
      updateSegIndicator();
      try { await saveSegmentsForActiveTab([], -1); } catch { }
      if (wasSelected) await sendToActiveOneWay({ txt: 'loop-disable' });
      return;
    }

    segIndex = -1;
    updateSegIndicator();
    renderSegList();
    try { await saveSegmentsForActiveTab(segments, segIndex); } catch { }
    if (wasSelected) await sendToActiveOneWay({ txt: 'loop-disable' });
    return;
  }
});

$('segList')?.addEventListener('change', async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;
  const i = Number(t.dataset.i);
  if (!Number.isInteger(i) || !segments[i]) return;
  segments[i].label = t.value.trim() || 'Untitled';
  try { await saveSegmentsForActiveTab(segments, segIndex); } catch { }
});

$('segList')?.addEventListener('keydown', async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;

 
  if (e.isComposing) return;

  if (e.key === 'Enter') {
    e.preventDefault(); 
    t.blur();
  }
});



function buildSegmentFromState(st, existingLabel = null) {
  if (!st) return null;
  const hasIn = Number.isFinite(st.in);
  const hasOut = Number.isFinite(st.out) && hasIn && st.out > st.in;
  const label = (existingLabel != null ? existingLabel : 'Untitled');
  return { label, in: hasIn ? st.in : null, out: hasOut ? st.out : null };
}



async function loadDrawForSegment(i) {
  if (!(i >= 0) || !segments[i]) return;

  const tab = await getActiveTab();
  if (!tab?.id || isBlockedUrl(tab.url)) return;
  const ready = await ensureContentReady(tab);
  if (!ready) return;

  const dataUrl = segments[i].draw || null;
  try {
    await sendRequest(tab.id, { txt: 'draw-import', dataUrl });
  } catch (e) {
    console.warn('loadDrawForSegment failed', e);
  }
}


async function syncLiveMarksIntoCurrentSegment() {
  if (!(segIndex >= 0) || !segments[segIndex]) return;
  const st = await requestMarks();
  if (!st) return;

  const existingLabel = segments[segIndex]?.label ?? 'Untitled';
  const updated = buildSegmentFromState(st, existingLabel);

 
  segments[segIndex] = { ...segments[segIndex], ...updated };
  segments.sort(segCompare);
  segIndex = Math.max(0, segments.findIndex(s =>
    s.in === updated.in &&
    (s.out ?? null) === (updated.out ?? null) &&
    (s.label || '') === (updated.label || '')
  ));
  renderSegList();
  try { await saveSegmentsForActiveTab(segments, segIndex); } catch { }

 
  try {
    await syncLiveDrawIntoCurrentSegment();
  } catch (e) {
    console.warn('[popup] syncLiveDrawIntoCurrentSegment failed', e);
  }
  await syncLiveDrawIntoCurrentSegment();
}


async function syncLiveDrawIntoCurrentSegment() {
  console.log('[TEST] syncLiveDrawIntoCurrentSegment() CALLED', segIndex);

  if (!(segIndex >= 0) || !segments[segIndex]) return;

  const tab = await getActiveTab();
  if (!tab?.id || isBlockedUrl(tab.url)) return;
  const ready = await ensureContentReady(tab);
  if (!ready) return;

  try {
    const res = await sendRequest(tab.id, { txt: 'draw-export' });
    const dataUrl = res?.dataUrl || null;
    segments[segIndex].draw = dataUrl;
    console.log('[popup] saved draw for segment', segIndex, dataUrl ? dataUrl.length : 0);
    await saveSegmentsForActiveTab(segments, segIndex);
  } catch (e) {
    console.warn('[popup] draw-export failed', e);
  }
}


async function loadDrawForSegment(i) {
  if (!(i >= 0) || !segments[i]) return;

  const tab = await getActiveTab();
  if (!tab?.id || isBlockedUrl(tab.url)) return;
  const ready = await ensureContentReady(tab);
  if (!ready) return;

  const dataUrl = segments[i].draw || null;
  console.log('[popup] loadDrawForSegment', i, !!dataUrl);
  try {
    await sendRequest(tab.id, { txt: 'draw-import', dataUrl });
  } catch (e) {
    console.warn('[popup] draw-import failed', e);
  }
}



async function createBlankSegment() {
 
  segments.push({ label: 'Untitled', in: null, out: null, color: 'none', draw: null });
  segIndex = segments.length - 1;
  updateSegIndicator();
  renderSegList();
  try { await saveSegmentsForActiveTab(segments, segIndex); } catch { }

  await sendToActiveOneWay({ txt: 'clear-marks' });
  const st = await requestMarks(); if (st) reflectUI(st);
}



async function applySegment(i) {
 
  await syncLiveMarksIntoCurrentSegment();

  if (!segments.length) return;
  segIndex = Math.max(0, Math.min(segments.length - 1, i));
  const seg = segments[segIndex];

  if (!Number.isFinite(seg.in)) {
    updateSegIndicator();
    renderSegList();
    await sendToActiveOneWay({ txt: 'clear-marks' });
    const st0 = await requestMarks(); if (st0) reflectUI(st0);
    try { await saveSegmentsForActiveTab(segments, segIndex); } catch { }

   
    try { await loadDrawForSegment(segIndex); } catch {}
    return;
  }

  const msg = { txt: 'set-marks', in: seg.in };
  if (Number.isFinite(seg.out)) msg.out = seg.out;
  await sendToActiveOneWay(msg);
  await sendToActiveOneWay({ txt: 'seek-to', time: seg.in });

  const st = await requestMarks(); if (st) reflectUI(st);

 
  try { await loadDrawForSegment(segIndex); } catch (e) {
    console.warn('[popup] loadDrawForSegment in applySegment failed', e);
  }

  updateSegIndicator();
  renderSegList();
  try { await saveSegmentsForActiveTab(segments, segIndex); } catch { }
}



$('back').addEventListener('click', async () => {
  flash($('back'));
  await sendToActiveOneWay({ txt: 'step-frame-backward' });
  const st = await requestMarks(); if (st) reflectUI(st);
});
$('fwd').addEventListener('click', async () => {
  flash($('fwd'));
  await sendToActiveOneWay({ txt: 'step-frame-forward' });
  const st = await requestMarks(); if (st) reflectUI(st);
});
$('play').addEventListener('click', async () => {
  flash($('play'));
  const tab = await getActiveTab();
  if (!tab?.id || isBlockedUrl(tab.url)) return;

 
  const ready = await ensureContentReady(tab);
  if (!ready) {
    console.warn('contents.js not ready, cannot toggle play');
    return;
  }

  try {
    console.log('[KFN][popup] send -> toggle-play'); 
    const res = await sendRequest(tab.id, { txt: 'toggle-play' });
    console.log('[KFN][popup] recv <-', res);         
   
    const st = await requestMarks();
    if (st) reflectUI(st);
  } catch (err) {
    console.warn('toggle-play failed', err);
  }
});

$('back1s')?.addEventListener('click', async () => {
  await sendToActiveOneWay({ txt: 'seek-rel', sec: -cfgSecStep });
  const st = await requestMarks(); if (st) reflectUI(st);
});
$('fwd1s')?.addEventListener('click', async () => {
  await sendToActiveOneWay({ txt: 'seek-rel', sec: +cfgSecStep });
  const st = await requestMarks(); if (st) reflectUI(st);
});

$('markIn').addEventListener('click', async () => {
  await sendToActiveOneWay({ txt: 'set-mark-in' });
  const st = await requestMarks(); if (st) reflectUI(st);
  await syncLiveMarksIntoCurrentSegment();
});
$('markOut').addEventListener('click', async () => {
  await sendToActiveOneWay({ txt: 'set-mark-out' });

  const st = await requestMarks();
  if (st) {
    reflectUI(st);
    if (Number.isFinite(st.in) && Number.isFinite(st.out) && st.out > st.in) {
      await sendToActiveOneWay({ txt: 'set-marks', in: st.in, out: st.out });
    }
  }
  await syncLiveMarksIntoCurrentSegment();
});
$('clear').addEventListener('click', async () => {
  await sendToActiveOneWay({ txt: 'clear-marks' });
  const st = await requestMarks(); if (st) reflectUI(st);
  await syncLiveMarksIntoCurrentSegment();
});


async function addCurrentAsNew() {
  const st = await requestMarks();
  if (!st || !Number.isFinite(st.in)) { alert('In を設定してください'); return; }

 
  const seg = { ...buildSegmentFromState(st, null), color: 'none', draw: null };

 
  try {
    const tab = await getActiveTab();
    if (tab?.id && !isBlockedUrl(tab.url) && await ensureContentReady(tab)) {
      const res = await sendRequest(tab.id, { txt: 'draw-export' });
      seg.draw = res?.dataUrl || null;
      console.log('[popup] addCurrentAsNew: draw len=', seg.draw ? seg.draw.length : 0);
    }
  } catch (e) {
    console.warn('addCurrentAsNew: draw-export failed', e);
  }

  segments.push(seg);
  segments.sort(segCompare);

  segIndex = -1;
  updateSegIndicator();
  renderSegList();
  try { await saveSegmentsForActiveTab(segments, segIndex); } catch { }

  await sendToActiveOneWay({ txt: 'clear-marks' });
  const st2 = await requestMarks(); if (st2) reflectUI(st2);
}

async function deleteList() {
  if (!segments.length) return;
  if (!confirm('チャプターリストをすべて削除しますか？')) return;
  segments = []; segIndex = -1; updateSegIndicator(); renderSegList();
  try { await saveSegmentsForActiveTab([], -1); } catch { }
}


$('segPrev').addEventListener('click', async () => {
  if (!segments.length) return;
  if (!(segIndex >= 0)) { await applySegment(0); return; }
  await applySegment((segIndex - 1 + segments.length) % segments.length);
  renderSegList();
});
$('segNext').addEventListener('click', async () => {
  if (!segments.length) return;
  if (!(segIndex >= 0)) { await applySegment(0); return; }
  await applySegment((segIndex + 1) % segments.length);
  renderSegList();
});


$('loadJson').addEventListener('click', () => $('jsonFile').click());
$('jsonFile').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const text = await f.text();
    segments = normalizeSegments(JSON.parse(text));
    segIndex = -1;
    updateSegIndicator();
    renderSegList();
    try { await saveSegmentsForActiveTab(segments, segIndex); } catch { }
  } catch {
    alert('JSONの形式が不正です。[{ "label":文字列, "in":秒|null, "out":秒|null }, ...]');
  } finally { e.target.value = ''; }
});
function buildTsName(prefix) {
  const iso = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').replace('Z', '');
  return `${prefix}-${iso}.json`;
}
$('saveJson').addEventListener('click', async () => {
 
  await syncLiveMarksIntoCurrentSegment();

  if (!segments.length) return;

 
  const payload = segments.map(seg => ({
    label: seg.label || 'Untitled',
    in: Number.isFinite(seg.in) ? seg.in : null,
    out: Number.isFinite(seg.out) ? seg.out : null,
    color: seg.color || 'none',
    draw: seg.draw || null
  }));

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildTsName('keyPoseLab_chapterList');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
});

$('deleteList').addEventListener('click', deleteList);



chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.txt === 'segments-updated') {
    try {
      const scoped = await loadSegmentsForActiveTab();
      segments = normalizeSegments(scoped?.segments || []);
      segIndex = -1;
      updateSegIndicator();
      renderSegList();
    } catch (e) {
      console.warn('segments-updated handling failed', e);
    }
  }
});


$('addSeg').addEventListener('click', addCurrentAsNew);
$('newSeg').addEventListener('click', createBlankSegment);


$('exportMarks').addEventListener('click', async () => {
  const btn = $('exportMarks');
  const st = await requestMarks();
  if (!st || !Number.isFinite(st.in)) { alert('In が未設定です。'); return; }
  const hasOut = Number.isFinite(st.out) && st.out > st.in;
  const obj = { in: st.in, out: hasOut ? st.out : null };
  try {
    await navigator.clipboard.writeText(JSON.stringify(obj));
    btn.classList.add('ok'); btn.textContent = '✅ Copied'; await sleep(900);
  } catch {
    btn.classList.add('err'); btn.textContent = '❌ Failed'; await sleep(1100);
  } finally {
    btn.classList.remove('ok', 'err'); btn.textContent = '📋 Copy';
  }
});
$('importMarks').addEventListener('click', async () => {
  const btn = $('importMarks');
  try {
    const txt = await navigator.clipboard.readText();
    const obj = JSON.parse(txt);
    const a = parseTimeToSeconds(obj?.in), b = parseTimeToSeconds(obj?.out);
    if (a == null || !isFinite(a)) throw 0;

    const msg = { txt: 'set-marks', in: Number(a) };
    if (b != null && isFinite(b) && b > a) msg.out = Number(b);

    await sendToActiveOneWay(msg);
    await sendToActiveOneWay({ txt: 'seek-to', time: Number(a) });

    const st = await requestMarks(); if (st) reflectUI(st);

    btn.classList.add('ok'); btn.textContent = '✅ Pasted'; await sleep(900);
  } catch {
    btn.classList.add('err'); btn.textContent = '❌ Failed'; await sleep(1100);
  } finally {
    btn.classList.remove('ok', 'err'); btn.textContent = '📥 Paste';
  }
});


function reflectFpsUI(currentFps) {
  const buttons = document.querySelectorAll('#fpsSegmented .fps-btn');
  let matched = false;
  buttons.forEach(btn => {
    const val = Number(btn.getAttribute('data-fps'));
    const active = Math.abs(Number(currentFps) - val) < 0.01;
    btn.setAttribute('aria-pressed', String(active));
    btn.classList.toggle('is-active', active);
    if (active) matched = true;
  });
  const customRadio = $('fpsCustomRadio');
  if (customRadio) customRadio.checked = !matched;
  const lbl = $('fpsLabel');
  if (lbl) lbl.textContent = `FPS: ${Number(currentFps)}`;
}
function setFps(val) {
  const n = Number(val); if (!Number.isFinite(n) || n <= 0) return;
  const fps = Math.max(1, Math.min(240, n));
  ST.set({ oneframe_fps: fps });
  try { sendToActiveOneWay({ txt: 'set-fps', fps }); } catch { }
  reflectFpsUI(fps);
}
async function initFpsUI() {
  const { oneframe_fps, oneframe_fps_custom } =
    await ST.get(['oneframe_fps', 'oneframe_fps_custom']);
  const fpsVal = oneframe_fps || 30;
  const customVal = oneframe_fps_custom || '';
  $('fpsLabel').textContent = `FPS: ${fpsVal}`;
  $('fpsCustom').value = customVal;
  const presetBtns = Array.from(document.querySelectorAll('.fps-btn'));
  const customRadio = $('fpsCustomRadio');
  const customInput = $('fpsCustom');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-fps');
      setFps(v);
      presetBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (customRadio) customRadio.checked = false;
    });
  });
  customInput.addEventListener('input', () => {
    ST.set({ oneframe_fps_custom: customInput.value || '' });
  });
  customRadio.addEventListener('change', () => {
    presetBtns.forEach(b => b.classList.remove('is-active'));
    const v = customInput.value;
    if (v) { setFps(v); ST.set({ oneframe_fps_custom: v }); }
    else { reflectFpsUI(fpsVal); }
  });
  reflectFpsUI(fpsVal);
}


document.addEventListener('DOMContentLoaded', async () => {
  await initTheme();
  ensureContentInjected();

  try {
    const o = await ST.get(['oneframe_fps', 'oneframe_fps_open', 'oneframe_chapter_open', 'kfn_config_open']);
    if (o?.oneframe_fps != null) { $('fpsLabel').textContent = `FPS: ${o.oneframe_fps}`; }
    if (fpsPanel) togglePanel(fpsPanel, !!o?.oneframe_fps_open);
    if (chapterPanel) togglePanel(chapterPanel, !!o?.oneframe_chapter_open);
    const configPanel = $('configPanel');
    if (configPanel) togglePanel(configPanel, !!o?.kfn_config_open);

    const scoped = await loadSegmentsForActiveTab();
    segments = normalizeSegments(scoped?.segments || []);
    segIndex = -1;
    updateSegIndicator();
    renderSegList();

   
    const scope = await getScopeKey();
    const state = await getHudState(scope);
    if (state.open) {
      const tab = await getActiveTab();
      if (tab?.id && await ensureContentReady(tab)) {
        await sendRequest(tab.id, { txt: 'hud-toggle', show: true, scopeKey: scope, pos: state.pos });
      }
    }
  } catch { }

  await initFpsUI();
  await initStepConfig();

  const st = await requestMarks(); if (st) reflectUI(st);
});
