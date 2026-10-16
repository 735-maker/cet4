/* ==========================================================================
   view-stats.js — 学习统计
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U, D = C.data, ST = C.state;

  function render(host) {
    var st = ST.data();
    var o = ST.overview();
    var plan = ST.plan();
    var heat = ST.heat(84);
    var totalNew = 0, totalRev = 0, totalQz = 0, totalRight = 0, totalMs = 0, active = 0;
    Object.keys(st.logs).forEach(function (k) {
      var l = st.logs[k];
      var v = (l.nn || 0) + (l.rv || 0) + (l.qz || 0);
      if (v > 0) active++;
      totalNew += l.nn || 0; totalRev += l.rv || 0;
      totalQz += l.qz || 0; totalRight += l.qr || 0; totalMs += l.ms || 0;
    });

    var h = '';

    /* ---- 总览 ---- */
    h += '<div class="grid g4">' +
      card('累计学习', active, '天', '连续 ' + o.streak + ' 天 · 最长 ' + o.best + ' 天') +
      card('累计背词', totalNew + totalRev, '词次', '新词 ' + totalNew + ' · 复习 ' + totalRev) +
      card('累计做题', totalQz, '题', '正确率 ' + U.pct(totalRight, totalQz) + '%') +
      card('有效学习时长', Math.round(totalMs / 60000), '分钟', '约 ' + (totalMs / 3600000).toFixed(1) + ' 小时') +
      '</div>';

    /* ---- 词库进度 ---- */
    h += '<div class="card mt"><div class="card-h"><h2>词汇进度</h2><div class="sp"></div>' +
      '<span class="chip a">已覆盖 ' + o.coverage + '%</span></div>' +
      '<div class="row"><div style="flex:1;min-width:260px">' +
      barLine('已学（含学习中/复习中/已掌握）', o.seen, o.focusTotal, '') +
      barLine('已掌握（间隔 ≥ 21 天）', o.mastered, o.focusTotal, 'ok') +
      barLine('复习中', o.review, o.focusTotal, '') +
      barLine('学习中', o.learning, o.focusTotal, 'warn') +
      '</div>' + U.ringHTML(o.coverage, o.coverage + '%', '已覆盖', 'var(--accent)') + '</div>' +
      '<div class="kv mt">' +
      '<dt>计划词库</dt><dd>' + o.focusTotal + ' 词' +
      (st.profile.includeLevel1 ? '（全部，含初中基础词）' : '（已排除 ' + (D.words.length - D.focus(false).length) + ' 个初中基础词）') + '</dd>' +
      '<dt>尚未开始</dt><dd>' + o.unseen + ' 词</dd>' +
      '<dt>按当前速度</dt><dd>' + (st.profile.dailyNew > 0 ?
        '约 ' + Math.ceil(o.unseen / st.profile.dailyNew) + ' 天可过完一轮；距考试还有 ' + Math.max(0, plan.left) + ' 天' : '未设置') + '</dd>' +
      '</div></div>';

    /* ---- 近 30 天曲线 ---- */
    var days = [];
    for (var i = 29; i >= 0; i--) {
      var k = U.addDays(U.today(), -i);
      var l = st.logs[k] || { nn: 0, rv: 0, qz: 0 };
      days.push({ k: k, nn: l.nn || 0, rv: l.rv || 0, qz: l.qz || 0 });
    }
    var max = Math.max.apply(null, days.map(function (d) { return d.nn + d.rv + d.qz; }).concat([10]));
    h += '<div class="card mt"><div class="card-h"><h2>近 30 天</h2><div class="sp"></div>' +
      '<span class="tiny-t muted">蓝=新词 · 青=复习 · 黄=做题</span></div>';
    h += '<div style="display:flex;align-items:flex-end;gap:3px;height:130px">';
    days.forEach(function (d) {
      var tot = d.nn + d.rv + d.qz;
      var hp = function (v) { return Math.round(v / max * 118); };
      var title = d.k + '：新词 ' + d.nn + ' · 复习 ' + d.rv + ' · 做题 ' + d.qz;
      h += '<div title="' + title + '" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:1px;min-width:3px">' +
        (d.qz ? '<i style="display:block;height:' + hp(d.qz) + 'px;background:var(--warn);border-radius:2px"></i>' : '') +
        (d.rv ? '<i style="display:block;height:' + hp(d.rv) + 'px;background:var(--purple);border-radius:2px"></i>' : '') +
        (d.nn ? '<i style="display:block;height:' + hp(d.nn) + 'px;background:var(--accent);border-radius:2px"></i>' : '') +
        (tot === 0 ? '<i style="display:block;height:2px;background:var(--line)"></i>' : '') +
        '</div>';
    });
    h += '</div><div class="row tiny-t muted" style="justify-content:space-between;margin-top:6px">' +
      '<span>' + days[0].k + '</span><span>今天</span></div></div>';

    /* ---- 热力图 ---- */
    h += '<div class="card mt"><div class="card-h"><h2>打卡情况</h2></div>' + heatHTML(heat) +
      '<p class="tiny-t muted mt">共 ' + heat.filter(function (x) { return x.v > 0; }).length + ' / 84 天有学习记录。</p></div>';

    /* ---- 题型正确率 ---- */
    var bc = st.quiz.byCat || {};
    h += '<div class="card mt"><div class="card-h"><h2>各题型掌握情况</h2></div>';
    if (!Object.keys(bc).length) h += '<p class="muted small">还没有做题记录。</p>';
    else {
      h += '<table class="tb"><thead><tr><th>题型</th><th>做对 / 总数</th><th>正确率</th><th style="width:36%">掌握度</th><th>建议</th></tr></thead><tbody>';
      Object.keys(bc).forEach(function (k) {
        var b = bc[k], p = U.pct(b.r, b.t);
        h += '<tr><td>' + (D.CAT_NAME[k] || k) + '</td>' +
          '<td>' + b.r + ' / ' + b.t + '</td><td>' + p + '%</td>' +
          '<td><div class="bar ' + (p >= 80 ? 'ok' : p >= 60 ? '' : 'warn') + '"><i style="width:' + p + '%"></i></div></td>' +
          '<td class="small muted">' + (p >= 80 ? '已比较稳，保持即可' : p >= 60 ? '再刷一组同类题' : '建议看资料板块补考点') + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    h += '</div>';

    /* ---- 阅读 ---- */
    var rk = Object.keys(st.reading || {});
    h += '<div class="card mt"><div class="card-h"><h2>阅读完成情况</h2><div class="sp"></div>' +
      '<span class="chip">' + rk.length + ' / ' + D.passages.length + ' 篇</span></div>';
    if (!rk.length) h += '<p class="muted small">还没有做过阅读训练。</p>';
    else {
      h += '<table class="tb"><thead><tr><th>文章</th><th>得分</th></tr></thead><tbody>';
      rk.forEach(function (id) {
        var p = D.passages.filter(function (x) { return x.id === id; })[0];
        var r = st.reading[id];
        h += '<tr><td>' + U.esc(p ? p.title : id) + '</td><td>' + r.right + ' / ' + r.total + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    h += '</div>';

    /* ---- 错题本 ---- */
    var mk = ST.mistakeList();
    h += '<div class="card mt"><div class="card-h"><h2>错题</h2><div class="sp"></div>' +
      '<span class="chip ' + (mk.length > 20 ? 'bad' : '') + '">' + mk.length + ' 题待清</span></div>' +
      '<p class="small muted">' + (mk.length ? '错题本里还有 ' + mk.length + ' 题。连对两次会自动移出。' : '错题本是空的，说明你在稳定地做对。') + '</p>' +
      (mk.length ? '<button class="btn primary" data-go="quiz" data-mode="mistake">去清错题</button>' : '') +
      '</div>';

    host.innerHTML = h;
    U.on(host, 'click', '[data-go]', function (e, t) {
      C.app.go(t.dataset.go, t.dataset.mode ? { mode: t.dataset.mode, start: true } : {});
    });
  }

  function card(k, v, unit, sub) {
    return '<div class="stat"><div class="k">' + k + '</div>' +
      '<div class="v">' + v + '<small>' + unit + '</small></div>' +
      '<div class="tiny-t muted">' + U.esc(sub) + '</div></div>';
  }
  function barLine(name, v, total, cls) {
    var p = U.pct(v, total);
    return '<div style="margin-bottom:11px"><div class="row tiny-t" style="justify-content:space-between">' +
      '<span>' + name + '</span><span class="muted">' + v + ' 词 · ' + p + '%</span></div>' +
      '<div class="bar ' + cls + '"><i style="width:' + p + '%"></i></div></div>';
  }
  function heatHTML(heat) {
    var min = heat[0];
    var startTs = U.parseKey(min.k);
    var sd = new Date(startTs);
    sd.setDate(sd.getDate() - sd.getDay());
    var cells = [];
    for (var ts = sd.getTime(); ts <= U.parseKey(U.today()); ts += U.DAY) {
      var k2 = U.key(ts);
      var e = heat.filter(function (x) { return x.k === k2; })[0];
      var v = e ? e.v : 0;
      var lv = ST.heatLevel(v);
      cells.push('<i class="' + (lv ? 'l' + lv : '') + (k2 === U.today() ? ' today' : '') +
        '" title="' + k2 + ' · ' + v + ' 项"></i>');
    }
    return '<div class="heat">' + cells.join('') + '</div>';
  }

  C.views = C.views || {};
  C.views.stats = { title: '学习统计', sub: '进度、曲线与薄弱项', render: render };
})(window);
