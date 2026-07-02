'use strict';

window.GameClients = window.GameClients || {};

window.GameClients.quiz = {
  mount(area, api) {
    const GUI = api.GUI;
    let picked = null;
    let timer = null;

    api.on('quiz:question', (d) => {
      picked = null;
      if (timer) timer.stop();
      area.innerHTML = '';
      const view = GUI.h(`<div class="fade-in">
        <div class="game-header">
          <span class="round">${d.round} / ${d.total}</span>
          <span class="pill" id="answered">0명 답변</span>
        </div>
        <div class="timer-bar"><div id="bar"></div></div>
        <div class="question">${GUI.esc(d.q)}</div>
        <div class="choices" id="choices"></div>
      </div>`);
      area.appendChild(view);

      const choicesEl = view.querySelector('#choices');
      d.choices.forEach((c, i) => {
        const btn = GUI.h(`<button class="choice"><span class="idx">${i + 1}</span><span>${GUI.esc(c)}</span></button>`);
        btn.onclick = () => {
          if (picked != null) return;
          picked = i;
          btn.classList.add('picked');
          [...choicesEl.children].forEach((c2) => (c2.disabled = true));
          api.send('answer', { choice: i });
          api.toast('제출 완료! 결과를 기다려요');
        };
        choicesEl.appendChild(btn);
      });

      timer = GUI.countdown(view.querySelector('#bar'), d.durationMs);
    });

    api.on('quiz:answered', (d) => {
      const el = document.getElementById('answered');
      if (el) el.textContent = `${d.answeredCount} / ${d.total}명 답변`;
    });

    api.on('quiz:reveal', (d) => {
      if (timer) timer.stop();
      const choices = area.querySelectorAll('.choice');
      choices.forEach((c, i) => {
        c.disabled = true;
        if (i === d.answer) c.classList.add('correct');
        else if (i === picked) c.classList.add('wrong');
      });
      const mine = d.results.find((r) => r.id === api.me.playerId);
      if (mine) {
        api.toast(mine.correct ? `정답! +${mine.gained}점 🎉` : '아쉬워요! 다음 문제 화이팅');
      } else if (picked == null) {
        api.toast('시간 초과! 다음 문제 준비');
      }
      api.refreshScore();
    });
  },
};

// 가족 퀴즈는 같은 화면/이벤트를 사용한다.
window.GameClients.familyquiz = window.GameClients.quiz;
