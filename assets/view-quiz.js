/* ==========================================================================
   view-quiz.js — 刷题 / 错题本
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U, D = C.data, ST = C.state;

  var q = null;         // 当前答题会话
  var host = null;
  var tab = 'practice'; // practice | mistakes

  var LETTER = ['A', 'B', 'C', 'D', 'E', 'F'];

  function build(cat, only, limit) {
    var pool = only === 'mistake'
      ? ST.mistakeList().map(function (x) { return D.questions.filter(function (z) { return z.id === x.id; })[0]; }).filter(Boolean)
      : D.questionsByCat(cat);
    if (!pool.length) return null;
    pool = U.shuffle(pool);
    if (limit && limit > 0) pool = pool.slice(0, limit);
    return { items: pool, idx: 0, picked: -1, right: 0, wrong: [], start: Date.now(), limit: limit || pool.length };
  }

  /* ---------------- 入口 ---------------- */
  function renderSetup() {
    var cats = D.questionsByCat('all');
    var byCat = {};
    cats.forEach(function (x) { byCat[x.cat] = (byCat[x.cat] || 0) + 1; });
    var mistakes = ST.mistakeList().length;
    var ov = ST.data().quiz;

    var h = '<div class="row mb">' +
      '<button class="tab' + (tab === 'practice' ? ' on' : '') + '" data-tab="practice">刷题练习</button>' +
      '<button class="tab' + (tab === 'mistakes' ? ' on' : '') + '" data-tab="mistakes">错题本' +
      (mistakes ? '（' + mistakes + '）' : '') + '</button></div>';

    if (tab === 'mistakes') { host.innerHTML = h + mistakesHTML(); bindSetup(); return; }

    h += '<div class="card">' +
      '<div class="card-h"><h2>选择练习内容</h2><div class="sp"></div>' +
      '<span class="chip">累计答题 ' + ov.total + ' · 正确率 ' + U.pct(ov.right, ov.total) + '%</span></div>' +
      '<div class="grid g3">';
    [['all', '全部题型', cats.length]].concat(Object.keys(D.CAT_NAME).map(function (k) {
      return [k, D.CAT_NAME[k], byCat[k] || 0];
    })).forEach(function (r) {
      var dis = r[2] === 0 ? ' disabled' : '';
      h += '<button class="btn"' + dis + ' data-cat="' + r[0] + '" style="flex-direction:column;align-items:flex-start;height:auto;padding:14px;text-align:left">' +
        '<b>' + r[1] + '</b><span class="tiny-t muted">' + r[2] + ' 题</span></button>';
    });
    h += '</div>' +
      '<div class="row mt"><span class="small muted">每组题量</span>';
    [10, 20, 0].forEach(function (n) {
      h += '<button class="btn tiny" data-limit="' + n + '">' + (n === 0 ? '全部' : n + ' 题') + '</button>';
    });
    h += '<span class="sp"></span><span class="tiny-t muted">点分类即开始，默认 10 题一组</span></div>' +
      '</div>';

    h += '<div class="card mt"><div class="card-h"><h3>各题型正确率</h3></div>';
    var keys = Object.keys(ov.byCat || {});
    if (!keys.length) h += '<p class="muted small">还没有作答记录。</p>';
    else {
      h += '<table class="tb"><thead><tr><th>题型</th><th>做对</th><th>正确率</th><th style="width:40%">掌握度</th></tr></thead><tbody>';
      keys.forEach(function (k) {
        var b = ov.byCat[k];
        var p = U.pct(b.r, b.t);
        h += '<tr><td>' + (D.CAT_NAME[k] || k) + '</td><td>' + b.r + ' / ' + b.t + '</td><td>' + p + '%</td>' +
          '<td><div class="bar ' + (p >= 80 ? 'ok' : p >= 60 ? '' : 'warn') + '"><i style="width:' + p + '%"></i></div></td></tr>';
      });
      h += '</tbody></table>';
    }
    h += '</div>';

    host.innerHTML = h;
    bindSetup();
  }

  function mistakesHTML() {
    var list = ST.mistakeList();
    if (!list.length) {
      return '<div class="card center" style="padding:34px"><h2>错题本是空的</h2>' +
        '<p class="muted small">做错的题会自动进来。同一道题连续做对两次就会移出。</p>' +
        '<button class="btn primary" data-tab="practice">去刷题</button></div>';
    }
    var rows = list.map(function (x) {
      var item = D.questions.filter(function (z) { return z.id === x.id; })[0];
      if (!item) return '';
      return '<tr><td style="max-width:520px">' + U.esc(item.stem.slice(0, 90)) +
        (item.stem.length > 90 ? '…' : '') + '</td>' +
        '<td><span class="chip">' + (D.CAT_NAME[item.cat] || item.cat) + '</span></td>' +
        '<td class="nowrap">错 ' + x.m.n + ' 次</td>' +
        '<td class="nowrap">已连对 ' + (x.m.right || 0) + '/2</td></tr>';
    }).join('');
    return '<div class="card"><div class="card-h"><h3>错题本 · ' + list.length + ' 题</h3>' +
      '<div class="sp"></div><button class="btn primary" data-only="mistake">重做全部错题</button></div>' +
      '<table class="tb"><thead><tr><th>题目</th><th>题型</th><th>错误</th><th>状态</th></tr></thead><tbody>' +
      rows + '</tbody></table>' +
      '<p class="tiny-t muted mt">规则：错一次记一次；连续做对 2 次自动移出，避免错题本越滚越大。</p></div>';
  }

  function bindSetup() {
    U.on(host, 'click', '[data-tab]', function (e, t) { tab = t.dataset.tab; renderSetup(); });
    U.on(host, 'click', '[data-cat]', function (e, t) {
      q = build(t.dataset.cat, 'cat', 10);
      if (!q) { U.toast('这个题型还没有题目'); return; }
      paint();
    });
    U.on(host, 'click', '[data-only="mistake"]', function () {
      q = build(null, 'mistake', 0);
      if (!q) { U.toast('错题本是空的'); return; }
      paint();
    });
  }

  /* ---------------- 答题 ---------------- */
  function pick(i) {
    if (!q || q.picked >= 0) return;
    var item = q.items[q.idx];
    q.picked = i;
    var ok = i === item.answer;
    if (ok) {
      q.right++;
      ST.logQuiz(item.cat, true);
      ST.rightOnMistake(item.id);
    } else {
      q.wrong.push(item);
      ST.logQuiz(item.cat, false);
      ST.addMistake(item.id);
    }
    paint();
  }

  function next() {
    if (!q) return;
    if (q.idx + 1 >= q.items.length) { q.done = true; paint(); return; }
    q.idx++; q.picked = -1;
    paint();
  }

  function paint() {
    if (!q) { renderSetup(); return; }
    if (q.done) return paintSummary();

    var item = q.items[q.idx];
    var h = '<div class="row mb">' +
      '<span class="chip a">' + (D.CAT_NAME[item.cat] || item.cat) + '</span>' +
      '<span class="chip">' + U.esc(item.tag || '') + '</span>' +
      '<span class="chip">第 ' + (q.idx + 1) + ' / ' + q.items.length + ' 题</span>' +
      '<div class="sp"></div>' +
      '<span class="chip ok">对 ' + q.right + '</span>' +
      '<span class="chip bad">错 ' + q.wrong.length + '</span>' +
      '<button class="btn tiny ghost" data-act="quit">结束</button></div>';

    h += '<div class="card">';
    if (item.passage) h += '<div class="q-passage">' + U.esc(item.passage) + '</div>';
    h += '<div class="q-stem">' + U.esc(item.stem) + '</div><div class="opts">';
    item.options.forEach(function (op, i) {
      var cls = '';
      if (q.picked >= 0) {
        if (i === item.answer) cls = ' ok';
        else if (i === q.picked) cls = ' bad';
      }
      h += '<button class="opt' + cls + '" data-pick="' + i + '"' + (q.picked >= 0 ? ' disabled' : '') + '>' +
        '<span class="ol">' + LETTER[i] + '</span><span>' + U.esc(op) + '</span></button>';
    });
    h += '</div>';

    if (q.picked >= 0) {
      var ok = q.picked === item.answer;
      h += '<div class="explain ' + (ok ? 'ok' : 'wrong') + '">' +
        '<b>' + (ok ? '✅ 答对了' : '❌ 答错了，正确答案是 ' + LETTER[item.answer] + '．' + U.esc(item.options[item.answer])) + '</b>' +
        '<div style="margin-top:6px">' + U.esc(item.explain) + '</div></div>' +
        '<div class="row mt"><button class="btn primary block big" data-act="next">' +
        (q.idx + 1 >= q.items.length ? '看本组结果（回车）' : '下一题（回车）') + '</button></div>';
    } else {
      h += '<p class="tiny-t muted mt">可以用键盘 1 / 2 / 3 / 4 选择 A / B / C / D</p>';
    }
    h += '</div>';

    host.innerHTML = h;
    U.on(host, 'click', '[data-pick]', function (e, t) { pick(+t.dataset.pick); });
    U.on(host, 'click', '[data-act="next"]', next);
    U.on(host, 'click', '[data-act="quit"]', function () { q.done = true; paint(); });
  }

  function paintSummary() {
    var total = q.idx + (q.picked >= 0 ? 1 : 0);
    var rate = U.pct(q.right, Math.max(1, total));
    var sec = Math.round((Date.now() - q.start) / 1000);
    var h = '<div class="card center" style="padding:30px 22px">' +
      '<h1>' + (rate >= 80 ? '这组做得很稳 👍' : rate >= 60 ? '有进步，继续' : '正确率偏低，把解析看懂更重要') + '</h1>' +
      '<div class="grid g3 mt" style="max-width:620px;margin:16px auto 0">' +
      '<div class="stat"><div class="k">做完</div><div class="v">' + total + '<small>题</small></div></div>' +
      '<div class="stat"><div class="k">答对</div><div class="v">' + q.right + '<small>题</small></div></div>' +
      '<div class="stat"><div class="k">正确率</div><div class="v">' + rate + '<small>%</small></div></div>' +
      '</div><p class="muted small mt">用时 ' + Math.max(1, Math.round(sec / 60)) + ' 分钟</p></div>';

    if (q.wrong.length) {
      h += '<div class="card mt"><div class="card-h"><h3>本组错题（已加入错题本）</h3></div>';
      h += '<table class="tb"><thead><tr><th>题目</th><th>正确答案</th><th>考点</th></tr></thead><tbody>';
      q.wrong.forEach(function (it) {
        h += '<tr><td style="max-width:430px">' + U.esc(it.stem.slice(0, 80)) + '…</td>' +
          '<td>' + LETTER[it.answer] + '．' + U.esc(it.options[it.answer]) + '</td>' +
          '<td>' + U.esc(it.tag || '') + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }

    h += '<div class="row mt">' +
      '<button class="btn primary" data-act="again">再来一组</button>' +
      '<button class="btn" data-go="learn">去背单词</button>' +
      '<button class="btn ghost" data-go="home">回首页</button></div>';

    host.innerHTML = h;
    U.on(host, 'click', '[data-go]', function (e, t) { C.app.go(t.dataset.go); });
    U.on(host, 'click', '[data-act="again"]', function () { q = build('all', 'cat', 10); paint(); });
  }

  function key(e) {
    if (!q || q.done) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (q.picked >= 0) next();
      return;
    }
    if (q.picked >= 0) return;
    var map = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
    var i = map[String(e.key).toLowerCase()];
    if (i !== undefined && i < q.items[q.idx].options.length) { e.preventDefault(); pick(i); }
  }

  function render(h, params) {
    host = h;
    q = null;
    tab = (params && params.tab) || 'practice';
    if (params && params.mode === 'mistake') tab = 'mistakes';
    if (tab === 'mistakes' && params && params.start) {
      q = build(null, 'mistake', 0);
      if (q) { paint(); return; }
    }
    renderSetup();
  }

  function leave() { q = null; host = null; }

  C.views = C.views || {};
  C.views.quiz = {
    title: '刷题', sub: '客观题自动判分 · 错题自动收集',
    render: render, leave: leave, key: key
  };
})(window);
