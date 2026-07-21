'use strict';
window.GameClients = window.GameClients || {};

window.GameClients.board = {
  mount(area, api) {
    const GUI = api.GUI;
    let goal = 30, specials = {};

    function nameOf(id) { const p = api.players().find((x) => x.id === id); return p ? p.name : '?'; }

    function renderBoard(positions, currentId) {
      const tiles = [];
      for (let i = 0; i <= goal; i++) {
        const here = Object.entries(positions).filter(([, v]) => v === i).map(([pid]) => pid);
        const sp = specials[i];
        const markers = here.map((pid) => `<span class="pawn ${pid === api.me.playerId ? 'me' : ''}" title="${GUI.esc(nameOf(pid))}">${GUI.esc(nameOf(pid).slice(0, 1))}</span>`).join('');
        tiles.push(`<div class="tile ${i === 0 ? 'start' : ''} ${i === goal ? 'goal' : ''} ${sp ? (sp > 0 ? 'up' : 'down') : ''}">
          <span class="ti">${i === goal ? '🏁' : i === 0 ? '출발' : i}</span>${sp ? `<span class="sp">${sp > 0 ? '⬆️' + sp : '⬇️' + Math.abs(sp)}</span>` : ''}${markers}</div>`);
      }
      return `<div class="board">${tiles.join('')}</div>`;
    }

    function render(d, moveMsg) {
      const mine = d.currentId === api.me.playerId;
      area.innerHTML = `<div class="fade-in">
        <div class="turn-banner ${mine ? 'mine' : ''}">${mine ? '🎲 내 차례! 주사위를 굴려요' : GUI.esc(d.currentName) + ' 님 차례'}</div>
        ${renderBoard(d.positions, d.currentId)}
        <div id="msg" class="center" style="font-weight:800;min-height:1.4em;margin:8px 0">${moveMsg || ''}</div>
        ${mine ? '<button class="btn accent" id="roll">🎲 주사위 굴리기</button>' : '<div class="center muted">상대가 굴리는 중…</div>'}
      </div>`;
      if (mine) area.querySelector('#roll').onclick = (e) => { e.currentTarget.disabled = true; api.send('roll', {}); };
    }

    api.on('board:turn', (d) => { goal = d.goal; specials = d.specials || {}; render(d); });

    api.on('board:move', (d) => {
      const msg = `${GUI.esc(d.name)}: 🎲${d.dice} → ${d.to}칸${d.special ? (d.special > 0 ? ` (⬆️사다리 +${d.special})` : ` (⬇️미끄럼 ${d.special})`) : ''}`;
      // 이동 결과만 갱신 (다음 turn 이벤트가 곧 화면을 다시 그림)
      const el = area.querySelector('#msg');
      if (el) el.textContent = msg;
      const boardEl = area.querySelector('.board');
      if (boardEl) boardEl.outerHTML = renderBoard(d.positions, d.id);
      if (d.to >= goal) api.toast(`${d.name} 님 결승 도착! 🏁`);
      api.refreshScore();
    });
  },
};
