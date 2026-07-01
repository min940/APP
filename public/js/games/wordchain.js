'use strict';

window.GameClients = window.GameClients || {};

window.GameClients.wordchain = {
  mount(area, api) {
    const GUI = api.GUI;
    let timer = null;
    let myTurn = false;

    area.innerHTML = `<div class="fade-in">
      <div class="timer-bar"><div id="bar"></div></div>
      <div class="turn-banner" id="turn">시작 준비 중…</div>
      <div class="lastword" id="lastword">🔤</div>
      <div id="controls"></div>
      <div class="word-log" id="log"></div>
    </div>`;

    const bar = area.querySelector('#bar');
    const turnEl = area.querySelector('#turn');
    const lastEl = area.querySelector('#lastword');
    const controls = area.querySelector('#controls');
    const log = area.querySelector('#log');

    function nameOf(pid) {
      const p = api.players().find((x) => x.id === pid);
      return p ? p.name : '?';
    }
    function heartStr(n) { return '❤️'.repeat(Math.max(0, n)); }
    function addLog(html) {
      log.appendChild(GUI.h(`<div class="line">${html}</div>`));
      log.scrollTop = log.scrollHeight;
    }

    api.on('word:turn', (d) => {
      if (timer) timer.stop();
      myTurn = d.currentId === api.me.playerId;

      // 남은 목숨 요약
      const alive = d.alive.map((pid) => `${GUI.esc(nameOf(pid))} ${heartStr(d.lives[pid])}`).join('   ');

      if (d.lastWord) {
        const w = d.lastWord;
        lastEl.innerHTML = `${GUI.esc(w.slice(0, -1))}<span class="hi">${GUI.esc(w.slice(-1))}</span>`;
      } else {
        lastEl.innerHTML = '<span class="muted" style="font-size:1.2rem">아무 단어나 시작하세요!</span>';
      }

      turnEl.className = 'turn-banner' + (myTurn ? ' mine' : '');
      turnEl.innerHTML = myTurn
        ? `👉 내 차례! ${d.lastWord ? `'<span class="hi">${GUI.esc(d.lastWord.slice(-1))}</span>'(으)로 시작` : ''}`
        : `${GUI.esc(d.currentName)} 님 차례`;

      controls.innerHTML = '';
      if (myTurn) {
        const row = GUI.h(`<div class="chat-input-row">
          <input class="input" id="wordInput" maxlength="20" placeholder="단어를 입력!" autocomplete="off" />
          <button class="btn accent" id="wordBtn">제출</button>
        </div>`);
        controls.appendChild(row);
        const input = row.querySelector('#wordInput');
        input.focus();
        const submit = () => {
          const word = input.value.trim();
          if (!word) return;
          api.send('word', { word });
        };
        row.querySelector('#wordBtn').onclick = submit;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      } else {
        controls.appendChild(GUI.h(`<div class="center muted" style="padding:6px">${GUI.esc(alive)}</div>`));
      }

      timer = GUI.countdown(bar, d.durationMs);
    });

    api.on('word:accepted', (d) => {
      addLog(`✅ <b>${GUI.esc(d.name)}</b> : ${GUI.esc(d.word)} <span class="muted">(+10)</span>`);
      api.refreshScore();
    });

    api.on('word:rejected', (d) => {
      api.toast('❌ ' + d.reason);
    });

    api.on('word:timeout', (d) => {
      if (d.eliminated) addLog(`💀 <b>${GUI.esc(d.name)}</b> 탈락!`);
      else addLog(`⏰ <b>${GUI.esc(d.name)}</b> 시간 초과 (${heartStr(d.lives[d.playerId])})`);
      if (d.playerId === api.me.playerId) {
        api.toast(d.eliminated ? '아쉽게 탈락했어요' : '시간 초과! 조심하세요');
      }
    });

    api.onUnmount(() => { if (timer) timer.stop(); });
  },
};
