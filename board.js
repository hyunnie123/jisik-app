/* 지식 작업실 「공략집」 화이트보드 (11/21) — 문서 ↔ 화이트보드 전환 (AFFiNE 문서(Page)/무한 캔버스(Edgeless) 전환)
   - 문서의 구역(큰 제목 단위, 맨 앞 머리말 포함)이 카드로 놓인다. 카드에서 고치면 문서도 바뀐다 (AFFiNE: 문서의 노트 블록이 보드 위에 그대로 · Obsidian Canvas 「노트 카드」).
   - 자유 글 카드 · 마인드맵 카드 · 화살표(카드끼리 잇기) · 그룹(테두리) · 확대/이동 (Obsidian Canvas · Heptabase 화이트보드 카드)
   - 조작은 Obsidian Canvas 그대로: 빈 곳 두 번 누르기 = 새 글 카드, 휠 = 이동, ⌘/Ctrl+휠(트랙패드 오므리기) = 확대, 빈 곳 끌기 = 여러 개 고르기,
     스페이스+끌기 = 이동, 카드 두 번 누르기 = 고치기, 카드 가장자리 점 끌기 = 화살표, Delete = 지우기. 폰: 한 손가락 빈 곳 끌기 = 이동, 두 손가락 = 확대.
   저장 모양 = JSON Canvas 1.0 공개 규격(jsoncanvas.org) {nodes, edges} — 원본 html 맨 끝 <div class="board" hidden data-canvas="…JSON…"></div> (script 없음)
     구역 카드 = {type:"file", file:"<글 제목>.html", subpath:"#<큰 제목 글자>"} (규격의 「파일의 제목으로 가는 subpath」), 머리말은 subpath "#^intro"
     글 카드 = {type:"text", text:"마크다운"} · 마인드맵 카드 = {type:"text", text:"- 들여쓰기 목록", jxmind:"<div class=mindmap>…"} · 그룹 = {type:"group", label}
     화살표 = {id, fromNode, fromSide, toNode, toSide, toEnd:"arrow"} — 규격 기본값
   문서 모드에서는 보드가 안 보이고, PDF에도 안 들어간다(AFFiNE 「PDF로 내보내기·인쇄」는 문서 모드에서만 — 화이트보드는 PNG). */
