/* 지식 작업실 폰앱 (11/15) — editor.html 이 부르는 api() 를 폰 안 저장소로 바꿔 끼운다.
   - 글은 이 폰의 IndexedDB 에 먼저 저장(인터넷 없어도 됨)
   - 연결되면 깃허브 비공개 저장소(Contents API, sha)로 받기/올리기. 맥(server.py jisik_sync)과 같은 보관함
   - 같은 글을 폰·맥에서 따로 고치면 아무것도 안 버린다: 11/21 자동 합치기(merge.js, 맥 jisik_merge.py 와 같은 규칙) — base = 마지막으로 같았던 판(이 폰 vers 보관함 또는 깃허브 blob).
     합친 뒤 검사(빠진 줄 0)에 걸릴 때만 안전장치로 예전처럼 폰 글은 제자리, 다른 쪽은 「제목 (충돌 11-15 14시20분)」 새 글
   - 토큰은 이 폰 안(localStorage)에만. 앱 코드엔 글·개인정보 없음
   - 11/15 「저장하고 PDF」: 글을 올리고 _요청/<칸>/<제목>.json 을 같이 올림 → 맥(jisik_sync)이 받으면 다듬고 PDF를 만들어 다시 올림
   - 11/15 「PDF 보기」: 맥이 올린 pdf/<폴더>/<제목>.pdf 를 받아 이 폰(IndexedDB pdfs)에 보관 → 앱 안 보기(pdf.js), 인터넷 없어도 열림 */
