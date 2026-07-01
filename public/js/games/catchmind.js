'use strict';

window.GameClients = window.GameClients || {};

const CANVAS_W = 800;
const CANVAS_H = 560;
const COLORS = ['#111111', '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#ffd23f', '#911eb4', '#ffffff'];

window.GameClients.catchmind = {
  mount(area, api) {
    const GUI = api.GUI;
    let amDrawer = false;
    let secretWord = '';
    let timer = null;
    let ctx = null;
    let drawing = false;
    let last = null;
    let curColor = COLORS[0];
    let curSize = 6;

    function draw(seg) {
      if (!ctx) return;
      ctx.strokeStyle = seg.c;
      ctx.lineWidth = seg.s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(seg.x0 * CANVAS_W, seg.y0 * CANVAS_H);
      ctx.lineTo(seg.x1 * CANVAS_W, seg.y1 * CANVAS_H);
      ctx.stroke();
    }

    function clearCanvas() {
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    function addChat(html, cls) {
      const box = area.querySelector('#chatbox');
      if (!box) return;
      box.appendChild(GUI.h(`<div class="line ${cls || ''}">${html}</div>`));
      box.scrollTop = box.scrollHeight;
    }

    api.on('catch:newRound', (d) => {
      if (timer) timer.stop();
      amDrawer = d.drawerId === api.me.playerId;
      secretWord = '';

      area.innerHTML = '';
      const view = GUI.h(`<div class="fade-in">
        <div class="game-header">
          <span class="round">${d.round} / ${d.total}판</span>
          <span>${amDrawer ? '✏️ 내가 그릴 차례!' : GUI.esc(d.drawerName) + ' 님이 그리는 중'}</span>
        </div>
        <div class="timer-bar"><div id="bar"></div></div>
        <div class="word-hint" id="hint"></div>
        <div class="canvas-wrap"><canvas id="board" width="${CANVAS_W}" height="${CANVAS_H}"></canvas></div>
        <div id="controls"></div>
        <div class="chatbox" id="chatbox"></div>
      </div>`);
      area.appendChild(view);

      const canvas = view.querySelector('#board');
      ctx = canvas.getContext('2d');
      clearCanvas();

      const hint = view.querySelector('#hint');
      const controls = view.querySelector('#controls');

      if (amDrawer) {
        hint.textContent = '단어 준비 중…';
        // 색상 + 굵기 + 지우기 도구
        const tools = GUI.h(`<div class="draw-tools" id="tools"></div>`);
        COLORS.forEach((c) => {
          const sw = GUI.h(`<div class="swatch ${c === curColor ? 'active' : ''}" style="background:${c}"></div>`);
          sw.onclick = () => {
            curColor = c;
            tools.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
            sw.classList.add('active');
          };
          tools.appendChild(sw);
        });
        controls.appendChild(tools);
        const btnRow = GUI.h(`<div class="draw-tools"></div>`);
        [['가늘게', 4], ['보통', 10], ['굵게', 20]].forEach(([label, sz]) => {
          const b = GUI.h(`<button class="btn small ghost">${label}</button>`);
          b.onclick = () => { curSize = sz; api.toast(`${label} 선택`); };
          btnRow.appendChild(b);
        });
        const clr = GUI.h(`<button class="btn small ghost">🧽 전체 지우기</button>`);
        clr.onclick = () => { clearCanvas(); api.send('clear', {}); };
        btnRow.appendChild(clr);
        controls.appendChild(btnRow);

        enableDrawing(canvas);
      } else {
        hint.textContent = '_ '.repeat(d.wordLength).trim();
        // 정답 추측 입력
        const guessRow = GUI.h(`<div class="chat-input-row" style="margin-top:10px">
          <input class="input" id="guessInput" maxlength="20" placeholder="정답을 입력해요!" />
          <button class="btn" id="guessBtn">전송</button>
        </div>`);
        controls.appendChild(guessRow);
        const input = guessRow.querySelector('#guessInput');
        const sendGuess = () => {
          const text = input.value.trim();
          if (!text) return;
          api.send('guess', { text });
          input.value = '';
        };
        guessRow.querySelector('#guessBtn').onclick = sendGuess;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendGuess(); });
      }

      timer = GUI.countdown(view.querySelector('#bar'), d.durationMs);
    });

    api.on('catch:yourWord', (d) => {
      secretWord = d.word;
      const hint = area.querySelector('#hint');
      if (hint) hint.innerHTML = `제시어: <span style="color:var(--good)">${GUI.esc(d.word)}</span>`;
    });

    api.on('catch:draw', (seg) => { if (!amDrawer) draw(seg); });
    api.on('catch:clear', () => { if (!amDrawer) clearCanvas(); });

    api.on('catch:chat', (d) => {
      addChat(`<b>${GUI.esc(d.name)}</b> : ${GUI.esc(d.text)}`);
    });

    api.on('catch:correct', (d) => {
      addChat(`🎉 <b>${GUI.esc(d.name)}</b> 정답! (+${d.gained})`, 'ok');
      if (d.playerId === api.me.playerId) api.toast(`정답이에요! +${d.gained}점 🎉`);
      api.refreshScore();
    });

    api.on('catch:reveal', (d) => {
      if (timer) timer.stop();
      const hint = area.querySelector('#hint');
      if (hint) hint.innerHTML = `정답: <span style="color:var(--accent)">${GUI.esc(d.word)}</span>`;
      const msg = {
        allSolved: '모두 맞혔어요!',
        time: '시간 종료!',
        drawerLeft: '그림 그리던 사람이 나갔어요',
      }[d.reason] || '다음 차례로!';
      addChat(`— ${msg} —`);
      api.refreshScore();
    });

    // ── 드로잉 입력 처리 (그림꾼만) ──
    function enableDrawing(canvas) {
      function pos(e) {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return {
          x: Math.min(1, Math.max(0, (t.clientX - r.left) / r.width)),
          y: Math.min(1, Math.max(0, (t.clientY - r.top) / r.height)),
        };
      }
      const start = (e) => { e.preventDefault(); drawing = true; last = pos(e); };
      const move = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const p = pos(e);
        const seg = { x0: last.x, y0: last.y, x1: p.x, y1: p.y, c: curColor, s: curSize };
        draw(seg);
        api.send('draw', seg);
        last = p;
      };
      const end = () => { drawing = false; };
      canvas.addEventListener('pointerdown', start);
      canvas.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      api.onUnmount(() => window.removeEventListener('pointerup', end));
    }

    api.onUnmount(() => { if (timer) timer.stop(); });
  },
};
