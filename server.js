// server.js
const express = require("express");
const { createServer } = require("http");
const { WebSocketServer } = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const PORT = process.env.PORT || 10000;
const rooms = {};

// ✅ Health check route for Render
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// 🌐 WebSocket connection handler
wss.on("connection", (ws) => {
  ws.id = uuidv4();

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (err) {
      console.error("Invalid message received:", message);
    }
  });

  ws.on("close", () => {
    // Optional: Handle disconnects later
  });
});

// 🧠 Message router
function handleMessage(ws, data) {
  switch (data.type) {
    case "createRoom": return handleCreateRoom(ws, data);
    case "joinRoom": return handleJoinRoom(ws, data);
    case "startGame": return handleStartGame(ws, data);
    case "tossChoice": return handleTossChoice(ws, data);
    case "turnChoice": return handleTurnChoice(ws, data);
    case "nextBatter":
    case "nextBowler": return handleNextPlayer(ws, data);
    case "chat": return handleChat(ws, data);
  }
}

// 📌 Room creation
function handleCreateRoom(ws, data) {
  const roomCode = generateRoomCode();
  const playerId = uuidv4();
  ws.id = playerId;

  rooms[roomCode] = {
    players: [{ id: playerId, name: data.name, ws }],
    admin: playerId,
    gameMode: data.gameMode,
    overs: data.overs,
    started: false,
    scores: {},
    teams: { A: [], B: [] },
    captains: {},
    tossDone: false,
    gameData: {}
  };

  ws.send(JSON.stringify({
    type: "roomCreated",
    roomCode,
    playerId,
    players: getPlayerSummaries(roomCode)
  }));
}

function handleJoinRoom(ws, data) {
  const room = rooms[data.roomCode];
  if (!room) return ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
  if (room.started) return ws.send(JSON.stringify({ type: "error", message: "Game already started" }));

  const playerId = uuidv4();
  ws.id = playerId;
  room.players.push({ id: playerId, name: data.name, ws });

  broadcastToRoom(data.roomCode, {
    type: "updatePlayers",
    players: getPlayerSummaries(data.roomCode)
  });

  ws.send(JSON.stringify({
    type: "joinedRoom",
    roomCode: data.roomCode,
    playerId,
    players: getPlayerSummaries(data.roomCode)
  }));
}

function handleStartGame(ws, data) {
  const room = rooms[data.roomCode];
  if (!room || ws.id !== room.admin) return;

  room.captains = { A: data.captainA, B: data.captainB };
  room.started = true;
  assignTeams(room);
  room.gameData = initGameData(room);

  broadcastToRoom(data.roomCode, { type: "startGame" });
  handleToss(data.roomCode);
}

function assignTeams(room) {
  room.players.forEach((p, i) => {
    p.team = i % 2 === 0 ? "A" : "B";
    room.teams[p.team].push(p.id);
  });
}

function initGameData(room) {
  return {
    scores: { A: 0, B: 0 },
    wickets: { A: 0, B: 0 },
    overs: room.overs,
    balls: 0,
    innings: 1,
    target: null,
    teamOrder: ["A", "B"],
    current: {
      battingTeam: "A",
      bowlingTeam: "B",
      batter: room.teams.A[0],
      bowler: room.teams.B[0]
    },
    usedBatters: [],
    usedBowlers: [],
    waitingForCaptain: false
  };
}

function handleToss(roomCode) {
  const room = rooms[roomCode];
  const tossMessage = "Team A won the toss and chose to bat first.";
  room.tossDone = true;
  broadcastToRoom(roomCode, { type: "toss", message: tossMessage });

  setTimeout(() => requestCaptain(roomCode, "nextBatter"), 2000);
}

function handleTossChoice(ws, data) {
  // Optional: if you want captain to choose
}

