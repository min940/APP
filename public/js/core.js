// ─────────────────────────────────────────────────────────
// 공용 상태 & 헬퍼 (모든 게임 모듈이 window.G 로 접근)
// ─────────────────────────────────────────────────────────
const socket = io();

const G = {
  socket,
  me: null, // 내 playerId
  code: null,
  hostId: null,
  players: [],
  game: null,
  phase: "home",
  get isHost() { return G.me && G.me === G.hostId; },
  playerName(id) {
    const p = G.players.find((x) => x.id === id);
    return p ? p.nickname : "?";
  },
};
window.G = G;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $("#" + id).classList.add("active");
  window.scrollTo(0, 0);
}
window.showScreen = showScreen;

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
window.toast = toast;

function avatarFor(name) {
  const emojis = ["🐰", "🐱", "🐶", "🐼", "🦊", "🐨", "🐯", "🦁", "🐸", "🐥"];
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0);
  return emojis[sum % emojis.length];
}
window.avatarFor = avatarFor;

// ── 홈 화면 ────────────────────────────────────────────────
$("#btn-create").addEventListener("click", () => {
  const nickname = $("#input-nickname").value.trim();
  if (!nickname) return toast("이름을 먼저 입력해 주세요 🙂");
  socket.emit("room:create", { nickname }, (res) => {
    if (res?.ok) {
      G.me = res.playerId;
      G.code = res.code;
      showScreen("screen-lobby");
    }
  });
});

$("#btn-join").addEventListener("click", joinRoom);
$("#input-code").addEventListener("keydown", (e) => { if (e.key === "Enter") joinRoom(); });

function joinRoom() {
  const nickname = $("#input-nickname").value.trim();
  const code = $("#input-code").value.trim();
  if (!nickname) return toast("이름을 먼저 입력해 주세요 🙂");
  if (code.length !== 4) return toast("방 번호 4자리를 입력해 주세요.");
  socket.emit("room:join", { code, nickname }, (res) => {
    if (res?.ok) {
      G.me = res.playerId;
      G.code = res.code;
      showScreen("screen-lobby");
    } else {
      toast(res?.error || "방에 들어갈 수 없어요.");
    }
  });
}

// ── 방 공유 ────────────────────────────────────────────────
$("#btn-share").addEventListener("click", async () => {
  const text = `우리집 게임방에서 같이 놀아요! 🎮\n방 번호: ${G.code}\n${location.origin} 에 접속해서 번호를 입력하세요.`;
  try {
    if (navigator.share) await navigator.share({ title: "우리집 게임방", text });
    else { await navigator.clipboard.writeText(text); toast("초대 메시지를 복사했어요!"); }
  } catch (_) {
    try { await navigator.clipboard.writeText(G.code); toast("방 번호를 복사했어요!"); } catch { toast("방 번호: " + G.code); }
  }
});

// ── 방 상태 업데이트 ──────────────────────────────────────
socket.on("room:update", (room) => {
  G.code = room.code;
  G.hostId = room.hostId;
  G.players = room.players;
  G.game = room.game;
  G.phase = room.phase;

  $("#lobby-code").textContent = room.code;
  renderPlayerList();
  renderGameSelection();
  updateHostControls();
});

function renderPlayerList() {
  const ul = $("#player-list");
  ul.innerHTML = "";
  $("#player-count").textContent = G.players.length;
  for (const p of G.players) {
    const li = document.createElement("li");
    li.className = "player-item" + (p.id === G.me ? " me" : "") + (p.connected ? "" : " disconnected");
    li.innerHTML = `
      <span class="player-avatar">${avatarFor(p.nickname)}</span>
      <span>${escapeHtml(p.nickname)}${p.id === G.me ? " (나)" : ""}</span>
      ${p.isHost ? '<span class="host-tag">방장</span>' : ""}`;
    ul.appendChild(li);
  }
}

function renderGameSelection() {
  $$("#game-grid .game-card").forEach((c) => {
    c.classList.toggle("selected", c.dataset.game === G.game);
  });
}

function updateHostControls() {
  const hostCtrl = $("#host-controls");
  const guestWait = $("#guest-wait");
  const grid = $("#game-grid");
  if (G.isHost) {
    hostCtrl.classList.remove("hidden");
    guestWait.classList.add("hidden");
    grid.style.pointerEvents = "auto";
    grid.style.opacity = "1";
    const btn = $("#btn-start");
    btn.disabled = !G.game || G.players.length < 2;
    btn.textContent = G.game ? "게임 시작 ▶" : "먼저 게임을 골라주세요";
  } else {
    hostCtrl.classList.add("hidden");
    guestWait.classList.remove("hidden");
    grid.style.pointerEvents = "none";
    grid.style.opacity = "0.75";
    guestWait.textContent = G.game
      ? `방장이 '${gameLabel(G.game)}'을(를) 골랐어요. 곧 시작해요! 😊`
      : "방장이 게임을 고르는 중이에요. 잠시만 기다려 주세요 😊";
  }
}

