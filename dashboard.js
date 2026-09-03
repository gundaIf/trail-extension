// Trail — dashboard rendering
'use strict';

const MIN_MS = 60 * 1000;
const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

let currentRange = 'hour';

// ---- category classification ----------------------------------------------

const CAT = {
  comm:     { name: 'Communication', color: getVar('--c-comm') },
  ai:       { name: 'AI / Tools',    color: getVar('--c-ai') },
  research: { name: 'Research',      color: getVar('--c-research') },
  prod:     { name: 'Productivity',  color: getVar('--c-prod') },
  social:   { name: 'Social',        color: getVar('--c-social') },
  ent:      { name: 'Entertainment', color: getVar('--c-ent') },
  news:     { name: 'News',          color: getVar('--c-news') },
  shop:     { name: 'Shopping',      color: getVar('--c-shop') },
  other:    { name: 'Other',         color: getVar('--c-other') },
};

const RULES = [
  ['comm',     ['mail.google', 'gmail', 'outlook', 'whatsapp', 'messenger', 'slack', 'telegram', 'discord', 'zoom', 'meet.google', 'teams.microsoft']],
  ['ai',       ['chatgpt', 'openai', 'claude.ai', 'gemini.google', 'bard', 'perplexity', 'copilot', 'huggingface', 'midjourney', 'poe.com']],
  ['research', ['wikipedia', 'scholar.google', 'arxiv', 'stackoverflow', 'stackexchange', 'github', 'developer.mozilla', 'medium', 'substack', 'quora', 'notion.site']],
  ['prod',     ['notion.so', 'docs.google', 'drive.google', 'sheets.google', 'slides.google', 'calendar.google', 'figma', 'linear', 'asana', 'trello', 'jira', 'atlassian', 'canva']],
  ['social',   ['twitter', 'x.com', 'facebook', 'instagram', 'linkedin', 'reddit', 'tiktok', 'threads', 'mastodon', 'bsky']],
  ['ent',      ['youtube', 'netflix', 'twitch', 'spotify', 'soundcloud', 'hulu', 'primevideo', 'disneyplus']],
  ['news',     ['nytimes', 'bbc', 'cnn', 'theguardian', 'reuters', 'bloomberg', 'wsj', 'news.ycombinator', 'techcrunch', 'theverge']],
  ['shop',     ['amazon', 'ebay', 'etsy', 'aliexpress', 'flipkart', 'walmart', 'shopify']],
];

function categoryOf(host) {
  const h = host.toLowerCase();
  for (const [cat, keys] of RULES) {
    if (keys.some((k) => h.includes(k))) return CAT[cat];
  }
  return CAT.other;
}

function getVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

// ---- formatting ------------------------------------------------------------

