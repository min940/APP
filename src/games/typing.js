'use strict';

const fs = require('fs');
const path = require('path');

const SENTENCES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'typing.json'), 'utf8'));

const ROUNDS = 6;
const ROUND_MS = 25000;
const REVEAL_MS = 3000;

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

function clearTimers(gs) {
  if (gs.roundTimer) clearTimeout(gs.roundTimer);
  if (gs.revealTimer) clearTimeout(gs.revealTimer);
  gs.roundTimer = gs.revealTimer = null;
}

function startRound(ctx) {
  const gs = ctx.room.gameState;
  gs.sentence = gs.items[gs.round];
  gs.done = new Set();
  gs.roundStart = Date.now();
  gs.phase = 'typing';
  ctx.broadcast('typing:round', {
    round: gs.round + 1, total: gs.items.length, sentence: gs.sentence, durationMs: ROUND_MS,
  });
  gs.roundTimer = setTimeout(() => reveal(ctx), ROUND_MS);
}

function reveal(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';
  ctx.broadcast('typing:reveal', { scores: ctx.room.scoreboard() });
  gs.revealTimer = setTimeout(() => {
    gs.round += 1;
    if (gs.round >= gs.items.length) ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
    else startRound(ctx);
  }, REVEAL_MS);
}

module.exports = {
  id: 'typing',
  name: '스피드 타이핑',
  emoji: '⌨️',
  minPlayers: 1,

  start(ctx) {
    ctx.room.gameState = {
      items: shuffle(SENTENCES).slice(0, Math.min(ROUNDS, SENTENCES.length)),
      round: 0, sentence: '', done: new Set(), phase: 'typing', roundStart: 0,
    };
    startRound(ctx);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'typing' || type !== 'submit') return;
    if (gs.done.has(player.id)) return;
    if (norm(data && data.text) !== norm(gs.sentence)) {
      return ctx.toPlayer(player.id, 'typing:wrong', {});
    }
    gs.done.add(player.id);
    const ms = Date.now() - gs.roundStart;
    const rank = gs.done.size; // 몇 번째로 완성했는지
    const gained = Math.max(40, 130 - (rank - 1) * 25); // 빠른 순으로 점수 차등
    player.score += gained;
    ctx.broadcast('typing:done', { name: player.name, gained, ms, rank, scores: ctx.room.scoreboard() });
    if (gs.done.size >= ctx.activePlayers().length) reveal(ctx);
  },

  onPlayerLeave(ctx) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'typing') return;
    if (gs.done.size >= ctx.activePlayers().length && ctx.activePlayers().length > 0) reveal(ctx);
  },
};
