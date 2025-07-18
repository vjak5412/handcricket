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
});
