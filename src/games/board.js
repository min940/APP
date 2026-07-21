'use strict';

const GOAL = 30;
const TURN_MS = 20000;
const MOVE_REVEAL_MS = 2200;
// 특수 칸: 도착하면 이동. (사다리 +, 미끄럼 -)
const SPECIALS = { 5: 3, 9: -3, 14: 4, 19: -5, 23: 3, 27: -4 };

function clearTimers(gs) {
  if (gs.turnTimer) clearTimeout(gs.turnTimer);
  if (gs.moveTimer) clearTimeout(gs.moveTimer);
  gs.turnTimer = gs.moveTimer = null;
}

function nextTurn(ctx) {
  const gs = ctx.room.gameState;
  clearTimers(gs);
  const active = ctx.activePlayers();
  if (active.length === 0) return ctx.endGame({ winner: null });
  let guard = 0;
  do {
    gs.turnPos = (gs.turnPos + 1) % gs.order.length;
    guard++;
  } while (guard <= gs.order.length && !active.some((p) => p.id === gs.order[gs.turnPos]));
  const currentId = gs.order[gs.turnPos];
  gs.phase = 'turn';
  ctx.broadcast('board:turn', {
    currentId,
    currentName: ctx.room.players.get(currentId).name,
    positions: gs.positions,
    goal: GOAL,
    specials: SPECIALS,
  });
  gs.turnTimer = setTimeout(() => doRoll(ctx, currentId), TURN_MS);
}

function doRoll(ctx, playerId) {
  const gs = ctx.room.gameState;
  if (gs.phase !== 'turn' || gs.order[gs.turnPos] !== playerId) return;
  clearTimers(gs);
  gs.phase = 'moving';
  const dice = Math.floor(Math.random() * 6) + 1;
  const from = gs.positions[playerId] || 0;
  let to = Math.min(GOAL, from + dice);
  let special = 0;
  if (SPECIALS[to] != null && to < GOAL) {
    special = SPECIALS[to];
    to = Math.max(0, Math.min(GOAL, to + special));
  }
  gs.positions[playerId] = to;
  ctx.broadcast('board:move', {
    id: playerId, name: ctx.room.players.get(playerId).name,
    dice, from, to, special, positions: gs.positions,
  });
  if (to >= GOAL) {
    const winner = ctx.room.players.get(playerId);
    if (winner) winner.score += 100;
    // 나머지는 위치만큼 점수
    for (const pid of gs.order) {
      if (pid === playerId) continue;
      const p = ctx.room.players.get(pid);
      if (p) p.score += (gs.positions[pid] || 0) * 2;
    }
    gs.moveTimer = setTimeout(() => ctx.endGame({ winner: ctx.room.scoreboard()[0] || null }), MOVE_REVEAL_MS);
  } else {
    gs.moveTimer = setTimeout(() => nextTurn(ctx), MOVE_REVEAL_MS);
  }
}

module.exports = {
  id: 'board',
  name: '주사위 보드',
  emoji: '🎲',
  minPlayers: 2,

  start(ctx) {
    const positions = {};
    const order = ctx.activePlayers().map((p) => p.id);
    order.forEach((pid) => (positions[pid] = 0));
    ctx.room.gameState = { order, positions, turnPos: -1, phase: 'turn', turnTimer: null, moveTimer: null };
    nextTurn(ctx);
  },

  onEvent(ctx, player, type) {
    const gs = ctx.room.gameState;
    if (!gs || type !== 'roll') return;
    doRoll(ctx, player.id);
  },

  onPlayerLeave(ctx, playerId) {
    const gs = ctx.room.gameState;
    if (!gs) return;
    if (gs.phase === 'turn' && gs.order[gs.turnPos] === playerId) nextTurn(ctx);
  },
};
