'use strict';

async function render() {
  const raw = await loadRaw();
  document.getElementById('demoNote').hidden = !raw.demo;
  const agg = aggregate(raw.buckets, raw.meta, currentRange, raw.now);
  lastAgg = agg;
  const nar = composeNarrative(agg);
  document.getElementById('eyebrow').textContent = nar.eyebrow;
  document.getElementById('headline').textContent = nar.title;
  document.getElementById('lede').textContent = nar.lede;
  document.getElementById('subline').textContent = nar.sub;
  if (agg.totalSeconds < 1) {
    document.getElementById('lede').textContent = 'Browse a few sites, then come back — Trail only counts the tab you are actively looking at.';
  }
  drawThread(agg);
  drawStats(agg);
  drawPlaces(agg);
  drawLattice(agg);
  drawPigment(agg);
  drawJournal(agg);
}

function drawStats(agg) {
  const idleSecs = Math.max(0, agg.rangeMs / 1000 - agg.totalSeconds);
  const present = Math.round(agg.presence * 100);
  const placesHint = agg.prevHosts === agg.hosts.length
    ? `same as ${agg.prevLabel}`
    : `${agg.hosts.length - agg.prevHosts > 0 ? '+' : ''}${agg.hosts.length - agg.prevHosts} vs ${agg.prevLabel}`;
  document.getElementById('stats').innerHTML = `
    <div class="stat"><p class="k">Present</p><p class="v">${fmtDur(agg.totalSeconds)}</p><p class="h">${deltaCopy(agg.totalSeconds, agg.prevTotal, agg.prevLabel)}</p></div>
    <div class="stat"><p class="k">Places</p><p class="v">${agg.hosts.length}</p><p class="h">${placesHint}</p></div>
    <div class="stat"><p class="k">Longest stay</p><p class="v">${agg.longest ? fmtDur(agg.longest.seconds) : '—'}</p><p class="h">${agg.longest ? escapeHtml(agg.longest.title) : 'No sessions yet'}</p></div>
    <div class="presence">
      <div class="meta"><span>Presence · ${present}% of this range</span><span>${fmtDur(agg.totalSeconds)} present / ${fmtDur(idleSecs)} idle</span></div>
      <div class="track"><span style="width:${Math.max(present, present > 0 ? 2 : 0)}%"></span></div>
    </div>`;
}

function drawPlaces(agg) {
  const list = document.getElementById('placesList');
  const moreBtn = document.getElementById('moreBtn');
  list.innerHTML = '';
  if (!agg.hosts.length) {
    list.innerHTML = '<div class="empty">No activity in this range.</div>';
    moreBtn.hidden = true;
    return;
  }
  const TOP = 12;
  const top = agg.hosts.slice(0, TOP);
  restPlaces = agg.hosts.slice(TOP);
  for (const row of top) list.appendChild(placeRow(row, agg));
  if (restPlaces.length) {
    const restSecs = restPlaces.reduce((s, r) => s + r.seconds, 0);
    moreBtn.hidden = false;
    moreBtn.textContent = `${restPlaces.length} more place${restPlaces.length === 1 ? '' : 's'} · ${fmtDur(restSecs)}`;
  } else {
    moreBtn.hidden = true;
  }
}

function placeRow(row, agg) {
  const btn = document.createElement('button');
  const host = activeHost();
  btn.className = 'place' + (host && host !== row.host ? ' dim' : '');
  btn.type = 'button';
  btn.dataset.host = row.host;
  btn.innerHTML =
    `<span class="idx">${String(agg.hosts.indexOf(row) + 1).padStart(2, '0')}</span>` +
    sealHtml(row.letter, row.category.colorVar, 'md', row.favicon) +
    `<span class="nm"><strong title="${escapeHtml(row.host)}">${escapeHtml(row.title)}</strong><small>${escapeHtml(row.category.name)}</small></span>` +
    `<span class="right"><span class="dur">${fmtDur(row.seconds)}</span><span class="bar"><span style="width:${Math.max(4, row.share * 100)}%;background:var(${row.category.colorVar})"></span></span></span>` +
    `<span class="pct">${Math.round(row.share * 1000) / 10}%</span>`;
  btn.addEventListener('click', () => {
    focusHost = focusHost === row.host ? null : row.host;
    rerenderFocus();
  });
  btn.addEventListener('mouseenter', () => { hoverHost = row.host; rerenderFocus(); });
  btn.addEventListener('mouseleave', () => { hoverHost = null; rerenderFocus(); });
  return btn;
}

