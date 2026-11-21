/* 지식 작업실 「패턴 블록」 (11/21) — editor.html(맥·폰 공용)이 부른다. 공략집·정리본 글 안의 벽보 2-C형 패턴(패턴집/patterns.json 10개)을
   편집 화면에서도 PDF와 같은 모양 그대로(WYSIWYG) 보이고, 안의 글자를 바로 고친다.
   저장 모양(원본 html, 사람이 읽음): <div class="pt-blk-wrap" data-pt="steps|flow|blocks|formula|quote|check|tree|matrix|warn|boxes"> …patterns.css 의 pt- 틀… </div>
     (화면에서만 블록 contenteditable="false" · 칸마다 contenteditable="true"·data-ph · 빈 선택 칸 data-opt 가 붙고, 저장할 때 걷는다 — clean())
   편집 관례(창작 금지 — 따른 앱):
     · 칸 안 글 고치기 = Notion 데이터베이스 칸·콜아웃(블록 안 칸마다 따로 고침, 칸 밖으로 글이 새지 않음)
     · Enter = 같은 모양 새 항목 / 빈 항목에서 Enter = 목록 밖으로(아래 본문 줄) / 빈 항목에서 Backspace = 그 항목 지움 / Shift+Enter = 칸 안 줄바꿈 (Notion 목록 블록)
     · Tab·⇧Tab = 한 단계 안으로·밖으로 (Notion 들여쓰기: 계층은 가지 단계, 단계 줄 ↔ 작은 설명) · 단계가 없는 칸에서는 다음·앞 칸으로 (Notion 데이터베이스 표 Tab)
     · ↑↓ 칸 끝에서 = 앞·뒤 칸, 블록 끝이면 블록 밖 줄로 (Notion 블록 사이 화살표)
     · 빈 블록에서 Backspace = 블록 지움 (Notion 빈 블록)
     · 빨강 = 글자를 골라 ⌘⇧E 또는 도구줄 「빨강」 (형광펜 ⌘⇧H 와 같은 방식 — 감싸기/다시 누르면 풀기)
   모양 바꾸기·줄글로 풀기·「/」 패턴 넣기는 blocks.js 메뉴가 이 파일(window.JXP)을 부른다. */
