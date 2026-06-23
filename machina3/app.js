/* Machina Collective v3 — vanilla port of the design prototype.
   Dark editorial index-sheet: negative-lens home wordmark, rolling collective
   list, fullscreen member deck + video player, blend-mode-inverted chrome.

   Ported from the React/Babel prototype to dependency-free DOM so it ships as a
   static site (no build step, no in-browser transpile). The final design tweaks
   are baked in as constants below. */
(function () {
  "use strict";

  var M3 = window.MACHINA2;

  /* baked-in final design choices (were live "Tweaks" in the prototype) */
  var CONFIG = {
    logoFx: "Negative",   // home wordmark: "Negative" lens | "Glass"
    markPos: "Left",      // corner wordmark: "Left" | "Center"
    listStyle: "Caps",    // collective names: "Caps" | "Editorial"
    grain: true,          // film-grain overlay
    accent: "#EFC964",
    videoUrl: ""          // empty = bundled machina-loop.mp4
  };

  /* no standalone-blob indirection in the static build — always use the path */
  function R(_id, fallback) { return fallback; }
  // direct-file Bunny CDN (used for the machina-loop fallback only)
  var CDN = "https://machina-collective.b-cdn.net/";
  // Bunny Stream playback host — adaptive HLS, auto-compressed/transcoded
  var STREAM = "https://vz-d7ddf2a7-c8e.b-cdn.net/";
  function hls(guid) { return STREAM + guid + "/playlist.m3u8"; }
  // home-page background film (and the negative-lens copy) — Stream HLS
  var HOME_FILM = function () { return CONFIG.videoUrl || hls("cfd167a6-a16e-42cc-95db-cc6e73418044"); };
  // generic fallback film used by the deck/player when an item has no video of its own
  var FILM = function () { return CONFIG.videoUrl || CDN + "machina-loop.mp4"; };
  var HERO = "/machina2/img/hero-frame.png";
  var LOGO = "/machina2/img/machina-logo-solid.png";

  /* Attach a media URL to a <video>. HLS (.m3u8) plays natively in Safari, and
     via hls.js everywhere else. Plain files set src directly. Returns a teardown
     fn that stops all loading (so the deck can keep only the active film live). */
  function isHls(url) { return /\.m3u8(\?|$)/i.test(url || ""); }
  function setMediaSrc(video, url) {
    teardownMedia(video);
    // Prefer hls.js wherever it's supported (Chrome, Firefox, Edge). Fall back to
    // the browser's native HLS (Safari) or a direct file. Checking hls.js first
    // matters: Chrome reports a misleading "maybe" for canPlayType(HLS) but can't
    // actually play a raw .m3u8, so native must NOT win there.
    if (isHls(url) && window.Hls && window.Hls.isSupported()) {
      // Start at the highest rendition (a high bandwidth estimate biases auto-ABR
      // upward, and we force the top level on the first fragment). ABR can still
      // step down if a viewer's connection genuinely can't sustain it — but the
      // default is full quality, not the lowest rung.
      var h = new window.Hls({ enableWorker: true, maxBufferLength: 30, abrEwmaDefaultEstimate: 12000000 });
      h.on(window.Hls.Events.MANIFEST_PARSED, function () {
        try { h.startLevel = h.levels.length - 1; h.nextLevel = h.levels.length - 1; } catch (e) {}
      });
      h.loadSource(url);
      h.attachMedia(video);
      video._hls = h;
    } else {
      video.src = url;
    }
  }
  function teardownMedia(video) {
    if (video._hls) { try { video._hls.destroy(); } catch (e) {} video._hls = null; }
    try { video.removeAttribute("src"); video.load(); } catch (e) {}
  }

  var THUMBS = {
    mauricio: R("thumbMauricio", "/machina2/img/nothing-special.jpg"),
    olga: R("thumbOlga", "/machina2/img/olga-vivatech-8.png"),
    ghibli: R("thumbGhibli", "/machina2/img/cube.png")
  };

  function firstSentence(s) {
    var m = s.match(/^.*?[.!?](\s|$)/);
    return m ? m[0].trim() : s;
  }

  /* rAF with setTimeout fallback (the animation clock stalls in throttled/
     backgrounded tabs; the timeout guarantees the loop still advances). */
  function tick2(cb) {
    var done = false;
    var raf = requestAnimationFrame(function () { if (!done) { done = true; clearTimeout(to); cb(); } });
    var to = setTimeout(function () { if (!done) { done = true; cancelAnimationFrame(raf); cb(); } }, 50);
    return function () { done = true; cancelAnimationFrame(raf); clearTimeout(to); };
  }

  /* tiny DOM helper: el(tag, props, ...children) */
  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
        var v = props[k];
        if (v == null) continue;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k === "style" && typeof v === "object") { for (var s in v) node.style[s] = v[s]; }
        else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) { c.forEach(function (cc) { if (cc != null) node.appendChild(typeof cc === "string" ? document.createTextNode(cc) : cc); }); }
      else node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }
  // Set inline-SVG markup on an HTML element. Assigning innerHTML lets the
  // HTML parser create the SVG in the correct namespace — more reliable across
  // browsers than DOMParser + importNode for getting the icon to actually paint.
  function setSvg(node, markup) { node.innerHTML = markup; return node; }

  var ICON = {
    play: "<svg width='12' height='14' viewBox='0 0 12 14'><polygon points='0,0 12,7 0,14' fill='currentColor'/></svg>",
    pause: "<svg width='11' height='14' viewBox='0 0 11 14'><rect x='0' y='0' width='3.4' height='14' fill='currentColor'/><rect x='7.6' y='0' width='3.4' height='14' fill='currentColor'/></svg>",
    vol: "<svg width='42' height='13' viewBox='0 0 42 13'><polygon points='0,13 42,0 42,13' fill='currentColor'/></svg>",
    close: "<svg width='15' height='15' viewBox='0 0 15 15'><line x1='1' y1='1' x2='14' y2='14' stroke='currentColor' stroke-width='1.4'/><line x1='14' y1='1' x2='1' y2='14' stroke='currentColor' stroke-width='1.4'/></svg>",
    deckPlay: "<svg width='16' height='19' viewBox='0 0 16 19'><polygon points='0,0 16,9.5 0,19' fill='currentColor'/></svg>",
    cue: "<svg width='10' height='7' viewBox='0 0 10 7' fill='none'><path d='M1 1 L5 5 L9 1' stroke='currentColor' stroke-width='1'/></svg>"
  };

  /* every page returns { node, destroy } so route changes can tear down
     listeners / rAF loops cleanly. */

  /* ── rolling collective name list ─────────────────────────────── */
  function NameRoll(items, opts) {
    var n = items.length;
    var root = el("div", { class: "ri" + (opts.editorial ? " editorial" : ""), tabindex: "0", role: "listbox", "aria-label": "collective" });

    var st = { off: 0, target: 0, raf: 0, snapT: 0, drag: null, suppress: false };
    var lastFocus = -1;
    var itemH = Math.max(44, Math.round(window.innerHeight * 0.066));

    var rows = items.map(function (it, i) {
      var eyebrow = el("span", { class: "eyebrow", text: it.role });
      var label = el("span", { class: "ri-label", style: { fontSize: "clamp(18px, 3.1vh, 42px)" }, text: it.name });
      var row = el("div", { class: "ri-row" }, eyebrow, label);
      row.addEventListener("click", function () {
        if (st.suppress) { st.suppress = false; return; }
        var focused = clampIdx(Math.round(st.off));
        if (i === focused) opts.onSelect(it, i);
        else { st.target = i; kick(); }
      });
      // hover a name → preview that artist's reel in the background
      row.addEventListener("mouseenter", function () { if (opts.onHover) opts.onHover(i); });
      root.appendChild(row);
      return { row: row, eyebrow: eyebrow, label: label };
    });
    // leaving the list returns the background to the focused artist
    root.addEventListener("mouseleave", function () { if (opts.onHover) opts.onHover(null); });

    function clampIdx(v) { return Math.min(n - 1, Math.max(0, v)); }

    function layout() {
      var off = st.off;
      var focused = clampIdx(Math.round(off));
      for (var i = 0; i < n; i++) {
        var d = i - off;
        var ad = Math.abs(d);
        var scale = Math.max(0.55, 1 - 0.28 * ad);
        var op = Math.max(0.16, 1 - 0.42 * ad);
        var isF = i === focused && ad < 0.5;
        var r = rows[i];
        r.row.style.transform = "translateY(calc(" + (d * itemH).toFixed(1) + "px - 50%)) scale(" + scale.toFixed(3) + ")";
        r.row.style.opacity = op.toFixed(3);
        r.row.classList.toggle("is-f", isF);
        r.eyebrow.style.opacity = isF ? "1" : "0.45";
      }
      if (focused !== lastFocus) { lastFocus = focused; if (opts.onFocus) opts.onFocus(focused); }
    }

    function kick() {
      if (st.raf) return;
      var step = function () {
        var d = st.target - st.off;
        if (Math.abs(d) < 0.001) { st.off = st.target; st.raf = 0; layout(); return; }
        st.off += d * 0.14;
        layout();
        st.raf = tick2(step);
      };
      st.raf = tick2(step);
    }

    var onWheel = function (e) {
      e.preventDefault(); e.stopPropagation();
      st.target = clampIdx(st.target + e.deltaY * 0.0026);
      clearTimeout(st.snapT);
      st.snapT = setTimeout(function () { st.target = Math.round(st.target); kick(); }, 150);
      kick();
    };
    var onDown = function (e) { st.drag = { y: e.clientY, t0: st.target, moved: false, pid: e.pointerId }; };
    var onMove = function (e) {
      if (!st.drag) return;
      var dy = e.clientY - st.drag.y;
      if (!st.drag.moved && Math.abs(dy) > 4) {
        st.drag.moved = true;
        try { root.setPointerCapture(st.drag.pid); } catch (err) {}
      }
      if (st.drag.moved) {
        st.target = clampIdx(st.drag.t0 - dy / (window.innerHeight * 0.066));
        kick();
      }
    };
    var onUp = function () {
      if (!st.drag) return;
      st.suppress = st.drag.moved;
      if (st.drag.moved) { try { root.releasePointerCapture(st.drag.pid); } catch (err) {} }
      st.drag = null;
      st.target = Math.round(st.target);
      kick();
    };
    var onKey = function (e) {
      if (e.key === "ArrowDown") { st.target = Math.min(n - 1, Math.round(st.target) + 1); kick(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { st.target = Math.max(0, Math.round(st.target) - 1); kick(); e.preventDefault(); }
      else if (e.key === "Enter") { opts.onSelect(items[clampIdx(Math.round(st.off))]); }
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("keydown", onKey);

    layout();

    return {
      node: root,
      destroy: function () {
        clearTimeout(st.snapT);
        if (st.raf) { st.raf(); st.raf = 0; }
      }
    };
  }

  // a member's background "reel" = an explicit `reel` if set, else their first film
  function memberReel(m) { return m.reel || (m.gallery && m.gallery[0] && m.gallery[0].video); }

  /* ── collective: the active artist's reel plays dimmed behind the names
     (falls back to a still for artists with no film). Only the active reel
     streams; others pause. ── */
  function RollBg(members) {
    var root = el("div", { class: "roll-bg" });
    var ON = 1;  // active reel at full brightness (un-shadowed); the blend-mode
                 // names invert against it (dark over light frames, light over dark)
    var ops = members.map(function (_, i) { return i === 0 ? ON : 0; });
    var layers = members.map(function (m, i) {
      var reel = memberReel(m), node;
      if (reel) { node = el("video", { muted: "", loop: "", playsinline: "", preload: "none" }); node.muted = true; node.defaultMuted = true; node.volume = 0; }
      else { node = el("img", { src: THUMBS[m.id], alt: "" }); }
      node.style.opacity = ops[i].toFixed(3);
      root.appendChild(node);
      return { node: node, reel: reel, attached: false };
    });
    var idx = -1, cancel = 0;
    function fade() {
      if (cancel) return;
      var step = function () {
        var busy = false;
        ops = ops.map(function (o, i) {
          var t = i === idx ? ON : 0, d = t - o;
          if (Math.abs(d) < 0.005) return t;
          busy = true; return o + d * 0.12;
        });
        ops.forEach(function (o, i) { layers[i].node.style.opacity = o.toFixed(3); });
        cancel = busy ? tick2(step) : 0;
      };
      cancel = tick2(step);
    }
    function setIdx(i) {
      if (i === idx) return;
      idx = i;
      layers.forEach(function (L, j) {
        if (!L.reel) return;
        if (j === idx) { if (!L.attached) { setMediaSrc(L.node, L.reel); L.attached = true; } var p = L.node.play(); if (p && p.catch) p.catch(function () {}); }
        else { try { L.node.pause(); } catch (e) {} }
      });
      fade();
    }
    setIdx(0);
    return {
      node: root,
      setIdx: setIdx,
      destroy: function () { if (cancel) cancel(); layers.forEach(function (L) { if (L.reel) teardownMedia(L.node); }); }
    };
  }

  function CollectivePage() {
    var members = M3.members;
    var page = el("div", { class: "page", "data-screen-label": "Collective" });
    var bg = RollBg(members);
    var focusedIdx = 0, hoverIdx = null;
    function applyBg() { bg.setIdx(hoverIdx != null ? hoverIdx : focusedIdx); }
    var roll = NameRoll(members, {
      editorial: CONFIG.listStyle === "Editorial",
      onFocus: function (i) { focusedIdx = i; applyBg(); },
      onHover: function (i) { hoverIdx = i; applyBg(); },
      onSelect: function (it) { go("/collective/" + (it.slug || it.id)); }
    });
    page.appendChild(bg.node);
    page.appendChild(roll.node);
    setTimeout(function () { try { roll.node.focus({ preventScroll: true }); } catch (e) {} }, 0);
    return { node: page, destroy: function () { bg.destroy(); roll.destroy(); } };
  }

  /* ── home: film loop + negative-lens wordmark + tagline ───────── */
  function GlassLogo() {
    var wrap = el("div", { class: "lc-wrap" + (CONFIG.logoFx === "Negative" ? " fx-negative" : "") });
    wrap.appendChild(el("img", { class: "logo-sizer", src: LOGO, alt: "MACHINA" }));
    wrap.appendChild(el("div", { class: "logo-glass" }));
    wrap.appendChild(el("div", { class: "logo-glass-sheen" }));
    return wrap;
  }

  function mkFilmVideo() {
    // No poster: it would briefly show a still from the old film before the
    // new video decodes. With no poster the black .home-video backdrop shows
    // instead (and the white baseline logo for the lens), so there's no flash.
    var v = el("video", { autoplay: "", muted: "", loop: "", playsinline: "", preload: "auto" });
    v.muted = true; v.defaultMuted = true;
    setMediaSrc(v, HOME_FILM());
    return v;
  }

  function HomePage() {
    var page = el("div", { class: "page", "data-screen-label": "Home — Film" });
    var video = mkFilmVideo();
    page.appendChild(el("div", { class: "home-video" }, video));
    page.appendChild(el("div", { class: "logo-center" }, GlassLogo()));

    // Negative lens: a second copy of the film clipped to the wordmark shape,
    // run through invert+grayscale (see .logo-neg-lens in the CSS). Sits over
    // the white baseline logo so the letters fill with real negative footage.
    var videos = [video];
    if (CONFIG.logoFx === "Negative") {
      var lensVid = mkFilmVideo();
      page.appendChild(el("div", { class: "logo-neg-lens" }, lensVid));
      videos.push(lensVid);
    }

    // robust muted autoplay: browsers gate autoplay until a gesture / load event
    var done = false, iv, to;
    var mediaEvents = ["loadeddata", "canplay", "canplaythrough"];
    var userEvents = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"];
    function tryPlay() {
      if (done) return;
      var allPlaying = true;
      videos.forEach(function (v) {
        v.muted = true; v.volume = 0;
        if (v.paused) { allPlaying = false; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      });
      if (allPlaying) { done = true; cleanup(); }
    }
    function cleanup() {
      videos.forEach(function (v) { mediaEvents.forEach(function (ev) { v.removeEventListener(ev, tryPlay); }); });
      userEvents.forEach(function (ev) { window.removeEventListener(ev, tryPlay); });
      clearInterval(iv);
    }
    videos.forEach(function (v) { mediaEvents.forEach(function (ev) { v.addEventListener(ev, tryPlay); }); });
    userEvents.forEach(function (ev) { window.addEventListener(ev, tryPlay, { passive: true }); });
    iv = setInterval(tryPlay, 700);
    to = setTimeout(function () { clearInterval(iv); }, 9000);
    tryPlay();

    return { node: page, destroy: function () { done = true; cleanup(); clearTimeout(to); videos.forEach(teardownMedia); } };
  }

  /* ── fullscreen video player (click a deck item) ──────────────── */
  function vpPct(p) { return (Math.max(0, Math.min(1, p)) * 100).toFixed(3) + "%"; }

  function VideoPlayer(src, poster, onClose) {
    var root = el("div", { class: "vplayer", role: "dialog", "aria-label": "Video player" });

    var mark = el("a", { class: "vplayer-mark", href: "/" }, el("img", { src: LOGO, alt: "MACHINA" }));
    mark.addEventListener("click", function (e) { e.preventDefault(); onClose(); });

    var video = el("video", { playsinline: "" });
    if (poster) video.setAttribute("poster", poster);
    setMediaSrc(video, src);

    var playBtn = el("button", { class: "vp-btn", "aria-label": "Pause" });
    var volBtn = setSvg(el("button", { class: "vp-btn vp-vol", "aria-label": "Mute" }), ICON.vol);
    var closeBtn = setSvg(el("button", { class: "vp-btn vp-close", "aria-label": "Close" }), ICON.close);

    var fill = el("div", { class: "vp-fill" });
    var head = el("div", { class: "vp-head" });
    var track = el("div", { class: "vp-track" }, fill, head);

    var controls = el("div", { class: "vp-controls" }, playBtn, el("div", { class: "vp-right" }, volBtn, closeBtn));
    root.appendChild(mark);
    root.appendChild(video);
    root.appendChild(el("div", { class: "vplayer-bar" }, controls, track));

    function setPlayIcon(playing) {
      playBtn.innerHTML = playing ? ICON.pause : ICON.play;
      playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    }
    function setMuteIcon(muted) {
      volBtn.classList.toggle("off", muted);
      volBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    }
    setPlayIcon(true);
    setMuteIcon(false);

    document.body.classList.add("vplayer-open");

    function togglePlay() { if (video.paused) video.play(); else video.pause(); }
    playBtn.addEventListener("click", togglePlay);
    video.addEventListener("click", togglePlay);
    volBtn.addEventListener("click", function () {
      video.muted = !video.muted;
      if (!video.muted && video.volume === 0) video.volume = 1;
      setMuteIcon(video.muted);
    });
    closeBtn.addEventListener("click", onClose);
    track.addEventListener("click", function (e) {
      var r = track.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      if (video.duration) video.currentTime = Math.max(0, Math.min(1, x)) * video.duration;
    });

    var onTime = function () { if (video.duration) { var p = vpPct(video.currentTime / video.duration); fill.style.width = p; head.style.left = p; } };
    var onPlay = function () { setPlayIcon(true); };
    var onPause = function () { setPlayIcon(false); };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    var onKey = function (e) {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "m" || e.key === "M") { video.muted = !video.muted; setMuteIcon(video.muted); }
    };
    window.addEventListener("keydown", onKey);

    // restart from 0, with sound; fall back to muted if autoplay-with-sound is blocked
    try { video.currentTime = 0; } catch (e) {}
    video.muted = false; video.volume = 1; setMuteIcon(false);
    var pr = video.play();
    if (pr && pr.catch) pr.catch(function () { video.muted = true; setMuteIcon(true); var q = video.play(); if (q && q.catch) q.catch(function () {}); });

    return {
      node: root,
      destroy: function () {
        video.removeEventListener("timeupdate", onTime);
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        window.removeEventListener("keydown", onKey);
        try { video.pause(); } catch (e) {}
        teardownMedia(video);
        document.body.classList.remove("vplayer-open");
      }
    };
  }

  /* ── member page: swipe-up entrance, fullscreen deck, bio ─────── */
  function MemberPage(member) {
    var page = el("div", { class: "page page-member", "data-screen-label": "Member — " + member.name });
    var items = member.gallery;

    /* deck — consecutive stills of the same project collapse into one swipeable
       gallery (so e.g. three Chanel stills read as one set, not three repeats). */
    var deck = el("div", { class: "member-deck" });
    var blocks = [];
    items.forEach(function (g) {
      var last = blocks[blocks.length - 1];
      var isStill = !g.video && !!g.src;
      if (isStill && last && last.kind === "gallery" && last.project === (g.project || "")) {
        last.stills.push(g);
      } else if (isStill) {
        blocks.push({ kind: "gallery", project: g.project || "", item: g, stills: [g] });
      } else {
        blocks.push({ kind: "single", item: g });
      }
    });

    var deckVideos = [];   // index-aligned with blocks; {el, url, attached} or null
    blocks.forEach(function (b, i) {
      var g = b.item;
      var isGallery = b.kind === "gallery" && b.stills.length > 1;
      var playable = !!g.video;  // only films open the player; stills are just shown
      var sec = el("section", { class: "deck-media" + (playable ? " is-playable" : "") + (isGallery ? " is-gallery" : ""), "data-i": String(i) });
      var entry = null;
      if (g.video) {
        // The source is attached only when this film becomes the active one
        // (see paintActive), and torn down when it leaves — so a deck of films
        // never streams more than the one in view. No poster: the black page
        // shows until the film decodes, then it fades in (no old-frame flash).
        var v = el("video", { muted: "", loop: "", playsinline: "", preload: "none" });
        v.muted = true; v.defaultMuted = true; v.volume = 0;
        if (g.fit) v.classList.add("fit-" + g.fit);
        entry = { el: v, url: g.video, attached: false };
        sec.appendChild(v);
      } else if (isGallery) {
        // horizontal swipe-through of the stills, with dot indicators
        var strip = el("div", { class: "still-strip" }, b.stills.map(function (s) {
          return el("div", { class: "still-slide" }, el("img", { src: s.src, alt: "" }));
        }));
        var dots = el("div", { class: "still-dots" }, b.stills.map(function (_, di) {
          var dot = el("span", { class: "still-dot" + (di === 0 ? " on" : "") });
          dot.addEventListener("click", function () {
            strip.scrollTo({ left: di * strip.clientWidth, behavior: "smooth" });
          });
          return dot;
        }));
        strip.addEventListener("scroll", function () {
          var di = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
          Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle("on", k === di); });
        }, { passive: true });
        sec.appendChild(strip);
        sec.appendChild(dots);
      } else if (g.src) {
        sec.appendChild(el("img", { src: g.src, alt: "" }));
      } else {
        var slot = document.createElement("image-slot");
        slot.setAttribute("id", g.slot);
        slot.setAttribute("shape", "rect");
        slot.setAttribute("placeholder", "Drop a project film / still");
        sec.appendChild(slot);
      }
      sec.appendChild(el("div", { class: "media-shade" }));
      if (playable) {
        var pa = setSvg(el("div", { class: "deck-play", "aria-hidden": "true" }), ICON.deckPlay);
        sec.appendChild(pa);
        sec.addEventListener("click", function () { openPlayer({ src: g.video || FILM() }); });
      }
      deckVideos.push(entry);
      deck.appendChild(sec);
    });

    /* bio (the final scroll-snap section); the artist's round portrait sits at
       the top of the bio, on the same screen. */
    var bioParas = member.bio.map(function (p) { return el("p", { text: p }); });
    if (member.site && member.site.url) {
      bioParas.push(el("a", {
        class: "bio-link", href: member.site.url, target: "_blank", rel: "noreferrer",
        text: member.site.label || member.site.url
      }));
    }
    var bioInner = el("div", { class: "bio-inner" },
      el("div", { class: "eyebrow", text: member.role }),
      el("h1", { class: "member-name", text: member.name }),
      el("div", { class: "member-bio" }, bioParas)
    );
    if (member.portrait) {
      bioInner.insertBefore(el("img", { class: "bio-portrait", src: member.portrait, alt: member.name }), bioInner.firstChild);
    }
    deck.appendChild(el("section", { class: "deck-bio", "data-i": String(blocks.length) }, bioInner));

    /* overlays */
    var projLbl = el("span", { class: "lbl" });
    var projName = el("span", {});
    var projYear = el("span", { class: "muted" });
    var projBlk = el("div", { class: "blk" }, projLbl, projName, projYear);
    var projWrap = el("div", { class: "proj-name" }, projBlk);

    var artistName = el("div", { class: "artist-name-bl", text: member.name });

    var cue = setSvg(el("div", { class: "deck-cue", "aria-hidden": "true" }), ICON.cue);

    page.appendChild(deck);
    page.appendChild(projWrap);
    page.appendChild(artistName);
    page.appendChild(cue);

    function paintActive(active) {
      var onBio = active >= blocks.length;
      projWrap.classList.toggle("hide", onBio);
      artistName.classList.toggle("hide", onBio);
      cue.classList.toggle("gone", active > 0 || blocks.length === 0);
      if (!onBio) {
        var proj = blocks[active].item;
        projLbl.textContent = proj.type || "";
        projName.textContent = proj.project || "";
        if (proj.year) { projYear.textContent = proj.year; projYear.style.display = ""; }
        else { projYear.textContent = ""; projYear.style.display = "none"; }
      }
      // Stream only the film in view: attach + play the active one, and fully
      // tear down the rest (stops HLS segment loading) so a deck of films never
      // streams more than one at a time.
      for (var vi = 0; vi < deckVideos.length; vi++) {
        var dv = deckVideos[vi];
        if (!dv) continue;
        if (vi === active) {
          if (!dv.attached) { setMediaSrc(dv.el, dv.url); dv.attached = true; }
          var pp = dv.el.play(); if (pp && pp.catch) pp.catch(function () {});
        } else if (dv.attached) {
          try { dv.el.pause(); } catch (e) {}
          teardownMedia(dv.el);
          dv.attached = false;
        }
      }
    }
    paintActive(0);

    deck.addEventListener("scroll", function () {
      var i = Math.round(deck.scrollTop / Math.max(1, deck.clientHeight));
      paintActive(Math.min(blocks.length, Math.max(0, i)));
    });

    /* fullscreen player */
    var player = null;
    function openPlayer(info) {
      if (player) return;
      player = VideoPlayer(info.src, info.poster, closePlayer);
      document.body.appendChild(player.node);
    }
    function closePlayer() {
      if (!player) return;
      player.destroy();
      if (player.node.parentNode) player.node.parentNode.removeChild(player.node);
      player = null;
    }

    /* JS-driven swipe-up entrance (tick2 so it completes even when the CSS
       animation clock is throttled). */
    var cancel = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      page.style.transform = "translateY(0)";
    } else {
      var y = 100;
      page.style.transform = "translateY(100%)";
      var step = function () {
        y += (0 - y) * 0.16;
        if (Math.abs(y) < 0.4) { page.style.transform = "translateY(0)"; cancel = 0; return; }
        page.style.transform = "translateY(" + y.toFixed(2) + "%)";
        cancel = tick2(step);
      };
      cancel = tick2(step);
    }

    return {
      node: page,
      destroy: function () {
        if (cancel) cancel();
        closePlayer();
        deckVideos.forEach(function (dv) { if (dv) teardownMedia(dv.el); });
      }
    };
  }

  /* ── about ────────────────────────────────────────────────────── */
  function buildAboutWrap() {
    var a = M3.about;
    var wrap = el("div", { class: "about-wrap" });
    var paras = Array.isArray(a.statement) ? a.statement : [a.statement];
    paras.forEach(function (p) { wrap.appendChild(el("p", { class: "about-statement", text: p })); });
    a.rows.forEach(function (row) {
      wrap.appendChild(el("div", { class: "about-row" },
        el("span", { class: "label", text: row.label }),
        el("ul", {}, row.items.map(function (it) { return el("li", { text: it }); }))
      ));
    });
    if (a.contact) {
      wrap.appendChild(el("div", { class: "about-row" },
        el("span", { class: "label", text: "CONTACT" }),
        el("ul", {}, [el("li", {}, el("a", { class: "about-contact", href: "mailto:" + a.contact, text: a.contact }))])
      ));
    }
    return wrap;
  }
  function AboutPage() {
    return { node: el("div", { class: "page", "data-screen-label": "About" }, buildAboutWrap()), destroy: function () {} };
  }

  /* ── The Lab: overview of visual-exploration series ───────────── */
  function LabPage() {
    var page = el("div", { class: "page page-lab", "data-screen-label": "The Lab" });
    var wrap = el("div", { class: "lab-wrap" });
    var series = M3.lab || [];
    if (!series.length) {
      wrap.appendChild(el("div", { class: "lab-empty", text: "First series coming soon." }));
    } else {
      var grid = el("div", { class: "lab-grid" });
      series.forEach(function (s, i) {
        var num = ("0" + (i + 1)).slice(-2);
        var media = el("div", { class: "lab-tile-media" });
        if (s.cover) media.appendChild(el("img", { src: s.cover, alt: s.title || "", loading: "lazy" }));
        grid.appendChild(el("a", { class: "lab-tile", href: "/lab/" + s.id, "aria-label": s.title || ("Series " + num) }, media));
      });
      wrap.appendChild(grid);
    }
    page.appendChild(wrap);
    return { node: page, destroy: function () {} };
  }

  /* ── The Lab: a single series — one big still, arrows + swipe ──── */
  function LabSeries(s) {
    var stills = s.stills || [];
    var idx = 0;
    var page = el("div", { class: "page page-labseries", "data-screen-label": "The Lab — " + (s.title || "") });

    var img = el("img", { class: "labv-img", alt: s.title || "" });
    var stage = el("div", { class: "labv-stage" }, img);
    var counter = el("div", { class: "labv-counter" });
    var prev = el("button", { class: "labv-arrow labv-prev", type: "button", "aria-label": "Previous" }, "‹");
    var next = el("button", { class: "labv-arrow labv-next", type: "button", "aria-label": "Next" }, "›");

    function show(i) {
      if (!stills.length) return;
      idx = (i + stills.length) % stills.length;
      img.src = stills[idx];
      counter.textContent = ("0" + (idx + 1)).slice(-2) + " / " + ("0" + stills.length).slice(-2);
    }
    prev.addEventListener("click", function () { show(idx - 1); });
    next.addEventListener("click", function () { show(idx + 1); });
    function onKey(e) { if (e.key === "ArrowLeft") show(idx - 1); else if (e.key === "ArrowRight") show(idx + 1); }
    window.addEventListener("keydown", onKey);
    var sx = null;
    stage.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
      sx = null;
    }, { passive: true });

    page.appendChild(stage);
    page.appendChild(el("a", { class: "labv-back", href: "/lab" }, "← The Lab"));
    page.appendChild(counter);
    if (stills.length > 1) { page.appendChild(prev); page.appendChild(next); }
    show(0);
    return { node: page, destroy: function () { window.removeEventListener("keydown", onKey); } };
  }

  /* muted-autoplay helper (browsers gate autoplay until a gesture/load event) */
  function autoplayMuted(videos) {
    var done = false, iv, to;
    var mediaEvents = ["loadeddata", "canplay", "canplaythrough"];
    var userEvents = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"];
    function tryPlay() {
      if (done) return;
      var all = true;
      videos.forEach(function (v) { v.muted = true; v.volume = 0; if (v.paused) { all = false; var p = v.play(); if (p && p.catch) p.catch(function () {}); } });
      if (all) { done = true; cleanup(); }
    }
    function cleanup() {
      videos.forEach(function (v) { mediaEvents.forEach(function (ev) { v.removeEventListener(ev, tryPlay); }); });
      userEvents.forEach(function (ev) { window.removeEventListener(ev, tryPlay); });
      clearInterval(iv);
    }
    videos.forEach(function (v) { mediaEvents.forEach(function (ev) { v.addEventListener(ev, tryPlay); }); });
    userEvents.forEach(function (ev) { window.addEventListener(ev, tryPlay, { passive: true }); });
    iv = setInterval(tryPlay, 700);
    to = setTimeout(function () { clearInterval(iv); }, 9000);
    tryPlay();
    return function () { done = true; cleanup(); clearTimeout(to); };
  }

  /* ── mobile continuous flow: Home → Collective (list) → About ──── */
  function MobileFlow(t) {
    var root = el("div", { class: "mobile-flow" });

    // home section — film + negative-lens logo (scoped to the section, not fixed)
    var homeSec = el("section", { class: "mflow-section mflow-home", id: "mf-home" });
    var bg = mkFilmVideo();
    homeSec.appendChild(el("div", { class: "home-video" }, bg));
    homeSec.appendChild(el("div", { class: "logo-center" }, GlassLogo()));
    var videos = [bg];
    if (CONFIG.logoFx === "Negative") { var lens = mkFilmVideo(); homeSec.appendChild(el("div", { class: "logo-neg-lens" }, lens)); videos.push(lens); }
    homeSec.appendChild(el("div", { class: "mflow-tagline", text: "Paris-born hybrid AI collective" }));
    root.appendChild(homeSec);

    // collective section — scroll-driven rolling names: as the page scrolls
    // through this (tall) section, the names roll/scale by, then you continue
    // to About. A sticky inner layer keeps them centered while you scroll.
    var colSec = el("section", { class: "mflow-section mflow-collective", id: "mf-collective" });
    colSec.style.height = (M3.members.length * 85 + 15) + "vh";
    var rollWrap = el("div", { class: "mflow-roll" });
    var rollRows = M3.members.map(function (m) {
      var row = el("a", { class: "mflow-roll-row", href: "/collective/" + (m.slug || m.id) },
        el("span", { class: "eyebrow", text: m.role }),
        el("span", { class: "mflow-name", text: m.name }));
      rollWrap.appendChild(row);
      return row;
    });
    colSec.appendChild(rollWrap);
    root.appendChild(colSec);
    var rollItemH = Math.max(64, Math.round(window.innerHeight * 0.18));
    function layoutRoll() {
      var dist = colSec.offsetHeight - root.clientHeight;
      var p = Math.max(0, Math.min(1, (root.scrollTop - colSec.offsetTop) / Math.max(1, dist)));
      var off = p * (rollRows.length - 1);
      var focused = Math.round(off);
      rollRows.forEach(function (row, i) {
        var d = i - off, ad = Math.abs(d);
        var scale = Math.max(0.5, 1 - 0.3 * ad);
        var op = Math.max(0.12, 1 - 0.5 * ad);
        row.style.transform = "translate(-50%, calc(" + (d * rollItemH).toFixed(1) + "px - 50%)) scale(" + scale.toFixed(3) + ")";
        row.style.opacity = op.toFixed(3);
        row.classList.toggle("is-f", i === focused && ad < 0.5);
      });
    }
    root.addEventListener("scroll", layoutRoll, { passive: true });
    requestAnimationFrame(layoutRoll);

    // about section
    var aboutSec = el("section", { class: "mflow-section mflow-about", id: "mf-about" }, buildAboutWrap());
    root.appendChild(aboutSec);

    var stopPlay = autoplayMuted(videos);

    function scrollToSection(page) {
      var el2 = page === "about" ? aboutSec : page === "collective" ? colSec : homeSec;
      try { el2.scrollIntoView({ behavior: "smooth" }); } catch (e) { root.scrollTop = el2.offsetTop; }
    }

    return {
      node: root, scrollEl: root, scrollToSection: scrollToSection,
      sections: { home: homeSec, collective: colSec, about: aboutSec },
      destroy: function () { root.removeEventListener("scroll", layoutRoll); stopPlay(); videos.forEach(teardownMedia); }
    };
  }

  /* ── chrome (persists across routes) ──────────────────────────── */
  function buildChrome() {
    var mark = el("a", { class: "mark" + (CONFIG.markPos === "Center" ? " center" : ""), href: "/" },
      el("img", { src: LOGO, alt: "MACHINA" }));

    var links = el("div", { class: "menu-links" },
      el("a", { href: "/collective", "data-page": "collective" }, "Collective"),
      el("a", { href: "/lab", "data-page": "lab" }, "Lab"),
      el("a", { href: "/about", "data-page": "about" }, "About"),
      el("a", { href: "https://www.instagram.com/machina_collective", target: "_blank", rel: "noreferrer" }, "Instagram")
    );
    var menu = el("nav", { class: "menu-bl", "data-comment-anchor": "v3-menu" }, links);

    var tagline = el("div", { class: "tagline-tr on-media", "data-comment-anchor": "v3-right-col", text: "Paris-born hybrid AI collective" });

    var grain = CONFIG.grain ? el("div", { class: "grain" }) : null;

    document.body.appendChild(mark);
    document.body.appendChild(menu);
    document.body.appendChild(tagline);
    if (grain) document.body.appendChild(grain);

    function setActive(page) {
      Array.prototype.forEach.call(links.querySelectorAll("a[data-page]"), function (a) {
        var p = a.getAttribute("data-page");
        var active = (p === "collective" && (page === "collective" || page === "member"))
          || (p === "lab" && (page === "lab" || page === "labseries"))
          || p === page;
        a.classList.toggle("act", active);
      });
    }
    return {
      update: function (page) {
        mark.style.display = page === "home" ? "none" : "block";
        menu.classList.toggle("on-media", page === "home" || page === "member");
        // focused image viewer: hide the nav so the side arrows are unobstructed
        menu.style.display = page === "labseries" ? "none" : "";
        tagline.style.display = page === "home" ? "block" : "none";
        setActive(page);
      },
      // mobile continuous-flow: the fixed tagline is replaced by an in-section
      // one, and the corner mark only shows once you scroll past the home film.
      updateFlow: function (page) {
        mark.style.display = page === "home" ? "none" : "block";
        menu.classList.toggle("on-media", page === "home");
        tagline.style.display = "none";
        setActive(page);
      },
      tagline: tagline
    };
  }

  /* pin the home tagline directly under the (untouched) logo by measuring it */
  function pinTagline(tagline) {
    var ts = [], ro = null, img = null, onResize = null;
    function place() {
      var logo = document.querySelector(".lc-wrap");
      if (logo && tagline) {
        var r = logo.getBoundingClientRect();
        if (r.height > 4) tagline.style.top = Math.round(r.bottom + 12) + "px";
      }
    }
    place();
    ts = [80, 250, 600, 1200].map(function (d) { return setTimeout(place, d); });
    var logo = document.querySelector(".lc-wrap");
    if (logo && window.ResizeObserver) { ro = new ResizeObserver(place); ro.observe(logo); }
    img = document.querySelector(".logo-sizer");
    if (img && !img.complete) img.addEventListener("load", place);
    onResize = place;
    window.addEventListener("resize", onResize);
    return function () {
      ts.forEach(clearTimeout);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }

  /* ── router (clean paths, History API) ────────────────────────── */
  function parsePath() {
    var p = (location.pathname || "/").replace(/\/+$/, "") || "/";
    if (p.indexOf("/collective/") === 0) return { page: "member", slug: p.slice(12) };
    if (p === "/collective") return { page: "collective" };
    if (p.indexOf("/lab/") === 0) return { page: "labseries", id: p.slice(5) };
    if (p === "/lab") return { page: "lab" };
    if (p === "/about") return { page: "about" };
    return { page: "home" };
  }

  // navigate to an in-app path without a full page reload, then re-render
  function go(path) {
    if (path === location.pathname) return;
    history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function init() {
    document.documentElement.style.setProperty("--accent", CONFIG.accent || "#EFC964");
    var root = document.getElementById("root");
    root.style.height = "100%";
    var chrome = buildChrome();

    var current = null;     // { destroy, isFlow? }
    var unpinTag = null;
    var flowSpy = null;
    var MOBILE_MQ = window.matchMedia("(max-width: 920px)");

    function teardownCurrent() {
      if (flowSpy) { flowSpy(); flowSpy = null; }
      if (current) { current.destroy(); current = null; }
      if (unpinTag) { unpinTag(); unpinTag = null; }
      root.innerHTML = "";
    }

    // scroll-spy for the mobile flow: updates the corner mark + active menu item
    // as you scroll between Home / Collective / About (no hash churn).
    function setupFlowSpy(flow) {
      var sc = flow.scrollEl, last = null;
      function onScroll() {
        var y = sc.scrollTop, h = sc.clientHeight || 1;
        var page = y < flow.sections.collective.offsetTop - h * 0.5 ? "home"
          : y < flow.sections.about.offsetTop - h * 0.5 ? "collective" : "about";
        if (page !== last) { last = page; chrome.updateFlow(page); }
      }
      sc.addEventListener("scroll", onScroll, { passive: true });
      // defer the initial read until the sections have laid out (offsetTop is 0
      // synchronously right after they're appended)
      requestAnimationFrame(onScroll);
      var t0 = setTimeout(onScroll, 80);
      return function () { clearTimeout(t0); sc.removeEventListener("scroll", onScroll); };
    }

    function render() {
      var route = parsePath();
      var flowPage = route.page === "home" || route.page === "collective" || route.page === "about";

      // ── mobile continuous-flow mode ──
      if (MOBILE_MQ.matches && flowPage) {
        if (current && current.isFlow) { current.scrollToSection(route.page); return; }
        teardownCurrent();
        var flow = MobileFlow();
        flow.isFlow = true;
        root.appendChild(flow.node);
        current = flow;
        flowSpy = setupFlowSpy(flow);
        if (route.page !== "home") setTimeout(function () { flow.scrollToSection(route.page); }, 0);
        if (document.body.classList.contains("vplayer-open")) document.body.classList.remove("vplayer-open");
        return;
      }

      // ── normal per-route mode (desktop, or member on any device) ──
      teardownCurrent();
      var view;
      if (route.page === "collective") view = CollectivePage();
      else if (route.page === "about") view = AboutPage();
      else if (route.page === "lab") view = LabPage();
      else if (route.page === "labseries") {
        var series = (M3.lab || []).filter(function (s) { return s.id === route.id; })[0];
        view = series ? LabSeries(series) : LabPage();
        if (!series) route.page = "lab";
      }
      else if (route.page === "member") {
        var member = M3.members.filter(function (m) { return (m.slug || m.id) === route.slug; })[0];
        view = member ? MemberPage(member) : CollectivePage();
        if (!member) route.page = "collective";
      } else { route.page = "home"; view = HomePage(); }

      root.appendChild(view.node);
      current = view;
      chrome.update(route.page);
      if (route.page === "home") unpinTag = pinTagline(chrome.tagline);
      if (document.body.classList.contains("vplayer-open")) document.body.classList.remove("vplayer-open");
    }

    window.addEventListener("popstate", render);

    // intercept clicks on internal links so navigation stays single-page
    // (real <a href="/…"> elements; external + new-tab clicks pass through).
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) !== "/") return;   // only same-origin absolute paths
      if (a.target && a.target !== "_self") return;
      e.preventDefault();
      go(href);
    });

    // re-render when crossing the mobile/desktop breakpoint
    if (MOBILE_MQ.addEventListener) MOBILE_MQ.addEventListener("change", render);
    else if (MOBILE_MQ.addListener) MOBILE_MQ.addListener(render);
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
