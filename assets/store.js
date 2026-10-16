/* ==========================================================================
   store.js — 数据持久化
   优先使用本地服务端文件存储（state.json，不怕清缓存）；
   双击 file:// 打开时自动退回 localStorage；再不行退回内存。
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var KEY = 'cet4.state.v1';

  var S = {
    mode: 'memory',       // 'server' | 'local' | 'memory'
    detail: '',
    _mem: null,
    _lsOK: null
  };

  function lsOK() {
    if (S._lsOK !== null) return S._lsOK;
    try {
      w.localStorage.setItem('__t', '1');
      w.localStorage.removeItem('__t');
      S._lsOK = true;
    } catch (e) { S._lsOK = false; }
    return S._lsOK;
  }

  function isLocalHost() {
    var h = location.hostname;
    return location.protocol === 'http:' || location.protocol === 'https:'
      ? (h === 'localhost' || h === '127.0.0.1' || h === '[::1]')
      : false;
  }

  /** 探测可用的持久化后端 */
  S.init = function () {
    S._mem = S._mem || null;
    if (isLocalHost()) {
      return fetch('api/state', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('no api')); })
        .then(function (j) {
          S.mode = 'server';
          S.detail = '本地文件存储（state.json）';
          return j && j.state ? j.state : null;
        })
        .catch(function () {
          S.mode = lsOK() ? 'local' : 'memory';
          S.detail = lsOK() ? '浏览器本地存储' : '临时内存（关闭页面会丢失）';
          return S.readLocal();
        });
    }
    S.mode = lsOK() ? 'local' : 'memory';
    S.detail = lsOK() ? '浏览器本地存储' : '临时内存（关闭页面会丢失）';
    if (location.protocol === 'file:') {
      S.detail += ' · 建议用「启动.bat」打开以获得更可靠的存档';
    }
    return Promise.resolve(S.readLocal());
  };

  S.readLocal = function () {
    if (!lsOK()) return S._mem;
    try {
      var raw = w.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  var pending = null, inflight = false;
  S.save = function (state) {
    S._mem = state;
    if (S.mode === 'server') {
      pending = state;
      if (inflight) return Promise.resolve();
      inflight = true;
      return fetch('api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      }).then(function (r) {
        if (!r.ok) throw new Error('save failed');
      }).catch(function () {
        // 服务端失败时兜底写 localStorage，避免丢数据
        if (lsOK()) { try { w.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
      }).then(function () {
        inflight = false;
        if (pending !== state) return S.save(pending);
      });
    }
    if (lsOK()) {
      try { w.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }
    return Promise.resolve();
  };

  /** 立即落盘（离开页面前用）——服务端模式下用同步 beacon */
  S.flush = function (state) {
    S._mem = state;
    if (S.mode === 'server' && w.navigator && navigator.sendBeacon) {
      try {
        navigator.sendBeacon('api/state', new Blob([JSON.stringify(state)], { type: 'application/json' }));
        return;
      } catch (e) {}
    }
    if (lsOK()) { try { w.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  };

  S.clearAll = function () {
    if (lsOK()) { try { w.localStorage.removeItem(KEY); } catch (e) {} }
    S._mem = null;
    if (S.mode === 'server') {
      return fetch('api/state', { method: 'DELETE' }).catch(function () {});
    }
    return Promise.resolve();
  };

  C.store = S;
})(window);
