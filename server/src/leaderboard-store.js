const fs = require("fs");
const path = require("path");

const VALID_MODES = new Set(["single", "multiplayer", "arena"]);

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function sanitizePlayerName(name) {
  const cleaned = String(name || "").trim().slice(0, 16);
  return cleaned || "Crawler";
}

function normalizeNameKey(name) {
  return sanitizePlayerName(name).toLowerCase();
}

function normalizeMode(mode) {
  const cleaned = String(mode || "").trim().toLowerCase();
  if (cleaned === "pvp" || cleaned === "pvp_arena") return "arena";
  if (cleaned === "quick_match" || cleaned === "local_multiplayer") return "multiplayer";
  return VALID_MODES.has(cleaned) ? cleaned : "single";
}

function normalizeModes(modes, fallbackMode = "single") {
  const source = Array.isArray(modes) ? modes : [fallbackMode];
  const normalized = source.map(normalizeMode).filter(mode => VALID_MODES.has(mode));
  return Array.from(new Set(normalized.length ? normalized : [normalizeMode(fallbackMode)]));
}

class LeaderboardStore {
  constructor(options = {}) {
    this.filePath = options.filePath || null;
    this.maxEntries = safeInteger(options.maxEntries, 50) || 50;
    this.persist = options.persist !== false;
    this.entries = [];
    this.load();
  }

  load() {
    if (!this.persist || !this.filePath) return;
    try {
      if (!fs.existsSync(this.filePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      const entries = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.entries) ? parsed.entries : []);
      this.entries = this.normalizeEntries(entries);
    } catch (err) {
      console.warn(`Leaderboard load failed: ${err.message}`);
      this.entries = [];
    }
  }

  save() {
    if (!this.persist || !this.filePath) return;
    const directory = path.dirname(this.filePath);
    const tempPath = `${this.filePath}.tmp`;
    const payload = JSON.stringify({ version: 1, updatedAt: Date.now(), entries: this.list() }, null, 2);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(tempPath, payload, "utf8");
    fs.renameSync(tempPath, this.filePath);
  }

  normalizeEntries(entries) {
    const merged = new Map();
    for (const entry of entries || []) {
      const normalized = this.normalizeEntry(entry);
      const existing = merged.get(normalized.nameKey);
      if (!existing) {
        merged.set(normalized.nameKey, normalized);
        continue;
      }
      existing.highestFloor = Math.max(existing.highestFloor, normalized.highestFloor);
      existing.highestGold = Math.max(existing.highestGold, normalized.highestGold);
      existing.modes = normalizeModes([...(existing.modes || []), ...(normalized.modes || [])], normalized.mode);
      existing.updatedAt = Math.max(existing.updatedAt, normalized.updatedAt);
      existing.playerIds = Array.from(new Set([...(existing.playerIds || []), ...(normalized.playerIds || [])]));
    }
    return this.sort(Array.from(merged.values())).slice(0, this.maxEntries);
  }

  normalizeEntry(entry = {}) {
    const name = sanitizePlayerName(entry.name || entry.playerName);
    const mode = normalizeMode(entry.modeKey || entry.mode || (Array.isArray(entry.modes) ? entry.modes[0] : "single"));
    return {
      name,
      nameKey: normalizeNameKey(name),
      highestFloor: safeInteger(entry.highestFloor ?? entry.floor),
      highestGold: safeInteger(entry.highestGold ?? entry.gold ?? entry.coins),
      modes: normalizeModes(entry.modes, mode),
      playerIds: Array.isArray(entry.playerIds) ? entry.playerIds.map(id => String(id).slice(0, 64)).filter(Boolean) : [],
      updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : Date.now()
    };
  }

  sort(entries) {
    return entries.sort((a, b) =>
      b.highestFloor - a.highestFloor ||
      b.highestGold - a.highestGold ||
      b.updatedAt - a.updatedAt ||
      a.name.localeCompare(b.name)
    );
  }

  list() {
    return this.sort(this.entries)
      .slice(0, this.maxEntries)
      .map(entry => ({
        name: entry.name,
        highestFloor: entry.highestFloor,
        highestGold: entry.highestGold,
        modes: normalizeModes(entry.modes, "single"),
        updatedAt: entry.updatedAt
      }));
  }

  submitScore(playerId, score = {}, profile = {}) {
    const normalized = this.normalizeEntry({
      ...score,
      name: score.name || score.playerName || profile.name,
      modes: score.modes,
      mode: score.mode || score.modeKey
    });
    const playerIdText = String(playerId || "").slice(0, 64);
    if (playerIdText) normalized.playerIds = [playerIdText];

    let changed = false;
    let entry = this.entries.find(candidate => candidate.nameKey === normalized.nameKey);
    if (!entry) {
      entry = normalized;
      this.entries.push(entry);
      changed = true;
    } else {
      if (entry.name !== normalized.name) {
        entry.name = normalized.name;
        changed = true;
      }
      if (normalized.highestFloor > entry.highestFloor) {
        entry.highestFloor = normalized.highestFloor;
        changed = true;
      }
      if (normalized.highestGold > entry.highestGold) {
        entry.highestGold = normalized.highestGold;
        changed = true;
      }
      const modes = normalizeModes([...(entry.modes || []), ...(normalized.modes || [])], normalized.mode);
      if (modes.join("|") !== (entry.modes || []).join("|")) {
        entry.modes = modes;
        changed = true;
      }
      const playerIds = Array.from(new Set([...(entry.playerIds || []), ...(normalized.playerIds || [])]));
      if (playerIds.join("|") !== (entry.playerIds || []).join("|")) {
        entry.playerIds = playerIds;
        changed = true;
      }
      if (changed) entry.updatedAt = Date.now();
    }

    this.entries = this.sort(this.entries).slice(0, this.maxEntries);
    if (changed) this.save();
    return { changed, entry: this.list().find(candidate => normalizeNameKey(candidate.name) === normalized.nameKey) };
  }

  clear() {
    this.entries = [];
    this.save();
  }
}

module.exports = {
  LeaderboardStore,
  sanitizePlayerName,
  normalizeMode,
  normalizeModes,
  safeInteger
};
