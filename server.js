import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { QUIZ_QUESTIONS } from "./games/quizData.js";
import { DRAW_WORDS } from "./games/drawData.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(join(__dirname, "public")));

// ───────────────────────────────────────────────────────────────
// 방(Room) 상태 관리 — 모두 메모리에 저장 (서버 재시작 시 초기화)
// rooms = { [code]: Room }
// Room = { code, hostId, players:[{id,nickname,score,connected}], game, phase, gameState }
// ───────────────────────────────────────────────────────────────
const rooms = new Map();

function makeRoomCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(code));
  return code;
}

function publicPlayers(room) {
  return room.players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    connected: p.connected,
    isHost: p.id === room.hostId,
  }));
}

function broadcastRoom(room) {
  io.to(room.code).emit("room:update", {
    code: room.code,
    hostId: room.hostId,
    game: room.game,
    phase: room.phase,
    players: publicPlayers(room),
  });
}

function getPlayer(room, id) {
  return room.players.find((p) => p.id === id);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 방에 걸린 타이머를 안전하게 정리
function clearTimers(room) {
  if (room._timers) {
    room._timers.forEach((t) => clearTimeout(t));
  }
  room._timers = [];
}
function setRoomTimeout(room, fn, ms) {
  const t = setTimeout(fn, ms);
  room._timers = room._timers || [];
  room._timers.push(t);
  return t;
}

// ───────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  // 방 만들기
  socket.on("room:create", ({ nickname }, cb) => {
    const code = makeRoomCode();
    const player = { id: socket.id, nickname: cleanName(nickname), score: 0, connected: true };
    const room = { code, hostId: socket.id, players: [player], game: null, phase: "lobby", gameState: null, _timers: [] };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    cb?.({ ok: true, code, playerId: socket.id });
    broadcastRoom(room);
  });

  // 방 참가
  socket.on("room:join", ({ code, nickname }, cb) => {
    code = String(code || "").trim();
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: "그런 방 번호가 없어요. 번호를 다시 확인해 주세요." });
    if (room.phase !== "lobby") return cb?.({ ok: false, error: "이미 게임이 시작된 방이에요." });
    if (room.players.length >= 8) return cb?.({ ok: false, error: "방이 가득 찼어요 (최대 8명)." });

    const player = { id: socket.id, nickname: cleanName(nickname), score: 0, connected: true };
    room.players.push(player);
    socket.join(code);
    socket.data.roomCode = code;
    cb?.({ ok: true, code, playerId: socket.id });
    broadcastRoom(room);
  });

  // 호스트: 게임 선택
  socket.on("room:chooseGame", ({ game }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") return;
    room.game = game;
    broadcastRoom(room);
  });

  // 호스트: 게임 시작
  socket.on("game:start", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return;
    if (!room.game) return;
    if (room.players.length < 2) {
      io.to(room.code).emit("toast", "최소 2명이 있어야 시작할 수 있어요.");
      return;
    }
    room.players.forEach((p) => (p.score = 0));
    room.phase = "playing";
    if (room.game === "quiz") startQuiz(room);
    else if (room.game === "bingo") startBingo(room);
    else if (room.game === "draw") startDraw(room);
    broadcastRoom(room);
  });

  // 로비로 돌아가기 (다시 하기 / 다른 게임)
  socket.on("game:backToLobby", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return;
    clearTimers(room);
    room.phase = "lobby";
    room.gameState = null;
    broadcastRoom(room);
    io.to(room.code).emit("game:toLobby");
  });

  // 채팅 (게임 중 겸용)
  socket.on("chat:send", ({ text }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = getPlayer(room, socket.id);
    if (!p) return;
    text = String(text || "").slice(0, 200).trim();
    if (!text) return;

    // 그림 맞히기 진행 중이면 정답 판정으로 라우팅
    if (room.game === "draw" && room.phase === "playing" && room.gameState) {
      handleDrawGuess(room, socket.id, text);
      return;
    }
    io.to(room.code).emit("chat:msg", { from: p.nickname, text });
  });

  // ── 게임별 이벤트 ──────────────────────────────────────────
  socket.on("quiz:answer", ({ choice }) => handleQuizAnswer(rooms.get(socket.data.roomCode), socket.id, choice));
  socket.on("bingo:call", ({ number }) => handleBingoCall(rooms.get(socket.data.roomCode), socket.id, number));
  socket.on("draw:stroke", (stroke) => relayDrawStroke(rooms.get(socket.data.roomCode), socket.id, stroke));
  socket.on("draw:clear", () => {
    const room = rooms.get(socket.data.roomCode);
    if (room && room.gameState?.drawerId === socket.id) socket.to(room.code).emit("draw:clear");
  });

  // 연결 종료
  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = getPlayer(room, socket.id);
    if (p) p.connected = false;

    // 로비 상태면 아예 제거
    if (room.phase === "lobby") {
      room.players = room.players.filter((x) => x.id !== socket.id);
    }

    // 방이 비면 삭제
    const anyConnected = room.players.some((x) => x.connected);
    if (!anyConnected || room.players.length === 0) {
      clearTimers(room);
      rooms.delete(room.code);
      return;
    }

    // 호스트가 나가면 다른 접속자에게 위임
    if (room.hostId === socket.id) {
      const next = room.players.find((x) => x.connected);
      if (next) room.hostId = next.id;
    }
    broadcastRoom(room);
  });
});

