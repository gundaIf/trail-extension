// Trail: observatory dashboard
// Reads chrome.storage.local buckets written by background.js.
// Opened as a plain HTML file, shows a scripted sample morning.
'use strict';

const MIN_MS = 60 * 1000;
const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

let currentRange = 'today';
let focusHost = null;
let hoverHost = null;
let lastAgg = null;
let restPlaces = [];

const CATEGORIES = {
  comm:     { id: 'comm',     name: 'Communication', colorVar: '--c-comm' },
  ai:       { id: 'ai',       name: 'AI / Tools',    colorVar: '--c-ai' },
  research: { id: 'research', name: 'Research',      colorVar: '--c-research' },
  prod:     { id: 'prod',     name: 'Making',        colorVar: '--c-prod' },
  social:   { id: 'social',   name: 'Social',        colorVar: '--c-social' },
  ent:      { id: 'ent',      name: 'Wandering',     colorVar: '--c-ent' },
  news:     { id: 'news',     name: 'News',          colorVar: '--c-news' },
  shop:     { id: 'shop',     name: 'Shopping',      colorVar: '--c-shop' },
  other:    { id: 'other',    name: 'Other',         colorVar: '--c-other' },
};

const RULES = [
  ['comm',     ['mail.google', 'gmail', 'outlook', 'whatsapp', 'messenger', 'slack', 'telegram', 'discord', 'zoom', 'meet.google', 'teams.microsoft']],
  ['ai',       ['chatgpt', 'openai', 'claude.ai', 'gemini.google', 'bard', 'perplexity', 'copilot', 'huggingface', 'midjourney', 'poe.com', 'grok.com', 'x.ai']],
  ['research', ['wikipedia', 'scholar.google', 'arxiv', 'stackoverflow', 'stackexchange', 'github', 'developer.mozilla', 'medium', 'substack', 'quora', 'notion.site']],
  ['prod',     ['notion.so', 'docs.google', 'drive.google', 'sheets.google', 'slides.google', 'calendar.google', 'figma', 'linear', 'asana', 'trello', 'jira', 'atlassian', 'canva', 'deeeen']],
  ['social',   ['twitter', 'x.com', 'facebook', 'instagram', 'linkedin', 'reddit', 'tiktok', 'threads', 'mastodon', 'bsky']],
  ['ent',      ['youtube', 'netflix', 'twitch', 'spotify', 'soundcloud', 'hulu', 'primevideo', 'disneyplus']],
  ['news',     ['nytimes', 'bbc', 'cnn', 'theguardian', 'reuters', 'bloomberg', 'wsj', 'news.ycombinator', 'techcrunch', 'theverge']],
  ['shop',     ['amazon', 'ebay', 'etsy', 'aliexpress', 'flipkart', 'walmart', 'shopify']],
];

function categoryOf(host) {
  const h = String(host).toLowerCase();
  for (const [id, keys] of RULES) {
    if (keys.some((k) => h.includes(k))) return CATEGORIES[id];
  }
  return CATEGORIES.other;
}

function getVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

function fmtDur(secs) {
  secs = Math.max(0, Math.round(secs));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s === 0 ? `${m}m` : `${m}m ${String(s).padStart(2, '0')}s`;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}

