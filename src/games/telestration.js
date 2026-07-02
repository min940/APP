'use strict';

const fs = require('fs');
const path = require('path');

const SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'simple-words.json'), 'utf8'));

const DRAW_MS = 60000;
const GUESS_MS = 35000;

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

// step s(1-based)에서 order 위치 j인 플레이어가 맡는 책 번호
function bookFor(j, step, P) { return (((j - (step - 1)) % P) + P) % P; }

function clearTimer(gs) { if (gs.stepTimer) clearTimeout(gs.stepTimer); gs.stepTimer = null; }

function broadcastTasks(ctx) {
  const gs = ctx.room.gameState;
  const P = gs.order.length;
  const mode = gs.step % 2 === 1 ? 'draw' : 'guess';
  gs.stepSubs = {};
  ctx.broadcast('telestr:step', {
    step: gs.step, totalSteps: P, mode,
    durationMs: mode === 'draw' ? DRAW_MS : GUESS_MS,
  });
  gs.order.forEach((pid, j) => {
    const p = ctx.room.players.get(pid);
    if (!p || !p.connected) return;
    const b = bookFor(j, gs.step, P);
    const book = gs.books[b];
    const prev = gs.step === 1
      ? { type: 'phrase', data: book.seed }
      : book.entries[book.entries.length - 1];
    ctx.toPlayer(pid, 'telestr:task', { mode, prev });
  });
  const dur = mode === 'draw' ? DRAW_MS : GUESS_MS;
  gs.stepTimer = setTimeout(() => advance(ctx), dur);
}

function advance(ctx) {
  const gs = ctx.room.gameState;
  clearTimer(gs);
  const P = gs.order.length;
  const mode = gs.step % 2 === 1 ? 'drawing' : 'guess';
  // 이번 단계 결과를 각 책에 한 칸씩 채운다 (미제출은 빈칸)
  for (let b = 0; b < P; b++) {
    const entry = gs.stepSubs[b] || { type: mode, byName: '(미제출)', data: mode === 'drawing' ? null : '(못 씀)' };
    gs.books[b].entries.push(entry);
  }
  gs.step += 1;
  if (gs.step > P) return reveal(ctx);
  broadcastTasks(ctx);
}

function reveal(ctx) {
  const gs = ctx.room.gameState;
  clearTimer(gs);
  gs.phase = 'reveal';
  const books = gs.books.map((bk) => ({
    seed: bk.seed,
    ownerName: bk.ownerName,
    entries: bk.entries,
  }));
  ctx.broadcast('telestr:reveal', { books, scores: ctx.room.scoreboard() });
  setTimeout(() => ctx.endGame({ winner: ctx.room.scoreboard()[0] || null }), 1000);
}

module.exports = {
  id: 'telestration',
  name: '텔레스트레이션',
  emoji: '✏️',
  minPlayers: 2,

  start(ctx) {
    const players = ctx.activePlayers();
    const seeds = shuffle(SEEDS);
    const books = players.map((p, i) => ({
      ownerName: p.name,
      seed: seeds[i % seeds.length],
      entries: [],
    }));
    ctx.room.gameState = {
      order: players.map((p) => p.id),
      books,
      step: 1,
      stepSubs: {},
      phase: 'play',
      stepTimer: null,
    };
    ctx.broadcast('telestr:start', { players: players.length });
    setTimeout(() => broadcastTasks(ctx), 1500);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'play' || type !== 'submit') return;
    const P = gs.order.length;
    const j = gs.order.indexOf(player.id);
    if (j < 0) return;
    const b = bookFor(j, gs.step, P);
    if (gs.stepSubs[b]) return; // 이미 제출
    const mode = gs.step % 2 === 1 ? 'drawing' : 'guess';
    let value = data && data.data;
    if (mode === 'drawing') {
      if (typeof value !== 'string' || !value.startsWith('data:image') || value.length > 400000) value = null;
    } else {
      value = String(value || '').trim().slice(0, 30) || '(패스)';
    }
    gs.stepSubs[b] = { type: mode, byName: player.name, data: value };
    player.score += 30; // 참여 점수
    const expected = gs.order.filter((pid) => {
      const p = ctx.room.players.get(pid);
      return p && p.connected;
    }).length;
    ctx.broadcast('telestr:submitted', { count: Object.keys(gs.stepSubs).length, total: expected });
    if (Object.keys(gs.stepSubs).length >= expected) advance(ctx);
  },
};
