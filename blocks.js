/* 지식 작업실 「공략집」 블록 (11/21) — editor.html(맥·폰 공용)이 부른다. 공략집·지식정리본 글 안에서:
   ① 「/」 슬래시 메뉴로 블록 넣기 (Notion·AFFiNE 슬래시 메뉴)
   ② 블록 왼쪽 ⋮⋮ 손잡이: 끌어 옮기기 · 누르면 블록 메뉴(바꾸기·복제·지우기) (Notion 블록 손잡이)
   ③ 마인드맵 블록: 글 사이의 지도. 누르면 그 자리에서 mind.js 그대로 편집, 아래 손잡이로 높이, 「크게 열기」
   ④ 목록 ↔ 마인드맵 바꾸기 (Xmind 개요(Outliner)↔지도 · MindNode 개요) — 글자 손실 0, 되돌리기
   ⑤ 「지도로 보기」: 큰 제목→소제목→목록 줄을 자동 마인드맵으로(읽기). 가지 누르면 문서 그 자리로 (Xmind 개요↔지도)
   저장 모양(원본 html, 사람이 읽음·<script> 없음):
     마인드맵 블록 = <div class="mindmap" data-layout="map|right|down" data-h="360" [data-list="ul|ol|todo"]>\n<ul>…mind.js 중첩 목록…</ul>\n</div>
     (화면에서만 contenteditable="false"·.jxm-* 그림이 붙고, 저장할 때 걷는다 — html())
   화이트보드는 board.js. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const ON = c => c === 'gongsik' || c === 'jeongri';
  const H0 = 360, HMIN = 160, HMAX = 1400;
  const say = (t, ms) => (typeof window.toast === 'function' ? window.toast(t, ms) : console.log(t));
  const coarse = () => matchMedia('(pointer:coarse)').matches;
  const ed = () => document.getElementById('ed');
  const isOn = () => { try { return !!(cur && ON(cur.c) && ed()); } catch (e) { return false; } };
  const dirty = () => { try { markDirty(); } catch (e) {} };
  const inMind = t => !!(t && t.closest && t.closest('.mindmap'));
  const flat = h => { const t = document.createElement('template'); t.innerHTML = String(h || ''); return (t.content.textContent || '').replace(/[\s ​]+/g, ''); };

  /* ================================================================ 저장 모양 */
  function cleanClone(root) {   // 화면용 붙이(.jxm-*·contenteditable) 걷은 사본
    const k = root.cloneNode(true);
    k.querySelectorAll('.mindmap').forEach(b => {
      b.querySelectorAll(':scope > [class^="jxm-"], :scope > [class*=" jxm-"]').forEach(x => x.remove());
      b.removeAttribute('contenteditable');
      if (b.getAttribute('class') !== 'mindmap') b.setAttribute('class', 'mindmap');
    });
    return k;
  }
  function html(root) {   // #ed → 저장 html (마인드맵·패턴 블록이 없으면 innerHTML 그대로 — 예전 글은 한 글자도 안 바뀜)
    if (!root) return '';
    const hasM = !!root.querySelector('.mindmap'), hasP = !!(window.JXP && root.querySelector('.pt-blk-wrap'));
    if (!hasM && !hasP) return root.innerHTML;
    if (hasM) flushActive();
    const k = hasM ? cleanClone(root) : root.cloneNode(true);
    if (hasP) window.JXP.clean(k);   // 11/21 패턴 블록: 화면용 contenteditable·빈 선택 칸 걷기
    return k.innerHTML;
  }
  function blockHtml(b) { return cleanClone(wrapOne(b)).querySelector('.mindmap').outerHTML; }
  function wrapOne(b) { const d = document.createElement('div'); d.appendChild(b.cloneNode(true)); return d; }
  function writeMind(b, mhtml) {   // mind.js 가 준 <div class="mindmap" data-layout>…</div> 를 블록 안(ul)으로
    const t = document.createElement('template'); t.innerHTML = mhtml; const m = t.content.querySelector('.mindmap'); if (!m) return;
    [...b.childNodes].forEach(n => { if (!(n.nodeType === 1 && /(^| )jxm-/.test(n.className || ''))) n.remove(); });
    const first = b.firstChild;
    [...m.childNodes].forEach(n => b.insertBefore(n, first));
    b.dataset.layout = m.dataset.layout || 'map';
  }
  function newBlockEl(mhtml, h, list) {
    const b = document.createElement('div'); b.className = 'mindmap';
    const t = document.createElement('template'); t.innerHTML = mhtml; const m = t.content.querySelector('.mindmap');
    b.dataset.layout = (m && m.dataset.layout) || 'map'; b.dataset.h = String(h || H0); if (list) b.dataset.list = list;
    if (m) [...m.childNodes].forEach(n => b.appendChild(n));
    return b;
  }

  /* ================================================================ 마인드맵 블록 그림·편집 */
  let active = null, chT = null;
  function hOf(b) { const h = parseInt(b.dataset.h, 10); return Math.max(HMIN, Math.min(HMAX, isFinite(h) ? h : H0)); }
  function ui(b) {
    b.setAttribute('contenteditable', 'false');
    let v = b.querySelector(':scope > .jxm-view');
    if (!v) {
      b.insertAdjacentHTML('beforeend', `<div class="jxm-bar"><span class="jxm-tag">마인드맵</span><span class="jxm-g"></span>`
        + `<button type="button" data-jx="done" class="jxm-done" title="편집 끝 (블록 밖을 눌러도 돼요)">완료</button>`
        + `<button type="button" data-jx="tolist" title="이 지도를 목록 블록으로 (Xmind 개요처럼 — 글자 그대로)">목록으로 바꾸기</button>`
        + `<button type="button" data-jx="big" title="화면 가득 크게 열어 고치기">크게 열기</button></div>`
        + `<div class="jxm-view"></div><div class="jxm-grip" title="끌어서 높이 조절" role="separator" aria-label="높이 조절"></div>`);
      v = b.querySelector(':scope > .jxm-view');
    }
    v.style.height = hOf(b) + 'px';
    return v;
  }
  function paint(b) {
    const v = ui(b); if (b === active) return;
    v.innerHTML = '<div class="mm jxm-mm"><div class="jxm-area"></div><div class="jxm-hint">누르면 여기서 바로 고쳐요</div></div>';
    const a = v.querySelector('.jxm-area'), w = v.clientWidth || 600, h = hOf(b);
    a.style.width = w + 'px'; a.style.height = h + 'px';
    try { window.Mind.draw(a, blockHtml(b), w, h - 8); } catch (e) { a.textContent = '지도를 못 그렸어요: ' + e.message; }
  }
  function paintAll() { const e = ed(); if (!e) return; e.querySelectorAll('.mindmap').forEach(paint); }
  function activate(b) {
    if (active === b) return;
    deactivate();
    if (!window.Mind) return;
    if (window.Mind.on()) return say('다른 마인드맵을 고치는 중이에요');
    active = b; b.classList.add('jxm-on');
    const v = ui(b); v.innerHTML = '';
    window.Mind.mount(v, blockHtml(b), { mode: 'map', onChange: () => { clearTimeout(chT); chT = setTimeout(flushActive, 250); dirty(); } });
    setTimeout(() => { try { window.Mind.focus(); } catch (e) {} }, 30);
  }
  function flushActive() {
    clearTimeout(chT);
    if (!active || !window.Mind || !window.Mind.on()) return;
    try { writeMind(active, window.Mind.html()); } catch (e) {}
  }
  function deactivate() {
    if (!active) return;
    const b = active; flushActive();
    try { window.Mind.unmount(); } catch (e) {}
    active = null; b.classList.remove('jxm-on');
    if (b.isConnected) paint(b);
  }
  function openBig(b) {
    deactivate();
    const d = document.createElement('div'); d.className = 'jxm-big';
    d.innerHTML = '<div class="jxm-bighead"><b>마인드맵 블록 크게 보기</b><span class="jxm-g"></span><button type="button" class="btn primary">닫기</button></div><div class="jxm-bighost"></div>';
    document.body.appendChild(d);
    window.Mind.mount(d.querySelector('.jxm-bighost'), blockHtml(b), { mode: 'map', onChange: () => { try { writeMind(b, window.Mind.html()); } catch (e) {} dirty(); } });
    const close = () => { try { writeMind(b, window.Mind.html()); window.Mind.unmount(); } catch (e) {} d.remove(); paint(b); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape' && !document.querySelector('.mm-pop:not([hidden])') && !(window.Mind._M() || {}).editing) { e.preventDefault(); close(); } };
    d.querySelector('.btn').onclick = close; document.addEventListener('keydown', esc, true);
    setTimeout(() => { try { window.Mind.focus(); } catch (e) {} }, 30);
  }
  // 높이 손잡이
  let grip = null;
  document.addEventListener('pointerdown', e => {
    const g = e.target.closest && e.target.closest('.jxm-grip'); if (!g) return;
    const b = g.closest('.mindmap'); e.preventDefault();
    grip = { b, y: e.clientY, h: hOf(b), id: e.pointerId }; try { g.setPointerCapture(e.pointerId); } catch (er) {}
  });
  document.addEventListener('pointermove', e => {
    if (!grip) return; const h = Math.round(Math.max(HMIN, Math.min(HMAX, grip.h + e.clientY - grip.y)));
    grip.b.dataset.h = String(h); const v = grip.b.querySelector(':scope > .jxm-view'); if (v) v.style.height = h + 'px';
  });
  document.addEventListener('pointerup', () => { if (!grip) return; const b = grip.b; grip = null; if (b !== active) paint(b); dirty(); });
  // 누르기: 블록 그림 → 편집 / 블록 밖 → 편집 끝
  document.addEventListener('pointerdown', e => {
    if (!isOn()) return;
    const b = e.target.closest && e.target.closest('#ed .mindmap');
    if (active && b !== active && !(e.target.closest && e.target.closest('.mm-pop,.jxm-big,.jxmenu'))) deactivate();
    if (b && e.target.closest('.jxm-view') && b !== active) { e.preventDefault(); activate(b); }
  }, true);
  document.addEventListener('click', e => {
    const x = e.target.closest && e.target.closest('.jxm-bar [data-jx]'); if (!x) return;
    const b = x.closest('.mindmap'); e.preventDefault();
    if (x.dataset.jx === 'done') deactivate();
    else if (x.dataset.jx === 'big') openBig(b);
    else if (x.dataset.jx === 'tolist') toList(b);
  });

  /* ================================================================ 되돌리기 (바꾸기·지우기·옮기기 한 단계) */
  let undoRec = null;
  function remember(label, before, after, parent, next) { undoRec = { label, before, after, parent, next }; showUndo(label); }
  function showUndo(label) {
    let s = document.querySelector('.jxundo');
    if (!s) { s = document.createElement('div'); s.className = 'jxundo'; s.innerHTML = '<span></span><button type="button">되돌리기</button>'; document.body.appendChild(s); s.querySelector('button').onclick = () => undoAny(); }
    s.querySelector('span').textContent = label; s.hidden = false; clearTimeout(s._t); s._t = setTimeout(() => { s.hidden = true; }, 9000);
  }
  function undo() {
    const u = undoRec; if (!u) return false; undoRec = null;
    deactivate();
    const s = document.querySelector('.jxundo'); if (s) s.hidden = true;
    const e = ed(); if (!e) return false;
    const ref = u.after.find(x => x.isConnected) || null;
    const where = ref || (u.next && u.next.isConnected ? u.next : null);
    u.before.forEach(x => { if (where) where.before(x); else e.appendChild(x); });
    u.after.forEach(x => x.remove());
    paintAll(); dirty(); try { placeMoves(); } catch (er) {}
    say('되돌렸어요'); return true;
  }

  /* ================================================================ 목록 ↔ 마인드맵 (Xmind 개요↔지도) */
  function listKind(L) { return L.tagName === 'OL' ? 'ol' : L.classList.contains('todo') ? 'todo' : 'ul'; }
  function toMind(L) {
    if (!L || !/^(UL|OL)$/.test(L.tagName) || L.parentNode !== ed()) return say('맨 바깥 목록에서 바꿀 수 있어요');
    if (L.querySelector('.cmt')) return say('댓글이 달린 목록은 바꾸지 않아요(댓글이 사라져요). 댓글을 먼저 해결해 주세요', 5000);
    const f = window.Mind.forestFromHtml(L.outerHTML);
    const kind = listKind(L);
    const mh = window.Mind.serialize({ layout: 'right', root: window.Mind.topic('', f.length ? f : [window.Mind.topic('')]) });
    const b = newBlockEl(mh, Math.min(HMAX, Math.max(H0, 90 + 34 * L.querySelectorAll('li').length)), kind);
    if (flat(L.innerHTML) !== flat(b.innerHTML)) return say('글자가 달라져서 바꾸지 않았어요');
    const next = L.nextSibling; L.replaceWith(b); paint(b);
    remember('목록을 마인드맵으로 바꿨어요', [L], [b], b.parentNode, next); dirty();
  }
  function liOf(n, kind) {
    let a = '';
    if (n.todo === 1 && kind === 'todo') a += ' class="done"';
    if (n.todo != null && kind !== 'todo') a += ` data-todo="${n.todo}"`;
    if (n.color) a += ` data-color="${n.color}"`;
    if (n.collapsed && n.kids.length) a += ' data-collapsed="1"';
    if (n.b) a += ' data-b="1"';
    if (n.hl) a += ' data-hl="1"';
    if (n.note) a += ` data-note="${String(n.note).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`;
    const sub = n.kids.length ? listOf(n.kids, n.num ? 'ol' : n.kids.some(k => k.todo != null) && kind === 'todo' ? 'todo' : 'ul') : '';
    return `<li${a}>${n.text || '<br>'}${sub}</li>`;
  }
  function listOf(ns, kind) { const tag = kind === 'ol' ? 'ol' : 'ul'; return `<${tag}${kind === 'todo' ? ' class="todo"' : ''}>${ns.map(n => liOf(n, kind)).join('')}</${tag}>`; }
  function toList(b) {
    deactivate();
    const st = window.Mind.parse(blockHtml(b));
    const kind = b.dataset.list || (st.root.kids.every(n => n.todo != null) ? 'todo' : 'ul');
    const t = document.createElement('template'); t.innerHTML = listOf(st.root.kids, kind);
    const L = t.content.firstElementChild;
    if (flat(L.innerHTML) !== flat(cleanClone(wrapOne(b)).innerHTML)) return say('글자가 달라져서 바꾸지 않았어요');
    const next = b.nextSibling; b.replaceWith(L);
    remember('마인드맵을 목록으로 바꿨어요', [b], [L], L.parentNode, next); dirty();
  }

  /* ================================================================ 블록 넣기 공통 */
  const TOP = n => { const e = ed(); let x = n && (n.nodeType === 1 ? n : n.parentElement); while (x && x.parentNode !== e) x = x.parentNode; return x && x.parentNode === e ? x : null; };
  function insertMindAfter(ref, replaceEmpty) {
    const e = ed();
    const mh = window.Mind.serialize({ layout: 'map', root: window.Mind.topic('', [window.Mind.topic('중심 주제')]) });
    const b = newBlockEl(mh, H0);
    const p = document.createElement('p'); p.innerHTML = '<br>';
    if (ref && replaceEmpty) { ref.replaceWith(b); b.after(p); }
    else if (ref) { ref.after(b); b.after(p); }
    else { e.append(b, p); }
    paint(b); dirty();
    setTimeout(() => activate(b), 20);
    return b;
  }
  function insertHrAfter(ref, replaceEmpty) {
    const hr = document.createElement('hr'), p = document.createElement('p'); p.innerHTML = '<br>';
    if (replaceEmpty) { ref.replaceWith(hr); hr.after(p); } else { ref.after(hr); hr.after(p); }
    try { caretIn(p); } catch (er) {}
    dirty();
  }

  /* ================================================================ 「/」 슬래시 메뉴 (Notion·AFFiNE) */
  const ITEMS = [
    { k: 'h2', t: '큰 제목', d: 'PDF에서 새 쪽', kw: '큰제목 제목 heading h1 #' },
    { k: 'h3', t: '소제목', d: '구역 안 작은 제목', kw: '소제목 heading h2 h3 ##' },
    { k: 'p', t: '본문', d: '보통 글', kw: '본문 글 문단 text paragraph' },
    { k: 'ul', t: '목록', d: '글머리 목록', kw: '목록 글머리 bullet list' },
    { k: 'ol', t: '번호', d: '1. 2. 번호 카드', kw: '번호 numbered list' },
    { k: 'todo', t: '체크', d: '할 일 네모', kw: '체크 할일 todo checkbox' },
    { k: 'quote', t: '핵심 상자', d: 'PDF 「핵심」 검은 상자', kw: '핵심 상자 quote callout' },
    { k: 'hr', t: '구분선', d: '가로 점선', kw: '구분선 divider line' },
    { k: 'mind', t: '마인드맵', d: '글 사이에 지도', kw: '마인드맵 지도 mindmap map' },
  ];
  if (window.JXP) window.JXP.PATS.forEach(p => ITEMS.push({ k: 'pt:' + p.id, t: p.t, d: '패턴 · ' + p.d, kw: p.kw + ' 패턴 벽보' }));   // 11/21 벽보 패턴 10개 (빈 틀로 들어감)
  let sm = null;   // {node, off(= '/' 바로 뒤), el, i, list}
  function smItems(q) { q = (q || '').toLowerCase().replace(/\s+/g, ''); return q ? ITEMS.filter(x => (x.t + x.kw).toLowerCase().replace(/\s+/g, '').includes(q)) : ITEMS; }
  function smQuery() {
    const s = getSelection(); if (!sm || !s.rangeCount) return null;
    const r = s.getRangeAt(0); if (!sm.node.isConnected) return null;
    const pre = document.createRange();
    try { pre.setStart(sm.node, sm.off - 1); pre.setEnd(r.endContainer, r.endOffset); } catch (e) { return null; }
    const tx = pre.toString(); if (!tx.startsWith('/') || /\n/.test(tx) || tx.length > 20) return null;
    return tx.slice(1);
  }
  function smRender() {
    const q = smQuery(); if (q == null) return smClose();
    const list = smItems(q); sm.list = list; if (sm.i >= list.length) sm.i = 0;
    if (!list.length && q.length > 1 && /\s$/.test(q)) return smClose();
    sm.el.innerHTML = '<div class="jxsm-h">블록 넣기</div>' + (list.length ? list.map((x, i) => `<button type="button" class="jxsm-i${i === sm.i ? ' on' : ''}" data-i="${i}"><b>${x.t}</b><small>${x.d}</small></button>`).join('') : '<div class="jxsm-no">없어요</div>');
    const s = getSelection(), rr = s.rangeCount ? s.getRangeAt(0).getClientRects() : [];
    const rc = rr[rr.length - 1] || (s.rangeCount && s.getRangeAt(0).startContainer.parentElement || document.body).getBoundingClientRect();
    sm.el.hidden = false;
    const h = sm.el.offsetHeight, w = sm.el.offsetWidth;
    let y = rc.bottom + 6; if (y + h > innerHeight - 8) y = Math.max(8, rc.top - h - 6);
    sm.el.style.left = Math.max(8, Math.min(innerWidth - w - 8, rc.left)) + 'px'; sm.el.style.top = y + 'px';
    const on = sm.el.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function smClose() { if (sm && sm.el) sm.el.hidden = true; sm = null; }
  function smOpen(node, off) {
    let el = document.querySelector('.jxsm');
    if (!el) {
      el = document.createElement('div'); el.className = 'jxsm'; el.hidden = true; document.body.appendChild(el);
      el.addEventListener('mousedown', e => e.preventDefault());
      el.addEventListener('click', e => { const b = e.target.closest('.jxsm-i'); if (b && sm) { sm.i = +b.dataset.i; smPick(); } });
    }
    sm = { node, off, el, i: 0, list: ITEMS }; smRender();
  }
  function smPick() {
    const x = sm && sm.list[sm.i]; if (!x) return smClose();
    const s = getSelection(), r = s.getRangeAt(0), del = document.createRange();
    del.setStart(sm.node, sm.off - 1); del.setEnd(r.endContainer, r.endOffset);
    smClose();
    s.removeAllRanges(); s.addRange(del);
    try { gBusy = true; document.execCommand('delete'); } finally { gBusy = false; }
    apply(x.k);
  }
  function apply(k) {   // 지금 커서 줄에 블록 적용 (AFFiNE: 글 줄은 그 줄을 바꾸고, 구분선·마인드맵은 아래에 새 블록)
    const s = getSelection(); const n = s.rangeCount && s.getRangeAt(0).startContainer;
    let leaf = null; try { leaf = leafOf(n); } catch (e) {}
    const top = TOP(n);
    const empty = leaf && !leaf.textContent.replace(/​/g, '').trim() && leaf.tagName === 'P' && leaf.parentNode === ed();
    if (k === 'mind') return insertMindAfter(top, !!empty);
    if (k.startsWith('pt:')) { if (window.JXP && window.JXP.selIn()) return say('패턴 블록 안에서는 넣을 수 없어요 — 블록 아래 줄에서 넣어 주세요'); return window.JXP.insert(k.slice(3), top, !!empty); }
    if (k === 'hr') { if (top) insertHrAfter(top, !!empty); else { try { runCmd('hr'); } catch (e) {} } return; }
    try { runCmd(k); } catch (e) {}
  }
  document.addEventListener('input', e => {
    if (!isOn() || !e.target.closest || e.target !== ed() || inMind(e.target)) return;
    if (e.inputType === 'insertText' && e.data && e.data.includes('/') && !sm) {   // 「/」 (붙여 친 「/큰」 꼴도)
      const s = getSelection(); if (!s.rangeCount) return;
      const r = s.getRangeAt(0); if (r.startContainer.nodeType !== 3 || inMind(r.startContainer.parentElement)) return;
      const off = r.startOffset - (e.data.length - e.data.lastIndexOf('/') - 1);
      if (off < 1 || r.startContainer.data[off - 1] !== '/') return;
      return smOpen(r.startContainer, off);
    }
    if (sm) smRender();
  });
  document.addEventListener('compositionend', () => { if (sm) setTimeout(() => sm && smRender(), 0); });
  document.addEventListener('keydown', e => {
    if (!sm || sm.el.hidden) return;
    if (e.isComposing && e.key !== 'Escape') return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); const n = sm.list.length || 1; sm.i = (sm.i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; smRender(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { if (!sm.list.length) return smClose(); e.preventDefault(); e.stopPropagation(); smPick(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); smClose(); }
  }, true);
  document.addEventListener('selectionchange', () => { if (sm) { clearTimeout(smRender._t); smRender._t = setTimeout(() => { if (sm && smQuery() == null) smClose(); }, 80); } });
  document.addEventListener('mousedown', e => { if (sm && !(e.target.closest && e.target.closest('.jxsm'))) smClose(); });

  /* ================================================================ ⋮⋮ 블록 손잡이 (Notion) */
  let hd = null, hb = null, drag = null, menu = null;
  function handle() {
    const pa = document.querySelector('.paper'); if (!pa) return null;
    if (!hd || !pa.contains(hd)) {
      hd = document.createElement('button'); hd.type = 'button'; hd.className = 'jxh'; hd.title = '끌어서 옮기기 · 누르면 블록 메뉴'; hd.setAttribute('aria-label', '블록 손잡이');
      hd.innerHTML = '<svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg>';
      hd.hidden = true; hd.tabIndex = -1; pa.appendChild(hd);
      hd.addEventListener('pointerdown', hDown);
    }
    return hd;
  }
  function blockAtY(y) { const e = ed(); if (!e) return null; for (const k of e.children) { const r = k.getBoundingClientRect(); if (y >= r.top - 4 && y <= r.bottom + 4) return k; } return null; }
  function placeHandle(b) {
    const h = handle(); if (!h) return;
    if (!b || drag) { if (!drag) h.hidden = true; hb = drag ? hb : null; return; }
    hb = b; const pa = document.querySelector('.paper'), pr = pa.getBoundingClientRect(), r = b.getBoundingClientRect();
    const lh = b.tagName === 'HR' ? r.height : Math.min(r.height, parseFloat(getComputedStyle(b.tagName === 'UL' || b.tagName === 'OL' ? (b.querySelector('li') || b) : b).lineHeight) || 28);
    h.hidden = false; h.style.top = (r.top - pr.top + Math.max(0, (lh - 24) / 2)) + 'px';
  }
  document.addEventListener('mousemove', e => {
    if (!isOn() || coarse() || drag || menu) return;
    const pa = document.querySelector('.paper'); if (!pa) return;
    const r = pa.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return placeHandle(null);
    if (e.target.closest && e.target.closest('.jxh')) return;
    placeHandle(blockAtY(e.clientY));
  });
  document.addEventListener('selectionchange', () => {   // 폰(터치)은 마우스가 없어 커서 줄에 손잡이
    if (!isOn() || !coarse() || drag || menu) return;
    const s = getSelection(); const n = s.rangeCount && s.anchorNode; const e = ed();
    if (!n || !e || !e.contains(n)) return; placeHandle(TOP(n));
  });
  function dropSpot(y) {
    const e = ed(), ks = [...e.children].filter(k => k !== hb);
    for (const k of ks) { const r = k.getBoundingClientRect(); if (y < r.top + r.height / 2) return { before: k, y: r.top }; }
    const last = ks[ks.length - 1]; return { before: null, y: last ? last.getBoundingClientRect().bottom : 0 };
  }
  function hDown(e) {
    if (!hb) return; e.preventDefault();
    drag = { b: hb, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    try { hd.setPointerCapture(e.pointerId); } catch (er) {}
    hd.addEventListener('pointermove', hMove); hd.addEventListener('pointerup', hUp); hd.addEventListener('pointercancel', hUp);
  }
  function hMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 5) return;
    if (!drag.moved) { drag.moved = true; deactivate(); drag.b.classList.add('jxdragging'); }
    let ln = document.querySelector('.jxdrop'); if (!ln) { ln = document.createElement('div'); ln.className = 'jxdrop'; document.querySelector('.paper').appendChild(ln); }
    const sp = dropSpot(e.clientY), pr = document.querySelector('.paper').getBoundingClientRect(), er = ed().getBoundingClientRect();
    drag.spot = sp; ln.style.top = (sp.y - pr.top - 2) + 'px'; ln.style.left = (er.left - pr.left) + 'px'; ln.style.width = er.width + 'px';
    const sc = document.getElementById('scroll'); if (sc) { const r = sc.getBoundingClientRect(); if (e.clientY < r.top + 40) sc.scrollTop -= 14; else if (e.clientY > r.bottom - 40) sc.scrollTop += 14; }
  }
  function hUp() {
    hd.removeEventListener('pointermove', hMove); hd.removeEventListener('pointerup', hUp); hd.removeEventListener('pointercancel', hUp);
    const d = drag; drag = null; const ln = document.querySelector('.jxdrop'); if (ln) ln.remove();
    if (!d) return; d.b.classList.remove('jxdragging'); if (!d.b.getAttribute('class')) d.b.removeAttribute('class');
    if (!d.moved) return openMenu(d.b);
    const sp = d.spot; if (!sp || sp.before === d.b || sp.before === d.b.nextElementSibling && sp.before) { placeHandle(d.b); return; }
    const next = d.b.nextSibling;
    if (sp.before) sp.before.before(d.b); else ed().appendChild(d.b);
    remember('블록을 옮겼어요', [], [], null, null); undoRec = { label: '옮김', move: { b: d.b, next } };
    if (d.b.animate) d.b.animate([{ background: 'rgba(61,101,133,.15)' }, { background: 'transparent' }], { duration: 900 });
    dirty(); try { placeMoves(); } catch (er) {} placeHandle(d.b);
  }
  const _undo = undo;
  function undoAny() { const u = undoRec; if (u && u.move) { undoRec = null; const s = document.querySelector('.jxundo'); if (s) s.hidden = true; if (u.move.next && u.move.next.isConnected) u.move.next.before(u.move.b); else ed().appendChild(u.move.b); dirty(); try { placeMoves(); } catch (e) {} say('되돌렸어요'); return true; } return _undo(); }
  function openMenu(b) {
    closeMenu();
    const isList = /^(UL|OL)$/.test(b.tagName), isMind = b.classList.contains('mindmap'), isText = /^(P|H2|H3|BLOCKQUOTE)$/.test(b.tagName) || isList;
    const isPt = b.classList.contains('pt-blk-wrap') && !!window.JXP;
    menu = document.createElement('div'); menu.className = 'jxmenu';
    const it = (a, t, d = '') => `<button type="button" data-m="${a}"><b>${t}</b>${d ? `<small>${d}</small>` : ''}</button>`;
    menu.innerHTML = (isText ? '<div class="jxsm-h">바꾸기</div>' + ['p:본문', 'h2:큰 제목', 'h3:소제목', 'ul:목록', 'ol:번호', 'todo:체크', 'quote:핵심 상자'].map(x => { const [k, t] = x.split(':'); return it('to:' + k, t); }).join('') + '<hr>' : '')
      + (isList ? it('tomind', '마인드맵으로 바꾸기', '목록 단계 그대로 지도로') + (window.JXP ? it('ptmake', '패턴 모양으로', '목록 줄이 벽보 칸으로') : '') : '')
      + (isPt ? '<div class="jxsm-h">패턴 블록</div>' + it('ptshape', '다른 모양으로 바꾸기', '같은 글로 다른 패턴') + it('ptflat', '줄글로 풀기', '글자 그대로 본문·목록으로') + '<hr>' : '')
      + (isMind ? it('tolist', '목록으로 바꾸기', '지도를 들여쓰기 목록으로') + it('big', '크게 열기') : '')
      + it('dup', '복제') + it('del', '지우기') + (undoRec ? '<hr>' + it('undo', '되돌리기', undoRec.label || '') : '');
    document.body.appendChild(menu);
    const r = hd.getBoundingClientRect(), h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.right + 6)) + 'px';
    menu.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.top)) + 'px';
    menu._b = b;
    menu.addEventListener('mousedown', e => e.preventDefault());
    menu.addEventListener('click', e => { const x = e.target.closest('[data-m]'); if (x) doMenu(menu._b, x.dataset.m); });
  }
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openShapes(b, m) {   // 11/21 「다른 모양으로 바꾸기」 — 패턴 10개 중 고르기
    const r0 = hd && hd.getBoundingClientRect(); closeMenu();
    const curId = b.dataset && b.dataset.pt;
    menu = document.createElement('div'); menu.className = 'jxmenu';
    menu.innerHTML = '<div class="jxsm-h">' + (m === 'ptmake' ? '목록을 이 모양으로' : '이 모양으로 바꾸기 (글자 그대로)') + '</div>'
      + window.JXP.PATS.filter(p => p.id !== curId).map(p => `<button type="button" data-m="pt:${p.id}"><b>${p.t}</b><small>${p.d}</small></button>`).join('');
    document.body.appendChild(menu);
    const h = menu.offsetHeight, r = r0 || { right: 60, top: 80 };
    menu.style.left = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.right + 6)) + 'px';
    menu.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.top)) + 'px';
    menu._b = b;
    menu.addEventListener('mousedown', e => e.preventDefault());
    menu.addEventListener('click', e => { const x = e.target.closest('[data-m]'); if (x) doMenu(menu._b, x.dataset.m); });
  }
  document.addEventListener('pointerdown', e => { if (menu && !(e.target.closest && e.target.closest('.jxmenu,.jxh'))) closeMenu(); });
  document.addEventListener('keydown', e => { if (menu && e.key === 'Escape') { e.preventDefault(); closeMenu(); } });
  function selectBlock(b) {
    const r = document.createRange(); r.selectNodeContents(b); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed().focus({ preventScroll: true });
  }
  function doMenu(b, m) {
    closeMenu();
    if (m.startsWith('to:')) { selectBlock(b); try { runCmd(m.slice(3)); } catch (e) {} getSelection().collapseToEnd(); return; }
    if (m === 'tomind') return toMind(b);
    if (m === 'ptshape' || m === 'ptmake') return openShapes(b, m);
    if (m === 'ptflat') { const n = window.JXP.unpack(b); if (n) placeHandle(null); return; }
    if (m.startsWith('pt:')) { const n = b.classList.contains('pt-blk-wrap') ? window.JXP.convert(b, m.slice(3)) : window.JXP.fromList(b, m.slice(3)); if (n) placeHandle(null); return; }
    if (m === 'tolist') return toList(b);
    if (m === 'big') return openBig(b);
    if (m === 'undo') return undoAny();
    if (m === 'dup') { deactivate(); const k = cleanClone(wrapOne(b)).firstElementChild; b.after(k); if (k.classList.contains('mindmap')) paint(k); remember('블록을 복제했어요', [], [k], null, null); dirty(); return; }
    if (m === 'del') { if (b === active) deactivate(); const next = b.nextSibling; b.remove(); placeHandle(null); remember('블록을 지웠어요', [b], [], null, next); dirty(); try { placeMoves(); } catch (e) {} return; }
  }
  // ⌘Z: 방금 한 블록 바꾸기·지우기·옮기기가 있으면 그것부터 (그 뒤에 글을 치면 브라우저 되돌리기로)
  document.addEventListener('keydown', e => {
    if (!isOn() || !undoRec) return;
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.code === 'KeyZ' && !(window.Mind && window.Mind.on())) { e.preventDefault(); e.stopPropagation(); undoAny(); }
  }, true);
  document.addEventListener('input', e => { if (undoRec && e.target === ed()) { undoRec = null; const s = document.querySelector('.jxundo'); if (s) s.hidden = true; } });

  /* ================================================================ 「지도로 보기」 문서 전체 (Xmind 개요↔지도, 읽기) */
  function docForest() {
    const e = ed(), M = window.Mind; const out = []; let h2 = null, h3 = null;
    const T = (el, kids) => { const n = M.topic(M.clean(el.innerHTML), kids || []); n.ref = el; return n; };
    const fromLi = li => {
      const box = li.cloneNode(true); box.querySelectorAll(':scope > ul, :scope > ol').forEach(x => x.remove());
      const n = M.topic(M.clean(box.innerHTML)); n.ref = li;
      for (const L of li.children) if (/^(UL|OL)$/.test(L.tagName)) for (const k of L.children) if (k.tagName === 'LI') n.kids.push(fromLi(k));
      return n;
    };
    for (const c of e.children) {
      if (c.tagName === 'H2') { h2 = T(c); h3 = null; out.push(h2); }
      else if (c.tagName === 'H3') { h3 = T(c); (h2 ? h2.kids : out).push(h3); }
      else if (/^(UL|OL)$/.test(c.tagName)) { for (const li of c.children) if (li.tagName === 'LI') (h3 || h2 ? (h3 || h2).kids : out).push(fromLi(li)); }
    }
    return out;
  }
  function openDocMap() {
    if (!isOn()) return;
    deactivate();
    const f = docForest();
    if (!f.length) return say('큰 제목·소제목·목록이 아직 없어요');
    const title = (document.getElementById('title') || {}).value || '제목 없음';
    const c = window.Mind.topic(title.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])), f);
    const st = { layout: 'right', root: window.Mind.topic('', [c]) };
    const d = document.createElement('div'); d.className = 'jxmap';
    d.innerHTML = '<div class="jxmap-head"><b>지도로 보기</b><span>큰 제목 → 소제목 → 목록 줄 · 가지를 누르면 문서의 그 자리로</span><span class="jxm-g"></span><button type="button" class="btn primary">닫기</button></div><div class="jxmap-body"><div class="mm jxm-mm jxmap-mm"><div class="jxm-area"></div></div></div>';
    document.body.appendChild(d);
    const body = d.querySelector('.jxmap-body'), a = d.querySelector('.jxm-area'), w = Math.max(320, body.clientWidth - 24);
    a.style.width = w + 'px';
    const els = []; window.Mind.draw(a, st, w, 0, { natural: true, cap: 1, els });
    d.querySelector('.jxmap-mm').style.height = a.style.height;
    for (const [n, el] of els) if (n.ref) { el.classList.add('jxmap-go'); el.title = '문서의 이 자리로'; el.addEventListener('click', () => go(n.ref)); }
    const close = () => { d.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    const go = el => { close(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (el.animate) el.animate([{ background: 'rgba(246,216,96,.7)' }, { background: 'transparent' }], { duration: 1600 }); };
    d.querySelector('.btn').onclick = close; document.addEventListener('keydown', esc, true);
  }

  /* ================================================================ 편집기에 붙이기 */
  function attach() {   // show()·loadEd() 뒤에 부름
    deactivate(); smClose(); closeMenu(); hd = null;
    const e = ed(); if (!e) return;
    document.querySelectorAll('.jxtool').forEach(x => { x.hidden = !isOn(); });
    if (!isOn()) return;
    if (window.JXP) window.JXP.attach(e);   // 11/21 패턴 블록: 칸마다 바로 고치기
    e.querySelectorAll('.mindmap').forEach(b => ui(b));
    requestAnimationFrame(paintAll);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!active) paintAll(); });
  }
  let rzT; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (isOn() && !active) paintAll(); }, 200); });

  window.JXB = { ON, html, attach, paintAll, deactivate, flush: flushActive, openDocMap, toMind, toList, insertMindAfter, inMind, cleanClone, undo: undoAny, remember, _active: () => active };
})();
