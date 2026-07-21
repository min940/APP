'use strict';
window.GameClients = window.GameClients || {};

window.GameClients.racing = {
  mount(area, api) {
    const GUI = api.GUI;
    let target = 40;
    let canTap = false;

    function nameOf(id) { const p = api.players().find((x) => x.id === id); return p ? p.name : '?'; }

    function renderTrack(progress) {
      const wrap = area.querySelector('#track');
      if (!wrap) return;
      wrap.innerHTML = '';
      api.players().filter((p) => p.connected).forEach((p) => {
        const pct = Math.min(100, Math.round(((progress[p.id] || 0) / target) * 100));
        const me = p.id === api.me.playerId;
        const row = GUI.h(`<div style="margin:8px 0">
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:.9rem">
            <span>${me ? '⭐ ' : ''}${GUI.esc(p.name)}</span><span>${pct}%</span>
          </div>
          <div class="timer-bar" style="height:22px;position:relative">
            <div id="bar-${p.id}" style="width:${pct}%;background:${me ? 'var(--accent)' : 'var(--primary)'}"></div>
            <span style="position:absolute;top:0;left:calc(${pct}% - 14px);font-size:1.1rem">🏎️</span>
          </div>
        </div>`);
        wrap.appendChild(row);
      });
    }

    api.on('race:countdown', (d) => {
      target = d.target;
      canTap = false;
      area.innerHTML = `<div class="fade-in">
        <div class="game-header"><span class="round">${d.race}/${d.total} 경주</span><span class="pill">연타 준비!</span></div>
        <div id="track"></div>
        <div class="react-pad wait" id="pad" style="height:30vh;min-height:180px">🚦 준비… 초록불에 연타!</div>
      </div>`;
      renderTrack({});
      let n = 3;
      const pad = area.querySelector('#pad');
      const iv = setInterval(() => { if (n > 0) { pad.textContent = `${n}...`; n--; } else clearInterval(iv); }, 900);
      api.onUnmount(() => clearInterval(iv));
    });

    api.on('race:go', () => {
      canTap = true;
      const pad = area.querySelector('#pad');
      if (pad) { pad.className = 'react-pad go'; pad.textContent = '🏎️ 연타!! 연타!!'; pad.style.height = '30vh'; }
    });

    api.on('race:progress', (d) => {
      const bar = area.querySelector(`#bar-${d.id}`);
      if (bar) {
        bar.style.width = d.pct + '%';
        const em = bar.parentElement.querySelector('span');
        if (em) em.style.left = `calc(${d.pct}% - 14px)`;
        bar.parentElement.previousElementSibling.lastElementChild.textContent = d.pct + '%';
      }
    });

    api.on('race:finish', (d) => {
      if (d.id === api.me.playerId) { canTap = false; const pad = area.querySelector('#pad'); if (pad) pad.textContent = `${d.place}등 완주! 🎉`; }
    });

    api.on('race:result', (d) => {
      canTap = false;
      const medals = ['🥇', '🥈', '🥉'];
      area.innerHTML = `<div class="fade-in"><div class="winner">경주 결과</div><ul class="rank-list">${
        d.results.map((r) => `<li class="rank-row"><span class="medal">${medals[r.place - 1] || r.place}</span><span class="nm">${GUI.esc(r.name)}</span><span class="sc">+${r.gained}</span></li>`).join('')
      }</ul><div class="center muted">다음 경주 준비 중…</div></div>`;
      api.refreshScore();
    });

    const onTap = (e) => { e.preventDefault(); if (canTap) api.send('tap', {}); };
    area.addEventListener('pointerdown', (e) => { if (e.target.closest('#pad')) onTap(e); });
  },
};
