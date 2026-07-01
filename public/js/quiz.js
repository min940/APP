// 🎯 퀴즈 배틀 (클라이언트)
const Quiz = (() => {
  let timerRAF = null;
  let picked = false;

  function init(data) {
    G.socket.off("quiz:question").on("quiz:question", onQuestion);
    G.socket.off("quiz:answered").on("quiz:answered", onAnswered);
    G.socket.off("quiz:reveal").on("quiz:reveal", onReveal);
  }

  function onQuestion(q) {
    picked = false;
    document.querySelector("#game-round").textContent = `${q.index + 1} / ${q.total}`;
    const body = document.querySelector("#game-body");
    body.innerHTML = `
      <div class="timer-bar"><div class="timer-fill" id="quiz-timer"></div></div>
      <div class="quiz-question">${escapeHtml(q.question)}</div>
      <div class="quiz-choices" id="quiz-choices"></div>
      <div class="quiz-status" id="quiz-status"></div>`;

    const letters = ["A", "B", "C", "D", "E"];
    const wrap = document.querySelector("#quiz-choices");
    q.choices.forEach((choice, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.dataset.index = i;
      btn.innerHTML = `<span class="choice-letter">${letters[i]}</span><span>${escapeHtml(choice)}</span>`;
      btn.addEventListener("click", () => pick(i, btn));
      wrap.appendChild(btn);
    });

    runTimer(q.timeMs);
  }

  function pick(i, btn) {
    if (picked) return;
    picked = true;
    G.socket.emit("quiz:answer", { choice: i });
    document.querySelectorAll("#quiz-choices .choice-btn").forEach((b) => {
      b.classList.toggle("picked", b === btn);
      b.disabled = true;
    });
    document.querySelector("#quiz-status").textContent = "답을 제출했어요! 다른 가족을 기다리는 중… ⏳";
  }

  function onAnswered({ playerId }) {
    if (playerId === G.me) return;
    const s = document.querySelector("#quiz-status");
    if (s && !picked) s.textContent = `${G.playerName(playerId)}님이 답했어요!`;
  }

  function onReveal(data) {
    stopTimer();
    renderMiniScores(data.scores);
    const q = data; // has answer, gained
    document.querySelectorAll("#quiz-choices .choice-btn").forEach((b) => {
      const idx = Number(b.dataset.index);
      b.disabled = true;
      if (idx === data.answer) b.classList.add("correct");
      else if (b.classList.contains("picked")) b.classList.add("wrong");
    });
    const myGain = data.gained[G.me] || 0;
    const status = document.querySelector("#quiz-status");
    if (status) {
      status.innerHTML = myGain > 0
        ? `<span class="reveal-gain">+${myGain}점!</span> 정답이에요 🎉`
        : `아쉬워요! 정답은 <b>${["A","B","C","D","E"][data.answer]}</b> 였어요.`;
    }
    if (data.explanation) {
      const box = document.createElement("div");
      box.className = "reveal-box";
      box.innerHTML = "💡 " + escapeHtml(data.explanation);
      document.querySelector("#game-body").appendChild(box);
    }
  }

  function runTimer(totalMs) {
    stopTimer();
    const fill = document.querySelector("#quiz-timer");
    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      const ratio = Math.max(0, 1 - elapsed / totalMs);
      if (fill) {
        fill.style.width = ratio * 100 + "%";
        fill.classList.toggle("warn", ratio < 0.35);
      }
      if (ratio > 0) timerRAF = requestAnimationFrame(frame);
    }
    timerRAF = requestAnimationFrame(frame);
  }
  function stopTimer() { if (timerRAF) cancelAnimationFrame(timerRAF); timerRAF = null; }

  return { init };
})();
window.Quiz = Quiz;
