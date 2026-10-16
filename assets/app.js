/* ==========================================================================
   app.js — 路由、外壳、启动
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U, D = C.data, SRS = C.srs, ST = C.state;

  var route = { name: 'home', params: {} };
  var current = null;
  var booted = false;

  var NAV = [
    { k: 'home', ico: '🏠', name: '今日' },
    { sep: '学习' },
    { k: 'learn', ico: '📖', name: '背单词', badge: 'due' },
    { k: 'quiz', ico: '✍️', name: '刷题', badge: 'mistake' },
    { k: 'exam', ico: '📄', name: '阅读·听力·模考' },
    { sep: '提升' },
    { k: 'material', ico: '📚', name: '备考资料' },
    { k: 'stats', ico: '📈', name: '学习统计' },
    { k: 'setup', ico: '⚙️', name: '设置与计划' }
  ];

  function badges() {
    var st = ST.data();
    var q = SRS.queue(st, D.focus(st.profile.includeLevel1), U.dayNum());
    return {
      due: q.reviews.length + q.news.length,
      mistake: ST.mistakeList().length
    };
  }

  function renderNav() {
    var b = badges();
    var el = U.$('#nav');
    el.innerHTML = NAV.map(function (n) {
      if (n.sep) return '<div class="nav-sep">' + n.sep + '</div>';
      var bd = '';
      if (n.badge) {
        var v = b[n.badge] || 0;
        bd = '<span class="nav-badge' + (v === 0 ? ' zero' : '') + '">' + v + '</span>';
      }
      return '<div class="nav-item' + (route.name === n.k ? ' on' : '') + '" data-nav="' + n.k + '">' +
        '<span class="nav-ico">' + n.ico + '</span><span>' + n.name + '</span>' + bd + '</div>';
    }).join('');
  }

  function renderTop() {
    var v = C.views[route.name] || { title: route.name, sub: '' };
    U.$('#tbLeft').innerHTML = '<div class="ttl">' + U.esc(v.title || '') + '</div>' +
      '<div class="sub">' + U.esc(v.sub || '') + '</div>';
    var st = ST.data(), o = ST.overview();
    var log = ST.todayLog();
    var left = o.daysLeft;
    U.$('#tbRight').innerHTML =
      '<span class="chip' + ((log.nn + log.rv) > 0 ? ' ok' : '') + '">今日 ' + (log.nn + log.rv) + ' 词</span>' +
      '<span class="chip' + (o.streak > 0 ? ' a' : '') + '">🔥 ' + o.streak + ' 天</span>' +
      '<span class="chip">距考试 ' + (left > 0 ? left + ' 天' : '—') + '</span>';
    U.$('#sideMini').innerHTML =
      '已学 <b>' + o.seen + '</b> / ' + o.focusTotal + ' 词（' + o.coverage + '%）<br>' +
      '已掌握 <b>' + o.mastered + '</b> 词 · 错题 <b>' + ST.mistakeList().length + '</b> 题';
  }

  function refreshChrome() { renderNav(); renderTop(); }

  function go(name, params) {
    if (!C.views[name]) name = 'home';
    if (current && C.views[current] && C.views[current].leave) {
      try { C.views[current].leave(); } catch (e) { /* 忽略 */ }
    }
    current = name;
    route = { name: name, params: params || {} };
    var view = C.views[name];
    var viewEl = U.$('#view');
    // 每次进入视图都换一个全新的容器：视图绑在旧容器上的监听器随旧节点一起丢弃，
    // 不会在切换页面后继续累积、导致一次点击被处理多次。
    U.clear(viewEl);
    var pane = document.createElement('div');
    pane.className = 'view-pane';
    viewEl.appendChild(pane);
    document.body.classList.remove('nav-open');
    refreshChrome();
    try {
      view.render(pane, route.params);
    } catch (e) {
      pane.innerHTML = '<div class="card"><h2>这个页面出错了</h2><p class="small muted">' +
        U.esc(e && e.message ? e.message : String(e)) + '</p>' +
        '<button class="btn" data-go="home">回首页</button></div>';
      U.on(pane, 'click', '[data-go]', function (e2, t) { go(t.dataset.go); });
      console.error(e);
    }
    window.scrollTo(0, 0);
    try { if (location.hash.slice(1) !== name) location.hash = name; } catch (e) {}
  }

  /* ---------------- 离线缓存（Service Worker） ----------------
     装上以后整个应用会被缓存到本地，关掉电脑、断网也能用。
     file:// 打开的单文件版不支持 Service Worker，会直接跳过，
     但单文件版本本身就全部内嵌，一样离线可用。               */
  C.swState = 'unsupported';
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) { C.swState = 'n/a'; return; }
    if (/[?&]nosw=1/.test(location.search)) { C.swState = 'off'; return; }
    try {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        C.swState = navigator.serviceWorker.controller ? 'ready' : 'installing';
        if (reg.installing) {
          reg.installing.addEventListener('statechange', function () {
            if (this.state === 'activated') C.swState = 'ready';
          });
        }
        // 有新版本就后台静默更新，用户下次打开自然生效
        reg.addEventListener('updatefound', function () {});
      }).catch(function () { C.swState = 'failed'; });
    } catch (e) { C.swState = 'failed'; }
  }

  /* ---------------- 首次使用引导 ---------------- */
  function firstRun() {
    var st = ST.data();
    var node = U.frag(
      '<h2 style="margin-bottom:6px">欢迎使用 · 四级通关</h2>' +
      '<p class="small muted">先花 20 秒设好计划，工具会帮你算每天该背多少词。</p>' +
      '<label class="fld mt"><span>你的四级考试日期</span>' +
      '<input type="date" id="frDate" value="' + U.esc(st.profile.examDate) + '"></label>' +
      '<label class="fld"><span>每天计划背多少新词（基础一般建议 25–40）</span>' +
      '<input type="number" id="frNew" min="5" max="200" value="' + st.profile.dailyNew + '"></label>' +
      '<label class="switch"><input type="checkbox" id="frL1">' +
      '<span>我基础比较薄弱，连初中词汇也没记牢（会多纳入 1525 个基础词）</span></label>' +
      '<div class="row mt" style="justify-content:flex-end">' +
      '<button class="btn primary big" id="frGo">开始备考</button></div>'
    );
    U.modalOpen(node);
    U.$('#frGo').addEventListener('click', function () {
      var d = U.$('#frDate').value;
      if (d) st.profile.examDate = d;
      st.profile.dailyNew = U.clamp(+U.$('#frNew').value || 25, 5, 200);
      st.profile.includeLevel1 = U.$('#frL1').checked;
      ST.saveNow();
      U.modalClose();
      refreshChrome();
      go('home');
      U.toast('计划已设好，开始吧！', 'ok');
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    C.store.init().then(function (loaded) {
      ST.init(loaded);
      D.init();
      U.setTheme(ST.data().ui.theme);

      U.on(document, 'click', '[data-nav]', function (e, t) { go(t.dataset.nav); });
      U.$('#menuBtn').addEventListener('click', function () { document.body.classList.add('nav-open'); });
      U.$('#scrim').addEventListener('click', function () { document.body.classList.remove('nav-open'); });
      U.$('#themeBtn').addEventListener('click', function () {
        var st = ST.data();
        st.ui.theme = st.ui.theme === 'light' ? 'dark' : 'light';
        U.setTheme(st.ui.theme); ST.save();
        U.toast(st.ui.theme === 'light' ? '已切换到浅色主题' : '已切换到深色主题');
      });

      // 弹窗点击空白处关闭
      U.$('#modalWrap').addEventListener('click', function (e) {
        if (e.target === U.$('#modalWrap')) U.modalClose();
      });

      // 统一键盘处理
      document.addEventListener('keydown', function (e) {
        var modalOpen = !U.$('#modalWrap').classList.contains('hidden');
        if (modalOpen) {
          if (e.key === 'Escape') U.modalClose();
          return;
        }
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          // 输入框里只放行回车和数字评分（由视图判断）
          if (e.key !== 'Enter') return;
        }
        var v = C.views[current];
        if (v && v.key) v.key(e);
      });

      window.addEventListener('beforeunload', function () { C.store.flush(ST.data()); });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) ST.saveNow();
      });

      registerSW();
      booted = true;
      var hash = (location.hash || '').slice(1);
      go(C.views[hash] ? hash : 'home');
      if (!loaded) setTimeout(firstRun, 260);
    }).catch(function (e) {
      U.$('#view').innerHTML = '<div class="card"><h2>启动失败</h2><p class="small muted">' +
        U.esc(e && e.message ? e.message : String(e)) + '</p>' +
        '<p class="small">请确认 data/ 目录下的数据文件都在，或改用「启动.bat」打开。</p></div>';
    });
  }

  window.addEventListener('hashchange', function () {
    if (!booted) return;
    var h = (location.hash || '').slice(1);
    if (h && C.views[h] && h !== current) go(h);
  });

  C.app = { go: go, boot: boot, refreshChrome: refreshChrome, route: function () { return route; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