(function () {
  'use strict';
  const say = (t, ms) => (typeof window.toast === 'function' ? window.toast(t, ms) : console.log(t));
  const ed = () => document.getElementById('ed');
  const dirty = () => { try { markDirty(); } catch (e) {} };
  const escT = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const rid = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
  const CW = 420, CH = 460, GAP = 60;
  const COLORS = { 1: '#c0392b', 2: '#d9822b', 3: '#c9a227', 4: '#3f8a4f', 5: '#2e8a99', 6: '#7d4f9e' };   // 규격 프리셋 1~6(빨·주·노·초·청록·보라) — 색은 앱이 정함
  const col = c => COLORS[c] || (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');

  /* ---------------- 저장 꼬리 ---------------- */
  const TAIL = /<div\b[^>]*\bclass="board"[^>]*>\s*<\/div>\s*$/;
  function cut(h) {   // html → [보드 JSON 문자열, 나머지]
    h = String(h || ''); const m = h.match(TAIL); if (!m) return ['', h];
    const t = document.createElement('template'); t.innerHTML = m[0];
    const d = t.content.querySelector('.board'); const j = d && d.getAttribute('data-canvas') || '';
    return [j, h.slice(0, m.index)];
  }
  function tail(t) {
    const j = t && t.board; if (!j) return '';
    return `<div class="board" hidden data-canvas="${String(j).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"></div>`;
  }
  function load(t) {
    try { const j = JSON.parse(t.board || '{}'); return { nodes: Array.isArray(j.nodes) ? j.nodes : [], edges: Array.isArray(j.edges) ? j.edges : [] }; }
    catch (e) { return { nodes: [], edges: [] }; }
  }
  function store() { if (!B) return; B.t.board = JSON.stringify({ nodes: B.c.nodes.map(n => { const o = { ...n }; for (const k of Object.keys(o)) if (k.startsWith('_')) delete o[k]; return o; }), edges: B.c.edges }); dirty(); }

  /* ---------------- 문서 구역 ---------------- */
  function sections() {   // [{key:'#^intro'|'#제목', els:[...]}] — 문서 모드 큰 제목 ▲▼ 와 같은 단위
    const e = ed(); const out = []; let curS = { key: '#^intro', els: [] };
    for (const k of e.children) {
      if (k.tagName === 'H2') { if (curS.els.length) out.push(curS); curS = { key: '#' + k.textContent.replace(/\s+/g, ' ').trim(), els: [k] }; }
      else curS.els.push(k);
    }
    if (curS.els.length) out.push(curS);
    const seen = {}; out.forEach(s => { seen[s.key] = (seen[s.key] || 0) + 1; s.nth = seen[s.key]; });   // 같은 제목 둘이면 차례로
    return out.filter(s => s.key !== '#^intro' || s.els.some(x => x.textContent.trim() || x.querySelector('hr,.mindmap')));
  }
  const secId = s => s.key + (s.nth > 1 ? ' ' + s.nth : '');
  function nodeSec(n, ss) { return ss.find(s => secId(s) === (n.subpath || '') + (n._nth > 1 ? ' ' + n._nth : '')); }

  /* ---------------- 보드 ---------------- */
  let B = null;
  function open(t) {
    close(true);
    const sc = document.getElementById('scroll'); if (!sc || !ed()) return;
    try { if (window.JXB) JXB.deactivate(); } catch (e) {}
    const c = load(t);
    B = { t, c, view: t.bview || null, sel: new Set(), selE: null, edit: null, ptr: new Map() };
    document.getElementById('app').classList.add('boardmode');
    const el = document.createElement('div'); el.className = 'jxb'; el.id = 'jxb';
    el.innerHTML = `<div class="jxb-tools" role="toolbar" aria-label="화이트보드 도구">
<button type="button" data-b="text" title="새 글 카드 (빈 곳 두 번 누르기)">+ 글 카드</button>
<button type="button" data-b="mind" title="새 마인드맵 카드">+ 마인드맵</button>
<button type="button" data-b="group" title="고른 카드를 그룹 테두리로 묶기">그룹</button>
<button type="button" data-b="del" title="고른 것 지우기 (Delete)">지우기</button>
<span class="jxb-sep"></span>
<button type="button" data-b="zout" title="축소 (⌘−)">−</button><span class="jxb-zl">100%</span><button type="button" data-b="zin" title="확대 (⌘+)">+</button>
<button type="button" data-b="fit" title="전체 보기 (⇧1)">전체 보기</button>
<span class="jxb-help">카드 가장자리 점을 끌면 화살표 · 두 번 누르면 고치기</span></div>
<div class="jxb-canvas" tabindex="0" aria-label="화이트보드"><div class="jxb-stage"><svg class="jxb-edges"><defs><marker id="jxbArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#7f7462"/></marker></defs><g class="jxb-eg"></g></svg><div class="jxb-nodes"></div></div><div class="jxb-box" hidden></div></div>`;
    sc.appendChild(el);
    B.el = el; B.canvas = el.querySelector('.jxb-canvas'); B.stage = el.querySelector('.jxb-stage'); B.eg = el.querySelector('.jxb-eg'); B.nodes = el.querySelector('.jxb-nodes'); B.box = el.querySelector('.jxb-box'); B.zl = el.querySelector('.jxb-zl');
    sync();
    render();
    if (!B.view) fit(); else apply();
    bind();
    B.canvas.focus({ preventScroll: true });
  }
  function close(silent) {
    if (!B) return;
    if (B.edit) endEdit();
    B.t.bview = B.view; B.el.remove(); B = null;
    document.getElementById('app').classList.remove('boardmode');
    window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', keyUp, true);
  }
  function sync() {   // 문서 구역과 맞추기: 없는 구역 카드는 새로 놓고, 사라진 구역 카드는 뺀다(글은 문서에 있음)
    const ss = sections(), have = new Set(), c = B.c; let changed = false;
    const cnt = {};
    c.nodes.forEach(n => { if (n.type === 'file') { cnt[n.subpath] = (cnt[n.subpath] || 0) + 1; n._nth = cnt[n.subpath]; } });
    c.nodes = c.nodes.filter(n => { if (n.type !== 'file') return true; const s = nodeSec(n, ss); if (s && !have.has(secId(s))) { have.add(secId(s)); return true; } changed = true; return false; });
    let x0 = 0, y0 = 0; const files = c.nodes.filter(n => n.type === 'file');
    if (c.nodes.length) { const b = bbox(c.nodes); x0 = b.x; y0 = b.y + b.h + GAP; }
    let k = 0; const fresh = ss.filter(s => !have.has(secId(s)));
    const per = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(fresh.length))));
    for (const s of fresh) {
      c.nodes.push({ id: rid(), type: 'file', file: ((B.t.saved || B.t.name || '제목 없음') + '.html'), subpath: s.key, x: x0 + (k % per) * (CW + GAP), y: y0 + Math.floor(k / per) * (CH + GAP), width: CW, height: CH, _nth: s.nth });
      k++;
    }
    if (files.length && (changed || fresh.length)) store();   // 이미 보드가 있던 글만 바로 기록(처음 열 때는 손대기 전까지 원본 그대로)
    const ids = new Set(c.nodes.map(n => n.id)); c.edges = c.edges.filter(e => ids.has(e.fromNode) && ids.has(e.toNode));
  }
  function bbox(ns) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const n of ns) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.width); y1 = Math.max(y1, n.y + n.height); } return ns.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 1, h: 1 }; }

  /* ---------------- 그리기 ---------------- */
  function cardHtml(n, ss) {
    const c = col(n.color);
    if (n.type === 'group') return `<div class="jxg-label" style="${c ? `color:${c}` : ''}">${escT(n.label || '그룹')}</div>`;
    if (n.type === 'file') {
      const s = nodeSec(n, ss); if (!s) return '<div class="jxc-body">(구역 없음)</div>';
      const box = document.createElement('div'); s.els.forEach(x => box.appendChild(window.JXB ? JXB.cleanClone(wrap(x)).firstElementChild : x.cloneNode(true)));
      return `<div class="jxc-kind">문서 구역</div><div class="jxc-body doc">${box.innerHTML}</div>`;
    }
    if (n.jxmind) return `<div class="jxc-kind">마인드맵</div><div class="jxc-mind"><div class="mm jxm-mm"><div class="jxm-area"></div></div></div>`;
    return `<div class="jxc-body jxc-text">${escT(n.text || '')}</div>`;
  }
  const wrap = x => { const d = document.createElement('div'); d.appendChild(x.cloneNode(true)); return d; };
  function render() {
    const ss = sections();
    B.nodes.innerHTML = '';
    const groups = B.c.nodes.filter(n => n.type === 'group'), rest = B.c.nodes.filter(n => n.type !== 'group');
    for (const n of [...groups, ...rest]) {   // 규격: 앞에 있는 것이 아래 — 그룹은 늘 아래에
      const d = document.createElement('div'); d.className = 'jxc ' + (n.type === 'group' ? 'jxg' : n.type === 'file' ? 'jxc-file' : n.jxmind ? 'jxc-mm' : 'jxc-txt') + (B.sel.has(n.id) ? ' sel' : '');
      d.dataset.id = n.id; const c = col(n.color); if (c) d.style.setProperty('--cc', c);
      place(d, n);
      d.innerHTML = cardHtml(n, ss) + (n.type === 'group' ? '' : '<i class="jxc-dot" data-side="top"></i><i class="jxc-dot" data-side="right"></i><i class="jxc-dot" data-side="bottom"></i><i class="jxc-dot" data-side="left"></i>') + '<i class="jxc-rs" title="크기"></i>';
      B.nodes.appendChild(d); n._el = d;
      if (n.jxmind) drawMind(n);
      d.querySelectorAll('.mindmap').forEach(m => { const v = m.querySelector('.jxm-view'); if (v) v.remove(); const a = document.createElement('div'); a.className = 'jxc-mfig mm jxm-mm'; const ar = document.createElement('div'); ar.className = 'jxm-area'; a.appendChild(ar); m.appendChild(a); try { const w = Math.max(200, n.width - 40); ar.style.width = w + 'px'; window.Mind.draw(ar, JXB.cleanClone(wrap(m)).querySelector('.mindmap').outerHTML, w, 0, { natural: true, cap: 1 }); a.style.height = ar.style.height; } catch (e) {} m.setAttribute('contenteditable', 'false'); });
    }
    edges();
  }
  function drawMind(n) {
    const a = n._el.querySelector('.jxm-area'); if (!a) return; a.innerHTML = '';
    const w = n.width - 2, h = n.height - 30; a.style.width = w + 'px'; a.style.height = h + 'px';
    try { window.Mind.draw(a, n.jxmind, w, h); } catch (e) {}
  }
  function place(d, n) { d.style.transform = `translate(${n.x}px,${n.y}px)`; d.style.width = n.width + 'px'; d.style.height = n.height + 'px'; }
  function anchor(n, side) {
    const cx = n.x + n.width / 2, cy = n.y + n.height / 2;
    return side === 'top' ? [cx, n.y] : side === 'bottom' ? [cx, n.y + n.height] : side === 'left' ? [n.x, cy] : [n.x + n.width, cy];
  }
  const NORM = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
  function nearSide(n, px, py) { const cx = n.x + n.width / 2, cy = n.y + n.height / 2, dx = (px - cx) / n.width, dy = (py - cy) / n.height; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top'); }
  function curve(a, as, b, bs) {
    const d = Math.max(40, Math.hypot(b[0] - a[0], b[1] - a[1]) / 3), na = NORM[as] || [0, 0], nb = NORM[bs] || [0, 0];
    return `M${a[0]} ${a[1]} C${a[0] + na[0] * d} ${a[1] + na[1] * d} ${b[0] + nb[0] * d} ${b[1] + nb[1] * d} ${b[0]} ${b[1]}`;
  }
  function edges(tmp) {
    const by = new Map(B.c.nodes.map(n => [n.id, n])); let h = '';
    for (const e of B.c.edges) {
      const a = by.get(e.fromNode), b = by.get(e.toNode); if (!a || !b) continue;
      const fs = e.fromSide || nearSide(a, b.x + b.width / 2, b.y + b.height / 2), ts = e.toSide || nearSide(b, a.x + a.width / 2, a.y + a.height / 2);
      const p = curve(anchor(a, fs), fs, anchor(b, ts), ts), c = col(e.color) || '#7f7462';
      const ends = `${(e.toEnd || 'arrow') === 'arrow' ? ' marker-end="url(#jxbArrow)"' : ''}${e.fromEnd === 'arrow' ? ' marker-start="url(#jxbArrow)"' : ''}`;
      h += `<path class="jxe-hit" data-e="${e.id}" d="${p}"/><path class="jxe${B.selE === e.id ? ' sel' : ''}" d="${p}" stroke="${c}"${ends}/>`;
      if (e.label) { const m = anchor(a, fs), n2 = anchor(b, ts); h += `<text x="${(m[0] + n2[0]) / 2}" y="${(m[1] + n2[1]) / 2 - 6}" class="jxe-l">${escT(e.label)}</text>`; }
    }
    if (tmp) h += `<path class="jxe tmp" d="${tmp}" stroke="#3d6585" marker-end="url(#jxbArrow)"/>`;
    B.eg.innerHTML = h;
  }
  function apply() { const v = B.view; B.stage.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`; B.zl.textContent = Math.round(v.k * 100) + '%'; B.canvas.style.backgroundSize = `${24 * v.k}px ${24 * v.k}px`; B.canvas.style.backgroundPosition = `${v.x}px ${v.y}px`; }
  function fit() {
    const r = B.canvas.getBoundingClientRect(), b = bbox(B.c.nodes), pad = 40;
    const k = Math.max(0.1, Math.min(1, (r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h));
    B.view = { k, x: (r.width - b.w * k) / 2 - b.x * k, y: Math.max(pad, (r.height - b.h * k) / 2) - b.y * k }; apply();
  }
  function zoomAt(f, cx, cy) { const v = B.view, k = Math.max(0.1, Math.min(3, v.k * f)); v.x = cx - (cx - v.x) * k / v.k; v.y = cy - (cy - v.y) * k / v.k; v.k = k; apply(); }
  const local = e => { const r = B.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const world = e => { const [x, y] = local(e); return [(x - B.view.x) / B.view.k, (y - B.view.y) / B.view.k]; };
  const nodeOf = id => B.c.nodes.find(n => n.id === id);
  function paintSel() { for (const n of B.c.nodes) if (n._el) n._el.classList.toggle('sel', B.sel.has(n.id)); edges(); }

  /* ---------------- 고치기 ---------------- */
  function startEdit(n) {
    if (B.edit) endEdit();
    if (n.type === 'group') { const l = n._el.querySelector('.jxg-label'); l.contentEditable = 'true'; l.focus(); selAll(l); B.edit = { n, el: l, kind: 'label' }; return; }
    if (n.jxmind) return bigMind(n);
    const body = n._el.querySelector('.jxc-body'); if (!body) return;
    if (n.type === 'file') body.querySelectorAll('.mindmap').forEach(m => m.setAttribute('contenteditable', 'false'));
    body.contentEditable = n.type === 'file' ? 'true' : 'plaintext-only';
    if (body.contentEditable !== 'plaintext-only' && n.type !== 'file') body.contentEditable = 'true';
    n._el.classList.add('editing'); body.focus(); B.edit = { n, el: body, kind: n.type };
    body.addEventListener('input', onEditInput);
  }
  function selAll(el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  let wbT = null;
  function onEditInput() { clearTimeout(wbT); wbT = setTimeout(writeBack, 200); }
  function writeBack() {
    const E = B && B.edit; if (!E) return;
    const n = E.n;
    if (E.kind === 'text') { n.text = E.el.innerText.replace(/\n$/, ''); store(); return; }
    if (E.kind === 'label') { n.label = E.el.textContent.trim() || '그룹'; store(); return; }
    if (E.kind === 'file') {   // 카드 글 → 문서 그 구역 (AFFiNE: 보드 위 노트 = 문서의 같은 블록)
      const ss = sections(), s = nodeSec(n, ss); if (!s) return;
      const k = JXB.cleanClone(E.el);
      k.querySelectorAll('.jxc-mfig').forEach(x => x.remove());
      const fresh = [...k.childNodes].filter(x => x.nodeType === 1 || x.textContent.trim());
      const anchorEl = s.els[s.els.length - 1].nextSibling;
      s.els.forEach(x => x.remove());
      fresh.forEach(x => { if (x.nodeType === 3) { const p = document.createElement('p'); p.textContent = x.textContent; x = p; } ed().insertBefore(x, anchorEl); });
      const h2 = fresh.find(x => x.tagName === 'H2');
      const key = s.key === '#^intro' && !h2 ? '#^intro' : h2 ? '#' + h2.textContent.replace(/\s+/g, ' ').trim() : s.key;
      if (key !== n.subpath) n.subpath = key;
      store();
    }
  }
  function endEdit() {
    const E = B.edit; if (!E) return; clearTimeout(wbT); writeBack();
    E.el.contentEditable = 'false'; E.el.removeEventListener('input', onEditInput); if (E.n._el) E.n._el.classList.remove('editing');
    B.edit = null; getSelection().removeAllRanges();
  }
  function mdOf(st) {   // 마인드맵 → 들여쓰기 마크다운 목록 (JSON Canvas text 칸은 마크다운이라)
    const M = window.Mind, line = (n, d) => '\t'.repeat(d) + '- ' + (n.todo === 1 ? '[x] ' : n.todo === 0 ? '[ ] ' : '') + M.oneLine(String(n.text).replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<mark>(.*?)<\/mark>/g, '==$1==')) + '\n' + n.kids.map(k => line(k, d + 1)).join('');
    return st.root.kids.map(c => line(c, 0)).join('').trimEnd();
  }
  function bigMind(n) {
    const d = document.createElement('div'); d.className = 'jxm-big';
    d.innerHTML = '<div class="jxm-bighead"><b>마인드맵 카드</b><span class="jxm-g"></span><button type="button" class="btn primary">닫기</button></div><div class="jxm-bighost"></div>';
    document.body.appendChild(d);
    window.Mind.mount(d.querySelector('.jxm-bighost'), n.jxmind, { mode: 'map' });
    const close = () => { try { n.jxmind = window.Mind.html(); n.text = mdOf(window.Mind.parse(n.jxmind)); window.Mind.unmount(); } catch (e) {} d.remove(); store(); if (B) render(); };
    d.querySelector('.btn').onclick = close;
    setTimeout(() => { try { window.Mind.focus(); } catch (e) {} }, 30);
  }
  function addNode(kind, x, y) {
    const v = B.view, r = B.canvas.getBoundingClientRect();
    if (x == null) { x = (r.width / 2 - v.x) / v.k - 140; y = (r.height / 2 - v.y) / v.k - 80; }
    let n;
    if (kind === 'mind') {
      const mh = window.Mind.serialize({ layout: 'map', root: window.Mind.topic('', [window.Mind.topic('중심 주제')]) });
      n = { id: rid(), type: 'text', text: '- 중심 주제', jxmind: mh, x: Math.round(x), y: Math.round(y), width: 400, height: 280 };
    } else n = { id: rid(), type: 'text', text: '', x: Math.round(x), y: Math.round(y), width: 260, height: 140 };
    B.c.nodes.push(n); B.sel = new Set([n.id]); store(); render();
    if (kind !== 'mind') startEdit(n);
  }
  function group() {
    const ns = B.c.nodes.filter(n => B.sel.has(n.id) && n.type !== 'group'); if (!ns.length) return say('묶을 카드를 먼저 고르세요 (빈 곳을 끌어 여러 개)');
    const b = bbox(ns), p = 30;
    const g = { id: rid(), type: 'group', label: '그룹', x: Math.round(b.x - p), y: Math.round(b.y - p - 24), width: Math.round(b.w + p * 2), height: Math.round(b.h + p * 2 + 24) };
    B.c.nodes.unshift(g); B.sel = new Set([g.id]); store(); render(); startEdit(g);
  }
  function del() {
    if (B.selE) { B.c.edges = B.c.edges.filter(e => e.id !== B.selE); B.selE = null; store(); edges(); return; }
    const ids = [...B.sel]; if (!ids.length) return;
    const files = ids.filter(id => (nodeOf(id) || {}).type === 'file');
    if (files.length) say('문서 구역 카드는 문서 모드에서 그 구역을 지워야 없어져요', 4000);
    const gone = new Set(ids.filter(id => (nodeOf(id) || {}).type !== 'file'));
    if (!gone.size) return;
    B.c.nodes = B.c.nodes.filter(n => !gone.has(n.id)); B.c.edges = B.c.edges.filter(e => !gone.has(e.fromNode) && !gone.has(e.toNode));
    B.sel.clear(); store(); render();
  }

  /* ---------------- 누르기·끌기 ---------------- */
  let P = null, space = false;
  function down(e) {
    if (B.edit && e.target.closest && B.edit.el.contains(e.target)) return;   // 고치는 중인 글 안
    if (e.target.closest('.jxb-tools')) return;
    B.ptr.set(e.pointerId, local(e));
    if (B.ptr.size === 2) { const [a, b] = [...B.ptr.values()]; P = { kind: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: B.view.k, x: B.view.x, y: B.view.y, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; return; }
    if (B.edit) endEdit();
    const [wx, wy] = world(e), cd = e.target.closest('.jxc'), dot = e.target.closest('.jxc-dot'), rs = e.target.closest('.jxc-rs'), hit = e.target.closest('.jxe-hit');
    try { B.canvas.setPointerCapture(e.pointerId); } catch (er) {}
    if (hit) { B.selE = hit.dataset.e; B.sel.clear(); paintSel(); return; }
    B.selE = null;
    if (dot) { const n = nodeOf(cd.dataset.id); P = { kind: 'edge', n, side: dot.dataset.side }; return; }
    if (rs) { const n = nodeOf(cd.dataset.id); P = { kind: 'resize', n, w: n.width, h: n.height, sx: wx, sy: wy }; return; }
    if (cd) {
      const n = nodeOf(cd.dataset.id);
      if (!B.sel.has(n.id)) { if (!e.shiftKey) B.sel.clear(); B.sel.add(n.id); } else if (e.shiftKey) { B.sel.delete(n.id); }
      paintSel();
      const move = B.c.nodes.filter(x => B.sel.has(x.id));
      for (const g of move.filter(x => x.type === 'group')) for (const x of B.c.nodes) if (x !== g && !move.includes(x) && x.x >= g.x && x.y >= g.y && x.x + x.width <= g.x + g.width && x.y + x.height <= g.y + g.height) move.push(x);   // 그룹을 끌면 안의 카드도 (Obsidian)
      P = { kind: 'move', sx: wx, sy: wy, list: move.map(x => [x, x.x, x.y]), moved: false };
      return;
    }
    const touch = e.pointerType === 'touch';
    if (space || e.button === 1 || touch) { P = { kind: 'pan', x: e.clientX, y: e.clientY, vx: B.view.x, vy: B.view.y }; return; }
    B.sel.clear(); paintSel();
    P = { kind: 'box', sx: wx, sy: wy, lx: local(e) };
  }
  function move(e) {
    if (B.ptr.has(e.pointerId)) B.ptr.set(e.pointerId, local(e));
    if (!P) return;
    if (P.kind === 'pinch') { if (B.ptr.size < 2) return; const [a, b] = [...B.ptr.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const k = Math.max(0.1, Math.min(3, P.k * d / P.d)); B.view = { k, x: P.cx - (P.cx - P.x) * k / P.k, y: P.cy - (P.cy - P.y) * k / P.k }; apply(); return; }
    const [wx, wy] = world(e);
    if (P.kind === 'pan') { B.view.x = P.vx + e.clientX - P.x; B.view.y = P.vy + e.clientY - P.y; apply(); return; }
    if (P.kind === 'move') {
      const dx = Math.round(wx - P.sx), dy = Math.round(wy - P.sy); if (!P.moved && Math.abs(dx) + Math.abs(dy) < 3) return; P.moved = true;
      for (const [n, x, y] of P.list) { n.x = x + dx; n.y = y + dy; if (n._el) place(n._el, n); }
      edges(); return;
    }
    if (P.kind === 'resize') { const n = P.n; n.width = Math.max(140, Math.round(P.w + wx - P.sx)); n.height = Math.max(80, Math.round(P.h + wy - P.sy)); place(n._el, n); edges(); P.moved = true; return; }
    if (P.kind === 'edge') { const a = anchor(P.n, P.side); edges(curve(a, P.side, [wx, wy], '')); P.to = [wx, wy]; return; }
    if (P.kind === 'box') {
      const x0 = Math.min(P.sx, wx), y0 = Math.min(P.sy, wy), x1 = Math.max(P.sx, wx), y1 = Math.max(P.sy, wy);
      const v = B.view; Object.assign(B.box.style, { left: x0 * v.k + v.x + 'px', top: y0 * v.k + v.y + 'px', width: (x1 - x0) * v.k + 'px', height: (y1 - y0) * v.k + 'px' }); B.box.hidden = false;
      B.sel = new Set(B.c.nodes.filter(n => n.x < x1 && n.x + n.width > x0 && n.y < y1 && n.y + n.height > y0 && (n.type !== 'group' || (n.x >= x0 && n.y >= y0 && n.x + n.width <= x1 && n.y + n.height <= y1))).map(n => n.id)); paintSel();
    }
  }
  function up(e) {
    B.ptr.delete(e.pointerId);
    try { B.canvas.releasePointerCapture(e.pointerId); } catch (er) {}
    if (!P) return; const p = P; P = null; B.box.hidden = true;
    if (p.kind === 'pinch') { B.t.bview = B.view; return; }
    if (p.kind === 'move' && p.moved) store();
    if (p.kind === 'resize' && p.moved) { store(); if (p.n.jxmind) drawMind(p.n); }
    if (p.kind === 'edge') {
      edges();
      if (!p.to) return;
      const tgt = B.c.nodes.slice().reverse().find(n => n !== p.n && n.type !== 'group' && p.to[0] >= n.x && p.to[0] <= n.x + n.width && p.to[1] >= n.y && p.to[1] <= n.y + n.height)
        || B.c.nodes.slice().reverse().find(n => n !== p.n && p.to[0] >= n.x && p.to[0] <= n.x + n.width && p.to[1] >= n.y && p.to[1] <= n.y + n.height);
      if (!tgt) return;
      B.c.edges.push({ id: rid(), fromNode: p.n.id, fromSide: p.side, toNode: tgt.id, toSide: nearSide(tgt, p.to[0], p.to[1]), toEnd: 'arrow' });
      store(); edges();
    }
  }
  function dbl(e) {
    const tg = document.elementFromPoint(e.clientX, e.clientY) || e.target;   // 끌기 때 잡은 포인터 때문에 e.target 이 캔버스로 바뀔 수 있음
    const cd = tg.closest('.jxc');
    if (cd) { const n = nodeOf(cd.dataset.id); if (n && !(B.edit && B.edit.n === n)) { e.preventDefault(); startEdit(n); } return; }
    if (tg.closest('.jxb-tools')) return;
    const [wx, wy] = world(e); addNode('text', wx - 130, wy - 30);
  }
  function wheel(e) {
    if (B.edit && B.edit.el.contains(e.target) && !e.ctrlKey && !e.metaKey) return;
    const body = e.target.closest('.jxc-body'); if (body && body.scrollHeight > body.clientHeight && !e.ctrlKey && !e.metaKey && B.sel.has(body.closest('.jxc').dataset.id)) return;   // 고른 카드 안 글은 카드 안에서 굴림
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const [x, y] = local(e); zoomAt(Math.exp(-e.deltaY / 300), x, y); }
    else { B.view.x -= e.deltaX; B.view.y -= e.deltaY; apply(); }
  }
  function key(e) {
    if (!B) return;
    if (B.edit) { if (e.key === 'Escape') { e.preventDefault(); endEdit(); } return; }
    if (document.querySelector('.jxm-big')) return;
    const t = e.target; if (t && t.closest && t.closest('input,textarea,[contenteditable="true"]') && !t.closest('.jxb')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === ' ' && !mod) { space = true; B.canvas.classList.add('space'); e.preventDefault(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) { e.preventDefault(); return del(); }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); const r = B.canvas.getBoundingClientRect(); return zoomAt(1.2, r.width / 2, r.height / 2); }
    if (mod && e.key === '-') { e.preventDefault(); const r = B.canvas.getBoundingClientRect(); return zoomAt(1 / 1.2, r.width / 2, r.height / 2); }
    if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); return fit(); }
    if (e.key === 'Escape') { B.sel.clear(); B.selE = null; paintSel(); }
    if (e.key === 'Enter' && B.sel.size === 1) { e.preventDefault(); startEdit(nodeOf([...B.sel][0])); }
  }
  function keyUp(e) { if (e.key === ' ') { space = false; if (B) B.canvas.classList.remove('space'); } }
  function bind() {
    const c = B.canvas;
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('dblclick', dbl); c.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key, true); window.addEventListener('keyup', keyUp, true);
    B.el.querySelector('.jxb-tools').addEventListener('click', e => {
      const b = e.target.closest('[data-b]'); if (!b) return; const a = b.dataset.b, r = B.canvas.getBoundingClientRect();
      if (a === 'text' || a === 'mind') addNode(a); else if (a === 'group') group(); else if (a === 'del') del();
      else if (a === 'zin') zoomAt(1.2, r.width / 2, r.height / 2); else if (a === 'zout') zoomAt(1 / 1.2, r.width / 2, r.height / 2); else if (a === 'fit') fit();
    });
    // 폰: 두 번 톡 = 두 번 누르기
    let lt = 0, lid = '';
    c.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') return; const cd = (document.elementFromPoint(e.clientX, e.clientY) || e.target).closest('.jxc'), id = cd ? cd.dataset.id : '#'; const now = Date.now(); if (now - lt < 320 && id === lid) dbl(e); lt = now; lid = id; });
  }

  window.JXBoard = { open, close, cut, tail, on: () => !!B, refresh: () => { if (B) { sync(); render(); } }, _B: () => B };
})();
