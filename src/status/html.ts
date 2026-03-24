// AEGIS Status Window — HTML Builder v4
// Task Manager layout — mirrors Windows Task Manager Performance tab
export function buildStatusHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AEGIS</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
:root{
  --bg:#06080f;--bg2:#0d1120;--bg3:#111827;
  --cyan:#00e5ff;--cyan-dim:#0088aa;--cyan-f:rgba(0,229,255,.07);
  --amber:#ffbb00;--amber-d:#7a5200;
  --red:#ff4757;--red-d:#6b1a22;
  --green:#4ade80;--green-d:#1a4a2e;
  --white:#e2eaf8;--mid:#8899bb;--dim:#5570a0;
  --dimmer:#1e2a42;--border:#1a2540;--border2:#223060;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100vh;overflow:hidden;background:var(--bg);color:var(--white);
  font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased}
body::after{content:'';position:fixed;inset:0;
  background-image:linear-gradient(rgba(0,229,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.02) 1px,transparent 1px);
  background-size:32px 32px;pointer-events:none;z-index:0}
#app{position:relative;z-index:1;display:flex;flex-direction:column;height:100vh;overflow:hidden}
#hdr{flex-shrink:0;height:52px;display:flex;align-items:center;background:var(--bg2);border-bottom:1px solid var(--border);overflow:hidden}
.hdr-wm{flex-shrink:0;padding:0 16px;border-right:1px solid var(--border);height:100%;display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:130px}
.wm-name{color:var(--cyan);font-size:15px;font-weight:700;letter-spacing:.1em}
.wm-sub{color:var(--dim);font-size:9px;letter-spacing:.16em;text-transform:uppercase}
.hdr-load{flex-shrink:0;padding:0 16px;border-right:1px solid var(--border);height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:80px}
.load-num{font-size:28px;font-weight:700;line-height:1;letter-spacing:-.03em;transition:color .6s;color:var(--dim)}
.load-num.g{color:var(--green);text-shadow:0 0 16px rgba(74,222,128,.4)}
.load-num.a{color:var(--amber);text-shadow:0 0 16px rgba(255,187,0,.4)}
.load-num.r{color:var(--red);text-shadow:0 0 16px rgba(255,71,87,.4)}
.load-lbl{font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.hdr-pills{flex:1;display:flex;align-items:center;gap:5px;padding:0 12px;overflow:hidden}
.pill{font-size:10px;padding:2px 7px;border:1px solid var(--border2);color:var(--mid);letter-spacing:.05em;white-space:nowrap;flex-shrink:0;transition:color .3s,border-color .3s}
.pill.ctx-active{border-color:var(--cyan-dim);color:var(--cyan)}
.pill.w-online{border-color:var(--green-d);color:var(--green)}
.pill.w-fail{border-color:var(--red-d);color:var(--red)}
.pill.watch-on{border-color:var(--amber-d);color:var(--amber)}
.pill.pp{border-color:var(--cyan-dim);color:var(--cyan);cursor:pointer}
.pill.pp:hover{background:var(--cyan-f)}
.hdr-right{flex-shrink:0;padding:0 12px;border-left:1px solid var(--border);height:100%;display:flex;align-items:center}
.spinner{color:var(--dim);font-size:12px}
#main{flex:1;display:grid;grid-template-columns:168px 1fr 260px;overflow:hidden;min-height:0}
#nav{border-right:1px solid var(--border);overflow-y:auto;overflow-x:hidden;background:var(--bg2)}
#detail{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border)}
#rpanel{display:flex;flex-direction:column;overflow:hidden}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--dimmer)}
.mc{padding:9px 11px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s}
.mc:hover{background:rgba(255,255,255,.03)}
.mc.active{background:var(--cyan-f);border-left:2px solid var(--cyan)}
.mc.active .mcn{color:var(--cyan)}
.mch{display:flex;align-items:baseline;gap:6px;margin-bottom:3px}
.mcn{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mid);font-weight:500}
.mcv{font-size:15px;font-weight:700;color:var(--white);letter-spacing:-.02em;margin-left:auto}
.mcs{font-size:9px;color:var(--dim);margin-bottom:3px}
canvas.sp{width:100%;height:28px;display:block}
.dh{flex-shrink:0;padding:10px 14px 6px;border-bottom:1px solid var(--border);display:flex;align-items:baseline;gap:8px}
.dt{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mid)}
.dv{font-size:26px;font-weight:700;color:var(--white);letter-spacing:-.02em}
.du{font-size:11px;color:var(--dim)}
.db{font-size:9px;padding:2px 6px;border:1px solid;letter-spacing:.08em;margin-left:auto;flex-shrink:0;display:none}
.dgw{flex-shrink:0;position:relative;height:176px;background:var(--bg)}
canvas.dc{width:100%;height:176px;display:block}
.dgl{position:absolute;right:6px;top:4px;font-size:8px;color:var(--dim);text-align:right;line-height:1.9}
.dga{position:absolute;bottom:2px;left:10px;right:10px;display:flex;justify-content:space-between;font-size:8px;color:var(--dim)}
.ds{flex-shrink:0;display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border)}
.sc{padding:8px 12px;border-right:1px solid var(--border)}
.sc:last-child{border-right:none}
.sl{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:3px}
.sv{font-size:16px;font-weight:700;color:var(--white);letter-spacing:-.02em}
.ss{font-size:9px;color:var(--mid);margin-top:1px}
.db2{flex:1;overflow-y:auto;overflow-x:hidden}
.dsec{background:var(--bg2);border-bottom:1px solid var(--border);padding:3px 11px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);position:sticky;top:0;z-index:5}
.pr{display:flex;align-items:center;padding:2px 11px;min-height:19px;font-size:11px;border-left:2px solid transparent;transition:background .1s}
.pr:hover{background:var(--cyan-f)}
.pn{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--white)}
.pn.dim{color:var(--mid)}
.pbw{width:72px;padding-left:7px;flex-shrink:0}
.pbt{height:3px;background:var(--dimmer)}
.pbf{height:100%;transition:width .4s}
.pc{width:40px;text-align:right;flex-shrink:0;font-size:11px;font-weight:500}
.pm{width:42px;text-align:right;flex-shrink:0;font-size:11px;color:var(--mid)}
.cz{color:var(--dim)}.cl{color:var(--mid)}.cm{color:var(--cyan)}.ch{color:var(--amber)}.cc{color:var(--red);font-weight:700}
.dt2{width:100%;border-collapse:collapse}
.dt2 th{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--border);padding:4px 11px;text-align:left;font-weight:400;background:var(--bg2);position:sticky;top:0}
.dt2 td{font-size:11px;padding:3px 11px;border-bottom:1px solid var(--border);color:var(--white)}
.dt2 td.dim{color:var(--mid)}.dt2 td.am{color:var(--amber)}.dt2 td.re{color:var(--red)}.dt2 td.gr{color:var(--green)}
.sec{background:var(--bg2);border-bottom:1px solid var(--border);padding:4px 10px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);display:flex;align-items:center;gap:5px;flex-shrink:0;position:sticky;top:0;z-index:10}
.sec-n{color:var(--mid)}.sec-d{color:var(--dim);margin-left:auto;font-size:9px}
#slog{overflow-y:auto;max-height:120px;border-bottom:1px solid var(--border)}
.se{padding:4px 11px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border);font-size:10px}
.set{color:var(--dim);flex-shrink:0}.seto{color:var(--amber);font-weight:500}
.seb{font-size:8px;padding:1px 4px;border:1px solid var(--amber-d);color:var(--amber);margin-left:auto;flex-shrink:0}
#alog{flex:1;overflow-y:auto;overflow-x:hidden}
.ae{padding:5px 11px;border-bottom:1px solid var(--border);border-left:3px solid transparent}
.ae:hover{background:var(--cyan-f)}.ae.t{border-left-color:var(--amber)}.ae.s{border-left-color:#ff6600}.ae.k{border-left-color:var(--red)}
.aet{display:flex;align-items:center;gap:5px}
.aeti{font-size:9px;color:var(--dim);flex-shrink:0}
.aep{font-size:11px;color:var(--white);font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aeb{font-size:8px;padding:1px 5px;border:1px solid;letter-spacing:.06em;flex-shrink:0}
.aeb.t{color:var(--amber);border-color:var(--amber-d)}.aeb.s{color:#ff6600;border-color:#5a2800}.aeb.k{color:var(--red);border-color:var(--red-d)}
.aer{font-size:9px;color:var(--dim);margin-top:2px;line-height:1.5}
#cpanel{border-top:1px solid var(--border);flex-shrink:0}
.cs{display:flex;align-items:center;padding:5px 11px;gap:7px}
.cbt{flex:1;height:3px;background:var(--dimmer)}.cbf{height:100%;background:var(--cyan);transition:width .8s}
.cp{font-size:10px;color:var(--white);font-weight:500;width:30px;text-align:right;flex-shrink:0}
.ci{padding:0 11px 5px;font-size:9px;color:var(--dim)}
#ftr{flex-shrink:0;height:20px;display:flex;align-items:center;gap:14px;padding:0 12px;border-top:1px solid var(--border);background:var(--bg2);font-size:9px;color:var(--dim);overflow:hidden}
.fi{display:flex;align-items:center;gap:4px}.fv{color:var(--white)}
.fd{width:5px;height:5px;border-radius:50%;background:var(--dim)}.fd.g{background:var(--green)}.fd.r{background:var(--red)}
#ob{display:none;position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--red-d);border:1px solid var(--red);color:var(--red);font-size:10px;padding:4px 14px;z-index:1000}
.empty{padding:14px 11px;font-size:10px;color:var(--dim);text-align:center}
.en{padding:16px 14px;text-align:center}
.en-t{font-size:10px;color:var(--amber);letter-spacing:.08em;margin-bottom:6px}
.en-b{font-size:10px;color:var(--dim);line-height:1.7}
.en-c{display:block;margin:8px auto 0;background:var(--bg3);border:1px solid var(--border2);padding:5px 9px;font-size:10px;color:var(--mid);text-align:left}
#piw{display:none;position:fixed;inset:0;background:rgba(6,8,15,.85);z-index:500;align-items:center;justify-content:center}
#piw.open{display:flex}
.pm2{background:var(--bg2);border:1px solid var(--border2);border-top:2px solid var(--cyan);padding:18px 22px;width:270px}
.pm2-t{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--mid);margin-bottom:10px}
.pm2 input{width:100%;background:var(--bg);border:1px solid var(--border2);color:var(--white);font-family:inherit;font-size:13px;padding:6px 9px;outline:none}
.pm2 input:focus{border-color:var(--cyan-dim)}
.pm2-h{font-size:9px;color:var(--dim);margin-top:4px}
.pm2-b{display:flex;gap:7px;margin-top:12px}
.pb2{flex:1;background:none;border:1px solid var(--border2);color:var(--mid);font-family:inherit;font-size:10px;padding:5px;cursor:pointer;letter-spacing:.1em;text-transform:uppercase;transition:all .15s}
.pb2:hover,.pb2.ok{border-color:var(--cyan-dim);color:var(--cyan)}
</style>
</head>
<body>
<div id="app">
<div id="hdr">
  <div class="hdr-wm"><div class="wm-name">&#x258c;AEGIS<span style="color:var(--cyan-dim);font-size:11px;font-weight:400">&#x2590;</span></div><div class="wm-sub">cognitive resource os</div></div>
  <div class="hdr-load"><div class="load-num" id="ln">--</div><div class="load-lbl">LOAD</div></div>
  <div class="hdr-pills">
    <span class="pill" id="pp-ctx">CTX: --</span>
    <span class="pill" id="pp-wrk">WORKER: --</span>
    <span class="pill pp" id="pp-prof" onclick="openPM()">--</span>
    <span class="pill" id="pp-wat">0 WATCHES</span>
    <span class="pill" id="pp-elv" style="display:none">&#x26a1; ELEVATED</span>
  </div>
  <div class="hdr-right"><span class="spinner" id="spin">&#x25d0;</span></div>
</div>
<div id="main">
  <div id="nav">
    <div class="mc active" id="mc-cpu" onclick="sel('cpu')"><div class="mch"><span class="mcn">CPU</span><span class="mcv" id="mv-cpu">0%</span></div><div class="mcs" id="ms-cpu">idle</div><canvas class="sp" id="sp-cpu" height="28"></canvas></div>
    <div class="mc" id="mc-ram" onclick="sel('ram')"><div class="mch"><span class="mcn">Memory</span><span class="mcv" id="mv-ram">0%</span></div><div class="mcs" id="ms-ram">0 / 0 GB</div><canvas class="sp" id="sp-ram" height="28"></canvas></div>
    <div class="mc" id="mc-dsk" onclick="sel('dsk')"><div class="mch"><span class="mcn">Disk</span><span class="mcv" id="mv-dsk">--</span></div><div class="mcs" id="ms-dsk">read MB/s</div><canvas class="sp" id="sp-dsk" height="28"></canvas></div>
    <div class="mc" id="mc-net" onclick="sel('net')"><div class="mch"><span class="mcn">Network</span><span class="mcv" id="mv-net">--</span></div><div class="mcs" id="ms-net">MB/s</div><canvas class="sp" id="sp-net" height="28"></canvas></div>
    <div class="mc" id="mc-gpu" onclick="sel('gpu')"><div class="mch"><span class="mcn">GPU</span><span class="mcv" id="mv-gpu">--</span></div><div class="mcs" id="ms-gpu">util</div><canvas class="sp" id="sp-gpu" height="28"></canvas></div>
    <div class="mc" id="mc-ctx" onclick="sel('ctx')"><div class="mch"><span class="mcn">Context</span></div><div class="mcs" id="ms-ctx">detecting</div><div style="height:6px"></div></div>
  </div>
  <div id="detail">
    <div class="dh"><span class="dt" id="d-title">CPU</span><span class="dv" id="d-val">0</span><span class="du" id="d-unit">%</span><span class="db" id="d-badge"></span></div>
    <div class="dgw"><canvas class="dc" id="d-canvas" height="176"></canvas><div class="dgl"><div>100%</div><div style="margin-top:32px">75%</div><div style="margin-top:32px">50%</div><div style="margin-top:32px">25%</div><div style="margin-top:32px">0</div></div><div class="dga"><span>3:00</span><span>2:00</span><span>1:00</span><span>now</span></div></div>
    <div class="ds"><div class="sc"><div class="sl" id="sl0">utilization</div><div class="sv" id="sv0">--</div><div class="ss" id="ss0"></div></div><div class="sc"><div class="sl" id="sl1">uptime</div><div class="sv" id="sv1">--</div><div class="ss" id="ss1"></div></div><div class="sc"><div class="sl" id="sl2">profile</div><div class="sv" id="sv2" style="font-size:12px">--</div><div class="ss" id="ss2"></div></div></div>
    <div class="dsec" id="dsec">PROCESSES</div>
    <div class="db2" id="dbody"><div class="empty">waiting&#x2026;</div></div>
  </div>
  <div id="rpanel">
    <div class="sec"><span class="sec-n">PROFILE HISTORY</span></div>
    <div id="slog"><div class="empty" style="padding:6px 11px">no switches yet</div></div>
    <div class="sec"><span class="sec-n">ACTION LOG</span><span class="sec-d" id="ac">0</span></div>
    <div id="alog"><div class="ae" style="padding:14px;text-align:center;font-size:10px;color:var(--dim)">sniper watching&#x2026;</div></div>
    <div id="cpanel"><div class="sec"><span class="sec-n">CONFIDENCE</span></div><div class="cs"><div class="cbt"><div class="cbf" id="cbf" style="width:0"></div></div><div class="cp" id="cpct">--%</div></div><div class="ci" id="ci">loading&#x2026;</div></div>
  </div>
</div>
<div id="ftr"><div class="fi"><div class="fd" id="fd"></div><span id="fv">AEGIS v3.0.0</span></div><div class="fi"><span>UP</span><span class="fv" id="fu">--</span></div><div class="fi"><span>WATCHES</span><span class="fv" id="fw">0</span></div><div class="fi" style="margin-left:auto"><span id="ft">--</span></div></div>
</div>
<div id="piw" onclick="closePM(event)"><div class="pm2"><div class="pm2-t">&#x250c;&#x2500; SWITCH PROFILE</div><input type="text" id="pi" placeholder="profile name&#x2026;" onkeydown="piKey(event)"><div class="pm2-h" id="ph">enter profile name</div><div class="pm2-b"><button class="pb2" onclick="closePM()">CANCEL</button><button class="pb2 ok" onclick="doSwitch()">SWITCH</button></div></div></div>
<div id="ob">&#x26a0; AEGIS OFFLINE</div>
<script>
(function(){
'use strict';
var HIST=90,SNAP=null,M='cpu',SPI=0;
var SPIN=['\u25d0','\u25d3','\u25d1','\u25d2'];
var IDLE=['idle',''];
var H={cpu:[],ram:[],dsk:[],net:[],gpu:[]};
var SW=[],LP='';
var COL={
  cpu:{d:'#006688',o:'#00e5ff',fd:'rgba(0,102,136,.12)',fo:'rgba(0,229,255,.10)'},
  ram:{d:'#1a4a2e',o:'#4ade80',fd:'rgba(26,74,46,.15)',fo:'rgba(74,222,128,.10)'},
  dsk:{d:'#7a5200',o:'#ffbb00',fd:'rgba(122,82,0,.15)',fo:'rgba(255,187,0,.10)'},
  net:{d:'#7a3010',o:'#f97316',fd:'rgba(122,48,16,.15)',fo:'rgba(249,115,22,.10)'},
  gpu:{d:'#3b1f6b',o:'#c084fc',fd:'rgba(59,31,107,.15)',fo:'rgba(192,132,252,.10)'}
};
function ip(p){return p&&IDLE.indexOf(p)===-1}
function cl(n,a,b){return Math.max(a,Math.min(b,n))}
function es(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function ag(ms){var s=Math.floor((Date.now()-ms)/1000);if(s<5)return 'now';if(s<60)return s+'s';var m=Math.floor(s/60);return m<60?m+'m':Math.floor(m/60)+'h'}
function st(id,t){var e=document.getElementById(id);if(e)e.textContent=t}
function sh(id,h){var e=document.getElementById(id);if(e)e.innerHTML=h}
function sv(id){var e=document.getElementById(id);if(e)e.style.display=''}
function hv(id){var e=document.getElementById(id);if(e)e.style.display='none'}
function pu(k,v,p){H[k].push({v:v,p:p});if(H[k].length>HIST*2)H[k].shift()}

function draw(id,hist,col,mxv){
  var cv=document.getElementById(id);if(!cv)return;
  var dpr=window.devicePixelRatio||1;
  var r=cv.getBoundingClientRect();if(!r.width)return;
  cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);
  var ctx=cv.getContext('2d');ctx.scale(dpr,dpr);
  var W=r.width,H2=r.height;
  ctx.clearRect(0,0,W,H2);
  ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
  [1,2,3].forEach(function(g){var y=Math.round(H2*g/4)+.5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()});
  if(!hist||hist.length<2)return;
  var vs=Math.max(0,hist.length-HIST),vis=hist.slice(vs);
  var step=W/(HIST-1),mx=mxv||100;
  function xA(i){return W-(vis.length-1-i)*step}
  function yA(v){return H2-(v/mx)*H2*.88-H2*.06}
  var marks=SW.filter(function(e){return e.idx>=vs&&e.idx<vs+vis.length}).map(function(e){return{ri:e.idx-vs,ev:e}});
  var cuts=[0].concat(marks.map(function(m){return m.ri})).concat([vis.length-1]);
  for(var si=0;si<cuts.length-1;si++){
    var a=cuts[si],b=cuts[si+1];if(b<=a)continue;
    var mid=Math.round((a+b)/2),pr=vis[mid]?vis[mid].p:'';
    var lc=ip(pr)?col.o:col.d,fc=ip(pr)?col.fo:col.fd;
    ctx.beginPath();ctx.moveTo(xA(a),yA(vis[a].v));
    for(var pi=a+1;pi<=b;pi++)ctx.lineTo(xA(pi),yA(vis[pi].v));
    ctx.lineTo(xA(b),H2);ctx.lineTo(xA(a),H2);ctx.closePath();ctx.fillStyle=fc;ctx.fill();
    ctx.beginPath();ctx.moveTo(xA(a),yA(vis[a].v));
    for(var pi2=a+1;pi2<=b;pi2++)ctx.lineTo(xA(pi2),yA(vis[pi2].v));
    ctx.strokeStyle=lc;ctx.lineWidth=1.5;ctx.stroke();
  }
  marks.forEach(function(m){
    var mx2=xA(m.ri);
    ctx.setLineDash([2,3]);ctx.strokeStyle='#ffbb00';ctx.lineWidth=1;ctx.globalAlpha=.65;
    ctx.beginPath();ctx.moveTo(mx2,0);ctx.lineTo(mx2,H2);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;
    if(H2>40){ctx.fillStyle='#ffbb00';ctx.font='bold 7px JetBrains Mono,monospace';ctx.textAlign='center';ctx.fillText(m.ev.to.substring(0,8).toUpperCase(),Math.min(Math.max(mx2,2),W-2),H2-2)}
  });
}
function rg(){
  Object.keys(COL).forEach(function(k){draw('sp-'+k,H[k],COL[k],100)});
  var col=COL[M]||COL.cpu,hist=H[M]||[];
  draw('d-canvas',hist,col,100);
}
function recSW(from,to){SW.push({idx:H.cpu.length,from:from,to:to,time:new Date()});if(SW.length>30)SW.shift();renderSlog()}
function renderSlog(){
  if(!SW.length){sh('slog','<div class="empty" style="padding:6px 11px">no switches yet</div>');return}
  sh('slog',SW.slice().reverse().map(function(e){
    var t=e.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return '<div class="se"><span class="set">'+t+'</span><span style="color:var(--mid)">\u2192</span><span class="seto">'+es(e.to||'idle')+'</span>'+(ip(e.to)?'<span class="seb">ON</span>':'')+'</div>';
  }).join(''));
}
function sel(m){
  M=m;
  document.querySelectorAll('.mc').forEach(function(el){el.classList.toggle('active',el.id==='mc-'+m)});
  updDH();updDS();updDB();rg();
}
function cpCls(v){return v<.1?'cz':v<2?'cl':v<8?'cm':v<20?'ch':'cc'}
function updDH(){
  var s=SNAP||{};
  var titles={cpu:'CPU',ram:'MEMORY',dsk:'DISK',net:'NETWORK',gpu:'GPU',ctx:'CONTEXT'};
  var units={cpu:'%',ram:'%',dsk:'MB/s',net:'MB/s',gpu:'%',ctx:''};
  st('d-title',titles[M]||M.toUpperCase());st('d-unit',units[M]||'');
  var v='--';
  if(M==='cpu')v=(s.cpu_percent||0).toFixed(0);
  else if(M==='ram')v=(s.memory_percent||0).toFixed(0);
  else if(M==='dsk'&&s.disk_stats&&s.disk_stats.drives&&s.disk_stats.drives.length){var r=s.disk_stats.drives.reduce(function(m,d){return m+(d.read_bytes_sec||0)},0)/1048576;v=r.toFixed(1)}
  else if(M==='net'&&s.network_stats&&s.network_stats.adapters){var ta=s.network_stats.adapters.filter(function(a){return a.status==='Up'});if(ta.length){var tot=ta.reduce(function(m,a){return m+(a.bytes_sent_sec+a.bytes_recv_sec)},0)/1048576;v=tot.toFixed(1)}}
  else if(M==='gpu'&&s.gpu_stats&&s.gpu_stats.available&&s.gpu_stats.gpus&&s.gpu_stats.gpus.length)v=s.gpu_stats.gpus[0].gpu_util_percent.toFixed(0);
  st('d-val',v);
  var badge=document.getElementById('d-badge'),prof=s.active_profile||'';
  if(badge){if(ip(prof)){badge.style.display='';badge.textContent=prof.toUpperCase();badge.style.color='var(--amber)';badge.style.borderColor='var(--amber-d)'}else badge.style.display='none'}
}
function updDS(){
  var s=SNAP||{},up=s.system_extended?s.system_extended.uptime_sec||0:0;
  var upS=Math.floor(up/3600)+'h '+Math.floor((up%3600)/60)+'m',prof=s.active_profile||'idle';
  if(M==='cpu'){st('sv0',(s.cpu_percent||0).toFixed(0)+'%');st('ss0','utilization');st('sv1',upS);st('ss1','uptime');st('sv2',prof);st('ss2','profile')}
  else if(M==='ram'){var u=(s.memory_mb_used||0)/1024,tt=((s.memory_mb_used||0)+(s.memory_mb_available||0))/1024;st('sv0',u.toFixed(1)+' GB');st('ss0','in use');st('sv1',(s.memory_percent||0).toFixed(0)+'%');st('ss1','utilization');st('sv2',tt.toFixed(0)+' GB');st('ss2','total')}
  else if(M==='dsk'){var dv=s.disk_stats&&s.disk_stats.drives||[];var rr=dv.reduce(function(m,d){return m+(d.read_bytes_sec||0)},0)/1048576;var wr=dv.reduce(function(m,d){return m+(d.write_bytes_sec||0)},0)/1048576;var mq=dv.reduce(function(m,d){return Math.max(m,d.queue_depth||0)},0);st('sv0',rr.toFixed(1)+' MB/s');st('ss0','read');st('sv1',wr.toFixed(1)+' MB/s');st('ss1','write');st('sv2',mq.toFixed(1));st('ss2','queue')}
  else if(M==='net'){var ad=s.network_stats&&s.network_stats.adapters||[];var up2=ad.filter(function(a){return a.status==='Up'});var sn=up2.reduce(function(m,a){return m+a.bytes_sent_sec},0)/1048576;var rc=up2.reduce(function(m,a){return m+a.bytes_recv_sec},0)/1048576;st('sv0',sn.toFixed(2)+' MB/s');st('ss0','sent');st('sv1',rc.toFixed(2)+' MB/s');st('ss1','recv');st('sv2',up2.length.toString());st('ss2','adapters up')}
  else if(M==='gpu'){var gps=s.gpu_stats&&s.gpu_stats.gpus||[];var g=gps[0]||{};st('sv0',(g.gpu_util_percent||0).toFixed(0)+'%');st('ss0','util');st('sv1',((g.vram_used_mb||0)/1024).toFixed(1)+' GB');st('ss1','VRAM used');st('sv2',(g.temp_celsius||0)+'\u00b0C');st('ss2','temp')}
  else if(M==='ctx'){var cx=s.context||{};st('sv0',(cx.current||'unknown').replace(/_/g,'-'));st('ss0','context');st('sv1',Math.round((cx.confidence||0)*100)+'%');st('ss1','confidence');st('sv2',prof);st('ss2','profile')}
}
function updDB(){
  var s=SNAP||{};
  var en='<div class="en"><div class="en-t">\u26a1 ELEVATION REQUIRED</div><div class="en-b">Worker needs Administrator privileges.<br>Open admin cmd and run:</div><div class="en-c">pm2 stop aegis &amp;&amp; pm2 start ecosystem.config.cjs</div></div>';
  if(M==='cpu'){
    var pr=s.process_tree||[];if(!pr.length){sh('dbody',en);st('dsec','PROCESSES');return}
    st('dsec','PROCESSES BY CPU TIME');
    sh('dbody',pr.slice().sort(function(a,b){return(b.cpu_user_ms||0)-(a.cpu_user_ms||0)}).slice(0,50).map(function(p){
      var cs=(p.cpu_user_ms/1000).toFixed(1),pct=Math.min(100,parseFloat(cs)/10);
      var mm=p.memory_mb>=1024?(p.memory_mb/1024).toFixed(1)+'G':p.memory_mb.toFixed(0)+'M';
      return '<div class="pr"><span class="pn">'+es(p.name)+'</span><div class="pbw"><div class="pbt"><div class="pbf" style="width:'+pct+'%;background:#00e5ff"></div></div></div><span class="pc '+cpCls(parseFloat(cs))+'">'+cs+'s</span><span class="pm">'+mm+'</span></div>';
    }).join(''));
  }else if(M==='ram'){
    var pr2=s.process_tree||[];if(!pr2.length){sh('dbody',en);st('dsec','PROCESSES');return}
    st('dsec','PROCESSES BY MEMORY');
    var s2=pr2.slice().sort(function(a,b){return(b.memory_mb||0)-(a.memory_mb||0)}).slice(0,50);
    var mxm=s2[0]?s2[0].memory_mb:1;
    sh('dbody',s2.map(function(p){
      var mm=p.memory_mb>=1024?(p.memory_mb/1024).toFixed(1)+'G':p.memory_mb.toFixed(0)+'M';
      return '<div class="pr"><span class="pn">'+es(p.name)+'</span><div class="pbw"><div class="pbt"><div class="pbf" style="width:'+Math.min(100,(p.memory_mb/mxm)*100)+'%;background:#4ade80"></div></div></div><span class="pm" style="color:var(--white);font-weight:500">'+mm+'</span></div>';
    }).join(''));
  }else if(M==='dsk'){
    var ds=s.disk_stats;if(!ds){sh('dbody',en);st('dsec','DRIVES');return}
    st('dsec','DRIVES');
    var rows='<table class="dt2"><thead><tr><th>DRIVE</th><th>FREE</th><th>READ</th><th>WRITE</th><th>QUEUE</th></tr></thead><tbody>';
    (ds.drives||[]).forEach(function(d){var fp=d.free_gb/d.size_gb*100;rows+='<tr><td>'+es(d.letter)+(d.label?' <span class="dim">'+es(d.label)+'</span>':'')+'</td><td class="'+(fp<10?'re':fp<20?'am':'')+'">'+(d.free_gb).toFixed(1)+'/'+d.size_gb.toFixed(0)+'G</td><td>'+(d.read_bytes_sec/1048576).toFixed(1)+'</td><td>'+(d.write_bytes_sec/1048576).toFixed(1)+'</td><td>'+(d.queue_depth||0).toFixed(1)+'</td></tr>'});
    rows+='</tbody></table>';sh('dbody',rows);
  }else if(M==='net'){
    var ns=s.network_stats;if(!ns||!ns.adapters||!ns.adapters.length){sh('dbody',en);st('dsec','NETWORK');return}
    st('dsec','NETWORK ADAPTERS');
    var rows2='<table class="dt2"><thead><tr><th>ADAPTER</th><th>STATUS</th><th>SENT</th><th>RECV</th></tr></thead><tbody>';
    ns.adapters.forEach(function(a){var nm=a.name.length>20?a.name.substring(0,19)+'\u2026':a.name;rows2+='<tr><td>'+es(nm)+'</td><td class="'+(a.status==='Up'?'gr':'dim')+'">'+es(a.status)+'</td><td>'+(a.bytes_sent_sec/1048576).toFixed(2)+'</td><td>'+(a.bytes_recv_sec/1048576).toFixed(2)+'</td></tr>'});
    rows2+='</tbody></table>';sh('dbody',rows2);
  }else if(M==='gpu'){
    var gs=s.gpu_stats;if(!gs||!gs.available||!gs.gpus||!gs.gpus.length){sh('dbody',en);st('dsec','GPU');return}
    st('dsec','GPU DETAILS');
    var rows3='<table class="dt2"><thead><tr><th>GPU</th><th>UTIL</th><th>VRAM</th><th>TEMP</th><th>POWER</th></tr></thead><tbody>';
    gs.gpus.forEach(function(g,i){rows3+='<tr><td>'+(g.name||'GPU '+i)+'</td><td>'+(g.gpu_util_percent).toFixed(0)+'%</td><td>'+(g.vram_used_mb/1024).toFixed(1)+'/'+(g.vram_total_mb/1024).toFixed(1)+'G</td><td class="'+(g.temp_celsius>80?'re':g.temp_celsius>70?'am':'')+'">'+(g.temp_celsius||'--')+'\u00b0C</td><td>'+(g.power_watts||'--')+'W</td></tr>'});
    rows3+='</tbody></table>';sh('dbody',rows3);
  }else if(M==='ctx'){
    st('dsec','CONTEXT DETAILS');
    var cx2=s.context||{},fw=cx2.focus_weights||{};
    var h3='<div style="padding:10px 12px"><div class="sl">current context</div><div style="font-size:18px;font-weight:700;color:var(--cyan);margin:4px 0 12px">'+(cx2.current||'unknown').replace(/_/g,' ')+'</div>';
    h3+='<div class="sl" style="margin-bottom:6px">focus weights</div>';
    var fw2=Object.keys(fw).sort(function(a,b){return fw[b]-fw[a]}).slice(0,10);
    fw2.forEach(function(k){var pct=Math.min(100,(fw[k]/300)*100);h3+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:3px"><span style="font-size:10px;color:var(--white);width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+es(k)+'</span><div style="flex:1;height:3px;background:var(--dimmer)"><div style="height:100%;width:'+pct+'%;background:var(--cyan)"></div></div><span style="font-size:9px;color:var(--dim);width:28px;text-align:right">'+fw[k].toFixed(0)+'s</span></div>'});
    h3+='</div></div>';sh('dbody',h3);
  }
}
function renderHdr(s){
  var ld=s.cognitive_load||{},sc=typeof ld.score==='number'?ld.score:0,tr=ld.tier||'green';
  var n=document.getElementById('ln');if(n){n.textContent=sc.toFixed(0);n.className='load-num '+(tr==='green'?'g':tr==='amber'?'a':'r')}
  var cx=s.context||{},cp=document.getElementById('pp-ctx');
  if(cp){cp.textContent='CTX:'+(cx.current||'unknown').replace(/_/g,'-').toUpperCase();cp.className='pill'+(cx.current&&cx.current!=='unknown'?' ctx-active':'')}
  var ws=s.worker_status||'offline',wp=document.getElementById('pp-wrk');
  if(wp){wp.textContent='WORKER:'+ws.toUpperCase();wp.className='pill w-'+(ws==='online'?'online':ws==='restarting'?'restart':'fail')}
  var pp=document.getElementById('pp-prof');if(pp)pp.textContent=(s.active_profile||'--').toUpperCase();
  var wn=s.sniper?s.sniper.active_watches:0,wl=document.getElementById('pp-wat');
  if(wl){wl.textContent=wn+' WATCH'+(wn!==1?'ES':'');wl.className='pill'+(wn>0?' watch-on':'')}
  if(s.isElevated)sv('pp-elv');else hv('pp-elv');
}
function renderNav(s){
  var cpu=s.cpu_percent||0,ram=s.memory_percent||0,prof=s.active_profile||'';
  if(LP!==prof){if(LP!=='')recSW(LP,prof);LP=prof}
  pu('cpu',cpu,prof);pu('ram',ram,prof);
  st('mv-cpu',cpu.toFixed(0)+'%');st('ms-cpu',ip(prof)?'\u26a1 '+prof.toUpperCase():'idle');
  var tot=(s.memory_mb_used+s.memory_mb_available)/1024;
  st('mv-ram',ram.toFixed(0)+'%');st('ms-ram',(s.memory_mb_used/1024).toFixed(1)+' / '+tot.toFixed(0)+' GB');
  if(s.disk_stats&&s.disk_stats.drives&&s.disk_stats.drives.length){
    var rMB=s.disk_stats.drives.reduce(function(m,d){return m+(d.read_bytes_sec||0)},0)/1048576;
    var mq=s.disk_stats.drives.reduce(function(m,d){return Math.max(m,d.queue_depth||0)},0);
    pu('dsk',Math.min(100,mq*10),prof);st('mv-dsk',rMB.toFixed(1)+' MB/s');st('ms-dsk','q:'+mq.toFixed(1));
  }
  if(s.network_stats&&s.network_stats.adapters){
    var up2=s.network_stats.adapters.filter(function(a){return a.status==='Up'});
    var tot2=up2.reduce(function(m,a){return m+(a.bytes_sent_sec+a.bytes_recv_sec)},0)/1048576;
    pu('net',Math.min(100,tot2),prof);st('mv-net',tot2.toFixed(1)+' MB/s');
    st('ms-net',up2.length?up2[0].name.substring(0,14):'offline');
  }
  if(s.gpu_stats&&s.gpu_stats.available&&s.gpu_stats.gpus&&s.gpu_stats.gpus.length){
    var gpu=s.gpu_stats.gpus[0];pu('gpu',gpu.gpu_util_percent,prof);
    st('mv-gpu',gpu.gpu_util_percent.toFixed(0)+'%');st('ms-gpu',(gpu.temp_celsius||0)+'\u00b0C \u00b7 '+(gpu.power_watts||0)+'W');
  }
  st('ms-ctx',(s.context&&s.context.current||'unknown').replace(/_/g,' '));
  if(s.system_extended){var up3=s.system_extended.uptime_sec||0;st('fu',Math.floor(up3/3600)+'h'+Math.floor((up3%3600)/60)+'m')}
}
function renderAlog(s){
  var acts=s.sniper?(s.sniper.recent_actions||[]):[];
  st('ac',acts.length+'');
  if(!acts.length){sh('alog','<div class="ae" style="padding:14px;text-align:center;font-size:10px;color:var(--dim)">sniper watching\u2026</div>');return}
  sh('alog',acts.slice().reverse().map(function(a){
    var ac=(a.action||'').toLowerCase(),cls=ac.indexOf('throttle')>=0?'t':ac.indexOf('suspend')>=0?'s':'k';
    return '<div class="ae '+cls+'"><div class="aet"><span class="aeti">'+(a.timestamp?ag(a.timestamp):'--')+'</span><span class="aep">'+es(a.name)+'</span><span class="aeb '+cls+'">'+ac.replace(/_/g,' ').toUpperCase()+'</span></div><div class="aer">'+es(a.reason||'')+'</div></div>';
  }).join(''));
}
function renderConf(s){
  var c=s.confidence||{},sc=typeof c.score==='number'?c.score:0,pct=(sc*100).toFixed(0);
  var e=document.getElementById('cbf');if(e)e.style.width=pct+'%';
  st('cpct',pct+'%');
  if(c.auto_mode_unlocked)st('ci','\u25cf auto \u00b7 '+(c.total_decisions||0)+' decisions');
  else st('ci',(c.total_decisions||0)+' \u00b7 '+(c.decisions_until_auto?c.decisions_until_auto+' to auto':'calibrating'));
}
function renderFtr(s){
  st('fv',s.version?'AEGIS '+s.version:'AEGIS v3.0.0');
  var w=s.sniper?s.sniper.active_watches:0;st('fw',w.toString());
  var d=document.getElementById('fd');if(d)d.className='fd '+(s.worker_status==='online'?'g':'r');
  st('ft','updated just now');
}
function render(s){renderHdr(s);renderNav(s);updDH();updDS();updDB();renderAlog(s);renderConf(s);renderFtr(s);rg()}
function poll(){fetch('/status').then(function(r){return r.json()}).then(function(s){SNAP=s;hv('ob');render(s)}).catch(function(){sv('ob')})}
window.sel=sel;
window.openPM=function(){
  var m=document.getElementById('piw'),i=document.getElementById('pi');
  if(m)m.classList.add('open');
  if(i){var h=document.getElementById('ph');if(SNAP&&h)h.textContent='current: '+(SNAP.active_profile||'--');i.value='';setTimeout(function(){i.focus()},50)}
};
window.closePM=function(e){
  if(e&&e.target!==document.getElementById('piw'))return;
  var m=document.getElementById('piw');if(m)m.classList.remove('open');
};
window.piKey=function(e){if(e.key==='Enter')window.doSwitch();if(e.key==='Escape')window.closePM()};
window.doSwitch=function(){
  var i=document.getElementById('pi');if(!i||!i.value.trim())return;
  fetch('/switch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:i.value.trim()})})
    .then(function(){window.closePM();setTimeout(poll,300)})
    .catch(function(){var h=document.getElementById('ph');if(h)h.textContent='\u26a0 failed'});
};
setInterval(function(){SPI=(SPI+1)%4;st('spin',SPIN[SPI])},700);
setInterval(poll,2000);
window.addEventListener('resize',rg);
poll();
})();
</script>
</body>
</html>`;
}