(function () {
  'use strict';
  const PATS = [
    { id: 'steps', t: '단계', d: '세로 타임라인 · 순서대로', kw: '단계 순서 타임라인 steps 스텝 절차' },
    { id: 'flow', t: '가로 흐름', d: 'A → B → C', kw: '가로 흐름 프로세스 flow 화살표 순서' },
    { id: 'blocks', t: '원칙 카드', d: '순서 없는 나열', kw: '원칙 카드 나열 blocks 지킬것' },
    { id: 'formula', t: '공식', d: 'A = B × C', kw: '공식 수식 곱셈 formula 방정식' },
    { id: 'quote', t: '핵심 한 문장', d: '벽에 붙일 한 줄', kw: '핵심 한문장 한 문장 인용 결론 quote 제1원칙' },
    { id: 'check', t: '체크리스트', d: '하나씩 짚을 항목', kw: '체크리스트 확인 점검 진단 check' },
    { id: 'tree', t: '계층', d: '큰 개념 → 하위 가지', kw: '계층 트리 가지 종류 유형 tree' },
    { id: 'matrix', t: '2×2 표', d: '두 기준 네 칸', kw: '표 2x2 2×2 행렬 매트릭스 matrix 네칸' },
    { id: 'warn', t: '경고', d: '하지 말 것 · 주의', kw: '경고 주의 금지 함정 warn' },
    { id: 'boxes', t: '원리·행동·결과', d: '같은 칸 이름 반복', kw: '원리 행동 결과 칸 boxes' },
  ];
  const IDS = PATS.map(p => p.id);
  const PH = { 'pt-t': '제목 (비우면 안 나와요)', 'pt-desc': '작은 설명 (비우면 안 나와요)', 'pt-lab': '', 'pt-tx': '단계 한 줄', 'pt-bul': '작은 설명',
    'pt-true': '빨간 강조 (비우면 안 나와요)', 'pt-chev': '칸', 'pt-blk': '원칙 한 줄', 'pt-fn': '공식 이름', 'pt-fx': '요소', 'pt-fk': '요소', 'pt-fv': '뜻',
    'pt-ql': '라벨 (비우면 안 나와요)', 'pt-qt': '한 문장', 'pt-root': '큰 개념', 'pt-tn': '하위', 'pt-mq': '경우', 'pt-mv': '이름', 'pt-wt': '하면 안 되는 것',
    'pt-bk': '칸 이름', 'pt-bv': '내용', ck: '확인할 것' };
  const FIELD = '.pt-t,.pt-desc,.pt-lab,.pt-tx,.pt-bul,.pt-true,.pt-chev,.pt-blk,.pt-fn,.pt-fx,.pt-fk,.pt-fv,.pt-ql,.pt-qt,.pt-check>li>span,.pt-root,.pt-tn,.pt-mq,.pt-mv,.pt-wt,.pt-bk,.pt-bv';
  const W = '.pt-blk-wrap';
  const ed = () => document.getElementById('ed');
  const say = (t, ms) => (typeof window.toast === 'function' ? window.toast(t, ms) : console.log(t));
  const dirty = () => { try { markDirty(); } catch (e) {} };
  const isOn = () => { try { return !!(window.JXB && cur && JXB.ON(cur.c) && ed()); } catch (e) { return false; } };
  const elOf = n => n && (n.nodeType === 1 ? n : n.parentElement);
  const wrapOf = n => { const e = elOf(n); const w = e && e.closest && e.closest(W); return w && ed() && ed().contains(w) ? w : null; };
  const isField = f => !!(f && f.nodeType === 1 && f.matches(FIELD) && f.closest(W));
  function fieldOf(n) { let e = elOf(n); while (e && e !== document.body) { if (e.matches && e.matches(FIELD) && e.closest(W)) return e; if (e.matches && e.matches(W)) return null; e = e.parentElement; } return null; }
  const H = s => String(s == null ? '' : s);
  const empty = f => !f || !f.textContent.replace(/[\s​ ]/g, '').replace(/^·/, '');
  const fieldsOf = w => [...w.querySelectorAll(FIELD)];
  const shown = f => f.getClientRects().length > 0;
  const mk = h => { const t = document.createElement('template'); t.innerHTML = h; return t.content; };
  const one = h => mk(h).firstElementChild;

  /* ================================================================ 화면 붙이기 / 저장 모양 */
  function phOf(f) { if (f.matches('.pt-check>li>span')) return PH.ck; for (const c of f.classList) if (c in PH) return PH[c]; return ''; }
  function slots(w) {   // 빈 선택 칸(제목·작은 설명·빨간 강조) — 고칠 때만 보이고 비우면 저장 때 빠짐
    const id = w.dataset.pt, kids = [...w.children], has = s => kids.some(k => k.matches(s));
    const opt = (cls, tag) => { const e = document.createElement(tag || 'div'); e.className = cls; e.dataset.opt = '1'; return e; };
    if (['steps', 'flow', 'blocks', 'check', 'matrix', 'boxes'].includes(id) && !has('.pt-t')) {
      const r = document.createElement('div'); r.className = 'pt-trule'; r.dataset.opt = 'rule';
      w.prepend(opt('pt-t'), r);
    }
    const put = (ref, e) => { if (ref) ref.after(e); };
    const lastOf = s => { const a = [...w.children].filter(k => k.matches(s)); return a[a.length - 1] || null; };
    if (id === 'steps' && !has('.pt-desc')) { const s = w.querySelector(':scope>.pt-steps'); if (s) s.before(opt('pt-desc')); }
    if (id === 'flow' && !has('.pt-desc')) put(lastOf('.pt-flow'), opt('pt-desc'));
    if (id === 'check' && !has('.pt-true')) put(lastOf('.pt-check'), opt('pt-true'));
    if (id === 'tree') { if (!has('.pt-desc')) { const t = w.querySelector(':scope>.pt-tree'); if (t) t.before(opt('pt-desc')); } if (!has('.pt-true')) put(lastOf('.pt-tree'), opt('pt-true')); }
    if (id === 'quote') { const q = w.querySelector(':scope>.pt-quote'); if (q && !q.querySelector(':scope>.pt-ql')) q.prepend(opt('pt-ql')); if (!has('.pt-desc')) put(lastOf('.pt-quote'), opt('pt-desc')); }
    if (id === 'warn') { const box = w.querySelector(':scope>.pt-warn>div'); if (box && !box.querySelector('.pt-desc')) { const wt = box.querySelector('.pt-wt'), o = opt('pt-desc'); if (wt) wt.after(o); else box.append(o); } if (!has('.pt-true')) put(lastOf('.pt-warn'), opt('pt-true')); }
  }
  function attachWrap(w) {
    w.setAttribute('contenteditable', 'false');
    for (const f of fieldsOf(w)) {
      if (f.getAttribute('contenteditable') !== 'true') f.setAttribute('contenteditable', 'true');
      const p = phOf(f); if (p) f.dataset.ph = p;
      if (!f.textContent && f.innerHTML) f.innerHTML = '';
    }
  }
  function attach(root) {
    root = root || ed(); if (!root) return;
    root.querySelectorAll(W).forEach(w => { slots(w); attachWrap(w); });
  }
  function clean(root) {   // 사본에서: 화면용 붙이 걷기 (블록이 없으면 아무것도 안 바뀜)
    root.querySelectorAll(W).forEach(w => {
      w.removeAttribute('contenteditable');
      w.querySelectorAll('[data-opt="1"]').forEach(e => {
        if (!e.textContent.replace(/[\s​ ]/g, '')) { const n = e.nextElementSibling; if (n && n.dataset.opt === 'rule') n.remove(); e.remove(); }
      });
      w.querySelectorAll('[data-opt]').forEach(e => e.removeAttribute('data-opt'));
      w.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
      w.querySelectorAll('[data-ph]').forEach(e => e.removeAttribute('data-ph'));
      w.querySelectorAll(FIELD).forEach(f => { if (!f.textContent && f.innerHTML) f.innerHTML = ''; });
    });
    return root;
  }

  /* ================================================================ 칸 옮겨 다니기 */
  function place(f, atEnd) {
    if (!f) return;
    f.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(f); r.collapse(!atEnd);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const b = f.getBoundingClientRect(); if (b.top < 60 || b.bottom > innerHeight - 40) f.scrollIntoView({ block: 'nearest' });
  }
  function nextField(f, d) { const w = f.closest(W); const L = fieldsOf(w).filter(x => x === f || shown(x)); const i = L.indexOf(f); return L[i + d] || null; }
  function caretIn(el, atEnd) {   // 블록 밖 글 줄에 커서
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(!atEnd);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); try { ed().focus({ preventScroll: true }); } catch (e) {} s.removeAllRanges(); s.addRange(r);
  }
  function leafEnd(el, atEnd) { if (!el) return null; if (el.matches && el.matches(W)) return null; const L = el.querySelectorAll('p,h2,h3,h4,li,blockquote'); return L.length ? L[atEnd ? L.length - 1 : 0] : el; }
  function exit(w, up, line) {   // 블록 밖 줄로 (line = Enter로 나감: 바로 아래 빈 본문 줄, 없으면 만듦 — Notion)
    const sib = up ? w.previousElementSibling : w.nextElementSibling;
    if (line && !(sib && sib.tagName === 'P' && !sib.textContent.trim())) { const p = document.createElement('p'); p.innerHTML = '<br>'; if (up) w.before(p); else w.after(p); caretIn(p, false); dirty(); return; }
    if (sib && sib.matches(W)) { const L = fieldsOf(sib).filter(x => shown(x) && !x.matches('.pt-lab')); return place(L[up ? L.length - 1 : 0] || fieldsOf(sib)[0], up); }
    if (sib && !sib.classList.contains('mindmap') && sib.tagName !== 'HR' && !(sib.classList.contains('board'))) { const l = leafEnd(sib, up); if (l) return caretIn(l, up); }
    const p = document.createElement('p'); p.innerHTML = '<br>';
    if (up) w.before(p); else w.after(p);
    caretIn(p, false); dirty();
  }
  function caretRect() {
    const s = getSelection(); if (!s.rangeCount) return null;
    const r = s.getRangeAt(0).cloneRange(); r.collapse(true);
    const rc = r.getClientRects(); return rc.length ? rc[0] : null;
  }
  function onEdgeLine(f, up) {
    const rc = caretRect(); if (!rc) return true;
    const fr = f.getBoundingClientRect(), lh = parseFloat(getComputedStyle(f).lineHeight) || 22;
    return up ? rc.top < fr.top + lh * 0.8 : rc.bottom > fr.bottom - lh * 0.8;
  }
  function atEdge(f, start) {
    const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false;
    const r = document.createRange(); r.selectNodeContents(f);
    const c = s.getRangeAt(0); if (start) r.setEnd(c.startContainer, c.startOffset); else r.setStart(c.startContainer, c.startOffset);
    let t = r.toString().replace(/​/g, ''); if (start && f.matches('.pt-bul')) t = t.replace(/^·\s?/, '');   // 작은 설명 앞 「· 」는 꾸밈
    return !t;
  }

  /* ================================================================ 항목(같은 모양 줄) */
  const KIND = [
    ['.pt-tx', 'step'], ['.pt-lab', 'lab'], ['.pt-bul', 'bul'], ['.pt-chev', 'chev'], ['.pt-blk', 'blk'], ['.pt-check>li>span', 'ck'],
    ['.pt-tn', 'tn'], ['.pt-fx', 'fx'], ['.pt-fk', 'fk'], ['.pt-fv', 'fv'], ['.pt-bk', 'bk'], ['.pt-bv', 'bv'], ['.pt-mq', 'mq'], ['.pt-mv', 'mv']];
  const kindOf = f => { for (const [s, k] of KIND) if (f.matches(s)) return k; return 'one'; };
  function numInfo(steps) {   // 「1」「1단계」처럼 숫자+같은 꼬리면 번호를 다시 매김
    const labs = [...steps.querySelectorAll(':scope>.pt-step>.pt-row>.pt-lab')];
    if (!labs.length) return null;
    let suf = null;
    for (const l of labs) { const m = l.textContent.trim().match(/^(\d+)(\D*)$/); if (!m) return null; if (suf === null) suf = m[2]; else if (suf !== m[2]) return null; }
    return { labs, suf };
  }
  function renum(steps) { const n = numInfo(steps); if (!n) return; n.labs.forEach((l, i) => { const t = String(i + 1) + n.suf; if (l.textContent !== t) l.textContent = t; }); }
  function newStep(ref) {
    const steps = ref.closest('.pt-steps'), info = numInfo(steps), lab0 = ref.querySelector('.pt-lab');
    const st = lab0 && lab0.getAttribute('style') ? ` style="${lab0.getAttribute('style').replace(/"/g, '&quot;')}"` : '';
    return one(`<div class="pt-step"><div class="pt-row"><span class="pt-lab"${st}>${info ? '0' + info.suf : ''}</span><span class="pt-tx"></span></div><div class="pt-ind"></div></div>`);
  }
  function splitOut(f) {   // 커서 뒤 글을 떼어 냄(새 항목으로 — Notion 목록 Enter)
    const s = getSelection(); if (!s.rangeCount) return null;
    const c = s.getRangeAt(0); const r = document.createRange(); r.selectNodeContents(f); r.setStart(c.endContainer, c.endOffset);
    if (!r.toString() && !r.cloneContents().querySelector('img')) return null;
    const frag = r.extractContents(); if (!f.textContent && f.innerHTML) f.innerHTML = '';
    return frag;
  }
  const BUL = '· ';
  function bulHtml(frag) { const d = document.createElement('div'); d.className = 'pt-bul'; d.append(BUL); if (frag) { d.append(frag); } return d; }
  function stripBul(d) { const t = d.firstChild; if (t && t.nodeType === 3) t.data = t.data.replace(/^·\s?/, ''); }
  function treeFix(tree) {
    tree.querySelectorAll('ul.pt-br').forEach(u => { if (!u.querySelector(':scope>li') && u !== tree.querySelector(':scope>ul.pt-br')) u.remove(); });
    tree.querySelectorAll('li').forEach(li => { const tn = li.querySelector(':scope>.pt-tn'); if (tn) tn.classList.toggle('pt-leaf', !li.querySelector(':scope>ul.pt-br>li')); });
  }
  function fcN(w) { const g = w.querySelector('.pt-fcs'); if (g) g.style.setProperty('--n', String(Math.max(1, g.querySelectorAll(':scope>.pt-fc').length))); }
  function after(w, fn) { fn(); attachWrap(w); dirty(); }

  function enter(f) {
    const w = f.closest(W), k = kindOf(f);
    const go = (g, end) => place(g, end);
    if (k === 'lab') return go(f.parentElement.querySelector('.pt-tx'));
    if (k === 'step') {
      const step = f.closest('.pt-step');
      if (empty(f) && !step.querySelector('.pt-ind').textContent.trim()) {   // 빈 단계 + Enter = 목록 밖으로
        const steps = step.parentElement; if (steps.querySelectorAll(':scope>.pt-step').length > 1) { after(w, () => { step.remove(); renum(steps); }); }
        return exit(w, false, true);
      }
      const frag = splitOut(f), n = newStep(step); if (frag) n.querySelector('.pt-tx').append(frag);
      after(w, () => { step.after(n); renum(step.parentElement); }); return go(n.querySelector('.pt-tx'));
    }
    if (k === 'bul') {
      const step = f.closest('.pt-step');
      if (empty(f)) return tab(f, true);   // 빈 작은 설명 + Enter = 한 단계 밖으로(새 단계)
      const frag = splitOut(f), b = bulHtml(frag); after(w, () => f.after(b)); return placeAfterBul(b);
    }
    if (k === 'chev' || k === 'blk' || k === 'ck' || k === 'tn') {
      const item = k === 'ck' || k === 'tn' ? f.closest('li') : f;
      if (empty(f) && !(k === 'tn' && item.querySelector(':scope>ul.pt-br>li'))) {   // 빈 항목 + Enter = 목록 밖으로 (Notion)
        if (k === 'tn' && item.parentElement.closest('li')) return tab(f, true);   // 빈 하위 가지 + Enter = 한 단계 밖으로
        const box = item.parentElement, nxt = nextAfterItems(f, item), c0 = item.classList[0] || '';
        if ([...box.children].filter(x => x.tagName === item.tagName && (x.classList[0] || '') === c0).length > 1) after(w, () => { item.remove(); if (k === 'tn') treeFix(w.querySelector('.pt-tree')); });
        return nxt ? go(nxt) : exit(w, false, true);
      }
      const frag = splitOut(f);
      let n;
      if (k === 'ck') { n = one('<li><i class="pt-box"></i><span></span></li>'); if (frag) n.querySelector('span').append(frag); }
      else if (k === 'tn') { n = one('<li><div class="pt-tn pt-leaf"></div></li>'); if (frag) n.firstChild.append(frag); }
      else { n = item.cloneNode(false); n.classList.remove('pt-hot', 'pt-on'); n.removeAttribute('contenteditable'); n.removeAttribute('data-opt'); if (frag) n.append(frag); }
      after(w, () => { item.after(n); if (k === 'tn') treeFix(w.querySelector('.pt-tree')); });
      return go(k === 'ck' ? n.querySelector('span') : k === 'tn' ? n.firstChild : n);
    }
    if (k === 'fx') {
      if (empty(f)) { const nx = nextField(f, 1); if (f.parentElement.querySelectorAll('.pt-fx').length > 1) after(w, () => { const op = f.previousElementSibling; if (op && op.classList.contains('pt-op')) op.remove(); f.remove(); }); return nx ? go(nx) : exit(w, false, true); }
      const frag = splitOut(f), op = one('<span class="pt-op">×</span>'), n = one('<span class="pt-fx"></span>'); if (frag) n.append(frag);
      after(w, () => { f.after(op, n); }); return go(n);
    }
    if (k === 'fk' || k === 'mq' || k === 'bk') return go(nextField(f, 1) || f, false);
    if (k === 'fv' || k === 'bv' || k === 'mv') {
      const pairEmpty = k === 'fv' ? empty(f) && empty(f.closest('.pt-fc').querySelector('.pt-fk')) : k === 'bv' ? empty(f) && empty(f.previousElementSibling) : false;
      if (k === 'mv') { const nx = nextField(f, 1); return nx ? go(nx) : exit(w, false, true); }
      if (pairEmpty) {
        const nx = nextAfterItems(f, k === 'fv' ? f.closest('.pt-fc') : f);
        const many = k === 'fv' ? f.closest('.pt-fcs').querySelectorAll('.pt-fc').length > 1 : f.parentElement.querySelectorAll('.pt-bv').length > 1;
        if (many) after(w, () => { if (k === 'fv') { f.closest('.pt-fc').remove(); fcN(w); } else { f.previousElementSibling.remove(); f.remove(); } });
        return nx ? go(nx) : exit(w, false, true);
      }
      const frag = splitOut(f);
      if (k === 'fv') { const n = one('<div class="pt-fc"><div class="pt-fk"></div><div class="pt-fv"></div></div>'); if (frag) n.lastChild.append(frag); after(w, () => { f.closest('.pt-fc').after(n); fcN(w); }); return go(n.firstChild); }
      const bk = one('<div class="pt-bk"></div>'), bv = one('<div class="pt-bv"></div>'); if (frag) bv.append(frag);
      after(w, () => f.after(bk, bv)); return go(bk);
    }
    if (f.matches('.pt-root')) {   // 큰 개념 + Enter = 첫 가지로
      const t = f.closest('.pt-tree'); let li = t.querySelector('ul.pt-br>li>.pt-tn');
      if (!li) { const u = t.querySelector(':scope>ul.pt-br') || t.appendChild(one('<ul class="pt-br"></ul>')); const n = one('<li><div class="pt-tn pt-leaf"></div></li>'); after(w, () => u.append(n)); li = n.firstChild; }
      return go(li);
    }
    const nx = nextField(f, 1); return nx ? go(nx) : exit(w, false, true);   // 제목·설명·한 문장·강조 = 다음 칸으로
  }
  function placeAfterBul(b) {   // 「· 」 뒤에 커서
    b.focus({ preventScroll: true });
    const t = b.firstChild, r = document.createRange();
    if (t && t.nodeType === 3 && t.data.startsWith(BUL)) r.setStart(t, BUL.length); else r.setStart(b, 0);
    r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function nextAfterItems(f, item) {   // 이 목록 다음의 첫 칸(목록 밖)
    const w = f.closest(W), L = fieldsOf(w).filter(shown); const box = item.parentElement;
    const i = L.findIndex(x => !box.contains(x) && (box.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING));
    return i >= 0 ? L[i] : null;
  }

  function back(f) {   // 칸 맨 앞에서 Backspace
    const w = f.closest(W), k = kindOf(f);
    const prev = () => { const p = nextField(f, -1); return p ? place(p, true) : exit(w, true); };
    if (fieldsOf(w).filter(x => !x.matches('.pt-lab')).every(empty)) {   // 빈 블록 = 블록 지움 (Notion)
      const before = w.previousElementSibling, nx = w.nextElementSibling; w.remove(); dirty();
      const l = before && !before.matches(W) ? leafEnd(before, true) : null;
      if (l) caretIn(l, true); else if (nx && !nx.matches(W)) { const m = leafEnd(nx, false); if (m) caretIn(m, false); }
      return;
    }
    if (!empty(f)) return prev();
    if (k === 'step') {
      const step = f.closest('.pt-step'), steps = step.parentElement;
      if (step.querySelector('.pt-ind').textContent.trim() || steps.querySelectorAll(':scope>.pt-step').length < 2) return prev();
      const p = nextField(f, -1); after(w, () => { step.remove(); renum(steps); }); return p && p.isConnected ? place(p, true) : prev();
    }
    if (k === 'bul') { const p = nextField(f, -1); after(w, () => f.remove()); return place(p, true); }
    if (k === 'chev' || k === 'blk' || k === 'ck' || k === 'tn' || k === 'fx') {
      const item = k === 'ck' || k === 'tn' ? f.closest('li') : f;
      const same = [...item.parentElement.children].filter(x => x.tagName === item.tagName && (k !== 'fx' || x.classList.contains('pt-fx')));
      if (same.length < 2 || (k === 'tn' && item.querySelector(':scope>ul.pt-br>li'))) return prev();
      const p = nextField(f, -1);
      after(w, () => { if (k === 'fx') { const op = f.previousElementSibling; if (op && op.classList.contains('pt-op')) op.remove(); } item.remove(); if (k === 'tn') treeFix(w.querySelector('.pt-tree')); });
      return p ? place(p, true) : prev();
    }
    if (k === 'fk' || k === 'fv') { const fc = f.closest('.pt-fc'); if (fieldsOf(fc).every(empty) && fc.parentElement.querySelectorAll('.pt-fc').length > 1) { const p = nextField(fc.querySelector('.pt-fk'), -1); after(w, () => { fc.remove(); fcN(w); }); return place(p, true); } return prev(); }
    if (k === 'bk' || k === 'bv') { const bk = k === 'bk' ? f : f.previousElementSibling, bv = k === 'bk' ? f.nextElementSibling : f;
      if (bk && bv && empty(bk) && empty(bv) && f.parentElement.querySelectorAll('.pt-bv').length > 1) { const p = nextField(bk, -1); after(w, () => { bk.remove(); bv.remove(); }); return place(p, true); } return prev(); }
    return prev();
  }

  function tab(f, out) {   // Tab = 한 단계 안으로 / ⇧Tab = 밖으로 (단계 없는 칸은 다음·앞 칸)
    const w = f.closest(W), k = kindOf(f);
    if (k === 'tn') {
      const li = f.closest('li'), tree = f.closest('.pt-tree');
      if (!out) {
        const pv = li.previousElementSibling; if (!pv) return say('바로 위 가지가 있어야 안으로 들어가요');
        after(w, () => { let u = pv.querySelector(':scope>ul.pt-br'); if (!u) { u = one('<ul class="pt-br"></ul>'); pv.append(u); } u.append(li); treeFix(tree); });
      } else {
        const up = li.parentElement.closest('li'); if (!up || !tree.contains(up)) return say('맨 바깥 가지예요');
        after(w, () => { up.after(li); treeFix(tree); });
      }
      return place(li.querySelector(':scope>.pt-tn'), true);
    }
    if (k === 'step' && !out) {   // 단계 줄 → 바로 위 단계의 작은 설명
      const step = f.closest('.pt-step'), pv = step.previousElementSibling; if (!pv || !pv.classList.contains('pt-step')) return say('바로 위 단계가 있어야 작은 설명이 돼요');
      const lab = step.querySelector('.pt-lab'), keepLab = lab && !numInfo(step.parentElement) && lab.textContent.trim() ? lab.textContent.trim() + ' ' : '';   // 자동 번호(「2단계」 등)는 꾸밈이라 안 옮김
      const ind = pv.querySelector('.pt-ind') || pv.appendChild(one('<div class="pt-ind"></div>'));
      const b = bulHtml(null); if (keepLab) b.append(keepLab); b.append(...f.childNodes);
      after(w, () => {
        const tru = ind.querySelector(':scope>.pt-true'); if (tru) tru.before(b); else ind.append(b);
        [...step.querySelector('.pt-ind').children].forEach(x => ind.append(x));
        const steps = step.parentElement; step.remove(); renum(steps);
      });
      return place(b, true);
    }
    if (k === 'bul' && out) {   // 작은 설명 → 바로 아래 새 단계
      const step = f.closest('.pt-step'), n = newStep(step), tx = n.querySelector('.pt-tx');
      stripBul(f); tx.append(...f.childNodes);
      const rest = []; let x = f.nextElementSibling; while (x) { rest.push(x); x = x.nextElementSibling; }
      after(w, () => { f.remove(); step.after(n); rest.forEach(r => n.querySelector('.pt-ind').append(r)); renum(step.parentElement); });
      return place(tx, false);
    }
    const g = nextField(f, out ? -1 : 1); if (g) place(g, !out ? false : true);
  }

  /* ================================================================ 키 (맥 키보드 + 폰 beforeinput) */
  document.addEventListener('keydown', e => {
    if (!isOn()) return;
    const f = fieldOf(e.target); if (!f) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.isComposing || e.keyCode === 229) return;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'Enter' && !mod && !e.altKey) {
      if (e.shiftKey) { e.stopPropagation(); return; }   // 칸 안 줄바꿈은 브라우저 그대로
      stop(); return enter(f);
    }
    if (e.key === 'Tab' && !mod) { stop(); return tab(f, e.shiftKey); }
    if (e.key === 'Backspace' && !mod && !e.altKey && atEdge(f, true)) { stop(); return back(f); }
    if (e.key === 'Delete' && atEdge(f, false)) { stop(); return; }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod && !e.shiftKey && onEdgeLine(f, e.key === 'ArrowUp')) {
      stop(); const g = nextField(f, e.key === 'ArrowUp' ? -1 : 1); return g ? place(g, e.key === 'ArrowUp') : exit(f.closest(W), e.key === 'ArrowUp');
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !mod && !e.shiftKey && atEdge(f, e.key === 'ArrowLeft')) {
      const g = nextField(f, e.key === 'ArrowLeft' ? -1 : 1); if (g) { stop(); return place(g, e.key === 'ArrowLeft'); }
    }
    if (!mod) e.stopPropagation();   // 칸 안 키는 편집기 본문 규칙(목록·제목 바꾸기)에 안 넘김 — 단축키(굵게·형광펜·빨강·댓글)는 아래 문서 단에서
  }, true);
  document.addEventListener('beforeinput', e => {   // 폰 키보드(안드로이드)는 Enter·지우기가 keydown 229 로 와서 여기서 받음
    if (!isOn()) return;
    const f = fieldOf(e.target); if (!f) return;
    const t = e.inputType;
    if (t === 'insertParagraph') { e.preventDefault(); return enter(f); }
    if (t === 'deleteContentBackward' && atEdge(f, true)) { e.preventDefault(); return back(f); }
    if (t === 'formatBlock' || t === 'insertOrderedList' || t === 'insertUnorderedList' || t === 'formatIndent' || t === 'formatOutdent') e.preventDefault();
  }, true);
  document.addEventListener('input', e => { const f = fieldOf(e.target); if (f && !f.textContent && f.innerHTML) f.innerHTML = ''; }, true);
  document.addEventListener('paste', e => {   // 칸 안 붙여넣기 = 글자만(줄바꿈은 띄어쓰기)
    const f = fieldOf(e.target); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const t = (e.clipboardData || window.clipboardData).getData('text/plain'); if (!t) return;
    document.execCommand('insertText', false, t.replace(/\r?\n+/g, ' ').trim());
  }, true);
  // 블록 밖 글에서 ↑↓로 블록 칸에 들어가기 (Notion)
  document.addEventListener('keydown', e => {
    if (!isOn() || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return;
    const e0 = ed(); const n = s.anchorNode; if (!e0 || !e0.contains(n) || fieldOf(n)) return;
    let top = elOf(n); while (top && top.parentElement !== e0) top = top.parentElement; if (!top) return;
    const up = e.key === 'ArrowUp', sib = up ? top.previousElementSibling : top.nextElementSibling;
    if (!sib || !sib.matches(W)) return;
    const leaf = elOf(n).closest('p,h2,h3,h4,li,blockquote') || top;
    if (!onEdgeLine(leaf, up)) return;
    const L = fieldsOf(sib).filter(shown); if (!L.length) return;
    e.preventDefault(); e.stopPropagation(); place(up ? L[L.length - 1] : L[0], up);
  }, true);

  /* ================================================================ 빨강 강조 (형광펜과 같은 방식) */
  function red() {
    const s = getSelection(), e0 = ed();
    if (!e0 || !s.rangeCount || s.isCollapsed || !e0.contains(s.getRangeAt(0).commonAncestorContainer)) return say('빨갛게 할 글자를 먼저 드래그하세요');
    const node = elOf(s.anchorNode), m = node && node.closest('.pt-r');
    if (m && e0.contains(m)) m.replaceWith(...m.childNodes);
    else { const r = s.getRangeAt(0), el = document.createElement('span'); el.className = 'pt-r'; try { r.surroundContents(el); } catch (er) { el.appendChild(r.extractContents()); r.insertNode(el); } }
    dirty();
  }
  document.addEventListener('keydown', e => {
    if (!isOn() || !(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey || (e.code !== 'KeyE' && e.code !== 'KeyR')) return;
    const s = getSelection(); if (!s.rangeCount || !ed().contains(s.getRangeAt(0).startContainer) || (window.JXB && JXB.inMind(elOf(s.anchorNode)))) return;
    e.preventDefault(); e.stopPropagation(); red();
  }, true);

  /* ================================================================ 모양 바꾸기 · 줄글로 풀기 (글자 하나도 안 잃음) */
  const inner = el => el ? el.innerHTML.replace(/(<br\s*\/?>)+$/i, '').trim() : '';
  function read(w) {   // 블록 → 중간 모양 {pre:[{k,h}], items:[{lab,text,subs,kids}], post:[{k,h}]}
    const ir = { pre: [], items: [], post: [] };
    const push = (k, h) => { if (h) (ir.items.length ? ir.post : ir.pre).push({ k, h }); };
    const li2 = li => ({ lab: '', text: inner(li.querySelector(':scope>.pt-tn')), subs: [], kids: [...li.querySelectorAll(':scope>ul.pt-br>li')].map(li2) });
    const walk = el => {
      for (const c of el.children) {
        const C = c.classList;
        if (C.contains('pt-trule') || C.contains('pt-wi') || C.contains('pt-box') || C.contains('pt-vs')) continue;
        if (C.contains('pt-steps')) {
          for (const st of c.querySelectorAll(':scope>.pt-step')) {
            const lab = st.querySelector('.pt-lab'), lt = lab ? lab.textContent.trim() : '';
            const it = { lab: /^\d*$/.test(lt) ? '' : inner(lab), text: inner(st.querySelector('.pt-tx')), subs: [], kids: [] };
            st.querySelectorAll('.pt-ind>*').forEach(x => { if (x.classList.contains('pt-bul')) it.subs.push(inner(x).replace(/^·\s?/, '')); else if (x.textContent.trim()) it.subs.push(inner(x)); });
            ir.items.push(it);
          }
        } else if (C.contains('pt-flow')) c.querySelectorAll(':scope>.pt-chev').forEach(x => ir.items.push({ lab: '', text: inner(x), subs: [], kids: [] }));
        else if (C.contains('pt-blocks')) c.querySelectorAll(':scope>.pt-blk').forEach(x => ir.items.push({ lab: '', text: inner(x), subs: [], kids: [] }));
        else if (C.contains('pt-check')) c.querySelectorAll(':scope>li').forEach(x => ir.items.push({ lab: '', text: inner(x.querySelector('span')), subs: [], kids: [] }));
        else if (C.contains('pt-tree')) { push('head', inner(c.querySelector(':scope>.pt-root'))); c.querySelectorAll(':scope>ul.pt-br>li').forEach(li => ir.items.push(li2(li))); }
        else if (C.contains('pt-mtx')) c.querySelectorAll(':scope>.pt-mx').forEach(x => ir.items.push({ lab: inner(x.querySelector('.pt-mq')), text: inner(x.querySelector('.pt-mv')), subs: [], kids: [] }));
        else if (C.contains('pt-fcs')) c.querySelectorAll(':scope>.pt-fc').forEach(x => ir.items.push({ lab: inner(x.querySelector('.pt-fk')), text: inner(x.querySelector('.pt-fv')), subs: [], kids: [] }));
        else if (C.contains('pt-bx')) { let it = null; for (const x of c.children) { if (x.classList.contains('pt-bk')) { it = { lab: inner(x), text: '', subs: [], kids: [] }; ir.items.push(it); } else if (x.classList.contains('pt-bv')) { if (!it || it.text) { it = { lab: '', text: '', subs: [], kids: [] }; ir.items.push(it); } it.text = inner(x); it = null; } } }
        else if (C.contains('pt-eq')) push('head', [...c.children].map(x => x.classList.contains('pt-op') ? `<span class="pt-op">${inner(x)}</span>` : inner(x)).filter(Boolean).join(' '));
        else if (C.contains('pt-ql')) push('label', inner(c));
        else if (C.contains('pt-t') || C.contains('pt-qt') || C.contains('pt-wt') || C.contains('pt-root') || C.contains('pt-fn')) push('head', inner(c));
        else if (C.contains('pt-desc')) push('desc', inner(c));
        else if (C.contains('pt-true')) push('true', inner(c));
        else if (c.children.length && !c.matches(FIELD)) walk(c);
        else if (c.textContent.trim()) push('desc', inner(c));
      }
    };
    walk(w);
    return ir;
  }
  const flatKids = it => [...it.subs, ...it.kids.flatMap(k => [((k.lab ? k.lab + ' ' : '') + k.text), ...flatKids(k)])].filter(Boolean);
  const oneLine = it => [((it.lab ? `<b>${it.lab}</b> ` : '') + it.text).trim(), ...flatKids(it)].filter(Boolean).join('<br>');
  function write(id, ir) {   // 중간 모양 → 블록 html
    const heads = ir.pre.filter(x => x.k === 'head'), labels = ir.pre.filter(x => x.k === 'label');
    const preDesc = ir.pre.filter(x => x.k !== 'head' && x.k !== 'label');
    const d = h => `<div class="pt-desc">${h}</div>`, tr = h => `<div class="pt-true">${h}</div>`;
    const postH = ir.post.map(x => x.k === 'true' ? tr(x.h) : d(x.h)).join('');
    const title = (useLabels) => { const hs = [...(useLabels ? labels : []), ...heads]; return hs.length ? `<div class="pt-t">${hs[0].h}</div><div class="pt-trule"></div>` + hs.slice(1).map(x => d(x.h)).join('') : ''; };
    const pre = preDesc.map(x => x.k === 'true' ? tr(x.h) : d(x.h)).join('');
    const L = ir.items; let body = '';
    if (id === 'steps') {
      const anyLab = L.some(i => i.lab);
      body = title(true) + pre + '<div class="pt-steps">' + L.map((it, i) => `<div class="pt-step${i === 0 ? ' pt-on' : ''}"><div class="pt-row"><span class="pt-lab"${anyLab ? ' style="width:auto"' : ''}>${anyLab ? it.lab : String(i + 1)}</span><span class="pt-tx">${it.text}</span></div><div class="pt-ind">${flatKids(it).map(s => `<div class="pt-bul">${BUL}${s}</div>`).join('')}</div></div>`).join('') + '</div>' + postH;
    } else if (id === 'flow') body = title(true) + pre + '<div class="pt-flow">' + L.map(it => `<div class="pt-chev">${oneLine(it)}</div>`).join('') + '</div>' + postH;
    else if (id === 'blocks') body = title(true) + pre + '<div class="pt-blocks">' + L.map(it => `<div class="pt-blk">${oneLine(it)}</div>`).join('') + '</div>' + postH;
    else if (id === 'check') body = title(true) + pre + '<ul class="pt-check">' + L.map(it => `<li><i class="pt-box"></i><span>${oneLine(it)}</span></li>`).join('') + '</ul>' + postH;
    else if (id === 'formula') {
      const hs = [...labels, ...heads];
      body = `<div class="pt-eq"><span class="pt-fn">${hs.length ? hs[0].h : ''}</span></div><div class="pt-trule"></div>` + hs.slice(1).map(x => d(x.h)).join('') + pre
        + (L.length ? `<div class="pt-fcs" style="--n:${L.length}">` + L.map(it => `<div class="pt-fc"><div class="pt-fk">${it.lab}</div><div class="pt-fv">${[it.text, ...flatKids(it)].filter(Boolean).join('<br>')}</div></div>`).join('') + '</div>' : '') + postH;
    } else if (id === 'quote') {
      const rest = [...L]; let qt = heads.length ? heads[0].h : (rest.length ? oneLine(rest.shift()) : '');
      body = `<div class="pt-quote">${labels.length ? `<div class="pt-ql">${labels[0].h}</div>` : ''}<div class="pt-qt">${qt}</div></div>`
        + [...labels.slice(1), ...heads.slice(1)].map(x => d(x.h)).join('') + pre + rest.map(it => d(oneLine(it))).join('') + postH;
    } else if (id === 'tree') {
      const hs = [...labels, ...heads];
      const br = ns => ns.length ? '<ul class="pt-br">' + ns.map(it => { const kids = [...it.subs.map(s => ({ lab: '', text: s, subs: [], kids: [] })), ...it.kids]; return `<li><div class="pt-tn${kids.length ? '' : ' pt-leaf'}">${((it.lab ? it.lab + ' ' : '') + it.text).trim()}</div>${br(kids)}</li>`; }).join('') + '</ul>' : '';
      body = pre + hs.slice(1).map(x => d(x.h)).join('') + `<div class="pt-tree"><div class="pt-root">${hs.length ? hs[0].h : ''}</div>${br(L) || '<ul class="pt-br"></ul>'}</div>` + postH;
    } else if (id === 'matrix') body = title(true) + pre + '<div class="pt-mtx">' + L.map(it => `<div class="pt-mx"><div class="pt-mq">${it.lab || ''}</div><div class="pt-mv">${[it.text, ...flatKids(it)].filter(Boolean).join('<br>')}</div></div>`).join('') + '</div>' + postH;
    else if (id === 'warn') {
      const rest = [...L], hs = [...labels, ...heads]; const wt = hs.length ? hs[0].h : (rest.length ? oneLine(rest.shift()) : '');
      body = `<div class="pt-warn"><span class="pt-wi">!</span><div><div class="pt-wt">${wt}</div>` + hs.slice(1).map(x => d(x.h)).join('') + pre + rest.map(it => d(oneLine(it))).join('') + '</div></div>' + postH;
    } else if (id === 'boxes') body = title(true) + pre + '<div class="pt-bx">' + L.map(it => `<div class="pt-bk">${it.lab}</div><div class="pt-bv">${[it.text, ...flatKids(it)].filter(Boolean).join('<br>')}</div>`).join('') + '</div>' + postH;
    return `<div class="pt-blk-wrap" data-pt="${id}">${body}</div>`;
  }
  function flatten(ir) {   // 줄글로 풀기 = 본문 줄 + 목록 (다음 다듬기 때 다시 패턴으로 안 바꾸게 data-pt-keep)
    const p = x => `<p data-pt-keep="1">${x.h}</p>`;
    const li = it => `<li>${((it.lab ? it.lab + ' ' : '') + it.text).trim() || '<br>'}${it.subs.length || it.kids.length ? '<ul>' + it.subs.map(s => `<li>${s}</li>`).join('') + it.kids.map(li).join('') + '</ul>' : ''}</li>`;
    return ir.pre.map(p).join('') + (ir.items.length ? `<ul data-pt-keep="1">${ir.items.map(li).join('')}</ul>` : '') + ir.post.map(p).join('');
  }
  function sig(h) {   // 글자 대조용: 꾸밈(번호·!·×·「· 」)과 빈칸을 뺀 글자 모음(순서 무시)
    const t = document.createElement('template'); t.innerHTML = h;
    t.content.querySelectorAll('.pt-wi,.pt-box,.pt-op').forEach(x => x.remove());
    t.content.querySelectorAll('.pt-lab').forEach(x => { x.textContent = x.textContent.replace(/\d/g, ''); });
    t.content.querySelectorAll('[contenteditable],[data-ph]').forEach(x => { x.removeAttribute('contenteditable'); x.removeAttribute('data-ph'); });
    t.content.querySelectorAll('.pt-bul').forEach(x => { const f = x.firstChild; if (f && f.nodeType === 3) f.data = f.data.replace(/^\s*·/, ''); });
    return [...t.content.textContent.replace(/[\s​ ]/g, '').replace(/[0-9×=]/g, '')].sort().join('');
  }
  function cleanOuter(w) { const k = w.cloneNode(true); const d = document.createElement('div'); d.append(k); clean(d); return k.outerHTML; }
  function swap(w, html, label) {
    const before = cleanOuter(w);
    if (sig(before) !== sig(html)) { say('글자가 달라져서 바꾸지 않았어요'); return null; }
    const frag = mk(html), nodes = [...frag.childNodes];
    const next = w.nextSibling; w.replaceWith(frag);
    nodes.forEach(n => { if (n.nodeType === 1 && n.matches(W)) { slots(n); attachWrap(n); } });
    try { JXB.remember(label, [w], nodes, nodes[0] && nodes[0].parentNode, next); } catch (e) {}
    dirty();
    const f = nodes.find(n => n.nodeType === 1); if (f) { const g = f.matches(W) ? fieldsOf(f).find(x => !empty(x)) : leafEnd(f, false); if (g) (f.matches(W) ? place(g, true) : caretIn(g, true)); }
    return nodes;
  }
  function convert(w, id) {
    if (!IDS.includes(id)) return;
    const k = w.cloneNode(true); const d = document.createElement('div'); d.append(k); clean(d);
    return swap(w, write(id, read(k)), `${(PATS.find(p => p.id === (w.dataset.pt || '')) || { t: '패턴' }).t} → ${PATS.find(p => p.id === id).t}로 바꿨어요`);
  }
  function unpack(w) {
    const k = w.cloneNode(true); const d = document.createElement('div'); d.append(k); clean(d);
    return swap(w, flatten(read(k)), '줄글로 풀었어요 (다음 다듬기 때 패턴으로 안 바뀜)');
  }
  function fromList(L, id) {   // 맨 바깥 목록(ul·ol) → 패턴 (목록 줄이 항목, 들여쓴 줄은 작은 설명·가지)
    if (!IDS.includes(id) || !L || !/^(UL|OL)$/.test(L.tagName)) return;
    if (L.querySelector('.cmt')) return say('댓글이 달린 목록은 바꾸지 않아요(댓글이 사라져요). 댓글을 먼저 해결해 주세요', 5000);
    const it = li => { const b = li.cloneNode(true); b.querySelectorAll(':scope>ul,:scope>ol').forEach(x => x.remove()); return { lab: '', text: b.innerHTML.replace(/(<br\s*\/?>)+$/i, '').trim(), subs: [], kids: [...li.querySelectorAll(':scope>ul>li,:scope>ol>li')].map(it) }; };
    const ir = { pre: [], items: [...L.querySelectorAll(':scope>li')].map(it), post: [] };
    const html = write(id, ir);
    const t = document.createElement('template'); t.innerHTML = L.outerHTML;
    if (sig(t.innerHTML) !== sig(html)) return say('글자가 달라져서 바꾸지 않았어요');
    const frag = mk(html), nodes = [...frag.childNodes], next = L.nextSibling; L.replaceWith(frag);
    nodes.forEach(n => { if (n.nodeType === 1 && n.matches(W)) { slots(n); attachWrap(n); } });
    try { JXB.remember('목록을 ' + PATS.find(p => p.id === id).t + '(으)로 바꿨어요', [L], nodes, nodes[0].parentNode, next); } catch (e) {}
    dirty(); return nodes;
  }

  /* ================================================================ 「/」 빈 틀 넣기 */
  const EMPTY = {
    steps: '<div class="pt-steps"><div class="pt-step pt-on"><div class="pt-row"><span class="pt-lab">1</span><span class="pt-tx"></span></div><div class="pt-ind"></div></div><div class="pt-step"><div class="pt-row"><span class="pt-lab">2</span><span class="pt-tx"></span></div><div class="pt-ind"></div></div></div>',
    flow: '<div class="pt-flow"><div class="pt-chev"></div><div class="pt-chev"></div><div class="pt-chev"></div></div>',
    blocks: '<div class="pt-blocks"><div class="pt-blk"></div><div class="pt-blk"></div></div>',
    formula: '<div class="pt-eq"><span class="pt-fn"></span><span class="pt-op">=</span><span class="pt-fx"></span><span class="pt-op">×</span><span class="pt-fx"></span></div><div class="pt-trule"></div><div class="pt-fcs" style="--n:2"><div class="pt-fc"><div class="pt-fk"></div><div class="pt-fv"></div></div><div class="pt-fc"><div class="pt-fk"></div><div class="pt-fv"></div></div></div>',
    quote: '<div class="pt-quote"><div class="pt-qt"></div></div>',
    check: '<ul class="pt-check"><li><i class="pt-box"></i><span></span></li><li><i class="pt-box"></i><span></span></li></ul>',
    tree: '<div class="pt-tree"><div class="pt-root"></div><ul class="pt-br"><li><div class="pt-tn pt-leaf"></div></li><li><div class="pt-tn pt-leaf"></div></li></ul></div>',
    matrix: '<div class="pt-mtx"><div class="pt-mx"><div class="pt-mq"></div><div class="pt-mv"></div></div><div class="pt-mx"><div class="pt-mq"></div><div class="pt-mv"></div></div><div class="pt-mx"><div class="pt-mq"></div><div class="pt-mv"></div></div><div class="pt-mx"><div class="pt-mq"></div><div class="pt-mv"></div></div></div>',
    warn: '<div class="pt-warn"><span class="pt-wi">!</span><div><div class="pt-wt"></div></div></div>',
    boxes: '<div class="pt-bx"><div class="pt-bk"></div><div class="pt-bv"></div><div class="pt-bk"></div><div class="pt-bv"></div><div class="pt-bk"></div><div class="pt-bv"></div></div>',
  };
  function insert(id, ref, replaceEmpty) {
    if (!EMPTY[id]) return null;
    const w = one(`<div class="pt-blk-wrap" data-pt="${id}">${EMPTY[id]}</div>`);
    const e0 = ed();
    if (ref && replaceEmpty) ref.replaceWith(w); else if (ref) ref.after(w); else e0.append(w);
    if (!w.nextElementSibling) { const p = document.createElement('p'); p.innerHTML = '<br>'; w.after(p); }
    slots(w); attachWrap(w); dirty();
    const first = fieldsOf(w).find(f => !f.dataset.opt && !f.matches('.pt-lab')) || fieldsOf(w)[0];
    place(first);   // 바로 칸에 커서 (늦추면 그 사이 친 글자가 사라짐 — 폰 시험 11/21)
    setTimeout(() => { const a = getSelection().anchorNode; if (!a || !w.contains(a)) place(first); }, 20);
    return w;
  }
  const selIn = () => { const s = getSelection(); return !!(s.rangeCount && fieldOf(s.getRangeAt(0).startContainer)); };

  window.JXP = { PATS, IDS, attach, clean, insert, convert, unpack, fromList, red, read, write, flatten, sig, inPt: n => !!wrapOf(n), selIn, isField };
})();
