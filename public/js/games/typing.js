'use strict';
window.GameClients = window.GameClients || {};

window.GameClients.typing = {
  mount(area, api) {
    const GUI = api.GUI;
    let timer = null, done = false;

    function log(html, cls) {
      const box = area.querySelector('#log');
      if (box) { box.appendChild(GUI.h(`<div class="line ${cls || ''}">${html}</div>`)); box.scrollTop = box.scrollHeight; }
    }

    api.on('typing:round', (d) => {
      if (timer) timer.stop();
      done = false;
      area.innerHTML = `<div class="fade-in">
        <div class="game-header"><span class="round">${d.round}/${d.total}</span></div>
        <div class="timer-bar"><div id="bar"></div></div>
        <div class="type-target">${GUI.esc(d.sentence)}</div>
        <div class="chat-input-row" style="margin-top:12px">
          <input class="input" id="ti" placeholder="위 문장을 그대로 입력!" autocomplete="off"/>
          <button class="btn accent" id="send">완성</button>
        </div>
        <div class="word-log" id="log" style="margin-top:12px"></div>
      </div>`;
      const input = area.querySelector('#ti');
      input.focus();
      const send = () => { if (done) return; const t = input.value; if (!t.trim()) return; api.send('submit', { text: t }); };
      area.querySelector('#send').onclick = send;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
      timer = GUI.countdown(area.querySelector('#bar'), d.durationMs);
    });

    api.on('typing:done', (d) => {
      log(`✅ <b>${GUI.esc(d.name)}</b> ${d.rank}등! ${(d.ms / 1000).toFixed(1)}초 <span class="muted">(+${d.gained})</span>`, 'ok');
      const mine = d.scores && d.name;
      // 내가 완성했는지 여부는 이름 비교 대신 토스트로
      api.refreshScore();
    });
    api.on('typing:wrong', () => api.toast('오타가 있어요! 다시 확인'));
    api.on('typing:reveal', () => { if (timer) timer.stop(); api.refreshScore(); });

    // 내 완성 처리: 서버가 done을 브로드캐스트하므로 내 이름이면 잠금
    api.on('typing:done', (d) => {
      const meName = (api.players().find((p) => p.id === api.me.playerId) || {}).name;
      if (d.name === meName) { done = true; const inp = area.querySelector('#ti'); if (inp) { inp.disabled = true; api.toast(`완성! +${d.gained} 🎉`); } }
    });
  },
};
