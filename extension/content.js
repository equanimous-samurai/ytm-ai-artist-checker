"use strict";

const UPDATE_DELAY_MS = 200;
const MENU_WIDTH = 330;

// Verdict colours, shared by the bar and the menu: a translucent tint, a matching glow and light text.
const TINT_STYLE = `
  .ai { --tint: rgba(229, 57, 53, 0.42); --glow: rgba(229, 57, 53, 0.45); color: #ffe1de; }
  .maybe { --tint: rgba(249, 168, 37, 0.38); --glow: rgba(249, 168, 37, 0.4); color: #ffecc0; }
  .human { --tint: rgba(76, 175, 80, 0.38); --glow: rgba(76, 175, 80, 0.4); color: #dcf0dd; }
  .unknown { --tint: rgba(255, 255, 255, 0.1); --glow: transparent; color: #c4c4c4; }
`;

// Spacing lives inside the shadow root: YouTube Music's CSS overrides a margin on the host.
const BADGE_STYLE = `
  :host { display: inline-flex; align-items: center; flex: none; }
  .spacer { display: inline-flex; align-items: center; padding: 0 24px; }
  button {
    all: unset; box-sizing: border-box; display: inline-flex; align-items: center; height: 34px; padding: 0 18px;
    border-radius: 17px; cursor: pointer; font: 500 14px/1 Roboto, Arial, sans-serif; white-space: nowrap;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0) 60%), var(--tint);
    box-shadow: 0 0 18px 2px var(--glow), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }
  button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  ${TINT_STYLE}
`;

// A frosted-glass card over the page.
const MENU_STYLE = `
  :host { all: initial; }
  .menu {
    box-sizing: border-box; width: ${MENU_WIDTH}px; max-width: calc(100vw - 16px); max-height: 70vh; overflow-y: auto;
    padding: 16px 18px; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 14px; color: #fff;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.02)), rgba(28, 28, 28, 0.62);
    backdrop-filter: blur(20px) saturate(140%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    font: 13px/1.45 Roboto, Arial, sans-serif;
    color-scheme: dark; scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
  }
  .artist + .artist { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.12); }
  .head { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .name {
    overflow: hidden; font-size: 17px; font-weight: 700; line-height: 22px; text-overflow: ellipsis; white-space: nowrap;
  }
  .label {
    flex: none; padding: 2px 9px; border-radius: 11px; background: var(--tint);
    font-size: 12px; font-weight: 500; line-height: 17px;
  }
  .detail { margin-top: 10px; color: rgba(255, 255, 255, 0.75); }
  .actions { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
  .actions button {
    all: unset; box-sizing: border-box; height: 32px; padding: 0 18px; border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 16px; cursor: pointer; color: #fff; font-size: 14px; font-weight: 500; line-height: 30px;
    transition: background-color 0.15s, border-color 0.15s;
  }
  .actions button:hover { border-color: rgba(255, 255, 255, 0.6); background: rgba(255, 255, 255, 0.06); }
  .actions button[aria-pressed="true"] {
    border-color: rgba(255, 255, 255, 0.9); color: #1f1f1f; background: linear-gradient(180deg, #fff, #ececec);
    box-shadow: 0 0 14px 2px var(--glow);
  }
  .actions .clear { margin-left: auto; padding: 0 4px; border: none; color: rgba(255, 255, 255, 0.55); }
  .actions .clear:hover { background: none; color: #fff; }
  .actions .clear:disabled { color: rgba(255, 255, 255, 0.3); cursor: default; }
  .actions button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .footer {
    display: grid; gap: 4px; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.6); font-size: 12px; line-height: 16px;
  }
  .warning { color: #ffcc80; }
  .error { color: #ff8a80; }
  a { color: #b3a9ff; text-decoration: underline; text-underline-offset: 2px; }
  a:hover { color: #d0c9ff; }
  ${TINT_STYLE}
`;

let playerBar = null;
let badgeHost = null;
let badge = null;
let menuHost = null;
let menu = null;
let menuOpen = false;
let currentKey = null;
let currentResult = null;
let lastError = null;
let lookupSeq = 0;
let updateTimer = null;

