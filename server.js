'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const { RoomStore } = require('./src/rooms');
const games = require('./src/games');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size() }));
app.get('/api/games', (_req, res) => {
  res.json(
    Object.values(games).map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      minPlayers: g.minPlayers || 1,
    }))
  );
});

const rooms = new RoomStore();

// 각 게임에게 방 안에서 쓸 수 있는 도구 모음(context)을 만들어 전달한다.
function makeCtx(room) {
  return {
    room,
    game: games[room.game],
    broadcast(event, data) {
      io.to(room.code).emit(event, data);
    },
    toPlayer(playerId, event, data) {
      const p = room.players.get(playerId);
      if (p && p.socketId) io.to(p.socketId).emit(event, data);
    },
    players() {
      return [...room.players.values()];
    },
    activePlayers() {
      return [...room.players.values()].filter((p) => p.connected);
    },
    // 게임을 끝내고 로비 겸 결과 화면으로 돌려보낸다.
    endGame(payload = {}) {
      room.state = 'result';
      room.gameState = null;
      io.to(room.code).emit('gameEnded', {
        game: room.game,
        scores: room.scoreboard(),
        ...payload,
      });
      broadcastRoom(room);
    },
    saveState() {
      broadcastRoom(room);
    },
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit('roomUpdate', room.publicState());
}

io.on('connection', (socket) => {
  // 이 소켓이 현재 들어가 있는 방과 플레이어 식별자
  let joinedCode = null;
  let playerId = null;

  function currentRoom() {
    return joinedCode ? rooms.get(joinedCode) : null;
  }

  socket.on('createRoom', ({ name }, cb) => {
    const cleanName = String(name || '').trim().slice(0, 12) || '플레이어';
    const room = rooms.create();
    playerId = room.addPlayer({ name: cleanName, socketId: socket.id, isHost: true });
    joinedCode = room.code;
    socket.join(room.code);
    cb && cb({ ok: true, roomCode: room.code, playerId });
    broadcastRoom(room);
  });

  socket.on('joinRoom', ({ roomCode, name }, cb) => {
    const code = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb && cb({ ok: false, error: '존재하지 않는 방 코드예요.' });
    if (room.state !== 'lobby' && room.state !== 'result') {
      return cb && cb({ ok: false, error: '이미 게임이 진행 중인 방이에요.' });
    }
    if (room.players.size >= 8) {
      return cb && cb({ ok: false, error: '방이 가득 찼어요 (최대 8명).' });
    }
    const cleanName = String(name || '').trim().slice(0, 12) || '플레이어';
    playerId = room.addPlayer({ name: cleanName, socketId: socket.id, isHost: false });
    joinedCode = room.code;
    socket.join(room.code);
    cb && cb({ ok: true, roomCode: room.code, playerId });
    broadcastRoom(room);
  });

  // 끊겼다가 다시 접속했을 때 같은 플레이어로 복귀
  socket.on('rejoin', ({ roomCode, playerId: pid }, cb) => {
    const code = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || !room.players.has(pid)) {
      return cb && cb({ ok: false });
    }
    playerId = pid;
    joinedCode = code;
    const p = room.players.get(pid);
    p.socketId = socket.id;
    p.connected = true;
    socket.join(code);
    cb && cb({ ok: true, roomCode: code, playerId, state: room.publicState() });
    broadcastRoom(room);
  });

  // 방장이 게임 선택
  socket.on('selectGame', ({ game }) => {
    const room = currentRoom();
    if (!room || room.hostId !== playerId) return;
    if (!games[game]) return;
    room.game = game;
    room.state = 'lobby';
    broadcastRoom(room);
  });

  // 방장이 게임 시작
  socket.on('startGame', () => {
    const room = currentRoom();
    if (!room || room.hostId !== playerId) return;
    if (!room.game || !games[room.game]) return;
    const need = games[room.game].minPlayers || 1;
    if (room.activeCount() < need) {
      return socket.emit('startError', {
        message: `이 게임은 최소 ${need}명이 필요해요. (현재 ${room.activeCount()}명)`,
      });
    }
    room.state = 'playing';
    room.resetScoresIfNeeded();
    room.gameState = {};
    // 먼저 'playing' 상태를 알려 클라이언트가 게임 화면을 붙이고
    // 이벤트 핸들러를 등록하게 한 뒤에 게임을 시작한다 (첫 이벤트 유실 방지).
    broadcastRoom(room);
    const ctx = makeCtx(room);
    setImmediate(() => {
      if (room.state === 'playing') games[room.game].start(ctx);
    });
  });

  // 게임 내부 이벤트를 해당 게임 모듈로 전달
  socket.on('gameEvent', ({ type, data }) => {
    const room = currentRoom();
    if (!room || room.state !== 'playing' || !room.game) return;
    const player = room.players.get(playerId);
    if (!player) return;
    const g = games[room.game];
    if (g && typeof g.onEvent === 'function') {
      g.onEvent(makeCtx(room), player, type, data);
    }
  });

  // 로비로 돌아가기 (방장)
  socket.on('backToLobby', () => {
    const room = currentRoom();
    if (!room || room.hostId !== playerId) return;
    room.state = 'lobby';
    room.gameState = null;
    broadcastRoom(room);
  });

  socket.on('leaveRoom', () => {
    handleLeave();
  });

  socket.on('disconnect', () => {
    const room = currentRoom();
    if (!room || !playerId) return;
    const p = room.players.get(playerId);
    if (p) p.connected = false;
    // 진행 중 게임에 알림 (예: 그림 그리던 사람이 나감)
    if (room.state === 'playing' && room.game && games[room.game].onPlayerLeave) {
      games[room.game].onPlayerLeave(makeCtx(room), playerId);
    }
    // 잠시 후에도 안 돌아오면 완전히 제거
    setTimeout(() => {
      const r = rooms.get(joinedCode);
      if (!r) return;
      const pl = r.players.get(playerId);
      if (pl && !pl.connected) {
        r.removePlayer(playerId);
        if (r.players.size === 0) {
          rooms.remove(r.code);
        } else {
          broadcastRoom(r);
        }
      }
    }, 30000);
    broadcastRoom(room);
  });

  function handleLeave() {
    const room = currentRoom();
    if (!room || !playerId) return;
    room.removePlayer(playerId);
    socket.leave(room.code);
    if (room.players.size === 0) {
      rooms.remove(room.code);
    } else {
      broadcastRoom(room);
    }
    joinedCode = null;
    playerId = null;
  }
});

server.listen(PORT, () => {
  console.log(`온가족 게임 서버 실행 중 → http://localhost:${PORT}`);
});
