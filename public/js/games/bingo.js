'use strict';
window.GameClients = window.GameClients || {};

window.GameClients.bingo = {
  mount(area, api) {
    const GUI = api.GUI;
    let card = [], size = 5, target = 3;
    const drawn = new Set();
    const marked = new Set();

    function render() {
      area.innerHTML = `<div class="fade-in">
        <div class="game-header"><span id="lines">완성 줄 0/${target}</span><span class="pill" id="last">-</span></div>
        <div class="center muted" id="drawnlist" style="min-height:1.4em;margin-bottom:8px"></div>
        <div class="bingo-grid" style="grid-template-columns:repeat(${size},1fr)"></div>
        <div class="center muted" style="margin-top:10px">뽑힌 숫자를 눌러 표시하세요! ${target}줄 먼저 완성하면 승리 🎉</div>
      </div>`;
      const grid = area.querySelector('.bingo-grid');
      card.forEach((num, i) => {
        const cell = GUI.h(`<button class="bingo-cell" data-cell="${i}">${num}</button>`);
        cell.onclick = () => {
          if (marked.has(i)) return;
          if (!drawn.has(num)) { api.toast('아직 안 뽑힌 숫자예요'); return; }
          api.send('mark', { cell: i });
        };
        grid.appendChild(cell);
      });
    }

    api.on('bingo:card', (d) => { card = d.card; size = d.size; target = d.target; render(); });
    api.on('bingo:start', () => { if (!card.length) return; });

    api.on('bingo:draw', (d) => {
      drawn.add(d.number);
      const last = area.querySelector('#last'); if (last) last.textContent = `방금: ${d.number}`;
      const dl = area.querySelector('#drawnlist'); if (dl) dl.textContent = '뽑힌 수: ' + [...drawn].join(', ');
      // 내 카드에 있으면 살짝 강조
      const idx = card.indexOf(d.number);
      if (idx >= 0 && !marked.has(idx)) {
        const cell = area.querySelector(`.bingo-cell[data-cell="${idx}"]`);
        if (cell) cell.classList.add('drawable');
      }
    });

    api.on('bingo:marked', (d) => {
      marked.add(d.cell);
      const cell = area.querySelector(`.bingo-cell[data-cell="${d.cell}"]`);
      if (cell) { cell.classList.add('on'); cell.classList.remove('drawable'); }
      const el = area.querySelector('#lines'); if (el) el.textContent = `완성 줄 ${d.lines}/${target}`;
    });

    api.on('bingo:winner', (d) => {
      const me = d.id === api.me.playerId;
      api.toast(me ? '빙고! 승리 🎉' : `${d.name} 님 빙고!`);
      api.refreshScore();
    });
  },
};