function drawLattice(agg) {
  const el = document.getElementById('lattice');
  const minutes = agg.minutes;
  const rows = [];
  for (let i = 0; i < minutes.length; i += 60) rows.push(minutes.slice(i, i + 60));
  while (rows.length > 1 && rows[0].every((m) => m.total <= 0)) rows.shift();
  const host = activeHost();
  el.className = 'lattice';
  el.innerHTML = rows.map((row) => {
    const start = row[0];
    if (!start) return '';
    const cells = row.map((pt) => {
      const secs = host ? (pt.byHost[host] || 0) : pt.total;
      const cat = pt.categoryId || 'other';
      const t = Math.min(1, secs / 50);
      const a = 0.18 + t * 0.82;
      const bg = secs > 0
        ? `color-mix(in oklab, var(--c-${cat}) ${Math.round(a * 100)}%, transparent)`
        : '';
      const title = `${fmtHourCompact(pt.min * MIN_MS)} · ${secs > 0 ? Math.round(secs) + 's' : 'idle'}`;
      return `<span title="${title}" style="${bg ? `background:${bg}` : ''}"></span>`;
    }).join('');
    return `<div class="lat-row"><span class="lat-lab">${fmtHourCompact(start.min * MIN_MS)}</span><div class="lat-cells">${cells}</div></div>`;
  }).join('') || '<div class="empty">No minutes in this range.</div>';
}

function drawPigment(agg) {
  const el = document.getElementById('pigment');
  if (!agg.categories.length) {
    el.innerHTML = '<div class="empty">No categories yet.</div>';
    return;
  }
  const bar = agg.categories.map((c, i) =>
    `<span style="width:${Math.max(c.share * 100, c.share > 0 ? 1.5 : 0)}%;background:var(${c.category.colorVar});animation-delay:${i * 60}ms" title="${escapeHtml(c.category.name)} ${fmtDur(c.seconds)}"></span>`
  ).join('');
  const list = agg.categories.map((c) =>
    `<li><span class="dot" style="background:var(${c.category.colorVar})"></span>` +
    `<span class="name">${escapeHtml(c.category.name)}</span>` +
    `<span class="val">${fmtDur(c.seconds)}</span>` +
    `<span class="pct">${Math.round(c.share * 100)}%</span></li>`
  ).join('');
  el.innerHTML = `<div class="pig-bar">${bar}</div><ul class="pig-list">${list}</ul>`;
}

function drawJournal(agg) {
  const el = document.getElementById('journal');
  const rows = agg.sessions.slice().reverse();
  const visible = rows.slice(0, 18);
  const hidden = rows.length - visible.length;
  const host = activeHost();
  if (!visible.length) {
    el.innerHTML = '<div class="empty">No visits in this range.</div>';
    return;
  }
  el.className = 'journal';
  el.innerHTML = `<span class="spine" aria-hidden="true"></span>` + visible.map((s) => {
    const dim = host && host !== s.host ? ' dim' : '';
    return `<button class="j-row${dim}" type="button" data-host="${escapeHtml(s.host)}">` +
      `<span class="when">${fmtClock(s.fromMin * MIN_MS)}</span>` +
      `<span class="dot" style="background:var(${s.category.colorVar})"></span>` +
      `<span class="body">${sealHtml(s.letter, s.category.colorVar, 'sm')}<span><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(s.category.name)}</small></span></span>` +
      `<span class="dur">${fmtDur(s.seconds)}</span></button>`;
  }).join('') + (hidden > 0 ? `<div class="j-more">${hidden} earlier visit${hidden === 1 ? '' : 's'} folded away</div>` : '');
  el.querySelectorAll('.j-row').forEach((btn) => {
    const h = btn.dataset.host;
    btn.addEventListener('click', () => { focusHost = focusHost === h ? null : h; rerenderFocus(); });
    btn.addEventListener('mouseenter', () => { hoverHost = h; rerenderFocus(); });
    btn.addEventListener('mouseleave', () => { hoverHost = null; rerenderFocus(); });
  });
}

