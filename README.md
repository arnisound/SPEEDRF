# SPEED RF · by Arnisound tools

Plan de fréquences pour micros sans fil, en un clic — sans compétence technique.
Instance grand public simplifiée du moteur **RF SHOT by Arnisound tools**.

L'utilisateur choisit ses micros, indique sa position (GPS ou **code postal / ville**),
et l'app lit les **données ARCOM** de la zone pour calculer un plan de fréquences
propre (évitement des intermodulations), exportable en **PDF** ou **CSV**.

---

## Structure du dépôt

```
speedrf/
├── src/
│   └── index.html        ← L'APPLICATION (version lisible — c'est ICI qu'on édite)
├── scripts/
│   └── build.mjs         ← Génère dist/index.html (version protégée)
├── dist/                 ← Généré par le build (non versionné) — à déployer
├── package.json
├── LICENSE
└── README.md
```

> **Une seule source de vérité : `src/index.html`.** Tout y est en clair
> (interface, données ARCOM, moteur de coordination, catalogue micros).
> On l'édite directement. La version protégée est *générée*, jamais éditée à la main.

### Repères dans `src/index.html`
Le build s'appuie sur deux zones balisées par des commentaires — **ne pas les supprimer** :

- `/* === CATALOG:START … */ … /* === CATALOG:END === */`
  Les catalogues `MIC_CATALOG` (micros HF) et `IEM_CATALOG` (oreillettes / ears)
  — marques, modèles, gammes. Au build, **chaque** catalogue est encodé
  (XOR + base64) pour ne pas apparaître en clair dans la version publiée.
- `/* === ENGINE:START … */ … /* === ENGINE:END === */`
  Le moteur `generatePlan(...)`. Au build, il est minifié et « manglé » (terser),
  **puis encodé (XOR + base64)** et décodé/évalué au démarrage : il n'apparaît plus
  en clair dans l'onglet « Sources » du navigateur. Seul `generatePlan` reste exposé.

Pour ajouter un micro, modifier une gamme, etc. : édite le littéral
`MIC_CATALOG` entre les marqueurs CATALOG. Pour toucher à l'algo : entre ENGINE.

---

## Développer en local

```bash
npm install            # installe terser (pour le build)
npm run dev            # sert src/ sur http://localhost:8080
```

Ouvre http://localhost:8080. Sur `localhost`, le **GPS du navigateur fonctionne**
(contexte sécurisé), tout comme la recherche par code postal.

> Tu peux aussi simplement ouvrir `src/index.html` dans un navigateur, mais
> certains appels réseau (données ARCOM) passent mieux via un vrai serveur HTTP.

---

## Construire la version protégée

```bash
npm run build          # => dist/index.html (catalogue encodé + moteur minifié)
npm run preview        # sert dist/ sur http://localhost:8081 pour vérifier
```

`dist/index.html` est **fonctionnellement identique** à `src/index.html`,
mais le catalogue et le moteur n'y sont plus lisibles.

---

## Déployer sur Cloudflare Pages

### Option A — glisser-déposer (le plus simple)
1. `npm run build`
2. https://dash.cloudflare.com → **Workers & Pages** → **Create application** → **Pages** → **Upload assets**
3. Nom du projet : `speedrf`
4. Glisse le **contenu du dossier `dist/`** (ou un zip de `dist/`)
5. **Deploy** → en ligne sur `https://speedrf.pages.dev`

### Option B — ligne de commande (Wrangler)
```bash
npm run build
npx wrangler pages deploy dist --project-name speedrf
```

### Option C — intégration Git (déploiement auto à chaque push)
Dans Cloudflare Pages → *Connect to Git* → sélectionne ce dépôt, puis :
- **Framework preset** : `None`
- **Build command** : `npm run build`
- **Build output directory** : `dist`

À chaque `git push`, Cloudflare reconstruit et redéploie.

> **Note Google Sites :** une page Google Sites enferme le HTML intégré dans une
> iframe sandboxée sans permission GPS → le bouton « Me localiser » y est bloqué.
> Le positionnement par **code postal / ville** fonctionne partout et reste la
> méthode recommandée. Hébergé sur Cloudflare Pages (page entière, HTTPS), le GPS
> fonctionne aussi.

---

## Données & dépendances

- **Données TNT** : API publique ARCOM (« coordinates-mv3 »), via un relais CORS
  (Deno Deploy) déclaré dans le code. En cas d'échec réseau, l'app calcule un plan
  théorique en supposant tous les canaux libres (avec avertissement).
- **Géocodage** : Base Adresse Nationale (`api-adresse.data.gouv.fr`), appels
  navigateur directs (CORS ouvert), pour le code postal / la ville.
- **PDF** : `jsPDF` + `jspdf-autotable` chargés depuis cdnjs.
- **Build** : `terser` (seule dépendance de développement).

---

## Licence
Propriétaire — © 2026 Arnisound tools. Voir [`LICENSE`](./LICENSE).
Les fréquences proposées sont des disponibilités théoriques ; vérification sur
site et respect de la réglementation (ARCOM / ANFR) à la charge de l'utilisateur.
