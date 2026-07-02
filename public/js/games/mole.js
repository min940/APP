'use strict';
window.GameClients = window.GameClients || {};

window.GameClients.mole = {
  mount(area, api) {
    const GUI = api.GUI;
    let curId = -1, curCell = -1, timer = null;

    api.on('mole:start', (d) => {
      if (timer) timer.stop();
      const cellsHtml = Array.from({ length: d.cells }, (_, i) =>
        `<button class="mole-cell" data-cell="${i}"><span class="hole"></span></button>`).join('');
      area.innerHTML = `<div class="fade-in">
        <div class="game-header"><span>🔨 두더지를 탭!</span><span class="pill" id="hits"></span></div>
        <div class="timer-bar"><div id="bar"></div></div>
        <div class="mole-grid">${cellsHtml}</div>
      </div>`;
      area.querySelectorAll('.mole-cell').forEach((btn) => {
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const cell = Number(btn.dataset.cell);
          if (btn.classList.contains('up')) api.send('whack', { cell, id: curId });
        });
      });
      timer = GUI.countdown(area.querySelector('#bar'), d.durationMs);
    });

    api.on('mole:up', (d) => {
      curId = d.id; curCell = d.cell;
      const cell = area.querySelector(`.mole-cell[data-cell="${d.cell}"]`);
      if (cell) cell.classList.add('up');
    });
    api.on('mole:down', () => {
      const c = area.querySelector('.mole-cell.up');
      if (c) c.classList.remove('up');
      curCell = -1;
    });
    api.on('mole:hit', (d) => {
      if (d.cell != null) {
        const cell = area.querySelector(`.mole-cell[data-cell="${d.cell}"]`);
        if (cell) { cell.classList.remove('up'); cell.classList.add('bonk'); setTimeout(() => cell.classList.remove('bonk'), 200); }
      }
      const me = d.scores.find((s) => s.id === api.me.playerId);
      const el = area.querySelector('#hits');
      if (el && me) el.textContent = `내 점수 ${me.score}`;
      api.refreshScore();
    });

    api.onUnmount(() => { if (timer) timer.stop(); });
  },
};
