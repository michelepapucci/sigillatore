/* ===== Figure da SVG =====
   Convenzione dei file in resources/ (vedi resources/LEGGIMI.md):
   nero (o qualunque colore scuro) = corpo della figura, primo smalto
   rosso puro                       = parti nel secondo smalto
   bianco o trasparente             = vuoto (dettagli interni, linee incise)
   Il file viene rasterizzato e ricalcato in contorni: qualunque SVG funziona. */
const Figures = (() => {
  const RES = 900;            // lato massimo della rasterizzazione, in pixel
  const CACHE_KEY = 'sigillatore.figcache.v2';
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { cache = {}; }
  const saveCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* cache piena: pazienza */ } };

  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length; };

  function meta(svgText, fallbackName) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') throw new Error('Il file non è un SVG valido');
    const title = doc.querySelector('title');
    const n = root.getAttribute('data-nome') || (title && title.textContent.trim()) || fallbackName;
    const low = n.toLowerCase();
    return {
      n,
      sg: root.getAttribute('data-singolare') || 'un ' + low,
      art: root.getAttribute('data-articolo') || 'al ' + low,
      pl: root.getAttribute('data-plurale') || low,
      blasone: root.getAttribute('data-blasone') || '',
      secondo: root.getAttribute('data-secondo') || '',   // participio per le parti nel secondo smalto, es. "punteggiata"
      tipo: root.getAttribute('data-tipo') || '',
      doc, root,
    };
  }

  function size(root) {
    const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] };
    const w = parseFloat(root.getAttribute('width')) || 100, h = parseFloat(root.getAttribute('height')) || 100;
    return { w, h };
  }

  async function raster(svgText, m) {
    const { w, h } = size(m.root);
    const sc = RES / Math.max(w, h), W = Math.max(8, Math.round(w * sc)), H = Math.max(8, Math.round(h * sc));
    m.root.setAttribute('width', W); m.root.setAttribute('height', H);
    if (!m.root.getAttribute('viewBox')) m.root.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const txt = new XMLSerializer().serializeToString(m.doc);
    const url = URL.createObjectURL(new Blob([txt], { type: 'image/svg+xml' }));
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Il browser non riesce a disegnare questo SVG')); i.src = url; });
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, W, H);
      return { W, H, px: cx.getImageData(0, 0, W, H).data };
    } finally { URL.revokeObjectURL(url); }
  }

  function runsOf(W, H, px) {
    const sil = [], sec = [];
    for (let y = 0; y < H; y++) {
      let s0 = -1, r0 = -1;
      for (let x = 0; x <= W; x++) {
        let c = 0;
        if (x < W) {
          const i = (y * W + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
          if (a >= 128 && !(r > 200 && g > 200 && b > 200)) c = (r > 150 && g < 110 && b < 110) ? 2 : 1;
        }
        if (c && s0 < 0) s0 = x; if (!c && s0 >= 0) { sil.push([y, s0, x]); s0 = -1; }
        if (c === 2 && r0 < 0) r0 = x; if (c !== 2 && r0 >= 0) { sec.push([y, r0, x]); r0 = -1; }
      }
    }
    return { sil, sec };
  }

  /* carica un SVG (testo) e lo registra nel motore con l'id dato */
  async function register(id, svgText, opts) {
    opts = opts || {};
    const m = meta(svgText, opts.name || id);
    const key = id + ':' + hash(svgText);
    let geo = cache[key];
    if (!geo) {
      const { W, H, px } = await raster(svgText, m);
      const { sil, sec } = runsOf(W, H, px);
      if (!sil.length) throw new Error('Nessuna forma scura trovata: la figura va disegnata in nero');
      geo = { ar: +(H / W).toFixed(4), add: Eng.traceRuns(sil, W, H, 0.6), sec: sec.length ? Eng.traceRuns(sec, W, H, 0.6) : [] };
      for (const k of Object.keys(cache)) if (k.startsWith(id + ':')) delete cache[k];
      cache[key] = geo; saveCache();
    }
    const def = { n: m.n, sg: m.sg, art: m.art, pl: m.pl, blasone: m.blasone, secondo: m.secondo, ar: geo.ar, add: geo.add, sec: geo.sec,
      kind: opts.kind || m.tipo || 'figura', src: opts.src || ('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText)), local: !!opts.local };
    Eng.addFig(id, def);
    return def;
  }

  /* legge resources/manifest.json e registra tutto */
  async function loadAll(onProgress) {
    const res = await fetch('resources/manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('resources/manifest.json non trovato');
    const man = await res.json();
    const jobs = [];
    for (const [folder, kind] of [['figure', 'figura'], ['ornamenti', 'ornamento']])
      for (const f of man[folder] || []) jobs.push({ url: `resources/${folder}/${f}`, id: f.replace(/\.svg$/i, ''), kind });
    let done = 0; const errors = [];
    await Promise.all(jobs.map(async j => {
      try {
        const txt = await (await fetch(j.url, { cache: 'no-cache' })).text();
        await register(j.id, txt, { kind: j.kind, src: j.url });
      } catch (e) { errors.push(j.url + ': ' + e.message); }
      onProgress && onProgress(++done, jobs.length);
    }));
    return errors;
  }

  return { register, loadAll };
})();
