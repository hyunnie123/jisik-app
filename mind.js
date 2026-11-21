/* 지식 작업실 「마인드맵」 칸 (11/20) — editor.html(맥 서버판·폰앱 공용)이 부르고, PDF는 server.py가 헤드리스 크롬에 이 파일을 넣어 같은 그림으로 찍는다.
   저장 모양(원본/마인드맵/<제목>.html) — 사람이 읽고 합칠 수 있는 중첩 목록, <script> 없음. 한 줄에 주제 하나:
   <div class="mindmap" data-layout="map|right|down">
   <ul>
   <li>중심 주제
     <ul>
     <li data-color="#2f5d7c" data-collapsed="1" data-note="메모" data-todo="0|1" data-num="1" data-b="1" data-hl="1">주제 글자(b·mark·br만)</li>
     </ul>
   </li>
   </ul>
   </div>
   data-color = 그 가지부터 아래 색(없으면 1단계 가지마다 자동 색) · data-collapsed = 접힘 · data-note = 메모 · data-todo 0=할 일 1=완료
   data-num = 자식에 1. 2. 번호 · data-b = 굵게 · data-hl = 형광펜
   (11/20) 중심 주제 여러 개 = 맨 위 <ul> 안의 <li> 여러 개. 중심 주제 <li>의 data-x/data-y = 그 중심 주제 가운데 자리(그림 좌표, 없으면 첫째는 0,0·나머지는 앞 묶음 아래).
   속에서는 이름 없는 맨 위 상자(st.root, 화면에 안 나옴)의 kids = 중심 주제들. */
