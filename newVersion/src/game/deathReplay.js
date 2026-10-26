/**
 * Последние 5 секунд игры на экране смерти, по кругу.
 * В буфер попадает уменьшенная копия холста несколько раз в секунду,
 * без чтения пикселей обратно в процессор.
 */
(function (global) {
  "use strict";

  var SPAN_MS = 5000;
  var view = null;
  var viewCtx = null;
  var buffer = [];
  var maxFrames = 40;
  var stepMs = 125;
  var maxW = 280;
  var maxH = 180;
  var lastCapture = 0;
  var playing = false;
  var playStart = 0;
  var playTimer = 0;
  var lastIndex = -1;
  var captureTimer = 0;
  var viewW = 0;
  var viewH = 0;

  function tier() {
    var profile = global.__clientProfile && global.__clientProfile.profile;
    return profile && profile.tier;
  }

  function applyTier() {
    if (tier() === "low") {
      stepMs = 200;
      maxW = 200;
      maxH = 120;
    } else {
      stepMs = 125;
      maxW = 280;
      maxH = 180;
    }
    maxFrames = Math.max(8, Math.round(SPAN_MS / stepMs));
    while (buffer.length > maxFrames) buffer.shift();
  }

  function alive() {
    var S = global.__gameState;
    return !!(S && S.playerCells && S.playerCells.length);
  }

  function staticsOpen() {
    var el = document.getElementById("statics");
    if (!el) return false;
    return el.style.display !== "none" && getComputedStyle(el).display !== "none";
  }

  function capture() {
    if (playing || document.hidden || staticsOpen() || !alive()) return;
    var now = performance.now();
    if (now - lastCapture < stepMs) return;
    var src = document.getElementById("canvas");
    if (!src || src.width < 2 || src.height < 2) return;
    lastCapture = now;
    var scale = Math.min(maxW / src.width, maxH / src.height, 1);
    var dw = Math.max(2, (src.width * scale) | 0);
    var dh = Math.max(2, (src.height * scale) | 0);
    var frame = buffer.length >= maxFrames ? buffer.shift() : document.createElement("canvas");
    if (frame.width !== dw || frame.height !== dh) {
      frame.width = dw;
      frame.height = dh;
    }
    var ctx = frame.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.drawImage(src, 0, 0, dw, dh);
    buffer.push(frame);
  }

  function drawFrame(frame) {
    if (!view || !viewCtx || !frame) return;
    var rect = view.getBoundingClientRect();
    var dpr = Math.min(global.devicePixelRatio || 1, tier() === "low" ? 1 : 1.5);
    var w = Math.max(2, Math.round((rect.width || 300) * dpr));
    var h = Math.max(2, Math.round((rect.height || 250) * dpr));
    if (w !== viewW || h !== viewH) {
      view.width = w;
      view.height = h;
      viewW = w;
      viewH = h;
    }
    var ir = frame.width / frame.height;
    var box = w / h;
    var dw;
    var dh;
    var dx;
    var dy;
    if (ir > box) {
      dw = w;
      dh = w / ir;
      dx = 0;
      dy = (h - dh) / 2;
    } else {
      dh = h;
      dw = h * ir;
      dx = (w - dw) / 2;
      dy = 0;
    }
    viewCtx.fillStyle = "#070c16";
    viewCtx.fillRect(0, 0, w, h);
    viewCtx.drawImage(frame, dx, dy, dw, dh);
  }

  function tick() {
    if (!playing || !buffer.length) return;
    var span = Math.max(stepMs, buffer.length * stepMs);
    var index = Math.floor(((performance.now() - playStart) % span) / stepMs);
    if (index >= buffer.length) index = buffer.length - 1;
    if (index === lastIndex) return;
    lastIndex = index;
    drawFrame(buffer[index]);
  }

  function startPlay() {
    if (!view) return;
    if (!buffer.length) {
      view.classList.remove("is-on");
      return;
    }
    view.classList.add("is-on");
    if (playing) return;
    playing = true;
    lastIndex = -1;
    playStart = performance.now();
    tick();
    playTimer = global.setInterval(tick, 40);
  }

  function stopPlay() {
    playing = false;
    lastIndex = -1;
    if (playTimer) {
      global.clearInterval(playTimer);
      playTimer = 0;
    }
    if (view) view.classList.remove("is-on");
    buffer.length = 0;
    lastCapture = 0;
  }

  function sync() {
    if (staticsOpen()) startPlay();
    else if (playing) stopPlay();
  }

  function boot() {
    view = document.getElementById("deathReplay");
    if (!view) return;
    viewCtx = view.getContext("2d", { alpha: false });
    applyTier();
    var statics = document.getElementById("statics");
    if (statics && global.MutationObserver) {
      new MutationObserver(sync).observe(statics, {
        attributes: true,
        attributeFilter: ["style", "class", "hidden"]
      });
    }
    global.addEventListener("resize", function () {
      viewW = 0;
    });
    captureTimer = global.setInterval(capture, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
