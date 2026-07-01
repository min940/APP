// 🎨 그림 맞히기 (클라이언트)
const Draw = (() => {
  const W = 600, H = 440; // 캔버스 내부 해상도 (좌표는 0~1로 정규화해 전송)
  let canvas, ctx;
  let isDrawer = false;
  let drawing = false;
  let last = null;
  let color = "#3a3247";
  let size = 6;
  let timerRAF = null;

  const COLORS = ["#3a3247", "#f5678e", "#6ab7ff", "#2bbd8e", "#ffd166", "#ff8c42", "#9b7ede", "#ffffff"];

  function init(data) {
    G.socket.off("draw:round").on("draw:round", onRound);
    G.socket.off("draw:word").on("draw:word", onWord);
    G.socket.off("draw:stroke").on("draw:stroke", onStroke);
    G.socket.off("draw:clear").on("draw:clear", clearCanvas);
    G.socket.off("draw:correct").on("draw:correct", onCorrect);
    G.socket.off("draw:roundEnd").on("draw:roundEnd", onRoundEnd);

    document.querySelector("#chat-panel").classList.remove("hidden");
    document.querySelector("#game-body").innerHTML = `
      <div class="draw-role" id="draw-role">라운드 준비 중…</div>
      <div class="draw-word-hint" id="draw-hint"></div>
      <div class="timer-bar"><div class="timer-fill" id="draw-timer"></div></div>
      <div class="canvas-box"><canvas id="draw-canvas" width="${W}" height="${H}"></canvas></div>
      <div class="draw-tools" id="draw-tools"></div>`;

    canvas = document.querySelector("#draw-canvas");
    ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    clearCanvas();
    setupPointer();
  }

  function onRound(r) {
    isDrawer = r.drawerId === G.me;
    drawing = false;
    document.querySelector("#game-round").textContent = `${r.round} / ${r.total}`;
    clearCanvas();

    const role = document.querySelector("#draw-role");
    role.classList.toggle("drawer", isDrawer);
    role.textContent = isDrawer
      ? "✏️ 당신이 그릴 차례! 아래 단어를 그려주세요"
      : `🔍 ${r.drawerName}님이 그리는 중… 채팅으로 정답을 맞혀보세요!`;

    // 힌트: 글자 수만큼 ○
    document.querySelector("#draw-hint").textContent = isDrawer ? "" : "○ ".repeat(r.wordLength).trim();
    document.querySelector("#chat-input").placeholder = isDrawer ? "그리는 사람은 채팅으로 힌트 금지! 🤫" : "정답을 입력해 보세요!";

    renderTools();
    runTimer(r.timeMs);
  }

  function onWord({ word }) {
    // 출제자에게만 옴
    document.querySelector("#draw-hint").textContent = "제시어: " + word;
  }

  // ── 그리기 입력 ──────────────────────────────────────────
  function setupPointer() {
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      return { x: (cx / rect.width), y: (cy / rect.height) }; // 0~1 정규화
    };
    const down = (e) => {
      if (!isDrawer) return;
      e.preventDefault();
      drawing = true;
      last = getPos(e);
    };
    const move = (e) => {
      if (!isDrawer || !drawing) return;
      e.preventDefault();
      const p = getPos(e);
      const stroke = { x0: last.x, y0: last.y, x1: p.x, y1: p.y, c: color, s: size };
      drawSeg(stroke);
      G.socket.emit("draw:stroke", stroke);
      last = p;
    };
    const up = () => { drawing = false; };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
  }

  function drawSeg(s) {
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.s * (s.c === "#ffffff" ? 3 : 1); // 흰색은 지우개처럼 굵게
    ctx.beginPath();
    ctx.moveTo(s.x0 * W, s.y0 * H);
    ctx.lineTo(s.x1 * W, s.y1 * H);
    ctx.stroke();
  }
  function onStroke(s) { drawSeg(s); }

  function clearCanvas() {
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  }

  // ── 도구(출제자만) ───────────────────────────────────────
  function renderTools() {
    const tools = document.querySelector("#draw-tools");
    tools.innerHTML = "";
    if (!isDrawer) { tools.style.display = "none"; return; }
    tools.style.display = "flex";
    COLORS.forEach((c) => {
      const sw = document.createElement("button");
      sw.className = "color-swatch" + (c === color ? " active" : "");
      sw.style.background = c;
      if (c === "#ffffff") sw.title = "지우개";
      sw.addEventListener("click", () => {
        color = c;
        document.querySelectorAll("#draw-tools .color-swatch").forEach((x) => x.classList.remove("active"));
        sw.classList.add("active");
      });
      tools.appendChild(sw);
    });
    const clearBtn = document.createElement("button");
    clearBtn.className = "btn btn-ghost btn-sm tool-btn";
    clearBtn.textContent = "🗑 지우기";
    clearBtn.addEventListener("click", () => { clearCanvas(); G.socket.emit("draw:clear"); });
    tools.appendChild(clearBtn);
  }

  function onCorrect(d) {
    renderMiniScores(d.scores);
    addChat({ text: `🎉 ${d.nickname}님 정답! (${d.order}번째)`, cls: "correct" });
  }

  function onRoundEnd(d) {
    stopTimer();
    renderMiniScores(d.scores);
    addChat({ text: `정답은 "${d.word}" 였어요! (${d.reason})`, cls: "system" });
  }

  function runTimer(totalMs) {
    stopTimer();
    const fill = document.querySelector("#draw-timer");
    const start = performance.now();
    function frame(now) {
      const ratio = Math.max(0, 1 - (now - start) / totalMs);
      if (fill) { fill.style.width = ratio * 100 + "%"; fill.classList.toggle("warn", ratio < 0.3); }
      if (ratio > 0) timerRAF = requestAnimationFrame(frame);
    }
    timerRAF = requestAnimationFrame(frame);
  }
  function stopTimer() { if (timerRAF) cancelAnimationFrame(timerRAF); timerRAF = null; }

  return { init };
})();
window.Draw = Draw;
