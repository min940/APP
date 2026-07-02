'use strict';

const fs = require('fs');
const path = require('path');

const QUESTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'vote.json'), 'utf8'));

const ROUNDS = 10;
const ROUND_MS = 12000;
const REVEAL_MS = 4500;

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

function clearTimers(gs) {
  if (gs.roundTimer) clearTimeout(gs.roundTimer);
  if (gs.revealTimer) clearTimeout(gs.revealTimer);
  gs.roundTimer = gs.revealTimer = null;
}

function startRound(ctx) {
  const gs = ctx.room.gameState;
  const q = gs.items[gs.round];
  gs.votes = {};
  gs.phase = 'voting';
  ctx.broadcast('vote:question', {
    round: gs.round + 1,
    total: gs.items.length,
    a: q.a,
    b: q.b,
    durationMs: ROUND_MS,
  });
  gs.roundTimer = setTimeout(() => reveal(ctx), ROUND_MS);
}

function reveal(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';
  const q = gs.items[gs.round];
  const picks = [];
  let nA = 0, nB = 0;
  for (const [pid, choice] of Object.entries(gs.votes)) {
    const p = ctx.room.players.get(pid);
    if (!p) continue;
    if (choice === 0) nA++; else nB++;
    picks.push({ name: p.name, choice });
  }
  // 다수파(더 많은 쪽)를 고른 사람에게 점수 — "우리 가족 취향 맞히기"
  const majority = nA === nB ? -1 : nA > nB ? 0 : 1;
  for (const [pid, choice] of Object.entries(gs.votes)) {
    const p = ctx.room.players.get(pid);
    if (p && (majority === -1 || choice === majority)) p.score += 100;
  }
  ctx.broadcast('vote:reveal', {
    a: q.a, b: q.b, counts: [nA, nB], majority, picks, scores: ctx.room.scoreboard(),
  });
  gs.revealTimer = setTimeout(() => {
    gs.round += 1;
    if (gs.round >= gs.items.length) ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
    else startRound(ctx);
  }, REVEAL_MS);
}

module.exports = {
  id: 'vote',
  name: '밸런스 게임',
  emoji: '⭕',
  minPlayers: 1,

  start(ctx) {
    ctx.room.gameState = {
      items: shuffle(QUESTIONS).slice(0, Math.min(ROUNDS, QUESTIONS.length)),
      round: 0, votes: {}, phase: 'voting',
    };
    startRound(ctx);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'voting' || type !== 'vote') return;
    const choice = Number(data && data.choice);
    if (choice !== 0 && choice !== 1) return;
    gs.votes[player.id] = choice;
    ctx.broadcast('vote:tally', { count: Object.keys(gs.votes).length, total: ctx.activePlayers().length });
    if (Object.keys(gs.votes).length >= ctx.activePlayers().length) reveal(ctx);
  },

  onPlayerLeave(ctx) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'voting') return;
    if (Object.keys(gs.votes).length >= ctx.activePlayers().length && ctx.activePlayers().length > 0) reveal(ctx);
  },
};
