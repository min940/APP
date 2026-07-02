'use strict';
window.GameClients = window.GameClients || {};

window.GameClients.vote = {
  mount(area, api) {
    const GUI = api.GUI;
    let picked = null, timer = null;

    api.on('vote:question', (d) => {
      picked = null;
      if (timer) timer.stop();
      area.innerHTML = `<div class="fade-in">
        <div class="game-header"><span class="round">${d.round}/${d.total}</span><span class="pill" id="tally">0명</span></div>
        <div class="timer-bar"><div id="bar"></div></div>
        <div class="center muted" style="margin:14px 0">다수파를 고르면 +100점!</div>
        <button class="choice" id="a" style="justify-content:center;font-size:1.3rem;padding:26px">${GUI.esc(d.a)}</button>
        <div class="center" style="font-weight:800;margin:10px 0">VS</div>
        <button class="choice" id="b" style="justify-content:center;font-size:1.3rem;padding:26px">${GUI.esc(d.b)}</button>
      </div>`;
      const pick = (i, el) => {
        if (picked != null) return;
        picked = i; el.classList.add('picked');
        area.querySelector('#a').disabled = true; area.querySelector('#b').disabled = true;
        api.send('vote', { choice: i });
      };
      area.querySelector('#a').onclick = (e) => pick(0, e.currentTarget);
      area.querySelector('#b').onclick = (e) => pick(1, e.currentTarget);
      timer = GUI.countdown(area.querySelector('#bar'), d.durationMs);
    });

    api.on('vote:tally', (d) => { const el = area.querySelector('#tally'); if (el) el.textContent = `${d.count}/${d.total}명`; });

    api.on('vote:reveal', (d) => {
      if (timer) timer.stop();
      const total = d.counts[0] + d.counts[1] || 1;
      const win = d.majority;
      area.innerHTML = `<div class="fade-in">
        <div class="center muted">${d.majority === -1 ? '동점! 모두 +100' : '다수파 +100점'}</div>
        <div style="margin:16px 0">
          <div class="rank-row ${win === 0 ? '' : ''}" style="${win === 0 ? 'border:2px solid var(--accent)' : ''}"><span class="nm">${GUI.esc(d.a)}</span><span class="sc">${d.counts[0]}명</span></div>
          <div class="timer-bar" style="margin:6px 0 14px"><div style="width:${Math.round(d.counts[0] / total * 100)}%;background:var(--accent)"></div></div>
          <div class="rank-row" style="${win === 1 ? 'border:2px solid var(--accent)' : ''}"><span class="nm">${GUI.esc(d.b)}</span><span class="sc">${d.counts[1]}명</span></div>
          <div class="timer-bar" style="margin:6px 0"><div style="width:${Math.round(d.counts[1] / total * 100)}%;background:var(--primary)"></div></div>
        </div>
        <div class="word-log">${d.picks.map((p) => `<div class="line">${GUI.esc(p.name)} → ${p.choice === 0 ? GUI.esc(d.a) : GUI.esc(d.b)}</div>`).join('')}</div>
      </div>`;
      api.refreshScore();
    });
  },
};
