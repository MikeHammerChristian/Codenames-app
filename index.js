const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "../public")));

// ---------- Word list (same as client for consistency, but server generates) ----------
const WORDS = [
  "AFRICA","AGENT","AIR","ALIEN","ALPS","AMAZON","AMBULANCE","AMERICA","ANGEL","ANTARCTICA",
  "APPLE","ARM","ATLANTIS","AUSTRALIA","AZTEC","BACK","BALL","BAND","BANK","BAR",
  "BARK","BAT","BATTERY","BEACH","BEAR","BEAT","BED","BEIJING","BELL","BELT",
  "BERLIN","BERMUDA","BERRY","BILL","BLOCK","BOARD","BOLT","BOMB","BOND","BOOM",
  "BOOT","BOTTLE","BOW","BOX","BRIDGE","BRUSH","BUCK","BUFFALO","BUG","BUGLE",
  "BUTTON","CALF","CANADA","CAP","CAPITAL","CAR","CARD","CARROT","CASINO","CAST",
  "CAT","CELL","CENTAUR","CENTER","CHAIR","CHANGE","CHARGE","CHECK","CHEST","CHICK",
  "CHINA","CHOCOLATE","CHURCH","CIRCLE","CLIFF","CLOAK","CLUB","CODE","COLD","COMIC",
  "COMPOUND","CONCERT","CONDUCTOR","CONTRACT","COOK","COPPER","COTTON","COURT","COVER","CRANE",
  "CRASH","CRICKET","CROSS","CROWN","CYCLE","CZECH","DANCE","DATE","DAY","DEATH",
  "DECK","DEGREE","DIAMOND","DICE","DINOSAUR","DISEASE","DOCTOR","DOG","DRAFT","DRAGON",
  "DRESS","DRILL","DROP","DUCK","DWARF","EAGLE","EGYPT","EMBASSY","ENGINE","ENGLAND",
  "EUROPE","EYE","FACE","FAIR","FALL","FAN","FENCE","FIELD","FIGHTER","FIGURE",
  "FILE","FILM","FIRE","FISH","FLUTE","FLY","FOOT","FORCE","FOREST","FORK",
  "FRANCE","GAME","GAS","GENIUS","GERMANY","GHOST","GIANT","GLASS","GLOVE","GOLD",
  "GRACE","GRASS","GREECE","GREEN","GROUND","HAM","HAND","HAWK","HEAD","HEART",
  "HELICOPTER","HIMALAYAS","HOLE","HOLLYWOOD","HONEY","HOOD","HOOK","HORN","HORSE","HORSESHOE",
  "HOSPITAL","HOTEL","ICE","ICE CREAM","INDIA","IRON","IVORY","JACK","JAM","JET",
  "JUPITER","KANGAROO","KETCHUP","KEY","KID","KING","KIWI","KNIFE","KNIGHT","LAB",
  "LAP","LASER","LAWYER","LEAD","LEMON","LIMOUSINE","LINK","LION","LITTER","LOCH NESS",
  "LOCK","LOG","LONDON","LUCK","MAIL","MAMMOTH","MAPLE","MARCH","MASS","MATCH",
  "MERCURY","MEXICO","MICROSCOPE","MILLIONAIRE","MINE","MINT","MISSILE","MODEL","MOLE","MOON",
  "MOSCOW","MOUNT","MOUSE","MOUTH","MUG","NAIL","NEEDLE","NET","NEW YORK","NIGHT",
  "NINJA","NOTE","NOVEL","NURSE","NUT","OCTOPUS","OIL","OLIVE","OLYMPUS","OPERA",
  "ORANGE","ORGAN","PALM","PAN","PANTS","PAPER","PARACHUTE","PARK","PART","PASS",
  "PASTE","PENGUIN","PHOENIX","PIANO","PIE","PILOT","PIN","PIPE","PIRATE","PISTOL",
  "PIT","PITCH","PLANE","PLASTIC","PLATE","PLATYPUS","PLAY","PLOT","POINT","POLE",
  "POLICE","POOL","PORT","POST","POUND","PRESS","PRINCESS","PUMPKIN","PUPIL","PYRAMID",
  "QUEEN","RABBIT","RACKET","RAY","REVOLUTION","RING","ROBIN","ROBOT","ROCK","ROME",
  "ROOT","ROSE","ROULETTE","ROUND","ROW","RULER","SATELLITE","SATURN","SCALE","SCHOOL",
  "SCIENTIST","SCORPION","SCREEN","SCUBA DIVER","SEAL","SERVER","SHADOW","SHAKESPEARE","SHARK","SHIP",
  "SHOE","SHOP","SHOT","SINK","SKYSCRAPER","SLIP","SLUG","SMUGGLER","SNOW","SNOWMAN",
  "SOCK","SOLDIER","SOUL","SOUND","SPACE","SPELL","SPIDER","SPIKE","SPINE","SPOT",
  "SPRING","SPY","SQUARE","STADIUM","STAFF","STAR","STATE","STICK","STREAM","STRIKE",
  "STRING","SUB","SUIT","SUPERHERO","SWING","SWITCH","TABLE","TABLET","TAG","TAIL",
  "TAP","TEACHER","TELESCOPE","TEMPLE","THEATER","THIEF","THUMB","TICK","TIE","TIME",
  "TOKYO","TOOTH","TORCH","TOWER","TRACK","TRAIN","TRIANGLE","TRIP","TRUNK","TUBE",
  "TURKEY","UNDERTAKER","UNICORN","VACUUM","VAN","VET","WAKE","WALL","WAR","WASHER",
  "WASHINGTON","WATCH","WATER","WAVE","WEB","WELL","WHALE","WHIP","WIND","WITCH",
  "WORM","YARD"
];

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateBoard(seed) {
  const rng = mulberry32(seed);
  const words = shuffle(WORDS, rng).slice(0, 25);
  const startingTeam = rng() < 0.5 ? "red" : "blue";
  const layout = [];
  for (let i = 0; i < 9; i++) layout.push(startingTeam);
  for (let i = 0; i < 8; i++) layout.push(startingTeam === "red" ? "blue" : "red");
  for (let i = 0; i < 7; i++) layout.push("neutral");
  layout.push("assassin");
  const colors = shuffle(layout, rng);

  return { words, colors, startingTeam, seed };
}

