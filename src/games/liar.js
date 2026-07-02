'use strict';

const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'liar.json'), 'utf8'));

const HINT_MS = 25000;
const VOTE_MS = 30000;

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function clearTimers(gs) {
  if (gs.turnTimer) clearTimeout(gs.turnTimer);
  if (gs.voteTimer) clearTimeout(gs.voteTimer);
  gs.turnTimer = gs.voteTimer = null;
}

function nextHint(ctx) {
  const gs = ctx.room.gameState;
  if (gs.turnTimer) clearTimeout(gs.turnTimer);
  // 다음 순서(접속 중) 찾기
  while (gs.hintIndex < gs.order.length) {
    const pid = gs.order[gs.hintIndex];
    const p = ctx.room.players.get(pid);
    if (p && p.connected) break;
    gs.hintIndex += 1;
  }
  if (gs.hintIndex >= gs.order.length) return startVote(ctx);
  const currentId = gs.order[gs.hintIndex];
  ctx.broadcast('liar:hintTurn', {
    currentId,
    currentName: ctx.room.players.get(currentId).name,
    hints: gs.hints,
  });
  gs.turnTimer = setTimeout(() => {
    gs.hints.push({ name: ctx.room.players.get(currentId).name, text: '(시간 초과)' });
    ctx.broadcast('liar:hint', { name: ctx.room.players.get(currentId).name, text: '(시간 초과)' });
    gs.hintIndex += 1;
    nextHint(ctx);
  }, HINT_MS);
}

function startVote(ctx) {
  const gs = ctx.room.gameState;
  clearTimers(gs);
  gs.phase = 'voting';
  gs.votes = {};
  ctx.broadcast('liar:vote', {
    players: ctx.activePlayers().map((p) => ({ id: p.id, name: p.name })),
    durationMs: VOTE_MS,
    hints: gs.hints,
  });
  gs.voteTimer = setTimeout(() => reveal(ctx), VOTE_MS);
}

function reveal(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';
  // 득표 집계
  const tally = {};
  for (const target of Object.values(gs.votes)) tally[target] = (tally[target] || 0) + 1;
  let top = -1, topId = null, tie = false;
  for (const [pid, n] of Object.entries(tally)) {
    if (n > top) { top = n; topId = pid; tie = false; }
    else if (n === top) tie = true;
  }
  const caught = !tie && topId === gs.liarId;
  if (caught) {
    for (const [voter, target] of Object.entries(gs.votes)) {
      if (target === gs.liarId) { const p = ctx.room.players.get(voter); if (p) p.score += 100; }
    }
  } else {
    const liar = ctx.room.players.get(gs.liarId);
    if (liar) liar.score += 150; // 라이어 생존 보너스
  }
  const liar = ctx.room.players.get(gs.liarId);
  ctx.broadcast('liar:reveal', {
    liarId: gs.liarId,
    liarName: liar ? liar.name : '?',
    word: gs.word,
    category: gs.category,
    caught,
    tally,
    scores: ctx.room.scoreboard(),
  });
  setTimeout(() => ctx.endGame({ winner: ctx.room.scoreboard()[0] || null }), 6000);
}

module.exports = {
  id: 'liar',
  name: '라이어 게임',
  emoji: '🕵️',
  minPlayers: 3,

  start(ctx) {
    const players = ctx.activePlayers();
    const cat = pick(DATA);
    const word = pick(cat.words);
    const liar = pick(players);
    ctx.room.gameState = {
      word, category: cat.category, liarId: liar.id,
      order: players.map((p) => p.id),
      hintIndex: 0, hints: [], votes: {}, phase: 'hint',
      turnTimer: null, voteTimer: null,
    };
    // 각자에게 역할 비공개 전달
    for (const p of players) {
      if (p.id === liar.id) ctx.toPlayer(p.id, 'liar:role', { liar: true, category: cat.category });
      else ctx.toPlayer(p.id, 'liar:role', { liar: false, category: cat.category, word });
    }
    ctx.broadcast('liar:start', { category: cat.category, order: players.map((p) => p.name) });
    setTimeout(() => nextHint(ctx), 2500);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs) return;
    if (type === 'hint' && gs.phase === 'hint') {
      if (gs.order[gs.hintIndex] !== player.id) return;
      const text = String((data && data.text) || '').trim().slice(0, 20) || '(패스)';
      gs.hints.push({ name: player.name, text });
      ctx.broadcast('liar:hint', { name: player.name, text });
      gs.hintIndex += 1;
      nextHint(ctx);
    } else if (type === 'vote' && gs.phase === 'voting') {
      const target = String((data && data.targetId) || '');
      if (!ctx.room.players.has(target)) return;
      gs.votes[player.id] = target;
      ctx.broadcast('liar:voteTally', { count: Object.keys(gs.votes).length, total: ctx.activePlayers().length });
      if (Object.keys(gs.votes).length >= ctx.activePlayers().length) reveal(ctx);
    }
  },

  onPlayerLeave(ctx, playerId) {
    const gs = ctx.room.gameState;
    if (!gs) return;
    if (gs.phase === 'hint' && gs.order[gs.hintIndex] === playerId) {
      gs.hintIndex += 1;
      nextHint(ctx);
    }
  },
};
