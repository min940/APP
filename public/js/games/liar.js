'use strict';
window.GameClients = window.GameClients || {};

window.GameClients.liar = {
  mount(area, api) {
    const GUI = api.GUI;
    let role = null; // {liar, category, word}
    let timer = null;

    function roleCard() {
      if (!role) return '';
      return role.liar
        ? `<div class="card" style="border:3px solid var(--bad);text-align:center">
             <div class="big-emoji">🤫</div><b>당신은 라이어!</b><br/>
             <span class="muted">주제: ${GUI.esc(role.category)} · 제시어를 모릅니다.<br/>티 안 나게 아는 척하세요!</span></div>`
        : `<div class="card" style="border:3px solid var(--good);text-align:center">
             <div class="muted">주제: ${GUI.esc(role.category)}</div>
             <div style="font-size:1.8rem;font-weight:900;color:var(--good);margin:6px 0">${GUI.esc(role.word)}</div>
             <span class="muted">이 단어를 아는 척! 라이어를 찾아내세요</span></div>`;
    }

    api.on('liar:role', (d) => { role = d; });

    api.on('liar:start', (d) => {
      area.innerHTML = `<div class="fade-in">${roleCard()}
        <div class="center muted">한 명씩 제시어에 대한 <b>한 단어 힌트</b>를 말해요</div>
        <div class="word-log" id="log" style="margin-top:12px"></div>
        <div id="ctrl"></div>
      </div>`;
    });

    api.on('liar:hintTurn', (d) => {
      const mine = d.currentId === api.me.playerId;
      const ctrl = area.querySelector('#ctrl');
      if (!ctrl) return;
      if (mine) {
        ctrl.innerHTML = `<div class="chat-input-row" style="margin-top:12px">
          <input class="input" id="hint" maxlength="20" placeholder="한 단어 힌트!" autocomplete="off"/>
          <button class="btn accent" id="send">말하기</button></div>`;
        const input = ctrl.querySelector('#hint'); input.focus();
        const send = () => { const t = input.value.trim(); if (!t) return; api.send('hint', { text: t }); input.value = ''; };
        ctrl.querySelector('#send').onclick = send;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
      } else {
        ctrl.innerHTML = `<div class="turn-banner">🗣️ ${GUI.esc(d.currentName)} 님이 힌트 말하는 중…</div>`;
      }
    });

    api.on('liar:hint', (d) => {
      const box = area.querySelector('#log');
      if (box) { box.appendChild(GUI.h(`<div class="line">💬 <b>${GUI.esc(d.name)}</b>: ${GUI.esc(d.text)}</div>`)); box.scrollTop = box.scrollHeight; }
    });

    api.on('liar:vote', (d) => {
      if (timer) timer.stop();
      area.innerHTML = `<div class="fade-in">
        <div class="turn-banner mine">🕵️ 누가 라이어일까요?</div>
        <div class="timer-bar"><div id="bar"></div></div>
        <div class="word-log" style="margin:10px 0">${d.hints.map((h) => `<div class="line">💬 <b>${GUI.esc(h.name)}</b>: ${GUI.esc(h.text)}</div>`).join('')}</div>
        <div id="votes"></div>
        <div class="center muted" id="vtally"></div>
      </div>`;
      const wrap = area.querySelector('#votes');
      let voted = false;
      d.players.forEach((p) => {
        if (p.id === api.me.playerId) return;
        const btn = GUI.h(`<button class="btn ghost">👉 ${GUI.esc(p.name)}</button>`);
        btn.onclick = () => {
          if (voted) return; voted = true;
          api.send('vote', { targetId: p.id });
          wrap.querySelectorAll('button').forEach((b) => (b.disabled = true));
          btn.classList.remove('ghost'); btn.classList.add('accent');
        };
        wrap.appendChild(btn);
      });
      timer = GUI.countdown(area.querySelector('#bar'), d.durationMs);
    });

    api.on('liar:voteTally', (d) => { const el = area.querySelector('#vtally'); if (el) el.textContent = `${d.count}/${d.total}명 투표`; });

    api.on('liar:reveal', (d) => {
      if (timer) timer.stop();
      area.innerHTML = `<div class="fade-in center">
        <div class="big-emoji">${d.caught ? '🎉' : '😈'}</div>
        <div class="winner">라이어는 <span style="color:var(--bad)">${GUI.esc(d.liarName)}</span>!</div>
        <div style="margin:8px 0">제시어: <b style="color:var(--accent)">${GUI.esc(d.word)}</b> (${GUI.esc(d.category)})</div>
        <div class="card">${d.caught ? '✅ 라이어를 잡았어요!' : '❌ 라이어가 살아남았어요!'}</div>
      </div>`;
      api.refreshScore();
    });

    api.onUnmount(() => { if (timer) timer.stop(); });
  },
};
