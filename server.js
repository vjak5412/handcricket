// ✅ Unified and Corrected server.js for Hand Cricket Multiplayer

const express = require("express");
const { createServer } = require("http");
const { WebSocketServer } = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const PORT = process.env.PORT || 10000;
const rooms = {};

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
    // Optional: handle player disconnects later
  });
});

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

function handleCreateRoom(ws, data) {
  const roomCode = generateRoomCode();
  const playerId = ws.id;

  rooms[roomCode] = {
    players: [{ id: playerId, name: data.name, ws }],
    admin: playerId,
    gameMode: data.gameMode,
    overs: data.overs,
    started: false,
    captains: {},
    gameData: {},
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

  const playerId = ws.id;
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

  // Auto team assignment (A/B alternating)
  room.players.forEach((p, i) => {
    p.team = i % 2 === 0 ? "A" : "B";
  });

  room.gameData = createGameData(room);

  broadcastToRoom(data.roomCode, { type: "startGame" });
  setTimeout(() => handleToss(data.roomCode), 1000);
}

function handleToss(roomCode) {
  const room = rooms[roomCode];
  const winner = Math.random() < 0.5 ? "A" : "B";
  room.gameData.battingTeam = winner;
  room.gameData.bowlingTeam = winner === "A" ? "B" : "A";

  broadcastToRoom(roomCode, {
    type: "toss",
    message: `Team ${winner} won the toss and chose to bat first.`
  });

  const captainId = room.captains[winner];
  const teamList = room.players.filter(p => p.team === winner);
  const options = teamList.map(p => ({ id: p.id, name: p.name }));

  sendToPlayer(captainId, room, {
    type: "nextBatter",
    options
  });
}

function handleNextPlayer(ws, data) {
  const room = rooms[data.roomCode];
  if (!room) return;

  const role = data.type === "nextBatter" ? "bat" : "bowl";

  sendToPlayer(data.selectedId, room, {
    type: "yourTurn",
    role
  });
}

function handleTurnChoice(ws, data) {
  const room = rooms[data.roomCode];
  if (!room) return;
  // Note: advanced logic to compare batter/bowler choices can be added here

  broadcastToRoom(data.roomCode, {
    type: "turnResult",
    message: `${ws.id} chose ${data.number}`
  });
}

function handleChat(ws, data) {
  const message = `${data.name}: ${data.message}`;
  broadcastToRoom(data.roomCode, {
    type: "chat",
    message
  });
}

function getPlayerSummaries(code) {
  return rooms[code]?.players.map(p => ({ id: p.id, name: p.name })) || [];
}

function sendToPlayer(id, room, msg) {
  const player = room.players.find(p => p.id === id);
  if (player) player.ws.send(JSON.stringify(msg));
}

function broadcastToRoom(code, msg) {
  rooms[code]?.players.forEach(p => p.ws.send(JSON.stringify(msg)));
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
