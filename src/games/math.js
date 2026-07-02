'use strict';

const ROUNDS = 8;
const ROUND_MS = 12000;
const REVEAL_MS = 2800;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 사칙연산 문제 하나 생성 (초등 5학년도 풀 수 있는 범위)
function makeProblem() {
  const ops = ['+', '-', '×'];
  const op = ops[randInt(0, 2)];
  let a, b, answer;
  if (op === '+') { a = randInt(10, 89); b = randInt(10, 89); answer = a + b; }
  else if (op === '-') { a = randInt(20, 99); b = randInt(1, a); answer = a - b; }
  else { a = randInt(2, 12); b = randInt(2, 12); answer = a * b; }
  const text = `${a} ${op} ${b}`;

  // 정답 + 그럴듯한 오답 3개
  const set = new Set([answer]);
  while (set.size < 4) {
    const delta = randInt(1, 9) * (Math.random() < 0.5 ? -1 : 1);
    const cand = answer + delta;
    if (cand >= 0) set.add(cand);
  }
  const choices = [...set].sort(() => Math.random() - 0.5);
  return { text, answer, answerIdx: choices.indexOf(answer), choices };
}

function clearTimers(gs) {
  if (gs.roundTimer) clearTimeout(gs.roundTimer);
  if (gs.revealTimer) clearTimeout(gs.revealTimer);
  gs.roundTimer = gs.revealTimer = null;
}

function startRound(ctx) {
  const gs = ctx.room.gameState;
  gs.problem = makeProblem();
  gs.answers = {};
  gs.roundStart = Date.now();
  gs.phase = 'question';
  ctx.broadcast('math:question', {
    round: gs.round + 1,
    total: ROUNDS,
    text: gs.problem.text,
    choices: gs.problem.choices,
    durationMs: ROUND_MS,
  });
  gs.roundTimer = setTimeout(() => reveal(ctx), ROUND_MS);
}

function reveal(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';
  const results = [];
  for (const [pid, ans] of Object.entries(gs.answers)) {
    const p = ctx.room.players.get(pid);
    if (!p) continue;
    const correct = ans.choice === gs.problem.answerIdx;
    let gained = 0;
    if (correct) {
      const bonus = Math.max(0, Math.round((1 - (ans.at - gs.roundStart) / ROUND_MS) * 60));
      gained = 100 + bonus;
      p.score += gained;
    }
    results.push({ id: pid, name: p.name, choice: ans.choice, correct, gained });
  }
  ctx.broadcast('math:reveal', { answerIdx: gs.problem.answerIdx, answer: gs.problem.answer, results, scores: ctx.room.scoreboard() });
  gs.revealTimer = setTimeout(() => {
    gs.round += 1;
    if (gs.round >= ROUNDS) ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
    else startRound(ctx);
  }, REVEAL_MS);
}

module.exports = {
  id: 'math',
  name: '번개 계산왕',
  emoji: '🧮',
  minPlayers: 1,

  start(ctx) {
    ctx.room.gameState = { round: 0, problem: null, answers: {}, phase: 'question', roundStart: 0 };
    startRound(ctx);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'question' || type !== 'answer') return;
    if (gs.answers[player.id]) return;
    const choice = Number(data && data.choice);
    if (!Number.isInteger(choice)) return;
    gs.answers[player.id] = { choice, at: Date.now() };
    ctx.broadcast('math:answered', { answeredCount: Object.keys(gs.answers).length, total: ctx.activePlayers().length });
    if (Object.keys(gs.answers).length >= ctx.activePlayers().length) reveal(ctx);
  },

  onPlayerLeave(ctx) {
    const gs = ctx.room.gameState;
    if (!gs || gs.phase !== 'question') return;
    if (Object.keys(gs.answers).length >= ctx.activePlayers().length && ctx.activePlayers().length > 0) reveal(ctx);
  },
};
