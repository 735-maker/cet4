/* ==========================================================================
   view-setup.js — 计划、偏好、数据备份、使用说明
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});
  var U = C.U, D = C.data, ST = C.state;

  function render(host) {
    var st = ST.data();
    var p = st.profile;
    var plan = ST.plan();
    var o = ST.overview();
    var age = ST.backupAgeDays();

    var sw = C.swState;
    var offlineReady = sw === 'ready';
    // 局域网 http 地址永远拿不到 Service Worker（浏览器只给 HTTPS / localhost），
    // 这恰恰是「永久离线」必须传到 HTTPS 托管的原因，提示要说清楚。
    var lanHttp = /^http:$/.test(location.protocol) &&
      !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    var offlineText = sw === 'ready' ? '✅ 已缓存，断网可用'
      : sw === 'installing' ? '正在缓存，稍后刷新'
      : sw === 'off' ? '离线缓存已关闭'
      : sw === 'failed' ? '离线缓存不可用'
      : location.protocol === 'file:' ? '单文件离线版，本来就离线'
      : lanHttp ? '局域网地址无法离线（需 HTTPS）'
      : '不支持离线缓存';

    var h = '';

    /* ---- 备考计划 ---- */
    h += '<div class="card"><div class="card-h"><h2>备考计划</h2><div class="sp"></div>' +
      '<span class="chip a">' + plan.phase.name + '</span></div>' +
      '<div class="grid g2">' +
      '<label class="fld"><span>考试日期（四级一般在 6 月 / 12 月中旬的周六）</span>' +
      '<input type="date" id="examDate" value="' + U.esc(p.examDate) + '"></label>' +
      '<label class="fld"><span>每天计划背多少新词</span>' +
      '<input type="number" id="dailyNew" min="5" max="200" value="' + p.dailyNew + '"></label>' +
      '<label class="fld"><span>每天最多复习多少词（防止某天堆积太多）</span>' +
      '<input type="number" id="reviewCap" min="20" max="600" value="' + p.reviewCap + '"></label>' +
      '<label class="fld"><span>一组单词的量</span>' +
      '<select id="sessionSize">' +
      [10, 20, 30, 50, 0].map(function (n) {
        return '<option value="' + n + '"' + (p.sessionSize === n ? ' selected' : '') + '>' +
          (n === 0 ? '一次学完（不分组）' : n + ' 个一组') + '</option>';
      }).join('') + '</select></label>' +
      '</div>' +
      '<label class="switch"><input type="checkbox" id="includeLevel1"' + (p.includeLevel1 ? ' checked' : '') + '>' +
      '<span>把初中基础词也纳入背诵范围（' + D.stats().level[1] + ' 个）——基础薄弱、很多基础词也没记牢的话可以打开</span></label>' +
      '<div class="mt"><button class="btn primary" data-act="savePlan">保存计划</button>' +
      '<button class="btn ghost" data-act="applySuggest">采用建议值（每天 ' + plan.suggestDaily + ' 个新词）</button></div>' +
      '</div>';

    /* ---- 计划体检 ---- */
    var needDays = Math.ceil(o.unseen / Math.max(1, p.dailyNew));
    h += '<div class="card mt"><div class="card-h"><h3>计划体检</h3></div><table class="tb"><tbody>' +
      row('距离考试', plan.left > 0 ? plan.left + ' 天（' + p.examDate + '）' : '已到/已过考试日') +
      row('还没学的单词', o.unseen + ' 个') +
      row('按当前设置', '需要 ' + needDays + ' 天过完一轮') +
      row('是否来得及', needDays <= plan.left * 0.7
        ? '<span style="color:var(--ok)">来得及</span>，后面 30% 时间留给复习和刷题'
        : '<span style="color:var(--warn)">偏紧</span>，建议把每天新词提到 ' + plan.suggestDaily + ' 个左右') +
      row('当前阶段', plan.phase.name + ' · 重点：' + plan.phase.focus) +
      '</tbody></table>' +
      '<p class="tiny-t muted mt">经验值：四级 4700 词里，<b>高频核心约 1650 个</b>。把这一档吃透，阅读和听力会有明显变化。</p>' +
      '</div>';

    /* ---- 学习偏好 ---- */
    h += '<div class="card mt"><div class="card-h"><h3>学习偏好</h3></div>' +
      '<label class="switch"><input type="checkbox" id="autoSpeak"' + (p.autoSpeak ? ' checked' : '') + '>' +
      '<span>翻卡时自动朗读单词</span></label>' +
      '<label class="switch"><input type="checkbox" id="lightTheme"' + (st.ui.theme === 'light' ? ' checked' : '') + '>' +
      '<span>使用浅色主题</span></label>' +
      '<div class="row"><button class="btn tiny" data-act="testSpeak">测试语音朗读</button>' +
      '<span class="tiny-t muted">' + (U.speechOK() ? '当前环境支持浏览器内置语音（离线可用）' : '当前环境不支持语音') + '</span></div>' +
      '</div>';

    /* ---- 手机访问 ---- */
    h += '<div class="card mt"><div class="card-h"><h2>📱 在手机上用</h2><div class="sp"></div>' +
      '<span class="chip" id="phoneChip">检查中…</span></div>' +
      '<div id="phoneBox" class="muted small">正在获取局域网地址…</div></div>';

    /* ---- 数据 ---- */
    h += '<div class="card mt"><div class="card-h"><h2>数据与备份</h2><div class="sp"></div>' +
      '<span class="chip ' + (C.store.mode === 'server' ? 'ok' : C.store.mode === 'local' ? 'warn' : 'bad') + '">' +
      U.esc(C.store.detail) + '</span>' +
      '<span class="chip ' + (offlineReady ? 'ok' : '') + '">' + U.esc(offlineText) + '</span></div>' +
      '<p class="small muted">' + (age >= 999 ? '你还没有导出过备份。' : '上次导出备份：' + age + ' 天前。') +
      ' 所有记录都存在本机，<b>换设备、重装系统或清理浏览器数据都会丢失</b>，建议每周备份一次。</p>' +
      '<div class="row">' +
      '<button class="btn primary" data-act="export">⬇ 导出备份文件</button>' +
      '<button class="btn" data-act="import">⬆ 从备份恢复</button>' +
      '<button class="btn ghost" data-act="backupText">📋 用文本备份（手机上更好用）</button>' +
      '<button class="btn bad" data-act="reset">清空所有学习数据</button>' +
      '</div>' +
      '<p class="tiny-t muted mt">手机上如果「导出备份文件」点了没反应（iOS 有时会这样），' +
      '就用「用文本备份」：把内容全选复制，粘到微信收藏或备忘录里存着，将来粘回来就能恢复。</p>' +
      '<div class="kv mt">' +
      '<dt>已学单词</dt><dd>' + o.seen + ' 词</dd>' +
      '<dt>学习记录</dt><dd>' + Object.keys(st.logs).length + ' 天</dd>' +
      '<dt>做题记录</dt><dd>' + st.quiz.total + ' 题</dd>' +
      '<dt>错题</dt><dd>' + ST.mistakeList().length + ' 题</dd>' +
      '</div></div>';

    /* ---- 使用说明 ---- */
    h += '<div class="card mt"><div class="card-h"><h2>怎么用这个工具</h2></div>' +
      '<div class="kv" style="grid-template-columns:1fr">' +
      '<p class="small"><b>1. 先设好考试日期和每日新词量。</b>工具会自动算出每天该背多少、来不来得及。</p>' +
      '<p class="small"><b>2. 每天先做「今日任务」。</b>它会先给你到期的复习词，再给新词。' +
      '复习永远优先于新词——背了不复习等于白背。</p>' +
      '<p class="small"><b>3. 每张卡如实评分。</b>「认识」是顺利想起来，「模糊」是想了半天，「熟练」是秒懂。' +
      '评分越诚实，第二天出现的词就越准。</p>' +
      '<p class="small"><b>4. 每天配一组题或一篇阅读。</b>单词认识 ≠ 句子读得懂。' +
      '刷题和阅读是把「认识的词」变成「会用的词」。</p>' +
      '<p class="small"><b>5. 错题本要清。</b>做错的题连对两次会自动移出，剩下的就是你真正的漏洞。</p>' +
      '<p class="small"><b>6. 基础一般的话，先看「词根词缀」和「语法重点」两个板块。</b>' +
      '词根帮你猜词，语法帮你读懂长句，这两件事的投入产出比最高。</p>' +
      '<p class="small"><b>7. 考前一个月开始整卷模考。</b>「限时模考」里有四部分的真实时间和分值。</p>' +
      '</div></div>';

    /* ---- 关于 ---- */
    var s = D.stats();
    h += '<div class="card mt"><div class="card-h"><h3>关于数据来源</h3></div>' +
      '<div class="kv">' +
      '<dt>词库</dt><dd>' + s.total + ' 词（ECDICT 词典 + 大学英语四级大纲单词表交叉整理）</dd>' +
      '<dt>词频分层</dt><dd>高频必背 ' + s.tier[1] + ' · 常考 ' + s.tier[2] + ' · 一般 ' + s.tier[3] + ' · 低频 ' + s.tier[4] + '</dd>' +
      '<dt>难度分层</dt><dd>初中基础 ' + s.level[1] + ' · 高中 ' + s.level[2] + ' · 四级核心 ' + s.level[3] + '</dd>' +
      '<dt>例句</dt><dd>' + s.withExample + ' 条</dd>' +
      '<dt>客观题</dt><dd>' + s.questions + ' 题</dd>' +
      '<dt>阅读短文</dt><dd>' + s.passages + ' 篇 / ' + (s.passages * 5) + ' 题</dd>' +
      '</div>' +
      '<p class="tiny-t muted mt">全部内容离线存在本机，不上传任何数据。英语题目与例句为教学用途编写。</p>' +
      '</div>';

    host.innerHTML = h;

    U.on(host, 'click', '[data-act="savePlan"]', function () {
      var d = U.$('#examDate', host).value;
      if (!d) { U.toast('请选择考试日期'); return; }
      p.examDate = d;
      p.dailyNew = U.clamp(+U.$('#dailyNew', host).value || 25, 5, 200);
      p.reviewCap = U.clamp(+U.$('#reviewCap', host).value || 150, 20, 600);
      p.sessionSize = +U.$('#sessionSize', host).value || 0;
      p.includeLevel1 = U.$('#includeLevel1', host).checked;
      p.autoSpeak = U.$('#autoSpeak', host).checked;
      var light = U.$('#lightTheme', host).checked;
      st.ui.theme = light ? 'light' : 'dark';
      U.setTheme(st.ui.theme);
      ST.saveNow();
      U.toast('已保存', 'ok');
      C.app.refreshChrome();
      C.app.go('setup');
    });

    U.on(host, 'click', '[data-act="applySuggest"]', function () {
      U.$('#dailyNew', host).value = plan.suggestDaily;
      U.toast('已填入建议值，记得点「保存计划」');
    });

    U.on(host, 'click', '[data-act="testSpeak"]', function () {
      U.speak('Reading every day is the best way to improve your English.', { rate: 0.9 });
    });

    U.on(host, 'click', '[data-act="export"]', function () {
      var name = '四级备考备份_' + U.today() + '.json';
      U.download(name, ST.exportText());
      ST.markBackup();
      U.toast('已导出备份文件', 'ok');
      C.app.go('setup');
    });

    U.on(host, 'click', '[data-act="import"]', function () {
      U.readTextFile('.json').then(function (txt) {
        return U.confirm('从备份恢复？', '当前的进度会被备份文件里的内容替换。', '确认恢复').then(function (ok) {
          if (!ok) return;
          return Promise.resolve(ST.importText(txt)).then(function () {
            U.toast('恢复成功', 'ok');
            C.app.refreshChrome();
            C.app.go('home');
          });
        });
      }).catch(function (e) {
        if (e && e.message && e.message !== '未选择文件') U.toast('恢复失败：' + e.message, 'bad');
      });
    });

    U.on(host, 'click', '[data-act="backupText"]', openBackupText);

    U.on(host, 'click', '[data-act="reset"]', function () {
      U.confirm('清空所有学习数据？', '所有背诵记录、错题、统计都会消失，且无法恢复。建议先导出备份。', '确认清空', true)
        .then(function (ok) {
          if (!ok) return;
          ST.reset().then(function () {
            U.toast('已清空');
            C.app.refreshChrome();
            C.app.go('home');
          });
        });
    });

    U.on(host, 'click', '[data-copy]', function (e, t) {
      var url = t.dataset.copy;
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); U.toast('地址已复制', 'ok'); }
        catch (err) { U.toast('请手动长按上方地址复制'); }
        ta.remove();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { U.toast('地址已复制', 'ok'); }, fallback);
      } else fallback();
    });

    mountPhone();
  }

  /* ---------------- 用文本备份 / 恢复（手机友好） ---------------- */
  function openBackupText() {
    var txt = ST.exportText();
    var node = U.frag(
      '<h3>用文本备份</h3>' +
      '<p class="small muted">下面这段就是你的全部进度（' + Math.round(txt.length / 1024) + ' KB）。' +
      '全选复制，粘到微信收藏、备忘录或发给自己，将来粘回来就能恢复。</p>' +
      '<textarea id="bkText" readonly style="min-height:150px;font-family:var(--mono);font-size:12px"></textarea>' +
      '<div class="row mt"><button class="btn primary" data-copybk>全选并复制</button>' +
      '<button class="btn ghost" data-go-setup>关闭</button></div>' +
      '<p class="tiny-t muted mt">提示：这段文本很长，复制时请确保一个字都没漏。</p>'
    );
    U.modalOpen(node);
    var ta = U.$('#bkText');
    ta.value = txt;
    U.on(U.$('#modal'), 'click', '[data-copybk]', function () {
      ta.focus(); ta.select();
      if (ta.setSelectionRange) ta.setSelectionRange(0, ta.value.length);
      U.copyText(txt).then(function () {
        ST.markBackup();
        U.toast('已复制到剪贴板，找地方粘好保存', 'ok', 3200);
      }, function (e) {
        U.toast(e.message || '请长按文本框手动复制', 'bad', 3600);
      });
    });
    U.on(U.$('#modal'), 'click', '[data-go-setup]', function () { U.modalClose(); });
    U.on(U.$('#modal'), 'click', '[data-restore]', openRestoreText);
  }

  function openRestoreText() {
    var node = U.frag(
      '<h3>用文本恢复</h3>' +
      '<p class="small muted">把之前复制走的备份文本粘到下面，点恢复。</p>' +
      '<textarea id="rsText" placeholder="在这里粘贴备份内容（应以 { 开头）" style="min-height:150px;font-family:var(--mono);font-size:12px"></textarea>' +
      '<div class="row mt"><button class="btn primary" data-dorestore>确认恢复</button>' +
      '<button class="btn ghost" data-close>取消</button></div>'
    );
    U.modalOpen(node);
    U.on(U.$('#modal'), 'click', '[data-close]', function () { U.modalClose(); });
    U.on(U.$('#modal'), 'click', '[data-dorestore]', function () {
      var txt = U.$('#rsText').value.trim();
      if (!txt) { U.toast('还没有粘贴内容'); return; }
      U.confirm('确认恢复？', '当前进度会被粘贴的备份替换。', '确认恢复').then(function (ok) {
        if (!ok) return;
        try {
          Promise.resolve(ST.importText(txt)).then(function () {
            U.modalClose();
            U.toast('恢复成功', 'ok');
            C.app.refreshChrome();
            C.app.go('home');
          });
        } catch (e) { U.toast('恢复失败：' + e.message, 'bad'); }
      });
    });
  }

  /* ---------------- 手机访问 ---------------- */
  function mountPhone() {
    var box = U.$('#phoneBox'), chip = U.$('#phoneChip');
    if (!box) return;

    function plain(html, chipText, chipCls) {
      if (chip) { chip.textContent = chipText; chip.className = 'chip ' + (chipCls || ''); }
      box.className = '';
      box.innerHTML = html;
    }

    var PLAN_HTML =
      '<div class="mt"><b class="small">三种用法，按你的需要选：</b>' +
      '<div class="kv" style="grid-template-columns:1fr;margin-top:8px">' +
      '<p class="small"><b>A. 扫码即用</b>（电脑要开着）—— 见上方二维码。手机和电脑共用同一份进度，' +
      '记录存在电脑的 state.json 里，最不容易丢。</p>' +
      '<p class="small"><b>B. 完全不用电脑</b>（离线单文件版）—— 把 <code>四级通关-手机版.html</code> ' +
      '传到手机直接打开。<b>安卓</b>：用文件管理器选「用浏览器打开」；' +
      '<b>iPhone / iPad</b>：Safari 打不开本地网页文件，需要装一个免费的文件浏览器 App' +
      '（如 Documents），或直接用下面的方式 C。</p>' +
      '<p class="small"><b>C. 装成桌面图标，两台手机永久离线</b>（推荐，一次性操作）—— ' +
      '把 <code>deploy</code> 文件夹传到任意静态网站托管（如 GitHub Pages），' +
      '手机上打开网址 → 浏览器菜单「添加到主屏幕」。装好后整个应用会缓存在手机里，' +
      '<b>以后关掉电脑、断网、飞行模式都能用</b>。详细步骤见 <code>使用说明.md</code> 第二节。</p>' +
      '</div></div>';

    if (C.store.mode !== 'server') {
      plain(PLAN_HTML, location.protocol === 'file:' ? '当前是离线版' : '本地模式', '');
      return;
    }

    fetch('api/info', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (info) {
        var lan = (info && info.lan) || [];
        if (!lan.length) {
          plain('<p>没有检测到局域网地址。请确认这台电脑已经连上 Wi-Fi 或插了网线，然后重启一次 启动.bat。</p>' + PLAN_HTML,
            '未找到局域网', 'bad');
          return;
        }
        var url = lan[0].url;
        var svg = '';
        try {
          svg = C.qr.svg(url, { scale: 6, margin: 3, dark: '#101722', light: '#ffffff' });
        } catch (e) {
          svg = '<p class="tiny-t">二维码生成失败：' + U.esc(e.message) + '</p>';
        }
        var others = lan.slice(1, 4).map(function (x) {
          return '<div class="tiny-t muted">如果上面这个连不上，试：<code>' + U.esc(x.url) + '</code></div>';
        }).join('');

        plain(
          '<div class="phone-grid">' +
          '<div class="qr-box">' + svg + '</div>' +
          '<div class="phone-steps">' +
          '<p><b>方式 A：手机和这台电脑连同一个 Wi-Fi</b>，用手机相机扫左边二维码，点弹出的链接就能打开。</p>' +
          '<p>也可以在手机浏览器里手动输入这个地址：</p>' +
          '<div class="url-box"><code>' + U.esc(url) + '</code>' +
          '<button class="btn tiny" data-copy="' + U.esc(url) + '">复制</button></div>' +
          '<p class="tiny-t muted">手机只是打开界面，<b>记录还是存在这台电脑的 state.json 里</b>，' +
          '所以两边进度是同一份。缺点是学的时候电脑得开着。</p>' +
          others +
          '</div></div>' + PLAN_HTML,
          '可扫码连接', 'ok');
      })
      .catch(function () {
        plain('<p>没能从本地服务读到局域网地址。请确认是通过 启动.bat 打开的。</p>' + PLAN_HTML, '读取失败', 'bad');
      });
  }

  function row(k, v) {
    return '<tr><td class="muted nowrap" style="width:150px">' + k + '</td><td>' + v + '</td></tr>';
  }

  C.views = C.views || {};
  C.views.setup = { title: '设置与计划', sub: '考试日期 · 每日任务量 · 数据备份', render: render };
})(window);