// Text goes in as text nodes only, never as HTML.
function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === "text") node.textContent = value;
    else node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

function link(href, text) {
  return el("a", { href, target: "_blank", rel: "noopener noreferrer", text });
}

// Keeps YouTube Music's own handlers (expand the player, keyboard shortcuts) from seeing our clicks and keys.
function isolate(host) {
  for (const type of ["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup", "keydown", "keyup", "keypress"]) {
    host.addEventListener(type, (event) => event.stopPropagation());
  }
}

function createBadge() {
  badgeHost = el("span");
  badgeHost.style.display = "none";
  const root = badgeHost.attachShadow({ mode: "closed" });
  badge = el("button", { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" });
  badge.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
  root.append(el("style", { text: BADGE_STYLE }), el("span", { class: "spacer" }, [badge]));
  isolate(badgeHost);
}

function createMenu() {
  menuHost = el("div");
  Object.assign(menuHost.style, { position: "fixed", zIndex: "2147483647", display: "none" });
  const root = menuHost.attachShadow({ mode: "closed" });
  menu = el("div", { class: "menu", role: "dialog", "aria-label": "AI artist verdicts" });
  root.append(el("style", { text: MENU_STYLE }), menu);
  isolate(menuHost);
  document.body.append(menuHost);
}

// During an ad, the bar names the advertiser, not an artist.
function adPlaying() {
  return Boolean(document.querySelector(".html5-video-player.ad-showing"));
}

function readArtists() {
  if (adPlaying()) return [];
  const byline = playerBar.querySelector(".byline");
  if (!byline) return [];
  const linked = [...byline.querySelectorAll("a[href]")]
    .map((a) => ({ id: channelIdFromHref(a.getAttribute("href")), name: a.textContent.trim() }))
    .filter((artist) => artist.id);
  if (linked.length) return linked;
  const name = byline.textContent.split("•")[0].trim();
  return name ? [{ id: null, name }] : [];
}

function placeBadge() {
  const anchor = playerBar.querySelector(".middle-controls .content-info-wrapper");
  if (anchor) {
    if (anchor.nextElementSibling !== badgeHost) anchor.after(badgeHost);
  } else if (!playerBar.contains(badgeHost)) {
    playerBar.prepend(badgeHost);
  }
}

function renderBadge() {
  const artists = currentResult?.artists ?? [];
  if (!artists.length) {
    badgeHost.style.display = "none";
    return;
  }
  const verdict = combineVerdicts(artists.map((artist) => artist.verdict));
  badge.textContent = verdictLabel(verdict) + (currentResult.usage.warn ? " ⚠" : "");
  badge.className = verdict.level;
  badge.title = artists.map((artist) => `${artist.name}: ${verdictLabel(artist.verdict)}`).join("\n");
  badgeHost.style.display = "";
}

function artistSection(artist) {
  const detail =
    artist.personal === null
      ? verdictDetail(artist.verdict)
      : `${verdictDetail(artist.verdict)} ${verdictDetail(artist.listVerdict)}`;
  const section = el("div", { class: "artist" }, [
    el("div", { class: "head" }, [
      el("div", { class: "name", text: artist.name || "Unknown artist", title: artist.name }),
      el("span", { class: `label ${artist.verdict.level}`, text: verdictLabel(artist.verdict) }),
    ]),
    el("div", { class: "detail", text: detail }),
  ]);
  if (!artist.id) {
    section.append(el("div", { class: "detail", text: "No channel link, so a verdict can't be saved." }));
    return section;
  }
  const actions = el("div", { class: "actions" });
  for (const [text, value, kind] of [
    ["AI", VERDICT_AI, "ai"],
    ["Not AI", VERDICT_HUMAN, "human"],
    ["Clear", null, "clear"],
  ]) {
    const button = el("button", { type: "button", class: kind, text });
    if (value === null) button.disabled = artist.personal === null;
    else button.setAttribute("aria-pressed", String(artist.personal === value));
    button.addEventListener("click", () => saveVerdict(artist.id, value));
    actions.append(button);
  }
  section.append(actions);
  return section;
}

function zoundhubStatus({ fetchedAt, error, count }) {
  const updated = fetchedAt ? `${count.toLocaleString()} names, updated ${new Date(fetchedAt).toLocaleString()}` : null;
  if (error) return `Zoundhub list: last update failed (${error})${updated ? `; using ${updated}` : ""}.`;
  return `Zoundhub list: ${updated ?? "not downloaded yet"}.`;
}

function footer({ usage, zoundhub }) {
  const node = el("div", { class: "footer" }, [
    el("div", {
      class: usage.warn ? "warning" : "",
      text: `Your verdicts: ${usage.count.toLocaleString()} · ${usage.percent}% of sync storage`,
    }),
  ]);
  if (usage.warn) {
    node.append(el("div", { class: "warning", text: "Nearly full: clear verdicts that only repeat what a list says." }));
  }
  if (lastError) node.append(el("div", { class: "error", text: lastError }));
  node.append(
    el("div", { text: zoundhubStatus(zoundhub) }),
    el("div", {}, ["Data: ", link("https://zoundhub.com", "Zoundhub"), "."]),
  );
  return node;
}

function renderMenu() {
  menu.replaceChildren(...currentResult.artists.map(artistSection), footer(currentResult));
}

function positionMenu() {
  const rect = badge.getBoundingClientRect();
  menuHost.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - MENU_WIDTH - 8))}px`;
  menuHost.style.bottom = `${innerHeight - rect.top + 8}px`;
}

function openMenu() {
  if (!currentResult?.artists.length) return;
  menuOpen = true;
  badge.setAttribute("aria-expanded", "true");
  renderMenu();
  menuHost.style.display = "block";
  positionMenu();
}

function closeMenu() {
  menuOpen = false;
  badge.setAttribute("aria-expanded", "false");
  menuHost.style.display = "none";
}

async function saveVerdict(id, value) {
  const response = await browser.runtime
    .sendMessage({ type: "setVerdict", id, value })
    .catch((error) => ({ ok: false, error: String(error?.message ?? error) }));
  lastError = response?.ok ? null : (response?.error ?? "Couldn't save.");
  await update(true);
}

let watchedPlayer = null;

// Ads start and end on the video player, not in the bar.
function watchPlayer() {
  const player = document.querySelector(".html5-video-player");
  if (!player || player === watchedPlayer) return;
  watchedPlayer = player;
  new MutationObserver(scheduleUpdate).observe(player, { attributes: true, attributeFilter: ["class"] });
}

async function update(force = false) {
  if (!playerBar) return;
  watchPlayer();
  placeBadge();
  const artists = readArtists();
  const key = JSON.stringify(artists);
  if (key === currentKey && !force) return;
  if (key !== currentKey) {
    currentKey = key;
    currentResult = null;
    lastError = null;
    closeMenu();
    renderBadge();
  }
  const seq = ++lookupSeq;
  const result = artists.length
    ? await browser.runtime.sendMessage({ type: "lookup", artists }).catch(() => null)
    : null;
  if (seq !== lookupSeq) return;
  currentResult = result;
  renderBadge();
  if (menuOpen && currentResult) renderMenu();
}

function scheduleUpdate() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(update, UPDATE_DELAY_MS);
}

function attach(bar) {
  playerBar = bar;
  new MutationObserver(scheduleUpdate).observe(bar, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href"],
  });
  update();
}

function waitForPlayerBar() {
  const bar = document.querySelector("ytmusic-player-bar");
  if (bar) return attach(bar);
  const observer = new MutationObserver(() => {
    const found = document.querySelector("ytmusic-player-bar");
    if (!found) return;
    observer.disconnect();
    attach(found);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

document.addEventListener(
  "click",
  (event) => {
    const path = event.composedPath();
    if (menuOpen && !path.includes(menuHost) && !path.includes(badgeHost)) closeMenu();
  },
  true,
);
// Window capture runs first, so YouTube Music never sees this Escape and keeps its player page open.
addEventListener(
  "keydown",
  (event) => {
    if (!menuOpen || event.key !== "Escape") return;
    event.stopImmediatePropagation();
    closeMenu();
  },
  true,
);
addEventListener("resize", () => menuOpen && positionMenu());

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" || (area === "local" && changes.zoundhub)) update(true);
});

createBadge();
createMenu();
waitForPlayerBar();
