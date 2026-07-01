'use strict';

/* 온가족 게임 — 클라이언트 메인 */

// ── 공용 UI 도구 (게임 모듈에서도 사용) ──────────────
const GUI = {
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },
  h(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  },
  // 제한시간 막대 애니메이션. 남은 시간 기준으로 줄어든다.
  countdown(barInner, durationMs, onEnd) {
    const start = Date.now();
    let raf;
    function tick() {
      const left = Math.max(0, durationMs - (Date.now() - start));
      barInner.style.width = (left / durationMs) * 100 + '%';
      if (left <= 0) { if (onEnd) onEnd(); return; }
      raf = requestAnimationFrame(tick);
    }
    tick();
    return { stop() { cancelAnimationFrame(raf); } };
  },
};
window.GUI = GUI;
window.GameClients = window.GameClients || {};

const App = {
  socket: null,
  me: { name: '', playerId: null, roomCode: null },
  room: null,
  games: [],
  root: document.getElementById('app'),
  currentView: null,
  mountedGameId: null,
  gameApi: null,

  get isHost() {
    return this.room && this.me.playerId && this.room.hostId === this.me.playerId;
  },

  async init() {
    this.games = await fetch('/api/games').then((r) => r.json()).catch(() => []);
    this.me.name = localStorage.getItem('fg_name') || '';
    this.socket = io();

    this.socket.on('connect', () => this.tryRejoin());
    this.socket.on('roomUpdate', (state) => {
      this.room = state;
      // 내가 방에서 제거됐다면 홈으로
      if (this.me.playerId && !state.players.some((p) => p.id === this.me.playerId)) {
        this.leaveLocal();
        return;
      }
      this.render();
    });
    this.socket.on('startError', (d) => this.toast(d.message));
    this.socket.on('gameEnded', () => {}); // 결과는 roomUpdate 기반으로 렌더

    if (!this.socket.connected) this.render(); // 첫 화면
  },

  tryRejoin() {
    const code = localStorage.getItem('fg_room');
    const pid = localStorage.getItem('fg_pid');
    if (code && pid) {
      this.socket.emit('rejoin', { roomCode: code, playerId: pid }, (res) => {
        if (res && res.ok) {
          this.me.roomCode = res.roomCode;
          this.me.playerId = res.playerId;
          this.room = res.state;
          this.render();
        } else {
          this.leaveLocal();
        }
      });
    } else {
      this.render();
    }
  },

  saveSession() {
    localStorage.setItem('fg_room', this.me.roomCode || '');
    localStorage.setItem('fg_pid', this.me.playerId || '');
    localStorage.setItem('fg_name', this.me.name || '');
  },
  leaveLocal() {
    localStorage.removeItem('fg_room');
    localStorage.removeItem('fg_pid');
    this.me.roomCode = null;
    this.me.playerId = null;
    this.room = null;
    this.teardownGame();
    this.currentView = null;
    this.render();
  },

  // ── 화면 라우팅 ─────────────────────────
  render() {
    const room = this.room;
    const view = !room ? 'home' : room.state;

    if (view === 'playing') {
      const gid = room.game;
      if (this.currentView !== 'playing' || this.mountedGameId !== gid) {
        this.teardownGame();
        this.renderGameShell();
        this.mountGame(gid);
      }
    } else {
      if (this.currentView === 'playing') this.teardownGame();
      if (view === 'home') this.renderHome();
      else if (view === 'lobby') this.renderLobby();
      else if (view === 'result') this.renderResult();
    }
    this.currentView = view;
  },

  // ── 홈 ──────────────────────────────────
  renderHome() {
    this.root.innerHTML = '';
    const wrap = GUI.h(`<div class="fade-in">
      <div class="title">🎮 온가족 게임</div>
      <div class="subtitle">각자 핸드폰으로 접속해서 같이 놀아요!</div>
      <div class="card">
        <label class="field">내 이름 (가족이 알아볼 이름)</label>
        <input class="input" id="nameInput" maxlength="12" placeholder="예: 아빠, 엄마, 지민" />
        <button class="btn accent" id="createBtn">➕ 새 방 만들기</button>
      </div>
      <div class="card">
        <label class="field">방 코드로 참여하기</label>
        <input class="input code" id="codeInput" maxlength="4" placeholder="ABCD" />
        <button class="btn" id="joinBtn">🚪 방 참여하기</button>
        <div class="err" id="homeErr"></div>
      </div>
      <div class="center muted" style="font-size:.85rem;margin-top:8px">
        방장이 방을 만들고 <b>방 코드</b>를 알려주면<br/>온 가족이 그 코드로 함께 들어올 수 있어요.
      </div>
    </div>`);
    this.root.appendChild(wrap);

    const nameInput = wrap.querySelector('#nameInput');
    const codeInput = wrap.querySelector('#codeInput');
    const err = wrap.querySelector('#homeErr');
    nameInput.value = this.me.name;
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
    });

    const getName = () => {
      const n = nameInput.value.trim();
      if (!n) { nameInput.focus(); this.toast('이름을 먼저 입력해요'); }
      return n;
    };

    wrap.querySelector('#createBtn').onclick = () => {
      const name = getName();
      if (!name) return;
      this.me.name = name;
      this.socket.emit('createRoom', { name }, (res) => {
        if (res && res.ok) this.onJoined(res);
      });
    };
    wrap.querySelector('#joinBtn').onclick = () => {
      const name = getName();
      if (!name) return;
      const code = codeInput.value.trim();
      if (code.length !== 4) { err.textContent = '4자리 방 코드를 입력해요.'; return; }
      this.me.name = name;
      this.socket.emit('joinRoom', { roomCode: code, name }, (res) => {
        if (res && res.ok) this.onJoined(res);
        else err.textContent = (res && res.error) || '참여에 실패했어요.';
      });
    };
  },

  onJoined(res) {
    this.me.roomCode = res.roomCode;
    this.me.playerId = res.playerId;
    this.saveSession();
    // roomUpdate가 곧 도착하며 화면을 그린다
  },

  // ── 로비 ────────────────────────────────
  renderLobby() {
    const room = this.room;
    this.root.innerHTML = '';
    const isHost = this.isHost;

    const wrap = GUI.h(`<div class="fade-in">
      <div class="roomcode-box card">
        <div class="label">방 코드 · 가족에게 알려주세요</div>
        <div class="roomcode" id="codeDisplay">${GUI.esc(room.code)}</div>
        <button class="btn small ghost" id="copyBtn">📋 코드/링크 복사</button>
      </div>
      <div class="card">
        <div class="game-header"><span>참여자 (${room.players.length})</span></div>
        <div class="players" id="players"></div>
      </div>
      <div class="card">
        <div class="game-header"><span>게임 고르기</span>
          ${isHost ? '' : '<span class="pill">방장만 선택</span>'}</div>
        <div class="game-grid" id="games"></div>
      </div>
      <div id="hostArea"></div>
      <button class="btn ghost" id="leaveBtn">나가기</button>
    </div>`);
    this.root.appendChild(wrap);

    this.renderPlayers(wrap.querySelector('#players'));

    const grid = wrap.querySelector('#games');
    this.games.forEach((g) => {
      const selected = room.game === g.id;
      const tile = GUI.h(`<button class="game-tile ${selected ? 'selected' : ''}">
        <span class="emoji">${g.emoji}</span>
        <span class="name">${GUI.esc(g.name)}</span>
        <span class="min">${g.minPlayers}명 이상</span>
      </button>`);
      if (isHost) {
        tile.onclick = () => this.socket.emit('selectGame', { game: g.id });
      } else {
        tile.disabled = true;
      }
      grid.appendChild(tile);
    });

    const hostArea = wrap.querySelector('#hostArea');
    const selGame = this.games.find((g) => g.id === room.game);
    if (isHost) {
      const canStart = selGame && room.players.filter((p) => p.connected).length >= selGame.minPlayers;
      const btn = GUI.h(`<button class="btn good" ${canStart ? '' : 'disabled'}>
        ${selGame ? `▶ ${GUI.esc(selGame.name)} 시작하기` : '게임을 먼저 골라요'}</button>`);
      btn.onclick = () => this.socket.emit('startGame');
      hostArea.appendChild(btn);
      if (selGame && !canStart) {
        hostArea.appendChild(GUI.h(`<div class="center muted" style="margin-top:8px">이 게임은 ${selGame.minPlayers}명 이상 필요해요.</div>`));
      }
    } else {
      hostArea.appendChild(GUI.h(`<div class="center muted" style="padding:8px">${selGame ? `방장이 <b>${GUI.esc(selGame.name)}</b> 시작하기를 기다리는 중…` : '방장이 게임을 고르는 중…'}</div>`));
    }

    wrap.querySelector('#copyBtn').onclick = () => this.shareRoom();
    wrap.querySelector('#leaveBtn').onclick = () => {
      this.socket.emit('leaveRoom');
      this.leaveLocal();
    };
  },

  renderPlayers(container) {
    container.innerHTML = '';
    this.room.players.forEach((p) => {
      const me = p.id === this.me.playerId;
      const chip = GUI.h(`<span class="player-chip ${p.connected ? '' : 'off'}">
        ${p.isHost ? '<span class="host">👑</span>' : ''}
        <span>${GUI.esc(p.name)}${me ? ' (나)' : ''}</span>
      </span>`);
      container.appendChild(chip);
    });
  },

  shareRoom() {
    const url = `${location.origin}/?code=${this.room.code}`;
    const text = `온가족 게임 방 코드: ${this.room.code}\n${url}`;
    if (navigator.share) {
      navigator.share({ title: '온가족 게임', text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => this.toast('복사했어요! 가족에게 붙여넣기 하세요'));
    } else {
      this.toast(`방 코드: ${this.room.code}`);
    }
  },

  // ── 게임 화면 ───────────────────────────
  renderGameShell() {
    this.root.innerHTML = '';
    const g = this.games.find((x) => x.id === this.room.game) || {};
    const shell = GUI.h(`<div class="fade-in">
      <div class="game-header">
        <span>${g.emoji || '🎮'} ${GUI.esc(g.name || '게임')}</span>
        <span class="pill" id="mini-score"></span>
      </div>
      <div id="game-area"></div>
    </div>`);
    this.root.appendChild(shell);
    this.updateMiniScore();
  },

  updateMiniScore() {
    const el = document.getElementById('mini-score');
    if (!el || !this.room) return;
    const me = this.room.players.find((p) => p.id === this.me.playerId);
    el.textContent = me ? `내 점수 ${me.score}` : '';
  },

  mountGame(gid) {
    const client = window.GameClients[gid];
    const area = document.getElementById('game-area');
    if (!client || !area) return;
    this.gameApi = this.makeGameApi();
    this.mountedGameId = gid;
    client.mount(area, this.gameApi);
  },

  teardownGame() {
    if (this.gameApi) {
      this.gameApi._unmountFns.forEach((fn) => { try { fn(); } catch (e) {} });
      this.gameApi._cleanup();
    }
    this.gameApi = null;
    this.mountedGameId = null;
  },

  makeGameApi() {
    const listeners = [];
    const unmountFns = [];
    const self = this;
    const api = {
      socket: this.socket,
      me: this.me,
      getRoom: () => self.room,
      players: () => (self.room ? self.room.players : []),
      isHost: () => self.isHost,
      send(type, data) { self.socket.emit('gameEvent', { type, data }); },
      on(event, fn) { self.socket.on(event, fn); listeners.push([event, fn]); },
      onUnmount(fn) { unmountFns.push(fn); },
      toast: (m) => self.toast(m),
      refreshScore: () => self.updateMiniScore(),
      GUI,
      _unmountFns: unmountFns,
      _cleanup() { listeners.forEach(([e, f]) => self.socket.off(e, f)); },
    };
    return api;
  },

  // ── 결과 ────────────────────────────────
  renderResult() {
    this.teardownGame();
    const room = this.room;
    this.root.innerHTML = '';
    const scores = [...room.players].sort((a, b) => b.score - a.score);
    const winner = scores[0];
    const medals = ['🥇', '🥈', '🥉'];
    const g = this.games.find((x) => x.id === room.game) || {};

    const wrap = GUI.h(`<div class="fade-in">
      <div class="title" style="font-size:1.5rem">${g.emoji || '🎉'} ${GUI.esc(g.name || '')} 결과</div>
      <div class="card">
        <div class="winner"><span class="crown">👑</span>${winner ? GUI.esc(winner.name) + ' 승리!' : '무승부'}</div>
        <ul class="rank-list" id="ranks"></ul>
      </div>
      ${this.isHost ? `
        <button class="btn good" id="againBtn">🔁 같은 게임 한 번 더</button>
        <button class="btn accent" id="lobbyBtn">🎯 다른 게임 고르기</button>` : `
        <div class="center muted" style="padding:12px">방장이 다음 게임을 고르는 중…</div>`}
      <button class="btn ghost" id="leaveBtn">나가기</button>
    </div>`);
    this.root.appendChild(wrap);

    const ul = wrap.querySelector('#ranks');
    scores.forEach((p, i) => {
      ul.appendChild(GUI.h(`<li class="rank-row">
        <span class="medal">${medals[i] || i + 1}</span>
        <span class="nm">${GUI.esc(p.name)}${p.id === this.me.playerId ? ' (나)' : ''}</span>
        <span class="sc">${p.score}점</span>
      </li>`));
    });

    if (this.isHost) {
      wrap.querySelector('#againBtn').onclick = () => this.socket.emit('startGame');
      wrap.querySelector('#lobbyBtn').onclick = () => this.socket.emit('backToLobby');
    }
    wrap.querySelector('#leaveBtn').onclick = () => {
      this.socket.emit('leaveRoom');
      this.leaveLocal();
    };
  },

  // ── 토스트 ──────────────────────────────
  toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = GUI.h('<div class="toast"></div>'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  },
};

// URL에 ?code=ABCD 가 있으면 코드칸에 자동 입력
window.addEventListener('DOMContentLoaded', () => {
  App.init().then(() => {
    const code = new URLSearchParams(location.search).get('code');
    if (code && !App.me.roomCode) {
      const input = document.getElementById('codeInput');
      if (input) input.value = code.toUpperCase().slice(0, 4);
    }
  });
});

window.App = App;