function handleTurnChoice(ws, data) {
  const room = rooms[data.roomCode];
  const gd = room.gameData;
  const pid = ws.id;

  if (!gd.current.batterChoice) gd.current.batterChoice = {};
  if (!gd.current.bowlerChoice) gd.current.bowlerChoice = {};

  if (pid === gd.current.batter) {
    gd.current.batterChoice = { id: pid, number: data.number };
  }
  if (pid === gd.current.bowler) {
    gd.current.bowlerChoice = { id: pid, number: data.number };
  }

  if (gd.current.batterChoice && gd.current.bowlerChoice) {
    const bat = gd.current.batterChoice.number;
    const bowl = gd.current.bowlerChoice.number;
    let result;

    if (bat === bowl) {
      gd.wickets[gd.current.battingTeam]++;
      gd.usedBatters.push(gd.current.batter);
      result = `OUT! Batter: ${bat}, Bowler: ${bowl}`;
      requestCaptain(data.roomCode, "nextBatter");
    } else {
      gd.scores[gd.current.battingTeam] += bat;
      result = `Runs: ${bat} (Batter: ${bat}, Bowler: ${bowl})`;
      gd.usedBowlers.push(gd.current.bowler);
      requestCaptain(data.roomCode, "nextBowler");
    }

    gd.balls++;
    if (checkInningsEnd(room)) {
      handleInningsEnd(data.roomCode);
    }

    broadcastToRoom(data.roomCode, {
      type: "turnResult",
      message: result
    });

    gd.current.batterChoice = null;
    gd.current.bowlerChoice = null;
  }
}

function checkInningsEnd(room) {
  const gd = room.gameData;
  const maxBalls = gd.overs * 6;
  const team = gd.current.battingTeam;
  return gd.balls >= maxBalls || gd.wickets[team] >= (room.teams[team].length - 1);
}

function handleInningsEnd(roomCode) {
  const room = rooms[roomCode];
  const gd = room.gameData;

  if (gd.innings === 1) {
    gd.innings = 2;
    gd.target = gd.scores[gd.current.battingTeam] + 1;
    [gd.current.battingTeam, gd.current.bowlingTeam] = [gd.current.bowlingTeam, gd.current.battingTeam];
    [room.teams.A, room.teams.B] = [room.teams.B, room.teams.A];
    gd.usedBatters = [];
    gd.usedBowlers = [];
    gd.balls = 0;
    gd.wickets = { A: 0, B: 0 };

    broadcastToRoom(roomCode, {
      type: "endInnings",
      message: `End of 1st innings. Target: ${gd.target}`
    });
    setTimeout(() => requestCaptain(roomCode, "nextBatter"), 2000);
  } else {
    const a = gd.scores.A;
    const b = gd.scores.B;
    const msg = b > a ? "Team B wins!" : a > b ? "Team A wins!" : "Match Tied!";
    broadcastToRoom(roomCode, { type: "gameOver", message: msg });
  }
}

function requestCaptain(roomCode, type) {
  const room = rooms[roomCode];
  const gd = room.gameData;
  const team = type === "nextBatter" ? gd.current.battingTeam : gd.current.bowlingTeam;
  const list = room.teams[team];
  const used = type === "nextBatter" ? gd.usedBatters : gd.usedBowlers;
  const options = list.filter(id => !used.includes(id)).map(id => {
    const p = room.players.find(p => p.id === id);
    return { id: p.id, name: p.name };
  });
  if (options.length === 0) return;
  const captainId = room.captains[team];
  const captain = room.players.find(p => p.id === captainId);
  if (captain?.ws) {
    captain.ws.send(JSON.stringify({ type, options }));
  }
}

function handleNextPlayer(ws, data) {
  const room = rooms[data.roomCode];
  if (!room) return;
  const role = data.type === "nextBatter" ? "bat" : "bowl";
  const player = room.players.find(p => p.id === data.selectedId);
  const gd = room.gameData;
  gd.current[role === "bat" ? "batter" : "bowler"] = data.selectedId;
  if (player?.ws) player.ws.send(JSON.stringify({ type: "yourTurn", role }));
}

function handleChat(ws, data) {
  broadcastToRoom(data.roomCode, {
    type: "chat",
    message: `💬 ${data.name}: ${data.message}`
  });
}

function getPlayerSummaries(code) {
  return rooms[code].players.map(p => ({ id: p.id, name: p.name }));
}

function broadcastToRoom(code, msg) {
  rooms[code]?.players.forEach(p => {
    if (p.ws?.readyState === 1) p.ws.send(JSON.stringify(msg));
  });
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
