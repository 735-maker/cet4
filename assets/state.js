/* ==========================================================================
   state.js — 应用状态、打卡、统计、计划、备份
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U, D = C.data, SRS = C.srs;

  var S = { s: null, _timer: null };

  function defaults() {
    var t = U.today();
    return {
      v: 1,
      profile: {
        examDate: U.addDays(t, 120),
        dailyNew: 25,
        reviewCap: 150,
        includeLevel1: false,
        autoSpeak: true,
        sessionSize: 20,
        createdAt: Date.now()
      },
      cards: {},
      logs: {},
      mistakes: {},
      quiz: { total: 0, right: 0, byCat: {} },
      extraNew: {},
      streak: { cur: 0, best: 0, last: '' },
      reading: {},
      backups: { last: 0 },
      ui: { theme: 'dark' }
    };
  }

  S.init = function (loaded) {
    var base = defaults();
    S.s = loaded && typeof loaded === 'object' ? loaded : base;
    // 补齐缺失字段，兼容旧存档
    Object.keys(base).forEach(function (k) {
      if (S.s[k] === undefined || S.s[k] === null) S.s[k] = base[k];
    });
    Object.keys(base.profile).forEach(function (k) {
      if (S.s.profile[k] === undefined) S.s.profile[k] = base.profile[k];
    });
    ['cards', 'logs', 'mistakes', 'extraNew', 'reading'].forEach(function (k) {
      if (typeof S.s[k] !== 'object' || Array.isArray(S.s[k])) S.s[k] = {};
    });
    if (typeof S.s.quiz !== 'object') S.s.quiz = base.quiz;
    if (typeof S.s.streak !== 'object') S.s.streak = base.streak;
    U.setTheme(S.s.ui.theme);
    return S.s;
  };

  S.data = function () { return S.s; };

  S.save = function () {
    if (S._timer) clearTimeout(S._timer);
    S._timer = setTimeout(function () { C.store.save(S.s); }, 240);
  };
  S.saveNow = function () {
    if (S._timer) { clearTimeout(S._timer); S._timer = null; }
    return C.store.save(S.s);
  };

  /* ---------------- 打卡 ---------------- */
  S.touch = function () {
    var t = U.today(), st = S.s.streak;
    if (st.last === t) return;
    st.cur = (st.last && U.daysBetween(st.last, t) === 1) ? (st.cur || 0) + 1 : 1;
    st.last = t;
    if (st.cur > (st.best || 0)) st.best = st.cur;
  };

  function logOf(k) {
    if (!S.s.logs[k]) S.s.logs[k] = { nn: 0, rv: 0, qz: 0, qr: 0, ms: 0, rd: 0 };
    var l = S.s.logs[k];
    if (l.nn === undefined) l.nn = 0;
    if (l.rv === undefined) l.rv = 0;
    if (l.qz === undefined) l.qz = 0;
    if (l.qr === undefined) l.qr = 0;
    if (l.ms === undefined) l.ms = 0;
    if (l.rd === undefined) l.rd = 0;
    return l;
  }
  S.todayLog = function () { return logOf(U.today()); };

  /** 记录一次单词学习：kind = 'new' | 'rev' */
  S.logStudy = function (kind, n) {
    var l = logOf(U.today());
    if (kind === 'new') l.nn += (n || 1); else l.rv += (n || 1);
    S.touch(); S.save();
  };
  S.logTime = function (ms) {
    var l = logOf(U.today());
    l.ms += Math.max(0, ms || 0);
    S.save();
  };
  S.logQuiz = function (cat, right) {
    var l = logOf(U.today());
    l.qz += 1; if (right) l.qr += 1;
    S.s.quiz.total += 1; if (right) S.s.quiz.right += 1;
    var bc = S.s.quiz.byCat[cat || 'other'] || { t: 0, r: 0 };
    bc.t += 1; if (right) bc.r += 1;
    S.s.quiz.byCat[cat || 'other'] = bc;
    S.touch(); S.save();
  };
  S.logReading = function () {
    var l = logOf(U.today());
    l.rd += 1;
    S.touch(); S.save();
  };

  /** 写入单词卡片 */
  S.putCard = function (word, card) { S.s.cards[word] = card; S.save(); };
  S.getCard = function (word) { return S.s.cards[word]; };

  /* ---------------- 错题本 ---------------- */
  S.addMistake = function (qid) {
    var m = S.s.mistakes[qid] || { n: 0, right: 0, at: 0 };
    m.n += 1; m.right = 0; m.at = Date.now();
    S.s.mistakes[qid] = m;
    S.save();
  };
  S.rightOnMistake = function (qid) {
    var m = S.s.mistakes[qid];
    if (!m) return;
    m.right = (m.right || 0) + 1;
    m.at = Date.now();
    if (m.right >= 2) delete S.s.mistakes[qid];   // 连对两次移出
    S.save();
  };
  S.mistakeList = function () {
    return Object.keys(S.s.mistakes).map(function (id) {
      return { id: id, m: S.s.mistakes[id] };
    });
  };

  /* ---------------- 进度 ---------------- */
  S.cardProgress = function () {
    var c = S.s.cards, o = { learning: 0, review: 0, mastered: 0, total: 0 };
    Object.keys(c).forEach(function (k) {
      var s = c[k].s || 0;
      o.total++;
      if (s >= 3) o.mastered++;
      else if (s === 2) o.review++;
      else o.learning++;
    });
    return o;
  };

  S.overview = function () {
    var focus = D.focus(S.s.profile.includeLevel1);
    var p = S.cardProgress();
    var left = U.daysBetween(U.today(), S.s.profile.examDate);
    var seen = p.total;
    return {
      focusTotal: focus.length,
      seen: seen,
      unseen: Math.max(0, focus.length - seen),
      learning: p.learning,
      review: p.review,
      mastered: p.mastered,
      coverage: U.pct(seen, focus.length),
      masterRate: U.pct(p.mastered, focus.length),
      daysLeft: left,
      streak: S.s.streak.cur || 0,
      best: S.s.streak.best || 0
    };
  };

  /** 近 n 天活动量（前 84 天用于热力图） */
  S.heat = function (n) {
    n = n || 84;
    var out = [], t = U.today();
    for (var i = n - 1; i >= 0; i--) {
      var k = U.addDays(t, -i);
      var l = S.s.logs[k];
      var v = l ? (l.nn || 0) + (l.rv || 0) + (l.qz || 0) : 0;
      out.push({ k: k, v: v, l: l || null });
    }
    return out;
  };

  function heatLevel(v) {
    if (!v) return 0;
    if (v < 20) return 1;
    if (v < 50) return 2;
    if (v < 100) return 3;
    return 4;
  }
  S.heatLevel = heatLevel;

  /** 备考计划 */
  S.plan = function () {
    var left = U.daysBetween(U.today(), S.s.profile.examDate);
    var o = S.overview();
    var phases = [
      { min: 90, name: '基础强化期', focus: '高频词 + 语法 + 长难句', desc: '这个阶段不用急着刷整套题。把四级高频词过一遍，同时把语法漏洞补上——语法是阅读和写作的地基。' },
      { min: 55, name: '专项突破期', focus: '听力 + 阅读 + 翻译', desc: '词汇有底子之后，开始分题型突破。听力每天必练，阅读练定位和速度，翻译背高频话题词汇。' },
      { min: 25, name: '真题实战期', focus: '整套限时 + 错题复盘', desc: '按考试时间做整套模考，重点不是分数，而是找出「时间不够」和「反复错」的地方。' },
      { min: -999, name: '冲刺保分期', focus: '复习错题 + 作文模板 + 保持手感', desc: '不再大量背新词。把错题本、作文模板、翻译高频词反复过，保持每天有输入。' }
    ];
    var ph = phases[0];
    for (var i = 0; i < phases.length; i++) {
      if (left >= phases[i].min) { ph = phases[i]; break; }
    }
    var need = o.unseen;
    var usableDays = Math.max(1, Math.round(Math.max(left, 1) * 0.7)); // 后 30% 留给复习
    var suggest = Math.max(10, Math.ceil(need / usableDays / 5) * 5);
    return {
      left: left, phase: ph,
      suggestDaily: suggest,
      onTrack: need === 0 || (S.s.profile.dailyNew >= suggest * 0.7),
      need: need
    };
  };

  /* ---------------- 备份 ---------------- */
  S.exportText = function () {
    return JSON.stringify({
      app: 'cet4-tutor', exportedAt: new Date().toISOString(), state: S.s
    }, null, 2);
  };
  S.importText = function (text) {
    var j = JSON.parse(text);
    var st = j && j.state ? j.state : j;
    if (!st || typeof st !== 'object' || !st.profile) throw new Error('文件格式不正确');
    S.init(st);
    return S.saveNow();
  };
  S.markBackup = function () {
    S.s.backups.last = Date.now();
    S.save();
  };
  S.backupAgeDays = function () {
    var last = S.s.backups.last;
    if (!last) return 999;
    return Math.floor((Date.now() - last) / U.DAY);
  };

  S.reset = function () {
    S.s = defaults();
    return C.store.clearAll().then(function () { return S.saveNow(); });
  };

  C.state = S;
})(window);
