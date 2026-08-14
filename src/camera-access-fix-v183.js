(() => {
  const CAMERA_BUTTONS = '#openCameraButton, #captureButton';
  let permissionState = 'unknown';
  let fallbackTimer = null;

  function input() {
    return document.querySelector('#imageFileInput');
  }

  function videoReady() {
    const video = document.querySelector('#cameraVideo');
    return Boolean(video && !video.classList.contains('hidden') && video.srcObject);
  }

  function previewReady() {
    const image = document.querySelector('#scanPreviewImage');
    return Boolean(image && !image.classList.contains('hidden') && image.getAttribute('src'));
  }

  function showFallbackNotice() {
    const bar = document.querySelector('#qualityBar');
    if (!bar || videoReady() || previewReady()) return;
    bar.innerHTML = '<span class="quality-dot medium"></span><strong>Câmera bloqueada</strong><small>O álbum será aberto para você selecionar o comprovante.</small>';
  }

  function openGallery() {
    const fileInput = input();
    if (!fileInput) return;
    showFallbackNotice();
    try { fileInput.click(); } catch {}
  }

  async function readCameraPermission() {
    try {
      if (!navigator.permissions?.query) return;
      const status = await navigator.permissions.query({ name: 'camera' });
      permissionState = status.state;
      status.addEventListener?.('change', () => { permissionState = status.state; });
    } catch {
      permissionState = 'unknown';
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.(CAMERA_BUTTONS);
    if (!button) return;

    if (permissionState === 'denied') {
      event.preventDefault();
      event.stopImmediatePropagation();
      openGallery();
      return;
    }

    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (!videoReady() && !previewReady()) openGallery();
    }, 1800);
  }, true);

  const observer = new MutationObserver(() => {
    const scan = document.querySelector('#imageFileInput');
    if (!scan) return;
    if (permissionState === 'denied') showFallbackNotice();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('pageshow', readCameraPermission);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) readCameraPermission();
  });

  readCameraPermission();
})();
