/** Trexure palette and type (violet, gold, aubergine ink, paper; Fraunces, Hanken Grotesk, JetBrains Mono) in a docs layout. */
export const STYLE = String.raw`
:root{
  --ink:#1A1025;--ink-soft:rgba(26,16,37,.68);--ink-mute:rgba(26,16,37,.48);
  --violet:#8E44AD;--violet-deep:#6C2A8C;--violet-soft:rgba(142,68,173,.10);--violet-line:rgba(142,68,173,.28);
  --gold:#D4AF37;--gold-soft:#E8C766;--gold-line:rgba(212,175,55,.45);--gold-bg:rgba(212,175,55,.12);
  --paper:#F7F9FB;--panel:#FFFFFF;--panel-2:#F2EFF4;--code:#F6F2F8;--line:rgba(26,16,37,.10);--line-2:rgba(26,16,37,.06);
  --ok:#17794d;--ok-bg:rgba(23,121,77,.12);--warn:#8a5a00;--warn-bg:rgba(212,175,55,.16);--err:#b4232a;--err-bg:rgba(180,35,42,.10);
  --t-key:#6C2A8C;--t-str:#0f7a6b;--t-num:#9a5b00;--t-bool:#b4236b;--t-com:rgba(26,16,37,.45);
  --shadow:0 1px 2px rgba(26,16,37,.04),0 8px 24px -12px rgba(26,16,37,.14);
  --ff-display:"Fraunces",Georgia,serif;--ff-body:"Hanken Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;--ff-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --r-sm:8px;--r:12px;--r-lg:18px;--top:60px;--side:272px;--toc:232px;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ink:#F3EEF7;--ink-soft:rgba(243,238,247,.72);--ink-mute:rgba(243,238,247,.5);--violet:#B57BD1;--violet-deep:#C99BE0;--violet-soft:rgba(181,123,209,.14);--violet-line:rgba(181,123,209,.34);
  --gold-bg:rgba(212,175,55,.14);--paper:#150D1E;--panel:#1D1329;--panel-2:#251934;--code:#120A1B;--line:rgba(243,238,247,.11);--line-2:rgba(243,238,247,.06);
  --ok:#4ade80;--ok-bg:rgba(74,222,128,.12);--warn:#E8C766;--warn-bg:rgba(212,175,55,.16);--err:#ff8a8f;--err-bg:rgba(255,138,143,.12);
  --t-key:#d8b4ee;--t-str:#5eead4;--t-num:#E8C766;--t-bool:#f9a8d4;--t-com:rgba(243,238,247,.45);--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px -12px rgba(0,0,0,.5)}}
:root[data-theme="dark"]{
  --ink:#F3EEF7;--ink-soft:rgba(243,238,247,.72);--ink-mute:rgba(243,238,247,.5);--violet:#B57BD1;--violet-deep:#C99BE0;--violet-soft:rgba(181,123,209,.14);--violet-line:rgba(181,123,209,.34);
  --gold-bg:rgba(212,175,55,.14);--paper:#150D1E;--panel:#1D1329;--panel-2:#251934;--code:#120A1B;--line:rgba(243,238,247,.11);--line-2:rgba(243,238,247,.06);
  --ok:#4ade80;--ok-bg:rgba(74,222,128,.12);--warn:#E8C766;--warn-bg:rgba(212,175,55,.16);--err:#ff8a8f;--err-bg:rgba(255,138,143,.12);
  --t-key:#d8b4ee;--t-str:#5eead4;--t-num:#E8C766;--t-bool:#f9a8d4;--t-com:rgba(243,238,247,.45);--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px -12px rgba(0,0,0,.5)}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:calc(var(--top) + 20px);-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 var(--ff-body);letter-spacing:-.005em;-webkit-font-smoothing:antialiased}
::selection{background:var(--violet);color:#fff}
a{color:var(--violet-deep);text-decoration:none;border-bottom:1px solid var(--violet-line)}a:hover{border-bottom-color:var(--violet)}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:2px solid var(--violet);outline-offset:2px}
code,pre,kbd{font-family:var(--ff-mono)}
/* top bar */
.top{position:sticky;top:0;z-index:30;height:var(--top);display:flex;align-items:center;gap:18px;padding:0 20px;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;font:560 19px var(--ff-display);letter-spacing:-.01em;color:var(--ink);border:0}
.mark{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,var(--violet),var(--violet-deep));display:grid;place-items:center;box-shadow:0 0 0 2px var(--gold-line)}
.mark svg{width:15px;height:15px}
.brand small{font:500 11px var(--ff-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-mute);margin-left:2px}
.tabs{display:flex;gap:2px;margin-left:8px}
.tab{padding:6px 12px;border-radius:999px;color:var(--ink-soft);border:0;font-weight:500;font-size:14.5px}
.tab:hover{background:var(--violet-soft);color:var(--ink)}
.tab.on{background:var(--violet-soft);color:var(--violet-deep);font-weight:600}
.spacer{flex:1}
.search{display:flex;align-items:center;gap:10px;min-width:260px;padding:7px 12px;background:var(--panel);border:1px solid var(--line);border-radius:999px;color:var(--ink-mute);font-size:14px}
.search:hover{border-color:var(--violet-line)}
.search kbd{margin-left:auto;font-size:11px;border:1px solid var(--line);border-radius:5px;padding:1px 6px;background:var(--panel-2)}
.keybtn{display:flex;align-items:center;gap:8px;padding:7px 13px;border-radius:999px;border:1px solid var(--gold-line);background:var(--gold-bg);font-weight:600;font-size:13.5px}
.keybtn .dot{width:8px;height:8px;border-radius:50%;background:var(--ink-mute)}
.keybtn.set .dot{background:var(--ok)}
.iconbtn{width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:var(--panel);display:grid;place-items:center}
.iconbtn:hover{border-color:var(--violet-line)}
.burger{display:none}
/* shell */
.shell{display:grid;grid-template-columns:var(--side) minmax(0,1fr);max-width:1440px;margin:0 auto}
.side{position:sticky;top:var(--top);height:calc(100vh - var(--top));overflow:auto;padding:22px 14px 40px 20px;border-right:1px solid var(--line)}
.sec{margin:0 0 20px}
.sec>h4{margin:0 0 6px;padding:0 10px;font:500 11px var(--ff-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-mute)}
.nav a{display:flex;gap:8px;align-items:center;padding:6px 10px;border:0;border-radius:var(--r-sm);color:var(--ink-soft);font-size:14.5px;line-height:1.35}
.nav a:hover{background:var(--violet-soft);color:var(--ink)}
.nav a.on{background:var(--violet-soft);color:var(--violet-deep);font-weight:600;box-shadow:inset 2px 0 0 var(--gold)}
.nav .grp{margin:12px 0 2px;padding:0 10px;font-weight:600;font-size:13px;color:var(--ink)}
.nav a .m{margin-left:auto}
.m{font:600 10px/1 var(--ff-mono);padding:3px 5px;border-radius:5px;letter-spacing:.02em;flex:none}
.m.GET{color:#0f7a6b;background:rgba(15,122,107,.12)}.m.POST{color:var(--violet-deep);background:var(--violet-soft)}.m.PUT,.m.PATCH{color:#9a5b00;background:var(--warn-bg)}.m.DELETE{color:var(--err);background:var(--err-bg)}.m.WS{color:var(--t-bool);background:rgba(180,35,107,.1)}
:root[data-theme="dark"] .m.GET{color:#5eead4}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .m.GET{color:#5eead4}}
/* content */
.main{display:grid;grid-template-columns:minmax(0,1fr) var(--toc);gap:40px;padding:36px 40px 80px;min-width:0}
.main.ref{grid-template-columns:minmax(0,1fr) minmax(380px,.82fr)}
.doc{min-width:0;max-width:760px}
.ref .doc{max-width:none}
.crumbs{font:500 12px var(--ff-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:14px}
.crumbs span+span::before{content:"/";margin:0 8px;color:var(--gold)}
h1{font:520 clamp(32px,4.2vw,46px)/1.08 var(--ff-display);letter-spacing:-.02em;margin:0 0 14px;font-variation-settings:"SOFT" 60}
h2{font:520 27px/1.2 var(--ff-display);letter-spacing:-.012em;margin:46px 0 12px;padding-top:6px;position:relative}
h2::before{content:"";position:absolute;left:0;top:-4px;width:34px;height:2px;background:var(--gold)}
h3{font:600 17px var(--ff-body);margin:28px 0 8px}
.lede{font-size:19px;color:var(--ink-soft);margin:0 0 24px;max-width:62ch}
p{margin:0 0 14px}
ul,ol{padding-left:22px;margin:0 0 16px}li{margin:4px 0}
:not(pre)>code{font-size:.86em;background:var(--code);border:1px solid var(--line-2);border-radius:6px;padding:1px 6px}
.hash{opacity:0;margin-left:8px;border:0;color:var(--gold);font-size:.7em}h2:hover .hash,h3:hover .hash{opacity:1}
table{width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14.5px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
th{text-align:left;font:500 11px var(--ff-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);padding:9px 12px;background:var(--panel-2);border-bottom:1px solid var(--line)}
td{padding:9px 12px;border-bottom:1px solid var(--line-2);vertical-align:top}tr:last-child td{border-bottom:0}
td code{white-space:nowrap}
.req{color:var(--err);font-weight:700}
.tabletag{font:500 11px var(--ff-mono);color:var(--ink-mute)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:0 0 28px}
.card{display:block;padding:18px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--panel);box-shadow:var(--shadow);color:var(--ink);transition:transform .2s,border-color .2s}
.card:hover{transform:translateY(-2px);border-color:var(--violet-line)}
.card b{display:block;font:520 19px var(--ff-display);margin-bottom:4px}
.card span{color:var(--ink-soft);font-size:14.5px}
.card .eb{font:500 11px var(--ff-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--violet);margin-bottom:8px;display:block}
.callout{margin:0 0 18px;padding:12px 16px;border-radius:var(--r);border:1px solid var(--violet-line);background:var(--violet-soft)}
.callout.warn{border-color:var(--gold-line);background:var(--gold-bg)}
.callout b{font:600 11px var(--ff-mono);letter-spacing:.14em;text-transform:uppercase;display:block;margin-bottom:2px;color:var(--violet-deep)}
.callout.warn b{color:var(--warn)}
.callout p:last-child{margin:0}
.flow{display:flex;align-items:stretch;gap:10px;flex-wrap:wrap;margin:0 0 26px}
.flow>div{flex:1 1 150px;padding:14px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel)}
.flow>div b{display:block;font:520 16px var(--ff-display)}
.flow>div small{color:var(--ink-soft)}
.flow .arrow{flex:0 0 auto;align-self:center;border:0;background:none;padding:0;color:var(--gold);font-size:22px}
.flow .gw{background:linear-gradient(160deg,var(--violet-soft),var(--gold-bg));border-color:var(--violet-line)}
.pn{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:56px;padding-top:24px;border-top:1px solid var(--line)}
.pn a{padding:14px 16px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);color:var(--ink)}
.pn a:hover{border-color:var(--violet-line)}.pn a small{display:block;font:500 11px var(--ff-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-mute)}
.pn a.next{text-align:right;grid-column:2}
/* toc */
.toc{position:sticky;top:calc(var(--top) + 28px);align-self:start;max-height:calc(100vh - var(--top) - 56px);overflow:auto;font-size:13.5px}
.toc h5{margin:0 0 8px;font:500 11px var(--ff-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-mute)}
.toc a{display:block;border:0;color:var(--ink-soft);padding:3px 0 3px 12px;border-left:1px solid var(--line)}
.toc a.l3{padding-left:24px}.toc a:hover{color:var(--ink)}
.toc a.on{color:var(--violet-deep);border-left-color:var(--gold);font-weight:600}
/* code blocks */
.code{margin:0 0 18px;border:1px solid var(--line);border-radius:var(--r);background:var(--code);overflow:hidden;box-shadow:var(--shadow)}
.code .bar{display:flex;align-items:center;gap:4px;padding:6px 8px 6px 10px;border-bottom:1px solid var(--line-2);background:var(--panel-2)}
.code .bar .lang{padding:3px 10px;border:0;border-radius:6px;background:transparent;font:500 12px var(--ff-mono);color:var(--ink-mute)}
.code .bar .lang.on{background:var(--panel);color:var(--violet-deep);box-shadow:0 0 0 1px var(--line)}
.code .bar .sp{flex:1}
.mini{padding:3px 10px;border-radius:6px;border:1px solid var(--line);background:var(--panel);font:500 12px var(--ff-mono)}
.mini:hover{border-color:var(--violet-line)}
.mini.run{background:var(--violet);border-color:var(--violet);color:#fff;font-weight:600}
.mini.run:disabled{opacity:.6}
pre{margin:0;padding:14px 16px;overflow:auto;font-size:13px;line-height:1.6;white-space:pre;tab-size:2}
pre.wrap{white-space:pre-wrap;word-break:break-word}
.tk{color:var(--t-key)}.ts{color:var(--t-str)}.tn{color:var(--t-num)}.tb{color:var(--t-bool)}.tc{color:var(--t-com)}
.out{border-top:1px solid var(--line)}
.out .meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;font:500 12px var(--ff-mono);color:var(--ink-mute);background:var(--panel)}
.chip{padding:2px 9px;border-radius:999px;font-weight:700}
.chip.s2{background:var(--ok-bg);color:var(--ok)}.chip.s4{background:var(--warn-bg);color:var(--warn)}.chip.s5,.chip.s0{background:var(--err-bg);color:var(--err)}.chip.s3,.chip.s1{background:var(--violet-soft);color:var(--violet-deep)}
.out pre{max-height:360px}
/* try panel */
.try{position:sticky;top:calc(var(--top) + 24px);align-self:start;max-height:calc(100vh - var(--top) - 48px);overflow:auto;display:flex;flex-direction:column;gap:14px}
.panel{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--panel);box-shadow:var(--shadow);overflow:hidden}
.panel>header{padding:11px 14px;border-bottom:1px solid var(--line-2);display:flex;align-items:center;gap:10px;font:500 11px var(--ff-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-mute);background:var(--panel-2)}
.panel .pad{padding:14px}
.field{display:grid;grid-template-columns:132px 1fr;gap:8px;align-items:start;margin-bottom:9px}
.field label{font:500 12px var(--ff-mono);padding-top:8px;word-break:break-all}
.field small{display:block;color:var(--ink-mute);font:12px var(--ff-body)}
input[type=text],input[type=password],select,textarea{width:100%;background:var(--paper);border:1px solid var(--line);border-radius:var(--r-sm);padding:7px 10px;font:13px var(--ff-mono)}
textarea{min-height:150px;resize:vertical;line-height:1.55}
input:focus,select:focus,textarea:focus{border-color:var(--violet);outline:none;box-shadow:0 0 0 3px var(--violet-soft)}
.btn{padding:8px 16px;border-radius:999px;border:1px solid var(--line);background:var(--panel);font-weight:600;font-size:14px}
.btn:hover{border-color:var(--violet-line)}
.btn.primary{background:linear-gradient(135deg,var(--violet),var(--violet-deep));border-color:transparent;color:#fff}
.btn.primary:disabled{opacity:.6;cursor:wait}
.urlbar{font:12.5px var(--ff-mono);padding:9px 12px;background:var(--code);border:1px solid var(--line);border-radius:var(--r-sm);word-break:break-all;margin-bottom:12px}
.hint{color:var(--ink-mute);font-size:13px}
.log{height:230px;overflow:auto;font:12.5px/1.6 var(--ff-mono);white-space:pre-wrap}
.log div{border-bottom:1px dashed var(--line-2)}.log time{color:var(--ink-mute);margin-right:8px}
.log .good{color:var(--ok)}.log .bad{color:var(--err)}
/* search modal & popovers */
.scrim{position:fixed;inset:0;background:rgba(20,10,30,.5);backdrop-filter:blur(3px);z-index:50;display:none;align-items:flex-start;justify-content:center;padding-top:12vh}
.scrim.open{display:flex}
.modal{width:min(600px,92vw);background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:0 30px 80px -20px rgba(0,0,0,.5);overflow:hidden}
.modal input{border:0;border-bottom:1px solid var(--line);border-radius:0;padding:16px 18px;font:16px var(--ff-body);background:transparent}
.modal input:focus{box-shadow:none}
.results{max-height:50vh;overflow:auto;padding:8px}
.results a{display:flex;gap:10px;align-items:center;border:0;padding:9px 12px;border-radius:var(--r-sm);color:var(--ink)}
.results a.on,.results a:hover{background:var(--violet-soft)}
.results small{color:var(--ink-mute);margin-left:auto;font:11px var(--ff-mono)}
.keypop{padding:20px;display:grid;gap:12px}
.keypop h3{margin:0;font:520 20px var(--ff-display)}
.keypop p{margin:0}
.toast{position:fixed;bottom:20px;left:50%;transform:translate(-50%,10px);background:var(--ink);color:var(--paper);padding:9px 16px;border-radius:999px;font-size:13.5px;opacity:0;pointer-events:none;transition:.2s;z-index:80}
.toast.show{opacity:1;transform:translate(-50%,0)}
.tools{display:grid;gap:8px}
.tool{border:1px solid var(--line);border-radius:var(--r);background:var(--panel)}
.tool summary{cursor:pointer;padding:10px 14px;display:flex;gap:10px;align-items:baseline;list-style:none}
.tool summary b{font:600 13.5px var(--ff-mono);color:var(--violet-deep)}
.tool summary span{color:var(--ink-soft);font-size:14px}
.tool pre{border-top:1px solid var(--line-2)}
/* responsive */
@media (max-width:1180px){.main{grid-template-columns:minmax(0,1fr)}.toc{display:none}.main.ref{grid-template-columns:minmax(0,1fr)}.try{position:static;max-height:none}}
@media (max-width:860px){
  .shell{grid-template-columns:1fr}
  .side{position:fixed;left:0;top:var(--top);bottom:0;width:min(86vw,320px);z-index:40;background:var(--paper);transform:translateX(-102%);transition:transform .25s;height:auto}
  body.nav-open .side{transform:none;box-shadow:12px 0 40px -10px rgba(0,0,0,.4)}
  .burger{display:grid}.tabs{display:none}.search{min-width:0;flex:1}.search span,.search kbd{display:none}.search{flex:0 0 auto;padding:7px 10px}
  .main{padding:24px 18px 64px}.field{grid-template-columns:1fr}.field label{padding-top:0}.top{gap:10px;padding:0 12px}.brand small{display:none}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`