function cleanName(name) {
  name = String(name || "").slice(0, 12).trim();
  return name || "익명이";
}

// ═══════════════════════════════════════════════════════════════
// 🎯 퀴즈 배틀
// ═══════════════════════════════════════════════════════════════
const QUIZ_ROUNDS = 7;
const QUIZ_TIME_MS = 15000;

function startQuiz(room) {
  clearTimers(room);
  const questions = shuffle(QUIZ_QUESTIONS).slice(0, QUIZ_ROUNDS);
  room.gameState = { type: "quiz", questions, index: -1, answers: {}, questionStart: 0 };
  io.to(room.code).emit("game:begin", { game: "quiz", total: questions.length });
  nextQuizQuestion(room);
}

function nextQuizQuestion(room) {
  const gs = room.gameState;
  gs.index++;
  if (gs.index >= gs.questions.length) return endQuiz(room);

  gs.answers = {};
  gs.questionStart = Date.now();
  const q = gs.questions[gs.index];
  io.to(room.code).emit("quiz:question", {
    index: gs.index,
    total: gs.questions.length,
    question: q.q,
    choices: q.choices,
    timeMs: QUIZ_TIME_MS,
  });
  setRoomTimeout(room, () => revealQuiz(room), QUIZ_TIME_MS);
}

function handleQuizAnswer(room, playerId, choice) {
  if (!room || room.game !== "quiz" || !room.gameState) return;
  const gs = room.gameState;
  if (gs.answers[playerId] != null) return; // 이미 답함
  const elapsed = Date.now() - gs.questionStart;
  gs.answers[playerId] = { choice, elapsed };
  io.to(room.code).emit("quiz:answered", { playerId });

  // 모두 답하면 바로 공개
  const connected = room.players.filter((p) => p.connected);
  if (connected.every((p) => gs.answers[p.id] != null)) {
    clearTimers(room);
    revealQuiz(room);
  }
}

function revealQuiz(room) {
  const gs = room.gameState;
  if (!gs || gs._revealed === gs.index) return;
  gs._revealed = gs.index;
  const q = gs.questions[gs.index];
  const gained = {};
  for (const p of room.players) {
    const ans = gs.answers[p.id];
    if (ans && ans.choice === q.answer) {
      // 정답 100점 + 빠를수록 최대 50점 보너스
      const bonus = Math.round(50 * Math.max(0, 1 - ans.elapsed / QUIZ_TIME_MS));
      const pts = 100 + bonus;
      p.score += pts;
      gained[p.id] = pts;
    } else {
      gained[p.id] = 0;
    }
  }
  io.to(room.code).emit("quiz:reveal", {
    answer: q.answer,
    explanation: q.explanation || "",
    gained,
    scores: scoreboard(room),
  });
  setRoomTimeout(room, () => nextQuizQuestion(room), 4500);
}

function endQuiz(room) {
  finishGame(room, scoreboard(room));
}

