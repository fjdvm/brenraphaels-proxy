import { Hono } from 'hono'
import type { GatewayEnv } from '../types.js'

/** A single-page API explorer served by the gateway itself: same origin, so no CORS, and the Caller key never leaves the browser. */
export const explorer = new Hono<GatewayEnv>()
  .get('/', (c) => c.html(PAGE))
  .get('/ui', (c) => c.html(PAGE))

// Written without backticks or template placeholders so it can sit in one raw string.
const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gateway Explorer</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234f46e5'/%3E%3Cpath d='M8 16h16M18 10l6 6-6 6' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<style>
:root{--bg:#f7f7f9;--panel:#fff;--panel2:#f1f1f5;--text:#16161d;--muted:#6b6b7b;--line:#e3e3ea;--accent:#4f46e5;--accent-fg:#fff;--ok:#16794a;--okbg:#e3f6ec;--warn:#9a5b00;--warnbg:#fff1d6;--err:#b42318;--errbg:#fde8e6;--code:#f4f4f8;--k:#7c3aed;--s:#0f766e;--n:#b45309;--b:#be185d}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0e0e13;--panel:#17171f;--panel2:#1f1f29;--text:#ececf3;--muted:#9a9aab;--line:#2b2b38;--accent:#818cf8;--accent-fg:#0e0e13;--ok:#4ade80;--okbg:#10301f;--warn:#fbbf24;--warnbg:#3a2a0a;--err:#f87171;--errbg:#3b1512;--code:#12121a;--k:#c4b5fd;--s:#5eead4;--n:#fbbf24;--b:#f9a8d4}}
:root[data-theme="dark"]{--bg:#0e0e13;--panel:#17171f;--panel2:#1f1f29;--text:#ececf3;--muted:#9a9aab;--line:#2b2b38;--accent:#818cf8;--accent-fg:#0e0e13;--ok:#4ade80;--okbg:#10301f;--warn:#fbbf24;--warnbg:#3a2a0a;--err:#f87171;--errbg:#3b1512;--code:#12121a;--k:#c4b5fd;--s:#5eead4;--n:#fbbf24;--b:#f9a8d4}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
button,input,select,textarea{font:inherit;color:inherit}
.app{display:grid;grid-template-columns:320px 1fr;grid-template-rows:auto 1fr;height:100%}
header{grid-column:1/-1;display:flex;gap:12px;align-items:center;padding:10px 16px;background:var(--panel);border-bottom:1px solid var(--line);flex-wrap:wrap}
.brand{font-weight:700;font-size:15px;display:flex;align-items:center;gap:8px;margin-right:auto}
.logo{width:22px;height:22px;border-radius:6px;background:var(--accent);display:inline-block}
.base{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--muted);background:var(--panel2);padding:4px 8px;border-radius:6px}
.keybox{display:flex;gap:6px;align-items:center}
.keybox input{width:260px;max-width:50vw}
input[type=text],input[type=password],input[type=search],select,textarea{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:7px 10px;width:100%}
input:focus,select:focus,textarea:focus,button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
button{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:7px 12px;cursor:pointer}
button:hover{border-color:var(--accent)}
button.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent);font-weight:600}
button.primary:disabled{opacity:.6;cursor:wait}
.dot{width:9px;height:9px;border-radius:50%;background:var(--muted);display:inline-block}
.dot.ok{background:var(--ok)}.dot.err{background:var(--err)}
aside{border-right:1px solid var(--line);background:var(--panel);overflow:auto;padding:12px}
aside .search{margin-bottom:10px}
.group{margin:14px 0 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.item{display:flex;gap:8px;align-items:center;width:100%;text-align:left;border:0;background:transparent;padding:6px 8px;border-radius:8px}
.item:hover{background:var(--panel2)}
.item.active{background:var(--panel2);box-shadow:inset 3px 0 0 var(--accent)}
.item .p{font-family:ui-monospace,Menlo,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m{font:700 10px/1 ui-monospace,Menlo,monospace;padding:4px 5px;border-radius:5px;min-width:44px;text-align:center;color:#fff}
.m.GET{background:#0f766e}.m.POST{background:#4f46e5}.m.PUT{background:#b45309}.m.PATCH{background:#9333ea}.m.DELETE{background:#b42318}.m.WS{background:#be185d}
main{overflow:auto;padding:20px;min-width:0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px}
h1{font-size:18px;margin:0 0 2px}
h2{font-size:13px;margin:0 0 10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.sub{color:var(--muted);margin:0 0 12px}
.urlbar{display:flex;gap:8px;align-items:center;font-family:ui-monospace,Menlo,monospace;font-size:13px;background:var(--code);border:1px solid var(--line);border-radius:8px;padding:8px 10px;word-break:break-all}
.row{display:grid;grid-template-columns:160px 1fr;gap:10px;align-items:center;margin-bottom:8px}
.row label{font-family:ui-monospace,Menlo,monospace;font-size:12px}
.row .req{color:var(--err)}
.row small{color:var(--muted);display:block;font-family:system-ui}
.tag{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-left:6px}
textarea{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;min-height:170px;resize:vertical}
.actions{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}
.hint{color:var(--muted);font-size:12px}
.chip{font-weight:700;padding:3px 9px;border-radius:999px;font-size:12px}
.chip.s2{background:var(--okbg);color:var(--ok)}.chip.s4{background:var(--warnbg);color:var(--warn)}.chip.s5,.chip.s0{background:var(--errbg);color:var(--err)}.chip.s1,.chip.s3{background:var(--panel2);color:var(--text)}
.meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px;color:var(--muted);font-size:12px}
pre{margin:0;background:var(--code);border:1px solid var(--line);border-radius:8px;padding:12px;overflow:auto;max-height:480px;font:12.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
.k{color:var(--k)}.s{color:var(--s)}.n{color:var(--n)}.b{color:var(--b)}
details summary{cursor:pointer;color:var(--muted);margin:8px 0}
table{border-collapse:collapse;width:100%;font-size:12px}
td{padding:3px 8px;border-bottom:1px solid var(--line);vertical-align:top;word-break:break-all}
td:first-child{color:var(--muted);white-space:nowrap;width:1%}
.empty{color:var(--muted);text-align:center;padding:40px 0}
.log{height:260px;overflow:auto}
.log div{padding:2px 0;border-bottom:1px dashed var(--line)}
.log time{color:var(--muted);margin-right:8px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:8px 14px;border-radius:8px;font-size:13px;opacity:0;pointer-events:none;transition:opacity .2s}
.toast.show{opacity:1}
.banner{background:var(--warnbg);color:var(--warn);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px}
@media (max-width:820px){.app{grid-template-columns:1fr;grid-template-rows:auto auto 1fr}aside{border-right:0;border-bottom:1px solid var(--line);max-height:38vh}.row{grid-template-columns:1fr}.keybox input{width:100%;max-width:none}.keybox{flex:1 1 100%}.grid2{grid-template-columns:1fr}main{padding:12px}}
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="brand"><span class="logo"></span> Gateway Explorer <span class="dot" id="health" title="gateway health"></span></div>
    <span class="base" id="base"></span>
    <div class="keybox">
      <input type="password" id="key" placeholder="Paste your Caller key" autocomplete="off" spellcheck="false" aria-label="Caller key">
      <button id="keyclear" title="Forget the key">Clear</button>
    </div>
    <button id="theme" title="Toggle theme">Theme</button>
  </header>
  <aside>
    <input type="search" class="search" id="q" placeholder="Search endpoints ( / )" aria-label="Search endpoints">
    <nav id="nav"></nav>
  </aside>
  <main id="main"><div class="empty">Loading endpoints…</div></main>
</div>
<div class="toast" id="toast"></div>
<script>
(function () {
  'use strict';
  var BASE = location.origin;
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    [].concat(kids == null ? [] : kids).forEach(function (c) {
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return e;
  }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 1600); }
  function store(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }

  /* ---------- OpenAPI helpers ---------- */
  function resolve(spec, node, depth) {
    depth = depth || 0;
    if (!node || depth > 8) return node;
    if (node.$ref) {
      var parts = node.$ref.replace(/^#\//, '').split('/');
      var t = spec;
      for (var i = 0; i < parts.length; i++) t = t && t[parts[i]];
      return resolve(spec, t, depth + 1);
    }
    return node;
  }
  var HINTS = { userId: 'user-123', app: 'crms', sendingApp: 'crms', targetApp: 'crms', type: 'order.shipped', title: 'Hello from the Explorer',
    body: 'This message was sent from the Gateway Explorer.', filename: 'example.txt', contentType: 'text/plain', visibility: 'private',
    retentionType: 'temporary', system: 'CRMS', entityType: 'order', entityId: '1001', role: 'cover image', size: 5, to: 'you@example.com' };
  function example(spec, schema, depth, name) {
    depth = depth || 0;
    schema = resolve(spec, schema);
    if (!schema || depth > 6) return null;
    if (name && HINTS[name] !== undefined && schema.type !== 'object' && schema.type !== 'array' && (!schema.enum || schema.enum.indexOf(HINTS[name]) >= 0)) return HINTS[name];
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;
    if (schema.enum) return schema.enum[0];
    if (schema.oneOf || schema.anyOf) return example(spec, (schema.oneOf || schema.anyOf)[0], depth + 1);
    var t = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (t === 'object' || schema.properties) {
      var o = {};
      Object.keys(schema.properties || {}).forEach(function (k) { o[k] = example(spec, schema.properties[k], depth + 1, k); });
      return o;
    }
    if (t === 'array') return [example(spec, schema.items, depth + 1)];
    if (t === 'integer' || t === 'number') return schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + 1 : (schema.minimum !== undefined ? schema.minimum : 1);
    if (t === 'boolean') return false;
    if (schema.format === 'uri') return 'https://example.com';
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'uuid') return '00000000-0000-4000-8000-000000000000';
    return 'string';
  }
  var METHODS = ['get', 'post', 'put', 'patch', 'delete'];
  function opsFromSpec(service, prefix, spec, keepOwnPrefix) {
    var out = [];
    Object.keys(spec.paths || {}).forEach(function (p) {
      if (/^\/(docs|openapi\.json|mcp|health|live)$/.test(p) || /\/live$/.test(p) || /^\/cron/.test(p)) return;
      var item = spec.paths[p];
      var shared = (item.parameters || []);
      METHODS.forEach(function (m) {
        var op = item[m];
        if (!op) return;
        var params = shared.concat(op.parameters || []).map(function (x) { return resolve(spec, x); }).filter(Boolean).map(function (x) {
          var s = resolve(spec, x.schema) || {};
          var ex = x.example !== undefined ? x.example : example(spec, s, 0, x.name);
          return { name: x.name, in: x.in, required: !!x.required, description: x.description || '', example: x.required && ex != null ? String(ex) : '' };
        });
        var body = null;
        var rb = resolve(spec, op.requestBody);
        if (rb && rb.content && rb.content['application/json']) body = example(spec, rb.content['application/json'].schema);
        out.push({
          service: service, method: m.toUpperCase(), path: (keepOwnPrefix && p.indexOf(prefix) === 0 ? '' : prefix) + p,
          summary: op.summary || op.operationId || '', description: op.description || '', params: params, body: body, auth: true
        });
      });
    });
    return out;
  }

  /* ---------- Static operations ---------- */
  var now = function () { return new Date().toISOString(); };
  function ev(source, action, extra) {
    var e = { source: source, action: action, outcome: 'success', actor: { type: 'system', id: 'explorer', display_name: 'Gateway Explorer' },
      target: { type: 'test', id: 'explorer', display_name: 'Explorer test' }, description: 'Event written from the Gateway Explorer.', occurred_at: now() };
    for (var k in (extra || {})) e[k] = extra[k];
    return e;
  }
  var STATIC = [
    { service: 'Gateway', method: 'GET', path: '/health', summary: 'Gateway health', description: 'Open: needs no key.', params: [], body: null, auth: false },
    { service: 'Gateway', method: 'POST', path: '/live-tickets', summary: 'Issue a Live ticket', description: 'Your backend asks for a ticket for one user; the browser then opens the live WebSocket with it. Add ticketId and role for a Ticket conversation. Use the Live tester to connect.', params: [], body: { userId: 'user-123' }, auth: true },
    { service: 'Audit', method: 'POST', path: '/audit/events', summary: 'Write an Audit Event', description: 'Needs a write:<Source> key whose Source matches the body. Audit Events cannot be deleted.', params: [], body: ev('CRMS', 'record.viewed', { module: 'Dashboard' }), auth: true },
    { service: 'Audit', method: 'POST', path: '/audit/events/batch', summary: 'Write a batch (1 to 100)', description: 'Every event must match the key\'s Source.', params: [], body: { events: [ev('CRMS', 'record.viewed', { module: 'Dashboard' })] }, auth: true },
    { service: 'Audit', method: 'GET', path: '/audit/events', summary: 'Administrator list and search', description: 'Needs a read:admin key.', params: ['source', 'module', 'action', 'outcome', 'actor_type', 'actor_id', 'subject_type', 'subject_id', 'q', 'from', 'to', 'limit', 'cursor'].map(function (n) { return { name: n, in: 'query', required: false, description: '', example: '' }; }), body: null, auth: true },
    { service: 'Audit', method: 'GET', path: '/audit/events/{id}', summary: 'Get one Audit Event', description: 'Needs a read:admin key.', params: [{ name: 'id', in: 'path', required: true, description: '', example: '' }], body: null, auth: true },
    { service: 'Audit', method: 'GET', path: '/audit/events/stats', summary: 'Stats for charts', description: 'group_by is day, source, action or outcome.', params: [{ name: 'group_by', in: 'query', required: true, description: '', example: 'day' }, { name: 'limit', in: 'query', required: false, description: '', example: '' }], body: null, auth: true },
    { service: 'Audit', method: 'GET', path: '/audit/events/valid-values', summary: 'Sources, modules and actions', description: 'Needs a read:admin key.', params: [], body: null, auth: true },
    { service: 'Audit', method: 'GET', path: '/audit/events/export', summary: 'Export events', description: 'Records its own Audit Event.', params: [{ name: 'format', in: 'query', required: true, description: 'csv or json', example: 'json' }, { name: 'from', in: 'query', required: true, description: '', example: new Date(Date.now() - 864e5).toISOString() }, { name: 'to', in: 'query', required: true, description: '', example: now() }, { name: 'requested_by_id', in: 'query', required: true, description: '', example: 'admin-1' }, { name: 'requested_by_name', in: 'query', required: true, description: '', example: 'Admin One' }], body: null, auth: true },
    { service: 'Audit', method: 'GET', path: '/audit/events/customer-activity', summary: 'A Customer\'s own activity', description: 'Needs a read:customer key.', params: [{ name: 'subject_type', in: 'query', required: true, description: '', example: 'customer' }, { name: 'subject_id', in: 'query', required: true, description: '', example: 'cust-42' }, { name: 'limit', in: 'query', required: false, description: '', example: '' }], body: null, auth: true },
    { service: 'Live', method: 'WS', path: '/notifications/live', summary: 'Live tester (WebSocket)', description: '', params: [], body: null, auth: true, live: true }
  ];

  var OPS = STATIC.slice();
  var current = null;
  var keyEl = $('key');
  keyEl.value = load('gw_key');
  keyEl.addEventListener('input', function () { store('gw_key', keyEl.value.trim() || null); });
  $('keyclear').addEventListener('click', function () { keyEl.value = ''; store('gw_key', null); toast('Key cleared'); });
  $('base').textContent = BASE;
  $('theme').addEventListener('click', function () {
    var el = document.documentElement;
    var dark = el.getAttribute('data-theme') ? el.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    el.setAttribute('data-theme', dark ? 'light' : 'dark');
  });

  /* ---------- Sidebar ---------- */
  var ORDER = ['Gateway', 'Notifications', 'Files', 'Audit', 'Live'];
  function renderNav() {
    var q = $('q').value.trim().toLowerCase();
    var nav = $('nav'); nav.textContent = '';
    ORDER.forEach(function (svc) {
      var list = OPS.filter(function (o) { return o.service === svc && (!q || (o.method + ' ' + o.path + ' ' + o.summary).toLowerCase().indexOf(q) >= 0); });
      if (!list.length) return;
      nav.appendChild(h('div', { class: 'group' }, svc));
      list.forEach(function (o) {
        nav.appendChild(h('button', { class: 'item' + (o === current ? ' active' : ''), title: o.summary, onclick: function () { select(o); } }, [
          h('span', { class: 'm ' + o.method }, o.method), h('span', { class: 'p' }, o.path)
        ]));
      });
    });
  }
  $('q').addEventListener('input', renderNav);
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); $('q').focus(); }
  });

  /* ---------- JSON colouring ---------- */
  function colour(text) {
    var frag = document.createDocumentFragment();
    var re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var cls = m[1] ? (m[2] ? 'k' : 's') : (m[3] ? 'b' : 'n');
      frag.appendChild(h('span', { class: cls }, m[1] ? m[1] : (m[3] || m[4])));
      if (m[2]) frag.appendChild(document.createTextNode(m[2]));
      last = re.lastIndex;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  /* ---------- Operation view ---------- */
  function select(op) {
    current = op; renderNav();
    var main = $('main'); main.textContent = '';
    main.scrollTop = 0;
    if (op.live) return renderLive(main);
    var inputs = {};
    var needsKey = op.auth;
    var card = h('div', { class: 'card' });
    card.appendChild(h('h1', null, [h('span', { class: 'm ' + op.method, style: 'margin-right:8px' }, op.method), op.summary || op.path]));
    card.appendChild(h('p', { class: 'sub' }, op.description || ' '));
    var urlbar = h('div', { class: 'urlbar' });
    card.appendChild(urlbar);
    var banner = h('div', { class: 'banner', style: 'display:none;margin-top:12px' }, 'Paste your Caller key at the top first.');
    card.appendChild(banner);

    var groups = { path: [], query: [], header: [] };
    op.params.forEach(function (p) { if (groups[p.in]) groups[p.in].push(p); });
    [['path', 'Path parameters'], ['query', 'Query parameters'], ['header', 'Headers']].forEach(function (g) {
      if (!groups[g[0]].length) return;
      var box = h('div', { style: 'margin-top:14px' }, h('h2', null, g[1]));
      groups[g[0]].forEach(function (p) {
        var inp = h('input', { type: 'text', value: p.example, placeholder: p.required ? 'required' : 'optional', spellcheck: 'false', 'aria-label': p.name });
        inp.addEventListener('input', refresh);
        inputs[g[0] + ':' + p.name] = inp;
        box.appendChild(h('div', { class: 'row' }, [h('label', null, [p.name, p.required ? h('span', { class: 'req' }, ' *') : '']), h('div', null, [inp, p.description ? h('small', null, p.description) : ''])]));
      });
      card.appendChild(box);
    });

    var ta = null;
    if (op.body !== null) {
      ta = h('textarea', { spellcheck: 'false', 'aria-label': 'JSON body' });
      ta.value = JSON.stringify(op.body, null, 2);
      card.appendChild(h('div', { style: 'margin-top:14px' }, [h('h2', null, 'JSON body'), ta]));
    }

    var send = h('button', { class: 'primary' }, 'Send  (Ctrl+Enter)');
    var curl = h('button', null, 'Copy as curl');
    card.appendChild(h('div', { class: 'actions' }, [send, curl, h('span', { class: 'hint' }, needsKey ? 'Sent with your Caller key.' : 'Open: no key needed.')]));
    main.appendChild(card);
    var out = h('div', { class: 'card', style: 'display:none' });
    main.appendChild(out);

    function build() {
      var path = op.path;
      groups.path.forEach(function (p) { path = path.replace('{' + p.name + '}', encodeURIComponent(inputs['path:' + p.name].value.trim())); });
      var qs = [];
      groups.query.forEach(function (p) { var v = inputs['query:' + p.name].value.trim(); if (v) qs.push(encodeURIComponent(p.name) + '=' + encodeURIComponent(v)); });
      var headers = {};
      groups.header.forEach(function (p) { var v = inputs['header:' + p.name].value.trim(); if (v) headers[p.name] = v; });
      var key = keyEl.value.trim();
      if (needsKey && key) headers.Authorization = 'Bearer ' + key;
      var body;
      if (ta) { headers['Content-Type'] = 'application/json'; body = ta.value; }
      return { url: path + (qs.length ? '?' + qs.join('&') : ''), headers: headers, body: body };
    }
    function refresh() { urlbar.textContent = op.method + '  ' + BASE + build().url; }
    refresh();
    keyEl.oninput = function () { store('gw_key', keyEl.value.trim() || null); };

    curl.addEventListener('click', function () {
      var r = build();
      var s = 'curl -X ' + op.method + " '" + BASE + r.url + "'";
      Object.keys(r.headers).forEach(function (k) { s += " \\\n  -H '" + k + ': ' + (k === 'Authorization' ? 'Bearer $KEY' : r.headers[k]) + "'"; });
      if (r.body) s += " \\\n  -d '" + r.body.replace(/'/g, "'\\''") + "'";
      navigator.clipboard.writeText(s).then(function () { toast('curl copied (key replaced by $KEY)'); }, function () { toast('Copy failed'); });
    });

    function run() {
      var r = build();
      if (needsKey && !keyEl.value.trim()) { banner.style.display = 'block'; keyEl.focus(); return; }
      banner.style.display = 'none';
      if (ta) { try { JSON.parse(ta.value); } catch (e) { return showError(out, 'The JSON body is not valid: ' + e.message); } }
      send.disabled = true; send.textContent = 'Sending…';
      var t0 = performance.now();
      fetch(BASE + r.url, { method: op.method, headers: r.headers, body: r.body }).then(function (res) {
        return res.text().then(function (text) { showResponse(out, res, text, performance.now() - t0); });
      }).catch(function (e) { showError(out, 'Network error: ' + e.message); }).then(function () { send.disabled = false; send.textContent = 'Send  (Ctrl+Enter)'; });
    }
    send.addEventListener('click', run);
    main.onkeydown = function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run(); };
  }
  function showError(out, msg) {
    out.style.display = 'block'; out.textContent = '';
    out.appendChild(h('h2', null, 'Response'));
    out.appendChild(h('div', { class: 'banner', style: 'background:var(--errbg);color:var(--err)' }, msg));
  }
  function showResponse(out, res, text, ms) {
    out.style.display = 'block'; out.textContent = '';
    var cls = 's' + String(res.status).charAt(0);
    var pretty = text, isJson = false;
    try { pretty = JSON.stringify(JSON.parse(text), null, 2); isJson = true; } catch (e) {}
    var rid = res.headers.get('x-request-id');
    out.appendChild(h('h2', null, 'Response'));
    out.appendChild(h('div', { class: 'meta' }, [
      h('span', { class: 'chip ' + cls }, res.status + ' ' + (res.statusText || '')),
      h('span', null, Math.round(ms) + ' ms'), h('span', null, text.length + ' bytes'),
      rid ? h('span', null, 'request id ' + rid) : '',
      h('button', { onclick: function () { navigator.clipboard.writeText(pretty).then(function () { toast('Copied'); }); } }, 'Copy body')
    ]));
    var shown = pretty.length > 200000 ? pretty.slice(0, 200000) + '\n… truncated' : pretty;
    out.appendChild(h('pre', null, isJson ? colour(shown) : (shown || '(empty body)')));
    var rows = []; res.headers.forEach(function (v, k) { rows.push(h('tr', null, [h('td', null, k), h('td', null, v)])); });
    out.appendChild(h('details', null, [h('summary', null, 'Response headers (' + rows.length + ')'), h('table', null, rows)]));
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- Live tester ---------- */
  var ws = null;
  function renderLive(main) {
    var card = h('div', { class: 'card' });
    card.appendChild(h('h1', null, [h('span', { class: 'm WS', style: 'margin-right:8px' }, 'WS'), 'Live tester']));
    card.appendChild(h('p', { class: 'sub' }, 'A Live ticket lets a browser open a live connection without holding your key. Get a ticket for one user, connect, then send that user a notification and watch it arrive.'));
    var user = h('input', { type: 'text', value: 'user-123', 'aria-label': 'userId' });
    var tid = h('input', { type: 'text', placeholder: 'optional: Ticket id for a conversation', 'aria-label': 'ticketId' });
    var role = h('select', { 'aria-label': 'role' }, [h('option', { value: '' }, 'role (conversation only)'), h('option', { value: 'Customer' }, 'Customer'), h('option', { value: 'Staff' }, 'Staff')]);
    var app = h('input', { type: 'text', value: 'crms', 'aria-label': 'targetApp' });
    card.appendChild(h('div', { class: 'grid2' }, [h('div', null, [h('h2', null, '1. Who is it for'), user]), h('div', null, [h('h2', null, 'Conversation (optional)'), tid, h('div', { style: 'height:6px' }), role])]));
    var log = h('div', { class: 'log pre' });
    var logBox = h('pre', { class: 'log' }, log);
    function say(text, cls) { var d = h('div', { class: cls || '' }, [h('time', null, new Date().toLocaleTimeString()), text]); log.appendChild(d); logBox.scrollTop = logBox.scrollHeight; }
    function needKey() { if (!keyEl.value.trim()) { say('Paste your Caller key at the top first.', 'n'); keyEl.focus(); return true; } return false; }

    var ticket = '';
    var bGet = h('button', { class: 'primary' }, '2. Get ticket');
    var bCon = h('button', null, '3. Connect');
    var bOff = h('button', null, 'Disconnect');
    var bSend = h('button', null, '4. Send test notification');
    card.appendChild(h('div', { class: 'actions' }, [bGet, bCon, bOff, h('span', { class: 'hint' }, 'targetApp'), h('div', { style: 'width:110px' }, app), bSend]));
    bGet.addEventListener('click', function () {
      if (needKey()) return;
      var body = { userId: user.value.trim() };
      if (tid.value.trim() || role.value) { body.ticketId = tid.value.trim(); body.role = role.value; }
      fetch(BASE + '/live-tickets', { method: 'POST', headers: { Authorization: 'Bearer ' + keyEl.value.trim(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return [r.status, j]; }); })
        .then(function (x) { if (x[0] === 200 && x[1].ticket) { ticket = x[1].ticket; say('Ticket issued (valid about a minute). Connect now.', 's'); } else say('Ticket request failed: ' + x[0] + ' ' + JSON.stringify(x[1]), 'n'); })
        .catch(function (e) { say('Network error: ' + e.message, 'n'); });
    });
    bCon.addEventListener('click', function () {
      if (!ticket) return say('Get a ticket first.', 'n');
      if (ws) ws.close();
      var path = tid.value.trim() ? '/notifications/conversations/' + encodeURIComponent(tid.value.trim()) + '/live' : '/notifications/live';
      ws = new WebSocket(BASE.replace(/^http/, 'ws') + path + '?ticket=' + encodeURIComponent(ticket));
      ws.onopen = function () { say('Connected.', 's'); };
      ws.onmessage = function (e) { var t = String(e.data); try { t = JSON.stringify(JSON.parse(t)); } catch (x) {} say(t); };
      ws.onclose = function (e) { say('Closed (' + e.code + ')' + (e.code === 1006 ? ' - ticket expired or invalid? get a fresh one' : ''), 'n'); };
      ws.onerror = function () { say('Connection error.', 'n'); };
      ticket = '';
    });
    bOff.addEventListener('click', function () { if (ws) { ws.close(); ws = null; } });
    bSend.addEventListener('click', function () {
      if (needKey()) return;
      fetch(BASE + '/notifications/notifications', { method: 'POST', headers: { Authorization: 'Bearer ' + keyEl.value.trim(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'explorer.test', title: 'Hello from the Explorer', body: 'Sent ' + new Date().toLocaleTimeString(), sendingApp: app.value.trim(), targetApp: app.value.trim(), userIds: [user.value.trim()] }) })
        .then(function (r) { say('Send notification: HTTP ' + r.status, r.status < 300 ? 's' : 'n'); }).catch(function (e) { say('Network error: ' + e.message, 'n'); });
    });
    main.appendChild(card);
    main.appendChild(h('div', { class: 'card' }, [h('h2', null, 'Live messages'), logBox]));
  }

  /* ---------- Boot ---------- */
  fetch(BASE + '/health').then(function (r) { $('health').className = 'dot ' + (r.ok ? 'ok' : 'err'); }).catch(function () { $('health').className = 'dot err'; });
  function getSpec(path) { return fetch(BASE + path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  Promise.all([
    getSpec('/notifications/openapi.json').then(function (s) { return opsFromSpec('Notifications', '/notifications', s); }).catch(function () { return []; }),
    getSpec('/files/openapi.json').then(function (s) { return opsFromSpec('Files', '/files', s, true); }).catch(function () { return []; })
  ]).then(function (lists) {
    OPS = STATIC.concat(lists[0], lists[1]);
    renderNav();
    var first = OPS.filter(function (o) { return o.service === 'Notifications' && o.method === 'POST'; })[0] || OPS[0];
    select(first);
  });
})();
</script>
</body>
</html>`
