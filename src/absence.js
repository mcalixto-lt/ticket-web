const ABSENCE_DB_VERSION = 1;

let absenceCameraStream = null;
let selectedAbsenceDocument = null;
let absencePreviewUrl = '';
let absenceViewerUrl = '';

function profileId() {
  try {
    const profile = JSON.parse(localStorage.getItem('ticket.active-profile.v2') || 'null');
    return String(profile?.id || profile?.cpfHash?.slice(0, 24) || 'default')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 80) || 'default';
  } catch {
    return 'default';
  }
}

function dbName() {
  return `ticket-absence-db-${profileId()}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName(), ABSENCE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('absences')) {
        const store = db.createObjectStore('absences', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putAbsence(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('absences', 'readwrite');
    tx.objectStore('absences').put(item);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function listAbsences() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('absences', 'readonly');
    const request = tx.objectStore('absences').getAll();
    request.onsuccess = () => resolve(
      (request.result || []).sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)),
    );
    request.onerror = () => reject(request.error);
  });
}

async function getAbsence(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('absences', 'readonly');
    const request = tx.objectStore('absences').get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const nowTime = () => {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const br = (date) => {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};

function toast(text) {
  const element = document.createElement('div');
  element.className = 'absence-toast';
  element.textContent = text;
  document.body.appendChild(element);
  setTimeout(() => element.remove(), 3500);
}

function releasePreviewUrl() {
  if (absencePreviewUrl) URL.revokeObjectURL(absencePreviewUrl);
  absencePreviewUrl = '';
}

function showSelectedDocument(blob, name = 'comprovante-ausencia.jpg', type = 'image/jpeg') {
  releasePreviewUrl();
  selectedAbsenceDocument = { blob, name, type };
  absencePreviewUrl = URL.createObjectURL(blob);
  const image = document.querySelector('#absencePreview');
  const empty = document.querySelector('#absenceCameraPlaceholder');
  if (image) {
    image.src = absencePreviewUrl;
    image.classList.add('show');
  }
  if (empty) empty.classList.add('hidden');
}

function clearSelectedDocument() {
  selectedAbsenceDocument = null;
  releasePreviewUrl();
  const input = document.querySelector('#absencePhoto');
  const image = document.querySelector('#absencePreview');
  const placeholder = document.querySelector('#absenceCameraPlaceholder');
  if (input) input.value = '';
  if (image) {
    image.removeAttribute('src');
    image.classList.remove('show');
  }
  if (placeholder) placeholder.classList.remove('hidden');
}

function stopAbsenceCamera() {
  if (absenceCameraStream) {
    absenceCameraStream.getTracks().forEach((track) => track.stop());
    absenceCameraStream = null;
  }
  const video = document.querySelector('#absenceCameraVideo');
  if (video) {
    video.srcObject = null;
    video.classList.add('hidden');
  }
  document.querySelector('#absenceCapturePhotoButton')?.classList.add('hidden');
  document.querySelector('#absenceCameraPlaceholder')?.classList.remove('camera-active');
}

async function startAbsenceCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('A câmera não está disponível neste navegador. Use a opção Galeria.');
    return;
  }
  try {
    stopAbsenceCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    absenceCameraStream = stream;
    const video = document.querySelector('#absenceCameraVideo');
    if (!video) return;
    video.srcObject = stream;
    video.classList.remove('hidden');
    await video.play();
    document.querySelector('#absenceCameraPlaceholder')?.classList.add('camera-active');
    document.querySelector('#absenceCapturePhotoButton')?.classList.remove('hidden');
    toast('Câmera pronta. Enquadre o documento e toque em Capturar foto.');
  } catch (error) {
    console.error('Falha ao abrir câmera da ausência:', error);
    toast('Não foi possível abrir a câmera. Autorize o acesso ou escolha uma imagem da galeria.');
  }
}

async function captureAbsencePhoto() {
  const video = document.querySelector('#absenceCameraVideo');
  if (!video || !video.videoWidth || !video.videoHeight) {
    toast('A câmera ainda não está pronta para fotografar.');
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) {
    toast('Não foi possível gerar a fotografia. Tente novamente.');
    return;
  }
  showSelectedDocument(blob, `ausencia-${today()}-${nowTime().replace(':', '')}.jpg`, 'image/jpeg');
  stopAbsenceCamera();
  toast('Fotografia do comprovante capturada.');
}

function ensureViewer() {
  if (document.querySelector('#absenceViewer')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="absence-viewer" id="absenceViewer" hidden>
      <section class="absence-viewer-card" role="dialog" aria-modal="true" aria-labelledby="absenceViewerTitle">
        <div class="absence-head">
          <div>
            <h2 id="absenceViewerTitle">Comprovante de ausência</h2>
            <p id="absenceViewerMeta"></p>
          </div>
          <button class="absence-close" id="absenceViewerClose" type="button" aria-label="Fechar">×</button>
        </div>
        <div class="absence-viewer-image-wrap">
          <img id="absenceViewerImage" alt="Documento comprobatório da ausência" />
        </div>
        <div id="absenceViewerDetails" class="absence-viewer-details"></div>
      </section>
    </div>`);

  const viewer = document.querySelector('#absenceViewer');
  const close = () => {
    viewer.hidden = true;
    if (absenceViewerUrl) URL.revokeObjectURL(absenceViewerUrl);
    absenceViewerUrl = '';
    document.querySelector('#absenceViewerImage')?.removeAttribute('src');
  };
  document.querySelector('#absenceViewerClose').addEventListener('click', close);
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer) close();
  });
}

