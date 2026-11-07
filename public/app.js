/* =====================================================
   DIGITAL SIGNATURE SYSTEM — app.js
   ===================================================== */

// ============================================================
//  STATE
// ============================================================
const State = {
  generatedKeys: { private: null, public: null, algo: null, label: null },
  signatureData:  null,
  signedFileName: null,
  files:   {},
  pems:    {},
  sigJson: null,
  auditLog: [],
  stats: { ops: 0, signs: 0, valid: 0, invalid: 0 }
};


// ============================================================
//  SIDEBAR — Desktop collapse / Mobile drawer
// ============================================================
const sidebar    = document.getElementById('sidebar');
const mainEl     = document.getElementById('main');
const overlay    = document.getElementById('overlay');
const hamburger  = document.getElementById('hamburger');
const sideToggle = document.getElementById('sidebar-toggle');

const isMobile = () => window.innerWidth <= 768;

/* Desktop: collapse/expand */
function toggleSidebarDesktop() {
  sidebar.classList.toggle('collapsed');
  mainEl.classList.toggle('collapsed');
  saveSidebarPref();
}

/* Mobile: open/close drawer */
function openMobileDrawer() {
  sidebar.classList.add('mobile-open');
  overlay.classList.add('visible');
  hamburger.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMobileDrawer() {
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('visible');
  hamburger.classList.remove('open');
  document.body.style.overflow = '';
}

function saveSidebarPref() {
  try { localStorage.setItem('dss-sidebar-collapsed', sidebar.classList.contains('collapsed')); } catch {}
}
function loadSidebarPref() {
  try {
    const c = localStorage.getItem('dss-sidebar-collapsed');
    if (c === 'true' && !isMobile()) {
      sidebar.classList.add('collapsed');
      mainEl.classList.add('collapsed');
    }
  } catch {}
}

/* Toggle button inside sidebar (desktop) */
if (sideToggle) sideToggle.addEventListener('click', toggleSidebarDesktop);

/* Hamburger (mobile) */
hamburger.addEventListener('click', () => {
  if (isMobile()) {
    sidebar.classList.contains('mobile-open') ? closeMobileDrawer() : openMobileDrawer();
  } else {
    toggleSidebarDesktop();
  }
});

/* Overlay click = close drawer */
overlay.addEventListener('click', closeMobileDrawer);

/* Close drawer on nav click (mobile) */
document.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', () => { if (isMobile()) closeMobileDrawer(); });
});

/* Re-apply on resize */
window.addEventListener('resize', () => {
  if (!isMobile()) {
    closeMobileDrawer();
    document.body.style.overflow = '';
  }
});

loadSidebarPref();


// ============================================================
//  NAVIGATION  (sidebar links + bottom nav)
// ============================================================
function switchTab(tab) {
  document.querySelectorAll('nav a').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  const link = document.querySelector(`nav a[data-tab="${tab}"]`);
  if (link) link.classList.add('active');
  const bn = document.querySelector(`.bn-item[data-tab="${tab}"]`);
  if (bn) bn.classList.add('active');
  const sec = document.getElementById(`tab-${tab}`);
  if (sec) sec.classList.add('active');
}

document.querySelectorAll('nav a[data-tab]').forEach(link => {
  link.addEventListener('click', () => switchTab(link.dataset.tab));
});

document.querySelectorAll('.bn-item[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});


// ============================================================
//  PEM HELPERS
// ============================================================
function arrayBufferToPEM(buffer, type) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  const lines = base64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN[^-]+-----/, '')
    .replace(/-----END[^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}


// ============================================================
//  HASH HELPER
// ============================================================
async function hashFileBuffer(buffer) {
  const h = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
}


// ============================================================
//  FILE / PEM / SIG HANDLERS
// ============================================================
function handleFileSelect(key, input) {
  const file = input.files[0];
  if (!file) return;
  State.files[key] = file;
  document.getElementById(key + '-name').textContent = `📄 ${file.name} (${formatBytes(file.size)})`;
  if (key === 'sign-file') {
    const info = document.getElementById('sign-file-info');
    if (info) { info.style.display = 'block'; info.textContent = `${file.name} · ${formatBytes(file.size)} · ${file.type || 'unknown'}`; }
  }
}

function handlePEMSelect(key, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    State.pems[key] = e.target.result;
    document.getElementById(key + '-name').textContent = `🔑 ${file.name}`;
    const paste = document.getElementById(key + '-paste');
    if (paste) paste.value = e.target.result;
  };
  reader.readAsText(file);
}

function handleSigSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      State.sigJson = null;
      const parsed = JSON.parse(e.target.result);
      validateSignature(parsed);
      State.sigJson = parsed;
      document.getElementById('ver-sig-name').textContent = `🔏 ${file.name} ✓`;
    } catch {
      State.sigJson = null;
      document.getElementById('ver-sig-name').textContent = `❌ Invalid JSON`;
    }
  };
  reader.readAsText(file);
}


// ============================================================
//  TAB 1 — KEY GENERATION
// ============================================================
function toggleKeySize() {
  const algo = document.querySelector('input[name="kg-algo"]:checked').value;
  document.getElementById('rsa-size-row').style.display = algo === 'RSA' ? '' : 'none';
}

async function generateKeys() {
  const algo  = document.querySelector('input[name="kg-algo"]:checked').value;
  const label = document.getElementById('kg-label').value || 'my-key';
  const btn   = document.getElementById('kg-btn');

  btn.disabled = true;
  document.getElementById('kg-btn-icon').innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px"></span>';
  hideEl('kg-empty'); hideEl('kg-priv-section'); hideEl('kg-pub-section'); hideEl('kg-sep');

  try {
    requireCrypto();
    const password = document.getElementById('kg-password').value;
    if (password && password.length < 8) throw new Error('Use a password with at least 8 characters.');
    let keyPair;
    if (algo === 'RSA') {
      const sz = parseInt(document.querySelector('input[name="rsa-size"]:checked').value);
      keyPair = await crypto.subtle.generateKey(
        { name:'RSA-PSS', modulusLength:sz, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256' },
        true, ['sign','verify']
      );
    } else {
      keyPair = await crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify']);
    }

    const privBuf = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const pubBuf  = await crypto.subtle.exportKey('spki',  keyPair.publicKey);
    const privPEM = await KeyProtection.encrypt(privBuf, password);
    const pubPEM  = arrayBufferToPEM(pubBuf,  'PUBLIC KEY');

    State.generatedKeys = { private: privPEM, public: pubPEM, algo, label };

    const pp = document.getElementById('kg-priv-preview');
    const qp = document.getElementById('kg-pub-preview');
    pp.textContent = privPEM; pp.style.display = 'block';
    qp.textContent = pubPEM;  qp.style.display = 'block';

    showEl('kg-priv-section'); showEl('kg-sep'); showEl('kg-pub-section');

    const lbl = algo === 'RSA'
      ? `RSA ${document.querySelector('input[name="rsa-size"]:checked').value}-bit`
      : 'ECDSA';
    setResult('kg-result', `✅ ${lbl} key pair generated!\nLabel: ${label}\nPrivate: ${label}_private.pem\nPublic:  ${label}_public.pem`, 'success');
    addAuditEntry('Key Generation', `${label}_keypair`, 'Success', `Algorithm: ${escapeHtml(algo)}`);
    document.getElementById('kg-password').value = '';
    showToast(password ? 'Password-protected key pair generated' : 'Key pair generated without a password', 'success');

  } catch (err) {
    setResult('kg-result', `❌ Key generation failed:\n${err.message}`, 'error');
    showEl('kg-empty');
    addAuditEntry('Key Generation', 'keypair', 'Failed', err.message);
  }
  btn.disabled = false;
  document.getElementById('kg-btn-icon').textContent = '⚡';
}

function downloadKey(type) {
  if (!State.generatedKeys[type]) return;
  downloadText(State.generatedKeys[type], `${State.generatedKeys.label}_${type}.pem`, 'application/x-pem-file');
}
async function copyKey(type) {
  if (!State.generatedKeys[type]) return;
  try { await navigator.clipboard.writeText(State.generatedKeys[type]); showToast('Copied to clipboard!', 'success'); }
  catch { showToast('Clipboard unavailable. Use the download button.', 'error'); }
}


// ============================================================
//  TAB 2 — SIGN DOCUMENT
// ============================================================
async function doSign() {
  const fileObj = State.files['sign-file'];
  const algo    = document.querySelector('input[name="sign-algo"]:checked').value;
  const signer  = document.getElementById('sign-signer').value || 'Unknown';
  const privPEM = document.getElementById('sign-key-paste').value.trim() || State.pems['sign-key'];

  if (!fileObj) { showToast('Please select a file to sign', 'error'); return; }
  if (!privPEM) { showToast('Please provide a private key', 'error'); return; }

  const btn = document.getElementById('sign-btn');
  btn.disabled = true;
  document.getElementById('sign-btn-icon').innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px"></span>';
  hideEl('sign-download');

  try {
    requireCrypto();
    State.signatureData = null;
    const fileBuf  = await fileObj.arrayBuffer();
    const fileHash = await hashFileBuffer(fileBuf);
    const password = document.getElementById('sign-password').value;
    const privBuf = await KeyProtection.decrypt(privPEM, password);
    let privateKey, signature;

    if (algo === 'RSA') {
      privateKey = await crypto.subtle.importKey('pkcs8', privBuf, { name:'RSA-PSS', hash:'SHA-256' }, false, ['sign']);
      signature  = await crypto.subtle.sign({ name:'RSA-PSS', saltLength:rsaSaltLength(privateKey) }, privateKey, fileBuf);
    } else {
      privateKey = await crypto.subtle.importKey('pkcs8', privBuf, { name:'ECDSA', namedCurve:'P-256' }, false, ['sign']);
      signature  = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, privateKey, fileBuf);
    }

    const sigBase64 = bytesToBase64(algo === 'ECDSA' ? rawToDer(new Uint8Array(signature)) : new Uint8Array(signature));
    State.signatureData = {
      signer, file: fileObj.name, file_hash: fileHash,
      algorithm: algo, timestamp: new Date().toISOString(), signature: sigBase64
    };
    State.signedFileName = fileObj.name;

    setResult('sign-result',
      `✅ Signed successfully!\n\nSigner:    ${signer}\nAlgorithm: ${escapeHtml(algo)}\nFile Hash: ${fileHash.substring(0,20)}...\nTimestamp: ${State.signatureData.timestamp}`,
      'success'
    );
    showEl('sign-download');
    addAuditEntry('Sign File', fileObj.name, 'Success', `Algorithm: ${escapeHtml(algo)}, Signer: ${signer}`);
    document.getElementById('sign-password').value = '';
    showToast(`✅ ${fileObj.name} signed`, 'success');

  } catch (err) {
    setResult('sign-result', `❌ Signing failed:\n${err.message}\n\nKey must match the selected algorithm.`, 'error');
    addAuditEntry('Sign File', fileObj?.name || 'unknown', 'Failed', err.message);
  }
  btn.disabled = false;
  document.getElementById('sign-btn-icon').textContent = '✍️';
}

