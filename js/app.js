/* ===== Sigillatore: interfaccia ===== */
(() => {
  const $ = s => document.querySelector(s);
  const T = Eng.TINT, SC = Eng.SC;
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);

  /* ---------- parametri ---------- */
  const SP_DEF = { D: 50, mode: 'rilievo', frame: true, bw: 1.4, ow: 0.6, hw: 0.45, hp: 1.3, dd: 0.75, dp: 1.6, rd: 1.0, tb: 6, sd: 4, af: 10, cl: 0.15 };
  const WAX = { rosso: ['#8C1C22', 'Rosso lacca'], borgogna: ['#5A1426', 'Borgogna'], blu: ['#1E3A64', 'Blu notte'], verde: ['#24533A', 'Verde bosco'], oro: ['#B18A33', 'Oro'], nero: ['#26262A', 'Nero'] };
  const blank = () => ({ shape: 'casata', partition: 'nessuna', line: 'dritta', areas: ['azzurro', 'oro', 'rosso', 'argento'], ordinaries: [], charges: [],
    capo: { on: false, t: 'azzurro', n: 2, fig: 'bozzolo', ft: 'argento', ft2: 'rosso', line: 'dritta' }, orn: { id: '', t: 'oro', t2: 'rosso' } });
  const ex = (o) => Object.assign(blank(), o);
  const EXAMPLES = [
    ['Esempio 1', ex({ areas: ['porpora'], charges: [{ fig: 'incudine', x: 50, y: 77, s: 50, r: 0, t: 'argento' }], capo: { on: true, t: 'argento', n: 2, fig: 'martello', ft: 'nero', ft2: 'rosso', line: 'dritta' } })],
    ['Esempio 2', ex({ areas: ['verde'], charges: [{ fig: 'foglia-di-gelso', x: 50, y: 80, s: 46, r: 0, t: 'argento' }], capo: { on: true, t: 'azzurro', n: 3, fig: 'bozzolo', ft: 'argento', ft2: 'rosso', line: 'dritta' } })],
    ['Esempio 3', ex({ partition: 'partito', areas: ['armellino', 'porpora'], charges: [{ fig: 'orso-rampante', x: 52, y: 66, s: 86, r: 0, t: 'argento' }] })],
    ['Esempio 4 (famiglia reale)', ex({ partition: 'partito', areas: ['armellino', 'porpora'], charges: [{ fig: 'orso-rampante', x: 52, y: 66, s: 86, r: 0, t: 'oro' }], orn: { id: 'corona-reale', t: 'oro', t2: 'rosso' } })],
    ['Esempio 5', ex({ partition: 'troncato', line: 'ondata', areas: ['verde', 'azzurro'], charges: [{ fig: 'covone-di-grano', x: 50, y: 32, s: 38, r: 0, t: 'oro' }, { fig: 'tonno', x: 50, y: 85, s: 42, r: 0, t: 'argento', attr: 'nuotante' }] })],
  ];

  /* ---------- stato e salvataggio ---------- */
  const KEY = 'sigillatore.v1';
  let store = { entries: [], current: null, sp: clone(SP_DEF), wax: 'rosso', local: [], draft: null };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) store = Object.assign(store, s); } catch (e) { /* storage non disponibile */ }
  store.sp = Object.assign(clone(SP_DEF), store.sp || {});
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { toast('Non riesco a salvare in questo browser'); } };

  let D = blank(), SP = store.sp, sel = null, lay = null, curId = store.current;
  let famiglia = '', titolare = '', parentId = null;

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600); }

  /* ---------- utilità di disegno ---------- */
  const figList = kind => Object.entries(Eng.FIGS).filter(([, f]) => (f.kind || 'figura') === kind).sort((a, b) => a[1].n.localeCompare(b[1].n, 'it'));
  const toD = (paths, back) => paths.map(p => 'M' + p.map(q => { const [x, y] = back(q); return x.toFixed(2) + ' ' + y.toFixed(2); }).join('L') + 'Z').join('');

  function chipSvg(t) {
    const c = T[t].c, k = '#000', o = 'stroke="' + k + '" stroke-width="1.1" opacity=".55"';
    let pat = '';
    if (t === 'rosso') pat = [4, 8, 12, 16].map(x => `<line x1="${x}" y1="0" x2="${x}" y2="20" ${o}/>`).join('');
    if (t === 'azzurro') pat = [4, 8, 12, 16].map(y => `<line x1="0" y1="${y}" x2="20" y2="${y}" ${o}/>`).join('');
    if (t === 'nero') pat = '';
    if (t === 'verde') pat = [-8, -2, 4, 10, 16].map(c0 => `<line x1="0" y1="${c0}" x2="20" y2="${c0 + 20}" ${o}/>`).join('');
    if (t === 'porpora') pat = [4, 10, 16, 22, 28].map(c0 => `<line x1="0" y1="${c0}" x2="20" y2="${c0 - 20}" ${o}/>`).join('');
    if (t === 'oro') pat = [[4, 4], [12, 4], [8, 10], [16, 10], [4, 16], [12, 16]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="${k}" opacity=".5"/>`).join('');
    if (t === 'armellino') pat = `<path d="M10 6c.6 3 1.6 5 4 7l-2.4-.6L10 15l-1.6-2.6L6 13c2.4-2 3.4-4 4-7z" fill="${k}"/><circle cx="10" cy="4.2" r="1.2" fill="${k}"/><circle cx="7.6" cy="5.8" r="1.1" fill="${k}"/><circle cx="12.4" cy="5.8" r="1.1" fill="${k}"/>`;
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" fill="${c}"/>${pat}</svg>`;
  }
  const chips = (path, cur, opts) => `<div class="chips" role="group" aria-label="${esc(opts && opts.label || 'Smalto')}">${Object.keys(T).filter(t => !(opts && opts.noFur && T[t].fur)).map(t =>
    `<button class="chip" data-set="${path}" data-val="${t}" aria-pressed="${t === cur}" title="${T[t].n} · ${T[t].hint}">${chipSvg(t)}</button>`).join('')}</div>`;
  const seg = (path, cur, items) => `<div class="seg">${items.map(([v, l]) => `<button data-set="${path}" data-val="${v}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
  const select = (path, cur, items, cls) => `<select class="inp ${cls || ''}" data-set="${path}">${items.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const lineOpts = Object.entries(Eng.LINES).map(([k, v]) => [k, v.n]);

  /* ---------- editor ---------- */
  function renderEditor() {
    const part = Eng.PARTS[D.partition];
    const figs = figList('figura'), orns = figList('ornamento');
    const S = [];
    S.push(`<div class="sec"><div class="sec-h"><h3>Scudo</h3></div>
      ${seg('shape', D.shape, Object.entries(Eng.SHIELDS).map(([k, v]) => [k, v.n]))}</div>`);

    S.push(`<div class="sec"><div class="sec-h"><h3>Campo</h3></div>
      <div class="row">${select('partition', D.partition, Object.entries(Eng.PARTS).map(([k, v]) => [k, v.n]))}
      ${D.partition !== 'nessuna' ? `<label class="row gap-s"><span class="lbl">Linea</span>${select('line', D.line || 'dritta', lineOpts)}</label>` : ''}</div>
      ${part.labels.map((l, i) => `<div class="field-row"><span class="lbl">${esc(l)} <b>${T[D.areas[i]].n}</b></span>${chips('areas.' + i, D.areas[i])}</div>`).join('')}</div>`);

    S.push(`<div class="sec"><div class="sec-h"><h3>Pezze</h3>
      <div class="row gap-s">${select('', '', [['', 'Aggiungi…'], ...Object.entries(Eng.ORDS).map(([k, v]) => [k, v.n])], 'add-ord')}</div></div>
      ${D.ordinaries.length ? `<div class="list">${D.ordinaries.map((o, i) => `<div class="item"><div class="item-h"><strong>${Eng.ORDS[o.type].n} ${T[o.t].n.toLowerCase()}</strong>
        <div class="row gap-s">${Eng.ORDS[o.type].line ? select('ordinaries.' + i + '.line', o.line || 'dritta', lineOpts) : ''}<button class="x" data-act="del-ord" data-i="${i}" aria-label="Rimuovi">×</button></div></div>
        ${chips('ordinaries.' + i + '.t', o.t)}</div>`).join('')}</div>` : '<p class="hint">Fascia, palo, banda, croce… si sovrappongono al campo.</p>'}</div>`);

    const c = D.capo;
    S.push(`<div class="sec"><div class="sec-h"><h3>Capo di gilda</h3>
      <label class="switch"><input type="checkbox" data-set="capo.on" ${c.on ? 'checked' : ''}> Cucito</label></div>
      ${c.on ? `<div class="field-row"><span class="lbl">Smalto del capo <b>${T[c.t].n}</b></span>${chips('capo.t', c.t)}</div>
      <div class="row"><span class="lbl">Rango</span>${seg('capo.n', c.n, [[1, '1'], [2, '2'], [3, '3']])}
        <span class="lbl">Linea</span>${select('capo.line', c.line || 'dritta', lineOpts)}</div>
      <div class="field-row"><span class="lbl">Figura della gilda</span>${select('capo.fig', c.fig, figs.map(([k, f]) => [k, f.n]))}</div>
      <div class="field-row"><span class="lbl">Smalto delle figure <b>${T[c.ft].n}</b></span>${chips('capo.ft', c.ft)}</div>
      ${Eng.FIGS[c.fig] && Eng.FIGS[c.fig].sec.length ? `<div class="field-row"><span class="lbl">Secondo smalto <b>${T[c.ft2 || 'rosso'].n}</b></span>${chips('capo.ft2', c.ft2 || 'rosso')}</div>` : ''}`
      : '<p class="hint">Il capo con 1, 2 o 3 figure in fascia indica la gilda del capofamiglia e il suo rango.</p>'}</div>`);

    const ch = sel != null ? D.charges[sel] : null, F = ch && Eng.FIGS[ch.fig];
    S.push(`<div class="sec"><div class="sec-h"><h3>Figure</h3>
      <label class="btn small" title="Prova un SVG prima di metterlo in resources/">Prova SVG<input id="in-svg" type="file" accept=".svg,image/svg+xml" multiple hidden></label></div>
      <div class="lib">${figs.map(([k, f]) => `<button class="fig" data-act="add-fig" data-fig="${esc(k)}" title="Aggiungi ${esc(f.n)}"><img src="${esc(f.src)}" alt="">${esc(f.n)}${f.local ? '<span class="tag">locale</span>' : ''}</button>`).join('')}</div>
      ${ch ? `<div class="item selbox"><div class="item-h"><strong>${esc(F ? F.n : ch.fig)} ${T[ch.t].n.toLowerCase()}</strong>
          <div class="row gap-s"><button class="btn small" data-act="dup">Duplica</button><button class="x" data-act="del-ch" aria-label="Rimuovi figura">×</button></div></div>
        ${chips('charges.' + sel + '.t', ch.t)}
        ${F && F.sec.length ? `<div class="field-row"><span class="lbl">Secondo smalto <b>${T[ch.t2 || 'rosso'].n}</b></span>${chips('charges.' + sel + '.t2', ch.t2 || 'rosso')}</div>` : ''}
        <div class="field-row"><span class="lbl">Dimensione <b>${Math.round(ch.s)}</b></span><input type="range" min="8" max="115" step="1" value="${ch.s}" data-set="charges.${sel}.s" data-num></div>
        <div class="field-row"><span class="lbl">Rotazione <b>${Math.round(ch.r || 0)}°</b></span><input type="range" min="-180" max="180" step="5" value="${ch.r || 0}" data-set="charges.${sel}.r" data-num></div>
        <div class="row"><label class="switch"><input type="checkbox" data-set="charges.${sel}.flip" ${ch.flip ? 'checked' : ''}> Rivolta</label>
          <label class="row gap-s"><span class="lbl">Attributo</span><input class="inp" type="text" style="width:120px" placeholder="es. nuotante" value="${esc(ch.attr || '')}" data-set="charges.${sel}.attr" data-text></label></div>
      </div>` : (D.charges.length ? '<p class="hint">Tocca una figura sullo scudo per modificarla.</p>' : '<p class="hint">Scegli una figura: compare al centro dello scudo.</p>')}
      ${D.charges.length > 1 ? `<div class="row"><span class="lbl">Disponi</span>${['fascia', 'palo', '2-1', '1-2'].map(m => `<button class="btn small" data-act="arrange" data-m="${m}">${{ fascia: 'In fascia', palo: 'In palo', '2-1': '2 e 1', '1-2': '1 e 2' }[m]}</button>`).join('')}</div>` : ''}
    </div>`);

    const o = D.orn;
    S.push(`<div class="sec"><div class="sec-h"><h3>Sopra lo scudo</h3></div>
      ${select('orn.id', o.id || '', [['', 'Nessun ornamento'], ...orns.map(([k, f]) => [k, f.n])])}
      ${o.id && Eng.FIGS[o.id] ? `<div class="field-row"><span class="lbl">Smalto <b>${T[o.t].n}</b></span>${chips('orn.t', o.t)}</div>
      ${Eng.FIGS[o.id].sec.length ? `<div class="field-row"><span class="lbl">Fodera <b>${T[o.t2 || 'rosso'].n}</b></span>${chips('orn.t2', o.t2 || 'rosso')}</div>` : ''}` : ''}</div>`);

    $('#editor').innerHTML = S.join('');
    const inSvg = $('#in-svg'); if (inSvg) inSvg.addEventListener('change', onSvgFiles);
  }

  /* ---------- scudo ---------- */
  function viewBox() {
    const top = Eng.ornOn(D) ? Eng.ornBox(D.shape, D.orn.id).y0 - 4 : -6;
    return [-8, top, 116, 128 - top];
  }
  function shieldSvg(L, opts) {
    opts = opts || {};
    const back = L.fr.back, k = L.fr.k;
    const vb = viewBox();
    const parts = [];
    const shieldD = toD(L.shield, back);
    parts.push(`<defs><clipPath id="${opts.id || 'cs'}"><path d="${shieldD}"/></clipPath></defs>`);
    for (const l of L.L) {
      if (!l.vis.length) continue;
      const d = toD(l.vis, back);
      parts.push(`<path d="${d}" fill="${T[l.t].c}" stroke="#111" stroke-width="0.7" stroke-linejoin="round"/>`);
      if (l.spots && l.spots.length) parts.push(`<path d="${toD(l.spots, back)}" fill="#111"/>`);
    }
    const bw = Math.max(2.4, SP.bw / k);
    parts.push(`<path d="${shieldD}" fill="none" stroke="#111" stroke-width="${(bw * 2).toFixed(2)}" clip-path="url(#${opts.id || 'cs'})"/>`);
    parts.push(`<path d="${shieldD}" fill="none" stroke="#111" stroke-width="0.9"/>`);
    return { vb, inner: parts.join('') };
  }
  function renderStage() {
    lay = Eng.layers(D, SP);
    const { vb, inner } = shieldSvg(lay);
    const hits = D.charges.map((c, i) => {
      const F = Eng.FIGS[c.fig], ar = F ? F.ar : 1, w = ar > 1 ? c.s / ar : c.s, h = ar > 1 ? c.s : c.s * ar;
      const box = i === sel ? `<rect x="${(-w / 2 - 2).toFixed(2)}" y="${(-h / 2 - 2).toFixed(2)}" width="${(w + 4).toFixed(2)}" height="${(h + 4).toFixed(2)}" fill="none" stroke="#B5862B" stroke-width="0.8" stroke-dasharray="2.5 1.8" transform="rotate(${c.r || 0})"/>` : '';
      return `<g transform="translate(${c.x} ${c.y})">${box}<rect class="hit" data-i="${i}" x="${(-w / 2).toFixed(2)}" y="${(-h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="transparent" transform="rotate(${c.r || 0})"/></g>`;
    }).join('');
    const st = $('#stage');
    st.setAttribute('viewBox', vb.join(' '));
    st.innerHTML = inner + hits;
    renderBlazon();
  }

  /* ---------- blasonatura ---------- */
  const NUM = ['', 'un', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const of = t => T[t].of;
  function chargePhrase(list) {
    const groups = [];
    for (const c of list) {
      const g = groups.find(g => g.fig === c.fig && g.t === c.t && (g.attr || '') === (c.attr || ''));
      if (g) g.n++; else groups.push({ fig: c.fig, t: c.t, attr: c.attr, n: 1 });
    }
    const ph = groups.map(g => { const F = Eng.FIGS[g.fig]; if (!F) return '';
      const base = g.n === 1 ? F.art + ' ' + of(g.t) : 'a ' + NUM[g.n] + ' ' + F.pl + ' ' + of(g.t);
      return base + (g.attr ? ' ' + g.attr : ''); }).filter(Boolean);
    return ph.length > 1 ? ph.slice(0, -1).join(', ') + ' e ' + ph[ph.length - 1] : (ph[0] || '');
  }
  function renderBlazon() {
    const P = Eng.PARTS[D.partition], ln = Eng.LINES[D.line || 'dritta'];
    const areas = lay.L.filter(l => l.kind === 'area');
    const n = P.labels.length;
    // a quale partizione appartiene ciascuna figura?
    const where = D.charges.map((c, i) => {
      const L = lay.L.find(l => l.kind === 'charge' && l.i === i); if (!L || !L.paths.length) return -1;
      const hit = areas.map(a => Eng.inter(L.paths, a.paths).length > 0);
      return hit.filter(Boolean).length === 1 ? hit.indexOf(true) : -1;
    });
    const ordTxt = D.ordinaries.map(o => { const O = Eng.ORDS[o.type], l = Eng.LINES[o.line || 'dritta'];
      return O.art + (O.line && l.adj ? ' ' + (O.g === 'f' ? l.adjf : l.adj) : '') + ' ' + of(o.t); });
    let s;
    const crossing = D.charges.filter((c, i) => where[i] < 0);
    if (n === 1) {
      s = cap(of(D.areas[0])) + [...ordTxt, chargePhrase(D.charges)].filter(Boolean).map(x => ', ' + x).join('');
    } else {
      const name = P.n + (ln.adj ? ' ' + ln.adj : '');
      const perArea = D.areas.slice(0, n).map((t, i) => ({ t, ch: D.charges.filter((c, j) => where[j] === i) }));
      if (perArea.some(a => a.ch.length)) {
        s = name + ': ' + perArea.map((a, i) => 'nel ' + (i + 1) + '° ' + of(a.t) + (a.ch.length ? ', ' + chargePhrase(a.ch) : '')).join('; ');
      } else {
        const ts = D.areas.slice(0, n).map(of);
        s = name + ' ' + (ts.length > 1 ? ts.slice(0, -1).join(', ') + ' e ' + ts[ts.length - 1] : ts[0]);
      }
      const extra = [...ordTxt];
      if (crossing.length) extra.push(chargePhrase(crossing) + ' attravers' + (crossing.length > 1 ? 'anti' : 'ante'));
      if (extra.length) s += '; ' + extra.join(', ');
    }
    if (D.capo.on) {
      const F = Eng.FIGS[D.capo.fig], l = Eng.LINES[D.capo.line || 'dritta'];
      s += '; col capo' + (l.adj ? ' ' + l.adj : '') + ' ' + of(D.capo.t) + ', cucito, caricato ' +
        (F ? (D.capo.n === 1 ? 'di ' + F.sg + ' ' + of(D.capo.ft) : 'di ' + NUM[D.capo.n] + ' ' + F.pl + ' ' + of(D.capo.ft) + ', ordinati in fascia') : '');
    }
    s += '.';
    if (Eng.ornOn(D)) { const F = Eng.FIGS[D.orn.id]; s += ' Scudo ' + (F.blasone || 'sormontato da ' + F.sg) + '.'; }
    $('#blazon').textContent = s;
  }

  /* ---------- anteprima in ceralacca ---------- */
  let sealTimer = null, inkCache = null;
  function scheduleSeal() { clearTimeout(sealTimer); sealTimer = setTimeout(drawSeal, 180); }
  function noise(i) { const x = Math.sin(i * 12.9898 + 7.233) * 43758.5453; return x - Math.floor(x); }
  function drawSeal() {
    const t0 = performance.now();
    inkCache = Eng.ink(D, SP, lay || Eng.layers(D, SP));
    const ms = performance.now() - t0;
    const cv = $('#wax'), box = cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(200, Math.round(box.width * dpr));
    cv.width = W; cv.height = W;
    const g = cv.getContext('2d'), cx = W / 2, R = SP.D / 2, s = (W * 0.43) / (R * 1.22);
    g.clearRect(0, 0, W, W);
    const base = WAX[store.wax][0];
    const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
      const m = v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); return `rgb(${m(r)},${m(gg)},${m(b)})`; };
    // goccia di cera irregolare
    g.beginPath();
    const N = 90;
    for (let i = 0; i <= N; i++) { const a = 2 * Math.PI * i / N, rr = R * (1.16 + 0.05 * Math.sin(a * 3 + 1) + 0.035 * Math.sin(a * 7 + 2) + 0.02 * (noise(i % N) - .5)) * s;
      i ? g.lineTo(cx + rr * Math.cos(a), cx + rr * Math.sin(a)) : g.moveTo(cx + rr * Math.cos(a), cx + rr * Math.sin(a)); }
    g.closePath();
    g.save(); g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = 10 * dpr; g.shadowOffsetY = 3 * dpr; g.fillStyle = base; g.fill(); g.restore();
    const gr = g.createRadialGradient(cx - R * s * .4, cx - R * s * .5, R * s * .1, cx, cx, R * s * 1.3);
    gr.addColorStop(0, shade(base, .18)); gr.addColorStop(1, shade(base, -.25));
    g.fillStyle = gr; g.fill();
    // impronta del disco
    g.save(); g.beginPath(); g.arc(cx, cx, R * s, 0, Math.PI * 2);
    g.fillStyle = shade(base, -.06); g.fill();
    g.lineWidth = 2 * dpr; g.strokeStyle = shade(base, -.35); g.stroke(); g.clip();
    const path = new Path2D();
    for (const p of inkCache) { p.forEach((q, i) => { const x = cx + q.X / SC * s, y = cx + q.Y / SC * s; i ? path.lineTo(x, y) : path.moveTo(x, y); }); path.closePath(); }
    const raised = SP.mode === 'rilievo', o = Math.max(1, 0.9 * dpr);
    g.translate(raised ? o : -o, raised ? o : -o); g.fillStyle = shade(base, -.45); g.fill(path, 'nonzero');
    g.translate(raised ? -2 * o : 2 * o, raised ? -2 * o : 2 * o); g.fillStyle = shade(base, .28); g.fill(path, 'nonzero');
    g.translate(raised ? o : -o, raised ? o : -o); g.fillStyle = raised ? shade(base, .02) : shade(base, -.16); g.fill(path, 'nonzero');
    g.restore();
    $('#wax-cap').textContent = `Ø ${SP.D} mm · ${SP.mode === 'rilievo' ? 'disegno in rilievo' : 'disegno incavato'}`;
    // avvisi di stampa
    const warn = [];
    if (SP.ow < 0.4) warn.push('contorni sotto 0,4 mm');
    if (SP.hw < 0.35) warn.push('tratteggio sotto 0,35 mm');
    if (SP.hp - SP.hw < 0.45) warn.push('linee del tratteggio troppo vicine');
    $('#stat').innerHTML = `Timbro ${SP.D} × ${(SP.tb + SP.rd).toFixed(1)} mm · rilievo ${SP.rd} mm · calcolo ${Math.round(ms)} ms` + (warn.length ? `<br><span class="warn">Attenzione: ${warn.join(', ')}</span>` : '');
  }

  function renderSealOpts() {
    $('#wax-colors').innerHTML = Object.entries(WAX).map(([k, [c, n]]) => `<button class="wax-chip" style="background:${c}" data-wax="${k}" aria-pressed="${k === store.wax}" title="${n}" aria-label="${n}"></button>`).join('');
    const rng = (key, lbl, min, max, step, unit) => `<div class="field-row"><span class="lbl">${lbl} <b>${String(SP[key]).replace('.', ',')}${unit || ''}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${SP[key]}" data-sp="${key}"></div>`;
    $('#seal-opts').innerHTML = rng('D', 'Diametro', 25, 60, 1, ' mm') +
      `<div class="field-row"><span class="lbl">Disegno nella cera</span>${seg('sp.mode', SP.mode, [['rilievo', 'In rilievo'], ['incavato', 'Incavato']])}</div>
       <label class="switch"><input type="checkbox" data-sp="frame" ${SP.frame ? 'checked' : ''}> Cornice circolare</label>`;
    $('#print-opts').innerHTML =
      rng('bw', 'Bordo dello scudo', 0.6, 3, 0.1, ' mm') + rng('ow', 'Contorni', 0.3, 1.2, 0.05, ' mm') +
      rng('hw', 'Linee del tratteggio', 0.3, 1, 0.05, ' mm') + rng('hp', 'Passo del tratteggio', 0.8, 2.5, 0.05, ' mm') +
      rng('dd', 'Puntini dell’oro', 0.4, 1.2, 0.05, ' mm') + rng('dp', 'Passo dei puntini', 1, 2.5, 0.05, ' mm') +
      rng('rd', 'Profondità del rilievo', 0.5, 2, 0.1, ' mm') + rng('tb', 'Spessore della testa', 5, 10, 0.5, ' mm') +
      rng('af', 'Esagono di innesto', 8, 14, 0.5, ' mm') + rng('cl', 'Gioco dell’innesto', 0, 0.4, 0.05, ' mm') +
      `<p class="hint">Valori pensati per ugello 0,2 mm. La testa si stampa con il disegno verso l’alto; la tacca sul bordo indica l’alto dello stemma.</p>
       <button class="btn small" data-act="reset-sp">Ripristina i valori</button>`;
  }

  /* ---------- armoriale ---------- */
  function miniSvg(design) {
    try { const L = Eng.layers(design, Object.assign({}, SP, { D: 30 })); const { vb, inner } = shieldSvg(L, { id: 'm' + uid() }); return `<svg viewBox="${vb.join(' ')}" aria-hidden="true">${inner}</svg>`; }
    catch (e) { return '<svg viewBox="0 0 10 10"></svg>'; }
  }
  function renderArmorial() {
    const E = store.entries;
    if (!E.length) { $('#armorial').innerHTML = '<p class="empty">Nessuno stemma salvato. Componi uno scudo e premi Salva.</p>'; return; }
    const fams = {};
    for (const e of E) (fams[e.famiglia || 'Senza famiglia'] = fams[e.famiglia || 'Senza famiglia'] || []).push(e);
    const row = e => `<div class="arm-row" data-load="${e.id}" aria-current="${e.id === curId}" role="button" tabindex="0">${miniSvg(e.design)}<div class="t">${esc(e.titolare || 'Stemma principale')}${e.parent ? ' <span class="v">· variante</span>' : ''}</div></div>`;
    const tree = (list, parent) => list.filter(e => (e.parent || null) === parent || (parent === null && e.parent && !list.some(x => x.id === e.parent)))
      .map(e => row(e) + (list.some(x => x.parent === e.id) ? `<div class="arm-kids">${tree(list.filter(x => x.id !== e.id), e.id)}</div>` : '')).join('');
    $('#armorial').innerHTML = Object.keys(fams).sort((a, b) => a.localeCompare(b, 'it')).map(f => `<div class="fam"><div class="fam-name">${esc(f)}</div>${tree(fams[f], null)}</div>`).join('') +
      (curId ? `<div class="row" style="margin-top:10px"><button class="btn small danger" data-act="del-entry">Elimina lo stemma aperto</button></div>` : '');
  }
  function loadEntry(id) {
    const e = store.entries.find(x => x.id === id); if (!e) return;
    D = Object.assign(blank(), clone(e.design)); curId = e.id; famiglia = e.famiglia || ''; titolare = e.titolare || ''; parentId = e.parent || null; sel = null;
    store.current = id; persist(); fullRender();
  }
  function saveEntry() {
    famiglia = $('#in-famiglia').value.trim(); titolare = $('#in-titolare').value.trim();
    let e = curId && store.entries.find(x => x.id === curId);
    if (!e) { e = { id: uid() }; store.entries.push(e); curId = e.id; }
    Object.assign(e, { famiglia, titolare, parent: parentId, design: clone(D), updated: Date.now() });
    store.current = curId; store.draft = null; persist(); renderArmorial(); toast('Stemma salvato');
  }

  /* ---------- disposizioni ---------- */
  function arrange(m) {
    const cs = D.charges, n = cs.length, S = Eng.SHIELDS[D.shape];
    const top = D.capo.on ? S.capoB + 6 : 14, bot = 104, mid = (top + bot) / 2;
    let pos = [];
    if (m === 'fascia') pos = cs.map((_, i) => [50 + (i - (n - 1) / 2) * Math.min(28, 80 / n), S.fy]);
    if (m === 'palo') pos = cs.map((_, i) => [50, top + 8 + i * (bot - top - 16) / Math.max(1, n - 1)]);
    if (m === '2-1' || m === '1-2') {
      const rows = []; let left = n, first = m === '2-1' ? 2 : 1;
      while (left > 0) { const k = Math.min(left, rows.length ? (rows[rows.length - 1] === 2 ? 1 : 2) : first); rows.push(k); left -= k; }
      const rh = (bot - top) / (rows.length + 0.4);
      rows.forEach((k, r) => { for (let j = 0; j < k; j++) pos.push([50 + (j - (k - 1) / 2) * 34 * (1 - r * 0.08), top + rh * (r + 0.7)]); });
    }
    pos.forEach(([x, y], i) => { cs[i].x = Math.round(x * 10) / 10; cs[i].y = Math.round(y * 10) / 10; });
    if (m === 'fascia' || m === '2-1' || m === '1-2') cs.forEach(c => (c.s = Math.min(c.s, n > 2 ? 28 : 34)));
    changed();
  }

  /* ---------- aggiornamenti ---------- */
  function changed(noEditor) {
    if (!noEditor) renderEditor();
    renderStage(); scheduleSeal();
    store.draft = { design: D, curId, famiglia: $('#in-famiglia').value, titolare: $('#in-titolare').value, parentId };
    clearTimeout(changed._t); changed._t = setTimeout(persist, 400);
  }
  function fullRender() {
    $('#in-famiglia').value = famiglia; $('#in-titolare').value = titolare;
    renderEditor(); renderSealOpts(); renderStage(); renderArmorial(); scheduleSeal();
  }
  function setPath(path, val) {
    const ks = path.split('.'); let o = D;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = val;
  }

  /* ---------- eventi ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-set],[data-act],[data-wax],[data-load]');
    if (!b) return;
    if (b.dataset.load) { loadEntry(b.dataset.load); return; }
    if (b.dataset.wax) { store.wax = b.dataset.wax; persist(); renderSealOpts(); scheduleSeal(); return; }
    if (b.dataset.set != null && (b.tagName === 'BUTTON')) {
      const path = b.dataset.set, v = b.dataset.val;
      if (path === 'sp.mode') { SP.mode = v; persist(); renderSealOpts(); scheduleSeal(); return; }
      setPath(path, /^\d+$/.test(v) && path.endsWith('.n') ? +v : v);
      changed(); return;
    }
    const act = b.dataset.act; if (!act) return;
    if (act === 'add-fig') { const f = b.dataset.fig; D.charges.push({ fig: f, x: 50, y: Eng.SHIELDS[D.shape].fy + 6, s: 40, r: 0, t: 'oro' }); sel = D.charges.length - 1; changed(); }
    if (act === 'del-ch' && sel != null) { D.charges.splice(sel, 1); sel = null; changed(); }
    if (act === 'dup' && sel != null) { const c = clone(D.charges[sel]); c.x += 8; c.y += 8; D.charges.push(c); sel = D.charges.length - 1; changed(); }
    if (act === 'del-ord') { D.ordinaries.splice(+b.dataset.i, 1); changed(); }
    if (act === 'arrange') arrange(b.dataset.m);
    if (act === 'save') saveEntry();
    if (act === 'variant') {
      if (!curId) saveEntry();
      const base = store.entries.find(x => x.id === curId);
      parentId = curId; curId = null; titolare = ''; famiglia = base ? base.famiglia : famiglia;
      $('#in-famiglia').value = famiglia; $('#in-titolare').value = ''; $('#in-titolare').focus();
      renderArmorial(); toast('Variante pronta: modifica lo stemma, dai un nome al ramo e salva');
    }
    if (act === 'new') { D = blank(); curId = null; parentId = null; famiglia = ''; titolare = ''; sel = null; store.current = null; fullRender(); }
    if (act === 'del-entry') {
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Conferma eliminazione'; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; b.textContent = 'Elimina lo stemma aperto'; } }, 3000); return; }
      store.entries = store.entries.filter(x => x.id !== curId).map(x => x.parent === curId ? Object.assign(x, { parent: null }) : x);
      curId = null; parentId = null; store.current = null; persist(); renderArmorial(); toast('Stemma eliminato');
    }
    if (act === 'reset-sp') { Object.assign(SP, SP_DEF); persist(); renderSealOpts(); renderStage(); scheduleSeal(); }
    if (act === 'dl-head') download(nameBase() + '_testa.stl', new Blob([Eng.stl(Eng.headMesh(D, SP, inkCache || Eng.ink(D, SP)), 'testa')], { type: 'model/stl' }));
    if (act === 'dl-handle') download('manico_sigillo.stl', new Blob([Eng.stl(Eng.handleMesh(SP), 'manico')], { type: 'model/stl' }));
    if (act === 'dl-svg') {
      const L = Eng.layers(D, SP), { vb, inner } = shieldSvg(L, { id: 'clip' });
      download(nameBase() + '_stemma.svg', new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2] * 8}" height="${vb[3] * 8}">${inner}</svg>`], { type: 'image/svg+xml' }));
    }
    if (act === 'export-json') download('armoriale.json', new Blob([JSON.stringify({ app: 'sigillatore', versione: 1, entries: store.entries, local: store.local }, null, 1)], { type: 'application/json' }));
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.classList.contains('add-ord') && el.value) { D.ordinaries.push({ type: el.value, t: 'argento', line: 'dritta' }); changed(); return; }
    if (el.dataset.sp) { SP[el.dataset.sp] = el.type === 'checkbox' ? el.checked : +el.value; persist(); renderSealOpts(); renderStage(); scheduleSeal(); return; }
    if (el.dataset.set != null && el.dataset.set !== '') {
      const path = el.dataset.set;
      const v = el.type === 'checkbox' ? el.checked : el.dataset.num != null ? +el.value : el.value;
      setPath(path, v);
      if (path === 'partition') { const n = Eng.PARTS[v].labels.length; while (D.areas.length < n) D.areas.push('argento'); }
      if (path === 'capo.on' && v && D.capo.n < 1) D.capo.n = 2;
      changed();
    }
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.sp && el.type === 'range') { SP[el.dataset.sp] = +el.value; const b = el.parentElement.querySelector('b'); if (b) b.textContent = String(+el.value).replace('.', ',') + (b.textContent.match(/[^\d,.-]+$/) || [''])[0]; scheduleSeal(); if (el.dataset.sp === 'D' || el.dataset.sp === 'bw') renderStage(); return; }
    if (el.dataset.set && el.dataset.num != null) { setPath(el.dataset.set, +el.value); const b = el.parentElement.querySelector('b'); if (b) b.textContent = Math.round(+el.value) + (el.dataset.set.endsWith('.r') ? '°' : ''); requestRender(); return; }
    if (el.dataset.set && el.dataset.text != null) { setPath(el.dataset.set, el.value); renderBlazon(); store.draft = { design: D }; }
  });
  document.addEventListener('keydown', e => {
    const row = e.target.closest && e.target.closest('[data-load]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); loadEntry(row.dataset.load); }
  });
  let rq = 0;
  function requestRender() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; renderStage(); scheduleSeal(); }); }

  /* trascinamento delle figure */
  const stage = $('#stage');
  let drag = null;
  const svgPt = ev => { const p = stage.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(stage.getScreenCTM().inverse()); };
  stage.addEventListener('pointerdown', ev => {
    const h = ev.target.closest('.hit');
    if (!h) { if (sel != null) { sel = null; renderEditor(); renderStage(); } return; }
    const i = +h.dataset.i, p = svgPt(ev);
    const changedSel = sel !== i; sel = i;
    drag = { i, dx: p.x - D.charges[i].x, dy: p.y - D.charges[i].y, moved: false };
    stage.setPointerCapture(ev.pointerId); stage.classList.add('dragging');
    if (changedSel) { renderEditor(); renderStage(); }
  });
  stage.addEventListener('pointermove', ev => {
    if (!drag) return;
    const p = svgPt(ev), c = D.charges[drag.i];
    c.x = Math.round((p.x - drag.dx) * 10) / 10; c.y = Math.round((p.y - drag.dy) * 10) / 10; drag.moved = true;
    requestRender();
  });
  const endDrag = () => { if (!drag) return; const m = drag.moved; drag = null; stage.classList.remove('dragging'); if (m) changed(true); };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('keydown', ev => {
    if (sel == null) return;
    const c = D.charges[sel], st = ev.shiftKey ? 5 : 1;
    const mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[ev.key];
    if (mv) { ev.preventDefault(); c.x += mv[0]; c.y += mv[1]; changed(true); }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); D.charges.splice(sel, 1); sel = null; changed(); }
  });

  /* import / export */
  $('#in-import').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.entries)) throw new Error('formato');
      const have = new Set(store.entries.map(x => x.id));
      let n = 0; for (const x of data.entries) if (!have.has(x.id)) { store.entries.push(x); n++; }
      for (const l of data.local || []) if (!store.local.some(x => x.id === l.id)) { store.local.push(l); try { await Figures.register(l.id, l.svg, { local: true, kind: l.kind }); } catch (err) { /* figura locale illeggibile */ } }
      persist(); renderArmorial(); renderEditor(); toast(n ? `Importati ${n} stemmi` : 'Nessuno stemma nuovo nel file');
    } catch (err) { toast('Il file non è un armoriale del Sigillatore'); }
    e.target.value = '';
  });
  async function onSvgFiles(e) {
    let ok = 0;
    for (const f of e.target.files) {
      try {
        const txt = await f.text();
        const kind = /data-tipo\s*=\s*["']ornamento/.test(txt) ? 'ornamento' : 'figura';
        const id = 'locale-' + f.name.replace(/\.svg$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await Figures.register(id, txt, { local: true, kind, name: f.name.replace(/\.svg$/i, '') });
        store.local = store.local.filter(x => x.id !== id).concat([{ id, svg: txt, kind }]); ok++;
      } catch (err) { toast(f.name + ': ' + err.message); }
    }
    persist(); renderEditor();
    if (ok) toast(ok === 1 ? 'Figura aggiunta solo in questo browser: per renderla stabile mettila in resources/' : `${ok} figure aggiunte in questo browser`);
  }
  function nameBase() { return ((($('#in-famiglia').value || 'stemma') + ' ' + ($('#in-titolare').value || '')).trim()).toLowerCase().replace(/[^a-z0-9àèéìòù]+/gi, '_').replace(/^_|_$/g, '') || 'stemma'; }
  function download(name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Scaricato ' + name);
  }
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawSeal, 150); });

  /* ---------- avvio ---------- */
  (async () => {
    let errors = [];
    try { errors = await Figures.loadAll((d, n) => { $('#loading-msg').textContent = `Ricalco le figure da resources/… ${d}/${n}`; }); }
    catch (e) {
      $('#loading-msg').innerHTML = 'Non trovo <code>resources/manifest.json</code>. Apri la pagina tramite un server (per esempio <code>python3 -m http.server</code> nella cartella del progetto) oppure da GitHub Pages.';
      return;
    }
    for (const l of store.local) { try { await Figures.register(l.id, l.svg, { local: true, kind: l.kind }); } catch (e) { /* ignora */ } }
    if (!store.entries.length && !store.seeded) {
      store.entries = EXAMPLES.map(([n, d]) => ({ id: uid(), famiglia: 'Dai tuoi disegni', titolare: n, parent: null, design: d, updated: Date.now() }));
      store.seeded = true; store.current = store.entries[1].id; persist();
    }
    const draft = store.draft;
    if (draft && draft.design) { D = Object.assign(blank(), draft.design); curId = draft.curId || null; famiglia = draft.famiglia || ''; titolare = draft.titolare || ''; parentId = draft.parentId || null; }
    else if (store.current && store.entries.some(x => x.id === store.current)) { const e = store.entries.find(x => x.id === store.current); D = Object.assign(blank(), clone(e.design)); curId = e.id; famiglia = e.famiglia; titolare = e.titolare; parentId = e.parent || null; }
    $('#loading').hidden = true;
    fullRender();
    if (errors.length) toast('Alcune figure non si sono caricate: ' + errors[0]);
  })();
})();