async function openAbsenceDocument(id) {
  try {
    const item = await getAbsence(id);
    if (!item) {
      toast('Registro de ausência não encontrado.');
      return;
    }
    if (!item.document?.blob) {
      toast('Este registro não possui documento comprobatório.');
      return;
    }
    ensureViewer();
    if (absenceViewerUrl) URL.revokeObjectURL(absenceViewerUrl);
    absenceViewerUrl = URL.createObjectURL(item.document.blob);
    const viewer = document.querySelector('#absenceViewer');
    document.querySelector('#absenceViewerImage').src = absenceViewerUrl;
    document.querySelector('#absenceViewerMeta').textContent = `${br(item.date)} • ${item.startTime} às ${item.endTime}`;
    document.querySelector('#absenceViewerDetails').innerHTML = `
      <div><span>Motivo</span><strong>${esc(item.reason)}</strong></div>
      <div><span>Período</span><strong>${esc(item.startTime)} às ${esc(item.endTime)}</strong></div>
      ${item.note ? `<div class="wide"><span>Observação</span><strong>${esc(item.note)}</strong></div>` : ''}`;
    viewer.hidden = false;
  } catch (error) {
    console.error('Falha ao abrir documento da ausência:', error);
    toast('Não foi possível abrir o comprovante da ausência.');
  }
}