function tickStep(span) {
  if (span <= 70) return 10;
  if (span <= 200) return 30;
  if (span <= 900) return 60;
  return 120;
}

function drawThread(agg) {
  const card = document.getElementById('threadCard');
  const svg = document.getElementById('thread');
  const w = card.clientWidth || 720;
  const h = card.clientHeight || 208;
  const padL = 16, padR = 16, padT = 28, padB = 36;
  const innerW = Math.max(8, w - padL - padR);
  const baseY = padT + (h - padT - padB) * 0.5;
  const maxHw = (h - padT - padB) * 0.42;
  const firstActive = agg.minutes.findIndex((m) => m.total > 0);
  const mins = firstActive > 0 ? agg.minutes.slice(firstActive) : agg.minutes;
  const span = Math.max(1, mins.length);
  const origin = mins[0] ? mins[0].min : agg.fromMin;
  const stepX = innerW / span;
  const host = activeHost();
  const pts = mins.map((pt, i) => {
    const x = padL + (i + 0.5) * stepX;
    const wobble = Math.sin(i * 0.33 + 0.4) * 1.6 + Math.sin(i * 0.09 + 1.2) * 0.8;
    const y = baseY + wobble;
    const focusedSecs = host ? (pt.byHost[host] || 0) : pt.total;
    const idle = focusedSecs <= 0;
    const hw = idle ? 1.1 : 2.4 + (Math.min(focusedSecs, 60) / 60) * maxHw;
    const hst = host && pt.byHost[host] ? host : pt.dominant;
    const cat = hst
      ? ((agg.hosts.find((row) => row.host === hst) || {}).category || { id: pt.categoryId || 'other' }).id
      : 'other';
    return {
      x, y, hw, cat, idle,
      dim: Boolean(host && !pt.byHost[host]),
      rx: Math.max(stepX * 0.72, 2.2),
      min: pt.min, host: hst, total: pt.total, byHost: pt.byHost,
    };
  });
  const ticks = [];
  const step = tickStep(span);
  for (let i = 0; i < span; i += step) {
    ticks.push({ x: padL + (i + 0.5) * stepX, label: fmtClock((origin + i) * MIN_MS) });
  }
  const labels = [];
  if (w >= 640) {
    let last = -999;
    for (const sess of agg.sessions) {
      if (sess.seconds < 8 * 60) continue;
      if (host && sess.host !== host) continue;
      const mid = (sess.fromMin + sess.toMin) / 2;
      const x = padL + (mid - origin + 0.5) * stepX;
      if (x < padL + 24 || x > w - padR - 24) continue;
      if (x - last < 72) continue;
      last = x;
      labels.push({ x, title: sess.title, cat: sess.category.id });
    }
  }
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const tickG = ticks.map((t) =>
    `<g><line x1="${t.x}" x2="${t.x}" y1="${padT - 6}" y2="${h - padB + 8}" stroke="currentColor" stroke-opacity="0.08"/>` +
    `<text x="${t.x}" y="${h - padB + 22}" text-anchor="middle" fill="currentColor" opacity="0.55" font-size="11">${escapeHtml(t.label)}</text></g>`
  ).join('');
  const blobs = pts.map((p) => p.idle
    ? `<circle cx="${p.x}" cy="${p.y}" r="1.05" fill="currentColor" fill-opacity="0.22"/>`
    : `<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.hw}" fill="var(--c-${p.cat})" fill-opacity="${p.dim ? 0.14 : 0.92}"/>`
  ).join('');
  const labs = labels.map((l) => {
    const anchor = l.x < 80 ? 'start' : l.x > w - 80 ? 'end' : 'middle';
    return `<text x="${l.x}" y="${padT - 8}" text-anchor="${anchor}" font-size="12" font-style="italic" font-family="Georgia, 'Instrument Serif', serif" fill="var(--c-${l.cat})">${escapeHtml(l.title)}</text>`;
  }).join('');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `${tickG}<path d="${line}" fill="none" stroke="currentColor" stroke-opacity="0.28" stroke-width="1"/>${blobs}${labs}`;
  svg._pts = pts;
  svg._span = span;
  svg._padL = padL;
  svg._innerW = innerW;
  svg._agg = agg;
}

