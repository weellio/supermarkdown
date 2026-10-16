/* Super Markdown - app logic. Plain browser JavaScript, no build step, no network. */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = document.documentElement;
const BUILD = '{{BUILD}}';

/* ---------------- icons (inline so exported pages keep them) ---------------- */
const ICONS = {
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  open: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 18v-6m-3 3 3-3 3 3"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sliders: '<path d="M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 21h16"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3.5v.01"/>',
  reload: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  note: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/>',
  tip: '<path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
  important: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4m0 3v.01"/>',
  warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4m0 4v.01"/>',
  caution: '<path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z"/><path d="M12 8v4m0 4v.01"/>',
};
const icon = name => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
for (const el of $$('[data-icon]')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));

/* ---------------- storage (never required to work) ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('supermd:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('supermd:' + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem('supermd:' + k); } catch { /* ignore */ } },
};

/* ---------------- toasts ---------------- */
function toast(msg, kind = 'info', ms = 3200) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), kind === 'error' ? Math.max(ms, 6000) : ms);
}

/* ---------------- settings ---------------- */
const DEFAULTS = { theme: 'auto', font: 'readable', size: 18, lineHeight: 1.7, spacing: 0, width: 'medium', cards: false, ruler: false, numbers: false, codeWrap: false, breaks: false, math: true, watch: true, remember: true, sidebar: true };
const PRESETS = {
  standard: { font: 'readable', size: 18, lineHeight: 1.7, spacing: 0, width: 'medium', cards: false, ruler: false },
  comfort: { font: 'readable', size: 20, lineHeight: 1.85, spacing: 0.02, width: 'medium', cards: true, ruler: false },
  dyslexia: { font: 'readable', size: 21, lineHeight: 2, spacing: 0.06, width: 'narrow', cards: true, ruler: true, theme: 'paper' },
  compact: { font: 'sans', size: 16, lineHeight: 1.55, spacing: 0, width: 'wide', cards: false, ruler: false },
};
const THEMES = [['auto', 'Auto'], ['light', 'Light'], ['paper', 'Paper'], ['mint', 'Mint'], ['dark', 'Dark'], ['night', 'Night'], ['contrast', 'Contrast']];
const DARK = new Set(['dark', 'night', 'contrast']);
const RERENDER_KEYS = new Set(['breaks', 'math']);

let S = Object.assign({}, DEFAULTS, store.get('settings', {}));
for (const k of Object.keys(S)) if (!(k in DEFAULTS) || typeof S[k] !== typeof DEFAULTS[k]) S[k] = DEFAULTS[k];

const mqDark = matchMedia('(prefers-color-scheme: dark)');
const resolvedTheme = () => (S.theme === 'auto' ? (mqDark.matches ? 'dark' : 'light') : S.theme);
const isDark = () => DARK.has(resolvedTheme());
const isNarrow = () => innerWidth <= 900;
let mobileSide = false;

function applySettings({ rerender = false } = {}) {
  const wasDark = DARK.has(root.dataset.theme);
  root.dataset.theme = resolvedTheme();
  root.dataset.font = S.font;
  root.dataset.width = S.width;
  root.style.setProperty('--fs', S.size + 'px');
  root.style.setProperty('--lh', S.lineHeight);
  root.style.setProperty('--ls', S.spacing + 'em');
  root.style.setProperty('--ws', (S.spacing * 2).toFixed(3) + 'em');
  root.classList.toggle('cards', S.cards);
  root.classList.toggle('numbers', S.numbers);
  root.classList.toggle('code-wrap', S.codeWrap);
  applySidebar();
  $('#ruler').hidden = !S.ruler || !current;
  syncSettingsUI();
  store.set('settings', S);
  if (current && (rerender || (wasDark !== isDark() && $('#doc .mermaid-block')))) renderCurrent({ keepScroll: true });
}

function applySidebar() {
  const show = current && (isNarrow() ? mobileSide : S.sidebar);
  root.classList.toggle('side-off', !show);
  $('#scrim').hidden = !(show && isNarrow());
}

function syncSettingsUI() {
  $('#themes').innerHTML = THEMES.map(([id, label]) => `<button class="sw${S.theme === id ? ' on' : ''}" data-t="${id}" title="${label}"><i>Aa</i>${label}</button>`).join('');
  for (const el of $$('#settings [data-set]')) {
    const k = el.dataset.set;
    if (el.type === 'checkbox') el.checked = !!S[k];
    else if (el.type === 'range') el.value = S[k];
    else el.classList.toggle('on', String(S[k]) === el.dataset.val);
  }
  const fmt = { size: v => v + 'px', lineHeight: v => (+v).toFixed(2), spacing: v => (+v).toFixed(2) + 'em' };
  for (const o of $$('#settings [data-out]')) o.textContent = fmt[o.dataset.out](S[o.dataset.out]);
  for (const b of $$('#presets button')) {
    const p = PRESETS[b.dataset.preset];
    b.classList.toggle('on', Object.keys(p).every(k => S[k] === p[k]));
  }
}

function setSetting(k, v) {
  if (S[k] === v) return;
  S[k] = v;
  applySettings({ rerender: RERENDER_KEYS.has(k) });
  if (k === 'remember') { if (v) persistDocs(); else store.del('docs'); }
}

$('#settings').addEventListener('input', e => {
  const el = e.target.closest('[data-set]');
  if (!el) return;
  const k = el.dataset.set;
  setSetting(k, el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value);
});
$('#settings').addEventListener('click', e => {
  const seg = e.target.closest('button[data-set]');
  if (seg) return setSetting(seg.dataset.set, seg.dataset.val);
  const sw = e.target.closest('.sw');
  if (sw) return setSetting('theme', sw.dataset.t);
  const pre = e.target.closest('[data-preset]');
  if (pre) { Object.assign(S, PRESETS[pre.dataset.preset]); applySettings(); }
});
mqDark.addEventListener?.('change', () => { if (S.theme === 'auto') applySettings(); });

/* ---------------- lazily loaded libraries (mermaid, katex) ---------------- */
const libs = {};
function loadLib(name) {
  if (!libs[name]) libs[name] = new Promise((resolve, reject) => {
    const holder = document.getElementById('lib-' + name);
    if (!holder) return reject(new Error('not included in the ' + BUILD + ' build'));
    try {
      const s = document.createElement('script');
      s.textContent = holder.textContent.replace(/</g, '<');
      document.head.appendChild(s);
      s.remove();
      holder.remove();
    } catch (err) { return reject(err); }
    const lib = window[name];
    if (!lib) return reject(new Error(name + ' failed to start'));
    const css = document.getElementById('lib-' + name + '-css');
    if (css) {
      const st = document.createElement('style');
      st.id = name + '-style';
      st.textContent = css.textContent;
      document.head.appendChild(st);
    }
    resolve(lib);
  });
  return libs[name];
}