function fmtDurWords(secs) {
  secs = Math.max(0, Math.round(secs));
  if (secs < 60) return `${secs} second${secs === 1 ? '' : 's'}`;
  if (secs < 3600) {
    const m = Math.max(1, Math.round(secs / 60));
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (m === 0) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${h} hour${h === 1 ? '' : 's'} ${m} minute${m === 1 ? '' : 's'}`;
}

function fmtClock(ms) {
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function fmtHourCompact(ms) {
  const d = new Date(ms);
  let h = d.getHours();
  const ap = h >= 12 ? 'p' : 'a';
  h = h % 12 || 12;
  return `${h}${ap}`;
}

const SLD_SUFFIXES = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'gob', 'mil', 'or', 'ne', 'go']);

function niceName(host) {
  const labels = String(host).replace(/^www\./, '').replace(/^m\./, '').split('.');
  if (labels.length <= 1) return cap(labels[0] || host);
  let idx = labels.length - 2;
  if (labels.length >= 3 && SLD_SUFFIXES.has(labels[labels.length - 2])) idx = labels.length - 3;
  return cap(labels[idx] || labels[0] || host);
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function letterOf(title) {
  const ch = String(title).trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

function displayName(host, meta) {
  const title = meta[host] && meta[host].title;
  if (title && title !== host && title.length <= 28 && !/\s[-|•·]/.test(title)) return title;
  return niceName(host);
}

function rangeBounds(range, now) {
  if (range === 'hour') {
    return { from: now - 3600e3, to: now, label: 'last hour', prevFrom: now - 7200e3, prevTo: now - 3600e3, prevLabel: 'the hour before' };
  }
  if (range === '3h') {
    return { from: now - 3 * 3600e3, to: now, label: 'last 3 hours', prevFrom: now - 6 * 3600e3, prevTo: now - 3 * 3600e3, prevLabel: 'the 3 hours before' };
  }
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const yStart = new Date(midnight); yStart.setDate(yStart.getDate() - 1);
  const yEnd = new Date(yStart.getTime() + (now - midnight.getTime()));
  return { from: midnight.getTime(), to: now, label: 'today', prevFrom: yStart.getTime(), prevTo: yEnd.getTime(), prevLabel: 'yesterday' };
}

function deltaCopy(current, prev, unit) {
  if (prev <= 0 && current <= 0) return 'quiet both times';
  if (prev <= 0) return 'new this range';
  const diff = current - prev;
  if (Math.abs(diff) < 1) return `level with ${unit}`;
  return `${diff > 0 ? 'up' : 'down'} ${fmtDur(Math.abs(diff))} vs ${unit}`;
}

function sumRange(buckets, from, to) {
  const fromMin = Math.floor(from / MIN_MS);
  const toMin = Math.floor((to - 1) / MIN_MS);
  const hosts = {};
  const minutes = [];
  let totalSeconds = 0;
  for (let m = fromMin; m <= toMin; m++) {
    const rec = buckets[String(m)] || {};
    let total = 0, dominant = null, best = 0;
    const byHost = {};
    for (const [host, secs] of Object.entries(rec)) {
      byHost[host] = secs;
      total += secs;
      if (secs > best) { best = secs; dominant = host; }
    }
    totalSeconds += total;
    for (const [host, secs] of Object.entries(byHost)) hosts[host] = (hosts[host] || 0) + secs;
    minutes.push({
      min: m, total, dominant, byHost,
      categoryId: dominant ? categoryOf(dominant).id : null,
    });
  }
  return { hosts, minutes, totalSeconds, fromMin, toMin };
}

function buildSessions(minutes, meta) {
  const sessions = [];
  let cur = null;
  const flush = () => { if (cur) sessions.push(cur); cur = null; };
  for (const pt of minutes) {
    const host = pt.total > 0 ? pt.dominant : null;
    if (!host) { flush(); continue; }
    if (cur && cur.host === host && pt.min <= cur.toMin + 8) {
      cur.toMin = pt.min;
      cur.seconds += pt.byHost[host] || pt.total;
      continue;
    }
    flush();
    const title = displayName(host, meta);
    cur = {
      host, title,
      letter: letterOf(title),
      category: categoryOf(host),
      fromMin: pt.min, toMin: pt.min,
      seconds: pt.byHost[host] || pt.total,
    };
  }
  flush();
  return sessions;
}

function aggregate(buckets, meta, range, now) {
  const bounds = rangeBounds(range, now);
  const cur = sumRange(buckets, bounds.from, bounds.to);
  const prev = sumRange(buckets, bounds.prevFrom, bounds.prevTo);
  const rangeMs = bounds.to - bounds.from;
  const hosts = Object.entries(cur.hosts).map(([host, seconds]) => {
    const title = displayName(host, meta);
    return {
      host, title, seconds,
      letter: letterOf(title),
      share: cur.totalSeconds > 0 ? seconds / cur.totalSeconds : 0,
      category: categoryOf(host),
      favicon: (meta[host] && meta[host].favicon) || '',
    };
  }).sort((a, b) => b.seconds - a.seconds);

  const catMap = {};
  for (const h of hosts) {
    const id = h.category.id;
    if (!catMap[id]) catMap[id] = { category: h.category, seconds: 0, share: 0 };
    catMap[id].seconds += h.seconds;
  }
  const categories = Object.values(catMap)
    .map((c) => ({ ...c, share: cur.totalSeconds > 0 ? c.seconds / cur.totalSeconds : 0 }))
    .sort((a, b) => b.seconds - a.seconds);

  const sessions = buildSessions(cur.minutes, meta);
  const longest = sessions.slice().sort((a, b) => b.seconds - a.seconds)[0] || null;
  const presence = rangeMs > 0 ? cur.totalSeconds / (rangeMs / 1000) : 0;
  const first = cur.minutes.find((m) => m.total > 0);

  return {
    hosts, minutes: cur.minutes, sessions, categories,
    totalSeconds: cur.totalSeconds, rangeMs,
    presence: Math.min(1, presence),
    from: bounds.from, to: bounds.to,
    fromMin: cur.fromMin, toMin: cur.toMin,
    firstMs: first ? first.min * MIN_MS : bounds.from,
    prevTotal: prev.totalSeconds,
    prevHosts: Object.keys(prev.hosts).length,
    longest, label: bounds.label, prevLabel: bounds.prevLabel,
  };
}

function composeNarrative(agg) {
  const top = agg.hosts[0];
  const second = agg.hosts[1];
  const total = agg.totalSeconds;
  const n = agg.hosts.length;
  const hour = new Date(agg.to).getHours();
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const art = part === 'morning' ? 'A' : 'An';
  let title;
  if (n === 0 || total < 20) title = 'A still stretch.';
  else if (total < 180) title = 'A quiet trail.';
  else if (top && top.seconds / total > 0.55) title = `Mostly ${top.title}.`;
  else if (top && (top.category.id === 'prod' || top.category.id === 'research' || top.category.id === 'ai'))
    title = `${art} ${part} of making.`;
  else if (top && top.category.id === 'comm') title = `${art} ${part} of talking.`;
  else if (top && (top.category.id === 'ent' || top.category.id === 'social'))
    title = `${art} ${part} of wandering.`;
  else title = `A ${part} across ${n} places.`;
  const lede = n === 0
    ? 'No active-tab time in this range.'
    : `${fmtDurWords(total)} of presence, ${n} place${n === 1 ? '' : 's'}.`;
  const sub = top
    ? (second
      ? `Longest stay ${top.title} · ${fmtDur(top.seconds)}. Then ${second.title}.`
      : `All of it at ${top.title}.`)
    : 'The thread is blank.';
  return {
    eyebrow: `Across focused Chrome windows · ${agg.label}`,
    title, lede, sub,
  };
}

async function loadRaw() {
  if (hasStorage) {
    await new Promise((res) => {
      try { chrome.runtime.sendMessage('flush', () => res()); } catch { res(); }
    });
    const d = await chrome.storage.local.get(['buckets', 'meta']);
    return { buckets: d.buckets || {}, meta: d.meta || {}, demo: false, now: Date.now() };
  }
  const demo = demoData();
  return { buckets: demo.buckets, meta: demo.meta, demo: true, now: demo.now };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoData() {
  const now = Date.now();
  const rng = mulberry32(20260903);
  const buckets = {};
  const meta = {};
  const specs = [
    [2, 14, 'github.com', 'GitHub', 0.86],
    [16, 6, 'google.com', 'Google', 0.48],
    [24, 8, 'wikipedia.org', 'Wikipedia', 0.72],
    [34, 9, 'deeeen.xyz', 'Deeeen', 0.64],
    [52, 16, 'notion.so', 'Notion', 0.78],
    [60, 7, 'youtube.com', 'YouTube', 0.9],
    [84, 22, 'github.com', 'GitHub', 0.88],
    [102, 16, 'chatgpt.com', 'ChatGPT', 0.82],
    [174, 68, 'github.com', 'GitHub', 0.91],
    [178, 3, 'x.com', 'X', 0.7],
    [204, 22, 'slack.com', 'Slack', 0.52],
    [212, 6, 'calendar.google.com', 'Calendar', 0.4],
    [240, 24, 'mail.google.com', 'Gmail', 0.66],
  ];
  const paint = (startMs, endMs, host, intensity) => {
    const startMin = Math.floor(startMs / MIN_MS);
    const endMin = Math.max(startMin + 1, Math.floor(endMs / MIN_MS));
    for (let m = startMin; m < endMin; m++) {
      if (rng() < 0.03) continue;
      const secs = Math.max(5, Math.min(60, Math.round((0.5 + rng() * 0.5) * intensity * 60)));
      buckets[m] = buckets[m] || {};
      buckets[m][host] = Math.min(60, (buckets[m][host] || 0) + secs);
    }
  };
  for (const [agoEnd, dur, host, title, intensity] of specs) {
    const end = now - agoEnd * MIN_MS;
    paint(end - dur * MIN_MS, end, host, intensity);
    meta[host] = { title, favicon: '' };
  }
  const yDay = new Date(now);
  yDay.setDate(yDay.getDate() - 1);
  yDay.setHours(9, 10, 0, 0);
  const extra = [
    [0, 48, 'github.com', 0.9],
    [55, 20, 'chatgpt.com', 0.8],
    [80, 70, 'figma.com', 0.85],
    [160, 25, 'slack.com', 0.5],
    [190, 90, 'github.com', 0.88],
    [290, 18, 'youtube.com', 0.9],
    [315, 40, 'notion.so', 0.74],
    [365, 55, 'mail.google.com', 0.6],
  ];
  const titles = { 'figma.com': 'Figma' };
  for (const [offset, dur, host, intensity] of extra) {
    const start = yDay.getTime() + offset * MIN_MS;
    paint(start, start + dur * MIN_MS, host, intensity);
    if (!meta[host]) meta[host] = { title: titles[host] || niceName(host), favicon: '' };
  }
  return { buckets, meta, now };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => {
    if (c === '&') return String.fromCharCode(38) + 'amp;';
    if (c === '<') return String.fromCharCode(38) + 'lt;';
    if (c === '>') return String.fromCharCode(38) + 'gt;';
    if (c === '"') return String.fromCharCode(38) + 'quot;';
    return String.fromCharCode(38) + '#39;';
  });
}

function sealHtml(letter, colorVar, size, favicon) {
  const cls = size === 'sm' ? 'seal sm' : 'seal';
  const style = `background:color-mix(in oklab, var(${colorVar}) 22%, transparent);color:var(${colorVar});box-shadow:inset 0 0 0 1px color-mix(in oklab, var(${colorVar}) 50%, transparent)`;
  if (favicon) {
    return `<span class="${cls}" style="${style}"><img src="${escapeHtml(favicon)}" alt="" onerror="this.remove()"></span>`;
  }
  return `<span class="${cls}" style="${style}" aria-hidden="true">${escapeHtml(letter)}</span>`;
}

function activeHost() { return hoverHost || focusHost; }
