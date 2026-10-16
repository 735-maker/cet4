/* ==========================================================================
   data.js — 词库 / 例句 / 题库 / 阅读 / 资料 的访问层
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U;

  var D = {
    words: w.CET4_WORDS || [],
    examples: w.CET4_EXAMPLES || {},
    questions: (w.CET4_QUESTIONS && w.CET4_QUESTIONS.items) || [],
    passages: (w.CET4_PASSAGES && w.CET4_PASSAGES.passages) || [],
    study: w.CET4_STUDY || {},
    byWord: {},
    _focus: {}
  };

  D.init = function () {
    D.words.forEach(function (x) { D.byWord[x.w] = x; });
    return D;
  };

  D.get = function (word) { return D.byWord[word] || null; };
  D.exFor = function (word) { return D.examples[word] || null; };

  D.LEVEL_NAME = { 1: '初中基础', 2: '高中', 3: '四级核心' };
  D.TIER_NAME = { 1: '高频必背', 2: '常考', 3: '一般', 4: '低频' };

  /** 学习范围：默认排除初中基础词（学生多半已会） */
  D.focus = function (includeLevel1) {
    var k = includeLevel1 ? 'all' : 'l2';
    if (D._focus[k]) return D._focus[k];
    var list = includeLevel1 ? D.words.slice()
      : D.words.filter(function (x) { return (x.lvl || 3) >= 2; });
    D._focus[k] = list;
    return list;
  };

  D.stats = function () {
    var t = { 1: 0, 2: 0, 3: 0, 4: 0 }, l = { 1: 0, 2: 0, 3: 0 };
    D.words.forEach(function (x) {
      t[x.tier] = (t[x.tier] || 0) + 1;
      l[x.lvl] = (l[x.lvl] || 0) + 1;
    });
    return {
      total: D.words.length, tier: t, level: l,
      withExample: Object.keys(D.examples).length,
      questions: D.questions.length,
      passages: D.passages.length
    };
  };

  /** 按分类取题 */
  D.questionsByCat = function (cat) {
    if (!cat || cat === 'all') return D.questions.slice();
    return D.questions.filter(function (q) { return q.cat === cat; });
  };

  D.CAT_NAME = {
    vocab: '词汇辨析',
    grammar: '语法',
    cloze: '语境填空',
    phrase: '固定搭配'
  };

  /** 生成一道「看英文选中文」的干扰项（供扩展练习使用） */
  D.distractors = function (word, n) {
    var pool = D.focus(false);
    var out = [], self = D.get(word);
    if (!self) return out;
    var guard = 0;
    while (out.length < (n || 3) && guard++ < 300) {
      var c = pool[Math.floor(Math.random() * pool.length)];
      if (!c || c.w === word) continue;
      if (c.t === self.t) continue;
      if (out.some(function (o) { return o.t === c.t; })) continue;
      out.push(c);
    }
    return out;
  };

  /** 听写/拼写用的英文句子池 */
  D.sentencePool = function (maxWords) {
    var out = [];
    Object.keys(D.examples).forEach(function (k) {
      var e = D.examples[k];
      if (!e || !e.en) return;
      var n = e.en.split(/\s+/).length;
      if (maxWords && n > maxWords) return;
      out.push({ w: k, en: e.en, zh: e.zh });
    });
    return out;
  };

  C.data = D;
})(window);