function downloadSig() {
  if (!State.signatureData) return;
  downloadText(JSON.stringify(State.signatureData, null, 2), `${State.signedFileName}.sig`, 'application/json');
}


// ============================================================
//  TAB 3 — VERIFY DOCUMENT
// ============================================================
async function doVerify(tamperDemo) {
  const fileObj = State.files['ver-file'];
  const sigJson = State.sigJson;
  const pubPEM  = document.getElementById('ver-key-paste').value.trim() || State.pems['ver-key'];

  if (!fileObj) { showToast('Please select the original file', 'error'); return; }
  if (!sigJson)  { showToast('Please upload a .sig file', 'error'); return; }
  if (!pubPEM)   { showToast('Please provide a public key', 'error'); return; }

  const verBtn = document.getElementById('ver-btn');
  const tamBtn = document.getElementById('tamper-btn');
  verBtn.disabled = tamBtn.disabled = true;

  hideEl('ver-placeholder');
  const box = document.getElementById('ver-status-box');
  box.style.display = 'block'; box.style.borderColor = 'var(--border)';
  document.getElementById('ver-icon').textContent  = '⏳';
  document.getElementById('ver-label').textContent = 'VERIFYING...';
  document.getElementById('ver-label').style.color = 'var(--muted)';
  document.getElementById('ver-msg').textContent   = '';
  document.getElementById('ver-details').innerHTML = '';

  try {
    requireCrypto();
    validateSignature(sigJson);
    let fileBuf = await fileObj.arrayBuffer();
    if (tamperDemo) {
      const orig  = new Uint8Array(fileBuf);
      const extra = new TextEncoder().encode(' [TAMPERED]');
      const comb  = new Uint8Array(orig.length + extra.length);
      comb.set(orig); comb.set(extra, orig.length);
      fileBuf = comb.buffer;
    }

    const currentHash  = await hashFileBuffer(fileBuf);
    const originalHash = sigJson.file_hash;
    const hashMatch    = currentHash === originalHash;
    const algo         = sigJson.algorithm;
    const pubBuf       = pemToArrayBuffer(pubPEM);
    const sigBytes     = Uint8Array.from(atob(sigJson.signature), c => c.charCodeAt(0));
    const origBuf      = fileBuf;
    let cryptoValid = false;

    try {
      if (algo === 'RSA') {
        const pk = await crypto.subtle.importKey('spki', pubBuf, { name:'RSA-PSS', hash:'SHA-256' }, false, ['verify']);
        cryptoValid = await crypto.subtle.verify({ name:'RSA-PSS', saltLength:rsaSaltLength(pk) }, pk, sigBytes, origBuf);
        if (!cryptoValid) cryptoValid = await crypto.subtle.verify({ name:'RSA-PSS', saltLength:32 }, pk, sigBytes, origBuf);
      } else {
        const pk = await crypto.subtle.importKey('spki', pubBuf, { name:'ECDSA', namedCurve:'P-256' }, false, ['verify']);
        cryptoValid = await crypto.subtle.verify({ name:'ECDSA', hash:'SHA-256' }, pk, sigBytes.length === 64 ? sigBytes : derToRaw(sigBytes), origBuf);
      }
    } catch { cryptoValid = false; }

    const valid   = cryptoValid && hashMatch;
    const message = tamperDemo ? 'Tampered file detected — hash mismatch!'
      : valid ? 'Signature cryptographically valid'
      : cryptoValid ? 'Hash mismatch — file was modified after signing'
      : 'Cryptographic verification failed';

    if (valid) {
      document.getElementById('ver-icon').textContent  = '✅';
      document.getElementById('ver-label').textContent = 'SIGNATURE VALID';
      document.getElementById('ver-label').style.color = 'var(--success)';
      box.style.borderColor = 'rgba(0,230,118,0.3)';
    } else {
      document.getElementById('ver-icon').textContent  = '❌';
      document.getElementById('ver-label').textContent = tamperDemo ? 'TAMPERING DETECTED' : 'SIGNATURE INVALID';
      document.getElementById('ver-label').style.color = tamperDemo ? 'var(--warning)' : 'var(--danger)';
      box.style.borderColor = tamperDemo ? 'rgba(255,179,0,0.3)' : 'rgba(255,59,92,0.3)';
    }
    document.getElementById('ver-msg').textContent = message;
    document.getElementById('ver-details').innerHTML = `
      <div class="detail-row"><span class="detail-key">Signer:</span><span class="detail-val">${escapeHtml(sigJson.signer||'N/A')}</span></div>
      <div class="detail-row"><span class="detail-key">Algorithm:</span><span class="detail-val">${escapeHtml(algo)}</span></div>
      <div class="detail-row"><span class="detail-key">Signed On:</span><span class="detail-val">${escapeHtml(sigJson.timestamp||'N/A')}</span></div>
      <div class="detail-row"><span class="detail-key">Original Hash:</span><span class="detail-val">${escapeHtml(originalHash)}</span></div>
      <div class="detail-row"><span class="detail-key">Current Hash:</span><span class="detail-val" style="color:${hashMatch?'var(--success)':'var(--danger)'}">${escapeHtml(currentHash)}</span></div>
      <div class="detail-row"><span class="detail-key">Hash Match:</span><span class="detail-val" style="color:${hashMatch?'var(--success)':'var(--danger)'}">${hashMatch?'✓ YES':'✗ NO'}</span></div>
      <div class="detail-row"><span class="detail-key">Crypto Valid:</span><span class="detail-val" style="color:${cryptoValid?'var(--success)':'var(--danger)'}">${cryptoValid?'✓ YES':'✗ NO'}</span></div>
      ${tamperDemo ? '<div style="margin-top:8px;color:var(--warning);font-size:11px">⚠ DEMO: Only an in-memory copy was tampered. Your original file is untouched.</div>' : ''}
    `;
    addAuditEntry(tamperDemo?'Tamper Demo':'Verify File', fileObj.name, valid?'Valid':'Invalid', `Algorithm: ${escapeHtml(algo)}, Signer: ${sigJson.signer}`);
  } catch (err) {
    document.getElementById('ver-icon').textContent  = '💥';
    document.getElementById('ver-label').textContent = 'VERIFICATION ERROR';
    document.getElementById('ver-label').style.color = 'var(--danger)';
    document.getElementById('ver-msg').textContent   = err.message;
    addAuditEntry('Verify File', fileObj?.name||'unknown', 'Error', err.message);
  }
  verBtn.disabled = tamBtn.disabled = false;
}


