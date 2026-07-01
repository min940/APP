'use strict';

const fs = require('fs');
const path = require('path');

const WORDS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'draw-words.json'), 'utf8')
);

const ROUND_MS = 75000; // 한 사람이 그리는 시간
const REVEAL_MS = 4000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearTimers(gs) {
  if (gs.roundTimer) clearTimeout(gs.roundTimer);
  if (gs.revealTimer) clearTimeout(gs.revealTimer);
  gs.roundTimer = null;
  gs.revealTimer = null;
}

function startRound(ctx) {
  const gs = ctx.room.gameState;
  // 접속 중인 다음 차례 그림꾼 찾기
  let drawer = null;
  while (gs.turnIndex < gs.order.length) {
    const pid = gs.order[gs.turnIndex];
    const p = ctx.room.players.get(pid);
    if (p && p.connected) { drawer = p; break; }
    gs.turnIndex += 1;
  }
  if (!drawer) return finish(ctx);

  gs.drawerId = drawer.id;
  gs.word = gs.words[gs.turnIndex % gs.words.length];
  gs.solved = new Set();
  gs.roundStart = Date.now();
  gs.phase = 'drawing';

  const guessers = ctx.activePlayers().filter((p) => p.id !== drawer.id).length;
  gs.needed = guessers;

  ctx.broadcast('catch:newRound', {
    round: gs.turnIndex + 1,
    total: gs.order.length,
    drawerId: drawer.id,
    drawerName: drawer.name,
    wordLength: gs.word.length,
    durationMs: ROUND_MS,
  });
  // 그림꾼에게만 정답 단어 전달
  ctx.toPlayer(drawer.id, 'catch:yourWord', { word: gs.word });

  gs.roundTimer = setTimeout(() => revealRound(ctx, 'time'), ROUND_MS);
}

function revealRound(ctx, reason) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';
  ctx.broadcast('catch:reveal', {
    word: gs.word,
    reason,
    scores: ctx.room.scoreboard(),
  });
  gs.revealTimer = setTimeout(() => {
    gs.turnIndex += 1;
    if (gs.turnIndex >= gs.order.length) finish(ctx);
    else startRound(ctx);
  }, REVEAL_MS);
}

function finish(ctx) {
  clearTimers(ctx.room.gameState);
  const scores = ctx.room.scoreboard();
  ctx.endGame({ winner: scores[0] || null });
}

function normalize(s) {
  return String(s || '').replace(/\s+/g, '').trim();
}

module.exports = {
  id: 'catchmind',
  name: '캐치마인드',
  emoji: '🎨',
  minPlayers: 2,

  start(ctx) {
    const order = ctx.activePlayers().map((p) => p.id);
    ctx.room.gameState = {
      words: shuffle(WORDS),
      order,
      turnIndex: 0,
      drawerId: null,
      word: '',
      solved: new Set(),
      needed: 0,
      phase: 'drawing',
      roundStart: 0,
      roundTimer: null,
      revealTimer: null,
    };
    startRound(ctx);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'drawing') return;

    // 그림꾼의 그리기 데이터 → 나머지에게 중계
    if (type === 'draw' && player.id === gs.drawerId) {
      ctx.broadcast('catch:draw', data);
      return;
    }
    if (type === 'clear' && player.id === gs.drawerId) {
      ctx.broadcast('catch:clear', {});
      return;
    }

    // 정답 추측 (그림꾼은 불가, 이미 맞힌 사람도 불가)
    if (type === 'guess') {
      if (player.id === gs.drawerId) return;
      const text = normalize(data && data.text);
      if (!text) return;
      const isCorrect = !gs.solved.has(player.id) && text === normalize(gs.word);

      if (isCorrect) {
        gs.solved.add(player.id);
        const elapsed = Date.now() - gs.roundStart;
        const speedBonus = Math.max(0, Math.round((1 - elapsed / ROUND_MS) * 60));
        const gained = 100 + speedBonus;
        player.score += gained;
        // 그림꾼도 맞힌 사람마다 보상
        const drawer = ctx.room.players.get(gs.drawerId);
        if (drawer) drawer.score += 40;

        ctx.broadcast('catch:correct', {
          playerId: player.id,
          name: player.name,
          gained,
          scores: ctx.room.scoreboard(),
        });

        // 모두 맞히면 라운드 종료
        if (gs.solved.size >= gs.needed && gs.needed > 0) {
          revealRound(ctx, 'allSolved');
        }
      } else {
        // 오답은 채팅처럼 모두에게 보여줌
        ctx.broadcast('catch:chat', { name: player.name, text });
      }
    }
  },

  onPlayerLeave(ctx, playerId) {
    const gs = ctx.room.gameState;
    if (!gs) return;
    // 그림 그리던 사람이 나가면 라운드 넘김
    if (gs.phase === 'drawing' && playerId === gs.drawerId) {
      revealRound(ctx, 'drawerLeft');
    }
  },
};