// ═══════════════════════════════════════════════════════════════
// 🔢 빙고 (각자 5x5 랜덤판, 돌아가며 숫자 외치기, 먼저 3줄이면 승리)
// ═══════════════════════════════════════════════════════════════
const BINGO_TARGET_LINES = 3;

function startBingo(room) {
  clearTimers(room);
  const boards = {};
  for (const p of room.players) boards[p.id] = shuffle([...Array(25)].map((_, i) => i + 1));
  const order = shuffle(room.players.filter((p) => p.connected).map((p) => p.id));
  room.gameState = {
    type: "bingo",
    boards,
    marked: [], // 외쳐진 숫자들
    order,
    turnIdx: 0,
  };
  io.to(room.code).emit("game:begin", { game: "bingo" });
  for (const p of room.players) {
    io.to(p.id).emit("bingo:board", { board: boards[p.id], target: BINGO_TARGET_LINES });
  }
  emitBingoTurn(room);
}

function emitBingoTurn(room) {
  const gs = room.gameState;
  const turnId = gs.order[gs.turnIdx % gs.order.length];
  const p = getPlayer(room, turnId);
  io.to(room.code).emit("bingo:turn", { turnId, nickname: p?.nickname || "" });
}

function countLines(board, marked) {
  // board: 25칸 숫자배열(위치=인덱스), marked: 외쳐진 숫자 Set
  const m = (i) => marked.includes(board[i]);
  let lines = 0;
  for (let r = 0; r < 5; r++) if ([0, 1, 2, 3, 4].every((c) => m(r * 5 + c))) lines++;
  for (let c = 0; c < 5; c++) if ([0, 1, 2, 3, 4].every((r) => m(r * 5 + c))) lines++;
  if ([0, 6, 12, 18, 24].every(m)) lines++;
  if ([4, 8, 12, 16, 20].every(m)) lines++;
  return lines;
}

function handleBingoCall(room, playerId, number) {
  if (!room || room.game !== "bingo" || !room.gameState) return;
  const gs = room.gameState;
  const turnId = gs.order[gs.turnIdx % gs.order.length];
  if (turnId !== playerId) return; // 자기 차례 아님
  number = Number(number);
  if (!(number >= 1 && number <= 25) || gs.marked.includes(number)) return;

  gs.marked.push(number);
  const caller = getPlayer(room, playerId);
  io.to(room.code).emit("bingo:called", { number, by: caller?.nickname || "" });

  // 각자 줄 수 계산 + 승리 판정
  const results = [];
  const winners = [];
  for (const p of room.players) {
    const lines = countLines(gs.boards[p.id], gs.marked);
    results.push({ id: p.id, lines });
    if (lines >= BINGO_TARGET_LINES) winners.push(p);
  }
  io.to(room.code).emit("bingo:lines", { results, marked: gs.marked });

  if (winners.length > 0) {
    winners.forEach((w) => (w.score += 1));
    finishGame(room, scoreboard(room), { bingoWinners: winners.map((w) => w.nickname) });
    return;
  }

  gs.turnIdx++;
  // 접속 끊긴 사람 차례는 건너뜀
  let guard = 0;
  while (guard++ < gs.order.length) {
    const nid = gs.order[gs.turnIdx % gs.order.length];
    if (getPlayer(room, nid)?.connected) break;
    gs.turnIdx++;
  }
  emitBingoTurn(room);
}

// ═══════════════════════════════════════════════════════════════
// ✏️ 그림 맞히기 (돌아가며 그리기, 채팅으로 정답 맞히기)
// ═══════════════════════════════════════════════════════════════
const DRAW_ROUND_MS = 75000;

function startDraw(room) {
  clearTimers(room);
  const order = shuffle(room.players.filter((p) => p.connected).map((p) => p.id));
  room.gameState = { type: "draw", order, turnIdx: -1, word: null, drawerId: null, solved: [], roundStart: 0 };
  io.to(room.code).emit("game:begin", { game: "draw" });
  nextDrawRound(room);
}

