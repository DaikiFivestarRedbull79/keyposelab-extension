
const ST = chrome.storage.session;
async function sendToActiveTab(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['contents.js'] });
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (e2) {
      console.warn('[bg] failed to deliver command:', message, e2);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
 
});


const hudOpenTabs = new Set();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.txt === 'hud-open-state' && sender?.tab?.id != null) {
    if (msg.open) hudOpenTabs.add(sender.tab.id);
    else hudOpenTabs.delete(sender.tab.id);
    sendResponse?.({ ok:true });
    return true;
  }
});
async function isUIOpenFor(tabId){
  let popupOpen = false;
  try {
    const st = await chrome.storage.session.get('kfn_popup_open');
    popupOpen = !!st?.kfn_popup_open;
  } catch {}
  const hudOpen = hudOpenTabs.has(tabId);
  return popupOpen || hudOpen;
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender?.tab?.id;

 
  if (msg?.txt === 'hud-open-state' && tabId != null) {
    if (msg.open) hudOpenTabs.add(tabId);
    else hudOpenTabs.delete(tabId);
    sendResponse?.({ ok: true });
    return true;
  }

 
  if (msg?.txt === 'add-current-as-new') {
    if (!tabId) {
      sendResponse?.({ ok: false, reason: 'no-tab' });
      return true;
    }

    (async () => {
      const key = `oneframe_segments::tab-${tabId}`;

     
      let st = msg?.payload;
      if (!st || !Number.isFinite(st.in)) {
        st = await new Promise(res => {
          chrome.tabs.sendMessage(
            tabId,
            { txt: 'get-marks' },
            r => { void chrome.runtime.lastError; res(r || null); }
          );
        });
      }
      if (!st || !Number.isFinite(st.in)) {
        sendResponse?.({ ok: false, reason: 'no-in' });
        return;
      }

      const hasOut = Number.isFinite(st.out) && st.out > st.in;

     
      let drawDataUrl = null;
      try {
        drawDataUrl = await new Promise(resolve => {
          chrome.tabs.sendMessage(
            tabId,
            { txt: 'draw-export' },
            r => {
              void chrome.runtime.lastError;
              if (r && r.ok && typeof r.dataUrl === 'string') resolve(r.dataUrl);
              else resolve(null);
            }
          );
        });
      } catch (e) {
        console.warn('[bg] draw-export failed', e);
      }

     
      const seg = {
        label: 'Untitled',
        in: st.in,
        out: hasOut ? st.out : null,
        draw: drawDataUrl
      };

     
      const bag = await ST.get([key]);
      const current =
        (bag?.[key]?.segments && Array.isArray(bag[key].segments))
          ? bag[key].segments.slice()
          : [];

      current.push(seg);
      current.sort((a, b) =>
        (Number.isFinite(a.in) ? a.in : Infinity) -
        (Number.isFinite(b.in) ? b.in : Infinity)
      );

      await ST.set({ [key]: { segments: current, index: -1 } });

     
      try {
        chrome.runtime.sendMessage({ txt: 'segments-updated' }, () => {
          void chrome.runtime.lastError;
        });
      } catch {}

     
      try {
        chrome.tabs.sendMessage(tabId, { txt: 'clear-marks' }, () => {
          void chrome.runtime.lastError;
        });
      } catch {}

      sendResponse?.({ ok: true });
    })();

    return true;
  }

 

});


chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const key = `oneframe_segments::tab-${tabId}`;
    await ST.remove(key);
  } catch {}
 
  hudOpenTabs.delete(tabId);
});

if (!chrome.commands || !chrome.commands.onCommand) {
 
 
} else {
chrome.commands.onCommand.addListener(async (command) => {
  
  const SHORTCUTS_ENABLED = true;
  if (!SHORTCUTS_ENABLED) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

 
  if (!(await isUIOpenFor(tab.id))) return;

 
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !!window.__KFN_CONTENT_READY__
    });
    if (!result) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['contents.js']
      });
    }
  } catch (e) {
    console.warn('Inject failed:', e);
  }

 
  let popupOpen = false;
  try {
    const st = await chrome.storage.session.get('kfn_popup_open');
    popupOpen = !!st?.kfn_popup_open;
  } catch {}


  switch (command) {
    case 'step_forward_frame':
    chrome.tabs
      .sendMessage(tab.id, { txt: 'step-frame-forward' })
      .catch(err => {
        console.warn('[bg] step-frame-forward failed:', err);
      });
    break;


    case 'step_back_frame':
    chrome.tabs
      .sendMessage(tab.id, { txt: 'step-frame-backward' })
      .catch(err => {
        console.warn('[bg] step-frame-backward failed:', err);
      });
    break;
  }
});
}


