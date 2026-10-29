const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.82;
const MAX_BYTES = 2 * 1024 * 1024;

const objectUrls = new Set();

export function photoUrl(blob) {
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  objectUrls.add(url);
  return url;
}

export function revokePhotoUrl(url) {
  if (!url) return;
  URL.revokeObjectURL(url);
  objectUrls.delete(url);
}

export function revokeAllPhotoUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
}

function isJpegFile(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return true;
  return /\.jpe?g$/i.test(file.name || '');
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire l’image'));
    };
    img.src = url;
  });
}

export async function compressJpegFile(file) {
  if (!isJpegFile(file)) {
    throw new Error('JPEG uniquement (.jpg / .jpeg)');
  }

  const img = await loadImageFromFile(file);
  let { width, height } = img;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compression échouée'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });

  if (blob.size > MAX_BYTES) {
    throw new Error('Image trop lourde après compression (max 2 Mo)');
  }

  return blob;
}

/** Opens a file picker and returns a compressed JPEG Blob, or null if cancelled. */
export function pickAndCompressJpeg() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,.jpg,.jpeg';
    input.hidden = true;
    document.body.appendChild(input);

    const cleanup = () => input.remove();

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve(await compressJpegFile(file));
      } catch (err) {
        reject(err);
      }
    });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    });

    input.click();
  });
}

/** HTML snippet for photo picker UI (preview filled later via bindPhotoPicker). */
export function photoPickerHtml({ label = 'Photo JPEG', previewId = 'photo-preview', avatar = false }) {
  const cls = avatar ? 'photo-preview photo-preview--avatar' : 'photo-preview';
  return `
    <div class="photo-picker" data-photo-picker>
      <span class="photo-picker__label">${label}</span>
      <div class="${cls}" id="${previewId}"></div>
      <div class="row">
        <button type="button" class="btn btn--secondary btn--sm" data-photo-import>Importer JPEG</button>
        <button type="button" class="btn btn--ghost btn--sm" data-photo-clear>Retirer</button>
      </div>
    </div>
  `;
}

/**
 * Bind import/clear on a picker root. Mutates `state.photo` (Blob|null).
 * @returns {{ getPhoto: () => Blob|null, destroy: () => void }}
 */
export function bindPhotoPicker(pickerEl, state, { initialPhoto = null } = {}) {
  state.photo = initialPhoto ?? null;
  const preview = pickerEl.querySelector('.photo-preview') || pickerEl.querySelector('[id]');
  let currentUrl = null;

  const paint = () => {
    if (currentUrl) {
      revokePhotoUrl(currentUrl);
      currentUrl = null;
    }
    if (!preview) return;
    if (state.photo) {
      currentUrl = photoUrl(state.photo);
      preview.innerHTML = `<img src="${currentUrl}" alt="Aperçu" />`;
      preview.classList.add('has-photo');
    } else {
      preview.innerHTML = `<span class="muted">Aucune photo</span>`;
      preview.classList.remove('has-photo');
    }
  };

  paint();

  const onImport = async () => {
    try {
      const blob = await pickAndCompressJpeg();
      if (!blob) return;
      state.photo = blob;
      paint();
    } catch (err) {
      const { showToast } = await import('./ui.js');
      showToast(err.message || 'Import impossible');
    }
  };

  const onClear = () => {
    state.photo = null;
    paint();
  };

  pickerEl.querySelector('[data-photo-import]')?.addEventListener('click', onImport);
  pickerEl.querySelector('[data-photo-clear]')?.addEventListener('click', onClear);

  return {
    getPhoto: () => state.photo,
    destroy: () => {
      if (currentUrl) revokePhotoUrl(currentUrl);
    }
  };
}

export function thumbImgHtml(blob, { className = 'photo-thumb', alt = '' } = {}) {
  if (!blob) return '';
  const url = photoUrl(blob);
  return `<img class="${className}" src="${url}" alt="${alt}" />`;
}