function fmtDur(secs) {
  secs = Math.round(secs);
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function fmtClock(ms) {
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function colorForHost(host) {
  const palette = ['#c4633f', '#6e8ca8', '#d2a24c', '#7e8b5a', '#a16a86', '#d07a4a', '#4e8a82', '#c56b7b'];
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

// ---- data ------------------------------------------------------------------

async function loadRaw() {
  if (hasStorage) {
    await new Promise((res) => {
      try { chrome.runtime.sendMessage('flush', () => res()); } catch { res(); }
    });
    const d = await chrome.storage.local.get(['buckets', 'meta']);
    return { buckets: d.buckets || {}, meta: d.meta || {} };
  }
  return demoData();
}

function rangeBounds(range) {
  const now = Date.now();
  if (range === 'hour') return { from: now - 3600 * 1000, to: now, label: 'last hour', prevLabel: 'vs last hour' };
  if (range === '3h') return { from: now - 3 * 3600 * 1000, to: now, label: 'last 3 hours', prevLabel: 'vs prev 3h' };
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  return { from: midnight.getTime(), to: now, label: 'today', prevLabel: 'vs yesterday' };
}

// Sum per-host seconds within [from,to]; also return per-minute totals.
function aggregate(buckets, from, to) {
  const fromMin = Math.floor(from / MIN_MS);
  const toMin = Math.floor((to - 1) / MIN_MS);
  const hosts = {};
  const perMinute = {};
  for (const key of Object.keys(buckets)) {
    const min = Number(key);
    if (min < fromMin || min > toMin) continue;
    const rec = buckets[key];
    let minuteTotal = 0;
    for (const host of Object.keys(rec)) {
      const s = rec[host];
      hosts[host] = (hosts[host] || 0) + s;
      minuteTotal += s;
    }
    perMinute[min] = (perMinute[min] || 0) + minuteTotal;
  }
  return { hosts, perMinute, fromMin, toMin };
}

// Build ~targetBins evenly-spaced bins across the window for the chart.
function buildSeries(perMinute, from, to, targetBins = 30) {
  const spanMs = Math.max(to - from, MIN_MS);
  const binMs = Math.max(MIN_MS, Math.ceil(spanMs / targetBins / MIN_MS) * MIN_MS);
  const nBins = Math.ceil(spanMs / binMs);
  const bins = new Array(nBins).fill(0);
  for (const [minStr, secs] of Object.entries(perMinute)) {
    const t = Number(minStr) * MIN_MS;
    const idx = Math.floor((t - from) / binMs);
    if (idx >= 0 && idx < nBins) bins[idx] += secs;
  }
  return { bins, binMs, start: from };
}

// ---- render ----------------------------------------------------------------

async function render() {
  const { buckets, meta } = await loadRaw();
  const { from, to, label, prevLabel } = rangeBounds(currentRange);

  const cur = aggregate(buckets, from, to);
  const prevSpan = to - from;
  const prev = aggregate(buckets, from - prevSpan, from);

  const entries = Object.entries(cur.hosts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const places = entries.length;
  const avg = places ? total / places : 0;

  const prevEntries = Object.values(prev.hosts);
  const prevTotal = prevEntries.reduce((s, v) => s + v, 0);
  const prevPlaces = prevEntries.length;
  const prevAvg = prevPlaces ? prevTotal / prevPlaces : 0;

  // ---- headline & topline
  const headline = document.getElementById('headline');
  if (total < 1) {
    headline.innerHTML = 'Nothing observed yet.';
    document.getElementById('topline').innerHTML = '';
    document.getElementById('rangeline').innerHTML = 'Browse a few sites, then come back — Trail only counts the tab you are actively looking at.';
    document.getElementById('placesList').innerHTML = '<div class="empty">No activity in this range.</div>';
    document.getElementById('moreBtn').hidden = true;
    setStats(0, 0, 0, prevTotal, prevPlaces, prevAvg, prevLabel);
    drawChart([], from, to, MIN_MS);
    drawDonut([]);
    document.getElementById('donutTotal').textContent = '0m';
    document.getElementById('catLegend').innerHTML = '';
    document.getElementById('chartTitle').textContent = `Time over the ${label}`;
    return;
  }

  const mins = Math.round(total / 60);
  headline.innerHTML = `${mins} min observed,<br>spread across ${places} place${places === 1 ? '' : 's'}.`;

  const topline = document.getElementById('topline');
  const [h1, s1] = entries[0];
  let tl = `Most time went to ${favHtml(h1, meta)} <strong>${fmtDur(s1)}</strong>`;
  if (entries[1]) {
    const [h2, s2] = entries[1];
    tl += ` <span class="then">then</span> ${favHtml(h2, meta)} <strong>${fmtDur(s2)}</strong>`;
  }
  topline.innerHTML = tl;

  document.getElementById('rangeline').innerHTML =
    `Chrome activity observed from <b>${fmtClock(from)}</b> to <b>${fmtClock(to)}</b> · ${fmtDur(total)} total`;

  // ---- places list
  const list = document.getElementById('placesList');
  list.innerHTML = '';
  const TOP = 10;
  const top = entries.slice(0, TOP);
  const rest = entries.slice(TOP);
  const maxSecs = entries[0][1];

  for (const [host, secs] of top) {
    list.appendChild(placeRow(host, secs, total, maxSecs, meta));
  }

  const moreBtn = document.getElementById('moreBtn');
  if (rest.length) {
    const restSecs = rest.reduce((s, [, v]) => s + v, 0);
    moreBtn.hidden = false;
    document.getElementById('moreLabel').textContent = `${rest.length} more place${rest.length === 1 ? '' : 's'}`;
    document.getElementById('moreTime').textContent = fmtDur(restSecs);
    document.getElementById('morePct').textContent = `${((restSecs / total) * 100).toFixed(1)}%`;
    moreBtn.onclick = () => {
      moreBtn.hidden = true;
      for (const [host, secs] of rest) list.appendChild(placeRow(host, secs, total, maxSecs, meta));
    };
  } else {
    moreBtn.hidden = true;
  }

  // ---- stats + deltas
  setStats(total, places, avg, prevTotal, prevPlaces, prevAvg, prevLabel);

  // ---- chart
  document.getElementById('chartTitle').textContent = `Time over the ${label}`;
  const { bins, binMs, start } = buildSeries(cur.perMinute, from, to);
  drawChart(bins, start, to, binMs);

  // ---- donut / categories
  const catTotals = {};
  for (const [host, secs] of entries) {
    const c = categoryOf(host);
    catTotals[c.name] = catTotals[c.name] || { secs: 0, color: c.color };
    catTotals[c.name].secs += secs;
  }
  const cats = Object.entries(catTotals)
    .map(([name, o]) => ({ name, secs: o.secs, color: o.color }))
    .sort((a, b) => b.secs - a.secs);

  drawDonut(cats);
  document.getElementById('donutTotal').textContent = fmtDur(total).replace(/\s\d+s$/, '');
  const legend = document.getElementById('catLegend');
  legend.innerHTML = '';
  for (const c of cats.slice(0, 6)) {
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML =
      `<span class="swatch" style="background:${c.color}"></span>` +
      `<span class="cat-name">${escapeHtml(c.name)}</span>` +
      `<span class="cat-val">${fmtDur(c.secs)} <span>(${((c.secs / total) * 100).toFixed(1)}%)</span></span>`;
    legend.appendChild(row);
  }
}

function setStats(total, places, avg, prevTotal, prevPlaces, prevAvg, prevLabel) {
  document.getElementById('statTotal').textContent = total ? fmtDur(total) : '0m 00s';
  document.getElementById('statPlaces').textContent = places;
  document.getElementById('statAvg').textContent = places ? fmtDur(avg) : '0m 00s';

  setDelta('deltaTotal', pctDelta(total, prevTotal), prevLabel, 'pct');
  setDelta('deltaPlaces', places - prevPlaces, prevLabel, 'int');
  setDelta('deltaAvg', avg - prevAvg, prevLabel, 'dur');
}

function pctDelta(cur, prev) {
  if (!prev) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function setDelta(id, value, label, kind) {
  const el = document.getElementById(id);
  const up = value > 0.5, down = value < -0.5;
  const arrow = up ? '↑' : down ? '↓' : '→';
  let text;
  if (kind === 'pct') text = `${Math.abs(Math.round(value))}%`;
  else if (kind === 'int') text = `${Math.abs(value)}`;
  else text = fmtDur(Math.abs(value));
  el.className = 'delta' + (up ? ' up' : down ? ' down' : '');
  el.textContent = `${arrow} ${text} ${label}`;
}

function favHtml(host, meta) {
  const fav = meta[host] && meta[host].favicon;
  if (fav) return `<img class="fav" src="${escapeAttr(fav)}" onerror="this.remove()" alt="">`;
  return `<span class="fav-fallback" style="background:${colorForHost(host)}">${host[0].toUpperCase()}</span>`;
}

// Second-level suffixes where the label before them isn't the site name,
// e.g. example.co.uk / example.com.br -> "example".
const SLD_SUFFIXES = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'gob', 'mil', 'or', 'ne', 'go']);

// Derive a clean site name from any hostname, for any TLD.
// deeeen.xyz -> "Deeeen", web.whatsapp.com -> "Whatsapp", foo.co.uk -> "Foo".
function niceName(host) {
  const labels = String(host).replace(/^www\./, '').replace(/^m\./, '').split('.');
  if (labels.length <= 1) return cap(labels[0] || host);
  // pick the label just before the public suffix (last label, or last two)
  let idx = labels.length - 2;
  if (labels.length >= 3 && SLD_SUFFIXES.has(labels[labels.length - 2])) idx = labels.length - 3;
  return cap(labels[idx] || labels[0] || host);
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function placeRow(host, secs, total, maxSecs, meta) {
  const row = document.createElement('div');
  row.className = 'place';
  const pct = ((secs / total) * 100).toFixed(1);
  const barPct = Math.max(3, (secs / maxSecs) * 100);
  const color = categoryOf(host).color;

  const nameWrap = document.createElement('div');
  nameWrap.className = 'place-name place-body';
  nameWrap.innerHTML = favHtml(host, meta) +
    `<span class="label" title="${escapeAttr(host)}">${escapeHtml(niceName(host))}</span>`;

  const bar = document.createElement('div');
  bar.className = 'bar-wrap';
  bar.innerHTML = `<div class="bar" style="width:${barPct}%;background:${color}"></div>`;
  nameWrap.appendChild(bar);

  const time = document.createElement('div');
  time.className = 'time-cell col-time';
  time.textContent = fmtDur(secs);

  const p = document.createElement('div');
  p.className = 'pct-cell col-pct';
  p.textContent = `${pct}%`;

  row.append(nameWrap, time, p);
  return row;
}

// ---- canvas: line chart ----------------------------------------------------

function drawChart(bins, start, end, binMs) {
  const cv = document.getElementById('chart');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 44, padR = 14, padT = 16, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const maxV = Math.max(60, ...bins);
  const niceMax = Math.ceil(maxV / 60) * 60;
  const avg = bins.length ? bins.reduce((a, b) => a + b, 0) / bins.length : 0;

  const x = (i) => padL + (bins.length <= 1 ? plotW / 2 : (i / (bins.length - 1)) * plotW);
  const y = (v) => padT + plotH - (v / niceMax) * plotH;

  // y grid + labels (0, mid, max)
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = getVar('--muted-2');
  ctx.strokeStyle = getVar('--grid');
  ctx.lineWidth = 1;
  ctx.textAlign = 'left';
  for (const frac of [0, 0.5, 1]) {
    const v = niceMax * frac;
    const yy = y(v);
    ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
    ctx.fillText(`${Math.round(v / 60)}m`, 6, yy + 4);
  }

  if (!bins.length) return;

  // area fill
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, getVar('--area-top'));
  grad.addColorStop(1, getVar('--area-bottom'));
  ctx.beginPath();
  ctx.moveTo(x(0), y(bins[0]));
  for (let i = 1; i < bins.length; i++) ctx.lineTo(x(i), y(bins[i]));
  ctx.lineTo(x(bins.length - 1), padT + plotH);
  ctx.lineTo(x(0), padT + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // avg dashed line
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = getVar('--muted-2');
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, y(avg)); ctx.lineTo(W - padR, y(avg)); ctx.stroke();
  ctx.setLineDash([]);

  // main line
  ctx.strokeStyle = getVar('--accent');
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x(0), y(bins[0]));
  for (let i = 1; i < bins.length; i++) ctx.lineTo(x(i), y(bins[i]));
  ctx.stroke();

  // points
  ctx.fillStyle = getVar('--accent');
  for (let i = 0; i < bins.length; i++) {
    ctx.beginPath(); ctx.arc(x(i), y(bins[i]), 2.4, 0, Math.PI * 2); ctx.fill();
  }

  // x labels: start / mid / end
  ctx.fillStyle = getVar('--muted-2');
  ctx.textAlign = 'center';
  ctx.fillText(fmtClock(start), padL, H - 10);
  ctx.fillText(fmtClock((start + end) / 2), padL + plotW / 2, H - 10);
  ctx.textAlign = 'right';
  ctx.fillText(fmtClock(end), W - padR, H - 10);
}

// ---- canvas: donut ---------------------------------------------------------

function drawDonut(cats) {
  const cv = document.getElementById('donut');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const rOuter = W * 0.42, rInner = W * 0.29;

  const total = cats.reduce((s, c) => s + c.secs, 0);
  if (!total) {
    ctx.beginPath();
    ctx.arc(cx, cy, (rOuter + rInner) / 2, 0, Math.PI * 2);
    ctx.lineWidth = rOuter - rInner;
    ctx.strokeStyle = getVar('--track');
    ctx.stroke();
    return;
  }

  let a0 = -Math.PI / 2;
  const gap = 0.03;
  for (const c of cats) {
    const frac = c.secs / total;
    const a1 = a0 + frac * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, (rOuter + rInner) / 2, a0 + gap / 2, a1 - gap / 2);
    ctx.lineWidth = rOuter - rInner;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = c.color;
    ctx.stroke();
    a0 = a1;
  }
}

// ---- utils -----------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// ---- demo data (used when opened outside the extension, e.g. preview) ------

function demoData() {
  const now = Date.now();
  const sites = [
    ['mail.google.com', 'Gmail', 25 * 60 + 41],
    ['chatgpt.com', 'ChatGPT', 9 * 60 + 32],
    ['deeeen.xyz', 'Deeeen', 6 * 60 + 18],
    ['wikipedia.org', 'Wikipedia', 4 * 60 + 47],
    ['web.whatsapp.com', 'WhatsApp Web', 3 * 60 + 26],
    ['linkedin.com', 'LinkedIn', 2 * 60 + 58],
    ['x.com', 'X', 1 * 60 + 52],
    ['youtube.com', 'YouTube', 1 * 60 + 31],
    ['notion.so', 'Notion', 1 * 60 + 7],
    ['docs.google.com', 'Google Docs', 56],
    ['github.com', 'GitHub', 40],
    ['reddit.com', 'Reddit', 30],
  ];
  const buckets = {};
  const meta = {};
  const startMin = Math.floor((now - 59 * MIN_MS) / MIN_MS);
  for (const [host, title, secs] of sites) {
    meta[host] = { title, favicon: '' };
    let remaining = secs;
    // scatter each site's seconds across random minutes in the last hour
    while (remaining > 0) {
      const min = startMin + Math.floor(Math.random() * 60);
      const chunk = Math.min(remaining, 5 + Math.random() * 25);
      const key = String(min);
      buckets[key] = buckets[key] || {};
      buckets[key][host] = (buckets[key][host] || 0) + chunk;
      remaining -= chunk;
    }
  }
  return { buckets, meta };
}

// ---- wiring ----------------------------------------------------------------

document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.pill');
  if (!btn) return;
  document.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p === btn));
  currentRange = btn.dataset.range;
  render();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Erase all recorded activity? This cannot be undone.')) return;
  if (hasStorage) chrome.runtime.sendMessage('reset', () => render());
  else render();
});

document.getElementById('privacyBtn').addEventListener('click', () => {
  alert('Trail stores everything in this browser only (chrome.storage.local).\nNo data is ever sent anywhere. Use "Reset all data" to wipe it.');
});

// ---- theme ----------------------------------------------------------------

function getTheme() {
  try { return localStorage.getItem('trail-theme') || 'default'; } catch { return 'default'; }
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('trail-theme', theme); } catch {}
  document.querySelectorAll('#themeSwitch button').forEach((b) =>
    b.classList.toggle('active', b.dataset.theme === theme));
  render(); // recolor canvases for the new palette
}
document.getElementById('themeSwitch').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) applyTheme(btn.dataset.theme);
});
// Re-render when the OS theme flips while on "System".
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') render();
  });
}
// reflect current theme in the switch (already applied pre-paint in <head>)
document.querySelectorAll('#themeSwitch button').forEach((b) =>
  b.classList.toggle('active', b.dataset.theme === getTheme()));

render();
// live-refresh every 15s while the dashboard is open
setInterval(() => render(), 15000);