(function () {
  'use strict';
  const DIR = { gongsik: '공식집', jeongri: '지식정리본', gasul: '가설일지', mind: '마인드맵' };   // 11/20 네 번째 칸 마인드맵
  const COLS = { gongsik: '공략집', jeongri: '지식정리본', gasul: '업무일지', mind: '마인드맵' };
  const OF_DIR = Object.fromEntries(Object.entries(DIR).map(([c, d]) => [d, c]));
  const LEDGER = '가설 장부';
  const OF_FOLDER = Object.fromEntries(Object.entries(COLS).map(([c, f]) => [f, c]));
  const REQ = '_요청', PDFLIST = 'pdf/_목록.json';
  const pdfPath = (c, n) => 'pdf/' + COLS[c] + '/' + nfc(n) + '.pdf';
  const DEF_REPO = 'hyunnie123/jisik-sync';
  const cfg = {
    get(k, d) { try { return localStorage.getItem('jisik.' + k) || d; } catch (e) { return d; } },
    set(k, v) { try { v ? localStorage.setItem('jisik.' + k, v) : localStorage.removeItem('jisik.' + k); } catch (e) {} },
  };
  const nfc = s => String(s).normalize('NFC');
  const keyOf = (c, n) => c + '|' + nfc(n);
  const pathOf = (c, n) => DIR[c] + '/' + nfc(n) + '.html';
  const p2 = n => String(n).padStart(2, '0');
  const stamp = t => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const safe = n => (String(n || '').replace(/[\/\\:\n\r\t]+/g, ' ').trim().replace(/^\.+|\.+$/g, '').slice(0, 80)) || '제목 없음';
  const tx = document.createElement('textarea');
  const text = h => { tx.innerHTML = String(h).replace(/<[^>]+>/g, ' '); return tx.value; };
  const blank = h => !String(h || '').trim();

  /* ---------- IndexedDB ---------- */
  let db;
  const ready = new Promise((ok, no) => {
    const r = indexedDB.open('jisik', 3);
    r.onupgradeneeded = () => {
      const names = r.result.objectStoreNames;
      if (!names.contains('docs')) r.result.createObjectStore('docs', { keyPath: 'k' });
      if (!names.contains('pdfs')) r.result.createObjectStore('pdfs', { keyPath: 'k' });   // 11/15 맥이 만든 PDF 보관
      if (!names.contains('vers')) r.result.createObjectStore('vers', { keyPath: 'v' });   // 11/21 최근 판 보관(합치기 base) — 판 번호(sha) → 글
    };
    r.onsuccess = () => { db = r.result; ok(); };
    r.onerror = () => no(r.error);
  });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  function tx_(mode, fn, store = 'docs') {
    return new Promise((ok, no) => {
      const t = db.transaction(store, mode), st = t.objectStore(store); let out;
      Promise.resolve(fn(st, v => (out = v))).catch(no);
      t.oncomplete = () => ok(out); t.onerror = () => no(t.error); t.onabort = () => no(t.error);
    });
  }
  const all = () => tx_('readonly', (st, set) => { const r = st.getAll(); r.onsuccess = () => set(r.result); });
  const getDoc = k => tx_('readonly', (st, set) => { const r = st.get(k); r.onsuccess = () => set(r.result); });
  const putDoc = d => tx_('readwrite', st => { st.put(d); });
  const delDoc = k => tx_('readwrite', st => { st.delete(k); });
  /* 11/17 동기화가 바퀴를 도는 사이(깃허브 왕복 몇 초) 편집기가 같은 글을 저장하면, 바퀴 처음에 읽어 둔 옛 글(snap)로 덮던 틈을 막는다.
     지금 글이 snap 그대로일 때만 바꾸고(rec=null 이면 지움), 그사이 바뀌었으면 손대지 않고 false → 다음 바퀴에 다시 맞춘다. */
  const same = (a, b) => (!a && !b) || (!!a && !!b && a.html === b.html && !!a.del === !!b.del);
  const casDoc = (k, snap, rec) => tx_('readwrite', (st, set) => {
    const r = st.get(k);
    r.onsuccess = () => { if (!same(r.result, snap)) return set(false); rec ? st.put(rec) : st.delete(k); set(true); };
  });
  const setBase = (k, base) => tx_('readwrite', st => {   // 올린 판을 기준으로만 적는다(그사이 새로 쓴 글은 그대로 → 다음 바퀴에 올라감)
    const r = st.get(k); r.onsuccess = () => { if (r.result) st.put({ ...r.result, base }); };
  });
  const live = d => d && !d.del;
  const allPdf = () => tx_('readonly', (st, set) => { const r = st.getAll(); r.onsuccess = () => set(r.result); }, 'pdfs');
  const getPdf = k => tx_('readonly', (st, set) => { const r = st.get(k); r.onsuccess = () => set(r.result); }, 'pdfs');
  const putPdf = d => tx_('readwrite', st => { st.put(d); }, 'pdfs');
  const delPdf = k => tx_('readwrite', st => { st.delete(k); }, 'pdfs');
  /* 11/21 최근 판 보관 — 편집기가 연 판·저장한 판·받은 판. 나중에 「둘 다 고침」이면 이 판이 합치기 기준(base). 150개만 남김 */
  let verPuts = 0;
  async function putVer(html) {
    if (typeof html !== 'string') return;
    const v = await sha(html);
    await tx_('readwrite', st => { st.put({ v, html, t: Date.now() }); }, 'vers');
    if (++verPuts % 20 === 0) {
      const xs = await tx_('readonly', (st, set) => { const r = st.getAll(); r.onsuccess = () => set(r.result); }, 'vers');
      xs.sort((a, b) => b.t - a.t);
      if (xs.length > 150) await tx_('readwrite', st => { for (const x of xs.slice(150)) st.delete(x.v); }, 'vers');
    }
  }
  const getVer = v => tx_('readonly', (st, set) => { const r = st.get(v); r.onsuccess = () => set(r.result ? r.result.html : null); }, 'vers');
  async function baseOf(v) {   // 판 번호 → 글. 이 폰에 없으면 깃허브에서(그 판이 한 번이라도 올라갔으면 있음). 못 구하면 null → 합집합
    if (!v || !/^[0-9a-f]{40}$/.test(v)) return null;
    const h = await getVer(v); if (h !== null && h !== undefined) return h;
    if (!cfg.get('token', '') || !navigator.onLine) return null;
    try { const t = unb64((await Sync.gh('GET', `/repos/${cfg.get('repo', DEF_REPO)}/git/blobs/${v}`)).content); await putVer(t); return t; }
    catch (e) { return null; }
  }
  const merge3 = (o, a, b, later) => window.JisikMerge ? window.JisikMerge.merge3(o, a, b, later) : { ok: false, why: '합치기 파일(merge.js)이 없음' };

  /* ---------- 판 번호 = 깃 blob sha (깃허브 트리와 바로 비교) ---------- */
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { ignoreBOM: true });
  const shaCache = new Map();
  async function sha(html) {
    if (shaCache.has(html)) return shaCache.get(html);
    const b = enc.encode(html), head = enc.encode(`blob ${b.length}\0`), all_ = new Uint8Array(head.length + b.length);
    all_.set(head); all_.set(b, head.length);
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-1', all_))].map(x => x.toString(16).padStart(2, '0')).join('');
    if (shaCache.size > 400) shaCache.clear();
    shaCache.set(html, h); return h;
  }
  const b64 = s => { const b = enc.encode(s); let o = ''; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(o); };
  const unb64 = s => { const bin = atob(s.replace(/\s/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return dec.decode(u); };

  function conflictName(c, n, taken) {
    const d = new Date(), base = `${n} (충돌 ${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}시${p2(d.getMinutes())}분)`;
    let k = 1, out = base; while (taken.has(keyOf(c, out))) { k++; out = `${base} ${k}`; } return out;
  }

  /* ---------- editor.html 의 /api/* 를 여기서 ---------- */
  async function listing() {
    const docs = await all(), out = {};
    for (const c of Object.keys(COLS)) {
      const ds = [];
      for (const d of docs) {
        if (d.c !== c || !live(d)) continue;
        const x = { name: d.name, updated: stamp(d.t), t: d.t / 1000, pdf: true, ver: await sha(d.html) };
        if (c === 'gasul') {
          const segs = d.html.split(/(?=<h2[^>]*data-day=)/), days = new Set();
          for (const g of segs) { const m = g.match(/^<h2[^>]*data-day="([0-9-]+)"[^>]*>[\s\S]*?<\/h2>([\s\S]*)/); if (m && text(m[2]).trim()) days.add(m[1]); }
          x.days = days.size; x.ledger = d.name === LEDGER;
        }
        ds.push(x);
      }
      if (c === 'gasul') ds.sort((a, b) => (a.ledger !== b.ledger ? (a.ledger ? -1 : 1) : a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
      else ds.sort((a, b) => b.t - a.t);
      out[c] = { title: COLS[c], docs: ds, pdfOnly: [] };
    }
    const names = new Set(docs.filter(live).map(d => d.k));   // 11/15 원본 글 없이 PDF만 있는 것(맥 폴더 기준) — 서버판처럼 목록에
    for (const p of await allPdf()) {
      if (!p.c || p.c === 'gasul' || names.has(keyOf(p.c, p.name))) continue;
      out[p.c].pdfOnly.push(p.name);
    }
    for (const c of Object.keys(out)) out[c].pdfOnly.sort();
    return out;
  }
  async function search(q) {
    q = q.trim().toLowerCase(); const res = []; if (!q) return res;
    for (const d of await all()) {
      if (!live(d)) continue;
      const t = text(d.html).replace(/\s+/g, ' '), i = t.toLowerCase().indexOf(q);
      if (d.name.toLowerCase().includes(q) || i >= 0) res.push({ c: d.c, name: d.name, snip: i >= 0 ? t.slice(Math.max(0, i - 30), i + 60) : '' });
    }
    return res;
  }
  async function save(b) {
    const c = b.c; if (!COLS[c]) return { ok: false, err: '폴더가 이상해요' };
    let name = safe(b.name), old = b.old || null, body = String(b.html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
    if (c !== 'gasul') body = body.replace(/^(\s*<p>(\s|<br>|&nbsp;|​)*<\/p>)+/, '');
    let moved = '', merged = null;
    const curN = old || name, curD = await getDoc(keyOf(c, curN));
    // 열어 둔 사이 맥 판이 들어옴 → 11/21 덮어쓰지 않고 자동 합치기(base = 편집기가 연 판, 이 저장 = 늦은 쪽). 11/17 판(base)을 안 보냈으면 기준 판 없이 합집합
    if (live(curD) && (b.base ? (await sha(curD.html)) !== b.base : !!old)) {
      const baseHtml = b.base ? await baseOf(b.base) : null;
      const mg = merge3(baseHtml, body, curD.html, 'a');
      if (mg.ok) {
        body = mg.html; merged = { add: mg.fromB, mine: mg.fromA, base: baseHtml !== null };
        logLocal('merge', c, curN, `편집기 저장 — 맥에서 바뀐 ${mg.fromB}줄과 합침` + (baseHtml === null ? ' (기준 판 없음: 합집합)' : ''));
      } else {
        const taken = new Set((await all()).filter(live).map(d => d.k));
        moved = curN; old = null; name = conflictName(c, name, taken);
        logLocal('conflict', c, curN, `합치기 못 함(${mg.why}) → 「${name}」 새 글로`);
      }
    }
    const again = await getDoc(keyOf(c, curN));   // 합치는 사이 동기화가 새 판을 받았으면 처음부터 다시(그 판과 합침)
    if (!same(again, curD) && (b._try || 0) < 3) return save({ ...b, _try: (b._try || 0) + 1 });
    const target = await getDoc(keyOf(c, name));
    if (old && old !== name) {
      if (live(target)) return { ok: false, err: `「${name}」 제목의 글이 이미 있어요. 다른 제목으로 바꿔 주세요.` };
      const od = await getDoc(keyOf(c, old));
      if (od) { if (od.base) await putDoc({ ...od, del: true, t: Date.now() }); else await delDoc(od.k); }
    } else if (!old && live(target)) {
      return { ok: false, err: `「${name}」 제목의 글이 이미 있어요. 다른 제목으로 바꿔 주세요.` };
    }
    const now = Date.now();
    const ask = c !== 'gasul' && (b.tidy ? true : !!(target && live(target) && target.ask));   // 11/15 맥에 「다듬기 + PDF」 요청
    await putDoc({ k: keyOf(c, name), c, name: nfc(name), html: body, t: now, base: target ? target.base || null : null, del: false, ask });
    await putVer(body);
    Sync.later(c === 'gasul' ? 4000 : 300);
    return { ok: true, name: nfc(name), updated: stamp(now), pages: 0, html: body, changes: [], skip: '', ver: await sha(body), conflict: moved, merged };
  }
  /* ---------- 11/21 휴지통 — 맥 휴지통 거울(저장소 _휴지통/<칸>/<이름>__<시각>.html, 맥이 기준) + 이 폰에서 지웠는데 아직 맥에 안 간 것(pend) ----------
     되살리기 = 그 글을 원래 자리에 새 글로(같은 이름이 있으면 「이름 (되살림)」) → 올라가면 맥이 같은 바이트의 휴지통 글을 비운다. 영구 삭제는 없음. */
  const TRASHDIR = '_휴지통', TRASH_ID = /^(.*)__(\d{8})-(\d{6})$/;
  const Trash = {
    pend() { return jget('ptrash', []); },
    addPend(d) {
      const now = new Date(), id = `${nfc(d.name)}__${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
      const L = this.pend(); L.unshift({ id: 'p:' + id, c: d.c, name: nfc(d.name), html: d.html, t: Date.now(), synced: !!d.base });
      jset('ptrash', L.slice(0, 40));
    },
    dropPend(id) { jset('ptrash', this.pend().filter(x => x.id !== id)); },
    async seen(tree) {   // 동기화 한 바퀴마다 — 저장소 휴지통 목록을 받아 두고, 맥에 다 넘어간 pend 는 걷음
      const R = [];
      for (const it of tree) { const path = nfc(it.path); if (it.type === 'blob' && path.startsWith(TRASHDIR + '/') && path.endsWith('.html')) R.push({ path, sha: it.sha }); }
      jset('rtrash', R);
      const shas = new Set(R.map(x => x.sha)), keep = [];
      for (const x of this.pend()) { if (x.synced && shas.has(await sha(x.html))) continue; if (x.synced && Date.now() - x.t > 7 * 864e5) continue; keep.push(x); }
      jset('ptrash', keep);
      const paths = new Set(R.map(x => x.path)); jset('rrestored', jget('rrestored', []).filter(p => paths.has(p)));
    },
    async list() {
      const items = [], gone = new Set(jget('rrestored', []));
      for (const x of jget('rtrash', [])) {
        if (gone.has(x.path)) continue;
        const m = x.path.match(/^[^/]+\/([^/]+)\/(.+)\.html$/), c = m && OF_DIR[m[1]], id = m && m[2].match(TRASH_ID);
        if (!c || !id) continue;
        const t = new Date(+id[2].slice(0, 4), +id[2].slice(4, 6) - 1, +id[2].slice(6, 8), +id[3].slice(0, 2), +id[3].slice(2, 4), +id[3].slice(4, 6)).getTime();
        items.push({ c, id: x.path, name: id[1], t: t / 1000, when: stamp(t), pdf: false });
      }
      for (const x of this.pend()) items.push({ c: x.c, id: x.id, name: x.name, t: x.t / 1000, when: stamp(x.t), pending: x.synced ? 'mac' : 'local' });
      items.sort((a, b) => b.t - a.t);
      const since = Date.now() / 1000 - 3 * 86400;
      return { ok: true, items, revived: jget('synclog', []).filter(e => e.kind === 'revive' && e.t >= since) };
    },
    async restore(c, id) {
      if (!COLS[c]) return { ok: false, err: '폴더가 이상해요' };
      let html = null, name = '', pendId = '', path = '';
      if (String(id).startsWith('p:')) {
        const x = this.pend().find(z => z.id === id); if (!x) return { ok: false, err: '휴지통에 없어요(이미 되살렸을 수 있어요)' };
        html = x.html; name = x.name; pendId = id;
        const d = await getDoc(keyOf(c, name));
        if (d && d.del && d.base) {   // 아직 맥으로 안 감 → 지운 표시만 걷음
          await putDoc({ ...d, del: false, t: Date.now() }); this.dropPend(id); Sync.later(300); await Sync.count();
          return { ok: true, name: nfc(name), renamed: false };
        }
      } else {
        const x = jget('rtrash', []).find(z => z.path === id); if (!x) return { ok: false, err: '휴지통에 없어요(이미 되살렸을 수 있어요)' };
        const m = x.path.match(/^[^/]+\/[^/]+\/(.+)\.html$/), mm = m && m[1].match(TRASH_ID); name = mm ? mm[1] : '';
        if (!cfg.get('token', '') || !navigator.onLine) return { ok: false, err: '인터넷이 될 때 되살릴 수 있어요(글이 맥 휴지통에 있어요)' };
        try { html = unb64((await Sync.gh('GET', `/repos/${cfg.get('repo', DEF_REPO)}/git/blobs/${x.sha}`)).content); }
        catch (e) { return { ok: false, err: '글을 못 받아 왔어요: ' + (e.message || e) }; }
        path = x.path;
      }
      const taken = new Set((await all()).filter(live).map(d => d.k));
      let nm = nfc(name), k = 1;
      if (taken.has(keyOf(c, nm))) { nm = `${name} (되살림)`; while (taken.has(keyOf(c, nm))) { k++; nm = `${name} (되살림 ${k})`; } }
      const old = await getDoc(keyOf(c, nm));
      await putDoc({ k: keyOf(c, nm), c, name: nfc(nm), html, t: Date.now(), base: old && old.base || null, del: false });
      await putVer(html);
      if (pendId) this.dropPend(pendId);
      if (path) jset('rrestored', [...new Set([...jget('rrestored', []), path])]);
      logLocal('restore', c, nm, '휴지통에서 되살림' + (nm !== nfc(name) ? ` (원래 이름 「${name}」)` : ''));
      Sync.later(300); await Sync.count();
      return { ok: true, name: nfc(nm), renamed: nm !== nfc(name) };
    },
  };
  async function rename(c, old, nw) {   // 11/21 목록에서 이름 바꾸기 — 새 이름으로 같은 글 + 옛 이름 지움(맥은 같은 바이트면 휴지통 대신 이름 바뀜으로)
    if (c === 'gasul') return { ok: false, err: '업무일지는 이름을 바꾸지 않아요(달 이름·장부)' };
    const name = safe(nw), d = await getDoc(keyOf(c, old));
    if (!live(d)) return { ok: false, err: '이미 없는 글이에요' };
    if (nfc(name) === nfc(old)) return { ok: true, name: d.name };
    const target = await getDoc(keyOf(c, name));
    if (live(target)) return { ok: false, err: `「${name}」 제목의 글이 이미 있어요` };
    await putDoc({ k: keyOf(c, name), c, name: nfc(name), html: d.html, t: Date.now(), base: target ? target.base || null : null, del: false });
    if (d.base) await putDoc({ ...d, del: true, t: Date.now() }); else await delDoc(d.k);
    Sync.later(300);
    return { ok: true, name: nfc(name) };
  }
  async function LocalApi(path, body) {
    await ready;
    const u = new URL(path, location.href), q = Object.fromEntries(u.searchParams), p = u.pathname.replace(/^.*\/api\//, '/api/');
    if (p === '/api/list') return listing();
    if (p === '/api/search') return search(q.q || '');
    if (p === '/api/doc') {
      const d = await getDoc(keyOf(q.c, q.n));
      if (live(d)) await putVer(d.html);   // 11/21 편집기가 연 판 = 나중 합치기의 base
      return live(d) ? { name: d.name, html: d.html, updated: stamp(d.t), ver: await sha(d.html) } : { err: '이 폰에 없는 글이에요' };
    }
    if (p === '/api/today') {
      if (!/^\d{4}-\d{2}$/.test(body.ym || '')) return { ok: false, err: '달 이름이 이상해요' };
      const k = keyOf('gasul', body.ym), d = await getDoc(k);
      if (!live(d)) await putDoc({ k, c: 'gasul', name: body.ym, html: d ? d.html : '', t: Date.now(), base: d ? d.base : null, del: false });
      return { ok: true, name: body.ym };
    }
    if (p === '/api/save') return save(body);
    if (p === '/api/synclog') return synclog();
    if (p === '/api/trash') {
      const d = await getDoc(keyOf(body.c, body.n));
      if (!live(d)) return { ok: false, err: '이미 없는 글이에요' };
      Trash.addPend(d);   // 11/21 맥이 받아 휴지통에 넣기 전까지 이 폰 휴지통에 「맥으로 보내는 중」으로
      if (d.base) await putDoc({ ...d, del: true, t: Date.now() }); else await delDoc(d.k);
      Sync.later(300); return { ok: true };
    }
    if (p === '/api/trashlist') return Trash.list();
    if (p === '/api/restore') return Trash.restore(body.c, body.id);
    if (p === '/api/rename') return rename(body.c, body.old, body.new);
    return { ok: false, err: '폰에서는 안 되는 일이에요(맥북에서 해 주세요)' };
  }
  window.LocalApi = LocalApi;

  /* ---------- 11/16 동기화 기록 — 깃허브 commits API(글마다 커밋) + 맥이 올린 _동기화기록.jsonl + 이 폰 안 기록(실패·받음) ----------
     커밋 상세(파일 목록)는 바뀌지 않으니 이 폰(localStorage)에 모아 두고 새 커밋만 묻는다. 인터넷 없으면 모아 둔 것으로 보인다. */
  const LOGF = '_동기화기록.jsonl';
  const jget = (k, d) => { try { return JSON.parse(localStorage.getItem('jisik.' + k)) || d; } catch (e) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem('jisik.' + k, JSON.stringify(v)); } catch (e) {} };
  function logLocal(kind, c, n, msg) {
    const L = jget('synclog', []), ev = { t: Math.floor(Date.now() / 1000), dev: 'phone', kind };
    if (c) ev.c = c; if (n) ev.n = nfc(n); if (msg) ev.msg = String(msg).slice(0, 200);
    const last = L[L.length - 1];
    if (kind === 'fail' && last && last.kind === 'fail' && last.msg === ev.msg) { last.t0 = last.t0 || last.t; last.cnt = (last.cnt || 1) + 1; last.t = ev.t; }
    else L.push(ev);
    jset('synclog', L.slice(-100));
  }
  async function synclog() {
    const token = cfg.get('token', ''), repo = cfg.get('repo', DEF_REPO), br = cfg.get('branch', 'main');
    const cache = jget('cmcache', {}); let events = jget('slevents', []), note = '';
    if (!token) note = '깃허브 연결 전이라 이 폰 기록만 보여요';
    else if (!navigator.onLine) note = '인터넷이 없어서 지난번에 받아 둔 기록이에요';
    else {
      try {
        const list = await Sync.gh('GET', `/repos/${repo}/commits?sha=${encodeURIComponent(br)}&per_page=60`);
        const need = list.filter(c => !cache[c.sha]);
        const ST = { added: 'A', removed: 'D', modified: 'M', changed: 'M', copied: 'A' };
        for (let i = 0; i < need.length; i += 6) await Promise.all(need.slice(i, i + 6).map(async c => {
          const j = await Sync.gh('GET', `/repos/${repo}/commits/${c.sha}`), files = [];
          for (const f of j.files || []) {
            if (f.status === 'renamed') { if (f.previous_filename) files.push(['D', nfc(f.previous_filename)]); files.push(['A', nfc(f.filename)]); }
            else files.push([ST[f.status] || 'M', nfc(f.filename)]);
          }
          cache[c.sha] = { sha: c.sha, t: Math.floor(Date.parse(j.commit.committer.date) / 1000), author: j.commit.author.name, msg: String(j.commit.message).split('\n')[0], files };
        }));
        const keep = Object.values(cache).sort((a, b) => b.t - a.t).slice(0, 150);
        jset('cmcache', Object.fromEntries(keep.map(c => [c.sha, c])));
        try {
          const raw = dec.decode(await Sync.ghRaw(`/repos/${repo}/contents/${encodeURIComponent(LOGF)}?ref=${encodeURIComponent(br)}`));
          events = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean).slice(-300);
          jset('slevents', events);
        } catch (e) { if (e.status !== 404) throw e; }
      } catch (e) {
        note = '깃허브에서 새 기록을 못 받았어요(' + (e.status === 401 ? '토큰이 맞지 않거나 만료' : e.status === 403 ? '토큰 권한 모자람' : navigator.onLine && !(e instanceof TypeError) ? (e.message || '오류') : '인터넷 없음') + ') · 지난번 기록이에요';
      }
    }
    const commits = Object.values(jget('cmcache', cache)).sort((a, b) => b.t - a.t).slice(0, 80);
    await Sync.count();
    return { commits, events, local: jget('synclog', []), status: { dev: 'phone', last: Sync.atT || +cfg.get('lastsync', 0) || null, ok: Sync.state !== 'err', err: Sync.msg, pending: Sync.pending, note } };
  }

  /* ---------- 깃허브 동기화 ---------- */
  const Sync = {
    running: false, again: false, timer: 0, state: 'idle', msg: '', pending: 0, at: '', notes: {},
    noteOf(c, n, ver) { const x = this.notes[keyOf(c, n)]; return x && x.ver === ver ? x : null; },   // 11/21 편집기 띠 「맥과 합쳤어요: n줄 더함」
    later(ms) { clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), ms); this.count(); },
    async gh(method, url, body) {
      const r = await fetch(cfg.get('api', 'https://api.github.com') + url, {   // api 는 시험용으로만 바꿈
        method, cache: 'no-store',
        headers: { Authorization: 'Bearer ' + cfg.get('token', ''), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(j.message || ('HTTP ' + r.status)); e.status = r.status; throw e; }
      return j;
    },
    async ghRaw(url) {   // 11/15 PDF 받기(바이트 그대로)
      const r = await fetch(cfg.get('api', 'https://api.github.com') + url, {
        cache: 'no-store', headers: { Authorization: 'Bearer ' + cfg.get('token', ''), Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' },
      });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.arrayBuffer();
    },
    async count() {
      await ready; let n = 0;
      for (const d of await all()) if (d.del ? d.base : (d.base !== (await sha(d.html)) && !(blank(d.html) && !d.base)) || (live(d) && d.ask)) n++;
      this.pending = n; paint();
    },
    async run() {
      if (this.running) { this.again = true; return; }
      const token = cfg.get('token', ''), repo = cfg.get('repo', DEF_REPO), br = cfg.get('branch', 'main');
      if (!token) { this.state = 'token'; return this.count(); }
      if (!navigator.onLine) { this.state = 'offline'; logLocal('fail', '', '', '인터넷 없음 — 연결되면 다시'); return this.count(); }
      this.running = true; this.state = 'busy'; paint();
      const changed = [];
      try {
        await ready;
        const enc_ = p => p.split('/').map(encodeURIComponent).join('/');
        let tree = [];
        try { tree = (await this.gh('GET', `/repos/${repo}/git/trees/${encodeURIComponent(br)}?recursive=1`)).tree || []; }
        catch (e) { if (e.status !== 404 && e.status !== 409) throw e; }
        const R = {}, RQ = {}, RP = {};
        for (const it of tree) {
          if (it.type !== 'blob') continue;
          const path = nfc(it.path), m = path.match(/^([^/]+)\/([^/]+)\.html$/);
          if (m && OF_DIR[m[1]] && !m[2].startsWith('.')) R[path] = it.sha;
          else if (path.startsWith(REQ + '/')) RQ[path] = it.sha;
          else if (path.startsWith('pdf/')) RP[path] = it.sha;
        }
        if (tree.length) await Trash.seen(tree);   // 11/21 휴지통 목록
        const docs = await all(), byPath = {};
        for (const d of docs) byPath[pathOf(d.c, d.name)] = d;
        const pendBy = new Map(Trash.pend().map(x => [keyOf(x.c, x.name), x]));   // 11/21 이 폰에서 지운 글
        const taken = new Set(docs.filter(live).map(d => d.k));
        const blob = async s => unb64((await this.gh('GET', `/repos/${repo}/git/blobs/${s}`)).content);
        const put = async (path, html, rsha, msg) => (await this.gh('PUT', `/repos/${repo}/contents/${enc_(path)}`, { message: msg, content: b64(html), branch: br, ...(rsha ? { sha: rsha } : {}) })).content.sha;
        const pull = async (path, html, rsha, snap) => {
          const [dir, f] = [path.split('/')[0], path.slice(path.indexOf('/') + 1, -5)], c = OF_DIR[dir];
          if (!(await casDoc(keyOf(c, f), snap, { k: keyOf(c, f), c, name: f, html, t: Date.now(), base: rsha, del: false }))) { this.again = true; return; }   // 11/17 그사이 폰에서 저장함 → 다음 바퀴
          taken.add(keyOf(c, f)); changed.push(f);
          logLocal('down', c, f);   // 11/16 동기화 기록
        };
        for (const path of [...new Set([...Object.keys(R), ...Object.keys(byPath)])].sort()) {
          const d = byPath[path], r = R[path] || null, b = d ? d.base || null : null;
          const l = live(d) ? await sha(d.html) : null;
          const tag = '폰 ' + stamp(Date.now()).slice(5) + ' · ' + path.split('/').pop().slice(0, -5);
          if (l === r) { if (!l) { if (d) await casDoc(d.k, d, null); } else if (b !== l) await setBase(d.k, l); continue; }
          if (l === b) {                                   // 저장소(맥) 쪽만 바뀜 → 받기
            if (r && !d) {   // 11/21 새로 받는 글 — 이 폰에서 지운 글과 같은 이름이면: 같은 글(맥에서 되살림)이면 휴지통에서 걷고, 다르면 「고친 판이 되살아남」 띠
              const html = await blob(r), [dir, f] = [path.split('/')[0], path.slice(path.indexOf('/') + 1, -5)], c = OF_DIR[dir], px = pendBy.get(keyOf(c, f));
              await pull(path, html, r, d);
              if (px) {
                Trash.dropPend(px.id);
                if (px.html !== html) logLocal('revive', c, f, '폰에서 지운 글인데 그사이 맥에서 고친 판이 있어서 되살아났어요');
              }
            } else if (r) await pull(path, await blob(r), r, d); else if (await casDoc(d.k, d, null)) { changed.push(d.name); logLocal('down', d.c, d.name, '지움'); } else this.again = true;
          } else if (r === b) {                            // 폰 쪽만 바뀜 → 올리기
            if (l) await setBase(d.k, await put(path, d.html, r, tag));
            else { if (r) await this.gh('DELETE', `/repos/${repo}/contents/${enc_(path)}`, { message: tag + ' 지움', sha: r, branch: br }); if (!(await casDoc(d.k, d, null))) await setBase(d.k, null); }
          } else if (!l) {                                 // 폰은 지웠는데 맥은 고침 → 고친 것 살림
            await pull(path, await blob(r), r, d);
            const px = pendBy.get(d.k); if (px) Trash.dropPend(px.id);
            logLocal('revive', d.c, d.name, '폰에서 지운 글인데 그사이 맥에서 고친 판이 있어서 되살렸어요');   // 11/21 편집기 띠
          } else if (!r) {                                 // 맥은 지웠는데 폰은 고침 → 폰 것 다시 올림
            await setBase(d.k, await put(path, d.html, null, tag));
            logLocal('revive', d.c, d.name, '맥에서 지운 글인데 그사이 폰에서 고친 판이 있어서 남겨 뒀어요');   // 11/21
          } else {                                         // 둘 다 다름 → 11/21 자동 합치기(사본 없이 한 판)
            const other = await blob(r);
            if (!b && blank(d.html)) { await pull(path, other, r, d); continue; }            // 폰에 빈 칸만 만들어 둔 것 → 맥 것 받기
            if (!b && blank(other)) { await setBase(d.k, await put(path, d.html, r, tag)); continue; }
            const baseHtml = b ? await baseOf(b) : null;
            let later = 'a';
            try {   // 늦게 저장한 쪽 = 같은 블록을 둘 다 고쳤을 때 위에 올 판
              const cm = await this.gh('GET', `/repos/${repo}/commits?sha=${encodeURIComponent(br)}&path=${encodeURIComponent(path)}&per_page=1`);
              const rt = cm && cm[0] && cm[0].commit ? Date.parse(cm[0].commit.committer.date) : 0;
              later = (d.t || 0) >= (rt || 0) ? 'a' : 'b';
            } catch (e) {}
            const mg = merge3(baseHtml, d.html, other, later);
            if (mg.ok) {
              if (!same(await getDoc(d.k), d)) { this.again = true; continue; }   // 그사이 폰에서 또 고침 → 다음 바퀴에 그 판과 다시 합침
              const ns = mg.html === other ? r : await put(path, mg.html, r, tag + ' 합침');
              await putVer(mg.html);
              if (await casDoc(d.k, d, { ...d, html: mg.html, base: ns, t: Date.now() })) {
                changed.push(d.name);
                this.notes[d.k] = { t: Math.floor(Date.now() / 1000), by: 'mac', note: [`맥과 합쳤어요: ${mg.fromB}줄 더함`], ver: await sha(mg.html) };
                logLocal('merge', d.c, d.name, `폰 ${mg.fromA}줄 + 맥 ${mg.fromB}줄 합침` + (baseHtml === null ? ' (기준 판 없음: 합집합)' : ''));
              } else this.again = true;   // 기준(base)은 안 바꿈 → 다음 바퀴에 새 폰 글과 다시 합침(빠짐 없음)
              continue;
            }
            // 안전장치: 합친 뒤 검사에 걸림 → 예전처럼 폰 글은 제자리, 다른 쪽은 충돌 새 글로
            logLocal('conflict', d.c, d.name, `합치기 못 함(${mg.why}) → 새 글로`);
            const cn = conflictName(d.c, d.name, taken), cpath = pathOf(d.c, cn);
            await putDoc({ k: keyOf(d.c, cn), c: d.c, name: nfc(cn), html: other, t: Date.now(), base: null, del: false }); taken.add(keyOf(d.c, cn));
            const cs = await put(cpath, other, null, tag + ' 충돌');
            await putDoc({ k: keyOf(d.c, cn), c: d.c, name: nfc(cn), html: other, t: Date.now(), base: cs, del: false });
            await setBase(d.k, await put(path, d.html, r, tag));
            changed.push(cn);
          }
        }
        // 11/15 「저장하고 PDF」 요청 — 글이 저장소에 올라간 뒤에(같은 판일 때) 요청 파일을 올린다
        for (const d of await all()) {
          if (!live(d) || !d.ask || d.c === 'gasul') continue;
          const v = await sha(d.html); if (d.base !== v) continue;
          const rp = REQ + '/' + DIR[d.c] + '/' + nfc(d.name) + '.json';
          const body = JSON.stringify({ tidy: true, pdf: true, ver: v, at: stamp(Date.now()), from: 'phone' });
          await this.gh('PUT', `/repos/${repo}/contents/${enc_(rp)}`, { message: '폰 ' + stamp(Date.now()).slice(5) + ' · ' + d.name + ' 다듬기+PDF 요청', content: b64(body), branch: br, ...(RQ[rp] ? { sha: RQ[rp] } : {}) });
          const cur = await getDoc(d.k); if (cur && cur.html === d.html) await putDoc({ ...cur, ask: false });
        }
        // 11/15 맥이 만든 PDF 받아 두기(인터넷 없어도 「PDF 보기」) — 판(sha)이 바뀐 것만
        let pdfGot = 0;
        const have = Object.fromEntries((await allPdf()).map(p => [p.k, p]));
        if (RP[PDFLIST] && (!have[PDFLIST] || have[PDFLIST].sha !== RP[PDFLIST])) {
          const list = JSON.parse(dec.decode(await this.ghRaw(`/repos/${repo}/git/blobs/${RP[PDFLIST]}`)));
          await putPdf({ k: PDFLIST, sha: RP[PDFLIST], list });
        }
        for (const [path, s] of Object.entries(RP)) {
          if (path === PDFLIST || !path.endsWith('.pdf')) continue;
          const m = path.match(/^pdf\/([^/]+)\/(.+)\.pdf$/), c = m && OF_FOLDER[m[1]];
          if (!c || (have[path] && have[path].sha === s)) continue;
          const data = await this.ghRaw(`/repos/${repo}/git/blobs/${s}`);
          await putPdf({ k: path, sha: s, c, name: m[2], data, at: Date.now() }); pdfGot++;
        }
        for (const k of Object.keys(have)) if (!RP[k] && tree.length) await delPdf(k);
        if (pdfGot) changed.push('PDF ' + pdfGot + '개');
        this.state = 'ok'; this.msg = ''; this.at = stamp(Date.now()).slice(11); this.atT = Math.floor(Date.now() / 1000); cfg.set('lastsync', String(this.atT));
      } catch (e) {
        this.state = 'err';
        this.msg = e.status === 401 ? '토큰이 맞지 않거나 만료됐어요' : e.status === 403 ? '토큰 권한이 모자라요(Contents 읽기/쓰기)' : e.status === 404 ? '저장소를 못 찾았어요(이름·토큰 저장소 선택 확인)'
          : e.status === 409 || e.status === 422 ? '그사이 맥에서 바뀌어서 다시 맞출게요' : (navigator.onLine && !(e instanceof TypeError) ? (e.message || '알 수 없는 오류') : '인터넷이 끊겼어요');
        if (e.status === 409 || e.status === 422) this.again = true;
        else logLocal('fail', '', '', this.msg);   // 11/16 동기화 기록(폰 안에만)
      } finally {
        this.running = false;
        await this.count();
        if (changed.length) window.dispatchEvent(new CustomEvent('jisik:changed', { detail: changed }));
        if (this.again) { this.again = false; this.later(1500); }
      }
    },
  };
  window.JisikSync = Sync;

  /* ---------- 11/15 PDF 보기 (앱 안, pdf.js) — 맥이 만든 PDF를 폰에 받아 둔 것 ---------- */
  let pdfjs = null, viewUrl = '', openSeq = 0;
  async function LocalPdf(c, n) {
    await ready;
    const toast = (t, ms) => (typeof window.toast === 'function' ? window.toast(t, ms) : alert(t));
    const p = await getPdf(pdfPath(c, n)), lst = ((await getPdf(PDFLIST)) || {}).list || {};
    const info = lst[pdfPath(c, n)] || {};
    if (!p) {
      return toast(Sync.state === 'token' ? '깃허브 연결부터 해 주세요 (위 동기화 버튼)'
        : '맥북이 아직 PDF를 안 만들었어요' + (navigator.onLine ? '' : ' (인터넷이 되면 받아 와요)'), 5000);
    }
    const d = await getDoc(keyOf(c, n)), when = info.t || stamp(p.at);
    let note = '';
    if (live(d) && c !== 'gasul' && (!info.ver || info.ver !== (await sha(d.html))))
      note = `맥북이 아직 PDF를 안 만들었어요 (마지막 PDF: ${when}) · 지금 보이는 건 그때 판이에요`;
    else if (c === 'gasul') note = `업무일지 PDF는 밤마다 만들어져요 (마지막 PDF: ${when})`;
    openViewer(n, p.data, note);
  }
  window.LocalPdf = LocalPdf;
  function closeViewer() {
    const v = document.getElementById('pdfv'); if (!v || v.hidden) return;
    openSeq++; v.hidden = true; v.querySelector('.pv-pages').innerHTML = ''; document.documentElement.classList.remove('pv-open');
    if (viewUrl) { URL.revokeObjectURL(viewUrl); viewUrl = ''; }
  }
  async function openViewer(name, data, note) {
    let v = document.getElementById('pdfv');
    if (!v) {
      v = el(`<div class="pdfv" id="pdfv" role="dialog" aria-label="PDF 보기" hidden>
<div class="pv-top"><b class="pv-t"></b><a class="btn ghost pv-new" target="_blank" rel="noopener">새 탭</a><button class="btn primary pv-x" type="button">닫기</button></div>
<div class="pv-note" hidden></div><div class="pv-pages"></div></div>`);
      document.body.append(v);
      v.querySelector('.pv-x').onclick = () => (history.state && history.state.pdfv ? history.back() : closeViewer());
      window.addEventListener('popstate', closeViewer);
    }
    const my = ++openSeq;
    if (viewUrl) URL.revokeObjectURL(viewUrl);
    const blob = new Blob([data], { type: 'application/pdf' });
    viewUrl = URL.createObjectURL(blob);
    v.querySelector('.pv-t').textContent = name;
    const a = v.querySelector('.pv-new'); a.href = viewUrl; a.download = name + '.pdf';
    const nt = v.querySelector('.pv-note'); nt.textContent = note || ''; nt.hidden = !note;
    const box = v.querySelector('.pv-pages'); box.innerHTML = '<p class="pv-wait">PDF 여는 중…</p>';
    v.hidden = false; document.documentElement.classList.add('pv-open'); box.scrollTop = 0;
    if (!(history.state && history.state.pdfv)) history.pushState({ pdfv: 1 }, '');
    try {
      if (!pdfjs) {
        pdfjs = await import(new URL('pdfjs/pdf.min.mjs', location.href).href);
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', location.href).href;
      }
      const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), isEvalSupported: false }).promise;
      box.innerHTML = '';
      const W = box.clientWidth || window.innerWidth;
      for (let i = 1; i <= doc.numPages; i++) {
        if (v.hidden || my !== openSeq) return;   // 닫았거나 다른 PDF를 열었으면 그만
        const pg = await doc.getPage(i), vp1 = pg.getViewport({ scale: 1 });
        let dpr = Math.min(window.devicePixelRatio || 1, 3);
        const css = W / vp1.width;
        while (vp1.height * css * dpr > 16000 && dpr > 1) dpr -= 0.5;   // 아주 긴 쪽은 캔버스 한도 안으로
        const vp = pg.getViewport({ scale: css * dpr }), cv = document.createElement('canvas');
        cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        cv.style.width = '100%'; cv.style.aspectRatio = `${vp.width} / ${vp.height}`;
        box.append(cv);
        await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      }
    } catch (e) {
      box.innerHTML = `<p class="pv-wait">앱 안에서 못 열었어요 (${String(e && e.message || e).slice(0, 80)}). 위 「새 탭」으로 열어 보세요.</p>`;
    }
  }

  /* ---------- 위 상태 표시 + 토큰 칸 ---------- */
  const css = `
.syncrow{display:flex;align-items:center;gap:8px;padding:8px 16px 0;min-height:36px}
.syncrow .grow{flex:1}
.syncpill{border:1px solid var(--line2);background:var(--raised);color:var(--ink3);border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.syncpill i{width:8px;height:8px;border-radius:50%;background:var(--faint);flex:none}
.syncpill.ok i{background:var(--j)} .syncpill.wait i{background:var(--hl)} .syncpill.err i,.syncpill.token i{background:var(--warn)}
.syncpill.busy i{background:var(--h);animation:blink 1s infinite} @keyframes blink{50%{opacity:.25}}
.syncpill.token{border-color:var(--warn);color:var(--warn)}
.sset{width:min(520px,calc(100% - 24px));border:0;border-radius:16px;padding:20px;background:var(--raised);color:var(--ink);box-shadow:0 18px 48px var(--shade2)}
.sset::backdrop{background:var(--veil)}
.sset h2{font-size:18px;margin:0 0 6px;font-weight:800}
.sset p{font-size:13.5px;line-height:1.65;color:var(--ink3);margin:6px 0}
.sset label{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin:14px 0 4px}
.sset input{width:100%;border:1px solid var(--line2);background:var(--paper);border-radius:10px;padding:10px 12px;font:inherit;font-size:15px;color:var(--ink)}
.sset .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.sset .msg{font-size:13px;margin-top:10px;color:var(--ink3);white-space:pre-line}
.sset ol{padding-left:18px;margin:6px 0;font-size:13px;line-height:1.7;color:var(--ink3)}
.sset ol li{margin:0}
@media (max-width:760px){.syncrow{padding:6px 10px 0}}
.pdfv{position:fixed;inset:0;z-index:60;background:#5b5650;display:flex;flex-direction:column}
.pdfv[hidden]{display:none}
.pv-open,.pv-open body{overflow:hidden}
.pv-top{display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));background:var(--raised);border-bottom:1px solid var(--line2)}
.pv-t{flex:1;min-width:0;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.pv-top .btn{flex:none;text-decoration:none;display:inline-flex;align-items:center;line-height:1.2}
.pv-note{background:var(--h-soft,#fff3c4);color:var(--ink);font-size:13px;font-weight:600;line-height:1.5;padding:8px 14px;border-bottom:1px solid var(--line2)}
.pv-note[hidden]{display:none}
.pv-pages{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:0 0 max(16px,env(safe-area-inset-bottom))}
.pv-pages canvas{display:block;background:#f4eee1;margin:0 0 6px}
.pv-wait{color:#f4eee1;text-align:center;font-size:14px;padding:40px 20px;line-height:1.6}`;
  function el(h) { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; }
  function paint() {
    const pill = document.getElementById('syncPill'); if (!pill) return;
    const s = Sync, n = s.pending;
    let cls = 'ok', t = `동기화됨${s.at ? ' · ' + s.at : ''}`;
    if (s.state === 'token') { cls = 'token'; t = '깃허브 연결하기 (처음 한 번)'; }
    else if (s.state === 'busy') { cls = 'busy'; t = '동기화 중…'; }
    else if (s.state === 'offline') { cls = n ? 'wait' : 'ok'; t = n ? `폰에만 저장됨 (${n}개) · 인터넷 없음` : '인터넷 없음 · 폰에 저장돼요'; }
    else if (s.state === 'err') { cls = 'err'; t = `폰에만 저장됨${n ? ` (${n}개)` : ''} · ${s.msg}`; }
    else if (n) { cls = 'wait'; t = `폰에만 저장됨 (${n}개)`; }
    else if (s.state === 'idle') { cls = ''; t = '동기화 준비 중'; }
    pill.className = 'syncpill ' + cls; pill.innerHTML = `<i></i><span>${t}</span>`; pill.title = t;
    const m = document.getElementById('ssetMsg'); if (m) m.textContent = t;
  }
  function settings() {
    let d = document.getElementById('sset');
    if (!d) {
      d = el(`<dialog class="sset" id="sset" aria-label="깃허브 연결">
<h2>깃허브 보관함 연결</h2>
<p>글은 이 폰에 먼저 저장되고, 인터넷이 되면 맥북과 같은 비공개 보관함으로 맞춰져요. 토큰은 이 폰 안에만 저장돼요.</p>
<ol><li>깃허브 → Settings → Developer settings → Fine-grained tokens → Generate new token</li><li>Repository access: Only select repositories → 보관함 저장소 하나</li><li>Permissions → Contents: Read and write</li><li>만든 토큰(github_pat_…)을 아래에 붙여 넣기</li></ol>
<label for="ssetRepo">저장소</label><input id="ssetRepo" autocomplete="off" spellcheck="false">
<label for="ssetTok">토큰</label><input id="ssetTok" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">
<details><summary style="font-size:12.5px;color:var(--muted);margin-top:12px;cursor:pointer">더 보기</summary><label for="ssetBr">가지(branch)</label><input id="ssetBr" autocomplete="off" spellcheck="false"></details>
<div class="msg" id="ssetMsg"></div>
<div class="row"><button class="btn primary" id="ssetSave">저장하고 동기화</button><button class="btn" id="ssetNow">지금 동기화</button><span class="grow"></span><button class="btn ghost" id="ssetX">닫기</button></div>
</dialog>`);
      document.body.append(d);
      d.querySelector('#ssetX').onclick = () => d.close();
      d.querySelector('#ssetNow').onclick = () => Sync.run();
      d.querySelector('#ssetSave').onclick = () => {
        const tok = d.querySelector('#ssetTok').value.trim();
        if (tok) cfg.set('token', tok);
        cfg.set('repo', d.querySelector('#ssetRepo').value.trim() || DEF_REPO);
        cfg.set('branch', d.querySelector('#ssetBr').value.trim() || 'main');
        d.querySelector('#ssetTok').value = ''; d.querySelector('#ssetTok').placeholder = cfg.get('token', '') ? '저장됨 (바꿀 때만 다시 붙여 넣기)' : 'github_pat_…';
        Sync.state = 'idle'; Sync.run();
      };
    }
    d.querySelector('#ssetRepo').value = cfg.get('repo', DEF_REPO);
    d.querySelector('#ssetBr').value = cfg.get('branch', 'main');
    d.querySelector('#ssetTok').placeholder = cfg.get('token', '') ? '저장됨 (바꿀 때만 다시 붙여 넣기)' : 'github_pat_…';
    paint(); d.showModal();
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.head.append(el(`<style>${css}</style>`));
    const main = document.querySelector('.main');
    const row = el(`<div class="syncrow"><span class="grow"></span><button class="syncpill" id="syncPill" type="button"></button></div>`);
    main.prepend(row);
    row.querySelector('#syncPill').onclick = settings;
    paint();
    if (!cfg.get('token', '')) { Sync.state = 'token'; Sync.count(); } else Sync.later(400);
  });
  window.addEventListener('online', () => Sync.later(300));
  window.addEventListener('offline', () => { Sync.state = 'offline'; Sync.count(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Sync.later(300); });
  window.addEventListener('pageshow', e => { if (e.persisted) Sync.later(300); });   // 11/17 아이폰이 앱 화면을 그대로 되살릴 때(visibilitychange 가 안 오는 경우)
  setInterval(() => { if (!document.hidden) Sync.run(); }, 60000);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
