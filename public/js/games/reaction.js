'use strict';

window.GameClients = window.GameClients || {};

window.GameClients.reaction = {
  mount(area, api) {
    const GUI = api.GUI;
    let phase = 'idle'; // idle | wait | go | done
    let goAt = 0;

    area.innerHTML = `<div class="fade-in">
      <div class="game-header"><span class="round" id="round">준비</span><span class="pill" id="status"></span></div>
      <div class="react-pad idle" id="pad">잠깐 기다려요…</div>
      <div class="word-log" id="log" style="max-height:120px"></div>
    </div>`;

    const pad = area.querySelector('#pad');
    const roundEl = area.querySelector('#round');
    const statusEl = area.querySelector('#status');
    const log = area.querySelector('#log');

    function addLog(html) {
      log.appendChild(GUI.h(`<div class="line">${html}</div>`));
      log.scrollTop = log.scrollHeight;
    }

    function setPad(state, text) {
      pad.className = 'react-pad ' + state;
      pad.textContent = text;
    }

    api.on('react:ready', (d) => {
      phase = 'wait';
      roundEl.textContent = `${d.round} / ${d.total}판`;
      statusEl.textContent = '';
      setPad('wait', '초록색이 되면 누르세요! (아직!)');
    });

    api.on('react:go', () => {
      phase = 'go';
      goAt = Date.now();
      setPad('go', '지금 눌러요! 👆');
    });

    api.on('react:tapped', (d) => {
      statusEl.textContent = `${d.count} / ${d.total}명 완료`;
    });

    api.on('react:falseStart', (d) => {
      if (d.playerId === api.me.playerId) {
        setPad('wait', '너무 빨랐어요! 이번 판은 꽝 😅');
        api.toast('부정출발! 신호를 기다려요');
      }
      addLog(`⚠️ <b>${GUI.esc(d.name)}</b> 부정출발`);
    });

    api.on('react:reveal', (d) => {
      phase = 'done';
      const medals = ['🥇', '🥈', '🥉'];
      let i = 0;
      const lines = d.results.map((r) => {
        if (r.false) return `❌ <b>${GUI.esc(r.name)}</b> 부정출발`;
        if (r.ms == null) return `💤 <b>${GUI.esc(r.name)}</b> 못 눌렀어요`;
        const m = medals[i++] || '•';
        return `${m} <b>${GUI.esc(r.name)}</b> ${r.ms}ms <span class="muted">(+${r.gained})</span>`;
      });
      addLog('— 결과 —<br/>' + lines.join('<br/>'));
      const mine = d.results.find((r) => r.id === api.me.playerId);
      if (mine && mine.ms != null) setPad('idle', `${mine.ms}ms! 다음 판 준비…`);
      else setPad('idle', '다음 판 준비…');
      api.refreshScore();
    });

    // 패드 누르기
    const onTap = (e) => {
      e.preventDefault();
      if (phase === 'wait' || phase === 'go') api.send('tap', {});
    };
    pad.addEventListener('pointerdown', onTap);

    api.onUnmount(() => pad.removeEventListener('pointerdown', onTap));
  },
};
