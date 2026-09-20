# Planorama

Petit projet perso pour visualiser des plans 2D en rendus 3D. On upload un plan (JPG/PNG), l'app génère une vue 3D avec Puter AI, et ensuite on peut exporter l'image ou partager le lien.

Short personal project to turn 2D floor plans into 3D renders. Upload a plan (JPG/PNG), the app generates a 3D view with Puter AI, then you can export the image or share the link.

## Comment ça marche / How it works

- `/` : upload du plan, création du projet, redirection vers `/visualizer/:id`
- `/visualizer/:id` : affichage du rendu, export (download), partage (Web Share API + liens X/Facebook/WhatsApp/LinkedIn/Telegram/Pinterest/email)
- Stockage via Puter KV + hosting Puter pour les images. Si le worker est down, ça retombe sur le KV local pour ne pas bloquer l'upload.

- `/` : plan upload, project creation, redirect to `/visualizer/:id`
- `/visualizer/:id` : render view, export (download), share (Web Share API + X/Facebook/WhatsApp/LinkedIn/Telegram/Pinterest/email links)
- Storage with Puter KV + Puter hosting for images. If the worker is down, it falls back to local KV so upload still works.

## Stack

React Router 8, React 19, Vite, Tailwind 4, TypeScript, Puter.js, lucide-react, react-compare-slider.

## Lancer en local / Run locally

```bash
npm install
npm run dev
```

Ouvrir / Open `http://localhost:5173`

Il faut un fichier `.env.local` avec :

```bash
VITE_PUTER_WORKER_URL=https://votre-worker.puter.work
```

Le code du worker est dans `lib/puter.worker.js`, à déployer côté Puter. Sans ça, la sauvegarde passe juste en KV local.

The worker code lives in `lib/puter.worker.js`, deploy it on Puter side. Without it, save just uses local KV.

## Scripts

```bash
npm run dev    # dev
npm run build  # build prod
npm run start  # serve le build / serve the build
```