function nextDrawRound(room) {
  const gs = room.gameState;
  gs.turnIdx++;
  // 접속자만 그리기 순번
  const activeOrder = gs.order.filter((id) => getPlayer(room, id)?.connected);
  if (activeOrder.length < 2 || gs.turnIdx >= gs.order.length) {
    return finishGame(room, scoreboard(room));
  }
  const drawerId = gs.order[gs.turnIdx];
  if (!getPlayer(room, drawerId)?.connected) return nextDrawRound(room);

  const word = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)];
  gs.word = word;
  gs.drawerId = drawerId;
  gs.solved = [];
  gs.roundStart = Date.now();

  const drawer = getPlayer(room, drawerId);
  io.to(room.code).emit("draw:round", {
    drawerId,
    drawerName: drawer?.nickname || "",
    round: gs.turnIdx + 1,
    total: gs.order.length,
    wordLength: word.length,
    timeMs: DRAW_ROUND_MS,
  });
  io.to(drawerId).emit("draw:word", { word }); // 출제자에게만 단어 공개
  setRoomTimeout(room, () => endDrawRound(room, "시간 종료"), DRAW_ROUND_MS);
}

function relayDrawStroke(room, playerId, stroke) {
  if (!room || room.gameState?.drawerId !== playerId) return;
  // 출제자 획을 나머지에게 그대로 전달
  room.players.forEach((p) => {
    if (p.id !== playerId) io.to(p.id).emit("draw:stroke", stroke);
  });
}

function handleDrawGuess(room, playerId, text) {
  const gs = room.gameState;
  const p = getPlayer(room, playerId);
  if (!p) return;

  // 출제자는 채팅 그대로(단어 노출 방지 위해 표시만)
  if (playerId === gs.drawerId) {
    io.to(room.code).emit("chat:msg", { from: p.nickname, text });
    return;
  }
  if (gs.solved.includes(playerId)) {
    io.to(room.code).emit("chat:msg", { from: p.nickname, text });
    return;
  }

  const normalized = text.replace(/\s/g, "").toLowerCase();
  if (normalized === gs.word.replace(/\s/g, "").toLowerCase()) {
    // 정답! 빠를수록 높은 점수, 출제자도 보너스
    gs.solved.push(playerId);
    const elapsed = Date.now() - gs.roundStart;
    const pts = 100 + Math.round(50 * Math.max(0, 1 - elapsed / DRAW_ROUND_MS));
    p.score += pts;
    const drawer = getPlayer(room, gs.drawerId);
    if (drawer) drawer.score += 30;

    io.to(room.code).emit("draw:correct", {
      playerId,
      nickname: p.nickname,
      order: gs.solved.length,
      scores: scoreboard(room),
    });

    // 출제자 뺀 접속자 전원이 맞히면 라운드 종료
    const guessers = room.players.filter((x) => x.connected && x.id !== gs.drawerId);
    if (guessers.length > 0 && guessers.every((g) => gs.solved.includes(g.id))) {
      clearTimers(room);
      endDrawRound(room, "모두 정답!");
    }
  } else {
    // 오답은 채팅으로 표시 (근접 힌트 없이 단순)
    io.to(room.code).emit("chat:msg", { from: p.nickname, text });
  }
}

function endDrawRound(room, reason) {
  const gs = room.gameState;
  if (!gs || gs._endedRound === gs.turnIdx) return;
  gs._endedRound = gs.turnIdx;
  io.to(room.code).emit("draw:roundEnd", {
    word: gs.word,
    reason,
    scores: scoreboard(room),
  });
  setRoomTimeout(room, () => nextDrawRound(room), 4500);
}

// ═══════════════════════════════════════════════════════════════
// 공통 마무리
// ═══════════════════════════════════════════════════════════════
function scoreboard(room) {
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score }));
}

function finishGame(room, board, extra = {}) {
  clearTimers(room);
  room.phase = "finished";
  const top = board[0]?.score ?? 0;
  const winners = board.filter((b) => b.score === top && top > 0).map((b) => b.nickname);
  io.to(room.code).emit("game:end", { scores: board, winners, ...extra });
  broadcastRoom(room);
}

// ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🎮 가족 게임 사이트 실행 중 → http://localhost:${PORT}\n`);
});