/* ---------------- markdown engine ---------------- */
const mathBlock = {
  name: 'mathBlock', level: 'block',
  start(src) { const i = src.indexOf('$$'); return i < 0 ? undefined : i; },
  tokenizer(src) {
    const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/.exec(src);
    if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
  },
  renderer: t => `<div class="math math-display pending">${esc(t.text)}</div>\n`,
};
const mathInline = {
  name: 'mathInline', level: 'inline',
  start(src) { const i = src.indexOf('$'); return i < 0 ? undefined : i; },
  tokenizer(src) {
    let m = /^\$\$((?:\\.|[^\\$])+?)\$\$/.exec(src);
    if (m) return { type: 'mathInline', raw: m[0], text: m[1].trim(), display: true };
    // $x$ - must hug its content and not be followed by a digit, so "$5 and $10" stays text
    m = /^\$(?![\s$])((?:\\.|[^\\$\n])+?)(?<![\s\\])\$(?!\d)/.exec(src);
    if (m) return { type: 'mathInline', raw: m[0], text: m[1], display: false };
  },
  renderer: t => `<span class="math ${t.display ? 'math-display' : 'math-inline'} pending">${esc(t.text)}</span>`,
};
const markExt = {
  name: 'mark', level: 'inline',
  start(src) { const i = src.indexOf('=='); return i < 0 ? undefined : i; },
  tokenizer(src) {
    const m = /^==(?=\S)([^\n]*?\S)==(?!=)/.exec(src);
    if (m) return { type: 'mark', raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) };
  },
  renderer(t) { return `<mark>${this.parser.parseInline(t.tokens)}</mark>`; },
};

const engines = {};
function engine(breaks, math) {
  const key = `${breaks}|${math}`;
  if (!engines[key]) {
    const m = new marked.Marked({ gfm: true, breaks });
    if (window.markedFootnote) m.use(markedFootnote({ description: 'Footnotes' }));
    m.use({ extensions: math ? [mathBlock, mathInline, markExt] : [markExt] });
    engines[key] = m;
  }
  return engines[key];
}

let purifyReady = false;
function sanitize(html) {
  if (!purifyReady) {
    DOMPurify.addHook('afterSanitizeAttributes', node => {
      // keep images from loading until we have resolved their real location
      if (node.tagName === 'IMG' && node.hasAttribute('src')) {
        node.setAttribute('data-src', node.getAttribute('src'));
        node.removeAttribute('src');
      }
      if (node.tagName === 'IMG') node.removeAttribute('srcset');
    });
    purifyReady = true;
  }
  return DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true, ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'form', 'button', 'select', 'textarea'] });
}

/* front matter: a small, forgiving YAML subset */
function splitFrontMatter(src) {
  const m = /^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(src);
  if (!m) return { meta: null, body: src };
  const meta = parseYamlLite(m[1]);
  return meta ? { meta, body: src.slice(m[0].length) } : { meta: null, body: src };
}
function parseYamlLite(text) {
  const out = [];
  let last = null, block = null;
  for (const line of text.split('\n')) {
    if (!line.trim() || /^\s*#/.test(line)) { if (block && last) last[1] += '\n'; continue; }
    const kv = /^([A-Za-z0-9_][\w .-]*?)\s*:(?:\s+(.*))?$/.exec(line);
    if (kv && !/^\s/.test(line)) {
      let v = (kv[2] || '').trim();
      block = v === '|' || v === '>' || v === '|-' || v === '>-';
      if (block) v = '';
      else if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map(x => unquote(x.trim())).filter(Boolean);
      else v = unquote(v);
      last = [kv[1], v];
      out.push(last);
      continue;
    }
    if (!last) return null;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && !block) {
      if (!Array.isArray(last[1])) last[1] = last[1] ? [last[1]] : [];
      last[1].push(unquote(item[1].trim()));
    } else if (/^\s/.test(line)) {
      const piece = line.trim();
      if (Array.isArray(last[1])) last[1].push(piece);
      else last[1] += (last[1] && !last[1].endsWith('\n') ? (block ? '\n' : ' ') : '') + piece;
    } else return null;
  }
  return out.length ? out : null;
}
function unquote(s) { return /^(["']).*\1$/.test(s) ? s.slice(1, -1) : s; }

function renderMeta(meta) {
  const d = document.createElement('details');
  d.className = 'frontmatter';
  d.open = true;
  d.innerHTML = '<summary>Document info</summary><dl>' + meta.map(([k, v]) =>
    `<dt>${esc(k)}</dt><dd>${Array.isArray(v) ? v.map(x => `<span class="tag">${esc(x)}</span>`).join('') : esc(String(v).trim())}</dd>`).join('') + '</dl>';
  return d;
}

/* ---------------- documents ---------------- */
const MD_EXT = /\.(md|markdown|mdown|mkd|mkdn|mdwn|mdx|rmd|qmd|txt|text)$/i;
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i;
const CODE_EXT = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', py: 'python',
  rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', cs: 'csharp', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', php: 'php', sh: 'bash',
  bash: 'bash', ps1: 'powershell', psm1: 'powershell', bat: 'dos', cmd: 'dos', sql: 'sql', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini',
  cfg: 'ini', conf: 'ini', xml: 'xml', html: 'xml', htm: 'xml', css: 'css', scss: 'scss', less: 'less', lua: 'lua', r: 'r', swift: 'swift',
  vb: 'vbnet', pl: 'perl', csv: 'plaintext', tsv: 'plaintext', log: 'plaintext', diff: 'diff', patch: 'diff', dockerfile: 'dockerfile',
};
const extOf = name => { const m = /\.([^./\\]+)$/.exec(name); return m ? m[1].toLowerCase() : name.toLowerCase(); };

let docs = [];
let current = null;
let seq = 0;
const assets = new Map();      // normalised path -> File (images from dropped folders)
const assetUrls = new Map();   // File -> object URL
const positions = store.get('pos', {});

function normPath(p) {
  const parts = [];
  for (const seg of String(p).replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return parts.join('/').toLowerCase();
}
const dirOf = p => { const i = String(p).replace(/\\/g, '/').lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); };

function kindFor(name) {
  const ext = extOf(name);
  if (ext === 'txt' || ext === 'text') return 'text';
  if (MD_EXT.test(name)) return 'md';
  if (CODE_EXT[ext] || /^dockerfile$/i.test(name)) return 'code';
  return 'md';
}

function upsertDoc(d) {
  const key = normPath(d.path || d.name);
  let doc = docs.find(x => normPath(x.path || x.name) === key && !x.pasted && !d.pasted);
  if (doc) Object.assign(doc, d);
  else { doc = Object.assign({ id: 'd' + Date.now().toString(36) + (++seq) }, d); docs.push(doc); }
  return doc;
}

function decode(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes);
  if (bytes.subarray(0, 8000).includes(0)) throw new Error("this doesn't look like a text file");
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
}
async function readText(file) {
  if (file.size > 60 * 1024 * 1024) throw new Error('the file is over 60 MB');
  return decode(new Uint8Array(await file.arrayBuffer()));
}

async function ingest(list, { folder = false } = {}) {
  const opened = [];
  let images = 0;
  for (const { file, path, handle } of list) {
    if (IMG_EXT.test(file.name)) { assets.set(normPath(path || file.name), file); images++; continue; }
    const kind = kindFor(file.name);
    if (folder && kind !== 'md' && kind !== 'text') continue;
    try {
      const text = await readText(file);
      opened.push(upsertDoc({ name: file.name, path: path || file.name, text, kind, handle: handle || null, lastModified: file.lastModified }));
    } catch (err) {
      toast(`Couldn't open ${file.name}: ${err.message}`, 'error');
    }
  }
  if (folder) docs.sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name, undefined, { numeric: true, sensitivity: 'base' }));
  if (opened.length) {
    const first = folder ? (opened.find(d => /(^|\/)(readme|index)\.md$/i.test(d.path)) || opened.slice().sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0]) : opened[0];
    openDoc(first.id);
    if (opened.length > 1) { showTab('files'); toast(`Opened ${opened.length} documents. They are listed under Files.`); }
  } else if (images && current) {
    renderCurrent({ keepScroll: true });
    toast(`Added ${images} image${images > 1 ? 's' : ''}.`);
  } else if (images) {
    toast('Those were only images. Drop the Markdown file too.');
  } else if (list.length && folder) {
    toast('No Markdown files found in that folder.', 'error');
  }
  renderFiles();
  persistDocs();
}

