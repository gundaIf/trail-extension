// Trail — activity tracker service worker (Manifest V3)
// Records active-tab time (only the focused window's active tab, only while the
// user is not idle) into per-minute buckets stored in chrome.storage.local.
// Nothing ever leaves the device.

const IDLE_SECONDS = 60;                        // consider idle after 60s of no input
const MIN_MS = 60 * 1000;                       // one bucket = one minute
const PRUNE_MS = 3 * 24 * 60 * 60 * 1000;       // keep ~3 days of history
const MAX_CHUNK_MS = 5 * 60 * 1000;             // never credit more than 5 min in one flush
                                                // (guards against sleep / killed worker overcount)

chrome.idle.setDetectionInterval(IDLE_SECONDS);

// ---- helpers ---------------------------------------------------------------

function hostFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function getState() {
  const d = await chrome.storage.local.get(['buckets', 'meta', 'active']);
  return {
    buckets: d.buckets || {},
    meta: d.meta || {},
    active: d.active || null,
  };
}

// Spread the interval [start, end] of `host` across the per-minute buckets.
function addToBuckets(buckets, host, start, end) {
  let t = start;
  while (t < end) {
    const minute = Math.floor(t / MIN_MS);
    const minuteEnd = (minute + 1) * MIN_MS;
    const chunkEnd = Math.min(end, minuteEnd);
    const secs = (chunkEnd - t) / 1000;
    const key = String(minute);
    if (!buckets[key]) buckets[key] = {};
    buckets[key][host] = (buckets[key][host] || 0) + secs;
    t = chunkEnd;
  }
}

function prune(buckets) {
  const cutoff = Math.floor((Date.now() - PRUNE_MS) / MIN_MS);
  for (const k of Object.keys(buckets)) {
    if (Number(k) < cutoff) delete buckets[k];
  }
}

// Serialize all storage read-modify-write cycles so events can't clobber each other.
let queue = Promise.resolve();
function serialize(fn) {
  queue = queue.then(fn, fn);
  return queue;
}

// Record elapsed time for the current active session, then set a new one.
// Pass `newActive` = { host, title, favicon, tabId } to start counting a tab,
// or null to stop counting (idle / window unfocused / non-http page).
async function flush(newActive) {
  await serialize(async () => {
    const state = await getState();
    const now = Date.now();

    if (state.active && state.active.host && state.active.startTs) {
      let start = state.active.startTs;
      if (now - start > MAX_CHUNK_MS) start = now - MAX_CHUNK_MS; // clamp overcount
      if (now > start) addToBuckets(state.buckets, state.active.host, start, now);
      const prev = state.meta[state.active.host] || {};
      state.meta[state.active.host] = {
        title: state.active.title || prev.title || state.active.host,
        favicon: state.active.favicon || prev.favicon || '',
      };
    }

    prune(state.buckets);

    let active = null;
    if (newActive && newActive.host) {
      active = { ...newActive, startTs: now };
      const prev = state.meta[newActive.host] || {};
      state.meta[newActive.host] = {
        title: newActive.title || prev.title || newActive.host,
        favicon: newActive.favicon || prev.favicon || '',
      };
    }

    await chrome.storage.local.set({
      buckets: state.buckets,
      meta: state.meta,
      active,
    });
  });
}

// Look at whatever tab is currently focused+active and (re)start counting it.
async function refresh() {
  let tab = null;
  try {
    const win = await chrome.windows.getLastFocused({ populate: false });
    if (win && win.focused) {
      const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
      tab = tabs[0] || null;
    }
  } catch {
    /* no focused window */
  }

  if (!tab) return flush(null);
  const host = hostFromUrl(tab.url);
  if (!host) return flush(null);

  return flush({
    host,
    title: tab.title || host,
    favicon: tab.favIconUrl || '',
    tabId: tab.id,
  });
}

// ---- event wiring ----------------------------------------------------------

chrome.tabs.onActivated.addListener(() => refresh());

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!tab.active) return;
  if (info.url || info.status === 'complete' || info.favIconUrl || info.title) refresh();
});

chrome.windows.onFocusChanged.addListener((winId) => {
  if (winId === chrome.windows.WINDOW_ID_NONE) flush(null);
  else refresh();
});

chrome.idle.onStateChanged.addListener((s) => {
  if (s === 'active') refresh();
  else flush(null); // idle or locked -> stop counting
});

chrome.runtime.onStartup.addListener(() => refresh());
chrome.runtime.onInstalled.addListener(() => refresh());

// Heartbeat so long-focused tabs keep accumulating even if the worker sleeps.
chrome.alarms.create('tick', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'tick') refresh();
});

// Let the dashboard/popup force an up-to-the-second flush before reading.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg === 'flush') {
    refresh().then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  if (msg === 'reset') {
    serialize(async () => {
      await chrome.storage.local.set({ buckets: {}, meta: {}, active: null });
    }).then(() => sendResponse({ ok: true }));
    return true;
  }
});