(function () {
  'use strict';
  const PAL = ['#a3271f', '#2f5d7c', '#4f7a3a', '#b5761f', '#6b4c8a', '#2e7d73', '#8a5a3c', '#b0485f'];
  const LAYOUTS = { map: '양쪽 마인드맵', right: '오른쪽 논리도', down: '아래로 조직도' };
  const DEF = '중심 주제';
  const FLAGS = ['color', 'collapsed', 'note', 'todo', 'num', 'b', 'hl', 'x', 'y'];
  let seq = 0;
  const nid = () => 'm' + (++seq).toString(36);
  const mk = (text = '', kids = []) => ({ id: nid(), text, kids });
  const escT = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const escA = s => escT(s).replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
  const f1 = x => Math.round(x * 10) / 10;
  const say = (t, ms) => (typeof window.toast === 'function' ? window.toast(t, ms) : console.log(t));
  function plain(h) { const t = document.createElement('template'); t.innerHTML = String(h || '').replace(/<br\s*\/?>/gi, '\n'); return t.content.textContent; }
  const oneLine = h => plain(h).replace(/\s+/g, ' ').trim();

  /* ---------- 주제 글자 다듬기: b · mark · br 만 남김 ---------- */
  function cleanKids(el) {
    let o = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { o += escT(n.nodeValue.replace(/[\s ]+/g, ' ')); continue; }
      if (n.nodeType !== 1) continue;
      const tg = n.tagName;
      if (tg === 'BR') { o += '<br>'; continue; }
      if (/^(UL|OL|SCRIPT|STYLE|TEMPLATE|SVG|BUTTON|INPUT|TEXTAREA|SELECT|IMG|VIDEO|IFRAME)$/.test(tg)) continue;
      if (n.classList && (n.classList.contains('mchk') || n.classList.contains('mnum') || n.classList.contains('mnote'))) continue;
      const inner = cleanKids(n);
      const bold = tg === 'B' || tg === 'STRONG' || (n.style && /^(bold|bolder|[6-9]00)$/.test(n.style.fontWeight || ''));
      if (tg === 'MARK') o += inner.trim() ? `<mark>${inner}</mark>` : inner;
      else if (bold) o += inner.trim() ? `<b>${inner}</b>` : inner;
      else if (/^(DIV|P|H[1-6]|LI|BLOCKQUOTE|PRE|TR)$/.test(tg)) o += (o && !/<br>$/.test(o) ? '<br>' : '') + inner;
      else o += inner;
    }
    return o;
  }
  function clean(h) {
    const t = document.createElement('template'); t.innerHTML = String(h || '');
    return cleanKids(t.content).replace(/\s*<br>\s*/g, '<br>').replace(/<(b|mark)>(\s*)<\/\1>/g, '$2')
      .replace(/<\/b><b>|<\/mark><mark>/g, '').replace(/^(\s|<br>)+|(\s|<br>)+$/g, '');
  }
  const inl = s => escT(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/==(.+?)==/g, '<mark>$1</mark>');

  /* ---------- 읽기·쓰기 ---------- */
  function fromLi(li) {
    const n = mk(), box = document.createElement('div');
    for (const c of li.childNodes) if (!(c.nodeType === 1 && /^(UL|OL)$/.test(c.tagName))) box.appendChild(c.cloneNode(true));
    n.text = clean(box.innerHTML);
    const d = li.dataset || {};
    if (d.color && /^#[0-9a-f]{6}$/i.test(d.color)) n.color = d.color.toLowerCase();
    if (d.collapsed === '1') n.collapsed = true;
    if (d.note && d.note.trim()) n.note = d.note;
    if (d.todo === '0' || d.todo === '1') n.todo = +d.todo;
    else if (li.parentElement && li.parentElement.classList.contains('todo')) n.todo = li.classList.contains('done') ? 1 : 0;
    if (d.num === '1') n.num = true;
    if (d.b === '1') n.b = true;
    if (d.hl === '1') n.hl = true;
    for (const ul of li.children) if (/^(UL|OL)$/.test(ul.tagName)) {
      if (ul.tagName === 'OL') n.num = true;
      for (const k of ul.children) if (k.tagName === 'LI') n.kids.push(fromLi(k));
    }
    if (!n.kids.length) delete n.collapsed;
    return n;
  }
  /* 아무 HTML(공식집 글의 h2/h3/목록, 다른 마인드맵) → 가지 여러 개 */
  function forestFromHtml(html) {
    const t = document.createElement('template'); t.innerHTML = String(html || '');
    const mm = t.content.querySelector('.mindmap > ul');
    if (mm) return [...mm.children].filter(x => x.tagName === 'LI').map(fromLi);
    const out = []; let h2 = null, h3 = null;
    const add = n => { const p = h3 || h2; (p ? p.kids : out).push(n); };
    const walk = el => {
      for (const c of el.children) {
        const tg = c.tagName;
        if (tg === 'H1' || tg === 'H2') { h2 = mk(clean(c.innerHTML)); h3 = null; out.push(h2); }
        else if (/^H[3-6]$/.test(tg)) { h3 = mk(clean(c.innerHTML)); (h2 ? h2.kids : out).push(h3); }
        else if (tg === 'UL' || tg === 'OL') { if (tg === 'OL' && (h3 || h2)) (h3 || h2).num = true; for (const li of c.children) if (li.tagName === 'LI') add(fromLi(li)); }
        else if (/^(DIV|SECTION|ARTICLE|MAIN|BODY|HEADER|FOOTER|SPAN)$/.test(tg) && c.querySelector('h1,h2,h3,h4,p,ul,ol,li,div,blockquote')) walk(c);
        else if (tg === 'BLOCKQUOTE' && c.querySelector('p,ul,ol')) walk(c);
        else if (/^(HR|STYLE|SCRIPT|META|LINK|TEMPLATE|IMG|TABLE)$/.test(tg)) continue;
        else { const tx = clean(c.innerHTML); if (oneLine(tx)) add(mk(tx)); }
      }
    };
    walk(t.content);
    if (!out.length) { const tx = clean(html); if (oneLine(tx)) for (const line of tx.split('<br>')) if (oneLine(line)) out.push(mk(line)); }
    return out;
  }
  /* 들여쓰기 글(탭·띄어쓰기·- * • 1. # 제목 [ ] 체크) → 가지 여러 개 */
  function forestFromText(s) {
    const out = []; let heads = [], stack = [];
    for (const raw of String(s || '').replace(/\r/g, '').split('\n')) {
      if (!raw.trim()) continue;
      const lead = raw.match(/^[\t 　]*/)[0], ind = lead.replace(/\t/g, '    ').replace(/　/g, '  ').length;
      let t = raw.slice(lead.length).trim(), m;
      if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
        const d = m[1].length - 1, n = mk(inl(m[2]));
        heads = heads.slice(0, d); const p = heads[heads.length - 1];
        (p ? p.kids : out).push(n); heads.push(n); stack = []; continue;
      }
      let todo = null, numd = false;
      t = t.replace(/^[-*+•·◦▪‣○●■□◆◇▶▷→]\s*/, '');
      if ((m = t.match(/^\[( |x|X|v|V)?\]\s*/))) { todo = m[1] && m[1] !== ' ' ? 1 : 0; t = t.slice(m[0].length); }
      if ((m = t.match(/^(\d{1,3}|[①-⑳])[.)]?\s+/)) && /^\d/.test(m[1]) ? /[.)]/.test(m[0]) : m) { t = t.slice(m[0].length); numd = true; }
      while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
      const parent = stack.length ? stack[stack.length - 1].node : heads[heads.length - 1];
      const n = mk(inl(t)); if (todo != null) n.todo = todo;
      if (numd && parent) parent.num = true;
      (parent ? parent.kids : out).push(n); stack.push({ ind, node: n });
    }
    return out;
  }
  function parse(html) {
    const t = document.createElement('template'); t.innerHTML = String(html || '');
    const box = t.content.querySelector('.mindmap');
    if (box) {
      const cs = [...box.querySelectorAll(':scope > ul > li')].map(li => {
        const n = fromLi(li), x = parseFloat(li.dataset.x), y = parseFloat(li.dataset.y);
        if (isFinite(x) && isFinite(y)) { n.x = x; n.y = y; }
        delete n.collapsed; return n;
      });
      return { layout: LAYOUTS[box.dataset.layout] ? box.dataset.layout : 'map', root: mk('', cs.length ? cs : [mk(DEF)]) };
    }
    const f = String(html || '').trim() ? forestFromHtml(html) : [];
    return { layout: 'map', root: mk('', [f.length === 1 ? f[0] : mk(DEF, f)]) };
  }
  function attrs(n) {
    let a = '';
    if (n.color) a += ` data-color="${n.color}"`;
    if (n.collapsed && n.kids.length) a += ' data-collapsed="1"';
    if (n.todo === 0 || n.todo === 1) a += ` data-todo="${n.todo}"`;
    if (n.num) a += ' data-num="1"';
    if (n.b) a += ' data-b="1"';
    if (n.hl) a += ' data-hl="1"';
    if (n.note) a += ` data-note="${escA(n.note)}"`;
    if (n.x != null && n.y != null) a += ` data-x="${Math.round(n.x)}" data-y="${Math.round(n.y)}"`;
    return a;
  }
  function serNode(n, d) {
    const ind = '  '.repeat(d);
    if (!n.kids.length) return `${ind}<li${attrs(n)}>${n.text}</li>\n`;
    return `${ind}<li${attrs(n)}>${n.text}\n${ind}  <ul>\n${n.kids.map(k => serNode(k, d + 2)).join('')}${ind}  </ul>\n${ind}</li>\n`;
  }
  function serialize(st) { return `<div class="mindmap" data-layout="${LAYOUTS[st.layout] ? st.layout : 'map'}">\n<ul>\n${st.root.kids.map(c => serNode(c, 0)).join('')}</ul>\n</div>\n`; }
  function toText(n, d) { return '\t'.repeat(d) + (n.todo === 1 ? '[x] ' : n.todo === 0 ? '[ ] ' : '') + oneLine(n.text) + '\n' + n.kids.map(k => toText(k, d + 1)).join(''); }
  function strip(n) { const o = { id: n.id, text: n.text, kids: n.kids.map(strip) }; for (const k of FLAGS) if (n[k] != null && n[k] !== false) o[k] = n[k]; return o; }
  function refresh(n) { n.id = nid(); n.kids.forEach(refresh); return n; }
  function count(n) { return n.kids.reduce((s, k) => s + 1 + count(k), 0); }

  /* ---------- 색·단계·보이는 것 ---------- */
  function index(root, keepColor) {
    const byId = new Map(), par = new Map(), vis = [];
    const walk = (n, p, d, c, i, show) => {
      byId.set(n.id, n); par.set(n.id, p); n._d = d; n._lv = Math.min(d, 2);
      if (!keepColor || !n._c) n._c = d === 0 ? '#26231f' : (n.color || (d === 1 ? PAL[i % PAL.length] : c));   // 가지 색은 중심 주제마다 따로 처음부터
      n._num = p && p.num ? (i + 1) + '.' : '';
      if (show) vis.push(n);
      n.kids.forEach((k, j) => walk(k, n, d + 1, n._c, j, show && !n.collapsed));
    };
    root.kids.forEach((c, j) => { c._ci = j; walk(c, null, 0, '#26231f', j, true); });   // 중심 주제의 부모는 없음(null) — 맨 위 상자는 그림에 안 나옴
    return { byId, par, vis };
  }

  /* ---------- 배치 ---------- */
  const vk = n => (n.collapsed ? [] : n.kids);
  const gh = n => (n._d === 0 ? 56 : 34), gv = n => (n._d === 0 ? 20 : 8);
  const dv = n => (n._d === 0 ? 54 : 40), dh = n => (n._d === 0 ? 28 : 14);
  function mH(n) { const ks = vk(n); if (!ks.length) return (n._sh = n._h); let s = 0; ks.forEach((k, i) => { s += mH(k) + (i ? gv(n) : 0); }); n._kh = s; return (n._sh = Math.max(n._h, s)); }
  function pH(n, x, top, dir) {
    n._dir = dir; n._x = dir > 0 ? x : x - n._w; n._y = top + (n._sh - n._h) / 2;
    const ks = vk(n); if (!ks.length) return;
    let y = top + (n._sh - n._kh) / 2; const nx = dir > 0 ? n._x + n._w + gh(n) : n._x - gh(n);
    for (const k of ks) { pH(k, nx, y, dir); y += k._sh + gv(n); }
  }
  function mW(n) { const ks = vk(n); if (!ks.length) return (n._sw = n._w); let s = 0; ks.forEach((k, i) => { s += mW(k) + (i ? dh(n) : 0); }); n._kw = s; return (n._sw = Math.max(n._w, s)); }
  function pW(n, left, y) {
    n._dir = 0; n._x = left + (n._sw - n._w) / 2; n._y = y;
    const ks = vk(n); if (!ks.length) return;
    let x = left + (n._sw - n._kw) / 2; const ny = y + n._h + dv(n);
    for (const k of ks) { pW(k, x, ny); x += k._sw + dh(n); }
  }
  function layoutOne(r, L) {   // 중심 주제 하나와 그 가지를 (0,0) 둘레에
    r._dir = 0;
    if (L === 'down') { mW(r); pW(r, -r._sw / 2, -r._h / 2); return; }
    r._x = -r._w / 2; r._y = -r._h / 2;
    const ks = vk(r); ks.forEach(mH);
    let R = ks, Lf = [];
    if (L === 'map' && ks.length > 1) {   // 시계 방향: 오른쪽 위→아래, 왼쪽 아래→위 · 높이로 반반
      const tot = ks.reduce((s, k) => s + k._sh, 0); let acc = 0, left = false; R = [];
      ks.forEach((k, i) => { if (!left && (i === 0 || acc + k._sh / 2 <= tot / 2)) { R.push(k); acc += k._sh; } else { left = true; Lf.push(k); } });
    }
    const side = (arr, dir) => {
      if (!arr.length) return;
      const tot = arr.reduce((s, k, i) => s + k._sh + (i ? gv(r) : 0), 0); let y = -tot / 2;
      const x = dir > 0 ? r._x + r._w + gh(r) : r._x - gh(r);
      for (const k of (dir > 0 ? arr : arr.slice().reverse())) { pH(k, x, y, dir); y += k._sh + gv(r); }
    };
    side(R, 1); side(Lf, -1);
  }
  function shiftTree(n, dx, dy) { n._x += dx; n._y += dy; for (const k of vk(n)) shiftTree(k, dx, dy); }
  function gbox(n, b) {   // 한 묶음(보이는 것)의 테두리
    b = b || { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    b.x0 = Math.min(b.x0, n._x); b.y0 = Math.min(b.y0, n._y); b.x1 = Math.max(b.x1, n._x + n._w); b.y1 = Math.max(b.y1, n._y + n._h);
    for (const k of vk(n)) gbox(k, b); return b;
  }
  const GAP = 48;
  /* 중심 주제마다 따로 배치 → 저장한 자리(x,y)로 옮김 → 묶음끼리 겹치면 살짝 밀어냄. first = 먼저 자리 잡을 묶음(지금 끄는 것) */
  function layout(st, first) {
    const L = st.layout, cs = st.root.kids, done = [];
    const order = first && cs.includes(first) ? [first, ...cs.filter(c => c !== first)] : cs.slice();
    for (const c of order) {
      layoutOne(c, L);
      const b = gbox(c);
      let ox, oy;
      if (c.x != null && c.y != null) { ox = c.x; oy = c.y; }
      else if (!done.length) { ox = 0; oy = 0; }
      else { const u = done.reduce((a, d) => ({ x0: Math.min(a.x0, d.b.x0), y1: Math.max(a.y1, d.b.y1) }), { x0: Infinity, y1: -Infinity }); ox = u.x0 - b.x0; oy = u.y1 + GAP * 1.5 - b.y0; }
      for (let it = 0; it < 30; it++) {   // 겹치면 덜 겹친 쪽으로 밀기
        let hit = null;
        for (const d of done) if (b.x0 + ox < d.b.x1 + GAP && b.x1 + ox > d.b.x0 - GAP && b.y0 + oy < d.b.y1 + GAP && b.y1 + oy > d.b.y0 - GAP) { hit = d; break; }
        if (!hit) break;
        const cx = (b.x0 + b.x1) / 2 + ox, cy = (b.y0 + b.y1) / 2 + oy, hx = (hit.b.x0 + hit.b.x1) / 2, hy = (hit.b.y0 + hit.b.y1) / 2;
        const px = cx >= hx ? hit.b.x1 + GAP - (b.x0 + ox) : -((b.x1 + ox) - (hit.b.x0 - GAP));
        const py = cy >= hy ? hit.b.y1 + GAP - (b.y0 + oy) : -((b.y1 + oy) - (hit.b.y0 - GAP));
        if (Math.abs(px) <= Math.abs(py)) ox += px; else oy += py;
      }
      shiftTree(c, ox, oy); c._ox = ox; c._oy = oy;
      done.push({ c, b: { x0: b.x0 + ox, y0: b.y0 + oy, x1: b.x1 + ox, y1: b.y1 + oy } });
    }
  }
  function aOut(p, L, dir) {
    if (L === 'down') return [p._x + p._w / 2, p._y + p._h];
    if (p._d === 0) return [p._x + p._w / 2, p._y + p._h / 2];
    return [dir > 0 ? p._x + p._w : p._x, p._lv >= 2 ? p._y + p._h - 1 : p._y + p._h / 2];
  }
  function aIn(c, L) {
    if (L === 'down') return [c._x + c._w / 2, c._y];
    return [c._dir > 0 ? c._x : c._x + c._w, c._lv >= 2 ? c._y + c._h - 1 : c._y + c._h / 2];
  }
  function ePath(p, c, L) {
    const [x1, y1] = aOut(p, L, c._dir), [x2, y2] = aIn(c, L);
    if (L === 'down') { const m = (y1 + y2) / 2; return `M${f1(x1)},${f1(y1)}C${f1(x1)},${f1(m)} ${f1(x2)},${f1(m)} ${f1(x2)},${f1(y2)}`; }
    const a = p._d === 0 ? 0.25 : 0.5, b = p._d === 0 ? 0.6 : 0.5;
    return `M${f1(x1)},${f1(y1)}C${f1(x1 + (x2 - x1) * a)},${f1(y1)} ${f1(x1 + (x2 - x1) * b)},${f1(y2)} ${f1(x2)},${f1(y2)}`;
  }
  const eWidth = p => (p._d === 0 ? 3.2 : p._d === 1 ? 2.2 : 1.6);
  function foldAt(n, L) {   // 접기 동그라미 자리(그림 좌표) + 붙일 class
    const [x, y] = aOut(n, L, n._dir);
    if (L === 'down') return [x, y + 4, 'dn'];
    return n._dir < 0 ? [x - 4, y - 9, 'lft'] : [x + 4, y - 9, ''];
  }
  const cls = n => `mn l${n._lv}${n.b ? ' b' : ''}${n.hl ? ' hl' : ''}${n.todo === 1 ? ' done' : ''}`;
  const inner = n => `${n.todo === 0 || n.todo === 1 ? '<span class="mchk"></span>' : ''}${n._num ? `<span class="mnum">${n._num}</span>` : ''}<span class="mt">${n.text}</span>${n.note ? `<span class="mnote" title="${escA(n.note)}"></span>` : ''}`;
  const sigOf = n => `${n._lv}|${n.b ? 1 : 0}|${n.hl ? 1 : 0}|${n.todo}|${n._num}|${n.note || ''}|${n.text}`;
  function bbox(vis) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of vis) { x0 = Math.min(x0, n._x); y0 = Math.min(y0, n._y); x1 = Math.max(x1, n._x + n._w); y1 = Math.max(y1, n._y + n._h); }
    return { x: x0 - 12, y: y0 - 12, w: x1 - x0 + 24 + 30, h: y1 - y0 + 24 + 14 };
  }

  /* =================================================================== 편집기 */
  let M = null;
  const coarse = () => matchMedia('(pointer:coarse)').matches;
  const node = id => (M && M.ix ? M.ix.byId.get(id) : null);
  const parentOf = n => (M && n ? M.ix.par.get(n.id) : null);
  const centers = () => M.st.root.kids;
  const isC = n => !!(M && n && M.st.root.kids.includes(n));
  const sibsOf = n => { const p = parentOf(n); return p ? p.kids : centers(); };
  const cOf = n => { let c = n, p; while (c && (p = parentOf(c))) c = p; return c; };

  function mount(host, html, o = {}) {
    unmount();
    const st = parse(html);
    M = { host, o, st, sel: st.root.kids[0].id, multi: new Set(), view: o.view ? { ...o.view } : null, mode: o.mode === 'outline' ? 'outline' : 'map',
      undo: [], redo: [], editing: null, els: new Map(), paths: new Map(), folds: new Map(), ptrs: new Map(), press: null, pinch: null, space: null, lastTap: null, otyping: false };
    host.innerHTML = `<div class="mm${coarse() ? ' coarse' : ''}">
<div class="mm-tools" role="toolbar" aria-label="마인드맵 도구">
 <select class="mm-lay" title="배치 바꾸기">${Object.entries(LAYOUTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
 <span class="mm-seg"><button type="button" data-a="mode-map" title="마인드맵으로 보기">마인드맵</button><button type="button" data-a="mode-ol" title="들여쓰기 목록으로 보고 고치기">개요</button></span>
 <span class="mm-sep"></span>
 <button type="button" data-a="child" title="자식 추가 (Tab)">+자식</button>
 <button type="button" data-a="sib" title="형제 추가 (Enter)">+형제</button>
 <button type="button" data-a="center" title="새 중심 주제 (⌘⇧Enter · 빈 곳 더블클릭)">+ 중심 주제</button>
 <button type="button" data-a="outdent" class="ol-only" title="내어쓰기 (⇧Tab)">← 내어</button>
 <button type="button" data-a="indent" class="ol-only" title="들여쓰기 (Tab)">들여 →</button>
 <button type="button" data-a="del" title="지우기 (Delete) — 자식도 같이, ⌘Z로 되살림">지우기</button>
 <button type="button" data-a="fold" title="접기·펴기 (⌘/)">접기</button>
 <span class="mm-sep"></span>
 <button type="button" data-a="color" title="가지 색 (그 가지부터 아래로)">색</button>
 <button type="button" data-a="bold" title="굵게 (⌘B)"><b>가</b></button>
 <button type="button" data-a="hl" title="형광펜 (⌘⇧H)"><span class="hl">형광</span></button>
 <button type="button" data-a="todo" title="체크박스 달기·떼기 · 네모를 누르면 완료 (⌘Enter)">체크</button>
 <button type="button" data-a="num" title="이 주제의 자식에 1. 2. 번호">번호</button>
 <button type="button" data-a="note" title="짧은 메모 달기">메모</button>
 <span class="mm-sep"></span>
 <button type="button" data-a="undo" title="되돌리기 (⌘Z)">되돌리기</button>
 <button type="button" data-a="redo" title="다시 (⌘⇧Z)">다시</button>
 <button type="button" data-a="fit" class="map-only" title="화면에 맞추기 (⌘0)">화면에 맞추기</button>
</div>
<div class="mm-canvas" tabindex="0" aria-label="마인드맵">
 <div class="mm-stage"><svg class="mm-edges" aria-hidden="true"></svg><div class="mm-nodes"></div><textarea class="mm-kb" rows="1" spellcheck="false" autocomplete="off" aria-label="고른 주제에 바로 쓰기"></textarea><div class="mm-ph" hidden></div><div class="mm-bar" hidden></div></div>
 <div class="mm-fab" hidden></div>
 <button type="button" class="mm-addc" data-a="center" title="새 중심 주제">+ 중심 주제</button>
 <div class="mm-zoom"><button type="button" data-a="zout" title="축소 (⌘−)">−</button><span class="mm-zl">100%</span><button type="button" data-a="zin" title="확대 (⌘+)">+</button></div>
</div>
<div class="mm-outline" hidden></div>
<div class="mm-pop" hidden></div>
</div>`;
    const q = s => host.querySelector(s);
    Object.assign(M, { root: q('.mm'), tools: q('.mm-tools'), canvas: q('.mm-canvas'), stage: q('.mm-stage'), svg: q('.mm-edges'), nodes: q('.mm-nodes'),
      ph: q('.mm-ph'), kb: q('.mm-kb'), bar: q('.mm-bar'), fab: q('.mm-fab'), zl: q('.mm-zl'), outline: q('.mm-outline'), pop: q('.mm-pop'), lay: q('.mm-lay') });
    bind();
    M.lay.value = st.layout;
    setMode(M.mode, true);
    if (!M.view) { M.view = { x: 0, y: 0, k: 1 }; requestAnimationFrame(() => M && fit()); }
    applyView();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (M && M.st === st) { remeasure(); if (!o.view) fit(); } });
    return M;
  }
  function unmount() {
    if (!M) return null;
    const out = { view: M.view ? { ...M.view } : null, mode: M.mode };
    try { M.ro && M.ro.disconnect(); } catch (e) {}
    document.removeEventListener('copy', onCopy); document.removeEventListener('cut', onCut); document.removeEventListener('paste', onPaste);
    M = null; return out;
  }
  const changedNow = () => { if (M && M.o.onChange) M.o.onChange(); };
  /* 고른 주제 위에 숨은 글자 받이(textarea) — 고르고 바로 치면(한글 조합 포함) 그 주제를 새로 쓴다 */
  function focusMap() { if (!M) return; placeKb(); M.kb.focus({ preventScroll: true }); }
  function placeKb() {
    if (!M || (M.editing && M.editing.kb)) return; const n = node(M.sel);
    M.kb.style.transform = n && n._x != null ? `translate(${f1(n._x + 4)}px,${f1(n._y + 4)}px)` : 'translate(-9999px,0)';
  }
  function kbStart() {
    const n = node(M.sel); if (!n || M.editing) return false;
    const r = M.els.get(n.id); if (!r) return false;
    const cs = getComputedStyle(r.el.querySelector('.mt'));
    M.editing = { id: n.id, before: n.text, isNew: false, kb: true };
    r.el.classList.add('edit', 'kbedit');
    Object.assign(M.kb.style, { fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight });
    M.kb.classList.add('on'); kbSync(); return true;
  }
  function kbSync() {
    const e = M.editing; if (!e || !e.kb) return;
    const n = node(e.id), r = M.els.get(e.id); if (!n || !r) return;
    r.el.querySelector('.mt').innerHTML = escT(M.kb.value).replace(/\n/g, '<br>') || '';
    r.w = null; render();
    const pad = getComputedStyle(r.el);
    Object.assign(M.kb.style, { transform: `translate(${f1(n._x)}px,${f1(n._y)}px)`, width: f1(n._w) + 'px', height: f1(n._h) + 'px', padding: pad.padding });
  }

  /* ---------- 그리기 ---------- */
  function remeasure() { if (!M || M.mode !== 'map') return; for (const r of M.els.values()) r.w = null; render(); }
  function render() {
    if (!M) return;
    M.ix = index(M.st.root);
    if (M.mode === 'outline') { renderOutline(); tools(); return; }
    const L = M.st.layout, ed = M.editing && M.editing.id, seen = new Set();
    M.stage.classList.toggle('down', L === 'down');
    for (const n of M.ix.vis) {
      seen.add(n.id); let r = M.els.get(n.id);
      if (!r) { const el = document.createElement('div'); el.dataset.id = n.id; M.nodes.appendChild(el); r = { el, sig: '', w: null }; M.els.set(n.id, r); }
      if (n.id !== ed) {
        const sig = sigOf(n);
        if (r.sig !== sig) { r.el.innerHTML = inner(n); r.el.className = cls(n); r.sig = sig; r.w = null; }
      } else r.w = null;
      if (r.c !== n._c) { r.el.style.setProperty('--c', n._c); r.c = n._c; }
      if (r.ld !== L) { r.ld = L; r.w = null; }
    }
    for (const [id, r] of M.els) if (!seen.has(id)) { r.el.remove(); M.els.delete(id); }
    for (const n of M.ix.vis) { const r = M.els.get(n.id); if (r.w == null) { r.w = r.el.offsetWidth; r.h = r.el.offsetHeight; } n._w = r.w; n._h = r.h; }
    layout(M.st, M.gd && M.gd.c);
    for (const n of M.ix.vis) { const r = M.els.get(n.id), tr = `translate(${f1(n._x)}px,${f1(n._y)}px)`; if (r.tr !== tr) { r.el.style.transform = tr; r.tr = tr; } }
    // 선
    const pseen = new Set();
    for (const n of M.ix.vis) {
      const p = M.ix.par.get(n.id); if (!p) continue; pseen.add(n.id);
      let pa = M.paths.get(n.id);
      if (!pa) { pa = document.createElementNS('http://www.w3.org/2000/svg', 'path'); M.svg.appendChild(pa); M.paths.set(n.id, pa); }
      pa.setAttribute('d', ePath(p, n, L)); pa.setAttribute('stroke', n._c); pa.setAttribute('stroke-width', eWidth(p));
    }
    for (const [id, pa] of M.paths) if (!pseen.has(id)) { pa.remove(); M.paths.delete(id); }
    // 접기 동그라미
    const fseen = new Set();
    for (const n of M.ix.vis) {
      if (!n.kids.length || n._d === 0) continue; fseen.add(n.id);
      let b = M.folds.get(n.id);
      if (!b) { b = document.createElement('div'); b.dataset.fold = n.id; M.nodes.appendChild(b); M.folds.set(n.id, b); }
      const [x, y, k] = foldAt(n, L), shut = !!n.collapsed;
      b.className = `mf ${k}${shut ? '' : ' exp'}${n.id === M.sel ? ' show' : ''}`;
      b.textContent = shut ? String(count(n)) : '−';
      b.title = shut ? `펴기 (숨은 주제 ${count(n)}개)` : '접기';
      b.style.setProperty('--c', n._c); b.style.left = f1(x) + 'px'; b.style.top = f1(y) + 'px';
    }
    for (const [id, b] of M.folds) if (!fseen.has(id)) { b.remove(); M.folds.delete(id); }
    paintSel(); tools();
  }
  function paintSel() {
    if (!M) return;
    for (const [id, r] of M.els) { r.el.classList.toggle('sel', id === M.sel); r.el.classList.toggle('multi', M.multi.has(id) && id !== M.sel); }
    for (const [id, b] of M.folds) b.classList.toggle('show', id === M.sel);
    placeKb(); placeFab();
  }
  function applyView() {
    if (!M) return; const v = M.view;
    M.stage.style.transform = `translate(${f1(v.x)}px,${f1(v.y)}px) scale(${v.k})`;
    M.zl.textContent = Math.round(v.k * 100) + '%';
    placeFab();
  }
  function zoomAt(k, cx, cy) {
    M.moved = true; const v = M.view; k = Math.max(0.12, Math.min(3, k));
    v.x = cx - (cx - v.x) * (k / v.k); v.y = cy - (cy - v.y) * (k / v.k); v.k = k; applyView();
  }
  function fit() {
    if (!M || M.mode !== 'map') return;
    const cw = M.canvas.clientWidth, ch = M.canvas.clientHeight; if (!cw || !ch) return;
    if (!M.ix) render();
    const b = bbox(M.ix.vis), k = Math.max(0.12, Math.min(1, (cw - 40) / b.w, (ch - 40) / b.h));
    M.view = { k, x: cw / 2 - (b.x + b.w / 2) * k, y: ch / 2 - (b.y + b.h / 2) * k }; applyView();
  }
  function ensureVisible(n) {
    if (!n || n._x == null || M.mode !== 'map') return;
    const v = M.view, cw = M.canvas.clientWidth, ch = M.canvas.clientHeight, pad = 30;
    const x0 = v.x + n._x * v.k, y0 = v.y + n._y * v.k, x1 = x0 + n._w * v.k, y1 = y0 + n._h * v.k;
    let dx = 0, dy = 0;
    if (x0 < pad) dx = pad - x0; else if (x1 > cw - pad) dx = Math.max(pad - x0, cw - pad - x1);
    if (y0 < pad) dy = pad - y0; else if (y1 > ch - pad - (coarse() ? 60 : 0)) dy = Math.max(pad - y0, ch - pad - (coarse() ? 60 : 0) - y1);
    if (dx || dy) { v.x += dx; v.y += dy; applyView(); }
  }
  function tools() {
    if (!M) return;
    const n = node(M.sel), C = isC(n);
    const set = (a, on, dis) => { const b = M.tools.querySelector(`[data-a="${a}"]`); if (!b) return; if (on != null) b.classList.toggle('on', !!on); if (dis != null) b.disabled = !!dis; };
    set('mode-map', M.mode === 'map'); set('mode-ol', M.mode === 'outline');
    set('del', null, !n || (C && centers().length < 2)); set('fold', null, !n || !n.kids.length || C);
    set('bold', !!(n && n.b)); set('hl', !!(n && n.hl)); set('todo', !!(n && n.todo != null)); set('num', !!(n && n.num)); set('note', !!(n && n.note));
    set('undo', null, !M.undo.length); set('redo', null, !M.redo.length);
    const p = parentOf(n); set('indent', null, C ? centers().indexOf(n) <= 0 : !p || p.kids.indexOf(n) === 0); set('outdent', null, !p);   // 1단 가지 내어쓰기 = 새 중심 주제
    const fb = M.tools.querySelector('[data-a="fold"]'); if (fb) fb.textContent = n && n.collapsed ? '펴기' : '접기';
    if (M.lay.value !== M.st.layout) M.lay.value = M.st.layout;
  }
  function placeFab() {
    if (!M) return;
    const n = node(M.sel), show = coarse() && M.mode === 'map' && n && !M.editing && n._x != null && !M.press;
    M.fab.hidden = !show; if (!show) return;
    const root = isC(n), delOk = !root || centers().length > 1;
    const want = `${n.id}|${n.collapsed ? 1 : 0}|${n.kids.length ? 1 : 0}|${delOk ? 1 : 0}`;
    if (M.fab.dataset.k !== want) {
      M.fab.dataset.k = want;
      M.fab.innerHTML = `<button type="button" data-a="child">+자식</button>${root ? '' : '<button type="button" data-a="sib">+형제</button>'}<button type="button" data-a="edit">고치기</button>`
        + (n.kids.length && !root ? `<button type="button" data-a="fold">${n.collapsed ? '펴기' : '접기'}</button>` : '') + (delOk ? '<button type="button" class="del" data-a="del">지우기</button>' : '');
    }
    const v = M.view, cw = M.canvas.clientWidth, ch = M.canvas.clientHeight, fw = M.fab.offsetWidth || 260, fh = 44;
    let x = v.x + (n._x + n._w / 2) * v.k - fw / 2, y = v.y + (n._y + n._h) * v.k + 10;
    if (y + fh > ch - 8) y = v.y + n._y * v.k - fh - 10;
    x = Math.max(8, Math.min(cw - fw - 8, x)); y = Math.max(8, Math.min(ch - fh - 8, y));
    M.fab.style.transform = `translate(${f1(x)}px,${f1(y)}px)`;
  }

  /* ---------- 바꾸기(되돌리기 가능) ---------- */
  function snap() { return JSON.stringify({ l: M.st.layout, r: strip(M.st.root), s: M.sel }); }
  function mut() { M.undo.push(snap()); if (M.undo.length > 300) M.undo.shift(); M.redo = []; }
  function restore(s) { const j = JSON.parse(s); M.st = { layout: j.l, root: j.r }; M.sel = j.s; M.multi.clear(); }
  function changed(focusId) {
    if (!M) return;
    if (M.mode === 'outline') { M.ix = index(M.st.root); renderOutline(focusId); tools(); }
    else { render(); ensureVisible(node(M.sel)); }
    changedNow();
  }
  function undo() { if (!M.undo.length) return say('되돌릴 게 없어요'); commit(); M.redo.push(snap()); restore(M.undo.pop()); changed(M.sel); }
  function redo() { if (!M.redo.length) return say('다시 할 게 없어요'); commit(); M.undo.push(snap()); restore(M.redo.pop()); changed(M.sel); }
  function select(id, keepMulti) { if (!M) return; M.sel = id; if (!keepMulti) M.multi.clear(); paintSel(); tools(); const n = node(id); if (n) ensureVisible(n); }
  function selected() {
    const ids = new Set([...M.multi, M.sel].filter(Boolean)), out = [];
    for (const id of ids) { const n = node(id); if (!n) continue; let p = parentOf(n), inside = false; while (p) { if (ids.has(p.id)) { inside = true; break; } p = parentOf(p); } if (!inside) out.push(n); }
    return out;
  }
  function addChild(n, edit = true) {
    n = n || node(M.sel) || centers()[0]; commit(); mut();
    const k = mk(''); n.collapsed = false; n.kids.push(k); M.sel = k.id; M.multi.clear();
    changed(k.id); if (edit && M.mode === 'map') startEdit(k, { isNew: true });
    return k;
  }
  function addSibling(n, before, edit = true) {
    n = n || node(M.sel); if (!n) return; const p = parentOf(n); if (!p) return addChild(n, edit);
    commit(); mut();
    const k = mk(''); p.kids.splice(p.kids.indexOf(n) + (before ? 0 : 1), 0, k); M.sel = k.id; M.multi.clear();
    changed(k.id); if (edit && M.mode === 'map') startEdit(k, { isNew: true });
    return k;
  }
  function removeNodes(ns) {
    ns = ns || selected();
    if (ns.filter(isC).length >= centers().length) { ns = ns.filter(n => !isC(n)); if (!ns.length) return say('마지막 중심 주제는 지울 수 없어요'); }
    if (!ns.length) return;
    commit(); mut();
    const first = ns[0], p0 = parentOf(first), s0 = sibsOf(first), i0 = s0.indexOf(first);
    for (const n of ns) { const a = sibsOf(n); a.splice(a.indexOf(n), 1); }
    const nx = s0[i0] || s0[i0 - 1] || p0 || centers()[0];
    M.sel = nx.id; M.multi.clear(); changed(nx.id);
    const all = ns.reduce((s, n) => s + 1 + count(n), 0);
    if (all > 1) say(`${all}개 지웠어요 · ⌘Z로 되살려요`, 2500);
  }
  function toggleFold(n) {
    n = n || node(M.sel); if (!n || !n.kids.length || isC(n)) return;
    commit(); mut(); n.collapsed = !n.collapsed; changed(n.id);
  }
  function flag(k) {
    const ns = selected(); if (!ns.length) return; commit(); mut();
    const on = !ns[0][k]; for (const n of ns) { if (on) n[k] = true; else delete n[k]; } changed(M.sel);
  }
  function toggleTodo() {
    const ns = selected(); if (!ns.length) return; commit(); mut();
    const on = ns[0].todo == null; for (const n of ns) { if (on) n.todo = 0; else delete n.todo; } changed(M.sel);
  }
  function toggleDone(n) {
    n = n || node(M.sel); if (!n) return; commit(); mut();
    n.todo = n.todo === 1 ? 0 : 1; changed(n.id);
  }
  function moveSib(d) {
    const n = node(M.sel), p = parentOf(n); if (!p) return; const i = p.kids.indexOf(n), j = i + d; if (j < 0 || j >= p.kids.length) return;
    commit(); mut(); p.kids.splice(i, 1); p.kids.splice(j, 0, n); changed(n.id);
  }
  function indent(n) {
    n = n || node(M.sel);
    if (isC(n)) {   // 중심 주제를 들여쓰면 앞 중심 주제의 가지가 됨
      const cs = centers(), i = cs.indexOf(n); if (i <= 0) return;
      commit(); mut(); cs.splice(i, 1); delete n.x; delete n.y; cs[i - 1].kids.push(n); changed(n.id); return;
    }
    const p = parentOf(n); if (!p) return; const i = p.kids.indexOf(n); if (i <= 0) return;
    commit(); mut(); const prev = p.kids[i - 1]; p.kids.splice(i, 1); prev.kids.push(n); prev.collapsed = false; changed(n.id);
  }
  function outdent(n) {
    n = n || node(M.sel); const p = parentOf(n), g = parentOf(p); if (!p) return;
    if (!g) {   // 1단 가지를 맨 위로 = 새 중심 주제
      commit(); mut(); p.kids.splice(p.kids.indexOf(n), 1); n.collapsed = false;
      const cs = centers(); cs.splice(cs.indexOf(p) + 1, 0, n); changed(n.id); say('새 중심 주제가 됐어요 · ⌘Z로 되돌려요', 2000); return;
    }
    commit(); mut(); p.kids.splice(p.kids.indexOf(n), 1); g.kids.splice(g.kids.indexOf(p) + 1, 0, n); changed(n.id);
  }
  function insertForest(f, target, asSibling) {
    if (!f.length) return;
    f.forEach(refresh); commit(); mut();
    target = target || node(M.sel) || centers()[0];
    if (isC(target) && !target.kids.length && oneLine(target.text) === DEF && f.length === 1) {
      const cs = centers(); if (target.x != null) { f[0].x = target.x; f[0].y = target.y; } cs[cs.indexOf(target)] = f[0]; M.sel = f[0].id;
    }
    else if (asSibling && parentOf(target)) { const p = parentOf(target); p.kids.splice(p.kids.indexOf(target) + 1, 0, ...f); M.sel = f[f.length - 1].id; }
    else { target.collapsed = false; target.kids.push(...f); M.sel = f[0].id; }
    M.multi.clear(); changed(M.sel);
    const n = f.reduce((s, x) => s + 1 + count(x), 0);
    say(`가지 ${n}개로 붙였어요`, 2000);
  }
  /* 새 중심 주제 — at = [x,y] 그림 좌표(없으면 지금 그림 오른쪽 빈 곳) */
  function addCenter(at, edit = true) {
    if (!M) return; commit(); closePop();
    const c = mk('');
    if (at) { c.x = Math.round(at[0]); c.y = Math.round(at[1]); }
    else if (M.mode === 'map' && M.ix && M.ix.vis.length) {
      const b = bbox(M.ix.vis), v = M.view, cy = (M.canvas.clientHeight / 2 - v.y) / v.k;
      c.x = Math.round(b.x + b.w + 110); c.y = Math.round(Math.max(b.y + 30, Math.min(b.y + b.h - 30, cy)));
    }
    mut(); centers().push(c); M.sel = c.id; M.multi.clear();
    changed(c.id); if (edit && M.mode === 'map') startEdit(c, { isNew: true });
    return c;
  }
  function setLayout(L) { if (!LAYOUTS[L] || L === M.st.layout) return; commit(); mut(); M.st.layout = L; changed(M.sel); fit(); }

  /* ---------- 글 고치기 ---------- */
  function startEdit(n, o = {}) {
    if (!M || !n) return;
    if (M.mode === 'outline') { focusRow(n.id, true); return; }
    if (M.editing && M.editing.id !== n.id) commit();
    const r = M.els.get(n.id); if (!r) return;
    const mt = r.el.querySelector('.mt');
    M.editing = { id: n.id, before: n.text, isNew: !!o.isNew };
    M.sel = n.id; paintSel();
    r.el.classList.add('edit'); mt.contentEditable = 'true'; mt.spellcheck = false;
    if (o.replace) mt.innerHTML = '';
    mt.focus({ preventScroll: true });
    const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(mt);
    if (o.replace || o.caretEnd) rg.collapse(false);
    s.removeAllRanges(); s.addRange(rg);
    r.w = null; render(); ensureVisible(n); placeFab();
  }
  function commit(cancel) {
    if (!M || !M.editing) return;
    const e = M.editing; M.editing = null;
    const n = node(e.id), r = M.els.get(e.id), mt = r && r.el.querySelector('.mt');
    let txt = e.kb ? clean(escT(M.kb.value).replace(/\n/g, '<br>')) : mt ? clean(mt.innerHTML) : e.before;
    if (!cancel && n && isC(n) && !oneLine(txt)) txt = DEF;   // 빈 중심 주제는 이름 「중심 주제」
    if (e.kb) { M.kb.value = ''; M.kb.classList.remove('on'); M.kb.removeAttribute('style'); }
    if (mt) mt.contentEditable = 'false';
    if (r) { r.el.classList.remove('edit', 'kbedit'); r.sig = ''; }
    if (cancel) {
      if (e.isNew && M.undo.length) restore(M.undo.pop());
      render(); focusMap(); changedNow(); return;
    }
    if (n && txt !== e.before) { if (!e.isNew) mut(); n.text = txt; }
    render(); changedNow();
    if (e.kb || document.activeElement === mt || !M.host.contains(document.activeElement)) focusMap();
  }
  function wrapMark() {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
    const rg = s.getRangeAt(0), m = document.createElement('mark');
    try { m.appendChild(rg.extractContents()); rg.insertNode(m); } catch (e) {}
    const box = m.closest('.mt,.otxt'); if (box) box.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function htmlLive() {   // 고치는 중인 글자까지 넣어서(아직 Enter 전이어도 잃지 않게)
    if (!M) return '';
    const e = M.editing;
    if (e) { const n = node(e.id), r = M.els.get(e.id), mt = r && r.el.querySelector('.mt'); if (n && mt) { const keep = n.text; n.text = e.kb ? clean(escT(M.kb.value).replace(/\n/g, '<br>')) : clean(mt.innerHTML); const h = serialize(M.st); n.text = keep; return h; } }
    return serialize(M.st);
  }

  /* ---------- 방향키 ---------- */
  function anchorX(n) { return n._d === 0 || M.st.layout === 'down' ? n._x + n._w / 2 : n._dir > 0 ? n._x : n._x + n._w; }
  function spatial(n, key) {
    const cx = anchorX(n), cy = n._y + n._h / 2; let best = null, bs = Infinity;
    for (const m of M.ix.vis) {
      if (m === n) continue;
      const mx = anchorX(m), my = m._y + m._h / 2, dx = mx - cx, dy = my - cy;
      let main, side;
      if (key === 'ArrowUp') { if (dy >= -2) continue; main = -dy; side = Math.abs(dx); }
      else if (key === 'ArrowDown') { if (dy <= 2) continue; main = dy; side = Math.abs(dx); }
      else if (key === 'ArrowLeft') { if (dx >= -2) continue; main = -dx; side = Math.abs(dy); }
      else { if (dx <= 2) continue; main = dx; side = Math.abs(dy); }
      const sc = main + side * 2.5; if (sc < bs) { bs = sc; best = m; }
    }
    return best;
  }
  function nearestKid(n, dir) {
    const ks = vk(n).filter(k => dir == null || k._dir === dir); if (!ks.length) return null;
    const c = n._y + n._h / 2, cx = n._x + n._w / 2;
    return ks.reduce((a, b) => (M.st.layout === 'down' ? Math.abs(b._x + b._w / 2 - cx) < Math.abs(a._x + a._w / 2 - cx) : Math.abs(b._y + b._h / 2 - c) < Math.abs(a._y + a._h / 2 - c)) ? b : a);
  }
  function nav(key) {
    let n = node(M.sel); if (!n) { select(centers()[0].id); return; }
    const L = M.st.layout, p = parentOf(n); let t = null;
    if (L === 'down') {
      if (key === 'ArrowDown') t = nearestKid(n); else if (key === 'ArrowUp') t = p;
      else { const sib = p ? p.kids : []; const i = sib.indexOf(n); t = key === 'ArrowLeft' ? sib[i - 1] : sib[i + 1]; }
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const d = key === 'ArrowRight' ? 1 : -1;
      if (n._d === 0) t = nearestKid(n, d);
      else if (n._dir === d) { if (n.collapsed && n.kids.length) { toggleFold(n); return; } t = nearestKid(n); }
      else t = p;
    }
    t = t || spatial(n, key);
    if (t) select(t.id);
  }
  function navCenter(key) {   // ⌘방향키: 중심 주제 사이 이동 (가지에 있으면 먼저 제 중심 주제로)
    const n = node(M.sel) || centers()[0], c = cOf(n);
    if (c !== n || centers().length < 2) return select(c.id);
    const cx = c._x + c._w / 2, cy = c._y + c._h / 2; let best = null, bs = Infinity;
    for (const m of centers()) {
      if (m === c || m._x == null) continue;
      const dx = m._x + m._w / 2 - cx, dy = m._y + m._h / 2 - cy; let main, side;
      if (key === 'ArrowUp') { if (dy >= -2) continue; main = -dy; side = Math.abs(dx); }
      else if (key === 'ArrowDown') { if (dy <= 2) continue; main = dy; side = Math.abs(dx); }
      else if (key === 'ArrowLeft') { if (dx >= -2) continue; main = -dx; side = Math.abs(dy); }
      else { if (dx <= 2) continue; main = dx; side = Math.abs(dy); }
      const sc = main + side * 1.5; if (sc < bs) { bs = sc; best = m; }
    }
    if (!best) { const cs = centers(), i = cs.indexOf(c), d = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1; best = cs[(i + d + cs.length) % cs.length]; }
    select(best.id);
  }

  /* ---------- 끌어 옮기기 ---------- */
  function banned(n) { const s = new Set(); const w = x => { s.add(x.id); x.kids.forEach(w); }; w(n); return s; }
  function startDrag(e) {
    const n = node(M.press.id); if (!n) { M.press.mode = 'none'; return; }
    if (isC(n)) {   // 중심 주제를 끌면 묶음 전체가 자리를 옮김
      M.press.mode = 'gdrag'; M.gd = { c: n, pre: snap(), x0: n._ox || 0, y0: n._oy || 0, px: M.press.sx, py: M.press.sy };
      M.fab.hidden = true; M.canvas.classList.add('panning'); return;
    }
    const r = M.els.get(n.id), g = r.el.cloneNode(true);
    g.classList.remove('sel', 'multi'); g.classList.add('mm-ghost'); g.style.setProperty('--c', n._c); g.style.transform = '';
    M.canvas.appendChild(g);
    M.press.mode = 'drag'; M.drag = { n, g, ban: banned(n), t: null, pos: '' };
    M.fab.hidden = true; dragMove(e);
  }
  function dragMove(e) {
    const d = M.drag, rc = M.canvas.getBoundingClientRect(), px = e.clientX - rc.left, py = e.clientY - rc.top, v = M.view;
    d.g.style.transform = `translate(${f1(px + 12)}px,${f1(py + 10)}px) scale(${Math.min(1, v.k)})`;
    const sx = (px - v.x) / v.k, sy = (py - v.y) / v.k, L = M.st.layout, pad = 8 / v.k;
    let t = null;
    for (const m of M.ix.vis) { if (d.ban.has(m.id)) continue; if (sx >= m._x - pad && sx <= m._x + m._w + pad && sy >= m._y - pad && sy <= m._y + m._h + pad) { t = m; break; } }
    let pos = '';
    if (t) {
      const rel = L === 'down' ? (sx - t._x) / t._w : (sy - t._y) / t._h;
      pos = isC(t) ? 'child' : rel < 0.28 ? 'before' : rel > 0.72 ? 'after' : 'child';
    }
    const n = d.n; d.sx = sx; d.sy = sy;
    d.free = !t && !(sx >= n._x - 24 && sx <= n._x + n._w + 24 && sy >= n._y - 24 && sy <= n._y + n._h + 24);   // 빈 곳(제자리 말고) = 새 중심 주제로 떼어 내기
    d.g.classList.toggle('free', d.free);
    if (t === d.t && pos === d.pos) return;
    d.t = t; d.pos = pos; showDrop();
  }
  function showDrop() {
    const d = M.drag; for (const r of M.els.values()) r.el.classList.remove('drop-in');
    M.ph.hidden = M.bar.hidden = true; if (!d || !d.t) return;
    const t = d.t, L = M.st.layout;
    if (d.pos === 'child') {
      M.els.get(t.id).el.classList.add('drop-in');
      const ks = vk(t).filter(k => !d.ban.has(k.id)), last = ks[ks.length - 1];
      let x, y;
      if (L === 'down') { x = last ? last._x + last._w + dh(t) : t._x + t._w / 2 - 40; y = last ? last._y : t._y + t._h + dv(t); }
      else {
        const dir = t._d === 0 ? 1 : t._dir;
        const kk = t._d === 0 ? ks.filter(k => k._dir > 0) : ks, lk = kk[kk.length - 1];
        x = dir > 0 ? t._x + t._w + gh(t) : t._x - gh(t) - 80;
        y = lk ? lk._y + lk._h + gv(t) : t._y + t._h / 2 - 13;
      }
      M.ph.style.transform = `translate(${f1(x)}px,${f1(y)}px)`; M.ph.hidden = false;
    } else {
      if (L === 'down') { const x = d.pos === 'before' ? t._x - dh(parentOf(t)) / 2 - 2 : t._x + t._w + dh(parentOf(t)) / 2 - 2; Object.assign(M.bar.style, { transform: `translate(${f1(x)}px,${f1(t._y)}px)`, width: '4px', height: f1(t._h) + 'px' }); }
      else { const y = d.pos === 'before' ? t._y - 5 : t._y + t._h + 1; Object.assign(M.bar.style, { transform: `translate(${f1(t._x)}px,${f1(y)}px)`, width: f1(t._w) + 'px', height: '4px' }); }
      M.bar.hidden = false;
    }
  }
  function endDrag(drop) {
    const d = M.drag; M.drag = null; if (!d) return;
    d.g.remove(); for (const r of M.els.values()) r.el.classList.remove('drop-in'); M.ph.hidden = M.bar.hidden = true;
    if (!drop || (!d.t && !d.free)) { paintSel(); return; }
    const n = d.n, t = d.t;
    if (!t) {   // 빈 곳에 놓음 → 새 중심 주제
      mut(); const op = parentOf(n); op.kids.splice(op.kids.indexOf(n), 1);
      n.collapsed = false; n.x = Math.round(d.sx); n.y = Math.round(d.sy); centers().push(n);
      M.sel = n.id; changed(n.id); say('새 중심 주제로 떼어 냈어요 · ⌘Z로 되돌려요', 2500); return;
    }
    mut();
    const op = parentOf(n); op.kids.splice(op.kids.indexOf(n), 1);
    if (d.pos === 'child') { t.collapsed = false; t.kids.push(n); }
    else { const p = parentOf(t); p.kids.splice(p.kids.indexOf(t) + (d.pos === 'after' ? 1 : 0), 0, n); }
    M.sel = n.id; changed(n.id);
  }

  function endGDrag(ok) {
    const g = M.gd; M.gd = null; if (!g) return; M.canvas.classList.remove('panning');
    if (!ok) { restore(g.pre); changed(M.sel); return; }
    render();   // 끈 묶음 기준으로 다른 묶음을 밀어낸 자리를 그대로 저장
    for (const c of centers()) { c.x = Math.round(c._ox); c.y = Math.round(c._oy); }
    M.undo.push(g.pre); if (M.undo.length > 300) M.undo.shift(); M.redo = [];
    M.sel = g.c.id; changed(g.c.id);
  }

  /* ---------- 메모·색 고르기 ---------- */
  function popAt(n, html) {
    const v = M.view, cw = M.root.clientWidth, top = M.tools.offsetHeight;
    M.pop.innerHTML = html; M.pop.hidden = false;
    let x, y;
    if (M.mode === 'map' && n && n._x != null) { x = v.x + n._x * v.k; y = top + v.y + (n._y + n._h) * v.k + 10; }
    else { const row = M.outline.querySelector(`.orow[data-id="${n && n.id}"]`); const rr = row ? row.getBoundingClientRect() : null, hr = M.root.getBoundingClientRect(); x = rr ? rr.left - hr.left + 30 : 20; y = rr ? rr.bottom - hr.top + 6 : top + 20; }
    const pw = M.pop.offsetWidth, ph = M.pop.offsetHeight, H = M.root.clientHeight;
    if (y + ph > H - 8) y = Math.max(top + 8, y - ph - (n && n._h ? n._h * v.k : 30) - 20);
    M.pop.style.left = Math.max(8, Math.min(cw - pw - 8, x)) + 'px'; M.pop.style.top = y + 'px';
  }
  function closePop() { if (M) { M.pop.hidden = true; M.pop.innerHTML = ''; } }
  function openNote(n) {
    n = n || node(M.sel); if (!n) return; commit();
    popAt(n, `<b>메모 — ${escT(oneLine(n.text).slice(0, 24) || '주제')}</b><textarea placeholder="짧은 메모 (PDF 개요에 작게 나와요)">${escT(n.note || '')}</textarea><div class="row">${n.note ? '<button type="button" data-p="ndel">메모 지우기</button>' : ''}<button type="button" data-p="x">닫기</button><button type="button" class="pri" data-p="nsave">저장</button></div>`);
    M.pop.dataset.id = n.id; const ta = M.pop.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  function openColor() {
    const n = node(M.sel); if (!n || isC(n)) return say('가지를 먼저 고르세요');
    commit();
    popAt(n, `<b>가지 색</b><div class="mm-sw">${PAL.map(c => `<button type="button" data-p="col" data-c="${c}" style="background:${c}" aria-label="색 ${c}"></button>`).join('')}<button type="button" class="auto" data-p="col" data-c="">자동</button></div>`);
  }
  function popClick(e) {
    const b = e.target.closest('[data-p]'); if (!b) return; const a = b.dataset.p;
    if (a === 'x') { closePop(); return focusMap(); }
    if (a === 'nsave' || a === 'ndel') {
      const n = node(M.pop.dataset.id); if (!n) return closePop();
      const v = a === 'ndel' ? '' : M.pop.querySelector('textarea').value.trim();
      if ((n.note || '') !== v) { mut(); if (v) n.note = v; else delete n.note; changed(n.id); }
      closePop(); if (M.mode === 'map') focusMap(); else focusRow(n.id, true); return;
    }
    if (a === 'col') {
      const ns = selected().filter(n => !isC(n)); if (!ns.length) return closePop();
      mut(); for (const n of ns) { if (b.dataset.c) n.color = b.dataset.c; else delete n.color; } changed(M.sel); closePop();
      if (M.mode === 'map') focusMap();
    }
  }

  /* ---------- 개요 보기 ---------- */
  function rowHtml(n, d) {
    const has = n.kids.length;
    return `<div class="orow d${Math.min(d, 3)}${n.todo === 1 ? ' done' : ''}" data-id="${n.id}" style="--d:${d};--c:${n._c}">`
      + `<button type="button" class="otog ${has ? (n.collapsed ? 'shut' : 'open') : 'leaf'}" tabindex="-1" aria-label="${has ? (n.collapsed ? '펴기' : '접기') : '주제'}">${has ? '<svg viewBox="0 0 10 10"><path d="M3 1.2l4.6 3.8L3 8.8z"/></svg>' : '<i></i>'}</button>`
      + `${n.todo === 0 || n.todo === 1 ? '<span class="mchk"></span>' : ''}${n._num ? `<span class="mnum">${n._num}</span>` : ''}`
      + `<div class="otxt${n.b ? ' b' : ''}${n.hl ? ' hl' : ''}" contenteditable="true" spellcheck="false">${n.text}</div>`
      + `${n.collapsed && has ? `<span class="ocnt">+${count(n)}</span>` : ''}</div>${n.note ? `<div class="onote" style="--d:${d}">${escT(n.note)}</div>` : ''}`;
  }
  function renderOutline(focusId) {
    const rows = [];
    const walk = (n, d) => { rows.push(rowHtml(n, d)); if (!n.collapsed) n.kids.forEach(k => walk(k, d + 1)); };
    centers().forEach(c => walk(c, 0));
    const hint = coarse() ? '줄을 눌러 고치고, 위 도구로 추가·들여·내어·지우기.' : 'Enter 새 줄 · Tab 들여쓰기 · ⇧Tab 내어쓰기(맨 위로 올리면 새 중심 주제) · ⌘⇧Enter 새 중심 주제 · 빈 줄에서 ⌫ 지우기 · ⌥⇧↑↓ 순서 · ⌘Z 되돌리기 · 마인드맵과 같은 내용이에요.';
    const y = M.outline.scrollTop, had = M.outline.contains(document.activeElement);
    M.outline.innerHTML = `<p class="ol-hint">${hint}</p>` + rows.join('');
    M.outline.scrollTop = y;
    const fid = focusId || (had ? M.sel : null);
    if (fid) focusRow(fid, true);
  }
  function rowOf(id) { return M.outline.querySelector(`.orow[data-id="${id}"] .otxt`); }
  function focusRow(id, end) {
    let el = rowOf(id);
    if (!el) { let n = node(id), p = parentOf(n); while (p && !el) { if (p.collapsed) { p.collapsed = false; } p = parentOf(p); } M.ix = index(M.st.root); renderOutline(); el = rowOf(id); }
    if (!el) return; M.sel = id;
    el.focus({ preventScroll: true });
    const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(!end ? true : false); s.removeAllRanges(); s.addRange(rg);
    const r = el.getBoundingClientRect(), b = M.outline.getBoundingClientRect();
    if (r.top < b.top + 10 || r.bottom > b.bottom - 60) el.scrollIntoView({ block: 'center' });
    tools();
  }
  function caretAt(el, where) {
    const s = getSelection(); if (!s.rangeCount) return false; const rg = s.getRangeAt(0); if (!rg.collapsed) return false;
    const t = document.createRange(); t.selectNodeContents(el);
    if (where === 'start') t.setEnd(rg.startContainer, rg.startOffset); else t.setStart(rg.endContainer, rg.endOffset);
    return !t.toString().length && !(where === 'end' && t.cloneContents().querySelector && t.cloneContents().querySelector('br'));
  }
  function olKey(e) {
    const el = e.target.closest('.otxt'); if (!el) return;
    const id = el.closest('.orow').dataset.id, n = node(id); if (!n) return;
    const meta = e.metaKey || e.ctrlKey, k = e.key;
    if (e.isComposing || e.keyCode === 229) return;
    if (meta && !e.shiftKey && k.toLowerCase() === 'z') { e.preventDefault(); flushRow(); undo(); return; }
    if (meta && ((e.shiftKey && k.toLowerCase() === 'z') || k.toLowerCase() === 'y')) { e.preventDefault(); flushRow(); redo(); return; }
    if (meta && k.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold'); return; }
    if (meta && e.shiftKey && k.toLowerCase() === 'h') { e.preventDefault(); wrapMark(); return; }
    if (meta && e.shiftKey && k === 'Enter') { e.preventDefault(); flushRow(); addCenter(null, false); return; }
    if (meta && k === 'Enter') { e.preventDefault(); flushRow(); if (n.todo == null) { mut(); n.todo = 0; changed(id); } else toggleDone(n); return; }
    if ((e.altKey && e.shiftKey || meta && e.shiftKey) && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); flushRow(); M.sel = id; moveSib(k === 'ArrowUp' ? -1 : 1); return; }
    if (k === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); return; }
    if (k === 'Enter') {
      e.preventDefault(); flushRow();
      if (isC(n) || (n.kids.length && !n.collapsed)) { mut(); const c = mk(''); n.collapsed = false; n.kids.unshift(c); M.sel = c.id; changed(c.id); }
      else { M.sel = id; addSibling(n, false, false); }
      return;
    }
    if (k === 'Tab') { e.preventDefault(); flushRow(); M.sel = id; e.shiftKey ? outdent(n) : indent(n); return; }
    if (k === 'Backspace' && !oneLine(el.innerHTML) && !el.querySelector('br') && !isC(n) && !n.kids.length) {
      e.preventDefault(); flushRow();
      const rows = [...M.outline.querySelectorAll('.orow')], i = rows.findIndex(r => r.dataset.id === id), prev = rows[i - 1];
      M.sel = id; removeNodes([n]); if (prev) focusRow(prev.dataset.id, true); return;
    }
    if ((k === 'ArrowUp' || k === 'ArrowDown') && !e.shiftKey && !meta && !e.altKey) {
      const multi = !!el.querySelector('br');
      if (multi && !caretAt(el, k === 'ArrowUp' ? 'start' : 'end')) return;
      const rows = [...M.outline.querySelectorAll('.orow')], i = rows.findIndex(r => r.dataset.id === id), t = rows[i + (k === 'ArrowUp' ? -1 : 1)];
      if (t) { e.preventDefault(); flushRow(); focusRow(t.dataset.id, true); }
    }
  }
  function flushRow() { M.otyping = false; }
  function olInput(e) {
    const el = e.target.closest('.otxt'); if (!el) return;
    const n = node(el.closest('.orow').dataset.id); if (!n) return;
    if (!M.otyping) { mut(); M.otyping = true; }
    n.text = clean(el.innerHTML); tools(); changedNow();
  }
  function olClick(e) {
    const row = e.target.closest('.orow'); if (!row) return; const n = node(row.dataset.id); if (!n) return;
    if (e.target.closest('.otog') && n.kids.length) { e.preventDefault(); M.sel = n.id; mut(); n.collapsed = !n.collapsed; changed(n.id); return; }
    if (e.target.closest('.mchk')) { e.preventDefault(); toggleDone(n); return; }
  }
  function olPaste(e) {
    const el = e.target.closest('.otxt'); if (!el) return;
    const n = node(el.closest('.orow').dataset.id), html = e.clipboardData.getData('text/html'), txt = e.clipboardData.getData('text/plain');
    const blocky = /<(h[1-6]|ul|ol|li|p|div)\b/i.test(html) && (txt.trim().includes('\n') || /class="mindmap"/.test(html));
    if (!blocky && !txt.trim().includes('\n')) { e.preventDefault(); document.execCommand('insertText', false, txt.replace(/\s+/g, ' ')); return; }
    e.preventDefault(); flushRow();
    let f = blocky ? forestFromHtml(html) : []; if (!f.length) f = forestFromText(txt);
    M.sel = n.id; insertForest(f, n, !isC(n));
  }
  function setMode(m, first) {
    if (!M) return; commit(); closePop();
    M.mode = m === 'outline' ? 'outline' : 'map';
    M.root.classList.toggle('ol', M.mode === 'outline');
    M.canvas.hidden = M.mode === 'outline'; M.outline.hidden = M.mode !== 'outline';
    if (M.mode === 'map') { for (const r of M.els.values()) r.w = null; render(); if (!first) { ensureVisible(node(M.sel)); focusMap(); } }
    else { M.ix = index(M.st.root); renderOutline(first ? null : M.sel); tools(); }
    if (M.o.onMode) M.o.onMode(M.mode);
  }

  /* ---------- 붙여넣기·복사 ---------- */
  const mapFocused = () => M && M.mode === 'map' && !M.editing && (document.activeElement === M.canvas || document.activeElement === M.kb || (M.canvas.contains(document.activeElement) && !document.activeElement.isContentEditable));
  function onCopy(e, cut) {
    if (!mapFocused()) return; const ns = selected(); if (!ns.length) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', ns.map(n => toText(n, 0)).join(''));
    e.clipboardData.setData('text/html', `<div class="mindmap" data-layout="${M.st.layout}"><ul>\n${ns.map(n => serNode(n, 0)).join('')}</ul></div>`);
    if (cut === true) removeNodes(ns); else say(`가지 ${ns.reduce((s, n) => s + 1 + count(n), 0)}개 복사했어요`, 1500);
  }
  function onCut(e) { onCopy(e, true); }
  function onPaste(e) {
    if (!M) return;
    const t = e.target, mt = t && t.closest && t.closest('.mn .mt');
    if (mt && M.editing) {   // 고치는 중: 한 줄은 글자로, 여러 줄은 이 주제의 자식으로
      const txt = e.clipboardData.getData('text/plain');
      e.preventDefault();
      if (!txt.trim().includes('\n')) { document.execCommand('insertText', false, txt.replace(/\s+/g, ' ')); return; }
      const n = node(M.editing.id); commit(); insertForest(forestFromText(txt), n); return;
    }
    if (!mapFocused()) return;
    e.preventDefault();
    const html = e.clipboardData.getData('text/html'), txt = e.clipboardData.getData('text/plain');
    let f = html ? forestFromHtml(html) : [];
    if (!f.length || (!/class="mindmap"|<(h[1-6]|ul|ol|li)\b/i.test(html) && txt.includes('\n'))) f = forestFromText(txt);
    if (!f.length) return say('붙일 글이 없어요');
    insertForest(f);
  }

  /* ---------- 사건 잇기 ---------- */
  function act(a) {
    if (!M) return; const n = node(M.sel);
    switch (a) {
      case 'mode-map': return setMode('map');
      case 'mode-ol': return setMode('outline');
      case 'child': return addChild(n || centers()[0], M.mode === 'map');
      case 'sib': return addSibling(n || centers()[0], false, M.mode === 'map');
      case 'center': return addCenter(null, M.mode === 'map');
      case 'del': return removeNodes();
      case 'fold': return toggleFold(n);
      case 'indent': return indent(n);
      case 'outdent': return outdent(n);
      case 'color': return openColor();
      case 'bold': return flag('b');
      case 'hl': return flag('hl');
      case 'todo': return toggleTodo();
      case 'num': return flag('num');
      case 'note': return openNote(n);
      case 'undo': return undo();
      case 'redo': return redo();
      case 'fit': return fit();
      case 'edit': return n && startEdit(n);
      case 'zin': return zoomAt(M.view.k * 1.2, M.canvas.clientWidth / 2, M.canvas.clientHeight / 2);
      case 'zout': return zoomAt(M.view.k / 1.2, M.canvas.clientWidth / 2, M.canvas.clientHeight / 2);
    }
  }
  function canvasKey(e) {
    if (!M || M.mode !== 'map') return;
    const meta = e.metaKey || e.ctrlKey, k = e.key, lk = k.toLowerCase();
    if (M.editing) {
      if (e.isComposing || e.keyCode === 229) return;
      if (meta && e.shiftKey && k === 'Enter') { e.preventDefault(); commit(); addCenter(); return; }
      if (M.editing.kb && k === 'Enter' && e.shiftKey) return;   // 글자 받이: 줄바꿈은 그대로
      if (k === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); return; }
      if (k === 'Enter') { e.preventDefault(); commit(); return; }
      if (k === 'Tab') { e.preventDefault(); const n = node(M.editing.id); commit(); if (!e.shiftKey) (M.st.layout === 'down' ? addSibling(n, false) : addChild(n)); return; }   // 11/20 조직도: Tab=옆(형제)
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); commit(true); return; }
      if (M.editing.kb) return;
      if (meta && lk === 'b') { e.preventDefault(); document.execCommand('bold'); return; }
      if (meta && e.shiftKey && lk === 'h') { e.preventDefault(); wrapMark(); return; }
      return;
    }
    if (!M.pop.hidden && M.pop.contains(e.target)) { if (k === 'Escape') { closePop(); focusMap(); } else if (k === 'Enter' && meta) M.pop.querySelector('[data-p="nsave"]') && M.pop.querySelector('[data-p="nsave"]').click(); return; }
    if (e.target !== M.canvas && e.target !== M.kb) return;
    if (meta) {
      if (lk === 'z' && !e.shiftKey) { e.preventDefault(); return undo(); }
      if ((lk === 'z' && e.shiftKey) || lk === 'y') { e.preventDefault(); return redo(); }
      if (lk === 'b') { e.preventDefault(); return flag('b'); }
      if (lk === 'h' && e.shiftKey) { e.preventDefault(); return flag('hl'); }
      if (k === '/') { e.preventDefault(); return toggleFold(); }
      if (k === '=' || k === '+') { e.preventDefault(); return act('zin'); }
      if (k === '-' || k === '_') { e.preventDefault(); return act('zout'); }
      if (k === '0') { e.preventDefault(); return fit(); }
      if (k === 'Enter' && e.shiftKey) { e.preventDefault(); return addCenter(); }
      if (k.startsWith('Arrow')) { e.preventDefault(); return navCenter(k); }
      if (k === 'Enter') { e.preventDefault(); const n = node(M.sel); if (n && n.todo == null) { mut(); n.todo = 0; changed(n.id); } else toggleDone(); return; }
      if (lk === 'a') { e.preventDefault(); M.multi = new Set(M.ix.vis.map(x => x.id)); paintSel(); return; }
      return;   // ⌘C·⌘V·⌘X 는 copy/paste 사건으로
    }
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); return moveSib(k === 'ArrowUp' ? -1 : 1); }
    const n = node(M.sel);
    switch (k) {
      case 'Tab': e.preventDefault(); if (e.shiftKey) { const p = parentOf(n); if (p) select(p.id); return; } if (M.st.layout === 'down' && n && parentOf(n)) return addSibling(n, false); return addChild(n || centers()[0]);   // 11/20 사장님: 조직도에선 Tab=옆으로, Enter=아래로
      case 'Enter': e.preventDefault(); if (M.st.layout === 'down' && n && !e.shiftKey) return addChild(n); return n ? addSibling(n, e.shiftKey) : select(centers()[0].id);
      case 'Delete': case 'Backspace': e.preventDefault(); return removeNodes();
      case 'F2': e.preventDefault(); return n && startEdit(n, { caretEnd: true });
      case ' ': e.preventDefault(); if (!e.repeat) { M.space = { moved: false }; M.canvas.classList.add('space'); } return;
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': e.preventDefault(); return nav(k);
      case 'Escape': M.multi.clear(); paintSel(); closePop(); return;
    }
  }
  function canvasKeyUp(e) {
    if (!M || e.key !== ' ' || !M.space) return;
    const moved = M.space.moved; M.space = null; M.canvas.classList.remove('space', 'panning');
    if (!moved && !M.editing && (e.target === M.canvas || e.target === M.kb)) { const n = node(M.sel); if (n) startEdit(n, { caretEnd: true }); }
  }
  function pt(e) { const r = M.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function down(e) {
    if (!M || M.mode !== 'map') return;
    if (e.target.closest('.mm-fab,.mm-zoom,.mm-addc') || (e.target === M.kb && M.editing)) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    M.ptrs.set(e.pointerId, pt(e));
    if (M.ptrs.size === 2) {   // 두 손가락: 확대·이동
      const [a, b] = [...M.ptrs.values()]; clearTimeout(M.press && M.press.timer); if (M.drag) endDrag(false); if (M.gd) endGDrag(false);
      M.press = null; M.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], v: { ...M.view } }; return;
    }
    if (M.ptrs.size > 2) return;
    if (!M.pop.hidden && !M.pop.contains(e.target)) closePop();
    const [x, y] = pt(e);
    const nodeEl = e.target.closest('.mn'), fold = e.target.closest('.mf');
    if (M.editing && nodeEl && nodeEl.dataset.id === M.editing.id) return;   // 고치는 글자 안 클릭은 그대로
    if (M.editing) commit();
    if (M.space || e.button === 1) { if (M.space) M.space.moved = true; M.press = { mode: 'pan', x, y, vx: M.view.x, vy: M.view.y, moved: true }; M.canvas.classList.add('panning'); e.preventDefault(); return; }
    focusMap();
    if (fold) { e.preventDefault(); toggleFold(node(fold.dataset.fold)); return; }
    if (nodeEl) {
      const id = nodeEl.dataset.id, n = node(id); e.preventDefault();
      if (e.target.closest('.mchk')) { select(id); toggleDone(n); return; }
      if (e.target.closest('.mnote')) { select(id); openNote(n); return; }
      if (e.pointerType === 'mouse' && (e.metaKey || e.shiftKey || e.ctrlKey)) { if (M.multi.has(id)) M.multi.delete(id); else { if (M.sel) M.multi.add(M.sel); M.multi.add(id); } M.sel = id; paintSel(); tools(); return; }
      const now = Date.now();
      if (M.lastTap && M.lastTap.id === id && now - M.lastTap.t < 380) { M.lastTap = null; startEdit(n, { caretEnd: true }); return; }
      M.lastTap = { id, t: now };
      select(id);
      M.press = { mode: 'node', id, x, y, sx: x, sy: y, vx: M.view.x, vy: M.view.y, touch: e.pointerType !== 'mouse', moved: false };
      if (M.press.touch) M.press.timer = setTimeout(() => { if (M.press && M.press.mode === 'node' && !M.press.moved) { if (navigator.vibrate) navigator.vibrate(12); startDrag({ clientX: e.clientX, clientY: e.clientY }); } }, 420);
      try { M.canvas.setPointerCapture(e.pointerId); } catch (er) {}
      M.fab.hidden = true;
      return;
    }
    const now = Date.now(), lb = M.lastBg;   // 빈 곳 더블클릭·두 번 탭 = 그 자리에 새 중심 주제
    if (lb && now - lb.t < 400 && Math.hypot(x - lb.x, y - lb.y) < 24) { M.lastBg = null; e.preventDefault(); const v = M.view; addCenter([(x - v.x) / v.k, (y - v.y) / v.k]); return; }
    M.lastBg = { t: now, x, y };
    M.press = { mode: 'pan', x, y, vx: M.view.x, vy: M.view.y, moved: false, bg: true };
    try { M.canvas.setPointerCapture(e.pointerId); } catch (er) {}
  }
  function move(e) {
    if (!M || M.mode !== 'map') return;
    if (M.ptrs.has(e.pointerId)) M.ptrs.set(e.pointerId, pt(e));
    if (M.pinch && M.ptrs.size >= 2) {
      const [a, b] = [...M.ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], P = M.pinch;
      const k = Math.max(0.12, Math.min(3, P.v.k * d / P.d));
      M.view = { k, x: c[0] - (P.c[0] - P.v.x) * (k / P.v.k), y: c[1] - (P.c[1] - P.v.y) * (k / P.v.k) }; applyView(); return;
    }
    const P = M.press; if (!P) return;
    const [x, y] = pt(e), dx = x - P.x, dy = y - P.y;
    if (P.mode === 'pan') { if (!P.moved && Math.hypot(dx, dy) > 3) { P.moved = true; M.canvas.classList.add('panning'); } if (P.moved) { M.moved = true; M.view.x = P.vx + dx; M.view.y = P.vy + dy; applyView(); } return; }
    if (P.mode === 'node') {
      if (Math.hypot(dx, dy) > (P.touch ? 10 : 5)) {
        P.moved = true; clearTimeout(P.timer);
        if (P.touch) { P.mode = 'pan'; P.x = P.sx; P.y = P.sy; M.canvas.classList.add('panning'); M.view.x = P.vx + (x - P.sx); M.view.y = P.vy + (y - P.sy); applyView(); }
        else startDrag(e);
      }
      return;
    }
    if (P.mode === 'drag') dragMove(e);
    if (P.mode === 'gdrag' && M.gd) { const g = M.gd; g.c.x = g.x0 + (x - g.px) / M.view.k; g.c.y = g.y0 + (y - g.py) / M.view.k; render(); }
  }
  function up(e, cancel) {
    if (!M) return;
    M.ptrs.delete(e.pointerId);
    if (M.pinch) { if (M.ptrs.size < 2) M.pinch = null; if (M.ptrs.size === 0) placeFab(); return; }
    const P = M.press; M.press = null; if (!P) return;
    clearTimeout(P.timer); M.canvas.classList.remove('panning');
    if (P.mode === 'drag') endDrag(!cancel);
    else if (P.mode === 'gdrag') endGDrag(!cancel);
    else if (P.mode === 'pan' && P.bg && !P.moved && !cancel) { M.multi.clear(); paintSel(); }
    if (P.moved || cancel) M.lastBg = null;
    placeFab();
  }
  function wheel(e) {
    if (!M || M.mode !== 'map') return;
    e.preventDefault();
    const [x, y] = pt(e);
    if (e.ctrlKey || e.metaKey) zoomAt(M.view.k * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.01)), x, y);   // 트랙패드 핀치 = ctrl+휠
    else { M.moved = true; const s = e.deltaMode ? 30 : 1; M.view.x -= e.deltaX * s; M.view.y -= e.deltaY * s; applyView(); }
  }
  function bind() {
    const c = M.canvas;
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', e => up(e));
    c.addEventListener('pointercancel', e => up(e, true));
    c.addEventListener('wheel', wheel, { passive: false });
    c.addEventListener('keydown', canvasKey);
    c.addEventListener('keyup', canvasKeyUp);
    c.addEventListener('dblclick', e => e.preventDefault());
    c.addEventListener('input', e => { if (M && M.editing && e.target.closest('.mt')) { const r = M.els.get(M.editing.id); if (r) r.w = null; render(); changedNow(); } });
    c.addEventListener('focusout', e => { if (M && M.editing && e.target.closest && e.target.closest('.mt')) setTimeout(() => { if (M && M.editing && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('.mn.edit'))) commit(); }, 0); });
    M.kb.addEventListener('compositionstart', () => { if (M && !M.editing) kbStart(); });
    M.kb.addEventListener('input', () => { if (!M) return; if (!M.editing) { if (!M.kb.value) return; if (!kbStart()) { M.kb.value = ''; return; } } if (M.editing && M.editing.kb) { kbSync(); changedNow(); } });
    M.kb.addEventListener('blur', () => setTimeout(() => { if (M && M.editing && M.editing.kb && document.activeElement !== M.kb) commit(); }, 0));
    M.fab.addEventListener('pointerdown', e => e.preventDefault());
    M.fab.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); });
    M.canvas.querySelector('.mm-addc').addEventListener('click', () => act('center'));
    M.canvas.querySelector('.mm-zoom').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); });
    M.tools.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });   // 개요 줄 커서를 안 뺏게
    M.tools.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return; if (M.mode === 'outline') flushRow(); act(b.dataset.a); });
    M.lay.addEventListener('change', () => setLayout(M.lay.value));
    M.pop.addEventListener('click', popClick);
    M.pop.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); M.mode === 'map' ? focusMap() : focusRow(M.sel, true); } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { const s = M.pop.querySelector('[data-p="nsave"]'); if (s) s.click(); } });
    M.outline.addEventListener('keydown', olKey);
    M.outline.addEventListener('input', olInput);
    M.outline.addEventListener('mousedown', e => { if (e.target.closest('.otog,.mchk')) e.preventDefault(); });
    M.outline.addEventListener('click', olClick);
    M.outline.addEventListener('paste', olPaste);
    M.outline.addEventListener('focusin', e => { const r = e.target.closest('.orow'); if (r) { M.sel = r.dataset.id; M.otyping = false; tools(); } });
    M.outline.addEventListener('focusout', () => { M.otyping = false; });
    document.addEventListener('copy', onCopy); document.addEventListener('cut', onCut); document.addEventListener('paste', onPaste);
    if (window.ResizeObserver) { M.ro = new ResizeObserver(() => { if (M && !M.moved && !M.o.view) fit(); placeFab(); }); M.ro.observe(M.canvas); }   // 손대기 전엔 창 크기 바뀌면 다시 맞춤
  }

  /* =================================================================== PDF 인쇄 */
  function drawStatic(area, st, aw, ah, keepColor, o) {   // 11/21 o.natural = 폭에 맞춰 줄이기만(키우지 않음)·높이는 그림대로 / o.cap = 최대 배율 · 돌려주는 값 = 배율(o.els 있으면 [n, el] 차례로 담음)
    const ix = index(st.root, keepColor), L = st.layout;
    const stage = document.createElement('div'); stage.className = 'mm-stage' + (L === 'down' ? ' down' : '');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'mm-edges'); stage.appendChild(svg);
    area.appendChild(stage);
    const els = [];
    for (const n of ix.vis) { const el = document.createElement('div'); el.className = cls(n); el.innerHTML = inner(n); el.style.setProperty('--c', n._c); stage.appendChild(el); els.push(el); }
    ix.vis.forEach((n, i) => { n._w = els[i].offsetWidth; n._h = els[i].offsetHeight; });
    layout(st);
    ix.vis.forEach((n, i) => { els[i].style.transform = `translate(${f1(n._x)}px,${f1(n._y)}px)`; });
    let d = '';
    for (const n of ix.vis) { const p = ix.par.get(n.id); if (p) d += `<path d="${ePath(p, n, L)}" stroke="${n._c}" stroke-width="${eWidth(p)}"/>`; }
    svg.innerHTML = d;
    for (const n of ix.vis) if (n.collapsed && n.kids.length && n._d > 0) { const [x, y, k] = foldAt(n, L), b = document.createElement('div'); b.className = 'mf ' + k; b.textContent = count(n); b.style.setProperty('--c', n._c); b.style.left = f1(x) + 'px'; b.style.top = f1(y) + 'px'; stage.appendChild(b); }
    const bb = bbox(ix.vis);
    if (o && o.els) ix.vis.forEach((n, i) => o.els.push([n, els[i]]));
    if (o && o.natural) {
      const s = Math.min(o.cap || 1, aw / bb.w); area.style.height = f1(bb.h * s) + 'px';
      stage.style.transform = `translate(${f1((aw - bb.w * s) / 2 - bb.x * s)}px,${f1(-bb.y * s)}px) scale(${s})`;
      return s;
    }
    const s = Math.min(1.25, aw / bb.w, ah / bb.h);
    stage.style.transform = `translate(${f1((aw - bb.w * s) / 2 - bb.x * s)}px,${f1((ah - bb.h * s) / 2 - bb.y * s)}px) scale(${s})`;
    return s;
  }
  function olPrint(n, top) {
    const tx = `<span class="tx${n.b ? ' b' : ''}${n.hl ? ' hl' : ''}">${n.text || '&nbsp;'}</span>`;
    const box = n.todo === 0 || n.todo === 1 ? '<span class="bx"></span>' : '', num = n._num ? `<span class="num">${n._num}</span>` : '';
    const note = n.note ? `<span class="nt">${escT(n.note)}</span>` : '';
    const kids = n.kids.length ? `<ul>${n.kids.map(k => olPrint(k)).join('')}</ul>` : '';
    if (top) return `<h2 style="--c:${n._c}" class="${n.todo === 1 ? 'done' : ''}">${box}${num}${tx}</h2>${note}${kids}`;
    return `<li class="${n.todo != null ? 'todo' : ''}${n.todo === 1 ? ' done' : ''}" style="--c:${n._c}">${box}${num}${tx}${note}${kids}</li>`;
  }
  async function print(out, o) {
    document.documentElement.classList.add('mprint');
    try { await Promise.all([400, 500, 700, 800, 900].map(w => document.fonts.load(`${w} 16px NK`, '가나다abc'))); } catch (e) {}
    const st = parse(o.html), cs = st.root.kids, title = escT(o.title || oneLine(cs[0].text)), date = escT(o.date || '');
    const wrap = document.createElement('div'); wrap.className = 'mm'; out.appendChild(wrap);
    const AW = 1031.8, AH = 691.6;   // 273mm × 183mm
    const page = (label, sub) => {
      const p = document.createElement('section'); p.className = 'mp-map';
      p.innerHTML = `<div class="mp-head"><span class="mp-kick">MIND MAP · 마인드맵</span><span class="mp-title">${title}</span><span class="mp-sub">${sub}</span></div><div class="mp-stamp">CONFIDENTIAL</div><div class="mp-area"></div><span class="mk">@@P:${escT(label)}@@</span>`;
      wrap.appendChild(p); return p.querySelector('.mp-area');
    };
    const s = drawStatic(page('전체 지도', `${date} · 전체 지도${cs.length > 1 ? ` · 중심 주제 ${cs.length}개` : ''}`), st, AW, AH);
    const solo = c => Object.assign({}, c, { x: undefined, y: undefined, collapsed: false });
    const branches = (c, pre) => {   // 너무 작아지면 큰 가지별로 한 쪽씩 더
      const ks = vk(c); if (ks.length < 2) return;
      ks.forEach((k, i) => {
        const one = { layout: st.layout === 'down' ? 'down' : 'right', root: mk('', [Object.assign(solo(c), { kids: [k] })]) };
        drawStatic(page(`${pre}가지 ${i + 1}. ${oneLine(k.text).slice(0, 40)}`, `${pre}가지 ${i + 1} / ${ks.length}`), one, AW, AH, true);
      });
    };
    if (s < 0.55) {
      if (cs.length > 1) cs.forEach((c, ci) => {   // 중심 주제가 여럿이면 먼저 중심 주제별로 한 쪽씩
        const s2 = drawStatic(page(`중심 ${ci + 1}. ${oneLine(c.text).slice(0, 40)}`, `중심 주제 ${ci + 1} / ${cs.length}`), { layout: st.layout, root: mk('', [solo(c)]) }, AW, AH, true);
        if (s2 < 0.55) branches(c, `${oneLine(c.text).slice(0, 16)} · `);
      });
      else branches(cs[0], '');
    }
    index(st.root);
    const ol = document.createElement('section'); ol.className = 'mp-ol';
    ol.innerHTML = `<span class="mk" style="top:1mm;bottom:auto">@@P:개요@@</span><div class="stamp">CONFIDENTIAL</div><div class="kicker">MIND MAP · 마인드맵</div><h1>${title}</h1><div class="sub">${date} 정리 · 개요</div><div class="rule"></div>`
      + cs.map(c => `<div class="root">${c.text || '&nbsp;'}</div>${c.note ? `<span class="nt">${escT(c.note)}</span>` : ''}${c.kids.map(k => olPrint(k, true)).join('')}`).join('');
    wrap.appendChild(ol);
    document.title = 'done';
  }

  function flash(oldHtml) {   // 바깥(폰·클로드)에서 바뀐 새 판: 옛 판에 없던 주제를 20초 노랗게
    if (!M || M.mode !== 'map') return 0;
    const had = new Map(), walk = (n, f) => { f(n); n.kids.forEach(k => walk(k, f)); };
    walk(parse(oldHtml).root, n => { const k = oneLine(n.text); had.set(k, (had.get(k) || 0) + 1); });
    const hit = [];
    for (const n of M.ix.vis) { const k = oneLine(n.text), c = had.get(k) || 0; if (c) had.set(k, c - 1); else hit.push(n.id); }
    for (const id of hit) { const r = M.els.get(id); if (r) r.el.classList.add('flash'); }
    setTimeout(() => { if (M) for (const r of M.els.values()) r.el.classList.remove('flash'); }, 20000);
    return hit.length;
  }
  window.Mind = {
    flash,
    mount, unmount, parse, serialize, forestFromText, forestFromHtml, print, LAYOUTS,
    // 11/21 공략집 블록(blocks.js·board.js)·PDF가 쓰는 것: 그림만 그리기 · 주제 만들기 · 글자 다듬기
    draw: (area, src, aw, ah, o = {}) => drawStatic(area, typeof src === 'string' ? parse(src) : src, aw, ah, !!o.keepColor, o),
    topic: (text, kids) => mk(text, kids || []), clean, oneLine,
    html: () => htmlLive(),
    centerText: () => (M ? oneLine(M.st.root.kids[0].text) : ''),
    isBlank: () => !M || (M.st.root.kids.length === 1 && !M.st.root.kids[0].kids.length && oneLine(M.st.root.kids[0].text) === DEF),
    on: () => !!M,
    focus: () => { if (M) M.mode === 'map' ? focusMap() : focusRow(M.sel, true); },
    state: () => (M ? { view: M.view ? { ...M.view } : null, mode: M.mode } : null),
    _M: () => M,   // 시험용
  };
})();
