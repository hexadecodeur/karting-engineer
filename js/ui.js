let toastTimer = null;
let navigateHandler = null;

export function setNavigateHandler(fn) {
  navigateHandler = fn;
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function navigate(hash) {
  if (!hash.startsWith('#')) hash = `#${hash}`;
  if (location.hash === hash) {
    navigateHandler?.();
  } else {
    location.hash = hash;
  }
}

export function showToast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

export function confirmAction(message) {
  return window.confirm(message);
}
