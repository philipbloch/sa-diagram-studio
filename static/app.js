/* ── Mermaid theme vars ── */
const MERMAID_THEMES = {
  dark: {
    background:            '#0f1623',
    primaryColor:          '#1a2e4a',
    primaryBorderColor:    '#2d4a6e',
    primaryTextColor:      '#c8d8f0',
    secondaryColor:        '#0f1623',
    tertiaryColor:         '#162035',
    lineColor:             '#3d5888',
    textColor:             '#a0b8d8',
    mainBkg:               '#1a2e4a',
    nodeBorder:            '#2d4a6e',
    clusterBkg:            '#0f1623',
    clusterBorder:         '#243044',
    defaultLinkColor:      '#4a6888',
    titleColor:            '#96bf48',
    edgeLabelBackground:   '#162035',
    fontFamily:            'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize:              '13px',
    actorBkg:              '#1a2e4a',
    actorBorder:           '#2d4a6e',
    actorTextColor:        '#c8d8f0',
    actorLineColor:        '#3d5888',
    signalColor:           '#96bf48',
    signalTextColor:       '#e8edf5',
    labelBoxBkgColor:      '#162035',
    labelBoxBorderColor:   '#243044',
    labelTextColor:        '#a0b8d8',
    loopTextColor:         '#a0b8d8',
    noteBkgColor:          '#1e3850',
    noteBorderColor:       '#2d4a6e',
    noteTextColor:         '#c8d8f0',
    activationBkgColor:    '#243044',
    activationBorderColor: '#96bf48',
  },
  light: {
    background:            '#ffffff',
    primaryColor:          '#eaf4ef',
    primaryBorderColor:    '#b3d4c8',
    primaryTextColor:      '#202223',
    secondaryColor:        '#f6f6f7',
    tertiaryColor:         '#f0f9f5',
    lineColor:             '#6d7175',
    textColor:             '#374151',
    mainBkg:               '#eaf4ef',
    nodeBorder:            '#b3d4c8',
    clusterBkg:            '#f6f6f7',
    clusterBorder:         '#e1e3e5',
    defaultLinkColor:      '#6d7175',
    titleColor:            '#008060',
    edgeLabelBackground:   '#f6f6f7',
    fontFamily:            'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize:              '13px',
    actorBkg:              '#eaf4ef',
    actorBorder:           '#b3d4c8',
    actorTextColor:        '#202223',
    actorLineColor:        '#6d7175',
    signalColor:           '#008060',
    signalTextColor:       '#202223',
    labelBoxBkgColor:      '#f6f6f7',
    labelBoxBorderColor:   '#e1e3e5',
    labelTextColor:        '#6d7175',
    loopTextColor:         '#6d7175',
    noteBkgColor:          '#e6f4ef',
    noteBorderColor:       '#008060',
    noteTextColor:         '#202223',
    activationBkgColor:    '#e1e3e5',
    activationBorderColor: '#008060',
  }
};

function initMermaid(theme) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    themeVariables: MERMAID_THEMES[theme],
  });
}

/* ── Theme switching ── */
let currentTheme = localStorage.getItem('theme') || 'light';

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
  document.getElementById('iconDark').style.display  = theme === 'dark'  ? 'block' : 'none';
  document.getElementById('iconLight').style.display = theme === 'light' ? 'block' : 'none';
  localStorage.setItem('theme', theme);
}

async function toggleTheme() {
  const next = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  initMermaid(next);
  for (const [type, code] of Object.entries(codes)) {
    await renderDiagram(type, code);
  }
}

// Init on load
initMermaid(currentTheme);
applyTheme(currentTheme);


/* ── Diagram metadata ── */
const META = {
  target_architecture: {
    icon: '🏗️', label: 'Target Architecture',
    desc: 'Shopify target-state: storefront, core platform & enterprise systems',
    accent: '#96bf48', wide: false,
  },
  data_flow: {
    icon: '🔀', label: 'Data Flow',
    desc: 'Product sync, order chain, inventory, customer events & analytics pipeline',
    accent: '#5c6ac4', wide: true,
  },
  integration_map: {
    icon: '🔌', label: 'Integration Map',
    desc: 'Full integration topology — all third-party systems and connection types',
    accent: '#f49342', wide: false,
  },
  migration_phases: {
    icon: '📋', label: 'Migration Phases',
    desc: 'Programme roadmap from Discovery through Post-Launch Optimisation',
    accent: '#47c1bf', wide: true,
  },
  sequence: {
    icon: '⏱️', label: 'Order Sequence',
    desc: 'End-to-end order lifecycle: checkout → ERP/OMS → fulfillment → tracking',
    accent: '#e3821e', wide: false,
  },
};

