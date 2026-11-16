"use strict";

const ZOUNDHUB_URL = "https://zoundhub.com/data/artists-all.json";
const ZOUNDHUB_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ZOUNDHUB_RETRY_MS = 60 * 60 * 1000;
const ZOUNDHUB_MAX_BYTES = 20 * 1024 * 1024;
const MAX_ARTISTS_PER_LOOKUP = 20;

let zoundhub = { names: new Map(), fetchedAt: 0, attemptedAt: 0, error: null };
let zoundhubCacheLoaded = null;
let zoundhubRefresh = null;
let shardsCache = null;
let writeQueue = Promise.resolve();

async function loadZoundhubCache() {
  const { zoundhub: cached } = await browser.storage.local.get("zoundhub");
  if (cached && Array.isArray(cached.names)) {
    zoundhub = { ...cached, names: new Map(cached.names) };
  }
}

async function readCapped(response, maxBytes) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`list is over ${maxBytes / 1024 / 1024} MB`);
    }
    text += decoder.decode(value, { stream: true });
  }
}

async function refreshZoundhub() {
  zoundhub.attemptedAt = Date.now();
  try {
    const response = await fetch(ZOUNDHUB_URL, { credentials: "omit", cache: "no-cache", redirect: "error" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const names = parseZoundhub(JSON.parse(await readCapped(response, ZOUNDHUB_MAX_BYTES)));
    zoundhub = { names, fetchedAt: Date.now(), attemptedAt: zoundhub.attemptedAt, error: null };
  } catch (error) {
    zoundhub.error = String(error?.message ?? error);
  }
  await browser.storage.local.set({ zoundhub: { ...zoundhub, names: [...zoundhub.names] } }).catch(() => {});
}

async function ensureZoundhub() {
  zoundhubCacheLoaded ??= loadZoundhubCache();
  await zoundhubCacheLoaded;
  const now = Date.now();
  const stale = now - zoundhub.fetchedAt > ZOUNDHUB_MAX_AGE_MS;
  if (stale && now - zoundhub.attemptedAt > ZOUNDHUB_RETRY_MS) {
    zoundhubRefresh ??= refreshZoundhub().finally(() => (zoundhubRefresh = null));
  }
  // Only the first download is waited for; later ones refresh in the background.
  if (zoundhubRefresh && !zoundhub.fetchedAt) await zoundhubRefresh;
}

async function readShards() {
  shardsCache ??= cleanShards(await browser.storage.sync.get(null));
  return shardsCache;
}

async function lookup(artists) {
  const [shards] = await Promise.all([readShards(), ensureZoundhub()]);
  const results = (Array.isArray(artists) ? artists : []).slice(0, MAX_ARTISTS_PER_LOOKUP).map((artist) => {
    const id = isChannelId(artist?.id) ? artist.id : null;
    const name = typeof artist?.name === "string" ? artist.name.slice(0, MAX_NAME_LENGTH) : "";
    const personal = id ? personalVerdict(shards, id) : undefined;
    const listVerdict = resolveArtist({ rating: name ? zoundhub.names.get(normalizeName(name)) : undefined });
    const verdict = personal === undefined ? listVerdict : resolveArtist({ personal });
    return { id, name, verdict, listVerdict, personal: personal ?? null };
  });
  return {
    artists: results,
    usage: verdictUsage(shards),
    zoundhub: { fetchedAt: zoundhub.fetchedAt, error: zoundhub.error, count: zoundhub.names.size },
  };
}

function setVerdict(id, value) {
  const task = writeQueue.then(async () => {
    if (!isChannelId(id) || ![VERDICT_AI, VERDICT_HUMAN, null].includes(value)) {
      return { ok: false, error: "Invalid verdict." };
    }
    shardsCache = null;
    const result = applyVerdict(await readShards(), id, value);
    if (result.error) return { ok: false, error: result.error };
    try {
      if (result.shard) await browser.storage.sync.set({ [result.key]: result.shard });
      else await browser.storage.sync.remove(result.key);
    } catch (error) {
      shardsCache = null;
      return { ok: false, error: `Couldn't save: ${error?.message ?? error}` };
    }
    shardsCache = result.shards;
    return { ok: true };
  });
  writeQueue = task.catch(() => {});
  return task;
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") shardsCache = null;
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== browser.runtime.id) return undefined;
  switch (message?.type) {
    case "lookup":
      return lookup(message.artists);
    case "setVerdict":
      return setVerdict(message.id, message.value);
    default:
      return undefined;
  }
});
