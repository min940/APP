'use strict';

const ROUNDS = 5;
const REVEAL_MS = 4000;
const MAX_WAIT_MS = 6000; // 신호 후 이 시간 지나면 라운드 자동 종료
const POINTS = [100, 70, 50, 40, 30, 20, 10, 10];

function clearTimers(gs) {
  if (gs.signalTimer) clearTimeout(gs.signalTimer);
  if (gs.safetyTimer) clearTimeout(gs.safetyTimer);
  if (gs.revealTimer) clearTimeout(gs.revealTimer);
  gs.signalTimer = gs.safetyTimer = gs.revealTimer = null;
}

function startRound(ctx) {
  const gs = ctx.room.gameState;
  gs.phase = 'waiting';
  gs.taps = {};
  gs.falseStart = new Set();
  gs.signalAt = 0;

  ctx.broadcast('react:ready', {
    round: gs.round + 1,
    total: ROUNDS,
  });

  // 2~6초 사이 무작위 지연 뒤 신호
  const delay = 2000 + Math.floor(nextRandom(gs) * 4000);
  gs.signalTimer = setTimeout(() => sendGo(ctx), delay);
}

// Math.random 대신 라운드마다 조금씩 달라지는 간단한 의사난수
function nextRandom(gs) {
  gs.seed = (gs.seed * 1103515245 + 12345) & 0x7fffffff;
  return gs.seed / 0x7fffffff;
}

function sendGo(ctx) {
  const gs = ctx.room.gameState;
  gs.phase = 'go';
  gs.signalAt = Date.now();
  ctx.broadcast('react:go', {});
  gs.safetyTimer = setTimeout(() => endRound(ctx), MAX_WAIT_MS);
}

function endRound(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';

  // 반응시간 오름차순 정렬, 부정출발/미참여는 뒤로
  const entries = ctx.activePlayers().map((p) => {
    if (gs.falseStart.has(p.id)) return { id: p.id, name: p.name, ms: null, false: true };
    const ms = gs.taps[p.id];
    return { id: p.id, name: p.name, ms: ms == null ? null : ms, false: false };
  });
  entries.sort((a, b) => {
    if (a.ms == null && b.ms == null) return 0;
    if (a.ms == null) return 1;
    if (b.ms == null) return -1;
    return a.ms - b.ms;
  });

  let rank = 0;
  const results = entries.map((e) => {
    let gained = 0;
    if (e.ms != null) {
      gained = POINTS[Math.min(rank, POINTS.length - 1)];
      const p = ctx.room.players.get(e.id);
      if (p) p.score += gained;
      rank++;
    }
    return { ...e, gained };
  });

  ctx.broadcast('react:reveal', {
    results,
    scores: ctx.room.scoreboard(),
  });

  gs.revealTimer = setTimeout(() => {
    gs.round += 1;
    if (gs.round >= ROUNDS) finish(ctx);
    else startRound(ctx);
  }, REVEAL_MS);
}

function finish(ctx) {
  clearTimers(ctx.room.gameState);
  ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
}

module.exports = {
  id: 'reaction',
  name: '반응속도',
  emoji: '⚡',
  minPlayers: 1,

  start(ctx) {
    ctx.room.gameState = {
      round: 0,
      phase: 'waiting',
      taps: {},
      falseStart: new Set(),
      signalAt: 0,
      seed: (ctx.room.code.charCodeAt(0) * 7919 + Date.now()) & 0x7fffffff,
      signalTimer: null,
      safetyTimer: null,
      revealTimer: null,
    };
    startRound(ctx);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || type !== 'tap') return;

    if (gs.phase === 'waiting') {
      // 신호 전에 누름 → 부정출발
      if (!gs.falseStart.has(player.id)) {
        gs.falseStart.add(player.id);
        ctx.broadcast('react:falseStart', { playerId: player.id, name: player.name });
      }
      return;
    }
    if (gs.phase === 'go') {
      if (gs.falseStart.has(player.id) || gs.taps[player.id] != null) return;
      gs.taps[player.id] = Date.now() - gs.signalAt;
      const tapped = Object.keys(gs.taps).length + gs.falseStart.size;
      ctx.broadcast('react:tapped', {
        playerId: player.id,
        count: tapped,
        total: ctx.activePlayers().length,
      });
      if (tapped >= ctx.activePlayers().length) endRound(ctx);
    }
  },
};
