"use strict";

const CHANNEL_ID = /^UC[\w-]{22}$/;
const VERDICT_KEY_PREFIX = "verdicts-";
const VERDICT_AI = 1;
const VERDICT_HUMAN = 0;
// Firefox's storage.sync limits: key length + JSON length of the value.
const SYNC_QUOTA_BYTES = 102400;
const SYNC_QUOTA_BYTES_PER_ITEM = 8192;
const SYNC_WARN_RATIO = 0.9;
const ZOUNDHUB_MIN_RATING = 4;
const MAX_NAME_LENGTH = 200;

function isChannelId(value) {
  return typeof value === "string" && CHANNEL_ID.test(value);
}

function channelIdFromHref(href) {
  const match = /(?:^|\/)channel\/(UC[\w-]{22})(?:[/?#]|$)/.exec(href ?? "");
  return match ? match[1] : null;
}

function normalizeName(name) {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

// Shards keep each item under the per-item limit; the 3rd character of an ID is evenly spread.
function shardKey(channelId) {
  return VERDICT_KEY_PREFIX + channelId[2];
}

function itemBytes(key, value) {
  return key.length + JSON.stringify(value).length;
}

function verdictUsage(shards) {
  let bytes = 0;
  let count = 0;
  for (const [key, shard] of Object.entries(shards)) {
    bytes += itemBytes(key, shard);
    count += Object.keys(shard).length;
  }
  return {
    count,
    bytes,
    quota: SYNC_QUOTA_BYTES,
    percent: Math.ceil((bytes / SYNC_QUOTA_BYTES) * 100),
    warn: bytes >= SYNC_QUOTA_BYTES * SYNC_WARN_RATIO,
  };
}

// Drops anything in storage that isn't a verdict shard of valid IDs.
function cleanShards(stored) {
  const shards = {};
  for (const [key, shard] of Object.entries(stored ?? {})) {
    if (!key.startsWith(VERDICT_KEY_PREFIX) || !shard || typeof shard !== "object") continue;
    const clean = {};
    for (const [id, value] of Object.entries(shard)) {
      if (isChannelId(id) && shardKey(id) === key && (value === VERDICT_AI || value === VERDICT_HUMAN)) {
        clean[id] = value;
      }
    }
    if (Object.keys(clean).length) shards[key] = clean;
  }
  return shards;
}

function personalVerdict(shards, channelId) {
  const shard = shards[shardKey(channelId)];
  return shard && Object.hasOwn(shard, channelId) ? shard[channelId] : undefined;
}

function applyVerdict(shards, channelId, value) {
  const key = shardKey(channelId);
  const shard = { ...shards[key] };
  if (value === null) delete shard[channelId];
  else shard[channelId] = value;
  const next = { ...shards };
  if (Object.keys(shard).length) next[key] = shard;
  else delete next[key];
  if (value !== null) {
    const usage = verdictUsage(next);
    if (usage.bytes > SYNC_QUOTA_BYTES || itemBytes(key, shard) > SYNC_QUOTA_BYTES_PER_ITEM) {
      return { error: "Sync storage is full: clear some verdicts first." };
    }
  }
  return { shards: next, key, shard: next[key] ?? null };
}

function parseZoundhub(data) {
  if (!data || !Array.isArray(data.artists)) throw new Error("unexpected format");
  const names = new Map();
  for (const artist of data.artists) {
    if (!artist || typeof artist.name !== "string" || !Number.isInteger(artist.rating)) continue;
    if (artist.rating < ZOUNDHUB_MIN_RATING || artist.rating > 5 || artist.name.length > MAX_NAME_LENGTH) continue;
    const name = normalizeName(artist.name);
    if (name && !(names.get(name) >= artist.rating)) names.set(name, artist.rating);
  }
  return names;
}

function resolveArtist({ personal, rating }) {
  if (personal === VERDICT_AI) return { level: "ai", source: "you" };
  if (personal === VERDICT_HUMAN) return { level: "human", source: "you" };
  if (rating !== undefined) return { level: "maybe", source: "zoundhub", rating };
  return { level: "unknown", source: null };
}

const LEVEL_ORDER = ["ai", "maybe", "unknown", "human"];

// A track is as suspect as its most suspect artist.
function combineVerdicts(verdicts) {
  return verdicts.reduce(
    (worst, verdict) => (LEVEL_ORDER.indexOf(verdict.level) < LEVEL_ORDER.indexOf(worst.level) ? verdict : worst),
    { level: "human", source: "you" },
  );
}

function verdictLabel(verdict) {
  switch (`${verdict.level}:${verdict.source}`) {
    case "ai:you":
      return "AI";
    case "human:you":
      return "Not AI";
    case "maybe:zoundhub":
      return "Maybe AI";
    default:
      return "Not listed";
  }
}

function verdictDetail(verdict) {
  switch (verdict.source) {
    case "you":
      return "Your verdict.";
    case "zoundhub":
      return `Zoundhub rates an artist with this name ${verdict.rating}/5. Name match only: it may be a different artist.`;
    default:
      return "Not on Zoundhub's list.";
  }
}
