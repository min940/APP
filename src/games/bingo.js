'use strict';

const SIZE = 5;
const N = SIZE * SIZE; // 1~25
const TARGET_LINES = 3;
const DRAW_MS = 2600; // 숫자 뽑는 간격

// 5x5 카드에서 완성된 줄(가로/세로/대각) 수 세기
function countLines(card, marks) {
  const on = (r, c) => marks.has(r * SIZE + c);
  let lines = 0;
  for (let r = 0; r < SIZE; r++) { let all = true; for (let c = 0; c < SIZE; c++) if (!on(r, c)) all = false; if (all) lines++; }
  for (let c = 0; c < SIZE; c++) { let all = true; for (let r = 0; r < SIZE; r++) if (!on(r, c)) all = false; if (all) lines++; }
  let d1 = true, d2 = true;
  for (let i = 0; i < SIZE; i++) { if (!on(i, i)) d1 = false; if (!on(i, SIZE - 1 - i)) d2 = false; }
  if (d1) lines++; if (d2) lines++;
  return lines;
}

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

function clearTimers(gs) { if (gs.drawTimer) clearTimeout(gs.drawTimer); gs.drawTimer = null; }

function drawNext(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase !== 'playing') return;
  if (gs.drawIndex >= gs.drawSeq.length) {
    // 다 뽑았는데 승자 없음 → 줄 많은 순으로 종료
    return finish(ctx, null);
  }
  const number = gs.drawSeq[gs.drawIndex++];
  gs.drawn.add(number);
  ctx.broadcast('bingo:draw', { number, remaining: gs.drawSeq.length - gs.drawIndex });
  gs.drawTimer = setTimeout(() => drawNext(ctx), DRAW_MS);
}

function finish(ctx, winnerId) {
  const gs = ctx.room.gameState;
  clearTimers(gs);
  gs.phase = 'done';
  if (winnerId) {
    const w = ctx.room.players.get(winnerId);
    if (w) w.score += 100;
  }
  // 참가자 모두 줄 수만큼 보너스
  for (const p of ctx.activePlayers()) {
    const lines = countLines(gs.cards[p.id], gs.marks[p.id] || new Set());
    p.score += lines * 20;
  }
  ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
}

module.exports = {
  id: 'bingo',
  name: '빙고',
  emoji: '🅱️',
  minPlayers: 2,

  start(ctx) {
    const cards = {};
    const marks = {};
    for (const p of ctx.activePlayers()) {
      cards[p.id] = shuffle(Array.from({ length: N }, (_, i) => i + 1));
      marks[p.id] = new Set();
    }
    ctx.room.gameState = {
      phase: 'playing', cards, marks, drawn: new Set(),
      drawSeq: shuffle(Array.from({ length: N }, (_, i) => i + 1)), drawIndex: 0, drawTimer: null,
    };
    // 각자에게 자기 카드 전달
    for (const p of ctx.activePlayers()) ctx.toPlayer(p.id, 'bingo:card', { card: cards[p.id], size: SIZE, target: TARGET_LINES });
    ctx.broadcast('bingo:start', { size: SIZE, target: TARGET_LINES });
    const gs = ctx.room.gameState;
    gs.drawTimer = setTimeout(() => drawNext(ctx), 1500);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'playing' || type !== 'mark') return;
    const cell = Number(data && data.cell);
    const card = gs.cards[player.id];
    if (!card || cell < 0 || cell >= N) return;
    const number = card[cell];
    if (!gs.drawn.has(number)) return; // 아직 안 뽑힌 숫자
    gs.marks[player.id].add(cell);
    const lines = countLines(card, gs.marks[player.id]);
    ctx.toPlayer(player.id, 'bingo:marked', { cell, lines });
    if (lines >= TARGET_LINES) {
      ctx.broadcast('bingo:winner', { id: player.id, name: player.name, lines });
      finish(ctx, player.id);
    }
  },
};
