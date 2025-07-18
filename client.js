// ✅ UPDATED client.js with working game flow, admin-restricted captain selection, interactive toss

const socket = new WebSocket("wss://handcricket-gbz6.onrender.com");

let playerName = "";
let roomCode = "";
let playerId = "";
let isAdmin = false;
let gameMode = "";
let overs = 1;
let players = [];
let isMyTurn = false;

// 🔽 DYNAMIC OVERS DROPDOWN INIT
window.addEventListener("DOMContentLoaded", () => {
  const oversDropdown = document.getElementById("overs");
  if (oversDropdown) {
    for (let i = 1; i <= 20; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${i} Over${i > 1 ? 's' : ''}`;
      oversDropdown.appendChild(opt);
    }
  }
});

// 🔹 CREATE ROOM
function createRoom() {
  playerName = document.getElementById("playerName").value.trim();
  gameMode = document.getElementById("gameMode").value;
  overs = parseInt(document.getElementById("overs").value);
  if (!playerName || !overs || !gameMode) return alert("Please fill all fields.");

  socket.send(JSON.stringify({
    type: "createRoom",
    name: playerName,
    gameMode,
    overs
  }));
}

// 🔹 JOIN ROOM
function joinRoom() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("joinRoomCode").value.trim();
  if (!playerName || !roomCode) return alert("Enter name and room code");

  socket.send(JSON.stringify({
    type: "joinRoom",
    name: playerName,
    roomCode
  }));
}

// 🔹 SOCKET EVENTS
socket.onmessage = function (event) {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "roomCreated":
      isAdmin = true;
      roomCode = data.roomCode;
      playerId = data.playerId;
      players = data.players;
      showLobby();
      break;

    case "joinedRoom":
      isAdmin = false;
      roomCode = data.roomCode;
      playerId = data.playerId;
      players = data.players;
      showLobby();
      break;

    case "updatePlayers":
      players = data.players;
      updatePlayerList();
      break;

    case "startGame":
      document.getElementById("lobbyScreen").classList.add("hidden");
      document.getElementById("gameScreen").classList.remove("hidden");
      break;

    case "tossRequest":
      showTossOptions(data);
      break;

    case "tossResult":
      handleTossResult(data);
      break;

    case "chooseBatBowl":
      showBatBowlChoice(data);
      break;

    case "yourTurn":
      handleYourTurn(data);
      break;

    case "turnResult":
      updateGameLog(data);
      break;

    case "nextBowler":
    case "nextBatter":
      showCaptainChoice(data);
      break;

    case "endInnings":
      handleInningsEnd(data);
      break;

    case "gameOver":
      showWinner(data);
      break;

    case "chat":
      addToChat(data.message);
      break;

    case "error":
      alert(data.message);
      break;
  }
};

function showLobby() {
  document.querySelectorAll("div[id$='Screen']").forEach(div => div.classList.add("hidden"));
  document.getElementById("lobbyScreen").classList.remove("hidden");
  document.getElementById("roomCodeText").textContent = roomCode;
  document.getElementById("startGameBtn").classList.toggle("hidden", !isAdmin);
  document.getElementById("captainSelector").classList.toggle("hidden", !isAdmin);
  updatePlayerList();
}

function updatePlayerList() {
  const container = document.getElementById("playerList");
  container.innerHTML = "";

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "p-2 bg-gray-700 rounded";
    div.textContent = `👤 ${p.name} ${p.id === playerId ? "(You)" : ""}`;
    container.appendChild(div);

    if (isAdmin) {
      ["captainTeamA", "captainTeamB"].forEach(selId => {
        const sel = document.getElementById(selId);
        if (![...sel.options].some(opt => opt.value === p.id)) {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.text = p.name;
          sel.appendChild(opt);
        }
      });
    }
  });
}

function startGame() {
  const captainA = document.getElementById("captainTeamA").value;
  const captainB = document.getElementById("captainTeamB").value;
  if (!captainA || !captainB) return alert("Select captains for both teams.");

  socket.send(JSON.stringify({
    type: "startGame",
    roomCode,
    captainA,
    captainB
  }));
}

function showTossOptions(data) {
  const tossDiv = document.getElementById("tossSection");
  tossDiv.innerHTML = `<h2 class="text-lg font-bold text-yellow-400">🪙 Toss Time</h2>
    <p>Choose Heads or Tails:</p>
    <div class="flex gap-4 justify-center">
      <button onclick="sendTossChoice('Heads')" class="bg-yellow-500 px-4 py-2 rounded">Heads</button>
      <button onclick="sendTossChoice('Tails')" class="bg-yellow-500 px-4 py-2 rounded">Tails</button>
    </div>`;
}

function sendTossChoice(choice) {
  socket.send(JSON.stringify({
    type: "tossChoice",
    roomCode,
    choice
  }));
  document.getElementById("tossSection").innerHTML = "Waiting for result...";
}

function handleTossResult(data) {
  const tossDiv = document.getElementById("tossSection");
  tossDiv.innerHTML = `<h2 class="text-lg font-bold">🪙 Toss Result</h2><p>${data.message}</p>`;
}

function showBatBowlChoice(data) {
  const tossDiv = document.getElementById("tossSection");
  tossDiv.innerHTML += `<p>Choose to Bat or Bowl:</p>
    <div class="flex gap-4 justify-center">
      <button onclick="chooseBatBowl('bat')" class="bg-blue-500 px-4 py-2 rounded">Bat</button>
      <button onclick="chooseBatBowl('bowl')" class="bg-blue-500 px-4 py-2 rounded">Bowl</button>
    </div>`;
}

function chooseBatBowl(decision) {
  socket.send(JSON.stringify({
    type: "batBowlChoice",
    roomCode,
    decision
  }));
  document.getElementById("tossSection").innerHTML = "Preparing match...";
}

function handleYourTurn(data) {
  isMyTurn = true;
  const turnSection = document.getElementById("turnSection");
  turnSection.classList.remove("hidden");
  document.getElementById("currentRoleText").textContent = data.role === "bat" ? "You're Batting!" : "You're Bowling!";
  document.getElementById("gamePrompt").textContent = "Pick a number (1–6)";
}

function selectNumber(n) {
  if (!isMyTurn) return;
  socket.send(JSON.stringify({ type: "turnChoice", roomCode, number: n }));
  isMyTurn = false;
  document.getElementById("turnSection").classList.add("hidden");
}

function updateGameLog(data) {
  const log = document.getElementById("gameLog");
  const entry = document.createElement("div");
  entry.textContent = data.message;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function showCaptainChoice(data) {
  const turnSection = document.getElementById("turnSection");
  turnSection.classList.remove("hidden");
  document.getElementById("currentRoleText").textContent = "🧑‍✈️ Captain Decision";
  document.getElementById("gamePrompt").innerHTML = `Choose the next ${data.type === "nextBowler" ? "Bowler" : "Batter"}:`;

  const container = document.createElement("div");
  container.className = "flex gap-2 justify-center mt-2";

  data.options.forEach(player => {
    const btn = document.createElement("button");
    btn.className = "bg-purple-600 px-3 py-1 rounded";
    btn.textContent = player.name;
    btn.onclick = () => {
      socket.send(JSON.stringify({
        type: data.type,
        roomCode,
        selectedId: player.id
      }));
      turnSection.classList.add("hidden");
    };
    container.appendChild(btn);
  });

  turnSection.appendChild(container);
}

function handleInningsEnd(data) {
  const log = document.getElementById("gameLog");
  const entry = document.createElement("div");
  entry.innerHTML = `<hr class="my-2"/><strong>${data.message}</strong>`;
  log.appendChild(entry);
}

function showWinner(data) {
  document.getElementById("turnSection").classList.add("hidden");
  document.getElementById("gameLog").innerHTML += `<div class="text-xl font-bold text-green-400 mt-4">${data.message}</div>`;
}

document.getElementById("chatInput")?.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    const message = e.target.value.trim();
    if (message) {
      socket.send(JSON.stringify({ type: "chat", roomCode, message, name: playerName }));
      e.target.value = "";
    }
  }
});

function addToChat(msg) {
  const chatBox = document.getElementById("chatBox");
  chatBox.classList.remove("hidden");
  chatBox.innerHTML += `<div class="text-sm">${msg}</div>`;
}
