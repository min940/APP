'use strict';

const GAME_MS = 25000; // 전체 게임 시간
const UP_MS = 900; // 두더지가 올라와 있는 시간
const GAP_MS = 350; // 다음 두더지까지 간격
const CELLS = 9; // 3x3

function clearTimers(gs) {
  ['moleTimer', 'downTimer', 'endTimer'].forEach((k) => { if (gs[k]) clearTimeout(gs[k]); gs[k] = null; });
}

function spawn(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase !== 'playing') return;
  gs.moleId += 1;
  // 직전과 다른 칸 선택
  let cell;
  do { cell = Math.floor(Math.random() * CELLS); } while (cell === gs.currentCell && CELLS > 1);
  gs.currentCell = cell;
  gs.upUntil = Date.now() + UP_MS;
  ctx.broadcast('mole:up', { cell, id: gs.moleId, upMs: UP_MS });
  gs.downTimer = setTimeout(() => {
    ctx.broadcast('mole:down', { id: gs.moleId });
    gs.currentCell = -1;
    gs.moleTimer = setTimeout(() => spawn(ctx), GAP_MS);
  }, UP_MS);
}

module.exports = {
  id: 'mole',
  name: '두더지 잡기',
  emoji: '🎯',
  minPlayers: 1,

  start(ctx) {
    ctx.room.gameState = { phase: 'playing', moleId: 0, currentCell: -1, upUntil: 0, hitKeys: new Set() };
    const gs = ctx.room.gameState;
    ctx.broadcast('mole:start', { durationMs: GAME_MS, cells: CELLS });
    gs.moleTimer = setTimeout(() => spawn(ctx), 1000);
    gs.endTimer = setTimeout(() => {
      clearTimers(gs);
      gs.phase = 'done';
      ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
    }, GAME_MS);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'playing' || type !== 'whack') return;
    const cell = Number(data && data.cell);
    const id = Number(data && data.id);
    if (id !== gs.moleId || cell !== gs.currentCell || Date.now() > gs.upUntil) return;
    const key = `${player.id}:${id}`;
    if (gs.hitKeys.has(key)) return; // 같은 두더지 중복 방지
    gs.hitKeys.add(key);
    player.score += 10;
    ctx.broadcast('mole:hit', { id: player.id, name: player.name, cell, scores: ctx.room.scoreboard() });
  },
};
