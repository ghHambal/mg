(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const hasBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  const ROOM_PREFIX = "powerArenaRoom:";
  const DEFAULT_ROOM = "POWER-4821";
  const DEFAULT_DURATION = 180;

  const supMap = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" };

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function sup(value) {
    return String(value).split("").map((char) => supMap[char] || char).join("");
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a || 1;
  }

  function formatClock(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    const rest = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  function normalizeMathText(value) {
    const unicode = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (match) => `^${match.split("").map((char) => unicode[char] || char).join("")}`)
      .replace(/[÷:]/g, "/")
      .replace(/[×·]/g, "*")
      .replace(/[−–—]/g, "-")
      .replace(/[(){}\[\]\s]/g, "")
      .replace(/^.*=/, "");
  }

  function multiplyNumber(model, base, exp, side) {
    const value = base ** Math.abs(exp);
    if (exp * side >= 0) model.num *= value;
    else model.den *= value;
  }

  function addVariablePower(model, variable, exp, side) {
    model.vars[variable] = (model.vars[variable] || 0) + exp * side;
    if (model.vars[variable] === 0) delete model.vars[variable];
  }

  function parseFactor(model, token, side) {
    if (!token || token === "1") return true;
    const numberPower = token.match(/^(\d+)(?:\^(-?\d+))?$/);
    if (numberPower) {
      multiplyNumber(model, Number(numberPower[1]), Number(numberPower[2] || 1), side);
      return true;
    }

    let consumed = "";
    const variablePattern = /([a-z])(?:\^(-?\d+))?/g;
    let match;
    while ((match = variablePattern.exec(token))) {
      consumed += match[0];
      addVariablePower(model, match[1], Number(match[2] || 1), side);
    }
    return consumed === token;
  }

  function canonicalizeAnswer(value) {
    const normalized = normalizeMathText(value);
    if (!normalized) return null;
    const model = { num: 1, den: 1, vars: {} };
    const parts = normalized.split("/");
    if (parts.some((part) => part === "")) return null;
    const parseSide = (text, side) => text.split("*").filter(Boolean).every((token) => parseFactor(model, token, side));
    if (!parseSide(parts[0], 1)) return null;
    for (let i = 1; i < parts.length; i += 1) {
      if (!parseSide(parts[i], -1)) return null;
    }

    const divisor = gcd(model.num, model.den);
    model.num /= divisor;
    model.den /= divisor;
    const vars = Object.entries(model.vars)
      .filter(([, exp]) => exp !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, exp]) => `${name}:${exp}`)
      .join(",");
    return `${model.num}/${model.den}|${vars}`;
  }

  const problemTypes = [
    {
      level: "เข้มข้น",
      pattern: "คูณ + หารฐานเดียวกัน",
      build() {
        const base = randomInt(2, 5);
        const a = randomInt(5, 9);
        const b = randomInt(3, 7);
        const c = randomInt(2, 5);
        const exp = a + b - c;
        return {
          question: `(${base}${sup(a)} × ${base}${sup(b)}) ÷ ${base}${sup(c)} = ?`,
          answer: `${base}^${exp}`,
          accepted: [`${base}^${exp}`, String(base ** exp)],
          hint: "คูณฐานเดียวกันให้บวกเลขชี้กำลัง แล้วหารให้ลบเลขชี้กำลัง",
          points: 20
        };
      }
    },
    {
      level: "ท้าทาย",
      pattern: "ยกกำลังซ้อน + หาร",
      build() {
        const base = randomInt(2, 5);
        const a = randomInt(2, 4);
        const b = randomInt(3, 5);
        const c = randomInt(2, 6);
        const exp = a * b - c;
        return {
          question: `(${base}${sup(a)})${sup(b)} ÷ ${base}${sup(c)} = ?`,
          answer: `${base}^${exp}`,
          accepted: [`${base}^${exp}`, String(base ** exp)],
          hint: "ยกกำลังซ้อนให้นำเลขชี้กำลังคูณกัน จากนั้นลดด้วยกฎการหาร",
          points: 25
        };
      }
    },
    {
      level: "ท้าทาย",
      pattern: "ผลคูณยกกำลัง + ตัวแปร",
      build() {
        const x = randomInt(2, 4);
        const y = randomInt(1, 3);
        const power = randomInt(2, 3);
        const cutX = randomInt(1, x);
        const answerX = x * power - cutX;
        const answerY = y * power;
        return {
          question: `((x${sup(x)}y${sup(y)})${sup(power)}) ÷ x${sup(cutX)} = ?`,
          answer: `x^${answerX}y^${answerY}`,
          accepted: [`x^${answerX}y^${answerY}`, `y^${answerY}x^${answerX}`],
          hint: "กระจายเลขชี้กำลังเข้าไปในผลคูณ แล้วลดรูปตัวแปรฐานเดียวกัน",
          points: 30
        };
      }
    },
    {
      level: "บอส",
      pattern: "เลขชี้กำลังศูนย์ + เศษส่วน",
      build() {
        const base = randomInt(2, 5);
        const a = randomInt(1, 4);
        const b = a + randomInt(2, 5);
        const exp = b - a;
        return {
          question: `(${base}${sup(a)} ÷ ${base}${sup(b)}) × (${base}${sup(3)} ÷ ${base}${sup(3)}) = ?`,
          answer: `1/${base}^${exp}`,
          accepted: [`1/${base}^${exp}`, `1/${base ** exp}`],
          hint: "ส่วนหลังมีค่าเป็น 1 ส่วนหน้าเหลือเลขชี้กำลังลบ จึงเขียนเป็นเศษส่วน",
          points: 35
        };
      }
    },
    {
      level: "บอส",
      pattern: "หลายฐาน + เศษส่วน",
      build() {
        const a = randomInt(2, 5);
        const b = randomInt(2, 5);
        const c = randomInt(1, 3);
        const d = b + randomInt(2, 4);
        return {
          question: `(a${sup(a)}b${sup(b)} × a${sup(c)}) ÷ b${sup(d)} = ?`,
          answer: `a^${a + c}/b^${d - b}`,
          accepted: [`a^${a + c}/b^${d - b}`, `a^${a + c}b^-${d - b}`],
          hint: "รวมเลขชี้กำลังของ a ด้วยการบวก และเลขชี้กำลังของ b ด้วยการลบจนกลายเป็นส่วน",
          points: 40
        };
      }
    }
  ];

  function acceptedCanonicals(problem) {
    return (problem.accepted || [problem.answer]).map(canonicalizeAnswer).filter(Boolean);
  }

  function createProblem(round) {
    const cap = Math.min(problemTypes.length - 1, Math.floor((round - 1) / 3));
    const type = problemTypes[randomInt(0, cap)];
    const built = type.build();
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      round,
      ...built,
      acceptedKeys: acceptedCanonicals(built),
      level: type.level,
      pattern: type.pattern
    };
  }

  function createRoom(code = DEFAULT_ROOM) {
    return {
      code,
      status: "lobby",
      duration: DEFAULT_DURATION,
      remaining: DEFAULT_DURATION,
      lastTick: null,
      round: 1,
      lockedProblemId: null,
      reveal: false,
      teams: {
        A: { name: "ทีมแดง", registered: false, joinedAt: null, score: 0, combo: 0, connected: false, lastAnswer: "", feedback: "รอเข้าห้อง" },
        B: { name: "ทีมน้ำเงิน", registered: false, joinedAt: null, score: 0, combo: 0, connected: false, lastAnswer: "", feedback: "รอเข้าห้อง" }
      },
      tournament: {
        active: false,
        round: 1,
        matchNo: 1,
        queue: [],
        nextQueue: [],
        currentPair: null,
        leaderboard: {},
        history: [],
        champion: null
      },
      problem: createProblem(1),
      log: []
    };
  }

  function roomKey(code) {
    return `${ROOM_PREFIX}${String(code || DEFAULT_ROOM).toUpperCase()}`;
  }

  function getQuery(name, fallback = "") {
    if (!hasBrowser) return fallback;
    return new URLSearchParams(window.location.search).get(name) || fallback;
  }

  function normalizeRoomCode(code) {
    return String(code || DEFAULT_ROOM).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12) || DEFAULT_ROOM;
  }

  function cleanTeamName(name, fallback) {
    const cleaned = String(name || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return cleaned || fallback;
  }

  function teamId(name) {
    return cleanTeamName(name, "ทีม").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9ก-๙_-]/g, "").slice(0, 36) || `team-${Date.now()}`;
  }

  function uniqueTeamNames(value) {
    const lines = Array.isArray(value) ? value : String(value || "").split(/\n|,/);
    const seen = new Set();
    return lines
      .map((name, index) => cleanTeamName(name, `ทีม ${index + 1}`))
      .filter((name) => {
        const id = teamId(name);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }

  function blankTeam(name, color) {
    return {
      id: teamId(name),
      name,
      color,
      totalScore: 0,
      wins: 0,
      matches: 0,
      eliminated: false,
      lastScore: 0
    };
  }

  function ensureTournament(room) {
    const next = structuredClone(room);
    if (!next.tournament) {
      next.tournament = {
        active: false,
        round: 1,
        matchNo: 1,
        queue: [],
        nextQueue: [],
        currentPair: null,
        leaderboard: {},
        history: [],
        champion: null
      };
    }
    next.tournament.queue ||= [];
    next.tournament.nextQueue ||= [];
    next.tournament.leaderboard ||= {};
    next.tournament.history ||= [];
    return next;
  }

  function syncCurrentPairFromTeams(room) {
    const next = ensureTournament(room);
    const pair = next.tournament.currentPair;
    if (!pair) return next;
    pair.A.name = next.teams.A.name;
    pair.A.id = teamId(next.teams.A.name);
    pair.B.name = next.teams.B.name;
    pair.B.id = teamId(next.teams.B.name);
    for (const side of ["A", "B"]) {
      const participant = pair[side];
      next.tournament.leaderboard[participant.id] ||= blankTeam(participant.name, side);
      next.tournament.leaderboard[participant.id].name = participant.name;
    }
    return next;
  }

  function resetMatchState(room, pair) {
    const next = ensureTournament(room);
    next.status = "lobby";
    next.remaining = next.duration || DEFAULT_DURATION;
    next.lastTick = null;
    next.round = 1;
    next.lockedProblemId = null;
    next.reveal = false;
    next.problem = createProblem(1);
    next.teams.A = {
      ...next.teams.A,
      name: pair.A.name,
      registered: true,
      score: 0,
      combo: 0,
      lastAnswer: "",
      feedback: "พร้อมแข่งคู่ปัจจุบัน"
    };
    next.teams.B = {
      ...next.teams.B,
      name: pair.B.name,
      registered: true,
      score: 0,
      combo: 0,
      lastAnswer: "",
      feedback: "พร้อมแข่งคู่ปัจจุบัน"
    };
    next.tournament.currentPair = {
      ...pair,
      round: next.tournament.round,
      matchNo: next.tournament.matchNo,
      completed: false
    };
    next.log.unshift(`คู่ที่ ${next.tournament.matchNo} รอบ ${next.tournament.round}: ${pair.A.name} พบ ${pair.B.name}`);
    next.log = next.log.slice(0, 8);
    return next;
  }

  function loadNextTournamentMatch(room) {
    let next = ensureTournament(room);
    const tournament = next.tournament;
    if (!tournament.active) return next;

    while (tournament.queue.length === 1) {
      const bye = tournament.queue.shift();
      tournament.nextQueue.push(bye);
      next.log.unshift(`${bye.name} ได้บายเข้าสู่รอบถัดไป`);
      next.log = next.log.slice(0, 8);
    }

    if (tournament.queue.length < 2) {
      if (tournament.nextQueue.length === 1) {
        tournament.champion = tournament.nextQueue[0];
        tournament.active = false;
        next.status = "ended";
        next.reveal = true;
        next.log.unshift(`แชมป์ทัวร์นาเมนต์: ${tournament.champion.name}`);
        next.log = next.log.slice(0, 8);
        return next;
      }
      tournament.round += 1;
      tournament.matchNo = 1;
      tournament.queue = tournament.nextQueue;
      tournament.nextQueue = [];
      while (tournament.queue.length === 1 && tournament.nextQueue.length === 0) {
        const bye = tournament.queue.shift();
        tournament.nextQueue.push(bye);
      }
    }

    if (tournament.queue.length >= 2) {
      const pair = { A: tournament.queue.shift(), B: tournament.queue.shift() };
      next = resetMatchState(next, pair);
    }
    return next;
  }

  function startTournament(room, names) {
    let next = ensureTournament(room);
    const teamNames = uniqueTeamNames(names);
    if (teamNames.length < 2) return next;
    const roster = teamNames.map((name, index) => blankTeam(name, index % 2 === 0 ? "A" : "B"));
    next.tournament = {
      active: true,
      round: 1,
      matchNo: 1,
      queue: roster,
      nextQueue: [],
      currentPair: null,
      leaderboard: Object.fromEntries(roster.map((team) => [team.id, team])),
      history: [],
      champion: null
    };
    next.log = ["เริ่มทัวร์นาเมนต์แบบแพ้คัดออก"];
    return loadNextTournamentMatch(next);
  }

  function currentMatchWinner(room) {
    const a = room.teams.A.score;
    const b = room.teams.B.score;
    if (a === b) return null;
    return a > b ? "A" : "B";
  }

  function completeTournamentMatch(room, forcedWinner = "") {
    let next = syncCurrentPairFromTeams(room);
    const tournament = next.tournament;
    if (!tournament.active || !tournament.currentPair || tournament.currentPair.completed) return next;
    const winnerSide = forcedWinner || currentMatchWinner(next);
    if (!winnerSide) {
      next.log.unshift("ยังบันทึกผู้ชนะไม่ได้ เพราะคะแนนเสมอกัน");
      next.log = next.log.slice(0, 8);
      return next;
    }
    const loserSide = winnerSide === "A" ? "B" : "A";
    const winner = tournament.currentPair[winnerSide];
    const loser = tournament.currentPair[loserSide];
    const winnerScore = next.teams[winnerSide].score;
    const loserScore = next.teams[loserSide].score;
    for (const side of ["A", "B"]) {
      const participant = tournament.currentPair[side];
      const entry = tournament.leaderboard[participant.id] || blankTeam(participant.name, side);
      entry.name = participant.name;
      entry.totalScore += next.teams[side].score;
      entry.lastScore = next.teams[side].score;
      entry.matches += 1;
      if (side === winnerSide) entry.wins += 1;
      if (side === loserSide) entry.eliminated = true;
      tournament.leaderboard[participant.id] = entry;
    }
    tournament.currentPair.completed = true;
    tournament.nextQueue.push({ ...winner });
    tournament.history.unshift({
      round: tournament.round,
      matchNo: tournament.matchNo,
      winner: winner.name,
      loser: loser.name,
      score: `${winnerScore}-${loserScore}`,
      at: Date.now()
    });
    tournament.history = tournament.history.slice(0, 12);
    tournament.matchNo += 1;
    next.status = "ended";
    next.reveal = true;
    next.log.unshift(`${winner.name} ชนะ ${loser.name} ${winnerScore}-${loserScore} และเข้าสู่รอบถัดไป`);
    next.log = next.log.slice(0, 8);
    return loadNextTournamentMatch(next);
  }

  function leaderboardRows(room) {
    const tournament = ensureTournament(room).tournament;
    return Object.values(tournament.leaderboard)
      .sort((a, b) => b.wins - a.wins || b.totalScore - a.totalScore || a.name.localeCompare(b.name));
  }

  function registerTeam(room, team, name) {
    const next = structuredClone(room);
    const teamState = next.teams[team];
    if (!teamState) return next;
    const fallback = team === "B" ? "ทีมน้ำเงิน" : "ทีมแดง";
    teamState.name = cleanTeamName(name, fallback);
    teamState.registered = true;
    teamState.connected = true;
    teamState.joinedAt = teamState.joinedAt || Date.now();
    teamState.feedback = next.status === "running" ? "พร้อมส่งคำตอบ" : "ลงชื่อแล้ว รอครูเริ่ม";
    next.log.unshift(`${teamState.name} เข้าร่วมการแข่งขัน`);
    next.log = next.log.slice(0, 8);
    return syncCurrentPairFromTeams(next);
  }

  function loadRoom(code) {
    const normalized = normalizeRoomCode(code);
    try {
      const saved = hasBrowser ? localStorage.getItem(roomKey(normalized)) : null;
      if (saved) return ensureTournament(JSON.parse(saved));
    } catch (_) {}
    return createRoom(normalized);
  }

  function saveRoom(room) {
    const next = ensureTournament({ ...room, code: normalizeRoomCode(room.code) });
    try {
      if (hasBrowser) localStorage.setItem(roomKey(next.code), JSON.stringify(next));
    } catch (_) {}
    return next;
  }

  function createSync(code, onChange) {
    const roomCode = normalizeRoomCode(code);
    if (!hasBrowser) return { publish: saveRoom, close: () => {} };
    const channelName = `power-arena:${roomCode}`;
    const serverMode = location.protocol !== "file:";
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(channelName) : null;
    const publish = (room) => {
      const saved = saveRoom(room);
      if (channel) channel.postMessage({ type: "room", room: saved });
      if (serverMode) {
        fetch(`/api/room?room=${encodeURIComponent(roomCode)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saved)
        }).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent("power-arena-room", { detail: saved }));
      return saved;
    };
    const handler = (event) => {
      const room = event.data && event.data.room ? event.data.room : event.detail;
      if (room && normalizeRoomCode(room.code) === roomCode) onChange(room);
    };
    if (channel) channel.addEventListener("message", handler);
    let events = null;
    if (serverMode && "EventSource" in window) {
      events = new EventSource(`/api/events?room=${encodeURIComponent(roomCode)}`);
      events.addEventListener("room", (event) => {
        try {
          const next = saveRoom(JSON.parse(event.data));
          onChange(next);
        } catch (_) {}
      });
      fetch(`/api/room?room=${encodeURIComponent(roomCode)}`)
        .then((res) => res.ok ? res.json() : null)
        .then((next) => { if (next) onChange(saveRoom(next)); })
        .catch(() => {});
    }
    window.addEventListener("power-arena-room", handler);
    const storageHandler = (event) => {
      if (event.key === roomKey(roomCode) && event.newValue) {
        try { onChange(JSON.parse(event.newValue)); } catch (_) {}
      }
    };
    window.addEventListener("storage", storageHandler);
    return {
      publish,
      close: () => {
        if (channel) channel.close();
        if (events) events.close();
        window.removeEventListener("power-arena-room", handler);
        window.removeEventListener("storage", storageHandler);
      }
    };
  }

  function scoreAnswer(room, team, answer) {
    const next = structuredClone(room);
    const teamState = next.teams[team];
    if (!teamState) return { room: next, ok: false, message: "ไม่พบทีม" };
    if (next.status !== "running") {
      teamState.feedback = "ครูยังไม่เริ่มแมตช์";
      return { room: next, ok: false, message: teamState.feedback };
    }
    if (next.lockedProblemId === next.problem.id) {
      teamState.feedback = "มีทีมตอบถูกแล้ว กำลังไปข้อถัดไป";
      return { room: next, ok: false, message: teamState.feedback };
    }
    const parsed = canonicalizeAnswer(answer);
    teamState.lastAnswer = answer;
    if (!parsed) {
      teamState.combo = 0;
      teamState.feedback = "ระบบยังอ่านคำตอบนี้ไม่ได้ ใช้ ^ และ / ช่วยเขียน";
      return { room: next, ok: false, message: teamState.feedback };
    }
    if (!next.problem.acceptedKeys.includes(parsed)) {
      teamState.combo = 0;
      teamState.feedback = "ยังไม่ถูก ลองลดรูปอีกครั้ง";
      next.log.unshift(`${teamState.name}: ${answer} ยังไม่ถูก`);
      next.log = next.log.slice(0, 8);
      return { room: next, ok: false, message: teamState.feedback };
    }

    const other = team === "A" ? "B" : "A";
    next.lockedProblemId = next.problem.id;
    next.reveal = true;
    teamState.combo += 1;
    next.teams[other].combo = 0;
    const gained = next.problem.points + Math.max(0, teamState.combo - 1) * 3;
    teamState.score += gained;
    teamState.feedback = `ถูกต้อง +${gained} คะแนน`;
    next.teams[other].feedback = "อีกทีมตอบถูกก่อน";
    next.log.unshift(`${teamState.name} ตอบถูก: ${answer} (+${gained})`);
    next.log = next.log.slice(0, 8);
    return { room: next, ok: true, message: teamState.feedback };
  }

  function advanceProblem(room) {
    const next = structuredClone(room);
    next.round += 1;
    next.problem = createProblem(next.round);
    next.lockedProblemId = null;
    next.reveal = false;
    next.teams.A.lastAnswer = "";
    next.teams.B.lastAnswer = "";
    next.teams.A.feedback = "พร้อมรับคำตอบ";
    next.teams.B.feedback = "พร้อมรับคำตอบ";
    return next;
  }

  function applyTick(room) {
    const next = structuredClone(room);
    if (next.status !== "running") return next;
    const now = Date.now();
    const last = next.lastTick || now;
    const elapsed = Math.floor((now - last) / 1000);
    if (elapsed <= 0) return next;
    next.remaining = Math.max(0, next.remaining - elapsed);
    next.lastTick = now;
    if (next.remaining === 0) {
      next.status = "ended";
      next.reveal = true;
      next.log.unshift("หมดเวลาแมตช์");
      next.log = next.log.slice(0, 8);
    }
    return next;
  }

  function hasServerSync() {
    return hasBrowser && location.protocol !== "file:";
  }

  async function fetchRoom(code) {
    if (!hasServerSync()) return loadRoom(code);
    const roomCode = normalizeRoomCode(code);
    const res = await fetch(`/api/room?room=${encodeURIComponent(roomCode)}`);
    if (!res.ok) throw new Error("Cannot load room");
    return saveRoom(await res.json());
  }

  async function submitAnswer(room, team, answer) {
    if (!hasServerSync()) return scoreAnswer(room, team, answer);
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: normalizeRoomCode(room.code), team, answer })
    });
    if (!res.ok) throw new Error("Cannot submit answer");
    const result = await res.json();
    if (result.room) saveRoom(result.room);
    return result;
  }

  async function joinRoom(room, team, name = "") {
    if (!hasServerSync()) {
      const next = name ? registerTeam(room, team, name) : structuredClone(room);
      next.teams[team].connected = true;
      next.teams[team].feedback = name
        ? next.teams[team].feedback
        : (next.status === "running" ? "พร้อมส่งคำตอบ" : "เข้าห้องแล้ว รอครูเริ่ม");
      return next;
    }
    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: normalizeRoomCode(room.code), team, name })
    });
    if (!res.ok) throw new Error("Cannot join room");
    return saveRoom(await res.json());
  }

  async function renameTeam(room, team, name) {
    if (!hasServerSync()) return registerTeam(room, team, name);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: normalizeRoomCode(room.code), team, name })
    });
    if (!res.ok) throw new Error("Cannot update team");
    return saveRoom(await res.json());
  }

  const api = {
    DEFAULT_ROOM,
    createRoom,
    loadRoom,
    saveRoom,
    createSync,
    createProblem,
    scoreAnswer,
    advanceProblem,
    applyTick,
    canonicalizeAnswer,
    cleanTeamName,
    registerTeam,
    fetchRoom,
    getQuery,
    formatClock,
    hasServerSync,
    joinRoom,
    renameTeam,
    submitAnswer,
    normalizeRoomCode,
    startTournament,
    completeTournamentMatch,
    leaderboardRows,
    currentMatchWinner,
    uniqueTeamNames
  };
  root.PowerArena = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
