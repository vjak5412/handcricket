const socket = new WebSocket("wss://your-render-app-name.onrender.com"); // Replace with your Render WebSocket URL

let playerName = "";
let roomCode = "";
let playerId = "";
let isAdmin = false;
let gameMode = "";
let overs = 1;
let players = [];

// 🎮 JOIN OR CREATE GAME
function createRoom() {
  playerName = document.getElementById("playerName").value.trim();
  gameMode = document.getElementById("gameMode").value;
  overs = parseInt(document.getElementById("oversSelect").value);

  if (!playerName || !overs || !gameMode) return alert("Please fill all fields.");

  const msg = {
    type: "createRoom",
    name: playerName,
    gameMode,
    overs,
  };

  socket.send(JSON.stringify(msg));
}

function joinRoom() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("joinRoomCode").value.trim();

  if (!playerName || !roomCode) return alert("Enter name and room code");

  const msg = {
    type: "joinRoom",
    name: playerName,
    roomCode,
  };

  socket.send(JSON.stringify(msg));
}

// 📩 WEBSOCKET LISTENER
socket.onmessage = function (event) {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "roomCreated":
      roomCode = data.roomCode;
      isAdmin = true;
      playerId = data.playerId;
      players = data.players;
      showLobby();
      break;

    case "joinedRoom":
      roomCode = data.roomCode;
      isAdmin = false;
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

    case "chat":
      addToChat(data.message);
      break;

    case "error":
      alert(data.message);
      break;

    // More cases coming in next files (toss, gameplay, scoring)
  }
};

// 🎬 UI: LOBBY
function showLobby() {
  document.querySelectorAll("div[id$='Screen']").forEach(div => div.classList.add("hidden"));
  document.getElementById("lobbyScreen").classList.remove("hidden");
  document.getElementById("roomCodeText").textContent = roomCode;

  if (isAdmin) {
    document.getElementById("captainSelector").classList.remove("hidden");
    document.getElementById("startGameBtn").classList.remove("hidden");
  }
  updatePlayerList();
}

function updatePlayerList() {
  const container = document.getElementById("playerList");
  container.innerHTML = "";

  players.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "p-2 bg-gray-700 rounded";
    div.textContent = `👤 ${p.name} ${p.id === playerId ? "(You)" : ""}`;
    container.appendChild(div);

    // Populate captain selector if admin
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

// 🟨 Start Game (Admin only)
function startGame() {
  const captainA = document.getElementById("captainTeamA").value;
  const captainB = document.getElementById("captainTeamB").value;

  if (!captainA || !captainB) return alert("Select captains for both teams.");

  const msg = {
    type: "startGame",
    roomCode,
    captainA,
    captainB,
  };

  socket.send(JSON.stringify(msg));
}

// 💬 Chat system (optional, WIP)
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
