'use strict';

const TURN_MS = 15000; // 한 사람이 단어를 낼 시간
const START_LIVES = 3;

// ── 한글 분해 & 끝말잇기 규칙 (두음법칙 포함) ──────────────
function decompose(ch) {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  return {
    cho: Math.floor(code / 588),
    jung: Math.floor((code % 588) / 28),
    jong: code % 28,
  };
}

function isHangul(ch) {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3;
}

// 두음법칙에 따라 허용되는 첫 자음 목록
function allowedCho(L) {
  const yVowels = [2, 3, 6, 7, 12, 17, 19, 20]; // ㅑㅒㅕㅖㅛㅠㅢㅣ
  const isY = yVowels.includes(L.jung);
  if (L.cho === 5) return isY ? [5, 11] : [5, 2]; // ㄹ → ㅇ 또는 ㄴ
  if (L.cho === 2) return isY ? [2, 11] : [2]; // ㄴ → ㅇ
  return [L.cho];
}

function canFollow(prevWord, nextWord) {
  const last = prevWord[prevWord.length - 1];
  const first = nextWord[0];
  const L = decompose(last);
  const F = decompose(first);
  if (!L || !F) return last === first;
  if (F.jung !== L.jung || F.jong !== L.jong) return false;
  return allowedCho(L).includes(F.cho);
}

function allWordsHangul(w) {
  for (const ch of w) if (!isHangul(ch)) return false;
  return true;
}

// ── 게임 진행 ───────────────────────────────────────────
function clearTurnTimer(gs) {
  if (gs.turnTimer) clearTimeout(gs.turnTimer);
  gs.turnTimer = null;
}

function aliveList(ctx) {
  const gs = ctx.room.gameState;
  return gs.order.filter((pid) => {
    const p = ctx.room.players.get(pid);
    return p && p.connected && gs.lives[pid] > 0;
  });
}

function startTurn(ctx) {
  const gs = ctx.room.gameState;
  const alive = aliveList(ctx);
  if (alive.length <= 1) return finish(ctx);

  // 다음 순서의 살아있는 플레이어 찾기
  let guard = 0;
  do {
    gs.turnPos = (gs.turnPos + 1) % gs.order.length;
    guard++;
  } while (
    guard <= gs.order.length &&
    !alive.includes(gs.order[gs.turnPos])
  );

  const currentId = gs.order[gs.turnPos];
  gs.turnStart = Date.now();

  ctx.broadcast('word:turn', {
    currentId,
    currentName: ctx.room.players.get(currentId).name,
    lastWord: gs.lastWord,
    durationMs: TURN_MS,
    lives: gs.lives,
    alive,
  });

  clearTurnTimer(gs);
  gs.turnTimer = setTimeout(() => timeout(ctx, currentId), TURN_MS);
}

function timeout(ctx, playerId) {
  const gs = ctx.room.gameState;
  const p = ctx.room.players.get(playerId);
  gs.lives[playerId] = Math.max(0, (gs.lives[playerId] || 0) - 1);
  const eliminated = gs.lives[playerId] === 0;
  ctx.broadcast('word:timeout', {
    playerId,
    name: p ? p.name : '?',
    lives: gs.lives,
    eliminated,
  });
  startTurn(ctx);
}

function finish(ctx) {
  const gs = ctx.room.gameState;
  clearTurnTimer(gs);
  const survivors = aliveList(ctx);
  if (survivors.length === 1) {
    const winner = ctx.room.players.get(survivors[0]);
    if (winner) winner.score += 50; // 최후의 1인 보너스
  }
  ctx.endGame({ winner: ctx.room.scoreboard()[0] || null });
}

module.exports = {
  id: 'wordchain',
  name: '끝말잇기',
  emoji: '🔤',
  minPlayers: 2,

  start(ctx) {
    const order = ctx.activePlayers().map((p) => p.id);
    const lives = {};
    for (const pid of order) lives[pid] = START_LIVES;
    ctx.room.gameState = {
      order,
      lives,
      turnPos: -1,
      lastWord: null,
      used: new Set(),
      turnTimer: null,
      turnStart: 0,
    };
    startTurn(ctx);
  },

  onEvent(ctx, player, type, data) {
    const gs = ctx.room.gameState;
    if (!gs || type !== 'word') return;
    const currentId = gs.order[gs.turnPos];
    if (player.id !== currentId) return; // 내 차례 아님

    const word = String((data && data.word) || '').replace(/\s+/g, '').trim();

    // 규칙 검사 → 틀리면 안내만 하고 같은 사람이 다시 시도 (시간 안에)
    if (word.length < 2) {
      return ctx.toPlayer(player.id, 'word:rejected', { reason: '두 글자 이상 입력해요.' });
    }
    if (!allWordsHangul(word)) {
      return ctx.toPlayer(player.id, 'word:rejected', { reason: '한글 단어만 가능해요.' });
    }
    if (gs.used.has(word)) {
      return ctx.toPlayer(player.id, 'word:rejected', { reason: '이미 나온 단어예요.' });
    }
    if (gs.lastWord && !canFollow(gs.lastWord, word)) {
      const need = gs.lastWord[gs.lastWord.length - 1];
      return ctx.toPlayer(player.id, 'word:rejected', {
        reason: `'${need}'(으)로 시작해야 해요.`,
      });
    }

    // 통과!
    gs.used.add(word);
    gs.lastWord = word;
    player.score += 10;
    ctx.broadcast('word:accepted', {
      playerId: player.id,
      name: player.name,
      word,
      scores: ctx.room.scoreboard(),
    });
    startTurn(ctx);
  },

  onPlayerLeave(ctx, playerId) {
    const gs = ctx.room.gameState;
    if (!gs) return;
    // 나간 사람이 현재 차례였다면 넘어감
    if (gs.order[gs.turnPos] === playerId) {
      startTurn(ctx);
    } else if (aliveList(ctx).length <= 1) {
      finish(ctx);
    }
  },
};
