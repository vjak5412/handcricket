// ✅ client.js — Handles UI, WebSocket events, and game logic for Hand Cricket
const socket = new WebSocket("wss://handcricket-gbz6.onrender.com");
let playerId = "";
let roomCode = "";
let isAdmin = false;
let players = [];

const nameInput = document.getElementById("playerName");
const oversSelect = document.getElementById("overs");
const gameModeSelect = document.getElementById("gameMode");
const playerListDiv = document.getElementById("playerList");
const roomCodeText = document.getElementById("roomCodeText");
const captainSelector = document.getElementById("captainSelector");
const startGameBtn = document.getElementById("startGameBtn");
const captainTeamA = document.getElementById("captainTeamA");
const captainTeamB = document.getElementById("captainTeamB");
const gameLog = document.getElementById("gameLog");
const numberButtons = document.getElementById("numberButtons");
const turnSection = document.getElementById("turnSection");
const currentRoleText = document.getElementById("currentRoleText");

function createRoom() {
  const name = nameInput.value.trim();
  const overs = parseInt(oversSelect.value);
  const gameMode = gameModeSelect.value;
  if (!name || !overs) return alert("Enter name and overs");
  socket.send(JSON.stringify({ type: "createRoom", name, overs, gameMode }));
}
// ✅ client.js - Complete WebSocket + UI logic for Hand Cricket

const socket = new WebSocket("wss://handcricket-gbz6.onrender.com");

let playerId = "";
let playerName = "";
let roomCode = "";
let isAdmin = false;
let players = [];
let overs = 1;

// ===============================
// 🌐 WebSocket Message Handler
// ===============================
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case "roomCreated":
      handleRoomCreated(data);
      break;
    case "joinedRoom":
      handleJoinedRoom(data);
      break;
    case "updatePlayers":
      updateLobby(data.players);
      break;
    case "toss":
      showToss(data.message);
      break;
    case "yourTurn":
      showYourTurn(data);
      break;
    case "turnResult":
      logMessage(data.message);
      break;
    case "chat":
      addChatMessage(data.message);
      break;
    case "error":
      alert(data.message);
      break;
  }
};

// ===============================
// ✅ UI Transitions
// ===============================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(div => div.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function logMessage(msg) {
  const log = document.getElementById("gameLog");
  const div = document.createElement("div");
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function addChatMessage(msg) {
  const chat = document.getElementById("chatBox");
  chat.innerHTML += `<div class="text-sm">${msg}</div>`;
}