const RENDER_ORDER = ['target_architecture', 'data_flow', 'integration_map', 'migration_phases', 'sequence'];

const codes = {};

/* ── Input mode ── */
let inputMode = 'drive';
let extractedPdfText = '';
let driveText = '';
let driveFileName = '';

function switchInputMode(mode) {
  inputMode = mode;
  document.getElementById('description').style.display = mode === 'paste' ? 'block' : 'none';
  document.getElementById('pdfZone').style.display     = mode === 'pdf'   ? 'block' : 'none';
  document.getElementById('driveZone').style.display   = mode === 'drive' ? 'block' : 'none';
  document.getElementById('tab-paste').classList.toggle('active', mode === 'paste');
  document.getElementById('tab-pdf').classList.toggle('active', mode === 'pdf');
  document.getElementById('tab-drive').classList.toggle('active', mode === 'drive');
  validateInput();
}

function validateInput() {
  let hasContent;
  if (inputMode === 'pdf')        hasContent = !!extractedPdfText;
  else if (inputMode === 'drive') hasContent = !!driveText;
  else                            hasContent = !!document.getElementById('description').value.trim();
  const hasSource = !!document.getElementById('sourcePlatform').value;
  const hasTier   = !!document.getElementById('shopifyTier').value;
  const hasArch   = !!document.getElementById('archStyle').value;
  document.getElementById('generateBtn').disabled = !(hasContent && hasSource && hasTier && hasArch);
}

/* ── Google Drive ── */
function extractDriveFileId(url) {
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{20,})/,
    /[?&]id=([a-zA-Z0-9_-]{20,})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

async function driveLoad() {
  const url = document.getElementById('driveUrl').value.trim();
  if (!url) return;
  const fileId = extractDriveFileId(url);
  if (!fileId) {
    setDriveStatus('error', 'Could not extract a file ID from this URL. Make sure it\'s a Google Drive link.');
    return;
  }
  const btn = document.getElementById('driveLoadBtn');
  btn.disabled = true; btn.textContent = 'Loading…';
  driveText = ''; driveFileName = '';
  validateInput();
  setDriveStatus('loading', 'Fetching file from Google Drive…');
  try {
    const res  = await fetch('/drive-fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, file_name: '' }),
    });
    const data = await res.json();
    if (!res.ok) { setDriveStatus('error', data.error || 'Could not load file.'); return; }
    driveText     = data.text;
    driveFileName = data.name;
    setDriveStatus('success',
      `✓ "${data.name}" attached (${data.text.length.toLocaleString()} chars) — ready to generate`);
    validateInput();
  } catch (err) {
    setDriveStatus('error', 'Load error: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Attach';
  }
}

function setDriveStatus(type, msg) {
  const el = document.getElementById('driveStatus');
  el.className = 'drive-status ' + type;
  el.style.display = 'flex';
  el.textContent = msg;
}
function clearDriveStatus() {
  if (driveText) { driveText = ''; driveFileName = ''; validateInput(); }
  document.getElementById('driveStatus').style.display = 'none';
}

/* ── Drag-and-drop ── */
function onDragOver(e) {
  e.preventDefault();
  document.getElementById('pdfDropzone').classList.add('drag-over');
}
function onDragLeave(e) {
  document.getElementById('pdfDropzone').classList.remove('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('pdfDropzone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handlePdfFile(file);
}

/* ── PDF extraction ── */
async function handlePdfFile(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    setPdfStatus('error', 'Only PDF files are supported.');
    return;
  }
  extractedPdfText = '';
  setPdfStatus('loading', `Extracting text from "${file.name}"…`);

  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch('/extract-pdf', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      setPdfStatus('error', data.error || 'Extraction failed.');
      return;
    }
    extractedPdfText = data.text;
    setPdfStatus('success',
      `✓ "${file.name}" — ${data.pages} page${data.pages !== 1 ? 's' : ''} extracted (${extractedPdfText.length.toLocaleString()} chars)`,
      true
    );
    validateInput();
  } catch (err) {
    setPdfStatus('error', 'Upload error: ' + err.message);
  }
}

function setPdfStatus(type, msg, showClear = false) {
  const el = document.getElementById('pdfStatus');
  el.className = 'pdf-status ' + type;
  el.style.display = 'flex';
  el.innerHTML = msg + (showClear
    ? ' <button class="pdf-clear" onclick="clearPdf()">✕ Clear</button>'
    : '');
}

function clearPdf() {
  extractedPdfText = '';
  document.getElementById('pdfFileInput').value = '';
  document.getElementById('pdfStatus').style.display = 'none';
  validateInput();
}