// ============================================================
//  TAB 4 — PERFORMANCE BENCHMARK
// ============================================================
async function runBenchmark() {
  const btn   = document.getElementById('perf-btn');
  const iters = parseInt(document.getElementById('perf-iters').value);
  btn.disabled = true;
  document.getElementById('perf-btn-icon').innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px"></span>';
  showEl('perf-progress');
  document.getElementById('perf-stats').style.display = 'none';

  try {
  requireCrypto();
  let testData;
  if (State.files['perf-file']) {
    testData = await State.files['perf-file'].arrayBuffer();
  } else {
    const buf = new Uint8Array(32768); crypto.getRandomValues(buf); testData = buf.buffer;
  }

  const avg = async (fn, n) => {
    const t = [];
    for (let i = 0; i < n; i++) { const t0 = performance.now(); await fn(); t.push(performance.now() - t0); }
    return t.reduce((a,b)=>a+b,0) / t.length;
  };
  const setP = txt => { document.getElementById('perf-progress-text').textContent = txt; };
  const m = { RSA:{}, ECDSA:{} };

    setP('RSA — key generation...');
    let rsaKP;
    m.RSA.keygen = await avg(async () => {
      rsaKP = await crypto.subtle.generateKey({ name:'RSA-PSS', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256' }, true, ['sign','verify']);
    }, iters);

    setP('RSA — signing...');
    let rsaSig;
    m.RSA.sign = await avg(async () => { rsaSig = await crypto.subtle.sign({ name:'RSA-PSS', saltLength:32 }, rsaKP.privateKey, testData); }, iters);

    setP('RSA — verification...');
    m.RSA.verify = await avg(async () => { if (!await crypto.subtle.verify({ name:'RSA-PSS', saltLength:32 }, rsaKP.publicKey, rsaSig, testData)) throw new Error('RSA benchmark verification failed'); }, iters);

    const rPr = await crypto.subtle.exportKey('pkcs8', rsaKP.privateKey);
    const rPu = await crypto.subtle.exportKey('spki',  rsaKP.publicKey);
    m.RSA.privSize = rPr.byteLength; m.RSA.pubSize = rPu.byteLength; m.RSA.sigSize = rsaSig.byteLength;

    setP('ECDSA — key generation...');
    let ecKP;
    m.ECDSA.keygen = await avg(async () => { ecKP = await crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify']); }, iters);

    setP('ECDSA — signing...');
    let ecSig;
    m.ECDSA.sign = await avg(async () => { ecSig = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, ecKP.privateKey, testData); }, iters);

    setP('ECDSA — verification...');
    m.ECDSA.verify = await avg(async () => { if (!await crypto.subtle.verify({ name:'ECDSA', hash:'SHA-256' }, ecKP.publicKey, ecSig, testData)) throw new Error('ECDSA benchmark verification failed'); }, iters);

    const ePr = await crypto.subtle.exportKey('pkcs8', ecKP.privateKey);
    const ePu = await crypto.subtle.exportKey('spki',  ecKP.publicKey);
    m.ECDSA.privSize = ePr.byteLength; m.ECDSA.pubSize = ePu.byteLength; m.ECDSA.sigSize = ecSig.byteLength;

    hideEl('perf-progress');
    renderBenchmarkTable(m);

    document.getElementById('stat-rsa-keygen').textContent   = m.RSA.keygen.toFixed(1);
    document.getElementById('stat-ecdsa-keygen').textContent = m.ECDSA.keygen.toFixed(1);
    document.getElementById('stat-rsa-sign').textContent     = m.RSA.sign.toFixed(1);
    document.getElementById('stat-ecdsa-sign').textContent   = m.ECDSA.sign.toFixed(1);
    document.getElementById('perf-stats').style.display = 'flex';
    showEl('perf-note');

    addAuditEntry('Benchmark', 'RSA vs ECDSA', 'Complete', `${iters} iteration(s), ${formatBytes(testData.byteLength)} data`);
    showToast('✅ Benchmark complete', 'success');
  } catch (err) {
    hideEl('perf-progress');
    showToast('Benchmark failed: ' + err.message, 'error');
    addAuditEntry('Benchmark', 'RSA vs ECDSA', 'Error', err.message);
  }
  btn.disabled = false;
  document.getElementById('perf-btn-icon').textContent = '⚡';
}

function renderBenchmarkTable(m) {
  const rows = [
    ['Key Generation', m.RSA.keygen.toFixed(2)+' ms',  m.ECDSA.keygen.toFixed(2)+' ms', m.RSA.keygen,   m.ECDSA.keygen],
    ['Signing Time',   m.RSA.sign.toFixed(2)+' ms',    m.ECDSA.sign.toFixed(2)+' ms',   m.RSA.sign,     m.ECDSA.sign],
    ['Verify Time',    m.RSA.verify.toFixed(2)+' ms',  m.ECDSA.verify.toFixed(2)+' ms', m.RSA.verify,   m.ECDSA.verify],
    ['Private Key',    formatBytes(m.RSA.privSize),     formatBytes(m.ECDSA.privSize),   m.RSA.privSize, m.ECDSA.privSize],
    ['Public Key',     formatBytes(m.RSA.pubSize),      formatBytes(m.ECDSA.pubSize),    m.RSA.pubSize,  m.ECDSA.pubSize],
    ['Signature',      formatBytes(m.RSA.sigSize),      formatBytes(m.ECDSA.sigSize),    m.RSA.sigSize,  m.ECDSA.sigSize],
  ];
  const maxVals = rows.map(r => Math.max(r[3], r[4]));
  document.getElementById('perf-tbody').innerHTML = rows.map((r,i) => {
    const max = maxVals[i];
    const rW = max > 0 ? Math.round((r[3]/max)*110) : 55;
    const eW = max > 0 ? Math.round((r[4]/max)*110) : 55;
    const w  = r[4] < r[3] ? '<span class="chip chip-ecdsa">ECDSA</span>' : '<span class="chip chip-rsa">RSA</span>';
    return `<tr>
      <td class="metric-name">${r[0]}</td>
      <td class="rsa-val"><div class="bar-wrap"><span style="min-width:75px">${r[1]}</span><div class="bar bar-rsa" style="width:${rW}px"></div></div></td>
      <td class="ecdsa-val"><div class="bar-wrap"><span style="min-width:75px">${r[2]}</span><div class="bar bar-ecdsa" style="width:${eW}px"></div></div></td>
      <td>${w}</td>
    </tr>`;
  }).join('');
}


// ============================================================
//  TAB 5 — AUDIT LOG
// ============================================================
function addAuditEntry(action, filename, result, extra) {
  const now = new Date();
  const ts  = now.toLocaleTimeString('en-US',{hour12:false}) + '.' + String(now.getMilliseconds()).padStart(3,'0');
  State.auditLog.unshift({ ts, action, filename, result, extra });

  State.stats.ops++;
  if (action === 'Sign File' && result === 'Success')                                  State.stats.signs++;
  if (result === 'Valid')          State.stats.valid++;
  if (result === 'Invalid')            State.stats.invalid++;

  document.getElementById('log-count').textContent   = State.auditLog.length;
  const bn = document.querySelector('.bn-item[data-tab="audit"] .bn-badge');
  if (bn) bn.textContent = State.auditLog.length;

  document.getElementById('total-ops').textContent     = State.stats.ops;
  document.getElementById('total-signs').textContent   = State.stats.signs;
  document.getElementById('total-valid').textContent   = State.stats.valid;
  document.getElementById('total-invalid').textContent = State.stats.invalid;

  renderAuditLog();
}

function renderAuditLog() {
  const terminal = document.getElementById('audit-terminal');
  const empty    = document.getElementById('audit-empty');
  if (State.auditLog.length === 0) { if (empty) empty.style.display='block'; return; }
  if (empty) empty.style.display = 'none';
  terminal.innerHTML = State.auditLog.map(e => {
    const ok = ['Valid','Success','Complete'].includes(e.result);
    return `<div class="log-entry">
      <span class="log-ts">[${escapeHtml(e.ts)}]</span>
      <span class="log-action">${escapeHtml(e.action.toUpperCase())}</span>
      <span class="log-file">${escapeHtml(e.filename)}</span>
      <span class="${ok?'log-res-success':'log-res-invalid'}">[ ${escapeHtml(e.result)} ]</span>
      <span class="log-extra">${escapeHtml(e.extra)}</span>
    </div>`;
  }).join('');
}

function clearLog() {
  State.auditLog = [];
  State.stats    = { ops:0, signs:0, valid:0, invalid:0 };
  ['log-count','total-ops','total-signs','total-valid','total-invalid'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '0';
  });
  const bn = document.querySelector('.bn-item[data-tab="audit"] .bn-badge');
  if (bn) bn.textContent = '0';
  document.getElementById('audit-terminal').innerHTML =
    '<div class="terminal-empty" id="audit-empty">[ Log cleared ]</div>';
  showToast('Log cleared', 'success');
}

function exportLog() {
  if (!State.auditLog.length) { showToast('No entries to export', 'error'); return; }
  downloadText(JSON.stringify(State.auditLog, null, 2), 'audit_log.json', 'application/json');
}


// ============================================================
//  UTILITY FUNCTIONS
// ============================================================
function formatBytes(bytes) {
  if (bytes >= 1048576) return (bytes/1048576).toFixed(2)+' MB';
  if (bytes >= 1024)    return (bytes/1024).toFixed(2)+' KB';
  return bytes+' B';
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text],{type:mime});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function setResult(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text; el.className = 'result-box visible '+type;
}

function showEl(id) { const e = document.getElementById(id); if(e) e.style.display = e.classList.contains('stats-bar') ? 'flex' : 'block'; }
function hideEl(id) { const e = document.getElementById(id); if(e) e.style.display='none'; }

let toastTimer;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show '+(type||'info');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}


// ============================================================
//  DRAG & DROP
// ============================================================
document.querySelectorAll('.drop-zone').forEach(zone => {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    const fi = zone.querySelector('input[type="file"]');
    if (fi && e.dataTransfer.files[0]) {
      const dt = new DataTransfer(); dt.items.add(e.dataTransfer.files[0]);
      fi.files = dt.files; fi.dispatchEvent(new Event('change'));
    }
  });
});