function openText(name, text, { unique = true } = {}) {
  const doc = upsertDoc({ name, path: name, text, kind: 'md', handle: null, lastModified: Date.now(), pasted: unique });
  openDoc(doc.id);
  renderFiles();
  persistDocs();
}

function openDoc(id) {
  const doc = docs.find(d => d.id === id);
  if (!doc) return;
  if (current && current !== doc) positions[current.id] = scrollY;
  current = doc;
  closeSearch();
  setSource(false);
  root.classList.remove('no-doc');
  $('#welcome').hidden = true;
  $('#doc').hidden = false;
  renderCurrent();
  scrollTo(0, positions[doc.id] || 0);
  renderFiles();
  applySettings();
  store.set('active', doc.id);
  updateLive();
}

function closeDoc(id = current?.id) {
  const i = docs.findIndex(d => d.id === id);
  if (i < 0) return;
  docs.splice(i, 1);
  delete positions[id];
  if (current?.id === id) {
    current = null;
    const next = docs[i] || docs[i - 1];
    if (next) openDoc(next.id); else showWelcome();
  }
  renderFiles();
  persistDocs();
}

function showWelcome() {
  if (current) positions[current.id] = scrollY;
  current = null;
  closeSearch();
  setSource(false);
  root.classList.add('no-doc');
  $('#doc').hidden = true;
  $('#doc').replaceChildren();
  $('#welcome').hidden = false;
  $('#doc-title').textContent = '';
  $('#stats').textContent = '';
  document.title = 'Super Markdown';
  $('#outline').replaceChildren();
  renderRecent();
  applySettings();
  updateLive();
  scrollTo(0, 0);
}

function persistDocs() {
  if (!S.remember) return;
  let budget = 1.8e6;
  const keep = [];
  for (const d of [current, ...docs.filter(d => d !== current)].filter(Boolean)) {
    if (d.text.length > budget || keep.length >= 15) continue;
    budget -= d.text.length;
    keep.push({ id: d.id, name: d.name, path: d.path, text: d.text, kind: d.kind, pasted: !!d.pasted, lastModified: d.lastModified });
  }
  while (keep.length && !store.set('docs', keep)) keep.pop();
  if (current) store.set('active', current.id);
}
addEventListener('pagehide', () => {
  if (current) positions[current.id] = scrollY;
  const ids = new Set(docs.map(d => d.id));
  for (const k of Object.keys(positions)) if (!ids.has(k)) delete positions[k];
  store.set('pos', positions);
});

/* ---------------- rendering ---------------- */
let renderSeq = 0;
let hasDiagrams = false;

