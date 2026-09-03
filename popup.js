'use strict';
const MIN_MS = 60 * 1000;

function fmtDur(secs) {
  secs = Math.max(0, Math.round(secs));
  if (secs < 60) return `${secs}s`;
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${String(Math.round((secs % 3600) / 60)).padStart(2, '0')}m`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}m` : `${m}m ${String(s).padStart(2, '0')}s`;
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
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => {
    if (c === '&') return String.fromCharCode(38) + 'amp;';
    if (c === '<') return String.fromCharCode(38) + 'lt;';
    if (c === '>') return String.fromCharCode(38) + 'gt;';
    if (c === '"') return String.fromCharCode(38) + 'quot;';
    return String.fromCharCode(38) + '#39;';
  });
}

async function main() {
  await new Promise((res) => { try { chrome.runtime.sendMessage('flush', () => res()); } catch { res(); } });
  const d = await chrome.storage.local.get(['buckets', 'meta']);
  const buckets = d.buckets || {}, meta = d.meta || {};
  const from = Date.now() - 3600 * 1000;
  const fromMin = Math.floor(from / MIN_MS);

  const hosts = {};
  for (const key of Object.keys(buckets)) {
    if (Number(key) < fromMin) continue;
    for (const [h, s] of Object.entries(buckets[key])) hosts[h] = (hosts[h] || 0) + s;
  }
  const entries = Object.entries(hosts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  document.getElementById('total').textContent = total ? fmtDur(total) : '0s';
  document.getElementById('sub').textContent = `across ${entries.length} place${entries.length === 1 ? '' : 's'}`;

  const list = document.getElementById('list');
  if (!entries.length) {
    list.innerHTML = '<div class="empty">No activity yet in the last hour.</div>';
  } else {
    list.innerHTML = '';
    for (const [host, secs] of entries.slice(0, 5)) {
      const row = document.createElement('div');
      row.className = 'row';
      const fav = meta[host] && meta[host].favicon;
      const letter = niceName(host).charAt(0);
      const icon = fav
        ? `<img class="fav" src="${escapeHtml(fav)}" onerror="this.remove()" alt="">`
        : `<span class="fb">${escapeHtml(letter)}</span>`;
      row.innerHTML = `${icon}<span class="nm">${escapeHtml(niceName(host))}</span><span class="tm">${fmtDur(secs)}</span>`;
      list.appendChild(row);
    }
  }
}

document.getElementById('open').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
});

main();