/* ── Generate ── */
async function generate() {
  let description;
  if (inputMode === 'pdf') {
    if (!extractedPdfText) { showError('Please upload and extract a PDF first.'); return; }
    description = extractedPdfText;
  } else if (inputMode === 'drive') {
    if (!driveText) { showError('Please select a file from Google Drive first.'); return; }
    description = driveText;
  } else {
    description = document.getElementById('description').value.trim();
    if (!description) { showError('Please enter a migration description.'); return; }
  }

  setLoading(true);
  hideError();
  document.getElementById('placeholders').style.display = 'grid';
  document.getElementById('diagramsGrid').innerHTML = '';
  document.getElementById('saveBar').style.display = 'none';
  setStatus('Generating Shopify migration diagrams with Claude Opus');

  Object.keys(codes).forEach(k => delete codes[k]);

  try {
    const res = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        source_platform: document.getElementById('sourcePlatform').value,
        shopify_tier:    document.getElementById('shopifyTier').value,
        architecture_style: document.getElementById('archStyle').value,
      })
    });

    const data = await res.json();
    if (!res.ok) { showError(data.error || 'Something went wrong.'); return; }

    const keys = RENDER_ORDER.filter(k => data[k])
      .concat(Object.keys(data).filter(k => !RENDER_ORDER.includes(k) && data[k]));

    let i = 0;
    for (const type of keys) {
      i++;
      codes[type] = data[type];
      setStatus(`Rendering diagram ${i} of ${keys.length}: ${(META[type] || {}).label || type}`);
      buildCard(type);
      await renderDiagram(type, data[type]);
    }

    document.getElementById('placeholders').style.display = 'none';
    clearStatus();
    document.getElementById('saveBar').style.display = 'flex';

  } catch (err) {
    showError('Network error: ' + err.message);
    document.getElementById('placeholders').style.display = 'none';
    clearStatus();
  } finally {
    setLoading(false);
  }
}

/* ── Build card DOM ── */
function buildCard(type) {
  const grid = document.getElementById('diagramsGrid');
  const m = META[type] || { icon: '📊', label: type, desc: '', accent: '#6b7fa3', wide: false };

  const card = document.createElement('div');
  card.className = 'diagram-card' + (m.wide ? ' wide' : '');
  card.id = 'card-' + type;
  card.style.setProperty('--accent', m.accent);

  card.innerHTML = `
    <div class="card-stripe"></div>
    <div class="card-header">
      <div>
        <div class="card-title">
          <span class="card-icon">${m.icon}</span>
          ${m.label}
        </div>
        <div class="card-desc">${m.desc}</div>
      </div>
      <div class="card-actions">
        <button class="btn-xs" onclick="exportPng('${type}')">↓ PNG</button>
        <button class="btn-xs" id="code-toggle-${type}" onclick="toggleCode('${type}')">⟨⟩ Code</button>
        <button class="btn-xs" id="copy-${type}" onclick="copyCode('${type}')">Copy</button>
      </div>
    </div>
    <div class="diagram-render" id="render-${type}">
      <div class="card-skeleton">
        <div class="shimmer"></div>
        <div class="shimmer" style="width:75%"></div>
        <div class="shimmer" style="width:55%"></div>
      </div>
    </div>
    <div class="code-panel" id="code-${type}"><pre id="pre-${type}"></pre></div>
  `;
  grid.appendChild(card);
}

/* ── Sanitize Mermaid: quote edge labels containing parens/brackets ── */
function sanitizeMermaid(code) {
  return code.replace(/\|([^|"\n]+)\|/g, (match, label) => {
    if (/[()[\]{}]/.test(label)) {
      return '|"' + label.replace(/"/g, '\\"') + '"|';
    }
    return match;
  });
}

/* ── Render mermaid into card ── */
async function renderDiagram(type, code) {
  const card     = document.getElementById('card-' + type);
  const renderEl = document.getElementById('render-' + type);
  const preEl    = document.getElementById('pre-' + type);
  if (!card) return;

  preEl.textContent = code;
  const sanitized = sanitizeMermaid(code);

  try {
    const uid = 'mmd-' + type + '-' + Date.now();
    const { svg } = await mermaid.render(uid, sanitized);
    renderEl.innerHTML = svg;
  } catch (e) {
    renderEl.innerHTML = `<div class="render-error">⚠ Render error\n${e.message}</div>`;
  }

  card.classList.add('visible');
}

/* ── Code toggle ── */
function toggleCode(type) {
  const panel = document.getElementById('code-' + type);
  const btn   = document.getElementById('code-toggle-' + type);
  const open  = panel.style.display !== 'block';
  panel.style.display = open ? 'block' : 'none';
  btn.classList.toggle('active', open);
}

/* ── Copy ── */
async function copyCode(type) {
  const btn = document.getElementById('copy-' + type);
  await navigator.clipboard.writeText(codes[type] || '');
  btn.textContent = '✓ Copied';
  btn.classList.add('active');
  setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('active'); }, 2000);
}

