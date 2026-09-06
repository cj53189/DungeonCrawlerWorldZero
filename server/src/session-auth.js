const { randomBytes, timingSafeEqual } = require("crypto");

function createResumeCredential() {
  return randomBytes(32).toString("base64url");
}

function normalizeCredential(value) {
  return typeof value === "string" ? value.trim() : "";
}

function credentialsMatch(expected, presented) {
  const left = Buffer.from(normalizeCredential(expected));
  const right = Buffer.from(normalizeCredential(presented));
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function issueResumeCredential(client) {
  if (!client) return null;
  const credential = createResumeCredential();
  client.resumeCredential = credential;
  return credential;
}

function ensureResumeCredential(client) {
  if (!client) return null;
  return normalizeCredential(client.resumeCredential) || issueResumeCredential(client);
}

function isCurrentPlayerSocket(rooms, playerId, ws) {
  return !!(playerId && ws && rooms?.clients?.get(playerId)?.ws === ws);
}

function authorizeReconnect(rooms, ws, { playerId, runId, resumeCredential } = {}) {
  const normalizedPlayerId = typeof playerId === "string" ? playerId.trim() : "";
  const normalizedRunId = typeof runId === "string" ? runId.trim() : "";
  if (!normalizedPlayerId || !normalizedRunId) return { ok: false, reason: "missing_identity" };

  const existing = rooms?.clients?.get(normalizedPlayerId);
  if (!existing || !credentialsMatch(existing.resumeCredential, resumeCredential)) {
    return { ok: false, reason: "invalid_credential" };
  }

  const socketIsOpen = existing.ws && existing.ws.readyState === existing.ws.OPEN;
  if (socketIsOpen && existing.ws !== ws && !existing.disconnectedAt) {
    return { ok: false, reason: "session_active" };
  }

  if (!rooms.reconnectClient(ws, normalizedPlayerId, normalizedRunId)) {
    return { ok: false, reason: "invalid_run" };
  }

  const reconnected = rooms.clients.get(normalizedPlayerId);
  return {
    ok: true,
    playerId: normalizedPlayerId,
    resumeCredential: issueResumeCredential(reconnected)
  };
}

module.exports = {
  authorizeReconnect,
  createResumeCredential,
  credentialsMatch,
  ensureResumeCredential,
  isCurrentPlayerSocket,
  issueResumeCredential
};
