function enhanceAbsenceLayout() {
  const modal = document.querySelector('#absenceModal');
  if (!modal || modal.dataset.layoutV175 === '1') return;

  const card = modal.querySelector('.absence-card');
  const form = modal.querySelector('#absenceForm');
  const photoPanel = modal.querySelector('.absence-photo-panel');
  const photoHeading = modal.querySelector('.absence-photo-heading');
  const viewport = modal.querySelector('.absence-camera-viewport');
  const placeholder = modal.querySelector('.absence-camera-placeholder');
  const preview = modal.querySelector('#absencePreview');
  const video = modal.querySelector('#absenceCameraVideo');
  const actions = modal.querySelector('.absence-camera-actions');
  const capture = modal.querySelector('#absenceCapturePhotoButton');
  const openCamera = modal.querySelector('#absenceOpenCameraButton');
  const gallery = modal.querySelector('#absenceGalleryButton');
  const clear = modal.querySelector('#absenceClearPhotoButton');
  const listButton = modal.querySelector('[data-absence-list]');
  const saveButton = modal.querySelector('.absence-actions .primary');

  if (!card || !form || !photoPanel || !viewport || !actions || !capture || !openCamera) return;

  modal.dataset.layoutV175 = '1';
  modal.classList.add('absence-screen-v175');
  card.classList.add('absence-page-v175');
  form.classList.add('absence-form-v175');

  if (photoHeading) {
    photoHeading.className = 'absence-proof-title-v175';
    const strong = photoHeading.querySelector('strong');
    if (strong) strong.textContent = 'COMPROVANTE (OPCIONAL)';
    const small = photoHeading.querySelector('small');
    if (small) small.remove();
  }

  photoPanel.className = 'absence-proof-v175';
  viewport.className = 'scanner-viewport absence-scanner-viewport-v175';
  if (video) video.className = video.classList.contains('hidden') ? 'hidden' : '';
  if (preview) {
    preview.className = preview.classList.contains('show') ? '' : 'hidden';
    preview.alt = 'Prévia do comprovante de ausência';
  }
  if (placeholder) {
    placeholder.className = placeholder.classList.contains('hidden') || placeholder.classList.contains('camera-active')
      ? 'scanner-placeholder hidden'
      : 'scanner-placeholder';
    placeholder.innerHTML = '<strong>Posicione o comprovante</strong><span>Centralize o documento dentro da moldura.</span>';
  }

  if (!viewport.querySelector('.scanner-frame')) {
    const frame = document.createElement('div');
    frame.className = 'scanner-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.innerHTML = '<i></i><i></i><i></i><i></i>';
    viewport.appendChild(frame);
  }

  let qualityBar = photoPanel.querySelector('.quality-bar');
  if (!qualityBar) {
    qualityBar = document.createElement('div');
    qualityBar.className = 'quality-bar';
    qualityBar.innerHTML = '<span class="quality-dot"></span><strong>Sem imagem</strong><small>Abra a câmera para fotografar o comprovante.</small>';
    viewport.insertAdjacentElement('afterend', qualityBar);
  }

  gallery?.remove();
  clear?.remove();
  listButton?.remove();

  actions.className = 'scanner-controls absence-scanner-controls-v175';
  capture.className = `${capture.classList.contains('hidden') ? 'hidden ' : ''}capture-button`;
  capture.innerHTML = '<span></span>';
  capture.setAttribute('aria-label', 'Capturar foto do comprovante de ausência');

  let secondary = photoPanel.querySelector('.scan-secondary-actions');
  if (!secondary) {
    secondary = document.createElement('div');
    secondary.className = 'scan-secondary-actions single-action absence-open-camera-v175';
    actions.insertAdjacentElement('afterend', secondary);
  }
  openCamera.className = 'button button-outline';
  openCamera.innerHTML = '📷 Abrir câmera';
  secondary.appendChild(openCamera);

  const absenceActions = modal.querySelector('.absence-actions');
  if (absenceActions && saveButton) {
    absenceActions.classList.add('absence-save-row-v175');
    saveButton.className = 'button button-gold button-block';
    saveButton.textContent = 'Salvar ausência';
  }

  const syncCameraState = () => {
    const cameraRunning = video && !video.classList.contains('hidden');
    const hasPreview = preview && (!preview.classList.contains('hidden') || preview.classList.contains('show'));
    const dot = qualityBar.querySelector('.quality-dot');
    const strong = qualityBar.querySelector('strong');
    const small = qualityBar.querySelector('small');

    if (cameraRunning) {
      dot.className = 'quality-dot good';
      strong.textContent = 'Câmera pronta';
      small.textContent = 'Centralize o comprovante e toque no círculo.';
    } else if (hasPreview) {
      dot.className = 'quality-dot good';
      strong.textContent = 'Foto capturada';
      small.textContent = 'Comprovante pronto para ser salvo.';
    } else {
      dot.className = 'quality-dot';
      strong.textContent = 'Sem imagem';
      small.textContent = 'Abra a câmera para fotografar o comprovante.';
    }
  };

  syncCameraState();
  const stateObserver = new MutationObserver(syncCameraState);
  if (video) stateObserver.observe(video, { attributes: true, attributeFilter: ['class'] });
  if (preview) stateObserver.observe(preview, { attributes: true, attributeFilter: ['class', 'src'] });

  const list = modal.querySelector('#absenceList');
  if (list) list.classList.add('absence-records-v175');
}

const observer = new MutationObserver(() => enhanceAbsenceLayout());
observer.observe(document.body, { childList: true, subtree: true });
enhanceAbsenceLayout();
