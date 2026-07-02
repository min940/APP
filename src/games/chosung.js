'use strict';

const fs = require('fs');
const path = require('path');

const WORDS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'chosung.json'), 'utf8'));

const ROUNDS = 8;
const ROUND_MS = 20000;
const REVEAL_MS = 3000;

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 단어의 초성만 뽑아낸다. 예: "가수" → "ㄱㅅ"
function toChosung(word) {
  let out = '';
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) out += CHO[Math.floor(code / 588)];
    else out += ch;
  }
  return out;
}

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
function norm(s) { return String(s || '').replace(/\s+/g, '').trim(); }

function clearTimers(gs) {
  if (gs.roundTimer) clearTimeout(gs.roundTimer);
  if (gs.revealTimer) clearTimeout(gs.revealTimer);
  gs.roundTimer = gs.revealTimer = null;
}

function startRound(ctx) {
  const gs = ctx.room.gameState;
  const item = gs.items[gs.round];
  gs.word = item.word;
  gs.solved = new Set();
  gs.roundStart = Date.now();
  gs.phase = 'question';
  ctx.broadcast('chosung:question', {
    round: gs.round + 1,
    total: gs.items.length,
    chosung: toChosung(item.word),
    hint: item.hint || '',
    length: item.word.length,
    durationMs: ROUND_MS,
  });
  gs.roundTimer = setTimeout(() => reveal(ctx), ROUND_MS);
}

function reveal(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';
  ctx.broadcast('chosung:reveal', { word: gs.word, scores: ctx.room.scoreboard() });
  gs.revealTimer = setTimeout(() => {
    gs.round += 1;
    if (gs.round >= gs.items.length) ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
    else startRound(ctx);
  }, REVEAL_MS);
}

module.exports = {
  id: 'chosung',
  name: '초성 퀴즈',
  emoji: '🔠',
  minPlayers: 1,

  start(ctx) {
    ctx.room.gameState = {
      items: shuffle(WORDS).slice(0, Math.min(ROUNDS, WORDS.length)),
      round: 0,
      word: '',
      solved: new Set(),
      phase: 'question',
      roundStart: 0,
    };
    startRound(ctx);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'question' || type !== 'guess') return;
    if (gs.solved.has(player.id)) return;
    const text = norm(data && data.text);
    if (!text) return;
    if (text === norm(gs.word)) {
      gs.solved.add(player.id);
      const bonus = Math.max(0, Math.round((1 - (Date.now() - gs.roundStart) / ROUND_MS) * 60));
      const gained = 100 + bonus;
      player.score += gained;
      ctx.broadcast('chosung:correct', { name: player.name, gained, scores: ctx.room.scoreboard() });
      if (gs.solved.size >= ctx.activePlayers().length) reveal(ctx);
    } else {
      ctx.toPlayer(player.id, 'chosung:wrong', {});
    }
  },
};
