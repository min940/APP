'use strict';
window.GameClients = window.GameClients || {};

window.GameClients.math = {
  mount(area, api) {
    const GUI = api.GUI;
    let picked = null, timer = null;

    api.on('math:question', (d) => {
      picked = null;
      if (timer) timer.stop();
      area.innerHTML = `<div class="fade-in">
        <div class="game-header"><span class="round">${d.round}/${d.total}</span><span class="pill" id="ans">0명</span></div>
        <div class="timer-bar"><div id="bar"></div></div>
        <div class="question">${GUI.esc(d.text)} = ?</div>
        <div class="choices" id="choices"></div>
      </div>`;
      const ch = area.querySelector('#choices');
      d.choices.forEach((c, i) => {
        const btn = GUI.h(`<button class="choice"><span class="idx">${i + 1}</span><span>${c}</span></button>`);
        btn.onclick = () => {
          if (picked != null) return;
          picked = i; btn.classList.add('picked');
          [...ch.children].forEach((x) => (x.disabled = true));
          api.send('answer', { choice: i });
        };
        ch.appendChild(btn);
      });
      timer = GUI.countdown(area.querySelector('#bar'), d.durationMs);
    });

    api.on('math:answered', (d) => { const el = area.querySelector('#ans'); if (el) el.textContent = `${d.answeredCount}/${d.total}명`; });

    api.on('math:reveal', (d) => {
      if (timer) timer.stop();
      area.querySelectorAll('.choice').forEach((c, i) => {
        c.disabled = true;
        if (i === d.answerIdx) c.classList.add('correct');
        else if (i === picked) c.classList.add('wrong');
      });
      const mine = d.results.find((r) => r.id === api.me.playerId);
      if (mine) api.toast(mine.correct ? `정답! +${mine.gained} 🎉` : `땡! 정답은 ${d.answer}`);
      api.refreshScore();
    });
  },
};
