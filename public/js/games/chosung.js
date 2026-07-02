'use strict';
window.GameClients = window.GameClients || {};

window.GameClients.chosung = {
  mount(area, api) {
    const GUI = api.GUI;
    let timer = null, solved = false;

    function log(html, cls) {
      const box = area.querySelector('#log');
      if (box) { box.appendChild(GUI.h(`<div class="line ${cls || ''}">${html}</div>`)); box.scrollTop = box.scrollHeight; }
    }

    api.on('chosung:question', (d) => {
      if (timer) timer.stop();
      solved = false;
      area.innerHTML = `<div class="fade-in">
        <div class="game-header"><span class="round">${d.round}/${d.total}</span></div>
        <div class="timer-bar"><div id="bar"></div></div>
        <div class="lastword"><span class="hi">${GUI.esc(d.chosung)}</span></div>
        <div class="center muted">힌트: ${GUI.esc(d.hint)} · ${d.length}글자</div>
        <div class="chat-input-row" style="margin-top:14px">
          <input class="input" id="guess" maxlength="20" placeholder="정답 입력!" autocomplete="off"/>
          <button class="btn accent" id="send">전송</button>
        </div>
        <div class="word-log" id="log" style="margin-top:12px"></div>
      </div>`;
      const input = area.querySelector('#guess');
      input.focus();
      const send = () => { const t = input.value.trim(); if (!t) return; api.send('guess', { text: t }); input.value = ''; };
      area.querySelector('#send').onclick = send;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
      timer = GUI.countdown(area.querySelector('#bar'), d.durationMs);
    });

    api.on('chosung:correct', (d) => {
      log(`🎉 <b>${GUI.esc(d.name)}</b> 정답! (+${d.gained})`, 'ok');
      api.refreshScore();
    });
    api.on('chosung:wrong', () => { if (!solved) api.toast('땡! 다시 도전'); });
    api.on('chosung:reveal', (d) => {
      if (timer) timer.stop();
      log(`— 정답: <b style="color:var(--accent)">${GUI.esc(d.word)}</b> —`);
      api.refreshScore();
    });
  },
};
