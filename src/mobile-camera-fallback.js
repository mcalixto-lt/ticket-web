(() => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || window.matchMedia?.('(max-width: 820px)').matches;
  if (!isMobile) return;

  function install() {
    const originalInput = document.querySelector('#imageFileInput');
    if (!originalInput || document.querySelector('#nativeCameraInput')) return;

    const nativeInput = document.createElement('input');
    nativeInput.id = 'nativeCameraInput';
    nativeInput.type = 'file';
    nativeInput.accept = 'image/*';
    nativeInput.setAttribute('capture', 'environment');
    nativeInput.hidden = true;
    document.body.appendChild(nativeInput);

    nativeInput.addEventListener('change', () => {
      const file = nativeInput.files?.[0];
      if (!file) return;
      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        originalInput.files = transfer.files;
      } catch {
        // Alguns navegadores não permitem atribuir FileList. Nesse caso,
        // recriamos um DataTransfer e disparamos o mesmo fluxo quando possível.
      }
      originalInput.dispatchEvent(new Event('change', { bubbles: true }));
      nativeInput.value = '';
    });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#openCameraButton, #captureButton');
    if (!button) return;

    const video = document.querySelector('#cameraVideo');
    const directCameraIsActive = video && !video.classList.contains('hidden') && video.srcObject;
    if (button.id === 'captureButton' && directCameraIsActive) return;

    install();
    const nativeInput = document.querySelector('#nativeCameraInput');
    if (!nativeInput) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    nativeInput.click();
  }, true);

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  install();
})();
