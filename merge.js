/* 11/21 지식 작업실 자동 합치기(3-way merge) — jisik_merge.py 와 한 줄 한 줄 같은 규칙(같은 입력 → 같은 바이트).
   한쪽을 고치면 다른 쪽도 고치고 시험(합치기_시험.py)을 다시 돌린다. 폰앱(phone.js)이 쓴다: window.JisikMerge.merge3(base|null, a, b, 'a'|'b')
   규칙 설명은 jisik_merge.py 맨 위. */
(function (root) {
  'use strict';
  const TAGSRC = '<!--[\\s\\S]*?-->|<(/?)([a-zA-Z][a-zA-Z0-9]*)(?=[ \\t\\n\\r\\f/>])[^>]*>';
  const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'font', 'i', 'img', 'kbd', 'mark', 'q', 's', 'samp',
    'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'del', 'ins', 'label', 'input']);
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const BOXES = new Set(['ul', 'ol', 'table', 'thead', 'tbody', 'tfoot']);
  const WS = /^[ \t\n\r\f]*$/;
  const BOARD = /<div[^>]*[ \t\n\r\f]class="board"[^>]*>[ \t\n\r\f]*<\/div>[ \t\n\r\f]*(?![\s\S])/;
  const SPACE = /[ \t\n\r\f\v ​　﻿]+/g;
  const ENT = /&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z]+);/g;
  const NAMED = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function unent(s) {
    return s.replace(ENT, (m0, g) => {
      if (g[0] === '#') {
        const n = (g[1] === 'x' || g[1] === 'X') ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
        if (n <= 0 || n > 0x10FFFF || (n >= 0xD800 && n <= 0xDFFF)) return m0;
        return String.fromCodePoint(n);
      }
      return has(NAMED, g) ? NAMED[g] : m0;
    });
  }
  const LABNUM = /(<span[^>]*[ \t\n\r\f]class="pt-lab"[^>]*>)[0-9]+/g;
  function norm(s) { return unent(s.replace(LABNUM, '$1').replace(/<[^>]*>/g, '')).replace(SPACE, ''); }   // 11/21 패턴 단계 번호는 합친 뒤 다시 매김 → 뺌

  function N(isBox, tag, typ, s, open, kids, close) {
    this.box = isBox; this.tag = tag; this.typ = typ; this.s = s || ''; this.open = open || ''; this.kids = kids || []; this.close = close || '';
    this.key = ''; this._nt = null;
    if (isBox) this.s = this.open + this.kids.map(k => k.s).join('') + this.close;
  }
  N.prototype.nt = function () { if (this._nt === null) this._nt = norm(this.s); return this._nt; };
  function leaf(tag, typ, s) {
    const n = new N(false, tag, typ, s), t = n.nt();
    n.key = t ? tag + '|' + t : tag + '|=' + s;
    if (typ === 'ws') n.key = 'ws';
    return n;
  }
  function firstText(n) {
    if (!n.box) return n.nt();
    for (const k of n.kids) { const t = firstText(k); if (t) return t; }
    return '';
  }
  function box(tag, typ, open, kids, close, key) {
    const n = new N(true, tag, typ, '', open, kids, close);
    n.key = key != null ? key : tag + '|' + firstText(n);
    return n;
  }
  function closeOf(s, tag, start) {
    const re = new RegExp(TAGSRC, 'g'); re.lastIndex = start; let d = 1, m;
    while ((m = re.exec(s))) {
      if (!m[2] || m[2].toLowerCase() !== tag) continue;
      if (m[1]) d -= 1; else if (!m[0].endsWith('/>')) d += 1;
      if (d === 0) return [m.index, m.index + m[0].length];
    }
    return null;
  }
  function parse(s) {
    const out = []; let i = 0, run = '';
    const flush = () => { if (run) out.push(leaf('#text', WS.test(run) ? 'ws' : 'inline', run)); run = ''; };
    const re = new RegExp(TAGSRC, 'g');
    while (i < s.length) {
      re.lastIndex = i; const m = re.exec(s);
      if (!m) { run += s.slice(i); break; }
      run += s.slice(i, m.index);
      const tag = (m[2] || '').toLowerCase(), end = m.index + m[0].length;
      if (!tag || INLINE.has(tag)) { run += m[0]; i = end; continue; }
      flush();
      if (m[1]) { out.push(leaf(tag, 'stray', m[0])); i = end; continue; }
      const ot = m[0];
      const c = VOID.has(tag) || ot.endsWith('/>') ? null : closeOf(s, tag, end);
      if (!c) { out.push(leaf(tag, 'el', ot)); i = end; continue; }
      const inner = s.slice(end, c[0]), ct = s.slice(c[0], c[1]);
      const cls = ot.match(/[ \t\n\r\f]class="([^"]*)"/);
      if (BOXES.has(tag) || (tag === 'div' && cls && cls[1].split(' ').some(c => PTBOX.has(c)))
        || (tag === 'li' && /<(ul|ol)(?=[ \t\n\r\f/>])/i.test(inner))) out.push(box(tag, 'box', ot, parse(inner), ct));
      else out.push(leaf(tag, 'el', ot + inner + ct));
      i = c[1];
    }
    flush();
    return out;
  }
  // 11/21 패턴 블록: 블록·항목 묶음은 안으로 들어가 항목 단위로 합침 (jisik_merge.py PTBOX·renum 과 같게)
  const PTBOX = new Set(['mindmap', 'pt-blk-wrap', 'pt-steps', 'pt-step', 'pt-ind', 'pt-flow', 'pt-blocks', 'pt-fcs', 'pt-tree', 'pt-mtx', 'pt-bx']);
  const STEPS = /<div[^>]*[ \t\n\r\f]class="[^"]*pt-steps[^"]*"[^>]*>|(<span[^>]*[ \t\n\r\f]class="pt-lab"[^>]*>)([^<]*)(<\/span>)/g;
  const LABRE = /^([0-9]+)([^0-9]*)$/;
  function renum(h) {
    const groups = []; let g = null, m; STEPS.lastIndex = 0;
    while ((m = STEPS.exec(h))) {
      if (m[1] === undefined) { g = []; groups.push(g); continue; }
      if (g !== null) g.push({ s: m.index + m[1].length, e: m.index + m[1].length + m[2].length, t: m[2] });
    }
    const edits = [];
    for (const gr of groups) {
      const ms = gr.map(x => x.t.match(LABRE));
      if (!gr.length || !ms.every(Boolean) || new Set(ms.map(x => x[2])).size !== 1) continue;
      const nums = ms.map(x => x[1]); if (new Set(nums).size === nums.length) continue;
      gr.forEach((x, k) => edits.push([x.s, x.e, String(k + 1) + ms[k][2]]));
    }
    for (let i = edits.length - 1; i >= 0; i--) { const [a, b, t] = edits[i]; h = h.slice(0, a) + t + h.slice(b); }
    return h;
  }
  const DAY = /^<h2[^>]*[ \t\n\r\f]data-day="([^"]*)"/;
  function sections(nodes) {
    if (!nodes.some(n => n.tag === 'h2' && DAY.test(n.s))) return nodes;
    const out = []; let cur = null;
    for (const n of nodes) {
      const m = n.tag === 'h2' ? n.s.match(DAY) : null;
      if (m) {
        if (cur) out.push(box('#day', 'box', cur[0].s, cur[1], '', 'day|' + cur[2]));
        cur = [n, [], m[1]];
      } else if (cur) cur[1].push(n);
      else out.push(n);
    }
    if (cur) out.push(box('#day', 'box', cur[0].s, cur[1], '', 'day|' + cur[2]));
    return out;
  }

  function lcsMap(a, b) {
    const out = new Map(), n = a.length, m = b.length;
    let p = 0;
    while (p < n && p < m && a[p] === b[p]) { out.set(p, p); p++; }
    let q = 0;
    while (q < n - p && q < m - p && a[n - 1 - q] === b[m - 1 - q]) q++;
    const A = a.slice(p, n - q), B = b.slice(p, m - q), na = A.length, nb = B.length;
    if (na && nb) {
      const dp = []; for (let i = 0; i <= na; i++) dp.push(new Int32Array(nb + 1));
      for (let i = na - 1; i >= 0; i--) {
        const row = dp[i], nxt = dp[i + 1], ai = A[i];
        for (let j = nb - 1; j >= 0; j--) row[j] = ai === B[j] ? nxt[j + 1] + 1 : (nxt[j] >= row[j + 1] ? nxt[j] : row[j + 1]);
      }
      let i = 0, j = 0;
      while (i < na && j < nb) {
        if (A[i] === B[j]) { out.set(p + i, p + j); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
        else j++;
      }
    }
    for (let k = 0; k < q; k++) out.set(n - q + k, m - q + k);
    return out;
  }
  function similar(x, y) {
    if (x.box || y.box || x.tag !== y.tag) return false;
    const a = Array.from(x.nt()), b = Array.from(y.nt());
    if (a.length < 2 || b.length < 2) return false;
    const cnt = new Map();
    for (let k = 0; k < a.length - 1; k++) { const g = a[k] + a[k + 1]; cnt.set(g, (cnt.get(g) || 0) + 1); }
    let com = 0;
    for (let k = 0; k < b.length - 1; k++) { const g = b[k] + b[k + 1]; if ((cnt.get(g) || 0) > 0) { cnt.set(g, cnt.get(g) - 1); com++; } }
    return 20 * com >= 3 * ((a.length - 1) + (b.length - 1));
  }
  const sameArr = (x, y) => x.length === y.length && x.every((v, k) => v === y[k]);

  function M(later) { this.later = later; }
  M.prototype.pick = function (o, a, b) {
    if (a === b) return a;
    if (o != null && a === o) return b;
    if (o != null && b === o) return a;
    return this.later === 'b' ? b : a;
  };
  M.prototype.node = function (o, a, b) {
    if (a.s === b.s) return a;
    if (o != null && a.s === o.s) return b;
    if (o != null && b.s === o.s) return a;
    if (a.box && b.box && a.tag === b.tag) {
      const ob = (o != null && o.box && o.tag === a.tag) ? o : null;
      const kids = this.seq(ob ? ob.kids : [], a.kids, b.kids);
      const op = this.pick(ob ? ob.open : null, a.open, b.open);
      const cl = this.pick(ob ? ob.close : null, a.close, b.close);
      return box(a.tag, a.typ, op, kids, cl, a.tag === '#day' ? a.key : null);
    }
    if (a.box !== b.box) return a.box ? a : b;
    return this.later === 'b' ? b : a;
  };
  M.prototype.seq = function (O, A, B) {
    const sO = O.map(x => x.s), sA = A.map(x => x.s), sB = B.map(x => x.s);
    if (sameArr(sA, sB)) return A;
    if (sameArr(sA, sO)) return B;
    if (sameArr(sB, sO)) return A;
    const kO = O.map(x => x.key), kA = A.map(x => x.key), kB = B.map(x => x.key);
    const mA = lcsMap(kO, kA), mB = lcsMap(kO, kB);
    let out = [], i = 0, ia = 0, ib = 0;
    for (let k = 0; k < O.length; k++) {
      if (mA.has(k) && mB.has(k) && mA.get(k) >= ia && mB.get(k) >= ib) {
        out = out.concat(this.chunk(O.slice(i, k), A.slice(ia, mA.get(k)), B.slice(ib, mB.get(k))));
        out.push(this.node(O[k], A[mA.get(k)], B[mB.get(k)]));
        i = k + 1; ia = mA.get(k) + 1; ib = mB.get(k) + 1;
      }
    }
    return out.concat(this.chunk(O.slice(i), A.slice(ia), B.slice(ib)));
  };
  M.prototype.chunk = function (O, A, B) {
    if (!O.length && !A.length && !B.length) return [];
    const sO = O.map(x => x.s), sA = A.map(x => x.s), sB = B.map(x => x.s);
    if (sameArr(sA, sO)) return B;
    if (sameArr(sB, sO)) return A;
    if (sameArr(sA, sB)) return A;
    const lateB = this.later === 'b';
    const L = lateB ? B : A, E = lateB ? A : B;
    const setO = new Set(sO), setE = new Set(E.map(x => x.s));
    const mn = lateB ? (o, e, l) => this.node(o, e, l) : (o, e, l) => this.node(o, l, e);
    let res = L.slice();
    const usedO = new Set(), pairE = new Map(), pairL = new Set();
    for (let li = 0; li < L.length; li++) {
      const l = L[li]; if (!l.box) continue;
      for (let ei = 0; ei < E.length; ei++) {
        const e = E[ei]; if (pairE.has(ei) || !e.box || e.key !== l.key) continue;
        let o = null;
        for (let oi = 0; oi < O.length; oi++) { const x = O[oi]; if (!usedO.has(oi) && x.box && x.key === l.key) { o = x; usedO.add(oi); break; } }
        res[li] = mn(o, e, l); pairE.set(ei, res[li]); pairL.add(li); break;
      }
    }
    for (let oi = 0; oi < O.length; oi++) {
      const o = O[oi]; if (usedO.has(oi) || !o.box) continue;
      let li = null, ei = null;
      for (let k = 0; k < L.length; k++) if (!pairL.has(k) && L[k].box && L[k].tag === o.tag) { li = k; break; }
      for (let k = 0; k < E.length; k++) if (!pairE.has(k) && E[k].box && E[k].tag === o.tag) { ei = k; break; }
      if (li === null || ei === null) continue;
      usedO.add(oi); res[li] = mn(o, E[ei], L[li]); pairE.set(ei, res[li]); pairL.add(li);
    }
    res = res.filter((x, k) => pairL.has(k) || !(setO.has(x.s) && !setE.has(x.s)));
    let ptr = 0;
    for (let ei = 0; ei < E.length; ei++) {
      const e = E[ei];
      if (pairE.has(ei)) { ptr = Math.max(ptr, res.indexOf(pairE.get(ei)) + 1); continue; }
      let j = null;
      for (let k = ptr; k < res.length; k++) if (res[k].s === e.s) { j = k; break; }
      if (j !== null) { ptr = j + 1; continue; }
      if (res.some(x => x.s === e.s)) continue;
      if (setO.has(e.s)) continue;
      if (e.typ === 'ws') continue;
      const t = e.nt();
      if (t && res.some(x => x.nt().includes(t))) continue;
      j = null;
      if (O.some(x => similar(e, x))) for (let k = ptr; k < res.length; k++) if (similar(e, res[k])) { j = k; break; }   // base 줄을 고친 것일 때만 짝 옆(아래)으로
      const pos = j !== null ? j + 1 : ptr;
      let node = e;
      if (e.typ === 'inline' && pos > 0 && res[pos - 1].typ === 'inline') node = leaf('#text', 'inline', '<br>' + e.s);
      res.splice(pos, 0, node); ptr = pos + 1;
    }
    return res;
  };

  /* ---------- 화이트보드(JSON Canvas) ---------- */
  function canon(v) {   // 파이썬 json.dumps(sort_keys=True) 와 같은 비교용 글
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  function boardJson(s) {
    if (!s) return { nodes: [], edges: [] };
    const m = s.match(/[ \t\n\r\f]data-canvas="([^"]*)"/);
    if (!m) return { nodes: [], edges: [] };
    const raw = m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    if (!raw.trim()) return { nodes: [], edges: [] };
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('board');
    return j;
  }
  function mergeIds(O, A, B, lateB) {
    const ids = x => { const d = new Map(); for (const it of Array.isArray(x) ? x : []) if (it && typeof it === 'object' && !Array.isArray(it) && typeof it.id === 'string' && !d.has(it.id)) d.set(it.id, it); return d; };
    const dO = ids(O), dA = ids(A), dB = ids(B);
    const L = lateB ? B : A, dL = lateB ? dB : dA, dE = lateB ? dA : dB;
    const order = [...ids(L).keys(), ...[...dE.keys()].filter(k => !dL.has(k))];
    const out = [];
    for (const k of order) {
      const o = dO.has(k) ? dO.get(k) : null, a = dA.has(k) ? dA.get(k) : null, b = dB.has(k) ? dB.get(k) : null;
      if (a !== null && b !== null) {
        const ca = canon(a), cb = canon(b);
        if (ca === cb) out.push(a);
        else if (o !== null && ca === canon(o)) out.push(b);
        else if (o !== null && cb === canon(o)) out.push(a);
        else out.push(lateB ? b : a);
      } else {
        const x = a !== null ? a : b;
        if (o !== null && canon(x) === canon(o)) continue;
        out.push(x);
      }
    }
    return out;
  }
  function mergeBoard(o, a, b, lateB) {
    if (a === b) return a;
    if (o != null && a === o) return b;
    if (o != null && b === o) return a;
    const jo = boardJson(o || ''), ja = boardJson(a), jb = boardJson(b);
    const j = Object.assign({}, lateB ? jb : ja);
    j.nodes = mergeIds(jo.nodes, ja.nodes, jb.nodes, lateB);
    j.edges = mergeIds(jo.edges, ja.edges, jb.edges, lateB);
    if (!j.nodes.length && !j.edges.length && !(a || b)) return '';
    let body = JSON.stringify(j);
    body = body.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const shell = (lateB ? b : a) || a || b;
    const m = shell.match(/([ \t\n\r\f]data-canvas=")[^"]*(")/);
    if (m) return shell.slice(0, m.index) + m[1] + body + m[2] + shell.slice(m.index + m[0].length);
    return '<div class="board" hidden data-canvas="' + body + '"></div>';
  }

  /* ---------- 검사: 빠진 글줄 0 ---------- */
  function lines(h) {
    const out = []; h = h || '';
    const m = h.match(BOARD);
    const body = m ? h.slice(0, m.index) : h, bd = m ? m[0] : '';
    const walk = ns => { for (const n of ns) { if (n.box) walk(n.kids); else if (n.nt()) out.push(n.nt()); } };
    walk(parse(body));
    if (bd) {
      try {
        const j = boardJson(bd);
        for (const k of ['nodes', 'edges']) for (const it of j[k] || []) {
          if (it && typeof it === 'object' && !Array.isArray(it)) {
            out.push('board:' + k + ':' + pyStr(it.id));
            if (typeof it.text === 'string' && norm(it.text)) out.push(norm(it.text));
          }
        }
      } catch (e) { out.push('board:깨짐'); }
    }
    return out;
  }
  function pyStr(v) { return v === undefined || v === null ? 'None' : typeof v === 'string' ? v : typeof v === 'boolean' ? (v ? 'True' : 'False') : String(v); }
  function check(o, a, b, res) {
    const lo = new Set(o != null ? lines(o) : []), la = lines(a), lb = lines(b), lr = lines(res);
    const sa = new Set(la), sb = new Set(lb), joined = lr.join('\u0001'), miss = [];
    for (const t of la.concat(lb.filter(x => !sa.has(x)))) {
      const need = !lo.has(t) || (sa.has(t) && sb.has(t));
      if (need && !joined.includes(t) && !miss.includes(t)) miss.push(t);
    }
    return miss;
  }
  function newCount(res, other) { const lo = new Set(lines(other)); return lines(res).filter(t => !lo.has(t)).length; }
  function merge3(o, a, b, later) {
    a = a || ''; b = b || ''; if (o === undefined) o = null;
    if (a === b) return { ok: true, html: a, fromA: 0, fromB: 0 };
    if (o !== null && a === o) return { ok: true, html: b, fromA: 0, fromB: newCount(b, a) };
    if (o !== null && b === o) return { ok: true, html: a, fromA: newCount(a, b), fromB: 0 };
    let res;
    try {
      const lateB = later !== 'a';
      const split = h => { if (h === null) return null; const m = h.match(BOARD); return m ? [h.slice(0, m.index), m[0]] : [h, '']; };
      const po = split(o), pa = split(a), pb = split(b);
      const mm = new M(lateB ? 'b' : 'a');
      const ns = mm.seq(po ? sections(parse(po[0])) : [], sections(parse(pa[0])), sections(parse(pb[0])));
      res = renum(ns.map(n => n.s).join('')) + mergeBoard(po ? po[1] : null, pa[1], pb[1], lateB);
    } catch (e) {
      return { ok: false, why: '합치기 실패(' + (e && e.name || 'Error') + ')' };
    }
    const miss = check(o, a, b, res);
    if (miss.length) return { ok: false, why: '빠진 줄 ' + miss.length + '개: ' + Array.from(miss[0]).slice(0, 30).join('') };
    return { ok: true, html: res, fromA: newCount(res, b), fromB: newCount(res, a) };
  }
  const api = { merge3, lines, check, norm };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JisikMerge = api;
})(typeof self !== 'undefined' ? self : this);
