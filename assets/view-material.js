/* ==========================================================================
   view-material.js — 备考资料：写作 / 翻译 / 语法 / 听力 / 阅读 / 词根词缀
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U, D = C.data;

  var host = null;
  var tab = 'writing';

  function arr(x) { return Array.isArray(x) ? x : []; }
  function S() { return D.study || {}; }
  function esc(s) { return U.esc(s); }

  var TABS = [
    ['writing', '写作'],
    ['translation', '翻译'],
    ['grammar', '语法'],
    ['listening', '听力'],
    ['reading', '阅读'],
    ['wordPower', '词根词缀']
  ];

  /* ---------- 小组件 ---------- */
  function acc(title, badge, body, open) {
    return '<details class="acc"' + (open ? ' open' : '') + '><summary>' +
      esc(title) + (badge ? '<span class="sp"></span><span class="chip">' + esc(badge) + '</span>' : '') +
      '</summary><div class="acc-body">' + body + '</div></details>';
  }
  function ulist(items, cls) {
    if (!arr(items).length) return '<p class="muted small">暂无内容。</p>';
    return '<ul class="' + (cls || 'small') + '" style="margin:0;padding-left:20px">' +
      arr(items).map(function (x) { return '<li style="margin-bottom:5px">' + esc(x) + '</li>'; }).join('') + '</ul>';
  }
  function exList(items) {
    if (!arr(items).length) return '';
    return '<div class="mt">' + arr(items).map(function (e) {
      return '<div style="padding:6px 0;border-bottom:1px dashed var(--line-soft)">' +
        '<div class="en-line">' + esc(e.en || '') +
        ' <button class="btn tiny ghost" data-say="' + esc(e.en || '') + '" style="padding:0 6px">🔊</button></div>' +
        '<div class="tiny-t muted">' + esc(e.zh || '') + '</div></div>';
    }).join('') + '</div>';
  }

  /* ---------- 写作 ---------- */
  function writingHTML() {
    var g = S().writing || {};
    var h = '';
    h += '<div class="card"><div class="card-h"><h2>四级写作</h2><div class="sp"></div>' +
      '<span class="chip">30 分钟 · 106.5 分</span></div>' +
      '<p class="small muted">四级作文评分看三件事：<b>内容切题、结构清楚、语言基本正确</b>。' +
      '先把模板背熟，保证结构和连接词不出错，再逐步把简单句换成好句子。</p></div>';

    var t = arr(g.templates);
    if (t.length) {
      h += '<div class="card mt"><div class="card-h"><h3>作文模板（' + t.length + ' 套）</h3></div>';
      t.forEach(function (x, i) {
        h += acc((i + 1) + '. ' + (x.title || ''), x.useWhen || '', 
          '<div class="tmpl">' + esc(x.body || '') + '</div>' + ulist(x.tips, 'small'), i === 0);
      });
      h += '</div>';
    }

    var sp = arr(g.sentencePatterns);
    if (sp.length) {
      h += '<div class="card mt"><div class="card-h"><h3>万能句型（' + sp.length + ' 条）</h3>' +
        '<div class="sp"></div><span class="tiny-t muted">点 🔊 可听读</span></div>';
      sp.forEach(function (x) {
        h += '<div class="pattern"><div class="pe">' + esc(x.pattern || '') +
          ' <button class="btn tiny ghost" data-say="' + esc(x.pattern || '') + '" style="padding:0 6px">🔊</button>' +
          (x.example ? '<div class="tiny-t muted" style="font-family:var(--sans);margin-top:4px">例：' + esc(x.example) + '</div>' : '') +
          '</div><div class="pz">' + esc(x.zh || '') +
          (x.usage ? '<div class="tiny-t muted">' + esc(x.usage) + '</div>' : '') + '</div></div>';
      });
      h += '</div>';
    }

    var cn = arr(g.connectives);
    if (cn.length) {
      h += '<div class="card mt"><div class="card-h"><h3>连接词</h3></div><table class="tb"><tbody>';
      cn.forEach(function (x) {
        h += '<tr><td class="nowrap"><b>' + esc(x.function || '') + '</b></td><td>' +
          arr(x.words).map(function (w) { return '<span class="chip" style="margin:2px">' + esc(w) + '</span>'; }).join('') +
          '</td></tr>';
      });
      h += '</tbody></table></div>';
    }

    var cm = arr(g.commonMistakes);
    if (cm.length) {
      h += '<div class="card mt"><div class="card-h"><h3>高频错误（' + cm.length + ' 条）</h3></div>' +
        '<table class="tb"><thead><tr><th>常见写法</th><th>正确写法</th><th>原因</th></tr></thead><tbody>';
      cm.forEach(function (x) {
        h += '<tr><td style="color:var(--bad)">' + esc(x.wrong || '') + '</td>' +
          '<td style="color:var(--ok)">' + esc(x.right || '') + '</td>' +
          '<td class="small muted">' + esc(x.why || '') + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    return h;
  }

  /* ---------- 翻译 ---------- */
  function translationHTML() {
    var g = S().translation || {};
    var h = '<div class="card"><div class="card-h"><h2>四级翻译</h2><div class="sp"></div>' +
      '<span class="chip">30 分钟 · 106.5 分</span></div>' +
      '<p class="small muted">翻译考的是「把中文意思用正确的英文说清楚」。' +
      '关键词不会写就先换成你会写的简单词，<b>语法正确比词汇高级更重要</b>。</p>' +
      '<div class="mt"><b class="small">解题步骤</b>' + ulist(g.strategy) + '</div></div>';

    var tp = arr(g.topics);
    if (tp.length) {
      h += '<div class="card mt"><div class="card-h"><h3>高频话题词汇（' + tp.length + ' 个话题）</h3></div>';
      tp.forEach(function (x, i) {
        var body = '<table class="tb"><tbody>' + arr(x.phrases).map(function (p) {
          return '<tr><td class="nowrap">' + esc(p.zh || '') + '</td><td>' + esc(p.en || '') +
            ' <button class="btn tiny ghost" data-say="' + esc(p.en || '') + '" style="padding:0 6px">🔊</button></td></tr>';
        }).join('') + '</tbody></table>';
        h += acc(x.title || '', arr(x.phrases).length + ' 条', body, i === 0);
      });
      h += '</div>';
    }

    var pr = arr(g.practice);
    if (pr.length) {
      h += '<div class="card mt"><div class="card-h"><h3>翻译练习（' + pr.length + ' 题）</h3>' +
        '<div class="sp"></div><span class="tiny-t muted">先自己写，再对照参考译文</span></div>';
      pr.forEach(function (x, i) {
        var body = '<div class="q-passage">' + esc(x.zh || '') + '</div>' +
          '<button class="btn tiny primary" data-rev="' + i + '">对照参考译文</button>' +
          '<div class="hidden mt" id="rev_' + i + '">' +
          '<div class="flash-ex"><div class="en">' + esc(x.ref || '') +
          ' <button class="btn tiny ghost" data-say="' + esc(x.ref || '') + '" style="padding:0 6px">🔊</button></div></div>' +
          '<div class="mt"><b class="small">采分点</b>' + ulist(x.points) + '</div></div>';
        h += acc((i + 1) + '. ' + (x.zh || '').slice(0, 26) + '…', '', body);
      });
      h += '</div>';
    }
    return h;
  }

  /* ---------- 语法 ---------- */
  function grammarHTML() {
    var g = arr((S().grammar));
    var h = '<div class="card"><div class="card-h"><h2>四级语法重点</h2><div class="sp"></div>' +
      '<span class="chip">' + g.length + ' 个考点</span></div>' +
      '<p class="small muted">基础一般的话，语法不用系统重学一遍。把这 ' + g.length +
      ' 个四级最常考的考点弄明白，阅读长句和写作基本就够用了。</p></div>';
    g.forEach(function (x, i) {
      var body = '<p class="small">' + esc(x.summary || '') + '</p>' +
        '<b class="small">规则</b>' + ulist(x.rules) +
        exList(x.examples) +
        (arr(x.pitfalls).length ? '<div class="mt"><b class="small" style="color:var(--warn)">易错点</b>' + ulist(x.pitfalls) + '</div>' : '');
      h += '<div class="mt">' + acc((i + 1) + '. ' + (x.title || ''), '', body, i === 0) + '</div>';
    });
    return h;
  }

  /* ---------- 听力 / 阅读 ---------- */
  function listeningHTML() {
    var g = S().listening || {};
    var h = '<div class="card"><div class="card-h"><h2>听力</h2><div class="sp"></div>' +
      '<span class="chip">25 分钟 · 248.5 分</span></div>' +
      '<p class="small muted">听力占分很高，而且最容易短期提分。' +
      '核心方法：<b>提前读选项 → 划关键词 → 听到什么就选什么（四级答案通常直接对应原文）</b>。</p>' +
      '<div class="mt"><b class="small">应对策略</b>' + ulist(g.strategy) + '</div></div>';

    var sg = arr(g.signals);
    if (sg.length) {
      h += '<div class="card mt"><div class="card-h"><h3>听力信号词（' + sg.length + ' 个）</h3>' +
        '<div class="sp"></div><span class="tiny-t muted">这些词后面常常就是答案</span></div>' +
        '<table class="tb"><tbody>' + sg.map(function (x) {
          return '<tr><td class="nowrap"><b>' + esc(x.en || '') + '</b>' +
            ' <button class="btn tiny ghost" data-say="' + esc(x.en || '') + '" style="padding:0 6px">🔊</button></td>' +
            '<td class="small">' + esc(x.zh || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (arr(g.tips).length) {
      h += '<div class="card mt"><div class="card-h"><h3>实操技巧</h3></div>' + ulist(g.tips) + '</div>';
    }
    h += '<div class="card mt"><div class="card-h"><h3>在这里练</h3></div>' +
      '<p class="small muted">本机没有四级真题音频。用「句子听写」练耳朵：把听到的英文写下来，' +
      '漏掉和写错的词就是你听不出来的地方。</p>' +
      '<button class="btn primary" data-go-tab="listening">去做句子听写</button></div>';
    return h;
  }

  function readingHTML() {
    var g = S().reading || {};
    var h = '<div class="card"><div class="card-h"><h2>阅读</h2><div class="sp"></div>' +
      '<span class="chip">40 分钟 · 248.5 分</span></div>' +
      '<p class="small muted">阅读的三个部分：选词填空（10 题，分值最低）、长篇匹配（10 题）、仔细阅读（10 题，分值最高）。' +
      '做题顺序建议<b>先仔细阅读，再长篇匹配，最后选词填空</b>。</p>' +
      '<div class="mt"><b class="small">通用策略</b>' + ulist(g.strategy) + '</div></div>';

    var qt = arr(g.questionTypes);
    if (qt.length) {
      h += '<div class="card mt"><div class="card-h"><h3>题型解法</h3></div><table class="tb"><tbody>' +
        qt.map(function (x) {
          return '<tr><td class="nowrap"><b>' + esc(x.type || '') + '</b></td><td class="small">' + esc(x.how || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (arr(g.tips).length) {
      h += '<div class="card mt"><div class="card-h"><h3>实操技巧</h3></div>' + ulist(g.tips) + '</div>';
    }
    h += '<div class="card mt"><div class="card-h"><h3>在这里练</h3></div>' +
      '<p class="small muted">' + D.passages.length + ' 篇原创四级难度短文，共 ' +
      D.passages.length * 5 + ' 道题。读的时候点生词就能查，做完看中文翻译精读。</p>' +
      '<button class="btn primary" data-go-tab="reading">去读一篇</button></div>';
    return h;
  }

  /* ---------- 词根词缀 ---------- */
  function wordPowerHTML() {
    var g = S().wordPower || {};
    var h = '<div class="card"><div class="card-h"><h2>词根词缀记忆法</h2></div>' +
      '<p class="small muted">四级词汇量 4700 左右，全靠死记会很痛苦。' +
      '掌握常见词根词缀之后，看到一个生词能猜出大概意思——这对阅读尤其有用。</p>' +
      ulist(g.tips) + '</div>';

    var rt = arr(g.roots);
    if (rt.length) {
      h += '<div class="card mt"><div class="card-h"><h3>高频词根（' + rt.length + ' 个）</h3></div>';
      rt.forEach(function (x, i) {
        var body = '<p class="small muted">' + esc(x.note || '') + '</p><table class="tb"><tbody>' +
          arr(x.words).map(function (w2) {
            return '<tr><td class="nowrap"><b>' + esc(w2.w || '') + '</b></td>' +
              '<td class="nowrap small">' + esc(w2.zh || '') + '</td>' +
              '<td class="small muted">' + esc(w2.logic || '') + '</td></tr>';
          }).join('') + '</tbody></table>';
        h += acc(x.root + ' — ' + (x.meaning || ''), arr(x.words).length + ' 词', body, i === 0);
      });
      h += '</div>';
    }

    function affixTable(list, label) {
      if (!arr(list).length) return '';
      return '<div class="card mt"><div class="card-h"><h3>' + label + '（' + list.length + ' 个）</h3></div>' +
        '<table class="tb"><thead><tr><th>词缀</th><th>含义</th><th>例词</th></tr></thead><tbody>' +
        list.map(function (x) {
          return '<tr><td class="nowrap"><b>' + esc(x.affix || '') + '</b></td><td class="small">' + esc(x.meaning || '') + '</td>' +
            '<td class="small">' + arr(x.examples).map(function (e) {
              return esc(e.w || '') + ' <span class="muted">' + esc(e.zh || '') + '</span>';
            }).join('、') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    h += affixTable(g.prefixes, '常用前缀');
    h += affixTable(g.suffixes, '常用后缀');
    return h;
  }

  /* ---------- 调度 ---------- */
  function paint() {
    var body = U.$('#matBody', host);
    if (!body) return;
    var html = tab === 'writing' ? writingHTML()
      : tab === 'translation' ? translationHTML()
      : tab === 'grammar' ? grammarHTML()
      : tab === 'listening' ? listeningHTML()
      : tab === 'reading' ? readingHTML()
      : wordPowerHTML();
    body.innerHTML = html;
  }

  function render(h) {
    host = h;
    host.innerHTML =
      '<div class="tabs">' + TABS.map(function (t) {
        return '<button class="tab' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div id="matBody"></div>';

    U.on(host, 'click', '[data-tab]', function (e, t) { tab = t.dataset.tab; 
      U.$$('.tab', host).forEach(function (x) { x.classList.toggle('on', x.dataset.tab === tab); });
      paint(); U.stopSpeak();
    });
    U.on(host, 'click', '[data-say]', function (e, t) { e.stopPropagation(); U.speak(t.dataset.say, { rate: 0.88 }); });
    U.on(host, 'click', '[data-rev]', function (e, t) {
      var n = U.$('#rev_' + t.dataset.rev, host);
      if (n) n.classList.toggle('hidden');
    });
    U.on(host, 'click', '[data-go-tab]', function (e, t) {
      C.app.go('exam', { tab: t.dataset.goTab });
    });
    paint();
  }

  function leave() { U.stopSpeak(); host = null; }

  C.views = C.views || {};
  C.views.material = {
    title: '备考资料', sub: '写作模板 · 翻译话题 · 语法 · 词根词缀',
    render: render, leave: leave
  };
})(window);
