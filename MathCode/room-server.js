#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./shared-game.js";

const PowerArena = globalThis.PowerArena;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const rooms = new Map();
const clients = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function roomCodeFrom(url) {
  return PowerArena.normalizeRoomCode(url.searchParams.get("room") || PowerArena.DEFAULT_ROOM);
}

function getRoom(code) {
  const normalized = PowerArena.normalizeRoomCode(code);
  if (!rooms.has(normalized)) rooms.set(normalized, PowerArena.createRoom(normalized));
  return rooms.get(normalized);
}

function setRoom(room) {
  const normalized = PowerArena.normalizeRoomCode(room.code);
  const next = PowerArena.saveRoom({ ...room, code: normalized });
  rooms.set(normalized, next);
  broadcast(normalized, next);
  return next;
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function broadcast(code, room) {
  const list = clients.get(code);
  if (!list) return;
  const payload = `event: room\ndata: ${JSON.stringify(room)}\n\n`;
  for (const res of list) res.write(payload);
}

function attachEvents(req, res, code) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write(`event: room\ndata: ${JSON.stringify(getRoom(code))}\n\n`);
  if (!clients.has(code)) clients.set(code, new Set());
  clients.get(code).add(res);
  req.on("close", () => clients.get(code)?.delete(res));
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(ROOT, requested));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/api/events") {
      attachEvents(req, res, roomCodeFrom(url));
      return;
    }

    if (url.pathname === "/api/room" && req.method === "GET") {
      sendJson(res, setRoom(PowerArena.applyTick(getRoom(roomCodeFrom(url)))));
      return;
    }

    if (url.pathname === "/api/room" && req.method === "POST") {
      const body = await readBody(req);
      const current = PowerArena.applyTick(getRoom(roomCodeFrom(url)));
      const next = setRoom({ ...current, ...body, code: roomCodeFrom(url) });
      sendJson(res, next);
      return;
    }

    if (url.pathname === "/api/join" && req.method === "POST") {
      const body = await readBody(req);
      const code = PowerArena.normalizeRoomCode(body.room);
      const team = body.team === "B" ? "B" : "A";
      const next = PowerArena.applyTick(getRoom(code));
      const joined = body.name ? PowerArena.registerTeam(next, team, body.name) : next;
      joined.teams[team].connected = true;
      joined.teams[team].feedback = body.name
        ? joined.teams[team].feedback
        : (joined.status === "running" ? "พร้อมส่งคำตอบ" : "เข้าห้องแล้ว รอครูเริ่ม");
      sendJson(res, setRoom(joined));
      return;
    }

    if (url.pathname === "/api/team" && req.method === "POST") {
      const body = await readBody(req);
      const code = PowerArena.normalizeRoomCode(body.room);
      const team = body.team === "B" ? "B" : "A";
      const current = PowerArena.applyTick(getRoom(code));
      const next = PowerArena.registerTeam(current, team, body.name);
      sendJson(res, setRoom(next));
      return;
    }

    if (url.pathname === "/api/submit" && req.method === "POST") {
      const body = await readBody(req);
      const code = PowerArena.normalizeRoomCode(body.room);
      const team = body.team === "B" ? "B" : "A";
      const current = PowerArena.applyTick(getRoom(code));
      const result = PowerArena.scoreAnswer(current, team, body.answer || "");
      const saved = setRoom(result.room);
      if (result.ok) {
        setTimeout(() => {
          const latest = getRoom(code);
          if (latest.lockedProblemId === saved.problem.id && latest.status === "running") {
            setRoom(PowerArena.advanceProblem(latest));
          }
        }, 700);
      }
      sendJson(res, { ...result, room: saved });
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, { error: error.message || "Server error" }, 500);
  }
});

function localAddresses() {
  const urls = [`http://localhost:${PORT}`];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family === "IPv4" && !net.internal) urls.push(`http://${net.address}:${PORT}`);
    }
  }
  return urls;
}

// Active room ticking on the server to keep countdowns running autonomously
setInterval(() => {
  for (const [code, room] of rooms.entries()) {
    if (room.status === "running") {
      const next = PowerArena.applyTick(room);
      if (next.remaining !== room.remaining || next.status !== room.status) {
        rooms.set(code, next);
        broadcast(code, next);
      }
    }
  }
}, 1000);

server.listen(PORT, "0.0.0.0", () => {
  console.log("Power Arena classroom server is ready.");
  for (const url of localAddresses()) console.log(`- ${url}`);
  console.log("Open the LAN URL on iPad/mobile devices connected to the same Wi-Fi.");
});