function onThreadMove(e) {
  const svg = e.currentTarget;
  const pts = svg._pts;
  if (!pts || !pts.length) return;
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const i = Math.min(svg._span - 1, Math.max(0, Math.floor(((x - svg._padL) / svg._innerW) * svg._span)));
  const pt = pts[i];
  const tip = document.getElementById('threadTip');
  const agg = svg._agg;
  if (!pt) { tip.hidden = true; return; }
  const host = focusHost ? (pt.byHost[focusHost] ? focusHost : pt.host) : pt.host;
  const cardW = document.getElementById('threadCard').clientWidth;
  tip.style.left = `${Math.min(Math.max(x, 72), cardW - 72)}px`;
  tip.style.top = '28px';
  if (!host || pt.total <= 0) {
    tip.innerHTML = `<div class="t">Idle</div><div class="d">${fmtClock(pt.min * MIN_MS)} · no active tab</div>`;
    tip.hidden = false;
    if (hoverHost) { hoverHost = null; rerenderFocus(true); }
    return;
  }
  const row = agg.hosts.find((h) => h.host === host);
  const sess = agg.sessions.find((s) => s.host === host && pt.min >= s.fromMin && pt.min <= s.toMin);
  tip.innerHTML = `<div class="t">${escapeHtml(row ? row.title : host)}</div><div class="d">${fmtClock(pt.min * MIN_MS)} · ${sess ? fmtDur(sess.seconds) + ' stay' : fmtDur(pt.byHost[host] || pt.total)}</div>`;
  tip.hidden = false;
  if (hoverHost !== host) { hoverHost = host; rerenderFocus(true); }
}

function rerenderFocus(skipThread) {
  if (!lastAgg) return;
  if (!skipThread) drawThread(lastAgg);
  const host = activeHost();
  document.querySelectorAll('.place, .j-row').forEach((el) => {
    el.classList.toggle('dim', Boolean(host && host !== el.dataset.host));
  });
  drawLattice(lastAgg);
}

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('trail-theme', t); } catch {}
  document.querySelectorAll('#themeSwitch button').forEach((b) => b.classList.toggle('active', b.dataset.theme === t));
  if (lastAgg) drawThread(lastAgg);
}

document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.pill');
  if (!btn) return;
  document.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p === btn));
  currentRange = btn.dataset.range;
  focusHost = null;
  hoverHost = null;
  render();
});

document.getElementById('themeSwitch').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  applyTheme(btn.dataset.theme);
});

document.getElementById('privacyBtn').addEventListener('click', () => {
  document.getElementById('privacyDlg').showModal();
});
document.getElementById('privacyClose').addEventListener('click', () => {
  document.getElementById('privacyDlg').close();
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Erase all recorded activity? This cannot be undone.')) return;
  if (hasStorage) chrome.runtime.sendMessage('reset', () => { document.getElementById('privacyDlg').close(); render(); });
  else { document.getElementById('privacyDlg').close(); render(); }
});

document.getElementById('moreBtn').addEventListener('click', () => {
  const list = document.getElementById('placesList');
  for (const row of restPlaces) list.appendChild(placeRow(row, lastAgg));
  restPlaces = [];
  document.getElementById('moreBtn').hidden = true;
});

const thread = document.getElementById('thread');
thread.addEventListener('mousemove', onThreadMove);
thread.addEventListener('mouseleave', () => {
  document.getElementById('threadTip').hidden = true;
  hoverHost = null;
  rerenderFocus();
});

window.addEventListener('resize', () => { if (lastAgg) drawThread(lastAgg); });

(function initTheme() {
  let t = 'ink';
  try { t = localStorage.getItem('trail-theme') || 'ink'; } catch {}
  if (t === 'dark') t = 'ink';
  if (t === 'default') t = 'paper';
  applyTheme(t);
})();

if (hasStorage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(() => render());
}

render();
