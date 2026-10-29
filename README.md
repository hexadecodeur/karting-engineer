# Kart Engineer

PWA mobile-first pour ingénieur de piste karting (HTML / CSS / JS).

## Fonctionnalités MVP

- Circuits, pilotes, karts + réglages (pressions, essence, ballast)
- Sessions avec météo GPS (Open-Meteo) ou saisie manuelle
- Chronomètre intégré + saisie manuelle des tours
- Stats : par session, par circuit, par mois, comparaison pilotes
- Données 100 % locales (IndexedDB), installable hors-ligne (UI)

## Lancer en local

Il faut un serveur HTTP (modules ES + service worker).

```bash
cd karting-engineer
npx --yes serve .
```

Puis ouvre l’URL affichée (souvent `http://localhost:3000`) sur mobile ou desktop.

Chrome → DevTools → Application → Manifest pour tester l’installation PWA.

## Stack

- Vanilla JS (ES modules)
- IndexedDB
- Chart.js (CDN)
- Open-Meteo (météo, sans clé API)
