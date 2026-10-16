import { Hono } from 'hono'
import { SCRIPT } from '../docs/script.js'
import { STYLE } from '../docs/style.js'
import type { GatewayEnv } from '../types.js'

/** The gateway's own documentation site, served from the gateway so its Try it panels are same-origin (no CORS) and the key stays in the browser. */
export const docs = new Hono<GatewayEnv>()
  .get('/', (c) => c.html(PAGE))
  .get('/ui', (c) => c.html(PAGE))
  .get('/docs', (c) => c.html(PAGE))

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gateway Docs</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%238E44AD'/%3E%3Cpath d='M8 16h16M18 10l6 6-6 6' stroke='%23D4AF37' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,460..560,30..100&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body>
<header class="top">
  <button class="iconbtn burger" id="burger" aria-label="Menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  <a class="brand" href="#/"><span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M13 6l7 6-7 6"/></svg></span>Gateway <small>Docs</small></a>
  <nav class="tabs">
    <a class="tab" data-tab="guides" href="#/">Guides</a>
    <a class="tab" data-tab="ref" href="#/api/notifications/sendNotification">API reference</a>
    <a class="tab" data-tab="agents" href="#/guides/mcp">AI agents</a>
  </nav>
  <span class="spacer"></span>
  <button class="search" id="searchbtn" aria-label="Search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Search docs</span><kbd>Ctrl K</kbd></button>
  <button class="keybtn" id="keybtn"><i class="dot"></i><span>Add your key</span></button>
  <button class="iconbtn" id="theme" aria-label="Toggle theme"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>
</header>
<div class="shell">
  <aside class="side"><nav class="nav" id="nav" aria-label="Documentation"></nav></aside>
  <main class="main" id="main"><article class="doc"><p class="hint">Loading…</p></article></main>
</div>
<div class="scrim" id="scrim">
  <div class="modal" id="searchbox"><input id="sin" type="search" placeholder="Search guides and endpoints" aria-label="Search" autocomplete="off"><div class="results" id="results"></div></div>
  <div class="modal" id="keybox" style="display:none"><div class="keypop">
    <h3>Your Caller key</h3>
    <p class="hint">Sent only to this gateway, as a bearer header. Kept in this browser tab and gone when you close it.</p>
    <input id="keyin" type="password" placeholder="Paste your key" autocomplete="off" spellcheck="false" aria-label="Caller key">
    <div style="display:flex;gap:8px"><button class="btn primary" id="keysave">Save</button><button class="btn" id="keyclear">Clear</button></div>
  </div></div>
</div>
<div class="toast" id="toast" role="status"></div>
<script>${SCRIPT}</script>
</body>
</html>`
