const WebSocket = require("ws");
const { v4: uuid } = require("uuid");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`✅ Server running on port ${PORT}`);

// Store all rooms and players
const rooms = {}; // { roomCode: { players, gameData, ... } }
const sockets = {}; // { playerId: ws }

wss.on("connection", (ws) => {
  const playerId = uuid();
  sockets[playerId] = ws;

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    const { type } = data;

    switch (type) {
      case "createRoom": {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
          players: [{ id: playerId, name: data.name, team: null }],
          host: playerId,
          gameMode: data.gameMode,
          overs: data.overs,
          gameState: "lobby",
          gameData: {},
        };

        ws.send(JSON.stringify({ type: "roomCreated", roomCode, playerId, players: rooms[roomCode].players }));
        break;
      }

      case "joinRoom": {
        const { roomCode, name } = data;
        if (!rooms[roomCode]) return send(ws, "error", { message: "Room not found." });

        const room = rooms[roomCode];
        room.players.push({ id: playerId, name, team: null });

        // Notify all
        broadcastRoom(roomCode, {
          type: "joinedRoom",
          roomCode,
          playerId,
          players: room.players,
        });
        break;
      }

      case "startGame": {
        const { roomCode, captainA, captainB } = data;
        const room = rooms[roomCode];
        if (!room) return;

        room.captains = { A: captainA, B: captainB };
        room.players.forEach((p, i) => {
          p.team = i % 2 === 0 ? "A" : "B";
        });

        room.gameState = "playing";
        room.gameData = createGameData(room);

        broadcastRoom(roomCode, { type: "startGame" });
        handleToss(roomCode);
        break;
      }

      case "turnChoice": {
        const { roomCode, number } = data;
        handleTurn(roomCode, playerId, number);
        break;
      }

      case "nextBatter":
      case "nextBowler": {
        const { roomCode, selectedId } = data;
        const gd = rooms[roomCode].gameData;
        if (data.type === "nextBatter") gd.current.batter = selectedId;
        else gd.current.bowler = selectedId;
        gd.waitingForCaptain = false;

        setTimeout(() => {
          nextTurn(roomCode);
        }, 500);
        break;
      }

      case "chat": {
        broadcastRoom(data.roomCode, {
          type: "chat",
          message: `💬 ${data.name}: ${data.message}`,
        });
        break;
      }
    }
  });

  ws.on("close", () => {
    delete sockets[playerId];
    // Future: remove from room, handle disconnect
  });
});

// 🔁 Broadcast to all in room
function broadcastRoom(roomCode, message) {
  const room = rooms[roomCode];
  if (!room) return;
  room.players.forEach((p) => {
    if (sockets[p.id]) {
      sockets[p.id].send(JSON.stringify(message));
    }
  });
}

// 📦 Helpers
function send(ws, type, payload) {
  ws.send(JSON.stringify({ type, ...payload }));
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// 🏏 Game Logic
function createGameData(room) {
  const teamA = room.players.filter((p) => p.team === "A").map((p) => p.id);
  const teamB = room.players.filter((p) => p.team === "B").map((p) => p.id);

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
      batter: teamA[0],
      bowler: teamB[0],
    },
    teamA,
    teamB,
    usedBatters: [],
    usedBowlers: [],
    waitingForCaptain: false,
  };
}

function handleToss(roomCode) {
  const tossMessage = "Team A won the toss and chose to bat first.";
  broadcastRoom(roomCode, { type: "toss", message: tossMessage });

  setTimeout(() => {
    nextTurn(roomCode);
  }, 2000);
}

function nextTurn(roomCode) {
  const room = rooms[roomCode];
  const gd = room.gameData;

  // Check innings end
  const maxBalls = gd.overs * 6;
  const team = gd.current.battingTeam;
  if (gd.balls >= maxBalls || gd.wickets[team] >= (gd[team === "A" ? "teamA" : "teamB"].length - 1)) {
    if (gd.innings === 1) {
      gd.innings = 2;
      gd.target = gd.scores[team] + 1;

      // Switch teams
      [gd.current.battingTeam, gd.current.bowlingTeam] = [gd.current.bowlingTeam, gd.current.battingTeam];
      [gd.teamA, gd.teamB] = [gd.teamB, gd.teamA];

      gd.wickets = { A: 0, B: 0 };
      gd.balls = 0;
      gd.usedBatters = [];
      gd.usedBowlers = [];

      broadcastRoom(roomCode, { type: "endInnings", message: `End of 1st Innings. Target: ${gd.target}` });

      setTimeout(() => requestCaptain(roomCode, "nextBatter"), 2000);
    } else {
      // Game over
      const a = gd.scores["A"];
      const b = gd.scores["B"];
      let message = a === b ? "Match Tied!" : (b > a ? "Team B Wins!" : "Team A Wins!");
      broadcastRoom(roomCode, { type: "gameOver", message });
    }
    return;
  }

  broadcastRoom(roomCode, {
    type: "yourTurn",
    playerId: gd.current.batter,
    role: "bat",
  });
  send(sockets[gd.current.bowler], "yourTurn", { role: "bowl" });
}

function handleTurn(roomCode, playerId, number) {
  const room = rooms[roomCode];
  const gd = room.gameData;

  if (!gd.current.batterChoice) gd.current.batterChoice = {};
  if (!gd.current.bowlerChoice) gd.current.bowlerChoice = {};

  if (playerId === gd.current.batter) {
    gd.current.batterChoice = { id: playerId, number };
  }
  if (playerId === gd.current.bowler) {
    gd.current.bowlerChoice = { id: playerId, number };
  }

  // Wait for both inputs
  if (gd.current.batterChoice && gd.current.bowlerChoice) {
    const bat = gd.current.batterChoice.number;
    const bowl = gd.current.bowlerChoice.number;

    let result;
    if (bat === bowl) {
      gd.wickets[gd.current.battingTeam]++;
      result = `OUT! Batter chose ${bat}, Bowler chose ${bowl}`;
      gd.usedBatters.push(gd.current.batter);
      requestCaptain(roomCode, "nextBatter");
    } else {
      gd.scores[gd.current.battingTeam] += bat;
      result = `Runs: ${bat} | Batter: ${bat}, Bowler: ${bowl}`;
    }

    gd.balls++;
    if (!result.includes("OUT")) {
      gd.usedBowlers.push(gd.current.bowler);
      requestCaptain(roomCode, "nextBowler");
    }

    broadcastRoom(roomCode, { type: "turnResult", message: result });

    // Clear choices
    gd.current.batterChoice = null;
    gd.current.bowlerChoice = null;
  }
}

function requestCaptain(roomCode, type) {
  const room = rooms[roomCode];
  const gd = room.gameData;
  gd.waitingForCaptain = true;

  const team = type === "nextBatter" ? gd.current.battingTeam : gd.current.bowlingTeam;
  const teamList = team === "A" ? gd.teamA : gd.teamB;
  const used = type === "nextBatter" ? gd.usedBatters : gd.usedBowlers;

  const available = teamList.filter((id) => !used.includes(id));
  if (available.length === 0) {
    // fallback (everyone used)
    available.push(...teamList);
  }

  const options = available.map((id) => {
    const p = room.players.find((p) => p.id === id);
    return { id: p.id, name: p.name };
  });

  const captainId = room.captains[team];
  if (sockets[captainId]) {
    send(sockets[captainId], type, { type, options });
  }
}
