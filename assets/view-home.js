/* ==========================================================================
   view-home.js — 今日 / 仪表盘
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U, D = C.data, SRS = C.srs, ST = C.state;

  function heatBlock() {
    var st = ST.data();
    var todayK = U.today();
    var endTs = U.parseKey(todayK);
    var startTs = endTs - 83 * U.DAY;
    var sd = new Date(startTs);
    sd.setDate(sd.getDate() - sd.getDay());     // 对齐到周日
    var cells = [];
    for (var ts = sd.getTime(); ts <= endTs; ts += U.DAY) {
      var k = U.key(ts);
      var l = st.logs[k];
      var v = l ? (l.nn || 0) + (l.rv || 0) + (l.qz || 0) : 0;
      var lv = ST.heatLevel(v);
      cells.push('<i class="' + (lv ? 'l' + lv : '') + (k === todayK ? ' today' : '') +
        '" title="' + k + ' · ' + v + ' 项"></i>');
    }
    return '<div class="heat">' + cells.join('') + '</div>';
  }

  function render(host) {
    var st = ST.data();
    var o = ST.overview();
    var plan = ST.plan();
    var focus = D.focus(st.profile.includeLevel1);
    var q = SRS.queue(st, focus, U.dayNum());
    var log = ST.todayLog();
    var doneToday = (log.nn || 0) + (log.rv || 0);
    var taskTotal = q.targetNew + q.dueTotal + (log.rv || 0);
    var taskDone = (log.nn || 0) + (log.rv || 0);
    var taskPct = U.pct(taskDone, Math.max(taskTotal, 1));

    var backWarn = ST.backupAgeDays() >= 7 && o.seen > 30;

    var html = '';

    /* ---- Hero ---- */
    html += '<div class="hero">' +
      U.ringHTML(plan.left > 0 ? (100 - U.pct(plan.left, 180)) : 100,
        plan.left > 0 ? plan.left : 0, plan.left > 0 ? '天后考试' : '已到考试日',
        'var(--purple)') +
      '<div class="hx">' +
      '<h1>' + (doneToday === 0 ? '今天还没开始，先来 ' + Math.min(q.targetNew, 10) + ' 个词吧' :
        (q.reviews.length === 0 && q.news.length === 0 ? '今日任务已完成 🎉' : '继续加油，还剩 ' +
          (q.reviews.length + q.news.length) + ' 项任务')) + '</h1>' +
      '<div class="lead">当前阶段：<b>' + plan.phase.name + '</b> · 重点：' + plan.phase.focus +
      '　|　建议每日新词 <b>' + plan.suggestDaily + '</b> 个，你设的是 <b>' + st.profile.dailyNew + '</b> 个' +
      (plan.onTrack ? '' : '（<span style="color:var(--warn)">偏少，可能来不及</span>') + '</div>' +
      '<div class="row">' +
      '<button class="btn primary big" data-go="learn">▶ 开始今日学习</button>' +
      '<button class="btn" data-go="quiz">做一组题</button>' +
      '<button class="btn ghost" data-go="setup">调整计划</button>' +
      '</div></div>';

    /* ---- 关键数据 ---- */
    html += '<div class="grid g4 mt">' +
      stat('今日学习', doneToday, '项', '新词 ' + (log.nn || 0) + ' · 复习 ' + (log.rv || 0)) +
      stat('连续打卡', o.streak, '天', '最长 ' + o.best + ' 天') +
      stat('已学单词', o.seen, '词', '占计划 ' + o.coverage + '%') +
      stat('已掌握', o.mastered, '词', '复习中 ' + o.review + ' · 学习中 ' + o.learning) +
      '</div>';

    /* ---- 今日任务 ---- */
    html += '<div class="grid g2 mt">';
    html += '<div class="card">' +
      '<div class="card-h"><h2>今日任务</h2><div class="sp"></div>' +
      '<span class="chip ' + (taskPct >= 100 ? 'ok' : 'a') + '">' + taskPct + '%</span></div>' +
      '<div class="bar ' + (taskPct >= 100 ? 'ok' : '') + ' mb"><i style="width:' + taskPct + '%"></i></div>' +
      taskRow('复习旧词', (log.rv || 0) + ' / ' + q.dueTotal, q.reviews.length === 0, '复习到期的词，别让遗忘曲线跑赢你') +
      taskRow('学习新词', (log.nn || 0) + ' / ' + q.targetNew, q.news.length === 0, '按考频从高到低推进，先背最可能考的') +
      taskRow('做题 / 阅读', (log.qz || 0) + ' 题' + ((log.rd || 0) ? ' · 阅读 ' + log.rd + ' 篇' : ''), (log.qz || 0) >= 10, '刷题找漏洞，阅读练速度和定位') +
      '<div class="row mt">' +
      '<button class="btn primary" data-go="learn">开始背单词</button>' +
      '<button class="btn tiny ghost" data-act="moreNew">今天想多背 10 个</button>' +
      '</div></div>';

    /* ---- 计划 & 备考路线 ---- */
    html += '<div class="card">' +
      '<div class="card-h"><h2>备考路线</h2></div>' +
      '<p class="small muted">' + U.esc(plan.phase.desc) + '</p>' +
      '<div class="kv mt">' +
      '<dt>考试日期</dt><dd>' + st.profile.examDate + '（' + u_week(st.profile.examDate) + '）</dd>' +
      '<dt>剩余天数</dt><dd>' + (plan.left > 0 ? plan.left + ' 天' : '已到/已过考试日') + '</dd>' +
      '<dt>待学单词</dt><dd>' + plan.need + ' 个（按每天 ' + st.profile.dailyNew + ' 个约需 ' +
      Math.ceil(plan.need / Math.max(1, st.profile.dailyNew)) + ' 天）</dd>' +
      '<dt>词库范围</dt><dd>' + (st.profile.includeLevel1 ? '全部 ' + D.words.length + ' 词（含初中基础词）' : '高中+四级核心 ' + D.focus(false).length + ' 词') + '</dd>' +
      '</div>' +
      '<div class="row mt"><button class="btn tiny ghost" data-go="material">看备考资料</button>' +
      '<button class="btn tiny ghost" data-go="stats">看学习统计</button></div>' +
      '</div>';
    html += '</div>';

    /* ---- 热力图 ---- */
    html += '<div class="card mt">' +
      '<div class="card-h"><h2>学习记录</h2><div class="sp"></div>' +
      '<span class="small muted">近 12 周 · 颜色越深当天做得越多</span></div>' +
      heatBlock() +
      '</div>';

    /* ---- 提醒 ---- */
    if (backWarn) {
      html += '<div class="card mt" style="border-color:var(--warn)">' +
        '<div class="row"><b style="color:var(--warn)">⚠ 已经 ' + ST.backupAgeDays() + ' 天没备份了</b>' +
        '<div class="sp"></div><button class="btn tiny" data-go="setup">去备份</button></div>' +
        '<p class="small muted" style="margin:8px 0 0">学习记录存在本机。换电脑、重装系统或清理浏览器数据都会丢失，建议每周导出一次备份文件。</p>' +
        '</div>';
    }

    host.innerHTML = html;

    U.on(host, 'click', '[data-go]', function (e, t) { C.app.go(t.dataset.go); });
    U.on(host, 'click', '[data-act="moreNew"]', function () {
      var k = U.today();
      st.extraNew[k] = (st.extraNew[k] || 0) + 10;
      ST.save();
      U.toast('好，今天的新词目标 +10');
      C.app.go('home');
    });
  }

  function u_week(k) { return '周' + U.weekdayCn(k); }

  function stat(k, v, unit, sub) {
    return '<div class="stat"><div class="k">' + k + '</div>' +
      '<div class="v">' + v + '<small>' + unit + '</small></div>' +
      '<div class="tiny-t muted">' + U.esc(sub) + '</div></div>';
  }

  function taskRow(name, val, done, desc) {
    return '<div class="row" style="align-items:flex-start;padding:9px 0;border-bottom:1px dashed var(--line-soft)">' +
      '<span style="flex:0 0 20px;font-size:15px">' + (done ? '✅' : '⭕') + '</span>' +
      '<div style="flex:1"><div><b>' + name + '</b> <span class="muted small">' + U.esc(val) + '</span></div>' +
      '<div class="tiny-t muted">' + U.esc(desc) + '</div></div></div>';
  }

  C.views = C.views || {};
  C.views.home = { title: '今日', sub: '打卡与今日任务', render: render };
})(window);
