'use strict';

const fs = require('fs');
const path = require('path');

const ROUND_MS = 15000; // 한 문제당 제한시간
const REVEAL_MS = 3500; // 정답 공개 후 다음 문제까지 대기

function loadQuestions(file) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'data', file), 'utf8')
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearTimers(gs) {
  if (gs.roundTimer) clearTimeout(gs.roundTimer);
  if (gs.revealTimer) clearTimeout(gs.revealTimer);
  gs.roundTimer = null;
  gs.revealTimer = null;
}

function startRound(ctx) {
  const gs = ctx.room.gameState;
  const question = gs.questions[gs.round];
  gs.answers = {}; // playerId -> { choice, at }
  gs.roundStart = Date.now();
  gs.phase = 'question';

  ctx.broadcast('quiz:question', {
    round: gs.round + 1,
    total: gs.questions.length,
    q: question.q,
    choices: question.choices,
    durationMs: ROUND_MS,
  });

  gs.roundTimer = setTimeout(() => revealRound(ctx), ROUND_MS);
}

function revealRound(ctx) {
  const gs = ctx.room.gameState;
  if (gs.phase === 'reveal') return;
  clearTimers(gs);
  gs.phase = 'reveal';
  const question = gs.questions[gs.round];

  // 이번 라운드 점수 계산: 맞히면 기본 100점 + 빠를수록 보너스
  const results = [];
  for (const [pid, ans] of Object.entries(gs.answers)) {
    const player = ctx.room.players.get(pid);
    if (!player) continue;
    const correct = ans.choice === question.answer;
    let gained = 0;
    if (correct) {
      const elapsed = ans.at - gs.roundStart;
      const speedBonus = Math.max(0, Math.round((1 - elapsed / ROUND_MS) * 50));
      gained = 100 + speedBonus;
      player.score += gained;
    }
    results.push({ id: pid, name: player.name, choice: ans.choice, correct, gained });
  }

  ctx.broadcast('quiz:reveal', {
    answer: question.answer,
    results,
    scores: ctx.room.scoreboard(),
  });

  gs.revealTimer = setTimeout(() => {
    gs.round += 1;
    if (gs.round >= gs.questions.length) {
      finish(ctx);
    } else {
      startRound(ctx);
    }
  }, REVEAL_MS);
}

function finish(ctx) {
  clearTimers(ctx.room.gameState);
  const scores = ctx.room.scoreboard();
  ctx.endGame({ winner: scores[0] || null });
}

// 퀴즈 게임 팩토리 — 문제 파일만 바꿔 여러 종류의 퀴즈를 만든다.
function createQuizGame({ id, name, emoji, dataFile, rounds = 7 }) {
  return {
    id,
    name,
    emoji,
    minPlayers: 1,

    start(ctx) {
      const all = loadQuestions(dataFile); // 매 게임마다 다시 읽어 파일 수정이 바로 반영됨
      const picked = shuffle(all).slice(0, Math.min(rounds, all.length));
      ctx.room.gameState = {
        questions: picked,
        round: 0,
        answers: {},
        phase: 'question',
        roundTimer: null,
        revealTimer: null,
        roundStart: 0,
      };
      startRound(ctx);
    },

    onEvent(ctx, player, type, data) {
      const gs = ctx.room.gameState;
      if (!gs) return;
      if (type === 'answer' && gs.phase === 'question') {
        if (gs.answers[player.id]) return; // 한 문제 한 번만
        const choice = Number(data && data.choice);
        if (!Number.isInteger(choice)) return;
        gs.answers[player.id] = { choice, at: Date.now() };
        ctx.broadcast('quiz:answered', {
          answeredCount: Object.keys(gs.answers).length,
          total: ctx.activePlayers().length,
        });
        if (Object.keys(gs.answers).length >= ctx.activePlayers().length) {
          revealRound(ctx);
        }
      }
    },

    onPlayerLeave(ctx) {
      const gs = ctx.room.gameState;
      if (!gs || gs.phase !== 'question') return;
      if (
        Object.keys(gs.answers).length >= ctx.activePlayers().length &&
        ctx.activePlayers().length > 0
      ) {
        revealRound(ctx);
      }
    },
  };
}

module.exports = { createQuizGame };