// ============================================================
//  INIT
// ============================================================
toggleKeySize();
// Shared validation and standard signature encoding.
function requireCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error('Open this app at http://localhost:8000 or an HTTPS address to enable cryptography.');
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function validateSignature(data) {
  if (!data || !['RSA','ECDSA'].includes(data.algorithm) ||
      typeof data.file_hash !== 'string' || !/^[0-9a-f]{64}$/i.test(data.file_hash) ||
      typeof data.signature !== 'string' || !data.signature.length) {
    throw new Error('Invalid signature JSON: algorithm, SHA-256 file_hash and signature are required.');
  }
  atob(data.signature);
}
function rsaSaltLength(key) {
  // Maximum RSA-PSS salt length for SHA-256.
  return Math.ceil((key.algorithm.modulusLength - 1) / 8) - 32 - 2;
}
function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function rawToDer(raw) {
  if (raw.length !== 64) throw new Error('Expected a P-256 signature.');
  const integer = part => {
    let i = 0;
    while (i < part.length - 1 && part[i] === 0) i++;
    const value = Array.from(part.slice(i));
    if (value[0] & 128) value.unshift(0);
    return [2, value.length, ...value];
  };
  const body = [...integer(raw.slice(0,32)), ...integer(raw.slice(32))];
  return new Uint8Array([48,body.length,...body]);
}
function derToRaw(der) {
  if (der[0] !== 48 || der[1] !== der.length - 2) throw new Error('Invalid ECDSA DER signature.');
  let pos = 2;
  const raw = new Uint8Array(64);
  for (let part = 0; part < 2; part++) {
    if (der[pos++] !== 2) throw new Error('Invalid ECDSA integer.');
    const len = der[pos++];
    if (!len || len > 33 || pos + len > der.length) throw new Error('Invalid ECDSA integer length.');
    let value = der.slice(pos, pos + len); pos += len;
    if (value.length === 33 && value[0] !== 0) throw new Error('Invalid ECDSA integer.');
    if (value[0] === 0) value = value.slice(1);
    if (value.length > 32) throw new Error('Invalid P-256 integer.');
    raw.set(value, (part + 1) * 32 - value.length);
  }
  if (pos !== der.length) throw new Error('Trailing ECDSA signature data.');
  return raw;
}

