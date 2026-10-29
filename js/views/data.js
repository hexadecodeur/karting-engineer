export async function renderData(root) {
  root.innerHTML = `
    <div class="stack">
      <div>
        <h1>Données</h1>
        <p>Gère tes circuits, pilotes et karts / réglages.</p>
      </div>

      <a class="list-item card--clickable" href="#/circuits" style="text-decoration:none;color:inherit">
        <div>
          <div class="list-item__title">Circuits</div>
          <div class="list-item__meta">Créer et sélectionner des pistes</div>
        </div>
        <span class="muted">›</span>
      </a>

      <a class="list-item card--clickable" href="#/pilots" style="text-decoration:none;color:inherit">
        <div>
          <div class="list-item__title">Pilotes</div>
          <div class="list-item__meta">Nom, âge, poids, taille</div>
        </div>
        <span class="muted">›</span>
      </a>

      <a class="list-item card--clickable" href="#/karts" style="text-decoration:none;color:inherit">
        <div>
          <div class="list-item__title">Karts & réglages</div>
          <div class="list-item__meta">Pressions, essence, ballast</div>
        </div>
        <span class="muted">›</span>
      </a>
    </div>
  `;
}
