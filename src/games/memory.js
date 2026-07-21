'use strict';

const COLORS = 4;
const MAX_ROUND = 12;
const REVEAL_MS = 3500;

function inputWindow(len) { return len * 900 + 6000; }

function clearTimers(gs) {
  if (gs.inputTimer) clearTimeout(gs.inputTimer);
  if (gs.revealTimer) clearTimeout(gs.revealTimer);
  gs.inputTimer = gs.revealTimer = null;
}

function aliveIds(ctx) {
  const gs = ctx.room.gameState;
  return ctx.activePlayers().filter((p) => gs.alive.has(p.id)).map((p) => p.id);
}

function showRound(ctx) {
  const gs = ctx.room.gameState;
  gs.sequence.push(Math.floor(Math.random() * COLORS));
  gs.inputs = {};
  gs.phase = 'show';
  ctx.broadcast('memory:sequence', { sequence: gs.sequence, round: gs.sequence.length, colors: COLORS });
  // 클라이언트가 시퀀스를 다 보여줄 시간을 준 뒤 입력 단계로
  const showMs = gs.sequence.length * 900 + 800;
  gs.inputTimer = setTimeout(() => {
    gs.phase = 'input';
    ctx.broadcast('memory:input', { length: gs.sequence.length, durationMs: inputWindow(gs.sequence.length) });
    gs.inputTimer = setTimeout(() => evaluate(ctx), inputWindow(gs.sequence.length));
  }, showMs);
}

function evaluate(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';
  const survivors = [];
  const eliminated = [];
  for (const pid of aliveIds(ctx)) {
    const inp = gs.inputs[pid] || [];
    const ok = inp.length === gs.sequence.length && inp.every((v, i) => v === gs.sequence[i]);
    const p = ctx.room.players.get(pid);
    if (ok) {
      if (p) p.score += gs.sequence.length * 10;
      survivors.push({ id: pid, name: p ? p.name : '?' });
    } else {
      gs.alive.delete(pid);
      eliminated.push({ id: pid, name: p ? p.name : '?' });
    }
  }
  ctx.broadcast('memory:reveal', {
    sequence: gs.sequence, survivors, eliminated, scores: ctx.room.scoreboard(),
  });
  gs.revealTimer = setTimeout(() => {
    const alive = aliveIds(ctx);
    if (alive.length <= 1 || gs.sequence.length >= MAX_ROUND) {
      if (alive.length === 1) {
        const w = ctx.room.players.get(alive[0]);
        if (w) w.score += 50; // 최후 생존 보너스
      }
      ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
    } else {
      showRound(ctx);
    }
  }, REVEAL_MS);
}

module.exports = {
  id: 'memory',
  name: '기억력 게임',
  emoji: '🧠',
  minPlayers: 1,

  start(ctx) {
    ctx.room.gameState = {
      sequence: [], inputs: {}, phase: 'show', alive: new Set(ctx.activePlayers().map((p) => p.id)),
    };
    showRound(ctx);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'input' || type !== 'submit') return;
    if (!gs.alive.has(player.id) || gs.inputs[player.id]) return;
    const seq = Array.isArray(data && data.sequence) ? data.sequence.map(Number) : [];
    gs.inputs[player.id] = seq;
    ctx.broadcast('memory:submitted', { count: Object.keys(gs.inputs).length, total: aliveIds(ctx).length });
    if (Object.keys(gs.inputs).length >= aliveIds(ctx).length) evaluate(ctx);
  },
};
