/* ==========================================================================
   view-exam.js — 仔细阅读 / 听力训练 / 限时模考
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U, D = C.data, ST = C.state;

  var host = null;
  var tab = 'reading';

  /* ==================== 简易查词（含常见词形还原） ==================== */
  function lookup(word) {
    var wd = String(word).toLowerCase();
    var hit = D.byWord[wd];
    if (hit) return hit;
    var tries = [];
    if (/ies$/.test(wd)) tries.push(wd.replace(/ies$/, 'y'));
    if (/es$/.test(wd)) tries.push(wd.slice(0, -2));
    if (/s$/.test(wd)) tries.push(wd.slice(0, -1));
    if (/ied$/.test(wd)) tries.push(wd.replace(/ied$/, 'y'));
    if (/ed$/.test(wd)) { tries.push(wd.slice(0, -2)); tries.push(wd.slice(0, -1)); }
    if (/ing$/.test(wd)) { tries.push(wd.slice(0, -3)); tries.push(wd.slice(0, -3) + 'e'); }
    if (/ly$/.test(wd)) tries.push(wd.slice(0, -2));
    if (/er$/.test(wd)) tries.push(wd.slice(0, -2));
    if (/est$/.test(wd)) tries.push(wd.slice(0, -3));
    for (var i = 0; i < tries.length; i++) if (D.byWord[tries[i]]) return D.byWord[tries[i]];
    return null;
  }

  function wordPopup(raw) {
    var meta = lookup(raw);
    if (!meta) {
      U.speak(raw);
      U.toast('词库里没有「' + raw + '」，已朗读');
      return;
    }
    var ex = D.exFor(meta.w);
    var node = U.frag(
      '<h3 style="font-size:26px;margin-bottom:2px">' + U.esc(meta.w) + '</h3>' +
      '<div class="flash-phon" style="margin-bottom:10px">' + (meta.p ? '/' + U.esc(meta.p) + '/' : '') +
      ' <button class="btn tiny ghost" data-sp>' + '🔊 朗读</button></div>' +
      '<div class="flash-zh">' + U.esc(meta.t) + '</div>' +
      (meta.d ? '<div class="flash-def">' + U.esc(meta.d) + '</div>' : '') +
      (ex ? '<div class="flash-ex"><div class="en">' + U.esc(ex.en) + '</div><div class="zh">' + U.esc(ex.zh) + '</div></div>' : '') +
      '<div class="row mt"><span class="chip">' + (D.LEVEL_NAME[meta.lvl] || '') + '</span>' +
      '<span class="chip a">' + (D.TIER_NAME[meta.tier] || '') + '</span>' +
      '<div class="sp"></div><button class="btn" data-close>关闭</button></div>'
    );
    U.modalOpen(node);
    U.on(U.$('#modal'), 'click', '[data-close]', function () { U.modalClose(); });
    U.on(U.$('#modal'), 'click', '[data-sp]', function () { U.speak(meta.w); });
  }

  /** 把英文段落变成可点查词的 HTML */
  function passageHTML(text) {
    var out = '', last = 0, re = /[A-Za-z][A-Za-z'-]{2,}/g, m;
    while ((m = re.exec(text)) !== null) {
      out += U.esc(text.slice(last, m.index));
      out += '<span class="wd" data-w="' + U.esc(m[0]) + '">' + U.esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    out += U.esc(text.slice(last));
    return out.split('\n\n').map(function (p) {
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  /* ==================== 阅读 ==================== */
  var rd = null;   // {p, picked, right, wrong}

  function readingList() {
    var st = ST.data();
    var h = '<div class="card"><div class="card-h"><h2>仔细阅读训练</h2><div class="sp"></div>' +
      '<span class="chip">共 ' + D.passages.length + ' 篇 · 每篇 5 题</span></div>' +
      '<p class="tiny-t muted">读的时候遇到生词，直接点那个词就能查释义和例句。做完题再看中文翻译精读一遍。</p>' +
      '</div><div class="grid g2 mt">';
    D.passages.forEach(function (p) {
      var r = st.reading[p.id];
      h += '<div class="card tight" style="cursor:pointer" data-pid="' + p.id + '">' +
        '<div class="row tight mb"><span class="chip a">' + U.esc(p.topic || '') + '</span>' +
        '<span class="chip">' + U.esc(p.difficulty || '') + '</span>' +
        (r ? '<span class="chip ok">已做 ' + r.right + '/' + r.total + '</span>' : '<span class="chip">未做</span>') +
        '</div>' +
        '<h3 style="margin-bottom:4px">' + U.esc(p.title) + '</h3>' +
        '<div class="tiny-t muted">' + (p.text || '').split(/\s+/).length + ' 词 · ' +
        (p.questions || []).length + ' 题</div></div>';
    });
    return h + '</div>';
  }

  function readingDetail(p) {
    rd = { p: p, picked: -1, right: 0, wrong: [] };
    paintReading();
  }

  function paintReading() {
    var p = rd.p;
    var qs = p.questions || [];
    var h = '<div class="row mb"><button class="btn tiny ghost" data-act="back">← 返回列表</button>' +
      '<span class="chip a">' + U.esc(p.topic || '') + '</span>' +
      '<span class="chip">' + U.esc(p.difficulty || '') + '</span>' +
      '<div class="sp"></div>' +
      '<button class="btn tiny" data-act="tts">🔊 朗读全文</button>' +
      '<button class="btn tiny ghost" data-act="stoptts">停止</button></div>';

    h += '<div class="card"><h2>' + U.esc(p.title) + '</h2>' +
      '<div class="q-passage" id="psg">' + passageHTML(p.text || '') + '</div>' +
      '<div class="row"><button class="btn tiny ghost" data-act="trans">显示 / 隐藏全文翻译</button>' +
      '<span class="tiny-t muted">提示：点击任意英文单词可查词</span></div>' +
      '<div id="transBox" class="hidden mt"><div class="q-passage" style="border-left:3px solid var(--accent)">' +
      passageHTML(p.translation || '').replace(/<span class="wd"[^>]*>|<\/span>/g, '') + '</div></div>';

    if (p.vocab && p.vocab.length) {
      h += '<div class="mt"><div class="tiny-t muted mb">本篇重点词</div><div class="row tight">' +
        p.vocab.map(function (v) {
          return '<span class="chip" style="cursor:pointer" data-w="' + U.esc(v.w) + '">' +
            U.esc(v.w) + ' <span class="muted">' + U.esc(v.zh) + '</span></span>';
        }).join('') + '</div></div>';
    }
    h += '</div>';

    h += '<div class="card mt"><div class="card-h"><h3>阅读理解</h3><div class="sp"></div>' +
      '<span class="chip ok">对 ' + rd.right + '</span><span class="chip bad">错 ' + rd.wrong.length + '</span></div>';

    qs.forEach(function (qq, qi) {
      var picked = rd.picks ? rd.picks[qi] : undefined;
      h += '<div style="padding:14px 0;border-bottom:1px dashed var(--line-soft)">' +
        '<div class="q-stem">' + (qi + 1) + '. ' + U.esc(qq.stem) + '</div><div class="opts">';
      qq.options.forEach(function (op, oi) {
        var cls = '';
        if (picked !== undefined) {
          if (oi === qq.answer) cls = ' ok';
          else if (oi === picked) cls = ' bad';
        }
        h += '<button class="opt' + cls + '" data-pick="' + qi + ':' + oi + '"' +
          (picked !== undefined ? ' disabled' : '') + '>' +
          '<span class="ol">' + 'ABCD'[oi] + '</span><span>' + U.esc(op) + '</span></button>';
      });
      h += '</div>';
      if (picked !== undefined) {
        h += '<div class="explain ' + (picked === qq.answer ? 'ok' : 'wrong') + '">' +
          '<b>' + (picked === qq.answer ? '✅ 正确' : '❌ 正确答案 ' + 'ABCD'[qq.answer]) + '</b>' +
          '<div style="margin-top:5px">' + U.esc(qq.explain || '') + '</div></div>';
      }
      h += '</div>';
    });
    h += '</div>';

    host.innerHTML = h;
    bindReading();
  }

  function bindReading() {
    U.on(host, 'click', '.wd, [data-w]', function (e, t) {
      e.stopPropagation();
      wordPopup(t.dataset.w);
    });
    U.on(host, 'click', '[data-act="back"]', function () { rd = null; paint(); });
    U.on(host, 'click', '[data-act="trans"]', function () { U.$('#transBox').classList.toggle('hidden'); });
    U.on(host, 'click', '[data-act="tts"]', function () {
      var parts = (rd.p.text || '').split(/\n\n/);
      U.speakSeq(parts, { rate: 0.9, gap: 450 });
      U.toast('开始朗读全文，可点「停止」中断');
    });
    U.on(host, 'click', '[data-act="stoptts"]', function () { U.stopSpeak(); });
    U.on(host, 'click', '[data-pick]', function (e, t) {
      var a = t.dataset.pick.split(':'), qi = +a[0], oi = +a[1];
      if (!rd.picks) rd.picks = {};
      if (rd.picks[qi] !== undefined) return;
      rd.picks[qi] = oi;
      var qq = rd.p.questions[qi];
      if (oi === qq.answer) rd.right++; else rd.wrong.push(qi);
      paintReading();
      // 全部做完 → 记录
      if (Object.keys(rd.picks).length === rd.p.questions.length) {
        var st = ST.data();
        var prev = st.reading[rd.p.id];
        st.reading[rd.p.id] = {
          right: Math.max(rd.right, prev ? prev.right : 0),
          total: rd.p.questions.length, at: Date.now()
        };
        ST.logReading();
        ST.saveNow();
        U.toast('本篇完成：答对 ' + rd.right + ' / ' + rd.p.questions.length + ' 题', rd.right >= 4 ? 'ok' : '');
      }
    });
  }

  /* ==================== 听力训练 ==================== */
  var ls = null;   // {items, idx, typed, checked, ok, score, total}

  function buildListening(n, level) {
    var pool = D.sentencePool(0);
    if (level === 'easy') pool = pool.filter(function (x) { return x.en.split(/\s+/).length <= 10; });
    pool = U.shuffle(pool).slice(0, n);
    return { items: pool, idx: 0, typed: '', checked: false, ok: false, right: 0, start: Date.now() };
  }

  function listeningSetup() {
    var h = '<div class="card"><div class="card-h"><h2>听力训练</h2><div class="sp"></div>' +
      '<span class="chip">' + (U.speechOK() ? '使用系统内置语音' : '当前浏览器不支持语音') + '</span></div>' +
      '<p class="small muted">四级听力考的是「听懂 + 抓关键信息」。这里用<b>句子听写</b>来练：听一句英文，把它完整写下来。' +
      '写不出来的地方，就是你没听出来的连读、弱读或生词。</p>' +
      '<div class="grid g3 mt">' +
      '<button class="btn" data-ls="10:easy" style="flex-direction:column;align-items:flex-start;height:auto;padding:14px"><b>短句听写 · 10 句</b><span class="tiny-t muted">每句 10 词以内，先练手感</span></button>' +
      '<button class="btn primary" data-ls="10:all" style="flex-direction:column;align-items:flex-start;height:auto;padding:14px"><b>常规听写 · 10 句</b><span class="tiny-t muted">四级难度的完整句子</span></button>' +
      '<button class="btn" data-ls="20:all" style="flex-direction:column;align-items:flex-start;height:auto;padding:14px"><b>强化听写 · 20 句</b><span class="tiny-t muted">一次练够，比较累但有效</span></button>' +
      '</div></div>';
    host.innerHTML = h;
    U.on(host, 'click', '[data-ls]', function (e, t) {
      var a = t.dataset.ls.split(':');
      ls = buildListening(+a[0], a[1]);
      if (!ls.items.length) { U.toast('题库不足'); return; }
      paintListening();
    });
  }

  /** 逐词比对，返回带标记的 HTML */
  function diffHTML(typed, target) {
    var a = typed.trim().toLowerCase().replace(/[.,!?;:"']/g, '').split(/\s+/).filter(Boolean);
    var b = target.toLowerCase().replace(/[.,!?;:"']/g, '').split(/\s+/).filter(Boolean);
    var out = '', n = Math.max(a.length, b.length), hit = 0;
    for (var i = 0; i < n; i++) {
      var x = a[i] || '', y = b[i] || '';
      if (!y) continue;
      if (x === y) { hit++; out += '<span style="color:var(--ok)">' + U.esc(y) + '</span> '; }
      else if (!x) out += '<span style="color:var(--bad);text-decoration:underline">' + U.esc(y) + '</span> ';
      else out += '<span style="color:var(--warn);text-decoration:underline dotted">' + U.esc(y) + '</span> ';
    }
    return { html: out, rate: U.pct(hit, b.length), hit: hit, total: b.length };
  }

  function paintListening() {
    if (!ls) { listeningSetup(); return; }
    var it = ls.items[ls.idx];
    var h = '<div class="row mb"><button class="btn tiny ghost" data-act="back">← 返回</button>' +
      '<span class="chip a">第 ' + (ls.idx + 1) + ' / ' + ls.items.length + ' 句</span>' +
      '<div class="sp"></div><span class="chip ok">已听对 ' + ls.right + '</span>' +
      '<button class="btn tiny ghost" data-act="quit">结束</button></div>';

    h += '<div class="card">' +
      '<div class="row mb" style="justify-content:center;gap:12px;padding:8px 0">' +
      '<button class="btn big" data-act="play">🔊 播放</button>' +
      '<button class="btn" data-act="slow">🐢 慢速</button>' +
      '</div>' +
      '<input class="big-input" id="lsIn" placeholder="听到什么就写什么，不必纠结大小写和标点…" ' +
      'value="' + U.esc(ls.typed) + '"' + (ls.checked ? ' disabled' : '') + '>';
    if (!ls.checked) {
      h += '<div class="row mt"><button class="btn primary block big" data-act="check">检查（回车）</button>' +
        '<button class="btn ghost" data-act="reveal">听不出来，看原文</button></div>';
    } else {
      var d = diffHTML(ls.typed, it.en);
      h += '<div class="mt"><div class="tiny-t muted mb">你的听写结果（绿色=听对，黄色=听错，红色=漏写）</div>' +
        '<div class="flash-ex"><div class="en" style="line-height:1.9">' + d.html + '</div>' +
        '<div class="zh" style="margin-top:6px">' + U.esc(it.zh) + '</div></div>' +
        '<div class="row mt"><span class="chip ' + (d.rate >= 90 ? 'ok' : d.rate >= 70 ? 'warn' : 'bad') + '">' +
        '本句正确率 ' + d.rate + '%（' + d.hit + '/' + d.total + ' 词）</span>' +
        '<span class="chip">含生词 ' + it.w + '</span>' +
        '<button class="btn tiny" data-act="detail">查这个词</button></div></div>' +
        '<div class="row mt"><button class="btn primary block big" data-act="next">' +
        (ls.idx + 1 >= ls.items.length ? '看结果（回车）' : '下一句（回车）') + '</button></div>';
    }
    h += '</div>';

    if (ls.checked && ls.items[ls.idx].w) {
      var exm = D.get(ls.items[ls.idx].w);
      if (exm) {
        h += '<div class="card tight mt small muted">本句重点词 <b style="color:var(--text)">' + U.esc(exm.w) +
          '</b> ' + U.esc(exm.t) + '</div>';
      }
    }

    host.innerHTML = h;
    var inp = U.$('#lsIn', host);
    if (inp && !ls.checked) inp.focus();
    U.on(host, 'click', '[data-act="play"]', function () { U.speak(it.en, { rate: 0.9 }); });
    U.on(host, 'click', '[data-act="slow"]', function () { U.speak(it.en, { rate: 0.6 }); });
    U.on(host, 'input', '#lsIn', function (e, t) { ls.typed = t.value; });
    U.on(host, 'click', '[data-act="detail"]', function () { wordPopup(it.w); });
    U.on(host, 'click', '[data-act="reveal"]', function () { ls.typed = ''; ls.checked = true; paintListening(); });
    U.on(host, 'click', '[data-act="check"]', function () {
      var i2 = U.$('#lsIn', host);
      ls.typed = i2 ? i2.value : ls.typed;
      ls.checked = true;
      var d = diffHTML(ls.typed, it.en);
      if (d.rate >= 80) ls.right++;
      paintListening();
    });
    U.on(host, 'click', '[data-act="back"]', function () { ls = null; listeningSetup(); });
    U.on(host, 'click', '[data-act="quit"]', function () { ls = null; listeningSetup(); });
    U.on(host, 'click', '[data-act="next"]', function () {
      if (ls.idx + 1 >= ls.items.length) {
        var rate = U.pct(ls.right, ls.items.length);
        U.toast('听写完成：' + ls.right + ' / ' + ls.items.length + ' 句基本听对（' + rate + '%）', 'ok');
        ls = null; listeningSetup(); return;
      }
      ls.idx++; ls.typed = ''; ls.checked = false;
      paintListening();
      setTimeout(function () { U.speak(ls.items[ls.idx].en, { rate: 0.9 }); }, 260);
    });
    if (!ls.checked && ls.auto !== ls.idx) {
      ls.auto = ls.idx;
      setTimeout(function () { U.speak(it.en, { rate: 0.9 }); }, 200);
    }
  }

  /* ==================== 模考 ==================== */
  var ESSAYS = [
    { title: 'On the Importance of Reading', zh: '有人说在大学里读书比刷手机重要得多。请你就「阅读的重要性」写一篇短文。', outline: ['阅读能扩展知识面和视野', '阅读提升思考与表达能力', '大学生应该如何养成阅读习惯'] },
    { title: 'The Impact of Artificial Intelligence on Our Lives', zh: '人工智能正在快速改变我们的生活。请就「人工智能对生活的影响」写一篇短文。', outline: ['AI 已经进入学习、工作与日常生活', '它带来的便利与潜在问题', '我们应该如何与 AI 相处'] },
    { title: 'How to Balance Study and Part-time Jobs', zh: '越来越多的大学生选择做兼职。请就「如何平衡学业与兼职」写一篇短文。', outline: ['兼职能带来收入与经验', '但过度兼职会影响学业', '给出平衡两者的具体建议'] },
    { title: 'Should College Students Live Off Campus?', zh: '关于大学生是否应该在校外租房，人们看法不一。请就此写一篇短文。', outline: ['支持者的理由', '反对者的理由', '你的看法'] },
    { title: 'The Value of Teamwork', zh: '团队合作在学习与工作中越来越重要。请就「团队合作的价值」写一篇短文。', outline: ['团队合作能完成个人做不到的事', '它需要沟通、分工与包容', '结合校园生活举例说明'] },
    { title: 'Environmental Protection Starts with Small Actions', zh: '环保并不遥远，从身边小事做起。请就此写一篇短文。', outline: ['环境问题与每个人相关', '日常生活里可以做的具体小事', '呼吁大家共同行动'] },
    { title: 'The Benefits and Challenges of Online Learning', zh: '线上学习越来越普遍。请就「线上学习的利与弊」写一篇短文。', outline: ['线上学习的便利之处', '它面临的主要挑战', '如何让线上学习更有效'] },
    { title: 'Why Physical Exercise Matters for College Students', zh: '很多大学生缺乏运动。请就「体育锻炼对大学生的重要性」写一篇短文。', outline: ['大学生体质下降的现状', '运动对身心与学习的好处', '提出可行的锻炼建议'] },
    { title: 'On Dealing with Stress in College Life', zh: '学业、就业与人际关系都可能带来压力。请就「如何应对大学生活中的压力」写一篇短文。', outline: ['大学生常见的压力来源', '压力过大带来的影响', '你可以采取的应对方式'] },
    { title: 'The Role of Mobile Phones in Modern Life', zh: '手机已经成为生活的一部分。请就「手机在现代生活中的作用」写一篇短文。', outline: ['手机带来的便利', '过度使用手机的问题', '如何合理使用手机'] }
  ];

  var EXAM_SECTIONS = [
    { key: 'writing', name: '写作', min: 30, score: 106.5, tip: '先花 3 分钟想提纲，再动笔。字迹工整、分三段、每段首句点题，比堆砌难词更得分。' },
    { key: 'listening', name: '听力', min: 25, score: 248.5, tip: '利用读题时间先看选项，划出关键词。听力结束答题卡立即收走，务必边听边涂。' },
    { key: 'reading', name: '阅读', min: 40, score: 248.5, tip: '先做仔细阅读（分值高），再做长篇匹配，最后做选词填空。单题超过 2 分钟就先跳过。' },
    { key: 'translation', name: '翻译', min: 30, score: 106.5, tip: '先确定主干（主谓宾），再补修饰成分。不会的词用简单词替换，不要空着。' }
  ];

  var ex = null;   // {sec, endAt, id, running, essay, trans}

  function examSetup() {
    var st = ST.data();
    var h = '<div class="card"><div class="card-h"><h2>限时模考</h2><div class="sp"></div>' +
      '<span class="chip">四级总时长 125 分钟 · 满分 710</span></div>' +
      '<table class="tb"><thead><tr><th>部分</th><th>时长</th><th>分值</th><th>要点</th><th></th></tr></thead><tbody>';
    EXAM_SECTIONS.forEach(function (s) {
      h += '<tr><td><b>' + s.name + '</b></td><td class="nowrap">' + s.min + ' 分钟</td>' +
        '<td class="nowrap">' + s.score + '</td><td class="muted small">' + U.esc(s.tip) + '</td>' +
        '<td><button class="btn tiny primary" data-sec="' + s.key + '">开始</button></td></tr>';
    });
    h += '</tbody></table>' +
      '<div class="row mt"><button class="btn primary" data-sec="full">⚑ 一键整卷模考（125 分钟连续计时）</button>' +
      '<span class="tiny-t muted">建议每周做 1 次整卷，考前两周每周 2 次</span></div></div>';

    h += '<div class="card mt"><div class="card-h"><h3>考试流程提醒</h3></div><ul class="small" style="margin:0;padding-left:20px">';
    (D.study.exam && D.study.exam.rules ? D.study.exam.rules : []).forEach(function (r) {
      h += '<li>' + U.esc(r) + '</li>';
    });
    h += '</ul></div>';

    host.innerHTML = h;
    U.on(host, 'click', '[data-sec]', function (e, t) { startSection(t.dataset.sec); });
  }

  function startSection(key) {
    var s = EXAM_SECTIONS.filter(function (x) { return x.key === key; })[0];
    ex = {
      key: key,
      sec: s,
      running: key !== 'full',
      idx: EXAM_SECTIONS.indexOf(s),
      remaining: s.min * 60,
      essay: U.pick(ESSAYS),
      trans: (D.study.translation && D.study.translation.practice) ? U.pick(D.study.translation.practice) : null
    };
    paintExam();
    if (ex.running) tickStart();
  }

  var timerId = null;
  function tickStart() {
    tickStop();
    timerId = setInterval(function () {
      if (!ex || !ex.running) return;
      ex.remaining--;
      var node = U.$('#clock');
      if (node) {
        node.textContent = fmtClock(ex.remaining);
        node.style.color = ex.remaining <= 300 ? 'var(--bad)' : '';
      }
      if (ex.remaining <= 0) {
        ex.running = false;
        tickStop();
        U.speakSeq(['Time is up. Please stop writing.'], { rate: 0.95 });
        U.toast('⏰ 本部分时间到！', 'bad', 4000);
        paintExam();
      }
    }, 1000);
  }
  function tickStop() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function fmtClock(s) {
    var m = Math.floor(s / 60), x = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }

  function paintExam() {
    if (!ex) { examSetup(); return; }
    var s = ex.sec;
    var h = '<div class="row mb"><button class="btn tiny ghost" data-act="back">← 退出模考</button>' +
      '<span class="chip a">' + s.name + ' · ' + s.min + ' 分钟 · ' + s.score + ' 分</span>' +
      '<div class="sp"></div>' +
      '<span class="chip" style="font-size:16px;font-family:var(--mono);padding:4px 14px" id="clock">' +
      fmtClock(ex.remaining) + '</span>' +
      '<button class="btn tiny ' + (ex.running ? 'warn' : 'primary') + '" data-act="toggle">' +
      (ex.running ? '暂停' : '继续') + '</button></div>';

    h += '<div class="card" style="border-color:var(--accent)">' +
      '<div class="tiny-t muted">本部分要求</div><p class="small">' + U.esc(s.tip) + '</p></div>';

    if (ex.key === 'writing' || ex.key === 'full') h += essayPanel();
    if (ex.key === 'reading' || ex.key === 'full') {
      var first = D.passages[0];
      h += '<div class="card mt"><div class="card-h"><h3>阅读部分</h3><div class="sp"></div>' +
        '<button class="btn tiny" data-go="reading">打开阅读训练</button></div>' +
        '<p class="small muted">正式考试里阅读是 3 篇文章，建议每篇控制在 12 分钟内。到「仔细阅读」板块挑 ' +
        D.passages.length + ' 篇中的任意一篇，掐时间做完。</p></div>';
    }
    if (ex.key === 'listening' || ex.key === 'full') {
      h += '<div class="card mt"><div class="card-h"><h3>听力部分</h3><div class="sp"></div>' +
        '<button class="btn tiny" data-go="listening">打开听力训练</button></div>' +
        '<p class="small muted">本机没有四级真题音频，这里用「句子听写」替代练耳朵。' +
        '真正考试前请务必用真题音频完整听过至少 5 套。</p></div>';
    }
    if (ex.key === 'translation' || ex.key === 'full') h += transPanel();

    if (ex.key === 'full') {
      h += '<div class="card mt"><div class="card-h"><h3>整卷进度</h3></div>' +
        '<p class="small muted">整卷模式按真实顺序：写作 30 分钟 → 听力 25 分钟 → 阅读 40 分钟 → 翻译 30 分钟。' +
        '建议先只做「写作」这一节，熟悉节奏后再做整卷。</p>' +
        '<div class="row">' + EXAM_SECTIONS.map(function (x) {
          return '<button class="btn tiny" data-sec="' + x.key + '">' + x.name + ' ' + x.min + '分</button>';
        }).join('') + '</div></div>';
    }

    host.innerHTML = h;
    U.on(host, 'click', '[data-go]', function (e, t) { C.app.go(t.dataset.go); });
    U.on(host, 'click', '[data-sec]', function (e, t) { startSection(t.dataset.sec); });
    U.on(host, 'click', '[data-act="back"]', function () { tickStop(); ex = null; examSetup(); });
    U.on(host, 'click', '[data-act="toggle"]', function () {
      ex.running = !ex.running;
      if (ex.running) tickStart(); else tickStop();
      paintExam();
    });
    U.on(host, 'input', '#essay', function (e, t) {
      var n = (t.value.match(/[A-Za-z'’-]+/g) || []).length;
      var c = U.$('#wc'); if (c) c.textContent = n + ' 词';
      ex.essayText = t.value;
    });
    U.on(host, 'click', '[data-act="showtmpl"]', function () {
      var t = (D.study.writing && D.study.writing.templates) || [];
      if (!t.length) { U.toast('模板资料未加载'); return; }
      U.modalOpen(U.frag('<h3>可套用的作文模板</h3>' + t.slice(0, 3).map(function (x) {
        return '<details class="acc"><summary>' + U.esc(x.title) + '</summary>' +
          '<div class="acc-body"><p class="small muted">' + U.esc(x.useWhen || '') + '</p>' +
          '<div class="tmpl">' + U.esc(x.body || '') + '</div></div></details>';
      }).join('') + '<div class="row" style="justify-content:flex-end"><button class="btn" data-close>关闭</button></div>'));
      U.on(U.$('#modal'), 'click', '[data-close]', function () { U.modalClose(); });
    });
    U.on(host, 'click', '[data-act="showref"]', function () {
      if (!ex.trans) return;
      U.modalOpen(U.frag('<h3>参考译文与采分点</h3>' +
        '<div class="flash-ex"><div class="en">' + U.esc(ex.trans.ref) + '</div></div>' +
        '<div class="mt"><b>采分点</b><ul class="small">' +
        (ex.trans.points || []).map(function (p) { return '<li>' + U.esc(p) + '</li>'; }).join('') +
        '</ul></div><div class="row" style="justify-content:flex-end"><button class="btn" data-close>关闭</button></div>'));
      U.on(U.$('#modal'), 'click', '[data-close]', function () { U.modalClose(); });
    });
  }

  function essayPanel() {
    var e = ex.essay;
    return '<div class="card mt"><div class="card-h"><h3>写作题</h3><div class="sp"></div>' +
      '<span class="chip">建议 120–180 词</span></div>' +
      '<div class="q-passage"><b>' + U.esc(e.title) + '</b><br>' + U.esc(e.zh) +
      '<div class="mt tiny-t muted">提纲：</div><ul class="small" style="margin:4px 0 0;padding-left:20px">' +
      e.outline.map(function (o) { return '<li>' + U.esc(o) + '</li>'; }).join('') + '</ul></div>' +
      '<textarea id="essay" style="min-height:220px" placeholder="在这里用英文写作文，写的时候不要停下来查词…">' +
      U.esc(ex.essayText || '') + '</textarea>' +
      '<div class="row mt"><span class="chip" id="wc">0 词</span><div class="sp"></div>' +
      '<button class="btn tiny" data-act="showtmpl">看可套用模板</button></div></div>';
  }

  function transPanel() {
    var t = ex.trans;
    if (!t) return '<div class="card mt"><p class="muted small">翻译练习题未加载。</p></div>';
    return '<div class="card mt"><div class="card-h"><h3>翻译题</h3><div class="sp"></div>' +
      '<span class="chip">建议 8 分钟</span></div>' +
      '<div class="q-passage">' + U.esc(t.zh) + '</div>' +
      '<textarea style="min-height:120px" placeholder="写出英文翻译…"></textarea>' +
      '<div class="row mt"><button class="btn tiny primary" data-act="showref">对照参考译文</button></div></div>';
  }

  /* ==================== 调度 ==================== */
  function paint() {
    if (tab === 'reading') { if (rd) paintReading(); else host.innerHTML = readingList(), bindList(); }
    else if (tab === 'listening') paintListening();
    else paintExam();
  }

  function bindList() {
    U.on(host, 'click', '[data-pid]', function (e, t) {
      var p = D.passages.filter(function (x) { return x.id === t.dataset.pid; })[0];
      if (p) readingDetail(p);
    });
  }

  function renderTabs() {
    var h = '<div class="tabs">' +
      '<button class="tab' + (tab === 'reading' ? ' on' : '') + '" data-tab="reading">仔细阅读</button>' +
      '<button class="tab' + (tab === 'listening' ? ' on' : '') + '" data-tab="listening">听力训练</button>' +
      '<button class="tab' + (tab === 'exam' ? ' on' : '') + '" data-tab="exam">限时模考</button>' +
      '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = h;
    host.appendChild(wrap);
    U.on(wrap, 'click', '[data-tab]', function (e, t) {
      tickStop(); rd = null; ls = null; ex = null;
      tab = t.dataset.tab;
      render(hostContainer, { tab: tab });
    });
  }

  var hostContainer = null;

  function render(h, params) {
    hostContainer = h;
    host = h;
    tab = (params && params.tab) || 'reading';
    rd = null; ls = null; ex = null;
    tickStop();
    U.clear(host);
    renderTabs();
    var body = document.createElement('div');
    host.appendChild(body);
    host = body;
    paint();
  }

  function leave() {
    tickStop();
    U.stopSpeak();
    rd = null; ls = null; ex = null; host = null;
  }

  function key(e) {
    if (ls && !ls.checked && e.key === 'Enter') {
      e.preventDefault();
      var b = U.$('[data-act="check"]', host);
      if (b) b.click();
    } else if (ls && ls.checked && e.key === 'Enter') {
      e.preventDefault();
      var n = U.$('[data-act="next"]', host);
      if (n) n.click();
    }
  }

  C.views = C.views || {};
  C.views.exam = {
    title: '阅读 · 听力 · 模考', sub: '精读查词 · 句子听写 · 限时训练',
    render: render, leave: leave, key: key
  };
})(window);
