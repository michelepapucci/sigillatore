/* ===== Motore geometrico: stemma → rilievo → mesh ===== */
const Eng = (() => {
  const CL = ClipperLib, SC = 1000;
  const PT = CL.PolyType, CT = CL.ClipType, PFT = CL.PolyFillType, JT = CL.JoinType, ET = CL.EndType;

  function exec(ct, a, b, fill) {
    fill = fill == null ? PFT.pftNonZero : fill;
    const c = new CL.Clipper();
    if (a && a.length) c.AddPaths(a, PT.ptSubject, true);
    if (b && b.length) c.AddPaths(b, PT.ptClip, true);
    const s = [];
    c.Execute(ct, s, fill, fill);
    return s;
  }
  const union = (a, b) => exec(CT.ctUnion, a, b || []);
  const inter = (a, b) => (a.length && b.length) ? exec(CT.ctIntersection, a, b) : [];
  const diff = (a, b) => (!a.length) ? [] : (b && b.length ? exec(CT.ctDifference, a, b) : union(a));
  function offset(paths, delta, jt, et) {
    if (!paths.length) return [];
    const co = new CL.ClipperOffset(4, 0.02 * SC);
    co.AddPaths(paths, jt, et);
    const s = [];
    co.Execute(s, delta);
    return s;
  }
  const strokeClosed = (p, w) => offset(p, w / 2 * SC, JT.jtRound, ET.etClosedLine);
  const strokeOpen = (p, w) => offset(p, w / 2 * SC, JT.jtMiter, ET.etOpenButt);
  const grow = (p, d) => offset(p, d * SC, JT.jtMiter, ET.etClosedPolygon);

  /* ---------- costruttore di percorsi ---------- */
  function P() {
    const pts = []; let x0 = 0, y0 = 0;
    const o = {
      pts,
      m(x, y) { pts.push([x, y]); x0 = x; y0 = y; return o; },
      l(x, y) { pts.push([x, y]); x0 = x; y0 = y; return o; },
      c(x1, y1, x2, y2, x, y, n = 18) {
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          pts.push([u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x, u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y]);
        }
        x0 = x; y0 = y; return o;
      },
      q(x1, y1, x, y, n = 12) {
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          pts.push([u*u*x0 + 2*u*t*x1 + t*t*x, u*u*y0 + 2*u*t*y1 + t*t*y]);
        }
        x0 = x; y0 = y; return o;
      }
    };
    return o;
  }
  const circ = (cx, cy, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
  const ell = (cx, cy, rx, ry, n = 120) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos(2 * Math.PI * i / n), cy + ry * Math.sin(2 * Math.PI * i / n)]);
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const star = (n, R, r) => { const p = []; for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + Math.PI * i / n, rr = i % 2 ? r : R; p.push([rr * Math.cos(a), rr * Math.sin(a)]); } return p; };

  /* ---------- scudi (unità: 100 × 120) ---------- */
  const SHIELDS = {
    casata: { n: 'Casata', fy: 58, capoT: 6, capoB: 38, pts: () => P().m(0, 9).c(22, 7, 38, 6, 50, 0).c(62, 6, 78, 7, 100, 9).l(100, 56).c(100, 90, 80, 106, 50, 120).c(20, 106, 0, 90, 0, 56).pts },
    antico: { n: 'Antico', fy: 52, capoT: 0, capoB: 34, pts: () => P().m(0, 0).l(100, 0).l(100, 50).c(100, 88, 82, 108, 50, 120).c(18, 108, 0, 88, 0, 50).pts },
    sannitico: { n: 'Sannitico', fy: 56, capoT: 0, capoB: 34, pts: () => P().m(0, 0).l(100, 0).l(100, 94).q(100, 108, 86, 108).l(62, 108).q(53, 109, 50, 120).q(47, 109, 38, 108).l(14, 108).q(0, 108, 0, 94).pts },
    ovale: { n: 'Ovale', fy: 60, capoT: 2, capoB: 36, pts: () => ell(50, 60, 50, 60) },
  };

  /* ---------- linee di partizione ---------- */
  const E = 400;
  const LINES = {
    dritta: { n: 'Dritta', adj: '' },
    ondata: { n: 'Ondata', adj: 'ondato', adjf: 'ondata' },
    dentata: { n: 'Dentata', adj: 'dentato', adjf: 'dentata' },
    merlata: { n: 'Merlata', adj: 'merlato', adjf: 'merlata' },
  };
  // profilo della linea: coppie [t, scarto] lungo la direzione
  function profile(style, L) {
    const out = [];
    if (style === 'ondata') { const lam = 12.5, A = 1.9; for (let t = -L; t <= L; t += lam / 20) out.push([t, A * Math.sin(2 * Math.PI * t / lam)]); }
    else if (style === 'dentata') { const lam = 7, A = 2.2; for (let t = -L, i = 0; t <= L; t += lam / 2, i++) out.push([t, i % 2 ? A : -A]); }
    else if (style === 'merlata') { const lam = 14, A = 2.6; for (let t = -L, i = 0; t <= L; t += lam / 2, i++) { const w = i % 2 ? A : -A; out.push([t, w], [t + lam / 2, w]); } }
    else out.push([-L, 0], [L, 0]);
    return out;
  }
  // divide il piano lungo una linea: [lato "primo" (in alto o a destra araldica), lato "secondo"]
  function halves(fx, fy, dx, dy, style, T) {
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    let nx = dy, ny = -dx;
    if (Math.abs(ny) > 0.01 ? ny > 0 : nx > 0) { nx = -nx; ny = -ny; }
    const L = 170, pts = profile(style, L).map(([t, w]) => [fx + t * dx + w * nx, fy + t * dy + w * ny]);
    const a = pts[0], b = pts[pts.length - 1];
    const side = sg => [...pts, [b[0] + sg * E * nx + E * dx, b[1] + sg * E * ny + E * dy], [a[0] + sg * E * nx - E * dx, a[1] + sg * E * ny - E * dy]];
    const ext = [[a[0] - E * dx, a[1] - E * dy]], ext2 = [[b[0] + E * dx, b[1] + E * dy]];
    const mk = sg => [[...ext, ...pts, ...ext2, [ext2[0][0] + sg * E * nx, ext2[0][1] + sg * E * ny], [ext[0][0] + sg * E * nx, ext[0][1] + sg * E * ny]].map(p => T(...p))];
    return [mk(1), mk(-1)];
  }
  const PARTS = {
    nessuna: { n: 'Pieno', labels: ['Campo'], geo: () => [[rect(-E, -E, E, E)]] },
    partito: { n: 'Partito', labels: ['1° (destra araldica)', '2° (sinistra)'], geo: (f, T, st) => halves(50, f, 0, 1, st, T) },
    troncato: { n: 'Troncato', labels: ['1° (in capo)', '2° (in punta)'], geo: (f, T, st) => halves(50, f, 1, 0, st, T) },
    trinciato: { n: 'Trinciato', labels: ['1° (in alto)', '2° (in basso)'], geo: (f, T, st) => halves(50, f, 1, 1.1, st, T) },
    tagliato: { n: 'Tagliato', labels: ['1° (in alto)', '2° (in basso)'], geo: (f, T, st) => halves(50, f, 1, -1.1, st, T) },
    inquartato: { n: 'Inquartato', labels: ['1° quarto', '2° quarto', '3° quarto', '4° quarto'], geo: (f, T, st) => {
      const [l, r] = halves(50, f, 0, 1, st, T), [u, d] = halves(50, f, 1, 0, st, T);
      return [inter(l, u), inter(r, u), inter(l, d), inter(r, d)];
    } },
    decusse: { n: 'Inquartato in decusse', labels: ['In capo', 'Destra', 'Sinistra', 'In punta'], geo: (f, T, st) => {
      const [u1, d1] = halves(50, f, 1, 1.1, st, T), [u2, d2] = halves(50, f, 1, -1.1, st, T);
      return [inter(u1, u2), inter(u2, d1), inter(u1, d2), inter(d1, d2)];
    } },
    interzatoPalo: { n: 'Interzato in palo', labels: ['1° terzo', '2° terzo', '3° terzo'], geo: (f, T, st) => {
      const [a1, b1] = halves(33.34, f, 0, 1, st, T), [a2, b2] = halves(66.67, f, 0, 1, st, T);
      return [a1, inter(b1, a2), b2];
    } },
    interzatoFascia: { n: 'Interzato in fascia', labels: ['1° terzo', '2° terzo', '3° terzo'], geo: (f, T, st) => {
      const [a1, b1] = halves(50, 40, 1, 0, st, T), [a2, b2] = halves(50, 80, 1, 0, st, T);
      return [a1, inter(b1, a2), b2];
    } },
  };

  /* ---------- pezze onorevoli ---------- */
  const ORDS = {
    fascia: { n: 'Fascia', art: 'alla fascia', g: 'f', line: true },
    palo: { n: 'Palo', art: 'al palo', g: 'm', line: true },
    banda: { n: 'Banda', art: 'alla banda', g: 'f', line: true },
    sbarra: { n: 'Sbarra', art: 'alla sbarra', g: 'f', line: true },
    croce: { n: 'Croce', art: 'alla croce', g: 'f' },
    decusse: { n: 'Decusse', art: 'al decusse', g: 'm' },
    scaglione: { n: 'Scaglione', art: 'allo scaglione', g: 'm' },
    bordura: { n: 'Bordura', art: 'alla bordura', g: 'f' },
    campagna: { n: 'Campagna', art: 'alla campagna', g: 'f', line: true },
  };
  // striscia tra due linee parallele (con profilo) attorno a (x,y) in direzione (dx,dy), larghezza w
  function strip(x, y, dx, dy, w, st, T) {
    const l = Math.hypot(dx, dy), nx = dy / l, ny = -dx / l;
    const A = halves(x + nx * w / 2, y + ny * w / 2, dx, dy, st, T), B = halves(x - nx * w / 2, y - ny * w / 2, dx, dy, st, T);
    // il lato "secondo" della prima linea ∩ il lato "primo" della seconda
    const s1 = inter(A[0], B[1]).length ? [A[0], B[1]] : [A[1], B[0]];
    return inter(s1[0], s1[1]);
  }
  function ordGeo(o, f, T, k, shieldInt) {
    const st = o.line || 'dritta';
    const line = (x, y, dx, dy) => { const L = Math.hypot(dx, dy); dx /= L; dy /= L; return [T(x - E * dx, y - E * dy), T(x + E * dx, y + E * dy)]; };
    const band = (pts, w) => strokeOpen([pts], w * k);
    switch (o.type) {
      case 'fascia': return strip(50, f, 1, 0, 26, st, T);
      case 'palo': return strip(50, f, 0, 1, 26, st, T);
      case 'banda': return strip(50, f, 1, 1.1, 26, st, T);
      case 'sbarra': return strip(50, f, 1, -1.1, 26, st, T);
      case 'croce': return union([rect(-E, f - 11, E, f + 11).map(p => T(...p)), rect(39, -E, 61, E).map(p => T(...p))]);
      case 'decusse': return union(band(line(50, f, 1, 1.1), 20), band(line(50, f, 1, -1.1), 20));
      case 'scaglione': return band([T(-40, f + 95), T(50, f - 22), T(140, f + 95)], 22);
      case 'bordura': return diff(shieldInt, grow(shieldInt, -10 * k));
      case 'campagna': return halves(50, 92, 1, 0, st, T)[1];
    }
    return [];
  }

  /* ---------- figure: registro riempito dai file SVG in resources/ ----------
     ogni voce: { n, sg, art, pl, ar, add: [anelli], sec: [anelli] } in unità ±0.5 */
  const FIGS = {};

  /* ---------- smalti e tratteggio di Petra Sancta ---------- */
  const TINT = {
    oro: { n: 'Oro', c: '#E0B23C', of: "d'oro", metal: true, hint: 'puntini' },
    argento: { n: 'Argento', c: '#F2F1EC', of: "d'argento", metal: true, hint: 'liscio' },
    rosso: { n: 'Rosso', c: '#BE252C', of: 'di rosso', hint: 'linee verticali' },
    azzurro: { n: 'Azzurro', c: '#2556A3', of: "d'azzurro", hint: 'linee orizzontali' },
    verde: { n: 'Verde', c: '#2E8645', of: 'di verde', hint: 'diagonali in banda' },
    porpora: { n: 'Porpora', c: '#7A3E8B', of: 'di porpora', hint: 'diagonali in sbarra' },
    nero: { n: 'Nero', c: '#1D1D1D', of: 'di nero', hint: 'quadrettato' },
    armellino: { n: 'Armellino', c: '#FBFAF6', of: "d'armellino", fur: true, hint: 'moscature' },
  };

  function bounds(paths) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const p of paths) for (const q of p) { if (q.X < a) a = q.X; if (q.Y < b) b = q.Y; if (q.X > c) c = q.X; if (q.Y > d) d = q.Y; }
    return { x0: a, y0: b, x1: c, y1: d };
  }
  function hatch(t, b, P_) {
    const p = P_.hp * SC, lines = [];
    const vert = () => { for (let x = Math.floor(b.x0 / p) * p; x <= b.x1 + p; x += p) lines.push([{ X: x, Y: b.y0 - p }, { X: x, Y: b.y1 + p }]); };
    const horz = () => { for (let y = Math.floor(b.y0 / p) * p; y <= b.y1 + p; y += p) lines.push([{ X: b.x0 - p, Y: y }, { X: b.x1 + p, Y: y }]); };
    const diag = s => { const step = p * Math.SQRT2; // s=1: y = x + c ; s=-1: y = -x + c
      const cs = s > 0 ? [b.y0 - b.x1, b.y1 - b.x0] : [b.y0 + b.x0, b.y1 + b.x1];
      for (let c = Math.floor(cs[0] / step) * step; c <= cs[1] + step; c += step)
        lines.push([{ X: Math.round(b.x0 - p), Y: Math.round(s * (b.x0 - p) + c) }, { X: Math.round(b.x1 + p), Y: Math.round(s * (b.x1 + p) + c) }]); };
    switch (t) {
      case 'rosso': vert(); break;
      case 'azzurro': horz(); break;
      case 'nero': vert(); horz(); break;
      case 'verde': diag(1); break;
      case 'porpora': diag(-1); break;
      case 'oro': {
        const dp = P_.dp * SC, r = P_.dd / 2 * SC, dots = []; let row = 0;
        for (let y = Math.floor(b.y0 / dp) * dp; y <= b.y1 + dp; y += dp, row++)
          for (let x = Math.floor(b.x0 / dp) * dp + (row % 2 ? dp / 2 : 0); x <= b.x1 + dp; x += dp)
            dots.push(Array.from({ length: 10 }, (_, i) => ({ X: Math.round(x + r * Math.cos(i * Math.PI / 5)), Y: Math.round(y + r * Math.sin(i * Math.PI / 5)) })));
        return dots;
      }
      default: return [];
    }
    return strokeOpen(lines, P_.hw);
  }

  /* ---------- trasformazione scudo → mm ---------- */
  const fitCache = {};
  const ORN_W = 64;
  function ornBox(shape, id) {
    const top = Math.min(...SHIELDS[shape].pts().map(p => p[1]));
    const F = FIGS[id]; const h = ORN_W * (F ? F.ar : 0.6);
    return { x0: 50 - ORN_W / 2, x1: 50 + ORN_W / 2, y1: top + 5, y0: top + 5 - h, cy: top + 5 - h / 2 };
  }
  function fit(shape, orn) {
    const key = shape + '|' + (orn || '') + '|' + (orn && FIGS[orn] ? FIGS[orn].ar : '');
    if (fitCache[key]) return fitCache[key];
    const pts = SHIELDS[shape].pts();
    if (orn) { const b = ornBox(shape, orn); pts.push([b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]); }
    let best = null;
    for (let cy = 20; cy <= 75; cy += 0.5) {
      let m = 0; for (const [x, y] of pts) m = Math.max(m, Math.hypot(x - 50, y - cy));
      if (!best || m < best.m) best = { cy, m };
    }
    return (fitCache[key] = { cx: 50, cy: best.cy, rmax: best.m });
  }
  function frame(d, sp) {
    const fc = fit(d.shape, ornOn(d) ? d.orn.id : null);
    const rin = sp.D / 2 - (sp.frame ? 2.6 : 1.4);
    const k = rin / fc.rmax;
    const T = (x, y) => ({ X: Math.round((x - fc.cx) * k * SC), Y: Math.round((y - fc.cy) * k * SC) });
    const back = q => [q.X / SC / k + fc.cx, q.Y / SC / k + fc.cy];
    return { k, T, back, cx: fc.cx, cy: fc.cy };
  }

  const ornOn = d => !!(d.orn && d.orn.id && FIGS[d.orn.id]);
  // part: 'add' = corpo (primo smalto), 'sec' = parti rosse dell'SVG (secondo smalto)
  function figGeo(ch, T, part) {
    const F = FIGS[ch.fig]; if (!F) return [];
    const src = F[part || 'add'] || []; if (!src.length) return [];
    const a = (ch.r || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), fx = ch.flip ? -1 : 1;
    const tr = pts => pts.map(([u, v]) => T(ch.x + (fx * u * c - v * s) * ch.s, ch.y + (fx * u * s + v * c) * ch.s));
    return union(src.map(tr));
  }

  function capoSlots(n) { return n === 1 ? [50] : n === 2 ? [31, 69] : n === 3 ? [21, 50, 79] : []; }

  /* ---------- strati visibili ---------- */
  function layers(d, sp) {
    const fr = frame(d, sp), { T, k } = fr, f = SHIELDS[d.shape].fy;
    const shield = union([SHIELDS[d.shape].pts().map(p => T(...p))]);
    const L = [];
    const part = PARTS[d.partition];
    part.geo(f, T, d.line || 'dritta').forEach((ps, i) => L.push({ kind: 'area', i, t: d.areas[i] || 'argento',
      paths: inter(ps.length && Array.isArray(ps[0]) && Array.isArray(ps[0][0]) ? ps.map(p => p.map(q => T(...q))) : ps, shield) }));
    d.ordinaries.forEach((o, i) => L.push({ kind: 'ord', i, t: o.t, paths: inter(ordGeo(o, f, T, k, shield), shield) }));
    d.charges.forEach((ch, i) => {
      L.push({ kind: 'charge', i, t: ch.t, paths: inter(figGeo(ch, T), shield) });
      const sec = figGeo(ch, T, 'sec'); if (sec.length) L.push({ kind: 'charge2', i, t: ch.t2 || 'rosso', paths: inter(sec, shield) });
    });
    const S = SHIELDS[d.shape];
    if (d.capo.on) {
      L.push({ kind: 'capo', t: d.capo.t, paths: inter(halves(50, S.capoB, 1, 0, d.capo.line || 'dritta', T)[0], shield) });
      const sz = (d.capo.n === 3 ? 0.62 : 0.7) * (S.capoB - S.capoT);
      capoSlots(d.capo.n).forEach((x, i) => {
        const ch = { fig: d.capo.fig, x, y: (S.capoB + S.capoT) / 2, s: sz, r: 0 };
        L.push({ kind: 'capofig', i, t: d.capo.ft, paths: inter(figGeo(ch, T), shield) });
        const sec = figGeo(ch, T, 'sec'); if (sec.length) L.push({ kind: 'capofig2', i, t: d.capo.ft2 || 'rosso', paths: inter(sec, shield) });
      });
    }
    let covered = [];
    for (let i = L.length - 1; i >= 0; i--) {
      L[i].vis = diff(L[i].paths, covered);
      covered = union(covered, L[i].paths);
    }
    // la corona sta fuori dallo scudo
    let crown = [];
    if (ornOn(d)) {
      const b = ornBox(d.shape, d.orn.id), ch = { fig: d.orn.id, x: 50, y: b.cy, s: ORN_W, r: 0 };
      const body = figGeo(ch, T), red = figGeo(ch, T, 'sec');
      crown = [{ kind: 'orn', t: d.orn.t, paths: body, vis: diff(diff(body, red), shield) }];
      if (red.length) crown.push({ kind: 'orn2', t: d.orn.t2 || 'rosso', paths: red, vis: diff(red, shield) });
    }
    for (const l of [...L, ...crown]) if (l.t === 'armellino' && l.vis.length) l.spots = inter(ermine(bounds(l.vis), T, fr.back), l.vis);
    return { L: [...L, ...crown], shield, fr };
  }

  /* moscature d'armellino, nella scala dello scudo */
  function ermine(b, T, back) {
    const s = 9, dx = 20, dy = 17, out = [];
    const spot = [P().m(0, -.14).c(.04, .14, .12, .3, .3, .48).l(.12, .41).l(0, .55).l(-.12, .41).l(-.3, .48).c(-.12, .3, -.04, .14, 0, -.14).pts,
      circ(0, -.36, .11, 16), circ(-.21, -.2, .1, 16), circ(.21, -.2, .1, 16)];
    const [x0, y0] = back({ X: b.x0, Y: b.y0 }), [x1, y1] = back({ X: b.x1, Y: b.y1 });
    let row = Math.floor((y0 - 10) / dy);
    for (let y = row * dy; y <= y1 + 10; y += dy, row++)
      for (let x = Math.floor((x0 - 20) / dx) * dx + (row % 2 ? dx / 2 : 0); x <= x1 + 20; x += dx)
        for (const p of spot) out.push(p.map(([u, v]) => T(x + u * s, y + v * s)));
    return union(out);
  }

  /* ---------- figure da immagine: righe di pixel → contorni ---------- */
  function traceRuns(runs, w, h, smooth) {
    smooth = smooth == null ? 0.7 : smooth;
    const S = 100;
    const rects = runs.map(([y, x0, x1]) => [{ X: x0 * S, Y: y * S }, { X: x1 * S, Y: y * S }, { X: x1 * S, Y: (y + 1) * S }, { X: x0 * S, Y: (y + 1) * S }]);
    let u = union(rects);
    const off = (p, dlt) => offset(p, dlt * S, JT.jtRound, ET.etClosedPolygon);
    u = off(off(u, -smooth), smooth);
    u = off(off(u, smooth), -smooth);
    const rdp = (pts, eps) => { // Douglas-Peucker su anello chiuso
      if (pts.length < 8) return pts;
      const simp = (a, i0, i1, keep) => { let md = 0, mi = -1; const A = a[i0], B = a[i1], dx = B.X - A.X, dy = B.Y - A.Y, L = Math.hypot(dx, dy) || 1;
        for (let i = i0 + 1; i < i1; i++) { const d = Math.abs(dy * (a[i].X - A.X) - dx * (a[i].Y - A.Y)) / L; if (d > md) { md = d; mi = i; } }
        if (md > eps) { keep[mi] = 1; simp(a, i0, mi, keep); simp(a, mi, i1, keep); } };
      let far = 0, fd = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].X - pts[0].X, pts[i].Y - pts[0].Y); if (d > fd) { fd = d; far = i; } }
      const a = [...pts, pts[0]], keep = new Uint8Array(a.length); keep[0] = keep[far] = keep[a.length - 1] = 1;
      simp(a, 0, far, keep); simp(a, far, a.length - 1, keep);
      return a.filter((_, i) => keep[i] && i < a.length - 1);
    };
    u = u.filter(p => Math.abs(CL.Clipper.Area(p)) > 6 * S * S).map(p => rdp(p, 0.45 * S));
    const m = Math.max(w, h);
    return u.map(p => p.map(q => [+((q.X / S - w / 2) / m).toFixed(4), +((q.Y / S - h / 2) / m).toFixed(4)]));
  }
  function addFig(id, def) { FIGS[id] = def; }

  /* ---------- inchiostro del sigillo (in mm, verso dell'impronta) ---------- */
  function ink(d, sp, lay) {
    lay = lay || layers(d, sp);
    const parts = [];
    for (const l of lay.L) {
      if (!l.vis.length) continue;
      parts.push(...strokeClosed(l.vis, sp.ow));
      const h = hatch(l.t, bounds(l.vis), sp);
      if (h.length) parts.push(...inter(h, l.vis));
      if (l.spots) parts.push(...l.spots);
    }
    parts.push(...diff(lay.shield, grow(lay.shield, -sp.bw)), ...strokeClosed(lay.shield, sp.ow));
    if (sp.frame) parts.push(...strokeClosed([circ(0, 0, (sp.D / 2 - 1.3) * SC, 180).map(([x, y]) => ({ X: Math.round(x), Y: Math.round(y) }))], sp.ow));
    let u = union(parts);
    // elimina frammenti più sottili di quanto la stampante possa fare
    const m = Math.min(sp.hw, sp.ow) * 0.3;
    u = grow(grow(u, -m), m);
    return CL.Clipper.CleanPolygons(u, 6);
  }

  /* ---------- mesh ---------- */
  const W = q => [-q.X / SC, -q.Y / SC]; // specchiato: il timbro è il rovescio dell'impronta
  const sarea = r => { let s = 0; for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  function toPolys(paths) {
    paths = grow(grow(paths, 0.004), -0.004); // fonde i pezzi che si toccano lungo un lato
    const c = new CL.Clipper(); c.StrictlySimple = true; c.AddPaths(paths, PT.ptSubject, true);
    const tree = new CL.PolyTree(); c.Execute(CT.ctUnion, tree, PFT.pftNonZero, PFT.pftNonZero);
    const out = [];
    const walk = node => { for (const ch of node.Childs()) { const poly = { outer: ch.Contour(), holes: [] }; for (const h of ch.Childs()) { poly.holes.push(h.Contour()); walk(h); } out.push(poly); } };
    walk(tree);
    // earcut scarta i punti allineati: li togliamo prima, così pareti e facce coincidono
    const clean = r => {
      let a = r.slice(), changed = true;
      while (changed && a.length > 3) {
        changed = false;
        for (let i = 0; i < a.length && a.length > 3; i++) {
          const p = a[(i + a.length - 1) % a.length], q = a[i], s = a[(i + 1) % a.length];
          const cr = (q.X - p.X) * (s.Y - p.Y) - (q.Y - p.Y) * (s.X - p.X);
          if (cr === 0 || (q.X === p.X && q.Y === p.Y)) { a.splice(i, 1); i--; changed = true; }
        }
      }
      return a;
    };
    return out.map(p => ({ outer: clean(p.outer).map(W), holes: p.holes.map(h => clean(h).map(W)) }));
  }
  function extrude(polys, z0, z1, out) {
    for (const pl of polys) {
      const o = pl.outer.slice(); if (sarea(o) < 0) o.reverse();
      if (o.length < 3) continue;
      const hs = pl.holes.filter(h => h.length >= 3).map(h => { const a = h.slice(); if (sarea(a) > 0) a.reverse(); return a; });
      const flat = [], hi = [];
      o.forEach(p => flat.push(p[0], p[1]));
      hs.forEach(h => { hi.push(flat.length / 2); h.forEach(p => flat.push(p[0], p[1])); });
      const idx = earcut(flat, hi.length ? hi : null);
      for (let t = 0; t < idx.length; t += 3) {
        let a = idx[t], b = idx[t + 1], c = idx[t + 2];
        const cr = (flat[2*b] - flat[2*a]) * (flat[2*c+1] - flat[2*a+1]) - (flat[2*b+1] - flat[2*a+1]) * (flat[2*c] - flat[2*a]);
        if (cr < 0) { const s = b; b = c; c = s; }
        out.push(flat[2*a], flat[2*a+1], z1, flat[2*b], flat[2*b+1], z1, flat[2*c], flat[2*c+1], z1);
        out.push(flat[2*a], flat[2*a+1], z0, flat[2*c], flat[2*c+1], z0, flat[2*b], flat[2*b+1], z0);
      }
      for (const r of [o, ...hs]) for (let i = 0, n = r.length; i < n; i++) {
        const p = r[i], q = r[(i + 1) % n];
        out.push(p[0], p[1], z0, q[0], q[1], z0, q[0], q[1], z1);
        out.push(p[0], p[1], z0, q[0], q[1], z1, p[0], p[1], z1);
      }
    }
  }
  const hexPts = (af, n = 6) => { const R = af / Math.sqrt(3) * SC; return Array.from({ length: n }, (_, i) => ({ X: Math.round(R * Math.cos(Math.PI / 3 * i)), Y: Math.round(R * Math.sin(Math.PI / 3 * i)) })); };

  function headMesh(d, sp, inkPaths) {
    inkPaths = inkPaths || ink(d, sp);
    const R = sp.D / 2 * SC;
    const disc0 = [circ(0, 0, R, 200).map(([x, y]) => ({ X: Math.round(x), Y: Math.round(y) }))];
    const notch = [[{ X: -1100, Y: -R - 900 }, { X: 1100, Y: -R - 900 }, { X: 0, Y: -R + 1300 }]]; // tacca = alto del disegno
    const disc = diff(disc0, notch);
    const top = sp.mode === 'incavato' ? inter(inkPaths, disc) : diff(disc, inkPaths);
    const sock = [hexPts(sp.af + 2 * sp.cl)];
    const out = [];
    extrude(toPolys(diff(disc, sock)), 0, sp.sd, out);
    extrude(toPolys(disc), sp.sd, sp.tb, out);
    extrude(toPolys(top), sp.tb, sp.tb + sp.rd, out);
    return out;
  }

  function handleMesh(sp) {
    const prof = [[11, 0], [12.6, 1.2], [13.2, 4], [13, 9], [11.6, 13], [8.8, 17], [7.4, 23], [7.6, 31], [8.6, 41], [8.6, 49], [8.1, 53], [9.6, 55.5], [10.2, 57.5], [10.2, 61]];
    const N = 120, out = [], ztop = prof[prof.length - 1][1];
    const P3 = (r, z, j) => { const a = 2 * Math.PI * j / N; return [r * Math.cos(a), r * Math.sin(a), z]; };
    const tri = (a, b, c) => out.push(...a, ...b, ...c);
    for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < N; j++) {
      const p00 = P3(prof[i][0], prof[i][1], j), p01 = P3(prof[i][0], prof[i][1], j + 1);
      const p10 = P3(prof[i + 1][0], prof[i + 1][1], j), p11 = P3(prof[i + 1][0], prof[i + 1][1], j + 1);
      tri(p00, p01, p11); tri(p00, p11, p10);
    }
    const r0 = prof[0][0], r1 = prof[prof.length - 1][0];
    for (let j = 0; j < N; j++) {
      tri([0, 0, 0], P3(r0, 0, j + 1), P3(r0, 0, j));
      tri([0, 0, ztop], P3(r1, ztop, j), P3(r1, ztop, j + 1));
    }
    const hex = hexPts(sp.af).map(q => [q.X / SC, q.Y / SC]);
    extrude([{ outer: hex, holes: [] }], ztop, ztop + sp.sd - 0.4, out);
    return out;
  }

  function stl(tris, name) {
    const n = tris.length / 9, buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
    const hdr = ('Sigillatore ' + name).slice(0, 79);
    for (let i = 0; i < hdr.length; i++) dv.setUint8(i, hdr.charCodeAt(i) & 127);
    dv.setUint32(80, n, true);
    let o = 84;
    for (let t = 0; t < tris.length; t += 9) {
      const ax = tris[t], ay = tris[t+1], az = tris[t+2], bx = tris[t+3], by = tris[t+4], bz = tris[t+5], cx = tris[t+6], cy = tris[t+7], cz = tris[t+8];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
      for (let k = 0; k < 9; k++) { dv.setFloat32(o, tris[t + k], true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return new Uint8Array(buf);
  }

  /* ---------- zip (store) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), chunks = [], central = []; let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true);
      lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nm, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true);
      ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + sz;
    }
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  return { LINES, traceRuns, addFig, ornBox, ornOn, inter, diff, SC, SHIELDS, PARTS, ORDS, FIGS, TINT, layers, ink, headMesh, handleMesh, stl, zip, capoSlots, frame, union, figGeo };
})();
if (typeof module !== 'undefined') module.exports = Eng;
