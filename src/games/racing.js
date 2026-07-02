'use strict';

const RACES = 3;
const TARGET = 40; // 결승선까지 필요한 탭 수
const COUNTDOWN_MS = 3200;
const MAX_RACE_MS = 30000;
const REVEAL_MS = 4000;
const POINTS = [100, 60, 40, 30, 20, 10, 10, 10];

function clearTimers(gs) {
  ['cdTimer', 'safetyTimer', 'revealTimer'].forEach((k) => { if (gs[k]) clearTimeout(gs[k]); gs[k] = null; });
}

function startRace(ctx) {
  const gs = ctx.room.gameState;
  gs.phase = 'countdown';
  gs.progress = {};
  gs.finishOrder = [];
  ctx.activePlayers().forEach((p) => (gs.progress[p.id] = 0));
  ctx.broadcast('race:countdown', { race: gs.race + 1, total: RACES, target: TARGET });
  gs.cdTimer = setTimeout(() => {
    gs.phase = 'racing';
    ctx.broadcast('race:go', {});
    gs.safetyTimer = setTimeout(() => endRace(ctx), MAX_RACE_MS);
  }, COUNTDOWN_MS);
}

function endRace(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';
  // 완주 못 한 사람은 진행도 순으로 뒤에 배치
  const rest = ctx.activePlayers()
    .filter((p) => !gs.finishOrder.includes(p.id))
    .sort((a, b) => (gs.progress[b.id] || 0) - (gs.progress[a.id] || 0))
    .map((p) => p.id);
  const ranking = [...gs.finishOrder, ...rest];
  const results = ranking.map((pid, i) => {
    const p = ctx.room.players.get(pid);
    const gained = POINTS[Math.min(i, POINTS.length - 1)];
    if (p) p.score += gained;
    return { id: pid, name: p ? p.name : '?', place: i + 1, gained, progress: gs.progress[pid] || 0 };
  });
  ctx.broadcast('race:result', { results, scores: ctx.room.scoreboard() });
  gs.revealTimer = setTimeout(() => {
    gs.race += 1;
    if (gs.race >= RACES) ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
    else startRace(ctx);
  }, REVEAL_MS);
}

module.exports = {
  id: 'racing',
  name: '탭 레이싱',
  emoji: '🏎️',
  minPlayers: 1,

  start(ctx) {
    ctx.room.gameState = { race: 0, phase: 'countdown', progress: {}, finishOrder: [] };
    startRace(ctx);
  },

  onEvent(ctx, player, type) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'racing' || type !== 'tap') return;
    if (gs.finishOrder.includes(player.id)) return;
    gs.progress[player.id] = (gs.progress[player.id] || 0) + 1;
    const count = gs.progress[player.id];
    ctx.broadcast('race:progress', {
      id: player.id,
      count,
      pct: Math.min(100, Math.round((count / TARGET) * 100)),
    });
    if (count >= TARGET) {
      gs.finishOrder.push(player.id);
      ctx.broadcast('race:finish', { id: player.id, name: player.name, place: gs.finishOrder.length });
      if (gs.finishOrder.length >= ctx.activePlayers().length) endRace(ctx);
    }
  },

  onPlayerLeave(ctx) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'racing') return;
    if (gs.finishOrder.length >= ctx.activePlayers().length && ctx.activePlayers().length > 0) endRace(ctx);
  },
};
