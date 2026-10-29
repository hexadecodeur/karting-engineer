import { getAll, put, remove, createId } from '../db.js';
import { confirmAction, escapeHtml, showToast } from '../ui.js';
import { thumbImgHtml, photoPickerHtml, bindPhotoPicker } from '../photos.js';

export async function renderPilots(root) {
  const pilots = (await getAll('pilots')).sort((a, b) => a.name.localeCompare(b.name));

  root.innerHTML = `
    <div class="stack">
      <div class="row row--spread">
        <div>
          <a class="muted" href="#/data">← Données</a>
          <h1>Pilotes</h1>
        </div>
        <button type="button" class="btn btn--sm" id="btn-new">+ Nouveau</button>
      </div>

      ${
        pilots.length === 0
          ? `<div class="empty">Aucun pilote. Ajoute ton premier profil.</div>`
          : `<div class="list">${pilots
              .map(
                (p) => `
              <div class="list-item" data-id="${p.id}">
                <div class="list-item__main">
                  ${thumbImgHtml(p.photo, { className: 'photo-avatar', alt: escapeHtml(p.name) })}
                  <div>
                    <div class="list-item__title">${escapeHtml(p.name)}</div>
                    <div class="list-item__meta">${p.age ?? '—'} ans · ${p.weightKg ?? '—'} kg · ${p.heightCm ?? '—'} cm</div>
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
      openForm(root, pilots.find((p) => p.id === id));
    });
  });
  root.querySelectorAll('.btn-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('[data-id]').dataset.id;
      if (!confirmAction('Supprimer ce pilote ?')) return;
      await remove('pilots', id);
      showToast('Pilote supprimé');
      renderPilots(root);
    });
  });
}

function openForm(root, pilot = null) {
  const isEdit = Boolean(pilot);
  const photoState = { photo: pilot?.photo || null };
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>${isEdit ? 'Modifier le pilote' : 'Nouveau pilote'}</h2>
      <form class="form" id="pilot-form">
        ${photoPickerHtml({ label: 'Photo de profil (JPEG)', previewId: 'pilot-photo', avatar: true })}
        <div class="field">
          <label for="name">Nom</label>
          <input id="name" name="name" required maxlength="80" value="${escapeHtml(pilot?.name || '')}" />
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="age">Âge</label>
            <input id="age" name="age" type="number" min="1" max="120" value="${pilot?.age ?? ''}" />
          </div>
          <div class="field">
            <label for="weightKg">Poids (kg)</label>
            <input id="weightKg" name="weightKg" type="number" min="1" max="300" step="0.1" value="${pilot?.weightKg ?? ''}" />
          </div>
        </div>
        <div class="field">
          <label for="heightCm">Taille (cm)</label>
          <input id="heightCm" name="heightCm" type="number" min="50" max="250" value="${pilot?.heightCm ?? ''}" />
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
    initialPhoto: pilot?.photo || null
  });

  const close = () => {
    picker.destroy();
    backdrop.remove();
  };
  backdrop.querySelector('#cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelector('#pilot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const num = (key) => {
      const v = fd.get(key);
      return v === '' || v == null ? null : Number(v);
    };
    const record = {
      id: pilot?.id || createId(),
      name: String(fd.get('name') || '').trim(),
      age: num('age'),
      weightKg: num('weightKg'),
      heightCm: num('heightCm'),
      photo: photoState.photo || null,
      createdAt: pilot?.createdAt || new Date().toISOString()
    };
    if (!record.name) return;
    await put('pilots', record);
    showToast(isEdit ? 'Pilote mis à jour' : 'Pilote créé');
    close();
    renderPilots(root);
  });
}
