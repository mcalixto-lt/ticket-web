(() => {
  let permissionState = 'unknown';
  let fallbackTimer = null;

  function fileInput() {
    return document.querySelector('#imageFileInput');
  }

  function cameraActive() {
    const video = document.querySelector('#cameraVideo');
    return Boolean(video && !video.classList.contains('hidden') && video.srcObject);
  }

  function imageSelected() {
    const image = document.querySelector('#scanPreviewImage');
    return Boolean(image && !image.classList.contains('hidden') && image.getAttribute('src'));
  }

  function setFallbackMessage() {
    const quality = document.querySelector('#qualityBar');
    if (!quality || cameraActive() || imageSelected()) return;
    quality.innerHTML = '<span class="quality-dot medium"></span><strong>Acesso à câmera não disponível</strong><small>Selecione o comprovante na galeria para continuar.</small>';
  }

  function openGallery() {
    const input = fileInput();
    if (!input) return;
    setFallbackMessage();
    try {
      input.removeAttribute('capture');
      input.click();
    } catch {}
  }

  async function refreshPermission() {
    try {
      if (!navigator.permissions?.query) {
        permissionState = 'unknown';
        return;
      }
      const status = await navigator.permissions.query({ name: 'camera' });
      permissionState = status.state;
      status.addEventListener?.('change', () => {
        permissionState = status.state;
      });
    } catch {
      permissionState = 'unknown';
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#openCameraButton, #captureButton');
    if (!button) return;

    if (button.id === 'captureButton' && cameraActive()) return;

    if (permissionState === 'denied') {
      event.preventDefault();
      event.stopImmediatePropagation();
      openGallery();
      return;
    }

    clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(() => {
      if (!cameraActive() && !imageSelected()) openGallery();
    }, 1800);
  }, true);

  window.addEventListener('pageshow', refreshPermission);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshPermission();
  });

  refreshPermission();
})();
