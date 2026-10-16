/** The docs app: hash-routed pages, API reference built from the services' OpenAPI documents, and a live "Try it" panel. */
export const SCRIPT = String.raw`
(function () {
  'use strict';
  var BASE = location.origin;
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (attrs[k] === false || attrs[k] == null) continue;
      if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    [].concat(kids == null ? [] : kids).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return e;
  }
  var store = function (k, v) { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch (e) {} };
  var load = function (k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } };
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 1700); }
  function copy(text) { return navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, function () { toast('Copy failed'); }); }
  var slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  var KEY = load('gw_key');
  function setKey(v) { KEY = (v || '').trim(); store('gw_key', KEY); var b = $('keybtn'); b.classList.toggle('set', !!KEY); b.querySelector('span').textContent = KEY ? 'Key set' : 'Add your key'; }

  /* ---------- inline markup: [[code]] and <<label|#/route>> ---------- */
  function inline(str) {
    var out = [], re = /\[\[(.+?)\]\]|<<(.+?)\|(.+?)>>/g, last = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      out.push(m[1] ? h('code', null, m[1]) : h('a', { href: m[3] }, m[2]));
      last = re.lastIndex;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }
  var P = function (s) { return h('p', null, inline(s)); };
  var UL = function (items) { return h('ul', null, items.map(function (i) { return h('li', null, inline(i)); })); };
  var OL = function (items) { return h('ol', null, items.map(function (i) { return h('li', null, inline(i)); })); };
  function H(level, text) {
    var id = slug(text);
    return h('h' + level, { id: id }, [text, h('a', { class: 'hash', href: '#' + currentRoute() + '?s=' + id, onclick: function (e) { e.preventDefault(); var t = $(id); if (t) t.scrollIntoView(); } }, '#')]);
  }
  function callout(kind, title, text) { return h('div', { class: 'callout ' + (kind || '') }, [h('b', null, title), h('p', null, inline(text))]); }
  function table(heads, rows) {
    return h('table', null, [h('thead', null, h('tr', null, heads.map(function (x) { return h('th', null, x); }))),
      h('tbody', null, rows.map(function (r) { return h('tr', null, r.map(function (c) { return h('td', null, typeof c === 'string' ? inline(c) : c); })); }))]);
  }

  /* ---------- code: highlighting, samples, run ---------- */
  function highlight(text, lang) {
    var frag = document.createDocumentFragment(), re;
    if (lang === 'json') re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    else re = /(#.*$|\/\/.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(curl|fetch|await|const|import|print|requests|JSON|console)\b/gm;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var cls, val = m[0];
      if (lang === 'json') { cls = m[1] ? (m[2] ? 'tk' : 'ts') : (m[3] ? 'tb' : 'tn'); if (m[2]) { frag.appendChild(h('span', { class: cls }, m[1])); frag.appendChild(document.createTextNode(m[2])); last = re.lastIndex; continue; } }
      else cls = m[1] ? 'tc' : (m[2] ? 'ts' : 'tk');
      frag.appendChild(h('span', { class: cls }, val));
      last = re.lastIndex;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }
  function pretty(text) { try { return [JSON.stringify(JSON.parse(text), null, 2), true]; } catch (e) { return [text, false]; } }
  function qstring(q) {
    var parts = [];
    Object.keys(q || {}).forEach(function (k) { if (q[k] !== '' && q[k] != null) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(q[k])); });
    return parts.length ? '?' + parts.join('&') : '';
  }
  function samples(r) {
    var url = BASE + r.path + qstring(r.query);
    var hdr = {}; if (r.auth !== false) hdr.Authorization = 'Bearer $KEY';
    Object.keys(r.headers || {}).forEach(function (k) { if (r.headers[k]) hdr[k] = r.headers[k]; });
    var hasBody = r.body !== undefined && r.body !== null && r.method !== 'GET';
    if (hasBody) hdr['Content-Type'] = 'application/json';
    var body = hasBody ? (typeof r.body === 'string' ? r.body : JSON.stringify(r.body, null, 2)) : '';
    var c = ['curl' + (r.method === 'GET' ? '' : ' -X ' + r.method) + " '" + url + "'"];
    Object.keys(hdr).forEach(function (k) { c.push("  -H '" + k + ': ' + hdr[k] + "'"); });
    if (hasBody) c.push("  -d '" + body.replace(/'/g, "'\\''") + "'");
    var jsH = Object.keys(hdr).map(function (k) { return '    ' + JSON.stringify(k) + ': ' + (k === 'Authorization' ? '"Bearer " + KEY' : JSON.stringify(hdr[k])); }).join(',\n');
    var js = ['const res = await fetch(' + JSON.stringify(url) + ', {', '  method: ' + JSON.stringify(r.method) + ','];
    if (jsH) js.push('  headers: {\n' + jsH + '\n  },');
    if (hasBody) js.push('  body: JSON.stringify(' + body.replace(/\n/g, '\n  ') + '),');
    js.push('});', 'console.log(res.status, await res.json());');
    var pyH = Object.keys(hdr).filter(function (k) { return k !== 'Content-Type'; }).map(function (k) { return '    ' + JSON.stringify(k) + ': ' + (k === 'Authorization' ? '"Bearer " + KEY' : JSON.stringify(hdr[k])); }).join(',\n');
    var py = ['import requests', '', 'r = requests.request(' + JSON.stringify(r.method) + ', ' + JSON.stringify(url) + ','];
    if (pyH) py.push('  headers={\n' + pyH + '\n  },');
    if (hasBody) py.push('  json=' + body.replace(/\n/g, '\n  ').replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None') + ',');
    py.push(')', 'print(r.status_code, r.json())');
    return { curl: c.join(' \\\n'), javascript: js.join('\n'), python: py.join('\n') };
  }
  function send(r) {
    var headers = {};
    if (r.auth !== false && KEY) headers.Authorization = 'Bearer ' + KEY;
    Object.keys(r.headers || {}).forEach(function (k) { if (r.headers[k]) headers[k] = r.headers[k]; });
    var body;
    if (r.body !== undefined && r.body !== null && r.method !== 'GET') { headers['Content-Type'] = 'application/json'; body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body); }
    var t0 = performance.now();
    return fetch(BASE + r.path + qstring(r.query), { method: r.method, headers: headers, body: body }).then(function (res) {
      return res.text().then(function (text) { return { res: res, text: text, ms: performance.now() - t0 }; });
    });
  }
  function renderOut(box, x) {
    box.textContent = ''; box.style.display = 'block';
    var p = pretty(x.text), shown = p[0].length > 150000 ? p[0].slice(0, 150000) + '\n... truncated' : p[0];
    var rid = x.res.headers.get('x-request-id');
    box.appendChild(h('div', { class: 'meta' }, [h('span', { class: 'chip s' + String(x.res.status).charAt(0) }, x.res.status + ' ' + (x.res.statusText || '')), Math.round(x.ms) + ' ms', rid ? 'request ' + rid.slice(0, 8) : '',
      h('span', { class: 'sp', style: 'flex:1' }), h('button', { class: 'mini', onclick: function () { copy(p[0]); } }, 'Copy')]));
    box.appendChild(h('pre', { class: 'wrap' }, p[1] ? highlight(shown, 'json') : (shown || '(empty body)')));
  }
  function errOut(box, msg) { box.textContent = ''; box.style.display = 'block'; box.appendChild(h('div', { class: 'meta' }, h('span', { class: 'chip s0' }, msg))); }
  /** A code block with curl / JavaScript / Python tabs; r.run adds a Run button that really sends it. */
  function snippet(getReq, opts) {
    opts = opts || {};
    var lang = load('gw_lang') || 'curl', pre = h('pre'), out = h('div', { class: 'out', style: 'display:none' });
    var tabs = h('div', { class: 'bar' }), run;
    function draw() {
      var s = samples(typeof getReq === 'function' ? getReq() : getReq);
      pre.textContent = ''; pre.appendChild(highlight(s[lang], lang));
      [].forEach.call(tabs.querySelectorAll('.lang'), function (b) { b.classList.toggle('on', b.dataset.l === lang); });
      pre.dataset.raw = s[lang];
    }
    ['curl', 'javascript', 'python'].forEach(function (l) { tabs.appendChild(h('button', { class: 'lang', 'data-l': l, onclick: function () { lang = l; store('gw_lang', l); draw(); } }, l === 'javascript' ? 'JavaScript' : l === 'curl' ? 'cURL' : 'Python')); });
    tabs.appendChild(h('span', { class: 'sp' }));
    tabs.appendChild(h('button', { class: 'mini', onclick: function () { copy(pre.dataset.raw); } }, 'Copy'));
    if (opts.run !== false) {
      run = h('button', { class: 'mini run', onclick: function () {
        var r = typeof getReq === 'function' ? getReq() : getReq;
        if (r.auth !== false && !KEY) { openKey(); return; }
        run.disabled = true; run.textContent = 'Running';
        send(r).then(function (x) { renderOut(out, x); }, function (e) { errOut(out, 'Network error: ' + e.message); }).then(function () { run.disabled = false; run.textContent = 'Run'; });
      } }, 'Run');
      tabs.appendChild(run);
    }
    var box = h('div', { class: 'code' }, [tabs, pre, out]);
    box.redraw = draw; draw();
    return box;
  }

  /* ---------- OpenAPI -> operations ---------- */
  function resolve(spec, node, d) {
    d = d || 0; if (!node || typeof node !== 'object' || d > 8) return node;
    if (node.$ref) { var t = spec; node.$ref.replace(/^#\//, '').split('/').forEach(function (p) { t = t && t[p]; }); return resolve(spec, t, d + 1); }
    return node;
  }
  var HINTS = { userId: 'user-123', app: 'crms', sendingApp: 'crms', targetApp: 'crms', type: 'order.shipped', title: 'Your order has shipped', body: 'Order 1234 is on its way.', filename: 'example.txt', contentType: 'text/plain', visibility: 'private', retentionType: 'temporary', system: 'CRMS', entityType: 'order', entityId: '1001', role: 'cover image', size: 5, to: 'you@example.com' };
  function example(spec, schema, d, name) {
    d = d || 0; schema = resolve(spec, schema); if (!schema || d > 6) return null;
    if (name && HINTS[name] !== undefined && schema.type !== 'object' && schema.type !== 'array' && (!schema.enum || schema.enum.indexOf(HINTS[name]) >= 0)) return HINTS[name];
    if (schema.example !== undefined) return schema.example; if (schema.default !== undefined) return schema.default; if (schema.enum) return schema.enum[0];
    if (schema.oneOf || schema.anyOf) return example(spec, (schema.oneOf || schema.anyOf)[0], d + 1);
    var t = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (t === 'object' || schema.properties) { var o = {}; Object.keys(schema.properties || {}).forEach(function (k) { o[k] = example(spec, schema.properties[k], d + 1, k); }); return o; }
    if (t === 'array') return [example(spec, schema.items, d + 1)];
    if (t === 'integer' || t === 'number') return schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + 1 : (schema.minimum !== undefined ? schema.minimum : 1);
    if (t === 'boolean') return false; if (schema.format === 'uri') return 'https://example.com'; if (schema.format === 'date-time') return new Date().toISOString();
    return 'string';
  }
  function typeOf(spec, s) {
    s = resolve(spec, s) || {}; if (s.enum) return s.enum.join(' | ');
    if (s.type === 'array') return 'array of ' + typeOf(spec, s.items); return (Array.isArray(s.type) ? s.type.join(' | ') : s.type) || 'any';
  }
  var SKIP = /^(live|conversationLive|openapi|docs|mcp|health|cleanup)$/;
  function opsFromSpec(service, prefix, spec, keep) {
    var out = [];
    Object.keys(spec.paths || {}).forEach(function (p) {
      var item = spec.paths[p];
      ['get', 'post', 'put', 'patch', 'delete'].forEach(function (m) {
        var op = item[m]; if (!op || !op.operationId || SKIP.test(op.operationId)) return;
        var params = (item.parameters || []).concat(op.parameters || []).map(function (x) { return resolve(spec, x); }).filter(Boolean).map(function (x) {
          var ex = x.example !== undefined ? x.example : example(spec, x.schema, 0, x.name);
          return { name: x.name, in: x.in, required: !!x.required || x.in === 'path', description: x.description || '', type: typeOf(spec, x.schema), example: (x.required || x.in === 'path') && ex != null ? String(ex) : '' };
        });
        var rb = resolve(spec, op.requestBody), schema = rb && rb.content && rb.content['application/json'] && resolve(spec, rb.content['application/json'].schema), fields = [], body = null;
        if (schema) {
          body = example(spec, schema);
          Object.keys(schema.properties || {}).forEach(function (k) { var f = resolve(spec, schema.properties[k]) || {}; fields.push({ name: k, type: typeOf(spec, f), required: (schema.required || []).indexOf(k) >= 0, description: f.description || '' }); });
        }
        out.push({ id: '/api/' + service.toLowerCase() + '/' + op.operationId, service: service, method: m.toUpperCase(), path: (keep && p.indexOf(prefix) === 0 ? '' : prefix) + p, summary: op.summary || op.operationId, description: op.description || '', params: params, fields: fields, body: body, auth: true });
      });
    });
    return out;
  }
  function ev(source, action, extra) {
    var e = { source: source, action: action, outcome: 'success', actor: { type: 'system', id: 'docs', display_name: 'Gateway docs' }, target: { type: 'test', id: 'docs', display_name: 'Docs example' }, description: 'Event written from the gateway docs.', occurred_at: new Date().toISOString() };
    for (var k in (extra || {})) e[k] = extra[k]; return e;
  }
  function qp(names, required, descs) { return names.map(function (n) { return { name: n, in: 'query', required: required.indexOf(n) >= 0, description: (descs || {})[n] || '', type: 'string', example: (descs || {})['=' + n] || '' }; }); }
  var FILTERS = ['source', 'module', 'action', 'outcome', 'actor_type', 'actor_id', 'subject_type', 'subject_id', 'q', 'from', 'to'];
  var EVF = [['source', 'string', true, 'CRMS, HRMS, POS, IMS, Authentication, File storage, Notifications or Ecommerce. Must match your audit key.'], ['action', 'string', true, 'An action that belongs to the Source.'], ['outcome', 'success | failure', true, ''], ['actor', 'object', true, '{ type, id, display_name }'], ['target', 'object', true, '{ type, id, display_name }'], ['subject', 'object', false, 'Whose history the event appears in.'], ['description', 'string', true, 'Sentence for Administrators.'], ['customer_description', 'string', false, 'Sentence for the Subject Customer.'], ['occurred_at', 'string', true, 'ISO 8601 with a timezone.'], ['module', 'string', false, 'CRMS, HRMS, POS and IMS only.'], ['metadata', 'object', false, 'Up to 4096 bytes; no password, token or secret keys.'], ['idempotency_key', 'string', false, 'Retries return the original id.']].map(function (f) { return { name: f[0], type: f[1], required: f[2], description: f[3] }; });
  var STATIC = [
    { id: '/api/gateway/health', service: 'Gateway', method: 'GET', path: '/health', summary: 'Gateway health', description: 'Open: needs no key. Use it for uptime checks.', params: [], fields: [], body: null, auth: false },
    { id: '/api/gateway/issueLiveTicket', service: 'Gateway', method: 'POST', path: '/live-tickets', summary: 'Issue a Live ticket', description: 'Your backend asks for a short-lived ticket for one user. The browser then opens the live WebSocket with it, holding no key. Add ticketId and role for a Ticket conversation.', params: [], fields: [{ name: 'userId', type: 'string', required: true, description: 'The user the ticket is for.' }, { name: 'ticketId', type: 'string', required: false, description: 'Conversation only.' }, { name: 'role', type: 'Customer | Staff', required: false, description: 'Conversation only.' }], body: { userId: 'user-123' }, auth: true },
    { id: '/api/audit/writeEvent', service: 'Audit', method: 'POST', path: '/audit/events', summary: 'Write an Audit Event', description: 'Needs your Caller to hold a write key for the same Source. Audit Events can never be changed or deleted.', params: [], fields: EVF, body: ev('CRMS', 'record.viewed', { module: 'Dashboard' }), auth: true },
    { id: '/api/audit/writeBatch', service: 'Audit', method: 'POST', path: '/audit/events/batch', summary: 'Write a batch of Audit Events', description: 'One to 100 events in a single transaction. Every event must match the key\'s Source.', params: [], fields: [{ name: 'events', type: 'array of event', required: true, description: '1 to 100 events, each as in Write an Audit Event.' }], body: { events: [ev('CRMS', 'record.viewed', { module: 'Dashboard' })] }, auth: true },
    { id: '/api/audit/listEvents', service: 'Audit', method: 'GET', path: '/audit/events', summary: 'List and search Audit Events', description: 'Newest first. Needs the Administrator (read:admin) key.', params: qp(FILTERS.concat(['limit', 'cursor']), [], { limit: '1 to 100, default 50.', cursor: 'The previous next_cursor.', from: 'ISO 8601 bound.', to: 'ISO 8601 bound.', q: 'Substring of the description or names.' }), fields: [], body: null, auth: true },
    { id: '/api/audit/getEvent', service: 'Audit', method: 'GET', path: '/audit/events/{id}', summary: 'Get one Audit Event', description: 'Needs the Administrator key.', params: [{ name: 'id', in: 'path', required: true, description: 'The event id.', type: 'string', example: '' }], fields: [], body: null, auth: true },
    { id: '/api/audit/eventStats', service: 'Audit', method: 'GET', path: '/audit/events/stats', summary: 'Stats for charts', description: 'Counts grouped by day, source, action or outcome. Needs the Administrator key.', params: qp(['group_by'].concat(FILTERS, ['limit']), ['group_by'], { group_by: 'day, source, action or outcome.', '=group_by': 'day' }), fields: [], body: null, auth: true },
    { id: '/api/audit/validValues', service: 'Audit', method: 'GET', path: '/audit/events/valid-values', summary: 'Valid Sources, Modules and Actions', description: 'Needs the Administrator key.', params: [], fields: [], body: null, auth: true },
    { id: '/api/audit/exportEvents', service: 'Audit', method: 'GET', path: '/audit/events/export', summary: 'Export Audit Events', description: 'Streams matching events as csv or json. Records its own Audit Event. Needs the Administrator key.', params: qp(['format', 'from', 'to', 'requested_by_id', 'requested_by_name'], ['format', 'from', 'to', 'requested_by_id', 'requested_by_name'], { '=format': 'json', '=from': new Date(Date.now() - 864e5).toISOString(), '=to': new Date().toISOString(), '=requested_by_id': 'admin-1', '=requested_by_name': 'Admin One' }), fields: [], body: null, auth: true },
    { id: '/api/audit/customerActivity', service: 'Audit', method: 'GET', path: '/audit/events/customer-activity', summary: 'A Customer\'s own activity', description: 'Administrator-only fields are removed. Needs the Customer read (read:customer) key.', params: qp(['subject_type', 'subject_id', 'limit', 'cursor'], ['subject_type', 'subject_id'], { '=subject_type': 'customer', '=subject_id': 'cust-42' }), fields: [], body: null, auth: true }
  ];
  var OPS = STATIC.slice(), OPBYID = {};

  /* ---------- try-it panel for one operation ---------- */
  function tryPanel(op) {
    var inputs = {}, ta = null, out = h('div', { class: 'out', style: 'display:none' }), codeBox;
    var body = h('div', { class: 'pad' });
    var urlbar = h('div', { class: 'urlbar' });
    body.appendChild(urlbar);
    ['path', 'query', 'header'].forEach(function (where) {
      var list = op.params.filter(function (p) { return p.in === where; });
      list.forEach(function (p) {
        var inp = h('input', { type: 'text', value: p.example, placeholder: p.required ? 'required' : 'optional', spellcheck: 'false', 'aria-label': p.name });
        inp.addEventListener('input', refresh); inputs[where + ':' + p.name] = inp;
        body.appendChild(h('div', { class: 'field' }, [h('label', null, [p.name, p.required ? h('span', { class: 'req' }, ' *') : '']), h('div', null, [inp])]));
      });
    });
    if (op.body !== null) { ta = h('textarea', { spellcheck: 'false', 'aria-label': 'JSON body' }); ta.value = JSON.stringify(op.body, null, 2); ta.addEventListener('input', refresh); body.appendChild(h('div', { class: 'field', style: 'grid-template-columns:1fr' }, [h('label', null, 'JSON body'), ta])); }
    function req() {
      var path = op.path, q = {}, hd = {};
      op.params.forEach(function (p) { var v = inputs[p.in + ':' + p.name].value.trim(); if (p.in === 'path') path = path.replace('{' + p.name + '}', encodeURIComponent(v || '{' + p.name + '}')); else if (p.in === 'query') q[p.name] = v; else hd[p.name] = v; });
      return { method: op.method, path: path, query: q, headers: hd, body: ta ? ta.value : null, auth: op.auth };
    }
    function refresh() { var r = req(); urlbar.textContent = r.method + ' ' + BASE + r.path + qstring(r.query); if (codeBox) codeBox.redraw(); }
    var btn = h('button', { class: 'btn primary', onclick: go }, 'Send request');
    body.appendChild(h('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap' }, [btn, h('span', { class: 'hint' }, op.auth ? (KEY ? 'Uses your key.' : 'Add your key first.') : 'No key needed.')]));
    function go() {
      if (op.auth && !KEY) { openKey(); return; }
      if (ta) { try { JSON.parse(ta.value); } catch (e) { return errOut(out, 'Invalid JSON: ' + e.message); } }
      btn.disabled = true; btn.textContent = 'Sending';
      send(req()).then(function (x) { renderOut(out, x); }, function (e) { errOut(out, 'Network error: ' + e.message); }).then(function () { btn.disabled = false; btn.textContent = 'Send request'; });
    }
    codeBox = snippet(req, { run: false });
    refresh();
    return h('aside', { class: 'try' }, [h('div', { class: 'panel' }, [h('header', null, ['Try it', h('span', { class: 'm ' + op.method, style: 'margin-left:auto' }, op.method)]), body, out]), codeBox]);
  }

  /* ---------- pages ---------- */
  var PAGES = {};
  var GUIDE_ORDER = [];
  function page(id, title, section, build) { PAGES[id] = { id: id, title: title, section: section, build: build }; GUIDE_ORDER.push(id); }
  var run = function (path, method, extra) { var r = { method: method || 'GET', path: path }; for (var k in (extra || {})) r[k] = extra[k]; return r; };

  page('/', 'Introduction', 'Getting started', function () {
    var cards = [['Start here', 'Quickstart', 'Send your first request in a minute.', '#/quickstart'], ['Security', 'Authentication', 'One Caller key for every service.', '#/authentication'], ['Agents', 'Use it from AI agents', 'One MCP server, every tool.', '#/guides/mcp'], ['Reference', 'API reference', 'Every endpoint, with a live Try it.', '#/api/notifications/sendNotification']];
    return [
      H(1, 'One URL for notifications, files and audit'),
      h('p', { class: 'lede' }, 'The gateway is the single door your applications and agents use to reach the notifications, file-storage and audit-logs services. One address, one key, one set of conventions.'),
      h('div', { class: 'cards' }, cards.map(function (c) { return h('a', { class: 'card', href: c[3] }, [h('span', { class: 'eb' }, c[0]), h('b', null, c[1]), h('span', null, c[2])]); })),
      H(2, 'How it fits together'),
      h('div', { class: 'flow' }, [h('div', null, [h('b', null, 'Your app or agent'), h('small', null, 'Sends one Caller key')]), h('span', { class: 'arrow' }, '→'), h('div', { class: 'gw' }, [h('b', null, 'Gateway'), h('small', null, 'Identifies you, rate limits, forwards')]), h('span', { class: 'arrow' }, '→'), h('div', null, [h('b', null, 'Three services'), h('small', null, 'Notifications, files, audit')])]),
      table(['Prefix', 'Service', 'What it does'], [['[[/notifications/*]]', 'Notifications', 'In-app notifications, emails and live WebSocket connections.'], ['[[/files/*]]', 'File storage', 'Upload, view, link and delete files.'], ['[[/audit/*]]', 'Audit logs', 'Write and read tamper-proof Audit Events.'], ['[[/mcp]]', 'Gateway MCP server', 'All of the above as tools for AI agents.']]),
      P('The prefix is removed before the request is forwarded, so each service\'s own documented paths keep working. The response comes back unchanged.'),
      H(2, 'What the gateway does for you'),
      UL(['Identifies your application from its key, and uses the credentials and identity each service expects. Anything you send in [[Authorization]] or [[X-System-Code]] for a service is replaced.', 'Applies one rate limit per Caller across every route.', 'Tags every request with an [[X-Request-Id]] so you can trace it into a service\'s log.', 'Returns a clear 502 or 504 with the request id when a service cannot be reached.', 'Hands out short-lived Live tickets so browsers can open WebSockets without holding a key.']),
      H(2, 'Base URL'),
      snippet({ method: 'GET', path: '/health', auth: false }),
      callout('', 'Note', 'The gateway adds no CORS handling. It is a backend-to-backend door; browsers reach live connections with a Live ticket.')
    ];
  });
  page('/quickstart', 'Quickstart', 'Getting started', function () {
    return [
      H(1, 'Quickstart'), h('p', { class: 'lede' }, 'Check the gateway, send a notification and read it back. Every block below really runs against this gateway.'),
      H(2, '1. Add your Caller key'),
      P('Each application has its own Caller key, issued by whoever runs the gateway. Click below to add it. It stays in this browser tab and is sent only to this gateway.'),
      h('p', null, h('button', { class: 'btn primary', onclick: openKey }, 'Add your key')),
      H(2, '2. Check the gateway is up'), P('[[/health]] needs no key.'),
      snippet({ method: 'GET', path: '/health', auth: false }),
      H(2, '3. Send a notification'), P('This sends an in-app notification to [[user-123]]. [[type]], [[title]], [[body]], [[sendingApp]], [[targetApp]] and [[userIds]] are required.'),
      snippet({ method: 'POST', path: '/notifications/notifications', body: { type: 'order.shipped', title: 'Your order has shipped', body: 'Order 1234 is on its way.', sendingApp: 'crms', targetApp: 'crms', userIds: ['user-123'] } }),
      H(2, '4. Read it back'),
      snippet({ method: 'GET', path: '/notifications/notifications', query: { userId: 'user-123', app: 'crms' } }),
      callout('', 'What happened', 'The gateway checked your key, added the notifications service\'s own credential, removed the [[/notifications]] prefix and forwarded the call. The response is the service\'s, unchanged.'),
      H(2, 'Next steps'),
      UL(['<<Authentication|#/authentication>> explains keys and what gets replaced.', '<<Upload your first file|#/guides/files>> in three steps.', '<<Push to the browser|#/guides/live>> with a Live ticket.', '<<Let an agent do it|#/guides/mcp>> with the MCP server.'])
    ];
  });
  page('/authentication', 'Authentication', 'Getting started', function () {
    return [
      H(1, 'Authentication'), h('p', { class: 'lede' }, 'One Caller key per application. The gateway never authenticates people; that stays in the authentication portal.'),
      H(2, 'Send your key'), P('Send the key as a bearer credential on every request except the open routes.'),
      snippet({ method: 'GET', path: '/notifications/notifications', query: { userId: 'user-123', app: 'crms' } }),
      H(2, 'Open routes'), UL(['[[/health]]', 'Each service\'s [[/docs]] and [[/openapi.json]], for example [[/files/openapi.json]]', 'This documentation site']),
      P('Everything else, including [[/mcp]], needs a key. A missing, wrong or revoked key gets [[401]].'),
      H(2, 'What the gateway replaces'),
      table(['Service', 'You send', 'The service receives'], [['Notifications', 'Your Caller key', 'The gateway\'s own bearer token'], ['File storage', 'Your Caller key', 'The gateway secret plus [[X-System-Code]] from your Caller entry'], ['Audit logs', 'Your Caller key', 'Your Caller\'s own audit-logs API key']]),
      P('Because the identity comes from your Caller entry, a Caller cannot act as another one. Any [[Authorization]] or [[X-System-Code]] you send for a service is discarded.'),
      callout('warn', 'Audit access', 'A Caller without an audit-logs key gets [[403]] on [[/audit/*]]. A Caller without a file-storage Client System gets [[403]] on [[/files/*]].'),
      H(2, 'Keys and revocation'), UL(['Only a hash of each key is stored in the gateway.', 'Add a Caller by adding an entry to the Caller map; no code change.', 'Remove an entry and the key stops working on its next request.'])
    ];
  });
  page('/errors', 'Errors and limits', 'Getting started', function () {
    return [
      H(1, 'Errors and limits'), h('p', { class: 'lede' }, 'The status and body from a service come back unchanged. The gateway adds only the statuses below.'),
      table(['Status', 'Meaning', 'Body'], [['[[401]]', 'Missing, wrong or revoked key', '[[{ "error": "unauthorized" }]]'], ['[[403]]', 'Your Caller has no audit key or Client System', '[[{ "error": "no audit-logs access" }]]'], ['[[404]]', 'Unknown path', '[[{ "error": "not found" }]]'], ['[[429]]', 'Rate limit exceeded; see [[Retry-After]]', '[[{ "error": "rate limit exceeded" }]]'], ['[[502]]', 'A service could not be reached', '[[{ "error": "service unreachable", "requestId": "..." }]]'], ['[[504]]', 'A service took longer than 25 seconds', '[[{ "error": "service timed out", "requestId": "..." }]]']]),
      H(2, 'Rate limit'), P('Each Caller gets 600 requests a minute across every route. The limiter counts per edge location and is approximate, so it smooths bursts rather than enforcing an exact number. Audit-logs also keeps its own per-key limit.'),
      H(2, 'Request ids'), P('Every response carries [[X-Request-Id]]. Send your own and it is kept; otherwise the gateway creates one. Quote it when you report a problem.'),
      snippet({ method: 'GET', path: '/health', auth: false, headers: { 'X-Request-Id': 'my-trace-1' } })
    ];
  });
  page('/guides/notifications', 'Notifications', 'Guides', function () {
    return [
      H(1, 'Notifications'), h('p', { class: 'lede' }, 'In-app notifications stored first, then pushed to every open connection. Emails are queued and delivered in the background.'),
      H(2, 'Send'), snippet({ method: 'POST', path: '/notifications/notifications', body: { type: 'order.shipped', title: 'Your order has shipped', body: 'Order 1234 is on its way.', sendingApp: 'crms', targetApp: 'crms', userIds: ['user-123'] } }),
      P('Add [[link]] to attach a URL. See <<Send a Notification|#/api/notifications/sendNotification>>.'),
      H(2, 'List and count'), snippet({ method: 'GET', path: '/notifications/notifications', query: { userId: 'user-123', app: 'crms', unread: 'true' } }),
      P('<<Unread count|#/api/notifications/unreadCount>> is a lighter call for a badge.'),
      H(2, 'Mark read'), P('<<Mark one read|#/api/notifications/markRead>> by id, or <<mark all read|#/api/notifications/markAllRead>> for a user.'),
      H(2, 'Emails'), P('Queue an <<App email|#/api/notifications/sendAppEmail>> or a <<Marketing email|#/api/notifications/sendMarketingEmail>>, then look it up with <<Get an Email|#/api/notifications/getEmail>> to see the delivery outcome.'),
      callout('warn', 'Live delivery', 'Open connections receive new notifications instantly. Browsers need a <<Live ticket|#/guides/live>>.')
    ];
  });
  page('/guides/files', 'File storage', 'Guides', function () {
    return [
      H(1, 'File storage'), h('p', { class: 'lede' }, 'Uploads go straight to storage through a presigned address, so file bytes never pass through the gateway.'),
      H(2, '1. Ask for an upload address'), snippet({ method: 'POST', path: '/files', headers: { 'X-Actor-Id': 'user-123' }, body: { filename: 'example.txt', contentType: 'text/plain', size: 5, visibility: 'private', retentionType: 'temporary' } }),
      P('The response has an [[id]] and an [[uploadUrl]].'),
      H(2, '2. Upload the bytes'), P('[[PUT]] the file straight to the [[uploadUrl]]. This call does not go through the gateway and needs no key.'),
      snippet({ method: 'PUT', path: '/uploadUrl-from-step-1', auth: false, body: null }, { run: false }),
      H(2, '3. Confirm'), P('Use the [[id]] from step 1. The File becomes Active.'),
      snippet({ method: 'POST', path: '/files/FILE_ID/confirm', body: {} }, { run: false }),
      H(2, 'Then'), UL(['<<View a File|#/api/files/viewFile>> and get its address, <<edit|#/api/files/editFile>> or <<delete|#/api/files/deleteFile>> it.', '<<Link|#/api/files/addLink>> a File to one of your records and <<list|#/api/files/listFiles>> a record\'s Files.', 'Replace contents with <<a replacement upload|#/api/files/requestReplacement>>.']),
      callout('', 'Identity', 'The gateway sets [[X-System-Code]] from your Caller entry. Send [[X-Actor-Id]] to record who acted. Any File can be viewed by any Client System.'),
      callout('warn', 'Not routed', 'The daily cleanup job ([[/cron/cleanup]]) is deliberately not available through the gateway.')
    ];
  });
  page('/guides/audit', 'Audit logs', 'Guides', function () {
    return [
      H(1, 'Audit logs'), h('p', { class: 'lede' }, 'A write-once record of who did what. Events can never be changed or deleted.'),
      H(2, 'Keys decide what you can do'),
      table(['Role', 'Held by', 'May call'], [['[[write:<Source>]]', 'That Source\'s integration', 'Write events for that Source'], ['[[read:admin]]', 'The portal', 'List, search, stats, valid values and export'], ['[[read:customer]]', 'The Ecommerce backend', 'Customer activity']]),
      P('The gateway uses the audit-logs key stored for your Caller, so you never handle it. A route outside your key\'s role gets [[403]].'),
      H(2, 'Write an event'), snippet({ method: 'POST', path: '/audit/events', body: ev('CRMS', 'record.viewed', { module: 'Dashboard' }) }),
      callout('warn', 'Permanent', 'Running a write adds a real event that cannot be removed. Use a Source that matches your key.'),
      H(2, 'Find the valid values'), snippet({ method: 'GET', path: '/audit/events/valid-values' }),
      H(2, 'Read'), UL(['<<List and search|#/api/audit/listEvents>> with filters and cursors.', '<<Stats for charts|#/api/audit/eventStats>>.', '<<Export|#/api/audit/exportEvents>> as csv or json.', '<<Customer activity|#/api/audit/customerActivity>> for the Customer\'s own view.'])
    ];
  });
  var ws = null;
  page('/guides/live', 'Live connections', 'Guides', function () {
    var user = h('input', { type: 'text', value: 'user-123', 'aria-label': 'userId' }), tid = h('input', { type: 'text', placeholder: 'Ticket id (conversation only)', 'aria-label': 'ticketId' });
    var role = h('select', { 'aria-label': 'role' }, [h('option', { value: '' }, 'role'), h('option', { value: 'Customer' }, 'Customer'), h('option', { value: 'Staff' }, 'Staff')]);
    var app = h('input', { type: 'text', value: 'crms', 'aria-label': 'targetApp' });
    var log = h('div', { class: 'log' }), ticket = '';
    function say(t, c) { log.appendChild(h('div', { class: c || '' }, [h('time', null, new Date().toLocaleTimeString()), t])); log.scrollTop = log.scrollHeight; }
    function needKey() { if (!KEY) { openKey(); return true; } return false; }
    function post(path, b) { return fetch(BASE + path, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); }
    var bGet = h('button', { class: 'btn primary', onclick: function () {
      if (needKey()) return; var b = { userId: user.value.trim() }; if (tid.value.trim() || role.value) { b.ticketId = tid.value.trim(); b.role = role.value; }
      post('/live-tickets', b).then(function (r) { return r.json().then(function (j) { if (r.ok) { ticket = j.ticket; say('Ticket issued; connect within about a minute.', 'good'); } else say('Ticket failed ' + r.status + ' ' + JSON.stringify(j), 'bad'); }); }, function (e) { say(e.message, 'bad'); }); } }, '1. Get ticket');
    var bCon = h('button', { class: 'btn', onclick: function () {
      if (!ticket) return say('Get a ticket first.', 'bad'); if (ws) ws.close();
      var path = tid.value.trim() ? '/notifications/conversations/' + encodeURIComponent(tid.value.trim()) + '/live' : '/notifications/live';
      ws = new WebSocket(BASE.replace(/^http/, 'ws') + path + '?ticket=' + encodeURIComponent(ticket)); ticket = '';
      ws.onopen = function () { say('Connected.', 'good'); }; ws.onmessage = function (e) { say(String(e.data)); };
      ws.onclose = function (e) { say('Closed (' + e.code + ').', e.code === 1000 ? '' : 'bad'); }; ws.onerror = function () { say('Connection error.', 'bad'); }; } }, '2. Connect');
    var bSend = h('button', { class: 'btn', onclick: function () {
      if (needKey()) return;
      post('/notifications/notifications', { type: 'docs.test', title: 'Hello from the docs', body: 'Sent ' + new Date().toLocaleTimeString(), sendingApp: app.value.trim(), targetApp: app.value.trim(), userIds: [user.value.trim()] }).then(function (r) { say('Send notification: HTTP ' + r.status, r.ok ? 'good' : 'bad'); }, function (e) { say(e.message, 'bad'); }); } }, '3. Send a notification');
    var tester = h('div', { class: 'panel', style: 'margin-bottom:22px' }, [h('header', null, 'Live tester'), h('div', { class: 'pad' }, [
      h('div', { class: 'field' }, [h('label', null, 'userId'), user]), h('div', { class: 'field' }, [h('label', null, 'conversation'), h('div', null, [tid, h('div', { style: 'height:6px' }), role])]), h('div', { class: 'field' }, [h('label', null, 'targetApp'), app]),
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px' }, [bGet, bCon, bSend, h('button', { class: 'btn', onclick: function () { if (ws) { ws.close(); ws = null; } } }, 'Disconnect')]), log])]);
    return [
      H(1, 'Live connections'), h('p', { class: 'lede' }, 'Browsers cannot send a key on a WebSocket. Your backend asks the gateway for a short-lived Live ticket for one user, and the browser connects with it.'),
      H(2, 'How it works'), OL(['Your backend calls <<[[POST /live-tickets]]|#/api/gateway/issueLiveTicket>> with your key and a [[userId]].', 'It hands the ticket to that user\'s browser.', 'The browser opens [[wss://.../notifications/live?ticket=...]] within about a minute.', 'Anything you send to that user now arrives on the socket.']),
      callout('', 'Verified', 'The gateway checks the ticket before upgrading, so a missing, expired, tampered or wrong-user ticket gets [[401]] and never reaches the service. The verified user replaces anything the browser declared.'),
      H(2, 'In the browser'),
      snippet({ method: 'GET', path: '/notifications/live', auth: false, query: { ticket: 'TICKET' } }, { run: false }),
      H(2, 'Try it'), tester,
      H(2, 'Conversations'), P('For a Ticket conversation add [[ticketId]] and [[role]] ([[Customer]] or [[Staff]]) when you ask for the ticket, and connect to [[/notifications/conversations/{ticketId}/live]].')
    ];
  });
  var CLIENTS = null;
  page('/guides/mcp', 'AI agents (MCP)', 'Guides', function () {
    var list = h('div', { class: 'tools' }, h('p', { class: 'hint' }, 'Add your key, then load the tools this gateway offers right now.'));
    function load() {
      if (!KEY) return openKey();
      list.textContent = 'Loading';
      fetch(BASE + '/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
        .then(function (r) { return r.json(); }).then(function (j) {
          list.textContent = ''; var tools = (j.result && j.result.tools) || [];
          if (!tools.length) return list.appendChild(h('p', { class: 'hint' }, 'No tools returned: ' + JSON.stringify(j).slice(0, 200)));
          tools.forEach(function (t) { list.appendChild(h('details', { class: 'tool' }, [h('summary', null, [h('b', null, t.name), h('span', null, t.description || '')]), h('pre', { class: 'wrap' }, highlight(JSON.stringify(t.inputSchema, null, 2), 'json'))])); });
        }, function (e) { list.textContent = 'Failed: ' + e.message; });
    }
    var cfg = JSON.stringify({ mcpServers: { gateway: { type: 'http', url: BASE + '/mcp', headers: { Authorization: 'Bearer YOUR_CALLER_KEY' } } } }, null, 2);
    return [
      H(1, 'AI agents (MCP)'), h('p', { class: 'lede' }, 'The gateway is also a Model Context Protocol server. Point an agent at one URL and it can notify, store files and write audit events, with no glue code.'),
      H(2, 'Connect an agent'), P('The endpoint is [[' + BASE + '/mcp]] (Streamable HTTP, stateless). Authenticate with your Caller key as a bearer header, exactly like the REST API.'),
      h('div', { class: 'code' }, [h('div', { class: 'bar' }, [h('span', { class: 'lang on' }, 'Claude Code'), h('span', { class: 'sp' }), h('button', { class: 'mini', onclick: function () { copy('claude mcp add --transport http gateway ' + BASE + '/mcp --header "Authorization: Bearer YOUR_CALLER_KEY"'); } }, 'Copy')]),
        h('pre', null, highlight('claude mcp add --transport http gateway ' + BASE + '/mcp \\\n  --header "Authorization: Bearer YOUR_CALLER_KEY"', 'sh'))]),
      h('div', { class: 'code' }, [h('div', { class: 'bar' }, [h('span', { class: 'lang on' }, 'JSON config (Cursor, Claude Desktop and others)'), h('span', { class: 'sp' }), h('button', { class: 'mini', onclick: function () { copy(cfg); } }, 'Copy')]), h('pre', null, highlight(cfg, 'json'))]),
      callout('warn', 'Keep the key secret', 'The agent acts as your Caller with all of its access. Put the key in the agent\'s own secret store, never in a repository.'),
      H(2, 'Check it works'), P('List what the server offers. This is a raw JSON-RPC call; agents do it for you.'),
      snippet({ method: 'POST', path: '/mcp', headers: { Accept: 'application/json, text/event-stream' }, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } }),
      H(2, 'Tools'), P('Tools are generated from the notifications and file-storage OpenAPI documents, so they stay current, plus audit and gateway tools. Every call runs as a normal gateway request with your key, so authentication, the rate limit and downstream credentials all apply.'),
      h('p', null, h('button', { class: 'btn primary', onclick: load }, 'Load tools')), list,
      H(2, 'Call a tool'), snippet({ method: 'POST', path: '/mcp', headers: { Accept: 'application/json, text/event-stream' }, body: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'notifications_list_notifications', arguments: { userId: 'user-123', app: 'crms' } } } }),
      P('Results come back as text: the HTTP status on the first line, then the JSON body. A status of 400 or above is flagged as a tool error.'),
      H(2, 'The escape hatch'), P('[[gateway_request]] calls any route under [[/notifications]], [[/files]] or [[/audit]] (and [[/live-tickets]]). It cannot call [[/mcp]] itself. Prefer the specific tools; they validate arguments.'),
      callout('', 'Per-service servers', 'Each service also serves its own [[/mcp]] through the gateway ([[/notifications/mcp]], [[/files/mcp]], [[/audit/mcp]]) if you only want one service\'s tools.')
    ];
  });

  /* ---------- reference pages ---------- */
  function refPage(op) {
    var left = [h('div', { class: 'crumbs' }, [h('span', null, 'API reference'), h('span', null, op.service)]), h('h1', null, op.summary),
      h('div', { class: 'urlbar', style: 'display:flex;gap:10px;align-items:center' }, [h('span', { class: 'm ' + op.method }, op.method), op.path]), op.description ? P(op.description) : null,
      h('p', { class: 'hint' }, op.auth ? 'Needs your Caller key.' : 'Open: needs no key.')];
    [['path', 'Path parameters'], ['query', 'Query parameters'], ['header', 'Headers']].forEach(function (g) {
      var list = op.params.filter(function (p) { return p.in === g[0]; });
      if (list.length) { left.push(H(2, g[1])); left.push(table(['Name', 'Type', 'Description'], list.map(function (p) { return [h('span', null, [h('code', null, p.name), p.required ? h('span', { class: 'req' }, ' *') : '']), h('span', { class: 'tabletag' }, p.type), p.description || '']; }))); }
    });
    if (op.fields.length) { left.push(H(2, 'Request body')); left.push(table(['Field', 'Type', 'Description'], op.fields.map(function (f) { return [h('span', null, [h('code', null, f.name), f.required ? h('span', { class: 'req' }, ' *') : '']), h('span', { class: 'tabletag' }, f.type), f.description || '']; }))); }
    left.push(P('Fields marked <b></b> are required. Responses and errors are the service\'s own; see <<Errors and limits|#/errors>>.'.replace('<b></b>', '[[*]]')));
    return { nodes: left, right: tryPanel(op), ref: true };
  }

  /* ---------- navigation, router, TOC, search ---------- */
  var SERVICES = ['Gateway', 'Notifications', 'Files', 'Audit'];
  function sections(tab) {
    if (tab === 'ref') return SERVICES.map(function (s) { return { name: s, items: OPS.filter(function (o) { return o.service === s; }).map(function (o) { return { id: o.id, title: o.summary, method: o.method }; }) }; }).filter(function (s) { return s.items.length; });
    var by = {}, order = [];
    GUIDE_ORDER.forEach(function (id) { var p = PAGES[id]; if (!by[p.section]) { by[p.section] = []; order.push(p.section); } by[p.section].push({ id: id, title: p.title }); });
    return order.map(function (n) { return { name: n, items: by[n] }; });
  }
  function currentRoute() { return (location.hash.replace(/^#/, '').split('?')[0]) || '/'; }
  function tabOf(route) { return route.indexOf('/api/') === 0 ? 'ref' : 'guides'; }
  function renderNav(route) {
    var nav = $('nav'); nav.textContent = '';
    sections(tabOf(route)).forEach(function (s) {
      var box = h('div', { class: 'sec' }, h('h4', null, s.name));
      s.items.forEach(function (i) { box.appendChild(h('a', { href: '#' + i.id, class: i.id === route ? 'on' : '' }, [i.title, i.method ? h('span', { class: 'm ' + i.method }, i.method) : null])); });
      nav.appendChild(box);
    });
    [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('on', t.dataset.tab === (route === '/guides/mcp' ? 'agents' : tabOf(route))); });
  }
  var spy = null;
  function renderToc(doc, toc) {
    toc.textContent = ''; toc.appendChild(h('h5', null, 'On this page'));
    var heads = doc.querySelectorAll('h2,h3'), links = [];
    [].forEach.call(heads, function (e) { var a = h('a', { href: '#' + currentRoute() + '?s=' + e.id, class: e.tagName === 'H3' ? 'l3' : '', onclick: function (ev) { ev.preventDefault(); e.scrollIntoView(); } }, e.firstChild.textContent); toc.appendChild(a); links.push([e, a]); });
    if (spy) spy.disconnect();
    if (!('IntersectionObserver' in window) || !links.length) return;
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) links.forEach(function (l) { l[1].classList.toggle('on', l[0] === en.target); }); });
    }, { rootMargin: '-80px 0px -70% 0px' });
    links.forEach(function (l) { spy.observe(l[0]); });
  }
  function neighbours(route) {
    var flat = []; sections(tabOf(route)).forEach(function (s) { s.items.forEach(function (i) { flat.push(i); }); });
    var i = flat.map(function (x) { return x.id; }).indexOf(route);
    return [flat[i - 1], flat[i + 1]];
  }
  function render() {
    var route = currentRoute(), main = $('main'), spec = OPBYID[route], p = PAGES[route], built;
    if (spec) built = refPage(spec); else if (p) built = { nodes: [h('div', { class: 'crumbs' }, [h('span', null, p.section)])].concat(p.build()) };
    else built = { nodes: [h('h1', null, 'Page not found'), P('There is no page at [[' + route + ']]. <<Start from the introduction|#/>>.')] };
    renderNav(route);
    main.textContent = ''; main.className = 'main' + (built.ref ? ' ref' : '');
    var doc = h('article', { class: 'doc' }, built.nodes);
    var nb = neighbours(route);
    if (nb[0] || nb[1]) doc.appendChild(h('div', { class: 'pn' }, [nb[0] ? h('a', { href: '#' + nb[0].id }, [h('small', null, 'Previous'), nb[0].title]) : h('span'), nb[1] ? h('a', { class: 'next', href: '#' + nb[1].id }, [h('small', null, 'Next'), nb[1].title]) : null]));
    main.appendChild(doc);
    if (built.right) main.appendChild(built.right); else { var toc = h('nav', { class: 'toc', 'aria-label': 'On this page' }); main.appendChild(toc); renderToc(doc, toc); }
    var title = (spec ? spec.summary : p ? p.title : 'Not found'); document.title = title + ' | Gateway Docs';
    document.body.classList.remove('nav-open');
    var target = (location.hash.split('?s=')[1] || ''); if (target && $(target)) $(target).scrollIntoView(); else window.scrollTo(0, 0);
  }

  /* search */
  var results = $('results'), sin = $('sin'), sel = 0, hits = [];
  function index() {
    var items = []; GUIDE_ORDER.forEach(function (id) { items.push({ id: id, title: PAGES[id].title, tag: PAGES[id].section, text: PAGES[id].title }); });
    OPS.forEach(function (o) { items.push({ id: o.id, title: o.summary, tag: o.method + ' ' + o.path, text: o.summary + ' ' + o.path + ' ' + o.method + ' ' + o.service, method: o.method }); });
    return items;
  }
  function drawResults() {
    var q = sin.value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
    hits = index().filter(function (i) { var t = (i.text + ' ' + i.title).toLowerCase(); return words.every(function (w) { return t.indexOf(w) >= 0; }); }).slice(0, 30);
    sel = Math.min(sel, Math.max(0, hits.length - 1)); results.textContent = '';
    if (!hits.length) results.appendChild(h('p', { class: 'hint', style: 'padding:12px' }, 'No results'));
    hits.forEach(function (i, n) { results.appendChild(h('a', { href: '#' + i.id, class: n === sel ? 'on' : '', onclick: closeSearch }, [i.method ? h('span', { class: 'm ' + i.method }, i.method) : null, i.title, h('small', null, i.tag)])); });
  }
  function openSearch() { $('scrim').classList.add('open'); $('searchbox').style.display = ''; $('keybox').style.display = 'none'; sin.value = ''; sel = 0; drawResults(); sin.focus(); }
  function closeSearch() { $('scrim').classList.remove('open'); }
  function openKey() { $('scrim').classList.add('open'); $('searchbox').style.display = 'none'; $('keybox').style.display = ''; $('keyin').value = KEY; $('keyin').focus(); }
  sin.addEventListener('input', function () { sel = 0; drawResults(); });
  sin.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, hits.length - 1); drawResults(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); drawResults(); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[sel]) { location.hash = '#' + hits[sel].id; closeSearch(); }
  });
  $('scrim').addEventListener('mousedown', function (e) { if (e.target === $('scrim')) closeSearch(); });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape') closeSearch();
    else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });
  $('searchbtn').addEventListener('click', openSearch);
  $('keybtn').addEventListener('click', openKey);
  $('keysave').addEventListener('click', function () { setKey($('keyin').value); closeSearch(); toast(KEY ? 'Key saved for this tab' : 'Key cleared'); render(); });
  $('keyclear').addEventListener('click', function () { $('keyin').value = ''; setKey(''); closeSearch(); toast('Key cleared'); render(); });
  $('keyin').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('keysave').click(); });
  $('burger').addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
  $('theme').addEventListener('click', function () {
    var el = document.documentElement, cur = el.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    el.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark'); store('gw_theme', cur === 'dark' ? 'light' : 'dark');
  });
  if (load('gw_theme')) document.documentElement.setAttribute('data-theme', load('gw_theme'));
  [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.addEventListener('click', function (e) { e.preventDefault(); var d = t.dataset.tab; location.hash = '#' + (d === 'ref' ? '/api/notifications/sendNotification' : d === 'agents' ? '/guides/mcp' : '/'); }); });
  window.addEventListener('hashchange', render);
  setKey(KEY);

  /* ---------- boot ---------- */
  function spec(path) { return fetch(BASE + path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  Promise.all([
    spec('/notifications/openapi.json').then(function (s) { return opsFromSpec('Notifications', '/notifications', s, false); }).catch(function (e) { console.error('spec load failed', e && e.message); return []; }),
    spec('/files/openapi.json').then(function (s) { return opsFromSpec('Files', '/files', s, true); }).catch(function (e) { console.error('spec load failed', e && e.message); return []; })
  ]).then(function (l) {
    OPS = STATIC.concat(l[0], l[1]); OPS.forEach(function (o) { OPBYID[o.id] = o; });
    render();
  });
})();
`