function gameLabel(g) {
  return { quiz: "퀴즈 배틀", draw: "그림 맞히기", bingo: "빙고" }[g] || g;
}
window.gameLabel = gameLabel;

// ── 게임 선택/시작 ────────────────────────────────────────
$$("#game-grid .game-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (!G.isHost) return;
    socket.emit("room:chooseGame", { game: card.dataset.game });
  });
});

$("#btn-start").addEventListener("click", () => socket.emit("game:start"));
$("#btn-leave-game").addEventListener("click", () => {
  if (G.isHost) socket.emit("game:backToLobby");
  else toast("방장만 나갈 수 있어요. 게임이 끝나면 로비로 돌아가요!");
});
$("#btn-again").addEventListener("click", () => socket.emit("game:backToLobby"));

// ── 미니 점수판 ───────────────────────────────────────────
function renderMiniScores(scores) {
  const box = $("#mini-scores");
  box.innerHTML = "";
  const top = scores.length ? Math.max(...scores.map((s) => s.score)) : 0;
  for (const s of scores) {
    const el = document.createElement("div");
    el.className = "mini-score" + (s.score === top && top > 0 ? " leader" : "") + (s.id === G.me ? " me" : "");
    el.innerHTML = `<div class="ms-name">${escapeHtml(s.nickname)}</div><div class="ms-pts">${s.score}</div>`;
    box.appendChild(el);
  }
}
window.renderMiniScores = renderMiniScores;

// ── 채팅 ──────────────────────────────────────────────────
$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text) return;
  socket.emit("chat:send", { text });
  input.value = "";
});

function addChat({ from, text, cls }) {
  const log = $("#chat-log");
  const div = document.createElement("div");
  div.className = "chat-msg" + (cls ? " " + cls : "");
  if (from) div.innerHTML = `<span class="cm-name">${escapeHtml(from)}</span> ${escapeHtml(text)}`;
  else div.innerHTML = escapeHtml(text);
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
window.addChat = addChat;
function clearChat() { $("#chat-log").innerHTML = ""; }
window.clearChat = clearChat;

socket.on("chat:msg", (m) => addChat({ from: m.from, text: m.text }));
socket.on("toast", (msg) => toast(msg));

// ── 게임 시작/종료 라우팅 ─────────────────────────────────
socket.on("game:begin", (data) => {
  showScreen("screen-game");
  $("#game-title").textContent = gameLabel(data.game);
  $("#game-round").textContent = "";
  $("#game-body").innerHTML = "";
  $("#chat-panel").classList.add("hidden");
  clearChat();
  renderMiniScores(G.players.map((p) => ({ id: p.id, nickname: p.nickname, score: 0 })));

  if (data.game === "quiz") Quiz.init(data);
  else if (data.game === "bingo") Bingo.init(data);
  else if (data.game === "draw") Draw.init(data);
});

socket.on("game:toLobby", () => showScreen("screen-lobby"));

socket.on("game:end", (data) => {
  showScreen("screen-result");
  const winnerText = data.bingoWinners?.length
    ? `${data.bingoWinners.join(", ")} 빙고 완성! 🎉`
    : data.winners?.length
      ? (data.winners.length === 1 ? `${data.winners[0]} 우승! 🎉` : `공동 우승: ${data.winners.join(", ")} 🎉`)
      : "다 함께 잘했어요! 👏";
  $("#result-winner").textContent = winnerText;

  const ol = $("#result-scores");
  ol.innerHTML = "";
  for (const s of data.scores) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="player-avatar">${avatarFor(s.nickname)}</span>
      <span>${escapeHtml(s.nickname)}</span><span class="rs-pts">${s.score}점</span>`;
    ol.appendChild(li);
  }
  $("#result-host-controls").classList.toggle("hidden", !G.isHost);
  $("#result-guest-wait").classList.toggle("hidden", G.isHost);
});

// 게임 중 로비 복귀(방장이 나가기)
socket.on("room:update", (room) => {
  // 게임이 끝나 lobby로 돌아왔는데 결과/게임 화면이면 로비로
  if (room.phase === "lobby" && ["screen-game"].includes(currentScreen())) {
    showScreen("screen-lobby");
  }
});

function currentScreen() {
  const s = $$(".screen").find((x) => x.classList.contains("active"));
  return s ? s.id : null;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
window.escapeHtml = escapeHtml;

// 연결 상태 알림
socket.on("connect", () => { if (G.phase !== "home") toast("다시 연결됐어요 ✅"); });
socket.on("disconnect", () => toast("연결이 끊겼어요. 다시 연결 중… 🔌"));
