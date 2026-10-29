import { getAll, getById, getByIndex, put, remove, createId } from '../db.js';
import { confirmAction, escapeHtml, showToast, navigate } from '../ui.js';
import { thumbImgHtml, photoPickerHtml, bindPhotoPicker, photoUrl } from '../photos.js';

export async function renderKarts(root, params = {}) {
  if (params.kartId) {
    await renderKartDetail(root, params.kartId);
    return;
  }

  const karts = (await getAll('karts')).sort((a, b) => a.name.localeCompare(b.name));
  const setups = await getAll('setups');
  const setupCount = (kartId) => setups.filter((s) => s.kartId === kartId).length;

  root.innerHTML = `
    <div class="stack">
      <div class="row row--spread">
        <div>
          <a class="muted" href="#/data">← Données</a>
          <h1>Karts</h1>
        </div>
        <button type="button" class="btn btn--sm" id="btn-new">+ Nouveau</button>
      </div>

      ${
        karts.length === 0
          ? `<div class="empty">Aucun kart. Ajoute un châssis pour y lier des réglages.</div>`
          : `<div class="list">${karts
              .map(
                (k) => `
              <div class="list-item" data-id="${k.id}">
                <a href="#/karts/${k.id}" class="list-item__main" style="text-decoration:none;color:inherit">
                  ${thumbImgHtml(k.photo, { className: 'photo-thumb', alt: escapeHtml(k.name) })}
                  <div>
                    <div class="list-item__title">${escapeHtml(k.name)}</div>
                    <div class="list-item__meta">${setupCount(k.id)} réglage(s)</div>
                  </div>
                </a>
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

  root.querySelector('#btn-new')?.addEventListener('click', () => openKartForm(root));
  root.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('[data-id]').dataset.id;
      openKartForm(root, karts.find((k) => k.id === id));
    });
  });
  root.querySelectorAll('.btn-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('[data-id]').dataset.id;
      if (!confirmAction('Supprimer ce kart et ses réglages ?')) return;
      const linked = await getByIndex('setups', 'byKart', id);
      for (const s of linked) await remove('setups', s.id);
      await remove('karts', id);
      showToast('Kart supprimé');
      renderKarts(root);
    });
  });
}

async function renderKartDetail(root, kartId) {
  const kart = await getById('karts', kartId);
  if (!kart) {
    root.innerHTML = `<div class="empty">Kart introuvable. <a href="#/karts">Retour</a></div>`;
    return;
  }
  const setups = (await getByIndex('setups', 'byKart', kartId)).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const hero = kart.photo ? `<img class="photo-hero" src="${photoUrl(kart.photo)}" alt="${escapeHtml(kart.name)}" />` : '';

  root.innerHTML = `
    <div class="stack">
      <div class="row row--spread">
        <div style="flex:1">
          <a class="muted" href="#/karts">← Karts</a>
          ${hero}
          <h1>${escapeHtml(kart.name)}</h1>
          <p>${escapeHtml(kart.notes || 'Aucun commentaire')}</p>
        </div>
        <button type="button" class="btn btn--sm" id="btn-new-setup">+ Setup</button>
      </div>

      ${
        setups.length === 0
          ? `<div class="empty">Aucun réglage. Ajoute pressions, essence et ballast.</div>`
          : `<div class="list">${setups
              .map(
                (s) => `
              <div class="card" data-id="${s.id}">
                <div class="row row--spread">
                  <div class="list-item__title">${escapeHtml(s.name)}</div>
                  <div class="row">
                    <button type="button" class="btn btn--ghost btn--sm btn-edit-setup">Éditer</button>
                    <button type="button" class="btn btn--danger btn--sm btn-del-setup">Suppr.</button>
                  </div>
                </div>
                <div class="weather-box" style="margin-top:10px">
                  <div>Pression AV<br><strong>${s.tirePressureFront ?? '—'} bar</strong></div>
                  <div>Pression AR<br><strong>${s.tirePressureRear ?? '—'} bar</strong></div>
                  <div>Essence<br><strong>${s.fuelL ?? '—'} L</strong></div>
                  <div>Ballast<br><strong>${s.ballastKg ?? '—'} kg</strong></div>
                </div>
                ${s.notes ? `<p class="muted" style="margin-top:8px;margin-bottom:0">${escapeHtml(s.notes)}</p>` : ''}
              </div>`
              )
              .join('')}</div>`
      }
    </div>
  `;

  root.querySelector('#btn-new-setup')?.addEventListener('click', () => openSetupForm(root, kartId));
  root.querySelectorAll('.btn-edit-setup').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('[data-id]').dataset.id;
      openSetupForm(root, kartId, setups.find((s) => s.id === id));
    });
  });
  root.querySelectorAll('.btn-del-setup').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('[data-id]').dataset.id;
      if (!confirmAction('Supprimer ce réglage ?')) return;
      await remove('setups', id);
      showToast('Réglage supprimé');
      renderKartDetail(root, kartId);
    });
  });
}

function openKartForm(root, kart = null) {
  const isEdit = Boolean(kart);
  const photoState = { photo: kart?.photo || null };
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>${isEdit ? 'Modifier le kart' : 'Nouveau kart'}</h2>
      <form class="form" id="kart-form">
        ${photoPickerHtml({ label: 'Photo du kart (JPEG)', previewId: 'kart-photo' })}
        <div class="field">
          <label for="name">Nom</label>
          <input id="name" name="name" required maxlength="80" value="${escapeHtml(kart?.name || '')}" />
        </div>
        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" name="notes" maxlength="500">${escapeHtml(kart?.notes || '')}</textarea>
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
    initialPhoto: kart?.photo || null
  });
  const close = () => {
    picker.destroy();
    backdrop.remove();
  };
  backdrop.querySelector('#cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelector('#kart-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const record = {
      id: kart?.id || createId(),
      name: String(fd.get('name') || '').trim(),
      notes: String(fd.get('notes') || '').trim(),
      photo: photoState.photo || null,
      createdAt: kart?.createdAt || new Date().toISOString()
    };
    if (!record.name) return;
    await put('karts', record);
    showToast(isEdit ? 'Kart mis à jour' : 'Kart créé');
    close();
    if (!isEdit) navigate(`#/karts/${record.id}`);
    else renderKarts(root);
  });
}

