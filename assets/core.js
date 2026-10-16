/* ==========================================================================
   core.js — 基础工具：DOM / 提示 / 弹窗 / 语音 / 日期 / 存储
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});

  /* ---------------- DOM ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function append(parent, child) {
    if (child === null || child === undefined || child === false || child === '') return parent;
    if (Array.isArray(child)) { child.forEach(function (c) { append(parent, c); }); return parent; }
    if (child instanceof Node) { parent.appendChild(child); return parent; }
    parent.appendChild(document.createTextNode(String(child)));
    return parent;
  }

  /** el('div', {class:'x', onclick:fn, text:'hi'}, [child, 'text']) */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class' || k === 'className') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k === 'dataset' && typeof v === 'object') Object.assign(e.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          e.addEventListener(k.slice(2).toLowerCase(), v);
        } else e.setAttribute(k, v === true ? '' : v);
      }
    }
    return append(e, children);
  }

  /** 把 HTML 字符串变成 DOM 片段 */
  function frag(str) {
    var t = document.createElement('template');
    t.innerHTML = String(str).trim();
    return t.content;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  /** 事件委托：C.on(root, 'click', '.btn', handler)
   *  同一个 root 上重复绑定同一个 (事件,选择器) 会替换旧的处理函数，
   *  避免视图重绘时监听器不断累积、一次点击触发多次。 */
  var bindMap = typeof WeakMap === 'function' ? new WeakMap() : null;
  function on(root, evt, sel, fn) {
    var h = function (e) {
      var t = e.target && e.target.closest ? e.target.closest(sel) : null;
      if (t && root.contains(t)) fn.call(t, e, t);
    };
    if (bindMap) {
      var m = bindMap.get(root);
      if (!m) { m = Object.create(null); bindMap.set(root, m); }
      var k = evt + '|' + sel;
      if (m[k]) root.removeEventListener(evt, m[k]);
      m[k] = h;
    }
    root.addEventListener(evt, h);
    return function () { root.removeEventListener(evt, h); };
  }

  /* ---------------- 日期 ---------------- */
  var DAY = 86400000;

  function midnight(ts) {
    var d = new Date(ts === undefined ? Date.now() : ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  /** 本地「第几天」，用于按天粒度的复习调度 */
  function dayNum(ts) { return Math.round(midnight(ts) / DAY); }
  function key(ts) {
    var d = new Date(ts === undefined ? Date.now() : ts);
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }
  function today() { return key(); }
  function parseKey(s) {
    var p = String(s || '').split('-');
    if (p.length !== 3) return NaN;
    return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }
  function addDays(k, n) {
    var t = parseKey(k);
    if (isNaN(t)) return k;
    return key(t + n * DAY);
  }
  function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / DAY); }
  function cnDate(k) {
    var t = parseKey(k);
    if (isNaN(t)) return k;
    var d = new Date(t);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function weekdayCn(k) {
    var t = parseKey(k);
    if (isNaN(t)) return '';
    return '日一二三四五六'.charAt(new Date(t).getDay());
  }

  /* ---------------- 杂项 ---------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }
  function fmtMin(ms) {
    var m = Math.floor((ms || 0) / 60000);
    if (m < 60) return m + ' 分钟';
    return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
  }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
  }
  function readTextFile(accept) {
    return new Promise(function (resolve, reject) {
      var inp = document.createElement('input');
      inp.type = 'file';
      if (accept) inp.accept = accept;
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        if (!f) return reject(new Error('未选择文件'));
        var r = new FileReader();
        r.onload = function () { resolve(String(r.result)); };
        r.onerror = function () { reject(r.error || new Error('读取失败')); };
        r.readAsText(f, 'utf-8');
      };
      inp.click();
    });
  }

  /** 复制文本到剪贴板；手机上没有剪贴板权限时退回「手动全选」 */
  function copyText(text) {
    return new Promise(function (resolve, reject) {
      function fallback() {
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.top = '0';
          ta.style.left = '0';
          ta.style.opacity = '0.01';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          if (ta.setSelectionRange) ta.setSelectionRange(0, ta.value.length);
          var ok = document.execCommand && document.execCommand('copy');
          ta.remove();
          if (ok) resolve();
          else reject(new Error('浏览器不允许自动复制，请长按文本框手动全选复制'));
        } catch (e) { reject(new Error('浏览器不允许自动复制，请长按文本框手动全选复制')); }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve, fallback);
      } else fallback();
    });
  }

  /* ---------------- 提示 ---------------- */
  function toast(msg, kind, ms) {
    var wrap = $('#toastWrap');
    if (!wrap) return;
    var t = el('div', { class: 'toast' + (kind ? ' ' + kind : ''), text: msg });
    wrap.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s'; t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 260);
    }, ms || 2000);
  }

  /* ---------------- 弹窗 ---------------- */
  var modalOnClose = null;
  function modalOpen(content, opts) {
    opts = opts || {};
    var wrap = $('#modalWrap'), box = $('#modal');
    if (!wrap || !box) return;
    // 换成一个全新节点，上一次绑在弹窗上的事件随之丢弃（否则每弹一次累积一层）
    var fresh = document.createElement('div');
    fresh.className = box.className;
    fresh.id = 'modal';
    box.parentNode.replaceChild(fresh, box);
    append(fresh, content);
    wrap.classList.remove('hidden');
    modalOnClose = opts.onClose || null;
    if (opts.onMount) opts.onMount(fresh);
  }
  function modalClose() {
    var wrap = $('#modalWrap');
    if (wrap) wrap.classList.add('hidden');
    var cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  }
  function confirmBox(title, body, okText, danger) {
    return new Promise(function (resolve) {
      var node = frag(
        '<h3>' + esc(title) + '</h3>' +
        '<p class="muted small">' + (body || '') + '</p>' +
        '<div class="row mt" style="justify-content:flex-end">' +
        '<button class="btn ghost" data-x="no">取消</button>' +
        '<button class="btn ' + (danger ? 'bad' : 'primary') + '" data-x="yes">' +
        esc(okText || '确定') + '</button></div>'
      );
      modalOpen(node, {
        onClose: function () { resolve(false); }
      });
      $('#modal').addEventListener('click', function (e) {
        var b = e.target.closest('[data-x]');
        if (!b) return;
        var v = b.dataset.x === 'yes';
        modalOnClose = null; modalClose(); resolve(v);
      });
    });
  }

  /* ---------------- 语音（浏览器内置合成，离线可用） ---------------- */
  var voice = null, voiceReady = false;
  function pickVoice() {
    if (!w.speechSynthesis) return null;
    var vs = w.speechSynthesis.getVoices() || [];
    if (!vs.length) return null;
    var prefer = [/Google US English/i, /Microsoft (Aria|Jenny|Guy|Zira|David)/i, /Samantha/i, /Alex/i];
    var en = vs.filter(function (v) { return /^en([-_]|$)/i.test(v.lang); });
    for (var i = 0; i < prefer.length; i++) {
      for (var j = 0; j < en.length; j++) if (prefer[i].test(en[j].name)) return en[j];
    }
    var us = en.filter(function (v) { return /^en[-_]US/i.test(v.lang); });
    return us[0] || en[0] || null;
  }
  function initVoices() {
    if (!w.speechSynthesis) return;
    voice = pickVoice();
    voiceReady = !!voice;
    if (!voice && w.speechSynthesis.onvoiceschanged !== undefined) {
      w.speechSynthesis.onvoiceschanged = function () { voice = pickVoice(); voiceReady = !!voice; };
    }
  }
  function speechOK() { return !!w.speechSynthesis; }
  function stopSpeak() { try { w.speechSynthesis && w.speechSynthesis.cancel(); } catch (e) {} }
  function speak(text, opts) {
    opts = opts || {};
    if (!w.speechSynthesis) { toast('当前浏览器不支持语音朗读'); return; }
    if (!voice) initVoices();
    try {
      w.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'en-US';
      u.rate = opts.rate || 0.92;
      u.pitch = 1;
      u.volume = 1;
      if (voice) u.voice = voice;
      if (opts.onend) u.onend = opts.onend;
      w.speechSynthesis.speak(u);
    } catch (e) { /* 忽略 */ }
  }
  /** 顺序朗读多段文本 */
  function speakSeq(list, opts) {
    opts = opts || {};
    var i = 0;
    function next() {
      if (i >= list.length) { if (opts.onend) opts.onend(); return; }
      var item = list[i++];
      speak(item, { rate: opts.rate, onend: function () { setTimeout(next, opts.gap || 320); } });
    }
    next();
  }

  /* ---------------- 主题 ---------------- */
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  }

  /* ---------------- 环形进度（纯 CSS conic-gradient） ---------------- */
  function ringHTML(percent, big, small, color, small_) {
    var p = clamp(Number(percent) || 0, 0, 100);
    var deg = (p * 3.6).toFixed(1);
    var col = color || 'var(--accent)';
    return '<div class="ring' + (small_ ? ' sm' : '') + '" style="background:conic-gradient(' +
      col + ' ' + deg + 'deg, var(--line-soft) ' + deg + 'deg)">' +
      '<div class="rl"><b>' + esc(big) + '</b><span>' + esc(small) + '</span></div></div>';
  }

  C.U = {
    $: $, $$: $$, el: el, frag: frag, esc: esc, append: append, clear: clear, on: on,
    DAY: DAY, midnight: midnight, dayNum: dayNum, key: key, today: today, parseKey: parseKey,
    addDays: addDays, daysBetween: daysBetween, cnDate: cnDate, weekdayCn: weekdayCn,
    clamp: clamp, shuffle: shuffle, pick: pick, uid: uid, pct: pct, fmtMin: fmtMin,
    download: download, readTextFile: readTextFile, copyText: copyText,
    toast: toast, modalOpen: modalOpen, modalClose: modalClose, confirm: confirmBox,
    speak: speak, speakSeq: speakSeq, stopSpeak: stopSpeak, speechOK: speechOK,
    setTheme: setTheme, ringHTML: ringHTML
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoices);
  } else initVoices();
})(window);