// ---------- Rooms ----------
const rooms = new Map(); // roomCode -> gameState

function createGameState(roomCode) {
  return {
    room: roomCode,
    players: [],
    started: false,
    board: null,
    revealed: Array(25).fill(false),
    remaining: { red: 9, blue: 8 },
    turn: null,
    clue: null,
    guessesLeft: 0,
    winner: null,
    seed: null
  };
}

function getPublicState(game) {
  // Don't send full colors to non-spymasters – client already handles visibility
  return {
    room: game.room,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role
    })),
    started: game.started,
    board: game.board ? {
      words: game.board.words,
      colors: game.board.colors, // client filters by role
      startingTeam: game.board.startingTeam
    } : null,
    revealed: game.revealed,
    remaining: game.remaining,
    turn: game.turn,
    clue: game.clue,
    guessesLeft: game.guessesLeft,
    winner: game.winner
  };
}

function broadcast(roomCode) {
  const game = rooms.get(roomCode);
  if (!game) return;
  io.to(roomCode).emit("update", getPublicState(game));
}

io.on("connection", (socket) => {
  let currentRoom = null;
  let playerId = null;

  socket.on("join", ({ room, name }) => {
    room = (room || "TEAM").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!room) return socket.emit("error", "Invalid room code");

    if (!rooms.has(room)) {
      rooms.set(room, createGameState(room));
    }
    const game = rooms.get(room);

    playerId = uuidv4();
    const player = {
      id: playerId,
      name: (name || "Player").slice(0, 20),
      team: null,
      role: null,
      socketId: socket.id
    };
    game.players.push(player);
    currentRoom = room;
    socket.join(room);

    socket.emit("joined", {
      room,
      playerId,
      game: getPublicState(game)
    });
    broadcast(room);
  });

  socket.on("setRole", ({ team, role }) => {
    if (!currentRoom) return;
    const game = rooms.get(currentRoom);
    if (!game) return;
    const player = game.players.find(p => p.id === playerId);
    if (!player) return;

    if (!["red", "blue"].includes(team) || !["spymaster", "operative"].includes(role)) return;

    // Only one spymaster per team
    if (role === "spymaster") {
      const existing = game.players.find(p => p.team === team && p.role === "spymaster" && p.id !== playerId);
      if (existing) {
        existing.role = "operative"; // demote previous
      }
    }

    player.team = team;
    player.role = role;
    broadcast(currentRoom);
  });

  socket.on("startGame", () => {
    if (!currentRoom) return;
    const game = rooms.get(currentRoom);
    if (!game || game.started) return;

    const seed = Date.now() ^ (Math.random() * 0x100000000);
    game.board = generateBoard(seed);
    game.seed = seed;
    game.revealed = Array(25).fill(false);
    game.remaining = {
      red: game.board.colors.filter(c => c === "red").length,
      blue: game.board.colors.filter(c => c === "blue").length
    };
    game.turn = game.board.startingTeam;
    game.clue = null;
    game.guessesLeft = 0;
    game.winner = null;
    game.started = true;

    broadcast(currentRoom);
    io.to(currentRoom).emit("message", { text: `${game.turn.toUpperCase()} team starts!`, type: "" });
  });

  socket.on("newGame", () => {
    if (!currentRoom) return;
    const game = rooms.get(currentRoom);
    if (!game) return;

    const seed = Date.now() ^ (Math.random() * 0x100000000);
    game.board = generateBoard(seed);
    game.seed = seed;
    game.revealed = Array(25).fill(false);
    game.remaining = {
      red: game.board.colors.filter(c => c === "red").length,
      blue: game.board.colors.filter(c => c === "blue").length
    };
    game.turn = game.board.startingTeam;
    game.clue = null;
    game.guessesLeft = 0;
    game.winner = null;
    game.started = true;

    broadcast(currentRoom);
    io.to(currentRoom).emit("message", { text: `New board — ${game.turn.toUpperCase()} starts`, type: "" });
  });

  socket.on("giveClue", ({ word, number }) => {
    if (!currentRoom) return;
    const game = rooms.get(currentRoom);
    if (!game || !game.started || game.winner || game.clue) return;

    const player = game.players.find(p => p.id === playerId);
    if (!player || player.role !== "spymaster" || player.team !== game.turn) return;

    word = (word || "").trim().toUpperCase().slice(0, 20);
    number = parseInt(number, 10);
    if (!word || isNaN(number) || number < 0 || number > 9) return;

    game.clue = { word, number };
    game.guessesLeft = number === 0 ? 1 : number + 1; // unlimited often treated as +1 extra

    broadcast(currentRoom);
    io.to(currentRoom).emit("message", {
      text: `${player.team.toUpperCase()} clue: ${word} ${number}`,
      type: ""
    });
  });

  socket.on("guess", ({ index }) => {
    if (!currentRoom) return;
    const game = rooms.get(currentRoom);
    if (!game || !game.started || game.winner || !game.clue) return;
    if (index < 0 || index > 24 || game.revealed[index]) return;

    const player = game.players.find(p => p.id === playerId);
    if (!player || player.role !== "operative" || player.team !== game.turn) return;

    game.revealed[index] = true;
    const color = game.board.colors[index];

    if (color === "assassin") {
      game.winner = game.turn === "red" ? "blue" : "red";
      broadcast(currentRoom);
      io.to(currentRoom).emit("message", {
        text: `Assassin! ${game.winner.toUpperCase()} team wins!`,
        type: game.winner === "red" ? "win-red" : "win-blue"
      });
      return;
    }

    if (color === "red" || color === "blue") {
      game.remaining[color]--;
      if (game.remaining[color] <= 0) {
        game.winner = color;
        broadcast(currentRoom);
        io.to(currentRoom).emit("message", {
          text: `${color.toUpperCase()} team found all their agents!`,
          type: color === "red" ? "win-red" : "win-blue"
        });
        return;
      }
    }

    // Wrong color or neutral ends the turn (unless still have guesses and it was their color)
    const correct = color === game.turn;
    game.guessesLeft--;

    if (!correct || game.guessesLeft <= 0) {
      // End turn
      game.turn = game.turn === "red" ? "blue" : "red";
      game.clue = null;
      game.guessesLeft = 0;
      io.to(currentRoom).emit("message", {
        text: correct ? "No more guesses — turn over" : `Hit ${color}! Turn over`,
        type: ""
      });
    }

    broadcast(currentRoom);
  });

  socket.on("endTurn", () => {
    if (!currentRoom) return;
    const game = rooms.get(currentRoom);
    if (!game || !game.started || game.winner || !game.clue) return;

    const player = game.players.find(p => p.id === playerId);
    if (!player || player.team !== game.turn) return;

    game.turn = game.turn === "red" ? "blue" : "red";
    game.clue = null;
    game.guessesLeft = 0;
    broadcast(currentRoom);
    io.to(currentRoom).emit("message", { text: "Turn ended", type: "" });
  });

  socket.on("disconnect", () => {
    if (!currentRoom) return;
    const game = rooms.get(currentRoom);
    if (!game) return;

    game.players = game.players.filter(p => p.id !== playerId);
    if (game.players.length === 0) {
      rooms.delete(currentRoom);
    } else {
      broadcast(currentRoom);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Codenames running on http://localhost:${PORT}`);
});