function renderCurrent({ keepScroll = false } = {}) {
  const doc = current;
  if (!doc) return;
  const y = scrollY;
  const mine = ++renderSeq;
  const article = $('#doc');
  let src = doc.text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let meta = null;
  if (doc.kind === 'code') {
    const longest = Math.max(2, ...(src.match(/`+/g) || []).map(s => s.length));
    const fence = '`'.repeat(longest + 1);
    src = `${fence}${CODE_EXT[extOf(doc.name)] || ''}\n${src}\n${fence}`;
  } else if (doc.kind === 'md') {
    ({ meta, body: src } = splitFrontMatter(src));
  }
  let frag;
  try {
    frag = sanitize(engine(S.breaks || doc.kind === 'text', S.math && doc.kind !== 'code').parse(src));
  } catch (err) {
    console.error(err);
    toast('Part of this document could not be formatted, so it is shown as plain text.', 'error');
    frag = document.createDocumentFragment();
    const pre = document.createElement('pre');
    pre.textContent = doc.text;
    frag.append(pre);
  }
  article.replaceChildren();
  if (meta) article.append(renderMeta(meta));
  article.append(frag);
  enhance(article, doc);

  const title = (meta && (meta.find(([k]) => /^title$/i.test(k)) || [])[1]) || article.querySelector('h1')?.textContent.trim() || doc.name;
  $('#doc-title').textContent = String(title);
  $('#doc-title').title = doc.path || doc.name;
  document.title = String(title) + ' - Super Markdown';
  const clone = article.cloneNode(true);
  for (const el of $$('pre, .frontmatter, .footnotes, svg', clone)) el.remove();
  const words = (clone.textContent.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  $('#stats').textContent = words ? `${words.toLocaleString()} words · ${Math.max(1, Math.round(words / 230))} min read` : '';
  $('#source').textContent = doc.text;

  buildOutline();
  if (keepScroll) scrollTo(0, y);
  renderMath(article, mine);
  renderDiagrams(article, mine).then(() => { if (keepScroll && mine === renderSeq) scrollTo(0, y); });
  onScroll();
}

function slugify(text) {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-') || 'section';
}

function enhance(article, doc) {
  // heading ids
  const used = new Set();
  for (const h of $$('h1, h2, h3, h4, h5, h6', article)) {
    let id = h.id && !used.has(h.id) ? h.id : slugify(h.textContent);
    let n = 1, base = id;
    while (used.has(id) || (document.getElementById(id) && !article.contains(document.getElementById(id)))) id = `${base}-${n++}`;
    used.add(id);
    h.id = id;
  }

  // callouts: > [!NOTE] title
  const KINDS = { note: 'note', info: 'note', todo: 'note', abstract: 'note', summary: 'note', question: 'note', faq: 'note', help: 'note', example: 'note', quote: 'note',
    tip: 'tip', hint: 'tip', success: 'tip', check: 'tip', done: 'tip', important: 'important',
    warning: 'warning', attention: 'warning', caution: 'caution', danger: 'caution', error: 'caution', bug: 'caution', failure: 'caution', fail: 'caution' };
  for (const bq of $$('blockquote', article)) {
    const p = bq.firstElementChild;
    const t = p && p.tagName === 'P' ? p.firstChild : null;
    if (!t || t.nodeType !== 3) continue;
    const m = /^\s*\[!([A-Za-z]+)\]([+-]?)[ \t]*([^\n]*)(\n|$)/.exec(t.nodeValue);
    if (!m) continue;
    const word = m[1].toLowerCase();
    const kind = KINDS[word] || 'note';
    t.nodeValue = t.nodeValue.slice(m[0].length);
    if (!p.textContent.trim() && !p.querySelector('img, code, a')) p.remove();
    else if (p.firstChild && p.firstChild.nodeName === 'BR') p.firstChild.remove();
    const collapsible = m[2] !== '';
    const box = document.createElement(collapsible ? 'details' : 'div');
    box.className = 'callout ' + kind;
    if (collapsible && m[2] === '+') box.open = true;
    const head = document.createElement(collapsible ? 'summary' : 'div');
    head.className = 'callout-title';
    head.innerHTML = icon(kind);
    head.append(m[3].trim() || word.charAt(0).toUpperCase() + word.slice(1));
    const body = document.createElement('div');
    body.className = 'callout-body';
    body.append(...bq.childNodes);
    box.append(head, body);
    bq.replaceWith(box);
  }

  // code blocks
  for (const pre of $$('pre', article)) {
    const code = pre.querySelector(':scope > code');
    if (!code) continue;
    const lang = ((/(?:^|\s)language-([\w#+.-]+)/.exec(code.className) || [])[1] || '').toLowerCase();
    if (lang === 'mermaid') {
      const box = document.createElement('div');
      box.className = 'mermaid-block';
      box.dataset.src = code.textContent;
      box.innerHTML = '<div class="mermaid-note">Diagram</div>';
      const raw = document.createElement('pre');
      raw.textContent = code.textContent;
      box.append(raw);
      pre.replaceWith(box);
      continue;
    }
    if ((lang === 'math' || lang === 'latex' || lang === 'tex' || lang === 'katex') && S.math) {
      const div = document.createElement('div');
      div.className = 'math math-display pending';
      div.textContent = code.textContent.trim();
      pre.replaceWith(div);
      continue;
    }
    const text = code.textContent;
    if (lang && lang !== 'text' && lang !== 'plaintext' && text.length < 300000 && window.hljs && hljs.getLanguage(lang)) {
      try { code.innerHTML = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value; code.classList.add('hljs'); } catch { /* leave plain */ }
    }
    const box = document.createElement('div');
    box.className = 'codeblock';
    const label = (window.hljs && lang && hljs.getLanguage(lang)?.name) || lang || 'text';
    box.innerHTML = `<div class="code-head"><span>${esc(label)}</span><button class="icon-btn small" data-act="copy-code" title="Copy this code">${icon('copy')}<span>Copy</span></button></div>`;
    pre.replaceWith(box);
    box.append(pre);
  }

  // tables
  for (const table of $$('table', article)) {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    table.replaceWith(wrap);
    wrap.append(table);
    const rows = table.tBodies[0]?.rows.length || 0;
    if (rows > 1) for (const th of $$('thead th', table)) { th.classList.add('sortable'); th.tabIndex = 0; th.title = 'Sort by this column'; }
  }

  // task lists
  for (const box of $$('li input[type="checkbox"]', article)) {
    const li = box.closest('li');
    if (!li) continue;
    li.classList.add('task');
    if (box.checked) li.classList.add('done');
    box.disabled = true;
  }

  // links
  const base = dirOf(doc.path || doc.name);
  for (const a of $$('a[href]', article)) {
    const href = a.getAttribute('href');
    if (/^#/.test(href)) continue;
    if (/^(https?:|mailto:|tel:|ftp:)/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; continue; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    const [pathPart, hash = ''] = href.split('#');
    let target = null;
    try { target = findDoc(base + decodeURIComponent(pathPart)); } catch { target = findDoc(base + pathPart); }
    if (target) { a.dataset.doc = target.id; a.dataset.hash = hash; a.title = 'Open ' + target.name; }
    else { a.classList.add('missing-link'); a.dataset.missing = pathPart; a.title = pathPart + ' (not loaded)'; }
  }

  // images
  for (const img of $$('img[data-src]', article)) {
    const src = img.dataset.src;
    img.loading = 'lazy';
    img.decoding = 'async';
    if (/^(https?:|data:image\/|blob:)/i.test(src) || src.startsWith('//')) { img.src = src; continue; }
    const file = findAsset(base, src);
    if (file) {
      if (!assetUrls.has(file)) assetUrls.set(file, URL.createObjectURL(file));
      img.src = assetUrls.get(file);
    } else {
      const ph = document.createElement('span');
      ph.className = 'img-missing';
      ph.innerHTML = icon('image');
      ph.append(`${img.alt || 'Image'} (${src} is not loaded. Open the folder to see it.)`);
      img.replaceWith(ph);
    }
  }
  for (const img of $$('img', article)) img.addEventListener('error', () => img.classList.add('broken'), { once: true });

  // sections: wrap each top-level section so it can become a card
  const heads = $$(':scope > h2:not(.sr-only)', article);
  const level = heads.length ? 'H2' : ($$(':scope > h1', article).length > 1 ? 'H1' : null);
  if (level) {
    let sec = null;
    for (const node of Array.from(article.childNodes)) {
      const isHead = node.nodeType === 1 && node.tagName === level && !node.classList.contains('sr-only');
      const isFoot = node.nodeType === 1 && node.classList.contains('footnotes');
      if (isFoot) { sec = null; continue; }
      if (isHead) { sec = document.createElement('section'); sec.className = 'sec'; node.before(sec); }
      if (sec) sec.append(node);
    }
  }
}

function findDoc(path) {
  const want = normPath(path);
  const strip = p => p.replace(/\.(md|markdown|mdx|txt)$/i, '');
  return docs.find(d => normPath(d.path || d.name) === want)
    || docs.find(d => strip(normPath(d.path || d.name)) === strip(want))
    || null;
}
function findAsset(base, src) {
  let rel = src.split(/[?#]/)[0];
  try { rel = decodeURIComponent(rel); } catch { /* keep raw */ }
  const exact = assets.get(normPath(base + rel)) || assets.get(normPath(rel));
  if (exact) return exact;
  const name = normPath(rel).split('/').pop();
  const hits = [...assets.entries()].filter(([k]) => k.split('/').pop() === name);
  return hits.length === 1 ? hits[0][1] : null;
}

async function renderMath(article, mine) {
  const els = $$('.math.pending', article);
  if (!els.length) return;
  let katex;
  try { katex = await loadLib('katex'); }
  catch (err) { for (const el of els) { el.classList.remove('pending'); el.title = 'Math rendering is ' + err.message; } return; }
  if (mine !== renderSeq) return;
  for (const el of els) {
    try {
      katex.render(el.textContent, el, { displayMode: el.classList.contains('math-display'), throwOnError: false, output: 'htmlAndMathml', strict: 'ignore', trust: false });
      el.classList.remove('pending');
    } catch (err) { el.classList.replace('pending', 'failed'); el.title = String(err.message || err); }
  }
}

let mermaidSeq = 0;
async function renderDiagrams(article, mine) {
  const blocks = $$('.mermaid-block', article);
  hasDiagrams = blocks.length > 0;
  if (!blocks.length) return;
  let mermaid;
  try { mermaid = await loadLib('mermaid'); }
  catch (err) { for (const b of blocks) b.querySelector('.mermaid-note').textContent = 'Diagram (drawing is ' + err.message + ')'; return; }
  if (mine !== renderSeq) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: isDark() ? 'dark' : 'default', fontFamily: getComputedStyle(article).fontFamily, flowchart: { htmlLabels: false } });
  for (const b of blocks) {
    const id = 'smd-mermaid-' + (++mermaidSeq);
    try {
      const { svg } = await mermaid.render(id, b.dataset.src);
      if (mine !== renderSeq) return;
      b.innerHTML = svg;
    } catch (err) {
      if (mine !== renderSeq) return;
      b.classList.add('error');
      b.querySelector('.mermaid-note').textContent = 'This diagram has an error: ' + String(err.message || err).split('\n')[0];
    } finally {
      // mermaid leaves its scratch container in <body> (and the svg there on failure)
      document.getElementById('d' + id)?.remove();
      const stray = document.getElementById(id);
      if (stray && !b.contains(stray)) stray.remove();
    }
  }
}

/* ---------------- outline + scroll tracking ---------------- */
let outlineLinks = [];
function buildOutline() {
  const nav = $('#outline');
  const heads = $$('#doc h1, #doc h2, #doc h3, #doc h4').filter(h => !h.classList.contains('sr-only') && !h.closest('.callout, details:not(.sec)'));
  const min = Math.min(...heads.map(h => +h.tagName[1]), 9);
  nav.innerHTML = heads.length ? heads.map(h => {
    const lvl = Math.min(4, +h.tagName[1] - min + 1);
    return `<a href="#${esc(h.id)}" class="l${lvl}" data-id="${esc(h.id)}">${esc(h.textContent.trim())}</a>`;
  }).join('') : '<div class="empty">This document has no headings.</div>';
  outlineLinks = $$('a', nav);
  filterOutline();
}
function filterOutline() {
  const q = $('#outline-filter').value.trim().toLowerCase();
  for (const a of outlineLinks) a.hidden = !!q && !a.textContent.toLowerCase().includes(q);
}
$('#outline-filter').addEventListener('input', filterOutline);

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    $('#progress').style.transform = `scaleX(${current && max > 0 ? Math.min(1, scrollY / max) : 0})`;
    if (!outlineLinks.length) return;
    let active = null;
    for (const a of outlineLinks) {
      const h = document.getElementById(a.dataset.id);
      if (h && h.getBoundingClientRect().top < 140) active = a; else if (h) break;
    }
    active = active || outlineLinks[0];
    for (const a of outlineLinks) a.classList.toggle('active', a === active);
    if (active && !isNarrow()) {
      const pane = $('#pane-outline'), r = active.getBoundingClientRect(), pr = pane.getBoundingClientRect();
      if (r.top < pr.top + 40 || r.bottom > pr.bottom - 20) pane.scrollTop += r.top - pr.top - pr.height / 3;
    }
  });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { applySidebar(); onScroll(); });

function goToId(id) {
  let el = document.getElementById(id);
  if (!el) { try { el = document.getElementById(decodeURIComponent(id)); } catch { /* ignore */ } }
  if (!el) el = document.getElementById(slugify(id));
  if (!el || !$('#doc').contains(el)) return false;
  for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
  el.scrollIntoView({ block: 'start' });
  if (!el.matches('h1,h2,h3,h4,h5,h6')) { el.animate?.([{ background: 'var(--mark)' }, { background: 'transparent' }], { duration: 1600 }); }
  if (isNarrow() && mobileSide) { mobileSide = false; applySidebar(); }
  return true;
}

/* ---------------- files list + recent ---------------- */
function renderFiles() {
  const list = $('#filelist');
  $('#files-count').textContent = docs.length || '';
  $('.side-tabs [data-tab="files"]').hidden = docs.length < 2;
  if (docs.length < 2 && !$('#pane-files').hidden) showTab('outline');
  list.innerHTML = docs.length ? docs.map(d => {
    const dir = dirOf(d.path || '').replace(/\/$/, '');
    return `<div class="file${d === current ? ' active' : ''}"><button data-open="${d.id}" title="${esc(d.path || d.name)}"><span class="fname">${esc(d.name)}</span>${dir ? `<span class="fpath">${esc(dir)}</span>` : ''}</button><button class="icon-btn small" data-close="${d.id}" title="Close" aria-label="Close ${esc(d.name)}">${icon('x')}</button></div>`;
  }).join('') : '<div class="empty">No documents open.</div>';
}
$('#filelist').addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c) return closeDoc(c.dataset.close);
  const o = e.target.closest('[data-open]');
  if (o) { openDoc(o.dataset.open); if (isNarrow()) { mobileSide = false; applySidebar(); } }
});
function showTab(tab) {
  for (const b of $$('.side-tabs button')) b.classList.toggle('active', b.dataset.tab === tab);
  $('#pane-outline').hidden = tab !== 'outline';
  $('#pane-files').hidden = tab !== 'files';
}
$('.side-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });

function renderRecent() {
  const box = $('#recent');
  box.hidden = !docs.length;
  $('#recent-list').innerHTML = docs.map(d => {
    const dir = dirOf(d.path || '').replace(/\/$/, '');
    return `<button data-open-recent="${d.id}"><span class="rname">${esc(d.name)}</span><span class="rpath">${esc(dir)}</span></button>`;
  }).join('');
}
$('#recent-list').addEventListener('click', e => { const b = e.target.closest('[data-open-recent]'); if (b) openDoc(b.dataset.openRecent); });

/* ---------------- live reload (Chromium: dropped or picked files) ---------------- */
let checking = false;
function updateLive() { $('#live-chip').hidden = !(current && current.handle && S.watch); }
setInterval(async () => {
  const doc = current;
  if (checking || !doc || !doc.handle || !S.watch || document.hidden) return;
  checking = true;
  try {
    const f = await doc.handle.getFile();
    if (f.lastModified !== doc.lastModified) {
      doc.text = await readText(f);
      doc.lastModified = f.lastModified;
      if (doc === current) renderCurrent({ keepScroll: true });
      persistDocs();
    }
  } catch {
    doc.handle = null;
    updateLive();
    toast(`Stopped watching ${doc.name}. It may have been moved or deleted.`);
  } finally { checking = false; }
}, 1200);

/* ---------------- opening files ---------------- */
async function openFilePicker() {
  if (window.showOpenFilePicker) {
    try {
      const handles = await showOpenFilePicker({ multiple: true, types: [{ description: 'Markdown and text', accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'] } }], excludeAcceptAllOption: false });
      const list = [];
      for (const h of handles) list.push({ file: await h.getFile(), path: h.name, handle: h });
      return ingest(list);
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  $('#file-input').click();
}
$('#file-input').addEventListener('change', e => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  ingest(files.map(f => ({ file: f, path: f.name })));
});
$('#folder-input').addEventListener('change', e => {
  const files = Array.from(e.target.files || []).filter(f => (MD_EXT.test(f.name) || IMG_EXT.test(f.name)) && !/(^|\/)(node_modules|\.git)\//.test(f.webkitRelativePath));
  e.target.value = '';
  ingest(files.slice(0, 5000).map(f => ({ file: f, path: f.webkitRelativePath || f.name })), { folder: true });
});

function readEntries(reader) {
  return new Promise((resolve, reject) => {
    const all = [];
    const next = () => reader.readEntries(batch => { if (!batch.length) resolve(all); else { all.push(...batch); next(); } }, reject);
    next();
  });
}
async function walk(entry, out, depth = 0) {
  if (out.length >= 5000 || depth > 15) return;
  if (entry.isFile) {
    if (MD_EXT.test(entry.name) || IMG_EXT.test(entry.name)) {
      try { out.push({ file: await new Promise((res, rej) => entry.file(res, rej)), path: entry.fullPath.replace(/^\//, '') }); } catch { /* unreadable */ }
    }
    return;
  }
  if (/^(node_modules|\.git|\.svn|\.hg|__pycache__|\.venv|venv)$/i.test(entry.name) && depth > 0) return;
  let children = [];
  try { children = await readEntries(entry.createReader()); } catch { return; }
  for (const child of children) await walk(child, out, depth + 1);
}

let dragDepth = 0;
const hasFiles = e => Array.from(e.dataTransfer?.types || []).some(t => t === 'Files' || t === 'text/plain');
addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('#drop-overlay').hidden = false; });
addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('#drop-overlay').hidden = true; } });
addEventListener('drop', async e => {
  e.preventDefault();
  dragDepth = 0;
  $('#drop-overlay').hidden = true;
  const dt = e.dataTransfer;
  if (!dt) return;
  // everything on the DataTransfer must be grabbed before the first await
  const items = Array.from(dt.items || []).filter(i => i.kind === 'file');
  const grabbed = items.map(i => ({
    entry: i.webkitGetAsEntry ? i.webkitGetAsEntry() : null,
    file: i.getAsFile(),
    handle: i.getAsFileSystemHandle ? i.getAsFileSystemHandle().catch(() => null) : null,
  }));
  if (!items.length && dt.files?.length) for (const f of dt.files) grabbed.push({ entry: null, file: f, handle: null });
  const text = !grabbed.length ? dt.getData('text/plain') : '';
  if (text.trim()) return openText('Dropped text', text);

  const list = [];
  let folder = false;
  for (const g of grabbed) {
    if (g.entry && g.entry.isDirectory) { folder = true; await walk(g.entry, list); continue; }
    if (!g.file) continue;
    const h = g.handle ? await g.handle : null;
    list.push({ file: g.file, path: g.file.name, handle: h && h.kind === 'file' ? h : null });
  }
  if (list.length) ingest(list, { folder });
});

/* paste anywhere */
addEventListener('paste', e => {
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  const files = Array.from(e.clipboardData?.files || []);
  if (files.length) { e.preventDefault(); return ingest(files.map(f => ({ file: f, path: f.name }))); }
  const text = e.clipboardData?.getData('text/plain') || '';
  if (text.trim()) { e.preventDefault(); openText('Pasted note', text); }
});

/* ---------------- search ---------------- */
let hits = [], hitIdx = -1, searchTimer = 0;
function openSearch() {
  if (!current) return;
  setSource(false);
  $('#searchbar').hidden = false;
  const input = $('#search-input');
  const sel = String(getSelection() || '').trim();
  if (sel && sel.length < 80 && !sel.includes('\n')) input.value = sel;
  input.focus();
  input.select();
  if (input.value) runSearch(input.value);
}
function closeSearch() {
  $('#searchbar').hidden = true;
  clearHits();
  $('#search-count').textContent = '';
}
function clearHits() {
  const parents = new Set();
  for (const m of $$('#doc mark.hit')) { parents.add(m.parentNode); m.replaceWith(document.createTextNode(m.textContent)); }
  for (const p of parents) p.normalize();
  hits = []; hitIdx = -1;
}
function runSearch(q) {
  clearHits();
  q = q.trim().toLowerCase();
  if (q.length < 1) { $('#search-count').textContent = ''; return; }
  const walker = document.createTreeWalker($('#doc'), NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement && !n.parentElement.closest('svg, .katex, .code-head, script, style') && n.nodeValue.toLowerCase().includes(q)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue, lower = text.toLowerCase();
    const frag = document.createDocumentFragment();
    let i = 0, j;
    while ((j = lower.indexOf(q, i)) !== -1 && hits.length < 2000) {
      if (j > i) frag.append(text.slice(i, j));
      const m = document.createElement('mark');
      m.className = 'hit';
      m.textContent = text.slice(j, j + q.length);
      frag.append(m);
      hits.push(m);
      i = j + q.length;
    }
    frag.append(text.slice(i));
    node.replaceWith(frag);
  }
  if (hits.length) {
    // jump to the first match below the current view
    const idx = hits.findIndex(m => m.getBoundingClientRect().top > 90);
    gotoHit(idx < 0 ? 0 : idx);
  } else $('#search-count').textContent = 'No matches';
}
function gotoHit(i) {
  if (!hits.length) return;
  hits[hitIdx]?.classList.remove('current');
  hitIdx = (i + hits.length) % hits.length;
  const m = hits[hitIdx];
  m.classList.add('current');
  for (let p = m.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
  m.scrollIntoView({ block: 'center' });
  $('#search-count').textContent = `${hitIdx + 1} of ${hits.length}${hits.length >= 2000 ? '+' : ''}`;
}
$('#search-input').addEventListener('input', e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(e.target.value), 140); });
$('#search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchTimer); if (!hits.length) runSearch(e.target.value); else gotoHit(hitIdx + (e.shiftKey ? -1 : 1)); }
  else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
});

/* ---------------- misc actions ---------------- */
function setSource(on) {
  $('#source').hidden = !on;
  $('#doc').hidden = on || !current;
  for (const b of $$('[data-act="source"]')) {
    const label = Array.from(b.childNodes).find(n => n.nodeType === 3 && n.nodeValue.trim());
    if (label) label.nodeValue = on ? 'Show formatted document' : 'Show Markdown source';
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* ignore */ }
  ta.remove();
  return ok;
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function fileToDataUrl(file) {
  return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(file); });
}

async function exportHtml() {
  if (!current) return;
  clearHits();
  const clone = $('#doc').cloneNode(true);
  clone.hidden = false;
  for (const b of $$('.code-head .icon-btn', clone)) b.remove();
  const byUrl = new Map([...assetUrls].map(([f, u]) => [u, f]));
  for (const img of $$('img', clone)) {
    const f = byUrl.get(img.getAttribute('src'));
    if (f) img.src = (await fileToDataUrl(f)) || img.src;
  }
  const css = $('#app-css').textContent + ($('#katex-style')?.textContent || '');
  const title = $('#doc-title').textContent || current.name;
  const html = `<!doctype html>
<html lang="en" data-theme="${root.dataset.theme}" data-font="${root.dataset.font}" data-width="${root.dataset.width}" class="${esc([...root.classList].filter(c => ['cards', 'numbers', 'code-wrap'].includes(c)).join(' '))}" style="${esc(root.getAttribute('style') || '')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${css}</style>
</head>
<body class="export">
<main id="main">
<article id="doc" class="md">
${clone.innerHTML}
</article>
</main>
</body>
</html>`;
  download(current.name.replace(/\.[^.]+$/, '') + '.html', html, 'text/html');
  toast('Saved as an HTML page. Check your Downloads folder.');
}

function sortTable(th) {
  const table = th.closest('table');
  const body = table.tBodies[0];
  if (!body) return;
  const col = Array.from(th.parentNode.children).indexOf(th);
  const dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
  for (const other of $$('th', table)) other.removeAttribute('aria-sort');
  th.setAttribute('aria-sort', dir);
  const val = r => (r.cells[col]?.textContent || '').trim();
  const num = s => { const n = parseFloat(s.replace(/[$€£,%\s]/g, '')); return /^[-+]?[$€£]?[\d,.]+%?$/.test(s.replace(/\s/g, '')) && !isNaN(n) ? n : null; };
  const rows = Array.from(body.rows);
  rows.sort((a, b) => {
    const x = val(a), y = val(b), nx = num(x), ny = num(y);
    const r = nx != null && ny != null ? nx - ny : x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'ascending' ? r : -r;
  });
  body.append(...rows);
}

function nextHeading(step) {
  const heads = $$('#doc h1, #doc h2, #doc h3').filter(h => !h.classList.contains('sr-only') && h.offsetParent);
  if (!heads.length) return;
  const tops = heads.map(h => h.getBoundingClientRect().top - 80);
  let i = step > 0 ? tops.findIndex(t => t > 2) : tops.map(t => t < -2).lastIndexOf(true);
  if (i >= 0) heads[i].scrollIntoView({ block: 'start' });
}

function togglePop(id, force) {
  const el = $(id);
  const show = force ?? el.hidden;
  for (const p of ['#menu', '#settings']) if (p !== id) $(p).hidden = true;
  el.hidden = !show;
  for (const b of $$('[data-act="settings"]')) b.classList.toggle('on', !$('#settings').hidden);
}

const actions = {
  'open-file': openFilePicker,
  'open-folder': async () => {
    if (window.showDirectoryPicker) {
      try {
        const dir = await showDirectoryPicker({ mode: 'read' });
        const list = [];
        const walkHandle = async (h, prefix, depth) => {
          for await (const child of h.values()) {
            if (list.length >= 5000) return;
            if (child.kind === 'directory') { if (depth < 15 && !/^(node_modules|\.git|\.svn|__pycache__|\.venv|venv)$/i.test(child.name)) await walkHandle(child, prefix + child.name + '/', depth + 1); }
            else if (MD_EXT.test(child.name) || IMG_EXT.test(child.name)) list.push({ file: await child.getFile(), path: prefix + child.name, handle: child });
          }
        };
        await walkHandle(dir, dir.name + '/', 0);
        return ingest(list, { folder: true });
      } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    $('#folder-input').click();
  },
  paste: () => { $('#paste-dlg').showModal(); $('#paste-text').focus(); },
  'paste-go': () => {
    const text = $('#paste-text').value;
    if (!text.trim()) return toast('Nothing to show yet. Paste some Markdown first.');
    $('#paste-dlg').close();
    openText(($('#paste-name').value.trim() || 'Pasted note'), text);
    $('#paste-text').value = '';
    $('#paste-name').value = '';
  },
  sample: () => openText('Sample - what Super Markdown can show.md', $('#sample-md').textContent.replace(/</g, '<'), { unique: false }),
  help: () => $('#help-dlg').showModal(),
  'dlg-close': (el) => el.closest('dialog').close(),
  sidebar: () => { if (!current) return; if (isNarrow()) mobileSide = !mobileSide; else S.sidebar = !S.sidebar; applySettings(); },
  settings: () => togglePop('#settings'),
  menu: () => togglePop('#menu'),
  home: () => showWelcome(),
  search: () => ($('#searchbar').hidden ? openSearch() : closeSearch()),
  'search-next': () => gotoHit(hitIdx + 1),
  'search-prev': () => gotoHit(hitIdx - 1),
  'search-close': closeSearch,
  source: () => { if (current) setSource($('#source').hidden); },
  'copy-md': async () => { if (current) toast((await copyText(current.text)) ? 'Markdown copied.' : 'Copy was blocked by the browser.'); },
  'copy-code': async (el) => {
    const code = el.closest('.codeblock').querySelector('pre').textContent;
    const ok = await copyText(code);
    const label = el.querySelector('span');
    label.textContent = ok ? 'Copied' : 'Blocked';
    setTimeout(() => { label.textContent = 'Copy'; }, 1400);
  },
  print: () => window.print(),
  export: exportHtml,
  close: () => closeDoc(),
  reload: async () => {
    if (!current) return;
    if (!current.handle) return toast('To reload, drop the file here again. (This browser did not give a live link to it.)');
    try { const f = await current.handle.getFile(); current.text = await readText(f); current.lastModified = f.lastModified; renderCurrent({ keepScroll: true }); persistDocs(); toast('Reloaded.'); }
    catch { toast('Could not reload. The file may have moved.', 'error'); }
  },
  reset: () => { S = Object.assign({}, DEFAULTS); applySettings({ rerender: true }); toast('Options reset.'); },
  forget: () => { docs = []; store.del('docs'); store.del('active'); store.del('pos'); renderFiles(); renderRecent(); toast('Forgot all saved documents.'); },
};

document.addEventListener('click', e => {
  const actEl = e.target.closest('[data-act]');
  if (actEl && actions[actEl.dataset.act]) {
    e.preventDefault();
    const act = actEl.dataset.act;
    if (actEl.closest('#menu')) $('#menu').hidden = true;
    actions[act](actEl);
    return;
  }
  // close popovers on outside click
  if (!e.target.closest('#menu, #settings')) { $('#menu').hidden = true; if (!$('#settings').hidden) togglePop('#settings', false); }

  const a = e.target.closest('#doc a[href]');
  if (a) {
    const href = a.getAttribute('href');
    if (href.startsWith('#')) { e.preventDefault(); goToId(href.slice(1)); return; }
    if (a.dataset.doc) { e.preventDefault(); openDoc(a.dataset.doc); if (a.dataset.hash) setTimeout(() => goToId(a.dataset.hash), 60); return; }
    if (a.dataset.missing !== undefined) { e.preventDefault(); toast(`"${a.dataset.missing}" is not open. Open its folder to follow links between files.`); return; }
    return;
  }
  const o = e.target.closest('#outline a');
  if (o) { e.preventDefault(); goToId(o.dataset.id); return; }
  const th = e.target.closest('#doc th.sortable');
  if (th) return sortTable(th);
  const img = e.target.closest('#doc img');
  if (img && img.src && !img.closest('a')) { $('#lightbox img').src = img.src; $('#lightbox img').alt = img.alt; $('#lightbox').hidden = false; }
});
$('#lightbox').addEventListener('click', () => { $('#lightbox').hidden = true; });
$('#scrim').addEventListener('click', () => { mobileSide = false; applySidebar(); });
$('#paste-text').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) actions['paste-go'](); });

/* reading ruler */
let rulerY = 0, rulerRaf = 0;
addEventListener('pointermove', e => {
  if (!S.ruler || !current) return;
  rulerY = e.clientY;
  if (!rulerRaf) rulerRaf = requestAnimationFrame(() => {
    rulerRaf = 0;
    const r = $('#ruler');
    r.style.transform = `translateY(${rulerY - r.offsetHeight / 2}px)`;
  });
}, { passive: true });

/* print: open folded sections so they appear on paper */
let reopened = [];
addEventListener('beforeprint', () => { clearHits(); reopened = $$('#doc details:not([open])'); for (const d of reopened) d.open = true; });
addEventListener('afterprint', () => { for (const d of reopened) d.open = false; reopened = []; });

/* keyboard */
document.addEventListener('keydown', e => {
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && e.key.toLowerCase() === 'o') { e.preventDefault(); return openFilePicker(); }
  if (mod && !e.altKey && e.key.toLowerCase() === 'f' && current) { e.preventDefault(); return openSearch(); }
  if (e.key === 'Escape') {
    if (!$('#lightbox').hidden) return void ($('#lightbox').hidden = true);
    if (!$('#searchbar').hidden) return closeSearch();
    if (!$('#menu').hidden || !$('#settings').hidden) { $('#menu').hidden = true; return togglePop('#settings', false); }
    if (!$('#source').hidden) return setSource(false);
    if (isNarrow() && mobileSide) { mobileSide = false; return applySidebar(); }
    return;
  }
  if (typing || mod || e.altKey) return;
  if (e.key === 'Enter' && e.target.matches?.('th.sortable')) return sortTable(e.target);
  const k = e.key;
  if (k === '?') { e.preventDefault(); return actions.help(); }
  if (k === 't' || k === 'T') { const i = THEMES.findIndex(([id]) => id === S.theme); const next = THEMES[(i + 1) % THEMES.length]; setSetting('theme', next[0]); return toast('Theme: ' + next[1], 'info', 1200); }
  if (k === '+' || k === '=') return setSetting('size', Math.min(30, S.size + 1));
  if (k === '-' || k === '_') return setSetting('size', Math.max(13, S.size - 1));
  if (!current) return;
  if (k === '/') { e.preventDefault(); return openSearch(); }
  if (k === '[') return actions.sidebar();
  if (k === 'r' || k === 'R') return setSetting('ruler', !S.ruler);
  if (k === 'v' || k === 'V') return actions.source();
  if (k === 'j' || k === 'J') return nextHeading(1);
  if (k === 'k' || k === 'K') return nextHeading(-1);
  if (k === ',' || k === '.') {
    if (docs.length < 2) return;
    const i = docs.indexOf(current);
    return openDoc(docs[(i + (k === '.' ? 1 : -1) + docs.length) % docs.length].id);
  }
});

/* ---------------- start ---------------- */
function boot() {
  root.classList.add('no-doc');
  if (!window.marked || !window.DOMPurify) {
    document.body.innerHTML = '<p style="padding:40px;font:16px system-ui">Super Markdown could not start: this copy of the file is damaged. Please get a fresh copy.</p>';
    return;
  }
  applySettings();
  renderFiles();
  const saved = S.remember ? store.get('docs', []) : [];
  if (Array.isArray(saved)) for (const d of saved) if (d && typeof d.text === 'string' && d.id) docs.push(Object.assign({ handle: null }, d));
  renderFiles();
  const active = docs.find(d => d.id === store.get('active', null));
  if (active) openDoc(active.id); else showWelcome();
}
boot();
})();