/* ── Loading state ── */
function setLoading(on) {
  document.getElementById('spinner').style.display = on ? 'block' : 'none';
  document.getElementById('btnText').textContent   = on ? 'Generating…' : 'Generate Diagrams';
  document.getElementById('generateBtn').disabled  = on;
}

function setStatus(msg) {
  const bar = document.getElementById('statusBar');
  bar.style.display = 'flex';
  document.getElementById('statusText').textContent = msg;
}
function clearStatus() { document.getElementById('statusBar').style.display = 'none'; }

function showError(msg) {
  const el = document.getElementById('errorEl');
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
}
function hideError() { document.getElementById('errorEl').style.display = 'none'; }

/* ── SVG → high-res PNG ── */
async function svgToPngBase64(type) {
  const svgEl = document.querySelector('#render-' + type + ' svg');
  if (!svgEl) return null;

  const vb    = svgEl.viewBox && svgEl.viewBox.baseVal;
  const hasVB = vb && vb.width > 0 && vb.height > 0;

  const natW = hasVB ? vb.width
    : (parseFloat(svgEl.getAttribute('width'))  || svgEl.getBoundingClientRect().width  || 1600);
  const natH = hasVB ? vb.height
    : (parseFloat(svgEl.getAttribute('height')) || svgEl.getBoundingClientRect().height || 1000);

  // Upscale so the shortest dimension is at least 3000px
  const MIN_PX = 3000;
  const dpr    = Math.max(1, MIN_PX / Math.min(natW, natH));
  const cW = Math.round(natW * dpr);
  const cH = Math.round(natH * dpr);

  const clone = svgEl.cloneNode(true);
  clone.setAttribute('width',  natW);
  clone.setAttribute('height', natH);
  if (hasVB) clone.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
  clone.setAttribute('xmlns',       'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.style.maxWidth = 'none';

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', natW); bg.setAttribute('height', natH);
  const bgColor = MERMAID_THEMES[currentTheme].background;
  bg.setAttribute('fill', bgColor);
  clone.insertBefore(bg, clone.firstChild);

  const uri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(
    new XMLSerializer().serializeToString(clone)
  )));

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = cW; c.height = cH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, cW, cH);
      ctx.scale(dpr, dpr);
      ctx.drawImage(img, 0, 0, natW, natH);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = uri;
  });
}

/* ── Export single PNG ── */
async function exportPng(type) {
  const png = await svgToPngBase64(type);
  if (!png) return;
  const a = document.createElement('a');
  a.href = png;
  a.download = type.replace(/_/g, '-') + '.png';
  a.click();
}

/* ── Save all ── */
async function saveAll() {
  const name = prompt('Enter a project name for this save:', '');
  if (name === null) return;
  if (!name.trim()) { showError('Please enter a project name.'); return; }

  const btn = document.getElementById('saveAllBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const diagrams = [];
  for (const type of Object.keys(codes)) {
    if (!codes[type]) continue;
    const png = await svgToPngBase64(type);
    diagrams.push({ type, mmd: codes[type], png_base64: png || '' });
  }

  try {
    const res = await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: inputMode === 'pdf'
          ? extractedPdfText
          : document.getElementById('description').value.trim(),
        diagrams,
        project_name: name.trim(),
      })
    });
    const data = await res.json();
    if (res.ok) {
      btn.textContent = '✓ Saved';
      btn.classList.add('done');
      document.getElementById('savePath').textContent = data.path;
      setTimeout(() => {
        btn.textContent = '💾 Save Project';
        btn.classList.remove('done');
        btn.disabled = false;
      }, 3500);
    } else {
      showError(data.error || 'Save failed.');
      btn.textContent = '💾 Save Project'; btn.disabled = false;
    }
  } catch (err) {
    showError('Save error: ' + err.message);
    btn.textContent = '💾 Save Project'; btn.disabled = false;
  }
}

/* ── Keyboard shortcut + live textarea validation ── */
document.getElementById('description').addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
});
document.getElementById('description').addEventListener('input', validateInput);
document.getElementById('sourcePlatform').addEventListener('change', validateInput);
document.getElementById('shopifyTier').addEventListener('change', validateInput);
document.getElementById('archStyle').addEventListener('change', validateInput);

// Set initial state
validateInput();