// ===============================
// 🛠 Utility
// ===============================
function fillOversDropdown() {
  const sel = document.getElementById("oversSelect");
  for (let i = 1; i <= 20; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${i} Over${i > 1 ? "s" : ""}`;
    sel.appendChild(opt);
  }
}

// ===============================
// 🧠 WebSocket Event Responses
// ===============================
function handleRoomCreated(data) {
  playerId = data.playerId;
  roomCode = data.roomCode;
  players = data.players;
  isAdmin = true;
  updateLobby(players);
  showScreen("lobbyScreen");
  document.getElementById("roomCodeText").textContent = roomCode;
  document.getElementById("startGameBtn").classList.remove("hidden");
  document.getElementById("captainSelectors").classList.remove("hidden");
}

function handleJoinedRoom(data) {
  playerId = data.playerId;
  roomCode = data.roomCode;
  players = data.players;
  isAdmin = false;
  updateLobby(players);
  showScreen("lobbyScreen");
  document.getElementById("roomCodeText").textContent = roomCode;
}

function updateLobby(playersList) {
  players = playersList;
  const container = document.getElementById("playerList");
  container.innerHTML = "";
  const capA = document.getElementById("captainA");
  const capB = document.getElementById("captainB");
  capA.innerHTML = "<option value=''>--Select--</option>";
  capB.innerHTML = "<option value=''>--Select--</option>";

  players.forEach(p => {
    const div = document.createElement("div");
    div.textContent = `${p.name}${p.id === playerId ? " (You)" : ""}`;
    container.appendChild(div);

    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    capA.appendChild(opt.cloneNode(true));
    capB.appendChild(opt);
  });
}

function showToss(message) {
  showScreen("gameScreen");
  document.getElementById("tossInfo").textContent = message;
}

function showYourTurn(data) {
  const roleText = document.getElementById("turnRole");
  const prompt = document.getElementById("gamePrompt");
  const buttons = document.getElementById("turnButtons");

  buttons.innerHTML = "";
  for (let i = 1; i <= 6; i++) {
    const btn = document.createElement("button");
    btn.className = "bg-blue-600 rounded px-3 py-1";
    btn.textContent = i;
    btn.onclick = () => {
      socket.send(JSON.stringify({
        type: "turnChoice",
        roomCode,
        number: i
      }));
      buttons.innerHTML = "<p class='text-yellow-400'>Waiting for opponent...</p>";
    };
    buttons.appendChild(btn);
  }

  roleText.textContent = data.role === "bat" ? "You're Batting" : "You're Bowling";
  prompt.textContent = "Pick a number (1–6)";
}

// ===============================
// 🎮 Game Control Actions
// ===============================
function createRoom() {
  playerName = document.getElementById("playerName").value.trim();
  overs = parseInt(document.getElementById("oversSelect").value);
  const gameMode = document.getElementById("gameMode").value;

  if (!playerName || !overs || !gameMode) {
    alert("Please enter name, game mode, and overs");
    return;
  }

  socket.send(JSON.stringify({
    type: "createRoom",
    name: playerName,
    gameMode,
    overs
  }));
}

function joinRoom() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("joinRoomCode").value.trim().toUpperCase();
  if (!playerName || !roomCode) return alert("Enter name and room code");

  socket.send(JSON.stringify({
    type: "joinRoom",
    name: playerName,
    roomCode
  }));
}

function startGame() {
  const captainA = document.getElementById("captainA").value;
  const captainB = document.getElementById("captainB").value;

  if (!captainA || !captainB) return alert("Select both captains");

  socket.send(JSON.stringify({
    type: "startGame",
    roomCode,
    captainA,
    captainB
  }));
}

// ===============================
// 💬 Chat Event Listener
// ===============================
document.getElementById("chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const message = e.target.value.trim();
    if (message) {
      socket.send(JSON.stringify({
        type: "chat",
        roomCode,
        message,
        name: playerName
      }));
      e.target.value = "";
    }
  }
});

// ===============================
// 🏁 On Page Load
// ===============================
window.onload = () => {
  fillOversDropdown();
  showScreen("homeScreen");
};

function joinRoom() {
  const name = nameInput.value.trim();
  const code = document.getElementById("joinRoomCode").value.trim().toUpperCase();
  if (!name || !code) return alert("Enter name and room code");
  socket.send(JSON.stringify({ type: "joinRoom", name, roomCode: code }));
}

function startGame() {
  const captainA = captainTeamA.value;
  const captainB = captainTeamB.value;
  if (!captainA || !captainB) return alert("Select captains");
  socket.send(JSON.stringify({ type: "startGame", roomCode, captainA, captainB }));
}

socket.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "roomCreated": {
      roomCode = msg.roomCode;
      playerId = msg.playerId;
      players = msg.players;
      isAdmin = true;
      showScreen("lobbyScreen");
      roomCodeText.textContent = roomCode;
      renderPlayerList();
      showAdminControls();
      break;
    }

    case "joinedRoom": {
      roomCode = msg.roomCode;
      playerId = msg.playerId;
      players = msg.players;
      isAdmin = false;
      showScreen("lobbyScreen");
      roomCodeText.textContent = roomCode;
      renderPlayerList();
      break;
    }

    case "updatePlayers": {
      players = msg.players;
      renderPlayerList();
      break;
    }

    case "startGame": {
      showScreen("gameScreen");
      break;
    }

    case "toss": {
      document.getElementById("tossSection").innerHTML = `<div class='text-xl'>${msg.message}</div>`;
      break;
    }

    case "nextBatter":
    case "nextBowler": {
      if (!msg.options || msg.options.length === 0) return;
      const role = msg.type === "nextBatter" ? "Next Batter" : "Next Bowler";
      const choice = prompt(`${role}: ${msg.options.map(p => p.name).join(", ")}`);
      const selected = msg.options.find(p => p.name === choice);
      if (selected) {
        socket.send(JSON.stringify({ type: msg.type, roomCode, selectedId: selected.id }));
      }
      break;
    }

    case "yourTurn": {
      const { role } = msg;
      currentRoleText.textContent = role === "bat" ? "Your Turn to Bat" : "Your Turn to Bowl";
      turnSection.classList.remove("hidden");
      numberButtons.innerHTML = "";
      [1, 2, 3, 4, 5, 6].forEach(n => {
        const btn = document.createElement("button");
        btn.textContent = n;
        btn.className = "bg-blue-600 px-4 py-2 rounded hover:bg-blue-700";
        btn.onclick = () => {
          socket.send(JSON.stringify({ type: "turnChoice", roomCode, number: n }));
          turnSection.classList.add("hidden");
        };
        numberButtons.appendChild(btn);
      });
      break;
    }

    case "turnResult": {
      gameLog.innerHTML += `<div>${msg.message}</div>`;
      gameLog.scrollTop = gameLog.scrollHeight;
      break;
    }

    case "endInnings": {
      gameLog.innerHTML += `<div class='text-yellow-300'>${msg.message}</div>`;
      break;
    }

    case "gameOver": {
      gameLog.innerHTML += `<div class='text-green-400 font-bold'>${msg.message}</div>`;
      break;
    }

    case "chat": {
      gameLog.innerHTML += `<div class='text-gray-400'>${msg.message}</div>`;
      break;
    }
  }
});

function showScreen(id) {
  document.querySelectorAll("div[id$='Screen']").forEach(div => div.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  if (id === "chatBox") document.getElementById("chatBox").classList.remove("hidden");
}

function renderPlayerList() {
  playerListDiv.innerHTML = players.map(p => `
    <div class="flex justify-between">
      <span>${p.name}</span>
      ${p.id === playerId ? '<span class="text-green-400">(You)</span>' : ""}
    </div>
  `).join("");
  if (isAdmin) {
    captainSelector.classList.remove("hidden");
    startGameBtn.classList.remove("hidden");
    captainTeamA.innerHTML = players.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
    captainTeamB.innerHTML = players.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
  }
}

// 💬 Chat handler
const chatInput = document.getElementById("chatInput");
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && chatInput.value.trim()) {
    socket.send(JSON.stringify({
      type: "chat",
      name: nameInput.value.trim(),
      message: chatInput.value.trim(),
      roomCode
    }));
    chatInput.value = "";
  }
}); // 📡 WebSocket connection to backend (update URL as needed)
const socket = new WebSocket("wss://handcricket-gbz6.onrender.com");

// 🔒 Game State Variables
let playerName = "";
let playerId = "";
let roomCode = "";
let isAdmin = false;
let gameMode = "";
let overs = 1;
let players = [];
let isMyTurn = false;

// 🎮 CREATE ROOM
function createRoom() {
  playerName = document.getElementById("playerName").value.trim();
  gameMode = document.getElementById("gameMode").value;
  overs = parseInt(document.getElementById("oversSelect").value);

  if (!playerName || !gameMode || !overs) return alert("Please fill all fields.");

  socket.send(JSON.stringify({
    type: "createRoom",
    name: playerName,
    gameMode,
    overs
  }));
}

// 🔌 JOIN ROOM
function joinRoom() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("joinRoomCode").value.trim().toUpperCase();
  if (!playerName || !roomCode) return alert("Enter name and room code");

  socket.send(JSON.stringify({
    type: "joinRoom",
    name: playerName,
    roomCode
  }));
}

// 🔃 Socket Listener
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case "roomCreated":
      handleRoomCreated(data);
      break;
    case "joinedRoom":
      handleRoomJoined(data);
      break;
    case "updatePlayers":
      players = data.players;
      updatePlayerList();
      break;
    case "startGame":
      document.getElementById("lobbyScreen").classList.add("hidden");
      document.getElementById("gameScreen").classList.remove("hidden");
      break;
    case "toss":
      showTossScreen(data);
      break;
    case "yourTurn":
      handleYourTurn(data);
      break;
    case "turnResult":
      updateGameLog(data.message);
      break;
    case "nextBatter":
    case "nextBowler":
      showCaptainChoice(data);
      break;
    case "endInnings":
      updateGameLog("\uD83C\uDFC1 " + data.message);
      break;
    case "gameOver":
      updateGameLog("\uD83C\uDFC6 " + data.message);
      break;
    case "chat":
      addToChat(data.message);
      break;
    case "error":
      alert(data.message);
      break;
  }
};

function handleRoomCreated(data) {
  isAdmin = true;
  playerId = data.playerId;
  roomCode = data.roomCode;
  players = data.players;
  showLobby();
}

function handleRoomJoined(data) {
  isAdmin = false;
  playerId = data.playerId;
  roomCode = data.roomCode;
  players = data.players;
  showLobby();
}

// 🛋️ Lobby UI
function showLobby() {
  hideAllScreens();
  document.getElementById("lobbyScreen").classList.remove("hidden");
  document.getElementById("roomCodeText").textContent = roomCode;
  document.getElementById("startGameBtn").classList.toggle("hidden", !isAdmin);
  updatePlayerList();
}

function updatePlayerList() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  players.forEach(p => {
    const el = document.createElement("div");
    el.textContent = `${p.name} ${p.id === playerId ? '(You)' : ''}`;
    el.className = "p-2 bg-gray-700 rounded";
    list.appendChild(el);

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

function hideAllScreens() {
  document.querySelectorAll("div[id$='Screen']").forEach(div => div.classList.add("hidden"));
}

// 🎬 Start Game
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

// 🪙 Toss
function showTossScreen(data) {
  const el = document.getElementById("tossSection");
  el.innerHTML = `<h2 class='text-xl font-bold'>\uD83C\uDFB2 Toss Time</h2><p>${data.message}</p>`;
}

// 🏀 Gameplay Turn
function handleYourTurn(data) {
  isMyTurn = true;
  const turnUI = document.getElementById("turnSection");
  turnUI.classList.remove("hidden");
  document.getElementById("currentRoleText").textContent = data.role === "bat" ? "You're Batting!" : "You're Bowling!";
  document.getElementById("gamePrompt").textContent = "Choose a number (1–6)";
}

function selectNumber(n) {
  if (!isMyTurn) return;
  socket.send(JSON.stringify({
    type: "turnChoice",
    roomCode,
    number: n
  }));
  isMyTurn = false;
  document.getElementById("turnSection").classList.add("hidden");
}

// 📄 Game Log
function updateGameLog(msg) {
  const log = document.getElementById("gameLog");
  const div = document.createElement("div");
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// 🧑‍👨 Captain Selection
function showCaptainChoice(data) {
  const container = document.createElement("div");
  container.className = "flex gap-2 justify-center mt-2";

  data.options.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = p.name;
    btn.className = "bg-purple-600 px-3 py-1 rounded";
    btn.onclick = () => {
      socket.send(JSON.stringify({
        type: data.type,
        roomCode,
        selectedId: p.id
      }));
      document.getElementById("turnSection").classList.add("hidden");
    };
    container.appendChild(btn);
  });

  const turnUI = document.getElementById("turnSection");
  turnUI.innerHTML = "<h3 class='text-xl font-bold'>Captain Decision</h3><p id='gamePrompt'>Choose player:</p>";
  turnUI.appendChild(container);
  turnUI.classList.remove("hidden");
}

// 💬 Chat
const chatInput = document.getElementById("chatInput");
chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const message = e.target.value.trim();
    if (message) {
      socket.send(JSON.stringify({
        type: "chat",
        roomCode,
        message,
        name: playerName
      }));
      e.target.value = "";
    }
  }
});

function addToChat(msg) {
  const chatBox = document.getElementById("chatBox");
  chatBox.classList.remove("hidden");
  chatBox.innerHTML += `<div class="text-sm">${msg}</div>`;
}

// 📊 Overs dropdown rendering
window.addEventListener("DOMContentLoaded", () => {
  const oversDropdown = document.getElementById("oversSelect");
  if (oversDropdown) {
    for (let i = 1; i <= 20; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${i} Over${i > 1 ? 's' : ''}`;
      oversDropdown.appendChild(opt);
    }
  }
});

