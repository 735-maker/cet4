/* ==========================================================================
   srs.js — 间隔重复调度（SM-2 变体，天粒度）
   评分：0 忘记 / 3 模糊 / 4 认识 / 5 熟练
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U;

  var S = {
    GRADES: [
      { g: 0, label: '忘记', hint: '完全没想起来', key: '1' },
      { g: 3, label: '模糊', hint: '想了半天', key: '2' },
      { g: 4, label: '认识', hint: '顺利想起', key: '3' },
      { g: 5, label: '熟练', hint: '秒懂，太简单', key: '4' }
    ],
    EASE0: 2.5,
    EASE_MIN: 1.3,
    EASE_MAX: 3.0
  };

  S.newCard = function (todayNum) {
    return { d: todayNum, iv: 0, e: S.EASE0, s: 0, n: 0, l: 0, t: 0, td: 0 };
  };

  /** 根据评分推进一张卡片，返回新卡片（不改原对象） */
  S.review = function (card, g, now) {
    var todayNum = U.dayNum(now || Date.now());
    var c = {
      d: card.d, iv: card.iv || 0, e: card.e || S.EASE0,
      s: card.s || 0, n: (card.n || 0) + 1, l: card.l || 0,
      t: now || Date.now(), td: todayNum
    };
    if (g === 0) {
      c.l += 1;
      c.e = Math.max(S.EASE_MIN, c.e - 0.20);
      c.iv = 0;
      c.s = 1;
      c.d = todayNum;                 // 今天再练（由会话队列负责重新插入）
    } else if (g === 3) {
      c.e = Math.max(S.EASE_MIN, c.e - 0.05);
      c.iv = c.iv > 0 ? Math.max(1, Math.round(c.iv * 1.2)) : 1;
      c.s = c.s >= 2 ? 2 : 1;
      c.d = todayNum + c.iv;
    } else if (g === 4) {
      c.iv = c.iv > 0 ? Math.max(2, Math.round(c.iv * c.e)) : 1;
      c.s = 2;
      c.d = todayNum + c.iv;
    } else {
      c.e = Math.min(S.EASE_MAX, c.e + 0.12);
      c.iv = c.iv > 0 ? Math.max(4, Math.round(c.iv * c.e * 1.25)) : 3;
      c.s = 2;
      c.d = todayNum + c.iv;
    }
    if (c.iv >= 21) c.s = 3;          // 21 天以上视为已掌握
    return c;
  };

  /** 当天是否需要复习（今天已复习过的不再重复进入队列） */
  S.isDue = function (card, todayNum) {
    if (!card) return false;
    if (card.td === todayNum) return false;
    return (card.d || 0) <= todayNum;
  };

  S.stateName = function (s) {
    return ({ 0: '新词', 1: '学习中', 2: '复习中', 3: '已掌握' })[s || 0] || '新词';
  };

  S.STATE_CHIP = { 0: '', 1: 'warn', 2: 'a', 3: 'ok' };

  /** 下次复习的中文说明 */
  S.nextText = function (card) {
    if (!card) return '—';
    if (card.d <= U.dayNum()) return '今天';
    var d = card.d - U.dayNum();
    return d === 1 ? '明天' : d + ' 天后';
  };

  /**
   * 计算今日队列
   * @returns {{reviews:Array, news:Array, dueTotal:number, newTotal:number,
   *            learnedToday:number, reviewedToday:number, remainNew:number}}
   */
  S.queue = function (state, focusWords, todayNum, opts) {
    opts = opts || {};
    var cards = state.cards || {};
    var tk = U.key(todayNum * U.DAY);
    var log = (state.logs && state.logs[tk]) || { nn: 0, rv: 0 };

    var reviews = [];
    for (var i = 0; i < focusWords.length; i++) {
      var wd = focusWords[i].w;
      var c = cards[wd];
      if (c && S.isDue(c, todayNum)) reviews.push(wd);
    }
    reviews.sort(function (a, b) { return (cards[a].d || 0) - (cards[b].d || 0); });

    var dailyNew = state.profile.dailyNew || 25;
    var extra = (state.extraNew && state.extraNew[tk]) || 0;
    var targetNew = dailyNew + extra;
    var remainNew = Math.max(0, targetNew - (log.nn || 0));

    var news = [];
    for (var j = 0; j < focusWords.length && news.length < remainNew; j++) {
      var w2 = focusWords[j].w;
      if (!cards[w2]) news.push(w2);
    }

    return {
      reviews: reviews.slice(0, opts.reviewCap || state.profile.reviewCap || 150),
      news: news,
      dueTotal: reviews.length,
      newTotal: remainNew,
      learnedToday: log.nn || 0,
      reviewedToday: log.rv || 0,
      targetNew: targetNew
    };
  };

  /** 今日是否已完成（新词和复习都清空） */
  S.isDoneToday = function(q) {
    return q.reviews.length === 0 && q.news.length === 0;
  };

  C.srs = S;
})(window);
