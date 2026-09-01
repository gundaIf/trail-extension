'use strict';
const MIN_MS = 60 * 1000;

function fmtDur(secs) {
  secs = Math.round(secs);
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${String(Math.round((secs % 3600) / 60)).padStart(2, '0')}m`;
  return `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`;
}
function colorForHost(host) {
  const p = ['#5b9dff', '#f2765f', '#f5b73d', '#5cc98a', '#b07cf0', '#ff8a5c', '#46c7c7', '#e35d9c'];
  let h = 0; for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return p[h % p.length];
}
function niceName(host) {
  const base = host.replace(/\.(com|org|net|io|ai|co|so|app|dev|gg)$/, '').split('.').pop();
  return base.charAt(0).toUpperCase() + base.slice(1);
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

  document.getElementById('total').textContent = total ? fmtDur(total) : '0m 00s';
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
      const icon = fav
        ? `<img class="fav" src="${fav}" onerror="this.remove()" alt="">`
        : `<span class="fb" style="background:${colorForHost(host)}">${host[0].toUpperCase()}</span>`;
      row.innerHTML = `${icon}<span class="nm">${niceName(host)}</span><span class="tm">${fmtDur(secs)}</span>`;
      list.appendChild(row);
    }
  }
}

document.getElementById('open').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
});

main();
