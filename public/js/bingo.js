// 🔢 빙고 (클라이언트)
const Bingo = (() => {
  let board = [];      // 내 판 (숫자 배열, 인덱스=위치)
  let marked = [];     // 외쳐진 숫자
  let myTurn = false;
  let target = 3;

  function init(data) {
    board = []; marked = []; myTurn = false;
    G.socket.off("bingo:board").on("bingo:board", (d) => { board = d.board; target = d.target; render(); });
    G.socket.off("bingo:turn").on("bingo:turn", onTurn);
    G.socket.off("bingo:called").on("bingo:called", onCalled);
    G.socket.off("bingo:lines").on("bingo:lines", onLines);

    document.querySelector("#game-round").textContent = `${target}줄 먼저!`;
    document.querySelector("#game-body").innerHTML = `
      <div class="bingo-turn" id="bingo-turn">게임 준비 중…</div>
      <div class="bingo-grid" id="bingo-grid"></div>
      <div class="bingo-lines-badge" id="bingo-lines">완성한 줄: <b>0</b></div>
      <div class="called-list" id="called-list"></div>`;
  }

  function render() {
    const grid = document.querySelector("#bingo-grid");
    if (!grid) return;
    grid.innerHTML = "";
    board.forEach((num) => {
      const cell = document.createElement("button");
      const isMarked = marked.includes(num);
      cell.className = "bingo-cell" + (isMarked ? " marked" : "") + (myTurn && !isMarked ? " callable" : "");
      cell.textContent = num;
      cell.disabled = !myTurn || isMarked;
      cell.addEventListener("click", () => call(num));
      grid.appendChild(cell);
    });
  }

  function call(num) {
    if (!myTurn || marked.includes(num)) return;
    myTurn = false; // 중복 클릭 방지
    G.socket.emit("bingo:call", { number: num });
  }

  function onTurn({ turnId, nickname }) {
    myTurn = turnId === G.me;
    const el = document.querySelector("#bingo-turn");
    if (el) {
      el.classList.toggle("my-turn", myTurn);
      el.textContent = myTurn ? "👉 내 차례! 부를 숫자를 눌러요" : `${nickname}님 차례예요…`;
    }
    render();
  }

  function onCalled({ number, by }) {
    marked.push(number);
    const list = document.querySelector("#called-list");
    if (list) {
      const chip = document.createElement("span");
      chip.className = "called-chip";
      chip.textContent = number;
      list.appendChild(chip);
    }
    toast(`${by}님이 "${number}"!`);
    render();
  }

  function onLines({ results, marked: serverMarked }) {
    marked = serverMarked;
    const mine = results.find((r) => r.id === G.me);
    const badge = document.querySelector("#bingo-lines");
    if (badge && mine) badge.innerHTML = `완성한 줄: <b>${mine.lines}</b> / ${target}`;
    render();
  }

  return { init };
})();
window.Bingo = Bingo;