function openSetupForm(root, kartId, setup = null) {
  const isEdit = Boolean(setup);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>${isEdit ? 'Modifier le réglage' : 'Nouveau réglage'}</h2>
      <form class="form" id="setup-form">
        <div class="field">
          <label for="name">Nom du setup</label>
          <input id="name" name="name" required maxlength="80" value="${escapeHtml(setup?.name || 'Setup base')}" />
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="tirePressureFront">Pression AV (bar)</label>
            <input id="tirePressureFront" name="tirePressureFront" type="number" step="0.01" min="0" value="${setup?.tirePressureFront ?? ''}" />
          </div>
          <div class="field">
            <label for="tirePressureRear">Pression AR (bar)</label>
            <input id="tirePressureRear" name="tirePressureRear" type="number" step="0.01" min="0" value="${setup?.tirePressureRear ?? ''}" />
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="fuelL">Essence (L)</label>
            <input id="fuelL" name="fuelL" type="number" step="0.1" min="0" value="${setup?.fuelL ?? ''}" />
          </div>
          <div class="field">
            <label for="ballastKg">Ballast (kg)</label>
            <input id="ballastKg" name="ballastKg" type="number" step="0.1" min="0" value="${setup?.ballastKg ?? ''}" />
          </div>
        </div>
        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" name="notes" maxlength="500">${escapeHtml(setup?.notes || '')}</textarea>
        </div>
        <div class="row">
          <button type="button" class="btn btn--ghost" id="cancel">Annuler</button>
          <button type="submit" class="btn" style="flex:1">Enregistrer</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('#cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelector('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const num = (key) => {
      const v = fd.get(key);
      return v === '' || v == null ? null : Number(v);
    };
    const record = {
      id: setup?.id || createId(),
      kartId,
      name: String(fd.get('name') || '').trim(),
      tirePressureFront: num('tirePressureFront'),
      tirePressureRear: num('tirePressureRear'),
      fuelL: num('fuelL'),
      ballastKg: num('ballastKg'),
      notes: String(fd.get('notes') || '').trim(),
      createdAt: setup?.createdAt || new Date().toISOString()
    };
    if (!record.name) return;
    await put('setups', record);
    showToast(isEdit ? 'Réglage mis à jour' : 'Réglage créé');
    close();
    renderKartDetail(root, kartId);
  });
}
