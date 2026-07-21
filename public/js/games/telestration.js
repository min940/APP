'use strict';
window.GameClients = window.GameClients || {};

const TW = 360, TH = 270;

window.GameClients.telestration = {
  mount(area, api) {
    const GUI = api.GUI;
    let timer = null, stepDur = 45000;
    let ctx = null, drawing = false, last = null, submitted = false;

    function showWaiting(msg) {
      area.innerHTML = `<div class="fade-in center" style="padding-top:20px">
        <div class="big-emoji">✏️</div><div class="muted">${GUI.esc(msg)}</div>
        <div class="pill" id="prog" style="margin-top:14px"></div></div>`;
    }

    api.on('telestr:start', () => showWaiting('시작 준비 중… 각자 제시어를 그림으로 이어가요!'));

    api.on('telestr:step', (d) => {
      if (timer) timer.stop();
      submitted = false;
      stepDur = d.durationMs || 45000;
    });

    api.on('telestr:task', (d) => {
      submitted = false;
      if (d.mode === 'draw') {
        const phrase = d.prev && d.prev.type === 'phrase' ? d.prev.data : (d.prev && d.prev.data) || '???';
        area.innerHTML = `<div class="fade-in">
          <div class="game-header"><span>🎨 이걸 그려요</span><span class="pill" id="prog"></span></div>
          <div class="timer-bar"><div id="bar"></div></div>
          <div class="word-hint" style="letter-spacing:0">${GUI.esc(phrase)}</div>
          <div class="canvas-wrap"><canvas id="tc" width="${TW}" height="${TH}"></canvas></div>
          <div class="draw-tools" id="tools"></div>
          <button class="btn accent" id="submit">✅ 다 그렸어요</button>
        </div>`;
        setupCanvas();
        area.querySelector('#submit').onclick = () => {
          if (submitted) return; submitted = true;
          const data = area.querySelector('#tc').toDataURL('image/png');
          api.send('submit', { data });
          showWaiting('제출 완료! 다른 사람 기다리는 중…');
        };
      } else {
        const img = d.prev && d.prev.data;
        area.innerHTML = `<div class="fade-in">
          <div class="game-header"><span>❓ 무슨 그림일까요?</span><span class="pill" id="prog"></span></div>
          <div class="timer-bar"><div id="bar"></div></div>
          <div class="canvas-wrap" style="min-height:${TH}px;display:grid;place-items:center">
            ${img ? `<img src="${img}" style="width:100%;display:block"/>` : '<span class="muted" style="color:#999">(그림 없음)</span>'}
          </div>
          <div class="chat-input-row" style="margin-top:12px">
            <input class="input" id="guess" maxlength="30" placeholder="정답을 한 마디로!" autocomplete="off"/>
            <button class="btn accent" id="submit">제출</button>
          </div>
        </div>`;
        const input = area.querySelector('#guess'); input.focus();
        const send = () => { if (submitted) return; const t = input.value.trim(); if (!t) return; submitted = true; api.send('submit', { data: t }); showWaiting('제출 완료! 다른 사람 기다리는 중…'); };
        area.querySelector('#submit').onclick = send;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
      }
      if (area.querySelector('#bar')) timer = GUI.countdown(area.querySelector('#bar'), stepDur);
    });

    api.on('telestr:submitted', (d) => { const el = area.querySelector('#prog'); if (el) el.textContent = `${d.count}/${d.total}명 제출`; });

    api.on('telestr:reveal', (d) => {
      if (timer) timer.stop();
      let html = '<div class="fade-in"><div class="winner">✨ 결과 발표! ✨</div>';
      d.books.forEach((bk) => {
        html += `<div class="card"><div class="pill">📖 ${GUI.esc(bk.ownerName)}의 책</div>`;
        html += `<div class="tel-chain">`;
        html += `<div class="tel-item"><span class="muted">시작 제시어</span><div class="tel-phrase">${GUI.esc(bk.seed)}</div></div>`;
        bk.entries.forEach((e) => {
          if (e.type === 'drawing') {
            html += `<div class="tel-item"><span class="muted">${GUI.esc(e.byName)}의 그림</span>${e.data ? `<img src="${e.data}" class="tel-img"/>` : '<div class="muted">(그림 없음)</div>'}</div>`;
          } else {
            html += `<div class="tel-item"><span class="muted">${GUI.esc(e.byName)}의 추측</span><div class="tel-phrase">${GUI.esc(e.data)}</div></div>`;
          }
        });
        html += `</div></div>`;
      });
      html += '</div>';
      area.innerHTML = html;
      api.refreshScore();
    });

    function setupCanvas() {
      const canvas = area.querySelector('#tc');
      ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, TW, TH);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
      let color = '#111';
      ['#111', '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#ffd23f'].forEach((c, i) => {
        const sw = GUI.h(`<div class="swatch ${i === 0 ? 'active' : ''}" style="background:${c}"></div>`);
        sw.onclick = () => { color = c; ctx.strokeStyle = c; area.querySelectorAll('#tools .swatch').forEach((s) => s.classList.remove('active')); sw.classList.add('active'); };
        area.querySelector('#tools').appendChild(sw);
      });
      const clr = GUI.h(`<button class="btn small ghost">🧽 지우기</button>`);
      clr.onclick = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, TW, TH); ctx.strokeStyle = color; };
      area.querySelector('#tools').appendChild(clr);

      function pos(e) {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: (t.clientX - r.left) / r.width * TW, y: (t.clientY - r.top) / r.height * TH };
      }
      const start = (e) => { e.preventDefault(); drawing = true; last = pos(e); };
      const move = (e) => { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; };
      const end = () => { drawing = false; };
      canvas.addEventListener('pointerdown', start);
      canvas.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      api.onUnmount(() => window.removeEventListener('pointerup', end));
    }

    api.onUnmount(() => { if (timer) timer.stop(); });
  },
};
