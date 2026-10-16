/* ==========================================================================
   qr.js — 极简 QR Code 编码器（字节模式 / 纠错等级 M / 版本 1-10）
   用途：把「手机访问地址」渲染成二维码，用手机相机扫一下就打开。
   零依赖，纯前端，离线可用。

   参考 ISO/IEC 18004。掩码由格式信息记录，因此任意合法掩码都能被正常解码；
   这里仍按标准罚分规则挑选最优掩码。
   ========================================================================== */
(function (w) {
  'use strict';
  var C = (w.CET4 = w.CET4 || {});

  /* ---------------- GF(256) ---------------- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function genPoly(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var a = EXP[i];
      var out = new Array(g.length + 1);
      for (var j = 0; j < g.length; j++) out[j] = g[j];
      out[g.length] = 0;
      for (var k = 0; k < g.length; k++) out[k + 1] ^= gmul(g[k], a);
      g = out;
    }
    return g;
  }

  function rsEncode(data, ecLen) {
    var gen = genPoly(ecLen);
    var res = new Array(ecLen);
    for (var i = 0; i < ecLen; i++) res[i] = 0;
    for (var d = 0; d < data.length; d++) {
      var factor = data[d] ^ res[0];
      for (var s = 0; s < ecLen - 1; s++) res[s] = res[s + 1];
      res[ecLen - 1] = 0;
      if (factor !== 0) {
        for (var j = 0; j < ecLen; j++) res[j] ^= gmul(gen[j + 1], factor);
      }
    }
    return res;
  }

  /* ---------------- 版本参数（纠错等级 M） ---------------- */
  // [总数据码字数，纠错码字数/块，[ [块数, 每块数据码字], ... ] ]
  var VER = {
    1:  { data: 16,  ec: 10, blocks: [[1, 16]] },
    2:  { data: 28,  ec: 16, blocks: [[1, 28]] },
    3:  { data: 44,  ec: 26, blocks: [[1, 44]] },
    4:  { data: 64,  ec: 18, blocks: [[2, 32]] },
    5:  { data: 86,  ec: 24, blocks: [[2, 43]] },
    6:  { data: 108, ec: 16, blocks: [[4, 27]] },
    7:  { data: 124, ec: 18, blocks: [[4, 31]] },
    8:  { data: 154, ec: 22, blocks: [[2, 38], [2, 39]] },
    9:  { data: 182, ec: 22, blocks: [[3, 36], [2, 37]] },
    10: { data: 216, ec: 26, blocks: [[4, 43], [1, 44]] }
  };
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };
  var MAX_VERSION = 10;

  function toBytes(str) {
    if (typeof TextEncoder !== 'undefined') return Array.prototype.slice.call(new TextEncoder().encode(str));
    var utf8 = unescape(encodeURIComponent(str)), out = [];
    for (var i = 0; i < utf8.length; i++) out.push(utf8.charCodeAt(i));
    return out;
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= MAX_VERSION; v++) {
      var ccBits = v <= 9 ? 8 : 16;
      var cap = Math.floor((VER[v].data * 8 - 4 - ccBits) / 8);
      if (byteLen <= cap) return v;
    }
    return -1;
  }

  /* ---------------- 码字生成 ---------------- */
  function buildCodewords(bytes, version) {
    var spec = VER[version];
    var ccBits = version <= 9 ? 8 : 16;
    var totalBits = spec.data * 8;
    var bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }

    push(0x4, 4);                          // 字节模式 0100
    push(bytes.length, ccBits);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    var remain = totalBits - bits.length;
    push(0, Math.min(4, remain));          // 终止符
    while (bits.length % 8 !== 0) bits.push(0);

    var cw = [];
    for (var b = 0; b < bits.length; b += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | bits[b + k];
      cw.push(v);
    }
    var pad = [0xEC, 0x11], p = 0;
    while (cw.length < spec.data) cw.push(pad[p++ % 2]);

    // 分块 + 纠错
    var blocks = [], idx = 0;
    spec.blocks.forEach(function (grp) {
      for (var n = 0; n < grp[0]; n++) {
        var d = cw.slice(idx, idx + grp[1]); idx += grp[1];
        blocks.push({ data: d, ec: rsEncode(d, spec.ec) });
      }
    });

    // 交错
    var out = [], maxD = 0;
    blocks.forEach(function (bl) { if (bl.data.length > maxD) maxD = bl.data.length; });
    for (var c = 0; c < maxD; c++) {
      blocks.forEach(function (bl) { if (c < bl.data.length) out.push(bl.data[c]); });
    }
    for (var e = 0; e < spec.ec; e++) {
      blocks.forEach(function (bl) { out.push(bl.ec[e]); });
    }
    return out;
  }

  /* ---------------- 矩阵 ---------------- */
  function bitsOf(x, i) { return ((x >>> i) & 1) !== 0; }

  function maskFn(m, x, y) {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
    return false;
  }

  function formatBits(mask) {
    var data = (0 << 3) | mask;            // 纠错 M = 00
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | (rem & 0x3FF)) ^ 0x5412;
  }
  function versionBits(v) {
    var rem = v;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    return (v << 12) | (rem & 0xFFF);
  }

  function buildMatrix(version, codewords, mask) {
    var size = version * 4 + 17;
    var mod = [], fn = [], y, x;
    for (y = 0; y < size; y++) {
      mod.push(new Array(size).fill(false));
      fn.push(new Array(size).fill(false));
    }
    function set(x, y, dark, isFn) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      mod[y][x] = !!dark;
      if (isFn !== false) fn[y][x] = true;
    }

    // 定时图案（先画，随后会被三个定位图案覆盖，与标准一致）
    for (var i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

    // 定位图案 + 分隔符
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      var cx = c[0], cy = c[1];
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          set(cx + dx, cy + dy, dist !== 2 && dist !== 4);
        }
      }
    });

    // 校正图案
    var ap = ALIGN[version];
    for (var a = 0; a < ap.length; a++) {
      for (var b = 0; b < ap.length; b++) {
        if ((a === 0 && b === 0) || (a === 0 && b === ap.length - 1) || (a === ap.length - 1 && b === 0)) continue;
        for (var ey = -2; ey <= 2; ey++) {
          for (var ex = -2; ex <= 2; ex++) {
            set(ap[a] + ex, ap[b] + ey, Math.max(Math.abs(ex), Math.abs(ey)) !== 1);
          }
        }
      }
    }

    // 格式信息（先占位，稍后按掩码写入）
    function drawFormat(msk) {
      var bits = formatBits(msk);
      for (var i2 = 0; i2 <= 5; i2++) set(8, i2, bitsOf(bits, i2));
      set(8, 7, bitsOf(bits, 6));
      set(8, 8, bitsOf(bits, 7));
      set(7, 8, bitsOf(bits, 8));
      for (var i3 = 9; i3 < 15; i3++) set(14 - i3, 8, bitsOf(bits, i3));
      for (var i4 = 0; i4 < 8; i4++) set(size - 1 - i4, 8, bitsOf(bits, i4));
      for (var i5 = 8; i5 < 15; i5++) set(8, size - 15 + i5, bitsOf(bits, i5));
      set(8, size - 8, true);
    }
    drawFormat(mask);

    // 版本信息（版本 7 起）
    if (version >= 7) {
      var vb = versionBits(version);
      for (var i6 = 0; i6 < 18; i6++) {
        var bit = bitsOf(vb, i6);
        var p = size - 11 + (i6 % 3), q = Math.floor(i6 / 3);
        set(p, q, bit); set(q, p, bit);
      }
    }

    // 数据比特按锯齿形填入
    var bi = 0, total = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var xx = right - j;
          var upward = ((right + 1) & 2) === 0;
          var yy = upward ? size - 1 - vert : vert;
          if (!fn[yy][xx] && bi < total) {
            mod[yy][xx] = bitsOf(codewords[bi >>> 3], 7 - (bi & 7));
            bi++;
          }
        }
      }
    }

    // 掩码
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        if (!fn[y][x] && maskFn(mask, x, y)) mod[y][x] = !mod[y][x];
      }
    }
    return mod;
  }

  /* ---------------- 掩码罚分 ---------------- */
  function penalty(mod) {
    var size = mod.length, score = 0, x, y, i;
    // 规则 1：同色连续 5 个以上
    for (y = 0; y < size; y++) {
      var run = 1;
      for (x = 1; x < size; x++) {
        if (mod[y][x] === mod[y][x - 1]) { run++; }
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (x = 0; x < size; x++) {
      var run2 = 1;
      for (y = 1; y < size; y++) {
        if (mod[y][x] === mod[y - 1][x]) { run2++; }
        else { if (run2 >= 5) score += 3 + (run2 - 5); run2 = 1; }
      }
      if (run2 >= 5) score += 3 + (run2 - 5);
    }
    // 规则 2：2x2 同色块
    for (y = 0; y < size - 1; y++) {
      for (x = 0; x < size - 1; x++) {
        var c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) score += 3;
      }
    }
    // 规则 3：类似定位图案的序列
    var p1 = [true, false, true, true, true, false, true, false, false, false, false];
    var p2 = [false, false, false, false, true, false, true, true, true, false, true];
    function match(arr, i2, pat) {
      for (var k = 0; k < 11; k++) if (arr[i2 + k] !== pat[k]) return false;
      return true;
    }
    for (y = 0; y < size; y++) {
      var row = mod[y];
      for (x = 0; x + 11 <= size; x++) {
        if (match(row, x, p1) || match(row, x, p2)) score += 40;
      }
    }
    for (x = 0; x < size; x++) {
      var col = [];
      for (i = 0; i < size; i++) col.push(mod[i][x]);
      for (y = 0; y + 11 <= size; y++) {
        if (match(col, y, p1) || match(col, y, p2)) score += 40;
      }
    }
    // 规则 4：黑白比例偏离 50%
    var dark = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
    var ratio = dark * 100 / (size * size);
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
    return score;
  }

  /* ---------------- 对外接口 ---------------- */
  /** 生成模块矩阵；opts.mask 为 0-7 时强制指定掩码（用于测试） */
  function matrix(text, opts) {
    opts = opts || {};
    var bytes = toBytes(String(text));
    var version = pickVersion(bytes.length);
    if (version < 0) throw new Error('内容太长，超出本编码器容量（最多约 213 字节）');
    var cw = buildCodewords(bytes, version);
    var forced = (opts.mask === undefined || opts.mask === null) ? null : (opts.mask | 0);
    var bestMod = null, bestP = Infinity, bestMask = 0;
    for (var m = 0; m < 8; m++) {
      if (forced !== null && m !== forced) continue;
      var mod = buildMatrix(version, cw, m);
      var p = penalty(mod);
      if (p < bestP) { bestP = p; bestMod = mod; bestMask = m; }
    }
    return { size: bestMod.length, version: version, mask: bestMask, modules: bestMod };
  }

  /** 渲染成 SVG 字符串 */
  function svg(text, opts) {
    opts = opts || {};
    var m = matrix(text, opts);
    var scale = opts.scale || 4;
    var margin = opts.margin === undefined ? 4 : opts.margin;
    var dark = opts.dark || '#0d1117';
    var light = opts.light || '#ffffff';
    var dim = (m.size + margin * 2) * scale;
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + dim + '" height="' + dim +
      '" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges">');
    parts.push('<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>');
    var d = '';
    for (var y = 0; y < m.size; y++) {
      for (var x = 0; x < m.size; x++) {
        if (!m.modules[y][x]) continue;
        d += 'M' + ((x + margin) * scale) + ' ' + ((y + margin) * scale) +
          'h' + scale + 'v' + scale + 'h-' + scale + 'z';
      }
    }
    parts.push('<path d="' + d + '" fill="' + dark + '"/>');
    parts.push('</svg>');
    return parts.join('');
  }

  C.qr = {
    matrix: matrix,
    svg: svg,
    capacity: function () { return '版本 1-10 / 纠错 M / 最多约 213 字节'; }
  };
})(window);
