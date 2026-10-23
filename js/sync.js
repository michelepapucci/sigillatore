/* ===== Sigillatore: archivio su un Gist privato di GitHub ===== */
const Sync = (() => {
  const API = 'https://api.github.com';
  const FILE = 'sigillatore-armoriale.json';
  const DESC = 'Sigillatore: armoriale (generato dal tool, non modificare a mano)';

  /* ---------- unione di due archivi ---------- */
  // archivio = { entries, deleted: {id: ms}, local: [{id, svg, kind, at}], sp, spAt }
  // Per ogni stemma vince la versione con `updated` più recente; un'eliminazione vince se è più recente dell'ultima modifica.
  // Il risultato non dipende dall'ordine (merge(a, b) ≡ merge(b, a) a meno dell'ordine degli stemmi), così i dispositivi convergono.
  function merge(a, b) {
    a = a || {}; b = b || {};
    const deleted = Object.assign({}, a.deleted);
    for (const [id, t] of Object.entries(b.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, t);
    const byId = new Map();
    for (const e of [...(a.entries || []), ...(b.entries || [])]) {
      const o = byId.get(e.id);
      if (!o || (e.updated || 0) > (o.updated || 0)) byId.set(e.id, e);
    }
    let entries = [...byId.values()].filter(e => !(e.id in deleted && deleted[e.id] >= (e.updated || 0)));

    // stemmi identici con id diversi (per esempio gli esempi inseriti da due browser): resta quello con l'id minore
    const alias = {};
    const res = id => { while (id && alias[id]) id = alias[id]; return id; };
    for (let pass = 0; pass < 8; pass++) {
      const seen = new Map(); let found = false;
      for (const e of [...entries].sort((x, y) => (x.id < y.id ? -1 : 1))) {
        const k = JSON.stringify([e.famiglia || '', e.titolare || '', res(e.parent) || null, e.design]);
        const keep = seen.get(k);
        if (keep) { alias[e.id] = keep.id; deleted[e.id] = Math.max(deleted[e.id] || 0, e.updated || 0); found = true; }
        else seen.set(k, e);
      }
      entries = entries.filter(e => !alias[e.id]).map(e => (e.parent && res(e.parent) !== e.parent ? Object.assign({}, e, { parent: res(e.parent) }) : e));
      if (!found) break;
    }

    const loc = new Map();
    for (const l of [...(a.local || []), ...(b.local || [])]) {
      const o = loc.get(l.id);
      if (!o || (l.at || 0) > (o.at || 0)) loc.set(l.id, l);
    }
    const bWins = (b.spAt || 0) > (a.spAt || 0);
    return { entries, deleted, local: [...loc.values()], sp: bWins ? b.sp : a.sp, spAt: Math.max(a.spAt || 0, b.spAt || 0), alias };
  }
  // forma canonica per capire se due archivi coincidono
  const canon = s => JSON.stringify({
    entries: [...(s.entries || [])].sort((x, y) => (x.id < y.id ? -1 : 1)),
    deleted: Object.keys(s.deleted || {}).sort().map(k => [k, s.deleted[k]]),
    local: [...(s.local || [])].sort((x, y) => (x.id < y.id ? -1 : 1)),
    sp: s.sp || null, spAt: s.spAt || 0,
  });

  /* ---------- API di GitHub ---------- */
  async function gh(token, path, opts) {
    opts = opts || {};
    let r;
    try {
      r = await fetch(API + path, { method: opts.method || 'GET', cache: 'no-store',
        headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token }, opts.body ? { 'Content-Type': 'application/json' } : {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined });
    } catch (e) { throw new Error('GitHub non raggiungibile (sei offline?)'); }
    if (r.status === 401) throw new Error('token non valido o scaduto');
    if (r.status === 403 || r.status === 404) throw new Error('il token non ha il permesso sui Gist');
    if (!r.ok) throw new Error('GitHub ha risposto ' + r.status);
    return r.json();
  }
  // cerca il gist dell'armoriale tra quelli dell'utente; null se non c'è
  async function find(token) {
    for (let page = 1; page <= 30; page++) {
      const list = await gh(token, `/gists?per_page=100&page=${page}`);
      const g = list.find(g => g.files && g.files[FILE]);
      if (g) return { id: g.id, url: g.html_url };
      if (list.length < 100) return null;
    }
    return null;
  }
  async function create(token, data) {
    const g = await gh(token, '/gists', { method: 'POST', body: { description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(data, null, 1) } } } });
    return { id: g.id, url: g.html_url };
  }
  async function read(token, id) {
    const g = await gh(token, '/gists/' + id), f = g.files && g.files[FILE];
    if (!f) return null;
    let txt = f.content;
    if (f.truncated) { const r = await fetch(f.raw_url, { cache: 'no-store' }); if (!r.ok) throw new Error('non riesco a leggere l’archivio completo'); txt = await r.text(); }
    try { return JSON.parse(txt); } catch (e) { throw new Error('l’archivio sul Gist è illeggibile'); }
  }
  async function write(token, id, data) {
    await gh(token, '/gists/' + id, { method: 'PATCH', body: { files: { [FILE]: { content: JSON.stringify(data, null, 1) } } } });
  }

  return { merge, canon, find, create, read, write, FILE };
})();
if (typeof module !== 'undefined') module.exports = Sync;