if (!globalThis.crypto?.subtle) {
  document.querySelector('.status-text').textContent = 'Open on localhost or HTTPS';
  showToast('Use http://localhost:8000 to enable cryptography.', 'error');
}

/* Standard password-protected PKCS8 keys using browser Web Crypto. */
const KeyProtection = (() => {
  const OID = {
    pbes2: '2a864886f70d01050d',
    pbkdf2: '2a864886f70d01050c',
    sha256: '2a864886f70d0209',
    aes256cbc: '60864801650304012a'
  };
  const iterations = 600000;
  const bytes = value => new Uint8Array(value);
  const hex = value => Array.from(value, b => b.toString(16).padStart(2, '0')).join('');
  const unhex = value => Uint8Array.from(value.match(/../g), v => parseInt(v, 16));
  const join = (...parts) => {
    const output = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  };
  function der(tag, value) {
    let length = value.length;
    let size;
    if (length < 128) size = Uint8Array.of(length);
    else {
      const octets = [];
      while (length) { octets.unshift(length & 255); length = Math.floor(length / 256); }
      size = Uint8Array.of(128 | octets.length, ...octets);
    }
    return join(Uint8Array.of(tag), size, value);
  }
  const sequence = (...parts) => der(48, join(...parts));
  const oid = name => der(6, unhex(OID[name]));
  function integer(value) {
    const output = [];
    do { output.unshift(value & 255); value = Math.floor(value / 256); } while (value);
    if (output[0] & 128) output.unshift(0);
    return der(2, Uint8Array.from(output));
  }
  function node(data, offset = 0) {
    const tag = data[offset++];
    let length = data[offset++];
    if (tag === undefined || length === undefined) throw new Error('Invalid encrypted key.');
    if (length & 128) {
      const count = length & 127;
      if (!count || count > 4 || offset + count > data.length) throw new Error('Invalid DER length.');
      length = 0;
      for (let i = 0; i < count; i++) length = length * 256 + data[offset++];
    }
    const end = offset + length;
    if (end > data.length) throw new Error('Truncated encrypted key.');
    return { tag, value: data.slice(offset, end), end };
  }
  function children(item) {
    if (item.tag !== 48) throw new Error('Invalid encrypted key structure.');
    const output = [];
    for (let offset = 0; offset < item.value.length;) {
      const part = node(item.value, offset);
      output.push(part); offset = part.end;
    }
    return output;
  }
  function expectOID(item, name) {
    if (!item || item.tag !== 6 || hex(item.value) !== OID[name]) {
      throw new Error('Unsupported encrypted key format. Use a key generated by this page.');
    }
  }
  async function derive(password, salt, count, usage) {
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: count, hash: 'SHA-256' },
      material, { name: 'AES-CBC', length: 256 }, false, [usage]
    );
  }
  async function encrypt(pkcs8, password) {
    if (!password) return arrayBufferToPEM(pkcs8, 'PRIVATE KEY');
    if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const key = await derive(password, salt, iterations, 'encrypt');
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, pkcs8);
    const kdf = sequence(oid('pbkdf2'), sequence(
      der(4, salt), integer(iterations), sequence(oid('sha256'), der(5, new Uint8Array()))
    ));
    const cipher = sequence(oid('aes256cbc'), der(4, iv));
    const envelope = sequence(
      sequence(oid('pbes2'), sequence(kdf, cipher)), der(4, bytes(ciphertext))
    );
    return arrayBufferToPEM(envelope, 'ENCRYPTED PRIVATE KEY');
  }
  async function decrypt(pem, password) {
    if (!pem.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----')) return pemToArrayBuffer(pem);
    if (!password) throw new Error('Enter the private key password before signing.');
    const data = bytes(pemToArrayBuffer(pem));
    const root = node(data);
    if (root.end !== data.length) throw new Error('Invalid encrypted key.');
    const envelope = children(root);
    if (envelope.length !== 2 || envelope[1].tag !== 4) throw new Error('Invalid encrypted key.');
    const algorithm = children(envelope[0]);
    expectOID(algorithm[0], 'pbes2');
    const parameters = children(algorithm[1]);
    const kdf = children(parameters[0]);
    expectOID(kdf[0], 'pbkdf2');
    const settings = children(kdf[1]);
    if (settings[0]?.tag !== 4 || settings[1]?.tag !== 2) throw new Error('Invalid PBKDF2 parameters.');
    const salt = settings[0].value;
    const count = settings[1].value.reduce((n, b) => n * 256 + b, 0);
    if (!Number.isSafeInteger(count) || count < 1 || count > 2000000 || salt.length < 8) {
      throw new Error('Unsupported password derivation parameters.');
    }
    let prfIndex = 2;
    if (settings[2]?.tag === 2) {
      if (settings[2].value.reduce((n, b) => n * 256 + b, 0) !== 32) throw new Error('Unsupported key length.');
      prfIndex = 3;
    }
    if (!settings[prfIndex]) throw new Error('Only PBKDF2 with SHA-256 is supported.');
    expectOID(children(settings[prfIndex])[0], 'sha256');
    const cipher = children(parameters[1]);
    expectOID(cipher[0], 'aes256cbc');
    if (cipher[1]?.tag !== 4 || cipher[1].value.length !== 16) throw new Error('Invalid encryption IV.');
    const key = await derive(password, salt, count, 'decrypt');
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: cipher[1].value }, key, envelope[1].value
      );
      const decoded = node(bytes(plaintext));
      if (decoded.tag !== 48 || decoded.end !== plaintext.byteLength) throw new Error();
      return plaintext;
    } catch {
      throw new Error('Incorrect password or damaged private key.');
    }
  }
  return { encrypt, decrypt };
})();
