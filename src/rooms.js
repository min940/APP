'use strict';

// 혼동하기 쉬운 글자(0/O, 1/I 등) 제외한 방 코드용 문자
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 4) {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

let playerSeqBase = 1;
function nextPlayerId() {
  // 시간 + 증가값으로 충돌 없는 식별자 생성
  return `p_${Date.now().toString(36)}_${(playerSeqBase++).toString(36)}`;
}

class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map(); // playerId -> player
    this.hostId = null;
    this.state = 'lobby'; // lobby | playing | result
    this.game = null; // 선택된 게임 id
    this.gameState = null; // 게임 진행 중 임시 상태
    this.createdAt = Date.now();
  }

  addPlayer({ name, socketId, isHost }) {
    const id = nextPlayerId();
    const player = {
      id,
      name,
      socketId,
      score: 0,
      connected: true,
      isHost: false,
    };
    this.players.set(id, player);
    if (isHost || !this.hostId) {
      this.hostId = id;
      player.isHost = true;
    }
    return id;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (this.hostId === playerId) {
      // 남은 사람 중 먼저 들어온 사람에게 방장 위임
      const next = this.players.values().next().value;
      this.hostId = next ? next.id : null;
      if (next) next.isHost = true;
      for (const p of this.players.values()) {
        p.isHost = p.id === this.hostId;
      }
    }
  }

  activeCount() {
    let n = 0;
    for (const p of this.players.values()) if (p.connected) n++;
    return n;
  }

  // 새 게임 시작 시 이전 게임과 다르면 점수 초기화
  resetScoresIfNeeded() {
    for (const p of this.players.values()) p.score = 0;
  }

  scoreboard() {
    return [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  publicState() {
    return {
      code: this.code,
      hostId: this.hostId,
      state: this.state,
      game: this.game,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        connected: p.connected,
        isHost: p.isHost,
      })),
    };
  }
}

class RoomStore {
  constructor() {
    this.rooms = new Map();
  }

  create() {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return code ? this.rooms.get(code) : null;
  }

  remove(code) {
    this.rooms.delete(code);
  }

  size() {
    return this.rooms.size;
  }
}

module.exports = { Room, RoomStore };
