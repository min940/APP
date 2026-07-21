'use strict';
window.GameClients = window.GameClients || {};

const PAD_COLORS = ['#e74c3c', '#2ecc71', '#3498db', '#f1c40f'];

window.GameClients.memory = {
  mount(area, api) {
    const GUI = api.GUI;
    let seqLen = 0, myInput = [], accepting = false, timer = null;

    function renderPads(round) {
      area.innerHTML = `<div class="fade-in">
        <div class="game-header"><span class="round">${round}단계</span><span class="pill" id="st">잘 보세요…</span></div>
        <div class="timer-bar"><div id="bar" style="width:0"></div></div>
        <div class="mem-grid">${PAD_COLORS.map((c, i) => `<button class="mem-pad" data-i="${i}" style="background:${c}"></button>`).join('')}</div>
        <div class="center muted" id="cnt" style="margin-top:10px"></div>
      </div>`;
      area.querySelectorAll('.mem-pad').forEach((pad) => {
        pad.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (!accepting) return;
          const i = Number(pad.dataset.i);
          flash(i);
          myInput.push(i);
          area.querySelector('#cnt').textContent = `${myInput.length} / ${seqLen}`;
          if (myInput.length >= seqLen) {
            accepting = false;
            api.send('submit', { sequence: myInput });
            area.querySelector('#st').textContent = '제출 완료!';
          }
        });
      });
    }

    function flash(i) {
      const pad = area.querySelector(`.mem-pad[data-i="${i}"]`);
      if (!pad) return;
      pad.classList.add('lit');
      setTimeout(() => pad.classList.remove('lit'), 380);
    }

    api.on('memory:sequence', (d) => {
      seqLen = d.sequence.length; myInput = []; accepting = false;
      renderPads(d.round);
      // 시퀀스 순서대로 반짝임 재생
      d.sequence.forEach((c, idx) => setTimeout(() => flash(c), 600 + idx * 900));
    });

    api.on('memory:input', (d) => {
      seqLen = d.length; myInput = []; accepting = true;
      const st = area.querySelector('#st'); if (st) st.textContent = '이제 순서대로 눌러요!';
      area.querySelector('#cnt').textContent = `0 / ${seqLen}`;
      if (timer) timer.stop();
      timer = GUI.countdown(area.querySelector('#bar'), d.durationMs);
      area.querySelector('#bar').style.width = '100%';
    });

    api.on('memory:submitted', (d) => { const st = area.querySelector('#st'); if (st && accepting) st.textContent = `${d.count}/${d.total}명 완료`; });

    api.on('memory:reveal', (d) => {
      accepting = false;
      if (timer) timer.stop();
      const meElim = d.eliminated.find((x) => x.id === api.me.playerId);
      const meSurv = d.survivors.find((x) => x.id === api.me.playerId);
      if (meElim) api.toast('아쉽게 탈락했어요 😢');
      else if (meSurv) api.toast('통과! 다음 단계로 🎉');
      const st = area.querySelector('#st');
      if (st) st.textContent = d.eliminated.length ? `탈락: ${d.eliminated.map((x) => x.name).join(', ')}` : '전원 통과!';
      api.refreshScore();
    });

    api.onUnmount(() => { if (timer) timer.stop(); });
  },
};
