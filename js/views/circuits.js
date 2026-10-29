import { getAll, put, remove, createId } from '../db.js';
import { confirmAction, escapeHtml, showToast } from '../ui.js';
import { thumbImgHtml, photoPickerHtml, bindPhotoPicker } from '../photos.js';

export async function renderCircuits(root) {
  const circuits = (await getAll('circuits')).sort((a, b) => a.name.localeCompare(b.name));

  root.innerHTML = `
    <div class="stack">
      <div class="row row--spread">
        <div>
          <a class="muted" href="#/data">← Données</a>
          <h1>Circuits</h1>
        </div>
        <button type="button" class="btn btn--sm" id="btn-new">+ Nouveau</button>
      </div>

      ${
        circuits.length === 0
          ? `<div class="empty">Aucun circuit. Ajoute ta première piste.</div>`
          : `<div class="list" id="list">${circuits
              .map(
                (c) => `
              <div class="list-item" data-id="${c.id}">
                <div class="list-item__main">
                  ${thumbImgHtml(c.photo, { className: 'photo-thumb', alt: escapeHtml(c.name) })}
                  <div>
                    <div class="list-item__title">${escapeHtml(c.name)}</div>
                    <div class="list-item__meta">${escapeHtml(c.location || 'Lieu non renseigné')}</div>
                  </div>
                </div>
                <div class="row">
                  <button type="button" class="btn btn--ghost btn--sm btn-edit">Éditer</button>
                  <button type="button" class="btn btn--danger btn--sm btn-del">Suppr.</button>
                </div>
              </div>`
              )
              .join('')}</div>`
      }
    </div>
  `;

  root.querySelector('#btn-new')?.addEventListener('click', () => openForm(root));
  root.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('[data-id]').dataset.id;
      openForm(root, circuits.find((c) => c.id === id));
    });
  });
  root.querySelectorAll('.btn-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('[data-id]').dataset.id;
      if (!confirmAction('Supprimer ce circuit ?')) return;
      await remove('circuits', id);
      showToast('Circuit supprimé');
      renderCircuits(root);
    });
  });
}

function openForm(root, circuit = null) {
  const isEdit = Boolean(circuit);
  const photoState = { photo: circuit?.photo || null };
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>${isEdit ? 'Modifier le circuit' : 'Nouveau circuit'}</h2>
      <form class="form" id="circuit-form">
        ${photoPickerHtml({ label: 'Plan de piste (JPEG)', previewId: 'circuit-photo' })}
        <div class="field">
          <label for="name">Nom</label>
          <input id="name" name="name" required maxlength="80" value="${escapeHtml(circuit?.name || '')}" />
        </div>
        <div class="field">
          <label for="location">Lieu</label>
          <input id="location" name="location" maxlength="120" value="${escapeHtml(circuit?.location || '')}" />
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="lat">Latitude</label>
            <input id="lat" name="lat" type="number" step="any" value="${circuit?.lat ?? ''}" />
          </div>
          <div class="field">
            <label for="lon">Longitude</label>
            <input id="lon" name="lon" type="number" step="any" value="${circuit?.lon ?? ''}" />
          </div>
        </div>
        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" name="notes" maxlength="500">${escapeHtml(circuit?.notes || '')}</textarea>
        </div>
        <div class="row">
          <button type="button" class="btn btn--ghost" id="cancel">Annuler</button>
          <button type="submit" class="btn" style="flex:1">Enregistrer</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);
  const picker = bindPhotoPicker(backdrop.querySelector('[data-photo-picker]'), photoState, {
    initialPhoto: circuit?.photo || null
  });

  const close = () => {
    picker.destroy();
    backdrop.remove();
  };
  backdrop.querySelector('#cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelector('#circuit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const latRaw = fd.get('lat');
    const lonRaw = fd.get('lon');
    const record = {
      id: circuit?.id || createId(),
      name: String(fd.get('name') || '').trim(),
      location: String(fd.get('location') || '').trim(),
      lat: latRaw === '' ? null : Number(latRaw),
      lon: lonRaw === '' ? null : Number(lonRaw),
      notes: String(fd.get('notes') || '').trim(),
      photo: photoState.photo || null,
      createdAt: circuit?.createdAt || new Date().toISOString()
    };
    if (!record.name) return;
    await put('circuits', record);
    showToast(isEdit ? 'Circuit mis à jour' : 'Circuit créé');
    close();
    renderCircuits(root);
  });
}
