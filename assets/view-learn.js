/* ==========================================================================
   view-learn.js — 背单词：认词 / 拼写 / 听写
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U, D = C.data, SRS = C.srs, ST = C.state;

  var sess = null;          // 当前学习会话
  var host = null;          // 当前视图容器

  var MODES = {
    flash: { name: '认词', desc: '看英文想中文，最快过词量' },
    spell: { name: '拼写', desc: '看中文写英文，记得最牢' },
    dictation: { name: '听写', desc: '听发音写单词，顺带练听力' }
  };
  var SOURCES = {
    daily: { name: '今日任务', desc: '到期的复习词 + 今天该学的新词' },
    review: { name: '只复习', desc: '只过今天到期的词' },
    new: { name: '只学新词', desc: '只背没学过的新词' },
    free: { name: '自由复习', desc: '从已学过的词里随机抽，不占用今日额度' }
  };

  /* ---------------- 会话构建 ---------------- */
  function buildSession(o) {
    var st = ST.data(), tn = U.dayNum();
    var focus = D.focus(st.profile.includeLevel1);
    var words = [], q;
    if (o.source === 'review') {
      q = SRS.queue(st, focus, tn);
      words = q.reviews.slice();
    } else if (o.source === 'new') {
      q = SRS.queue(st, focus, tn);
      words = q.news.slice();
    } else if (o.source === 'free') {
      words = U.shuffle(Object.keys(st.cards).filter(function (k) {
        return (st.cards[k].s || 0) >= 1;
      }));
    } else {
      q = SRS.queue(st, focus, tn);
      words = q.reviews.concat(q.news);
    }
    if (!words.length) return null;
    if (o.limit && o.limit > 0) words = words.slice(0, o.limit);

    var isNew = {};
    words.forEach(function (x) { isNew[x] = !st.cards[x]; });

    return {
      mode: o.mode || 'flash',
      source: o.source || 'daily',
      queue: words.slice(),
      unique: words.length,
      isNew: isNew,
      seen: {},
      marks: [],
      done: 0,
      good: 0,
      again: 0,
      retry: {},
      revealed: false,
      typed: '',
      checked: false,
      spellOK: false,
      start: Date.now(),
      newCount: 0,
      revCount: 0
    };
  }

  function begin(o) {
    var s = buildSession(o);
    if (!s) { U.toast('这个范围里暂时没有要学的词'); return; }
    sess = s;
    paint();
  }

  /* ---------------- 当前单词 ---------------- */
  function curWord() { return sess && sess.queue.length ? sess.queue[0] : null; }

  function grade(g) {
    if (!sess) return;
    var word = curWord();
    if (!word) return;
    var st = ST.data();
    var card = st.cards[word] || SRS.newCard(U.dayNum());
    ST.putCard(word, SRS.review(card, g, Date.now()));

    if (sess.isNew[word]) { sess.newCount++; ST.logStudy('new', 1); }
    else { sess.revCount++; ST.logStudy('rev', 1); }
    sess.isNew[word] = false;                 // 同一词第二次出现不再算新词

    sess.queue.shift();
    if (g === 0) {
      sess.again++;
      sess.retry[word] = (sess.retry[word] || 0) + 1;
      if (sess.retry[word] <= 2) sess.queue.push(word);      // 本组内再练
    } else {
      sess.good++;
    }
    sess.marks.push(g === 0 ? 'bad' : 'ok');
    if (!sess.seen[word]) { sess.seen[word] = true; sess.done++; }
    sess.revealed = false; sess.checked = false; sess.typed = ''; sess.spellOK = false;

    if (!sess.queue.length) finishSession();
    else paint();
  }

  function finishSession() {
    if (!sess) return;
    var ms = Date.now() - sess.start;
    ST.logTime(ms);
    ST.saveNow();
    sess.finished = { ms: ms };
    paint();
  }

  /* ---------------- 渲染：入口 ---------------- */
  function renderSetup() {
    var st = ST.data();
    var q = SRS.queue(st, D.focus(st.profile.includeLevel1), U.dayNum());
    var remaining = q.reviews.length + q.news.length;
    var typable = Object.keys(st.cards).length;

    var h = '';
    h += '<div class="card">' +
      '<div class="card-h"><h2>选择学习方式</h2><div class="sp"></div>' +
      '<span class="chip a">今日待完成 ' + remaining + ' 词</span></div>' +
      '<div class="grid g3">';
    Object.keys(MODES).forEach(function (k) {
      var m = MODES[k];
      h += '<button class="btn" data-mode="' + k + '" style="flex-direction:column;align-items:flex-start;padding:14px;height:auto;text-align:left">' +
        '<b style="font-size:15px">' + m.name + '</b>' +
        '<span class="tiny-t muted" style="white-space:normal">' + m.desc + '</span></button>';
    });
    h += '</div></div>';

    h += '<div class="grid g2 mt"><div class="card">' +
      '<div class="card-h"><h3>背哪一批</h3></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">';
    Object.keys(SOURCES).forEach(function (k) {
      var cnt = k === 'daily' ? remaining
        : k === 'review' ? q.reviews.length
        : k === 'new' ? q.news.length
        : typable;
      var dis = cnt === 0 ? ' disabled' : '';
      h += '<button class="btn' + (k === 'daily' ? ' primary' : '') + '" data-source="' + k + '"' + dis + '>' +
        '<b>' + SOURCES[k].name + '</b><span class="sp"></span>' +
        '<span class="tiny-t muted">' + cnt + ' 个</span></button>';
    });
    h += '</div><p class="tiny-t muted mt">' + U.esc(SOURCES['free'].desc) + '</p></div>';

    h += '<div class="card">' +
      '<div class="card-h"><h3>每组词量</h3></div>' +
      '<div class="row">';
    [10, 20, 30, 50, 0].forEach(function (n) {
      h += '<button class="btn tiny' + (st.profile.sessionSize === n ? ' primary' : '') +
        '" data-size="' + n + '">' + (n === 0 ? '一次学完' : n + ' 个') + '</button>';
    });
    h += '</div>' +
      '<p class="tiny-t muted mt">先点上面的「认词 / 拼写 / 听写」，会立刻用当前设置开始一组。</p>' +
      '<hr>' +
      '<div class="kv">' +
      '<dt>词库范围</dt><dd>' + D.focus(st.profile.includeLevel1).length + ' 词' +
      (st.profile.includeLevel1 ? '（含初中基础词）' : '（已排除初中基础词）') + '</dd>' +
      '<dt>发音</dt><dd>' + (U.speechOK() ? '浏览器内置语音，离线可用' : '当前环境不支持语音') + '</dd>' +
      '<dt>已掌握</dt><dd>' + ST.overview().mastered + ' 词</dd>' +
      '</div></div></div>';

    host.innerHTML = h;
    U.on(host, 'click', '[data-size]', function (e, t) {
      st.profile.sessionSize = +t.dataset.size; ST.save(); paint();
    });
    U.on(host, 'click', '[data-mode]', function (e, t) {
      begin({ mode: t.dataset.mode, source: 'daily', limit: st.profile.sessionSize || 0 });
    });
    U.on(host, 'click', '[data-source]', function (e, t) {
      begin({ mode: 'flash', source: t.dataset.source, limit: st.profile.sessionSize || 0 });
    });
  }

  /* ---------------- 渲染：卡片 ---------------- */
  function headBar() {
    var total = sess.unique;
    var dots = '';
    for (var i = 0; i < Math.min(total, 40); i++) {
      var cls = sess.marks[i] || '';
      dots += '<i class="' + cls + (i === sess.marks.length ? ' cur' : '') + '"></i>';
    }
    return '<div class="row mb">' +
      '<span class="chip a">' + MODES[sess.mode].name + '模式</span>' +
      '<span class="chip">' + SOURCES[sess.source].name + '</span>' +
      '<span class="chip">已完成 ' + sess.done + ' / ' + total + '</span>' +
      '<span class="chip">队列剩 ' + sess.queue.length + '</span>' +
      '<div class="sp"></div>' +
      '<button class="btn tiny ghost" data-act="quit">结束本组</button>' +
      '</div>' +
      '<div class="progress-dots mb">' + dots + '</div>';
  }

  function tags(word) {
    var meta = D.get(word);
    if (!meta) return '';
    var s = '';
    if (meta.lvl) s += '<span class="chip">' + D.LEVEL_NAME[meta.lvl] + '</span>';
    if (meta.tier) s += '<span class="chip ' + (meta.tier === 1 ? 'a' : '') + '">' + D.TIER_NAME[meta.tier] + '</span>';
    if (sess.isNew[word]) s += '<span class="chip warn">新词</span>';
    return s;
  }

  function backSide(word) {
    var meta = D.get(word) || { w: word, t: '', p: '' };
    var ex = D.exFor(word);
    var st = ST.data();
    var card = st.cards[word];
    var h = '<div class="flash-back">';
    h += '<div class="flash-zh">' + U.esc(meta.t) + '</div>';
    if (meta.t2) h += '<div class="tiny-t muted" style="margin-top:4px">其他释义：' + U.esc(meta.t2) + '</div>';
    if (meta.d) h += '<div class="flash-def">' + U.esc(meta.d) + '</div>';
    if (ex) {
      h += '<div class="flash-ex"><div class="en">' + U.esc(ex.en) +
        ' <button class="btn tiny ghost" data-act="speak-ex" style="padding:1px 7px">🔊</button></div>' +
        '<div class="zh">' + U.esc(ex.zh) + '</div></div>';
    }
    if (meta.x) {
      h += '<div class="tiny-t muted" style="margin-top:9px">词形变化：' +
        U.esc(meta.x.replace(/[dpsi3r]:/g, function (m) {
          return ({ 'd:': '过去式 ', 'p:': '过去分词 ', 'i:': '现在分词 ', 's:': '复数 ', '3:': '三单 ', 'r:': '比较级 ' })[m] || m;
        })) + '</div>';
    }
    return h + '</div>';
  }

  function gradesRow(highlight) {
    var h = '<div class="grades">';
    SRS.GRADES.forEach(function (g) {
      h += '<button class="gbtn' + (highlight === g.g ? ' primary' : '') + '" data-g="' + g.g + '">' +
        '<b>' + g.label + '</b><span>' + g.hint + '</span>' +
        '<span class="kbd">按 ' + g.key + '</span></button>';
    });
    return h + '</div>';
  }

  function paintFlash(word) {
    var meta = D.get(word) || { w: word, p: '', t: '' };
    var h = headBar();
    h += '<div class="flash">';
    h += '<div class="row tight">' + tags(word) + '<div class="sp"></div>' +
      '<button class="btn tiny" data-act="speak">🔊 朗读</button></div>';
    h += '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:18px 0">' +
      '<div class="flash-word">' + U.esc(word) + '</div>' +
      '<div class="flash-phon">' + (meta.p ? '/' + U.esc(meta.p) + '/' : '') + '</div>' +
      '</div>';
    if (sess.revealed) h += backSide(word);
    else h += '<div class="flash-hint">先自己想一下中文意思，再按空格翻面</div>';
    h += '</div>';
    h += sess.revealed
      ? gradesRow(-1)
      : '<div class="row mt"><button class="btn primary block big" data-act="flip">显示答案（空格）</button></div>';
    host.innerHTML = h;
  }

  function paintType(word) {
    var meta = D.get(word) || { w: word, p: '', t: '' };
    var isDict = sess.mode === 'dictation';
    var h = headBar();
    h += '<div class="flash">';
    h += '<div class="row tight">' + tags(word) + '<div class="sp"></div>' +
      '<button class="btn tiny" data-act="speak">🔊 再听一遍</button>' +
      '<button class="btn tiny ghost" data-act="speak-slow">🐢 慢速</button></div>';
    h += '<div style="padding:14px 0">';
    if (isDict) {
      h += '<div class="flash-word" style="font-size:30px;color:var(--muted)">' +
        (sess.checked ? U.esc(word) : '🔊 听发音，写出单词') + '</div>';
      if (sess.checked && meta.p) h += '<div class="flash-phon">/' + U.esc(meta.p) + '/</div>';
    } else {
      h += '<div class="flash-zh" style="font-size:26px">' + U.esc(meta.t) + '</div>' +
        '<div class="flash-phon">' + (meta.p ? '/' + U.esc(meta.p) + '/' : '') + '</div>' +
        '<div class="tiny-t muted" style="margin-top:6px">根据中文写出英文单词</div>';
    }
    h += '</div>';
    h += '<input class="big-input' + (sess.checked ? (sess.spellOK ? ' ok' : ' bad') : '') +
      '" id="typeIn" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
      'placeholder="在这里输入英文…" value="' + U.esc(sess.typed) + '"' + (sess.checked ? ' disabled' : '') + '>';
    if (sess.checked) {
      h += '<div class="row mt"><span class="chip ' + (sess.spellOK ? 'ok' : 'bad') + '">' +
        (sess.spellOK ? '✅ 拼写正确' : '❌ 正确答案：' + word) + '</span></div>';
      h += backSide(word);
    }
    h += '</div>';
    h += sess.checked
      ? gradesRow(sess.spellOK ? 4 : 0)
      : '<div class="row mt"><button class="btn primary block big" data-act="check">检查（回车）</button>' +
        '<button class="btn ghost" data-act="giveup">想不起来，看答案</button></div>';
    host.innerHTML = h;
    var inp = U.$('#typeIn', host);
    if (inp && !sess.checked) { inp.focus(); }
  }

  function paintSummary() {
    var sec = Math.round((sess.finished.ms || 0) / 1000);
    var rate = U.pct(sess.good, Math.max(1, sess.good + sess.again));
    var againWords = sess.queue.concat(Object.keys(sess.retry));
    var h = '<div class="card center" style="padding:34px 22px">' +
      '<h1>本组完成 🎉</h1>' +
      '<div class="grid g3 mt" style="max-width:640px;margin:18px auto 0">' +
      '<div class="stat"><div class="k">本组词数</div><div class="v">' + sess.unique + '</div></div>' +
      '<div class="stat"><div class="k">新词 / 复习</div><div class="v">' + sess.newCount + '<small>/' + sess.revCount + '</small></div></div>' +
      '<div class="stat"><div class="k">记得率</div><div class="v">' + rate + '<small>%</small></div></div>' +
      '</div>' +
      '<p class="muted small mt">用时约 ' + Math.max(1, Math.round(sec / 60)) + ' 分钟 · 忘记 ' + sess.again + ' 次</p>' +
      '</div>';

    var o = ST.overview();
    h += '<div class="card mt"><div class="card-h"><h3>接下来</h3></div>' +
      '<div class="row">' +
      '<button class="btn primary" data-act="next">再来一组</button>' +
      '<button class="btn" data-go="quiz">做一组题</button>' +
      '<button class="btn" data-go="exam">读一篇短文</button>' +
      '<button class="btn ghost" data-go="home">回首页</button>' +
      '</div>' +
      '<div class="kv mt">' +
      '<dt>已学单词</dt><dd>' + o.seen + ' / ' + o.focusTotal + '（' + o.coverage + '%）</dd>' +
      '<dt>已掌握</dt><dd>' + o.mastered + ' 词</dd>' +
      '<dt>连续打卡</dt><dd>' + o.streak + ' 天</dd>' +
      '</div></div>';

    host.innerHTML = h;
    U.on(host, 'click', '[data-go]', function (e, t) { C.app.go(t.dataset.go); });
    U.on(host, 'click', '[data-act="next"]', function () {
      var keep = { mode: sess.mode, source: sess.source, limit: ST.data().profile.sessionSize || 0 };
      sess = null;
      begin(keep);
      if (!sess) { U.toast('今天该学的都学完啦'); paint(); }
    });
  }

  function paint() {
    if (!host) return;
    if (!sess) { renderSetup(); return; }
    if (sess.finished) { paintSummary(); return; }
    var word = curWord();
    if (!word) { finishSession(); return; }
    if (sess.mode === 'flash') paintFlash(word);
    else {
      paintType(word);
      if (sess.mode === 'dictation' && sess.spokeFor !== word) {
        sess.spokeFor = word;
        U.speak(word, { rate: 0.85 });
      }
    }
  }

  /* ---------------- 交互 ---------------- */
  function doCheck() {
    var word = curWord();
    if (!word) return;
    var inp = U.$('#typeIn', host);
    sess.typed = inp ? inp.value : sess.typed;
    if (!inp) return;
    sess.typed = inp.value;
    sess.spellOK = inp.value.trim().toLowerCase() === word.toLowerCase();
    sess.checked = true;
    if (!sess.spellOK) U.speak(word);
    paint();
  }

  function bind() {
    U.on(host, 'click', '[data-g]', function (e, t) { grade(+t.dataset.g); });
    U.on(host, 'click', '[data-act="flip"]', function () { sess.revealed = true; paint(); });
    U.on(host, 'click', '[data-act="speak"]', function () {
      var wd = curWord();
      if (wd) U.speak(wd, { rate: 0.85 });
    });
    U.on(host, 'click', '[data-act="speak-slow"]', function () {
      var wd = curWord();
      if (wd) U.speak(wd, { rate: 0.55 });
    });
    U.on(host, 'click', '[data-act="speak-ex"]', function () {
      var wd = curWord(), ex = wd && D.exFor(wd);
      if (ex) U.speak(ex.en, { rate: 0.85 });
    });
    U.on(host, 'click', '[data-act="check"]', doCheck);
    U.on(host, 'click', '[data-act="giveup"]', function () {
      var inp = U.$('#typeIn', host);
      if (inp) { sess.typed = inp.value = ''; }
      sess.checked = true; sess.spellOK = false;
      var wd = curWord(); if (wd) U.speak(wd);
      paint();
    });
    U.on(host, 'click', '[data-act="quit"]', function () {
      if (!sess) return;
      sess.finished = { ms: Date.now() - sess.start };
      ST.logTime(sess.finished.ms); ST.saveNow();
      paint();
    });
    U.on(host, 'input', '#typeIn', function (e, t) { sess.typed = t.value; });
  }

  /* ---------------- 键盘 ---------------- */
  function key(e) {
    if (!sess || sess.finished) return;
    if (e.key === 'Escape') { e.preventDefault(); C.app.go('home'); return; }
    if (sess.mode !== 'flash') {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!sess.checked) doCheck();
        else grade(sess.spellOK ? 4 : 0);
        return;
      }
      if (sess.checked) {
        var m = { '1': 0, '2': 3, '3': 4, '4': 5 }[e.key];
        if (m !== undefined) { e.preventDefault(); grade(m); }
      }
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!sess.revealed) { sess.revealed = true; paint(); }
      return;
    }
    if (sess.revealed) {
      var map = { '1': 0, '2': 3, '3': 4, '4': 5 };
      if (map[e.key] !== undefined) { e.preventDefault(); grade(map[e.key]); }
    }
    if (e.key === 's' || e.key === 'S') {
      var wd = curWord(); if (wd) U.speak(wd, { rate: 0.85 });
    }
  }

  /* ---------------- 入口 ---------------- */
  function render(elHost, params) {
    host = elHost;
    sess = null;
    bind();
    if (params && params.mode) begin({ mode: params.mode, source: params.source || 'daily', limit: ST.data().profile.sessionSize || 0 });
    else paint();
  }

  function leave() {
    if (sess && !sess.finished && sess.done > 0) {
      ST.logTime(Date.now() - sess.start);
      ST.saveNow();
    }
    U.stopSpeak();
    sess = null;
    host = null;
  }

  C.views = C.views || {};
  C.views.learn = {
    title: '背单词', sub: '间隔重复 · 忘记的会自动回来',
    render: render, leave: leave, key: key
  };
})(window);