function ensureModal() {
  if (document.querySelector('#absenceModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="absence-modal" id="absenceModal" hidden>
      <section class="absence-card" role="dialog" aria-modal="true" aria-labelledby="absenceTitle">
        <div class="absence-head">
          <div>
            <h2 id="absenceTitle">Registrar ausência</h2>
            <p>Registre o período fora da empresa e fotografe o documento comprobatório quando necessário.</p>
          </div>
          <button class="absence-close" type="button" aria-label="Fechar">×</button>
        </div>
        <form class="absence-form" id="absenceForm">
          <div class="absence-grid">
            <label class="absence-field"><span>Data</span><input id="absenceDate" type="date" required></label>
            <label class="absence-field"><span>Motivo</span><select id="absenceReason" required><option value="Consulta médica">Consulta médica</option><option value="Exame">Exame</option><option value="Atestado médico">Atestado médico</option><option value="Compromisso autorizado">Compromisso autorizado</option><option value="Outro">Outro</option></select></label>
            <label class="absence-field"><span>Início da ausência</span><input id="absenceStart" type="time" required></label>
            <label class="absence-field"><span>Fim da ausência</span><input id="absenceEnd" type="time" required></label>
          </div>
          <label class="absence-field"><span>Observação (opcional)</span><textarea id="absenceNote" maxlength="400" placeholder="Ex.: consulta no hospital..."></textarea></label>

          <section class="absence-photo-panel">
            <div class="absence-photo-heading">
              <div><strong>Documento comprobatório (opcional)</strong><small>Fotografe ou selecione atestado, declaração, comprovante de consulta ou outro documento.</small></div>
            </div>
            <div class="absence-camera-viewport">
              <video id="absenceCameraVideo" class="hidden" playsinline muted></video>
              <img id="absencePreview" class="absence-preview" alt="Prévia do documento" />
              <div id="absenceCameraPlaceholder" class="absence-camera-placeholder"><span class="absence-camera-icon">📄</span><strong>Nenhum comprovante selecionado</strong><small>Use Fotografar para abrir a câmera traseira.</small></div>
            </div>
            <input id="absencePhoto" type="file" accept="image/*" hidden>
            <div class="absence-camera-actions">
              <button id="absenceOpenCameraButton" class="absence-btn camera" type="button">📷 Fotografar</button>
              <button id="absenceCapturePhotoButton" class="absence-btn primary hidden" type="button">● Capturar foto</button>
              <button id="absenceGalleryButton" class="absence-btn secondary" type="button">🖼️ Galeria</button>
              <button id="absenceClearPhotoButton" class="absence-btn secondary" type="button">Limpar foto</button>
            </div>
          </section>

          <div class="absence-actions">
            <button class="absence-btn secondary" type="button" data-absence-list>Ver registros</button>
            <button class="absence-btn primary" type="submit">Salvar ausência</button>
          </div>
        </form>
        <div id="absenceList" class="absence-list"></div>
      </section>
    </div>`);

  const modal = document.querySelector('#absenceModal');
  const closeModal = () => {
    stopAbsenceCamera();
    modal.hidden = true;
  };
  modal.querySelector('.absence-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.querySelector('#absenceOpenCameraButton').addEventListener('click', startAbsenceCamera);
  document.querySelector('#absenceCapturePhotoButton').addEventListener('click', captureAbsencePhoto);
  document.querySelector('#absenceGalleryButton').addEventListener('click', () => document.querySelector('#absencePhoto').click());
  document.querySelector('#absenceClearPhotoButton').addEventListener('click', () => {
    stopAbsenceCamera();
    clearSelectedDocument();
  });
  document.querySelector('#absencePhoto').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    stopAbsenceCamera();
    showSelectedDocument(file, file.name || 'comprovante-ausencia.jpg', file.type || 'image/jpeg');
  });
  modal.querySelector('[data-absence-list]').addEventListener('click', renderList);
  document.querySelector('#absenceForm').addEventListener('submit', saveAbsence);
}

async function saveAbsence(event) {
  event.preventDefault();
  const date = document.querySelector('#absenceDate').value;
  const startTime = document.querySelector('#absenceStart').value;
  const endTime = document.querySelector('#absenceEnd').value;
  if (endTime <= startTime) {
    toast('O horário de saída deve ser posterior ao início da ausência.');
    return;
  }

  const item = {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    date,
    startTime,
    endTime,
    reason: document.querySelector('#absenceReason').value,
    note: document.querySelector('#absenceNote').value.trim(),
    document: selectedAbsenceDocument ? {
      blob: selectedAbsenceDocument.blob,
      name: selectedAbsenceDocument.name,
      type: selectedAbsenceDocument.type,
    } : null,
    createdAt: new Date().toISOString(),
  };

  await putAbsence(item);
  toast('Ausência registrada com sucesso. Ao retornar, registre seu ponto normalmente.');
  event.target.reset();
  stopAbsenceCamera();
  clearSelectedDocument();
  document.querySelector('#absenceDate').value = today();
  document.querySelector('#absenceStart').value = nowTime();
  await renderList();
  augmentHistory();
}

function absenceRecordMarkup(item, { history = false } = {}) {
  const documentAction = item.document?.blob
    ? `<button class="absence-document-button" type="button" data-absence-document="${esc(item.id)}">📎 Visualizar comprovante</button>`
    : '<small class="absence-no-document">Sem documento anexado</small>';
  if (history) {
    return `<article class="absence-history-row" data-absence-record="${esc(item.id)}">
      <div><b>${br(item.date)} • ${esc(item.startTime)} às ${esc(item.endTime)} — ${esc(item.reason)}</b><small>${esc(item.note || 'Sem observação')}</small></div>
      ${documentAction}
    </article>`;
  }
  return `<article class="absence-item" data-absence-record="${esc(item.id)}">
    <span class="absence-tag">${esc(item.reason)}</span>
    <strong>${br(item.date)} • ${esc(item.startTime)} às ${esc(item.endTime)}</strong>
    ${item.note ? `<small>${esc(item.note)}</small>` : ''}
    ${documentAction}
  </article>`;
}

function bindDocumentButtons(scope = document) {
  scope.querySelectorAll('[data-absence-document]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAbsenceDocument(button.dataset.absenceDocument);
    });
  });
  scope.querySelectorAll('[data-absence-record]').forEach((row) => {
    row.addEventListener('click', () => {
      const button = row.querySelector('[data-absence-document]');
      if (button) openAbsenceDocument(button.dataset.absenceDocument);
    });
  });
}

async function renderList() {
  const target = document.querySelector('#absenceList');
  if (!target) return;
  const items = await listAbsences();
  if (!items.length) {
    target.innerHTML = '<div class="absence-empty">Nenhuma ausência registrada.</div>';
    return;
  }
  target.innerHTML = `<div class="absence-list-title"><strong>Ausências registradas</strong><small>Toque em um registro com documento para visualizar o comprovante.</small></div>${items.slice(0, 20).map((item) => absenceRecordMarkup(item)).join('')}`;
  bindDocumentButtons(target);
}

function openAbsence() {
  ensureModal();
  stopAbsenceCamera();
  clearSelectedDocument();
  const modal = document.querySelector('#absenceModal');
  document.querySelector('#absenceDate').value = today();
  document.querySelector('#absenceStart').value = nowTime();
  document.querySelector('#absenceEnd').value = '';
  modal.hidden = false;
  renderList();
}

function addLaunchButton() {
  const buttons = [...document.querySelectorAll('button')];
  if (buttons.some((button) => button.dataset.absenceLaunch)) return;
  const environment = buttons.find((button) => /registrar ambiente/i.test(button.textContent || ''));
  const point = buttons.find((button) => /registrar ponto/i.test(button.textContent || ''));
  const anchor = environment || point;
  if (!anchor) return;
  const button = anchor.cloneNode(false);
  button.type = 'button';
  button.dataset.absenceLaunch = '1';
  button.classList.add('absence-launch');
  button.innerHTML = '🩺 <span>Registrar Ausência</span>';
  button.addEventListener('click', openAbsence);
  anchor.insertAdjacentElement('afterend', button);
}

async function augmentHistory() {
  const heading = [...document.querySelectorAll('h1,h2,h3')].find((element) => /histórico diário/i.test(element.textContent || ''));
  if (!heading) return;
  let panel = document.querySelector('#absenceHistoryPanel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'absenceHistoryPanel';
    panel.className = 'absence-history-panel';
    heading.parentElement?.insertAdjacentElement('afterend', panel);
  }
  const items = await listAbsences();
  panel.innerHTML = `<div class="absence-history-heading"><div><h3>Ausências registradas</h3><small>Os comprovantes podem ser abertos diretamente pelo histórico.</small></div></div>${items.length
    ? items.slice(0, 30).map((item) => absenceRecordMarkup(item, { history: true })).join('')
    : '<div class="absence-empty">Nenhuma ausência registrada.</div>'}`;
  bindDocumentButtons(panel);
}

function syncUi() {
  addLaunchButton();
  augmentHistory();
}

ensureModal();
ensureViewer();
syncUi();
new MutationObserver(() => {
  clearTimeout(window.__absenceUiTimer);
  window.__absenceUiTimer = setTimeout(syncUi, 80);
}).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
