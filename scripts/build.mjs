// scripts/build.mjs — génère dist/index.html (version protégée) à partir de src/index.html
// =============================================================================
// - Le CATALOGUE (entre les marqueurs CATALOG:START/END) est encodé (XOR + base64)
//   et remplacé par un décodeur qui le reconstruit en mémoire au démarrage.
// - Le MOTEUR (entre ENGINE:START/END) est enfermé dans une IIFE puis minifié et
//   « manglé » avec terser (noms internes réduits). Seul generatePlan reste exposé.
//
//   npm install        (installe terser)
//   npm run build      (=> dist/index.html, prêt à déployer sur Cloudflare Pages)
//
// La source lisible (src/index.html) reste la référence à éditer. Ne modifiez pas
// dist/ à la main : il est régénéré à chaque build.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { minify } from 'terser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'src/index.html');
const OUT_DIR = resolve(ROOT, 'dist');
const OUT = resolve(OUT_DIR, 'index.html');

// Clé d'encodage du catalogue (non secrète : simple brouillage côté client).
const KEY = 'ar$niS0und-RFSHOT-2025';

const b64 = buf => Buffer.from(buf).toString('base64');

// Encode un objet catalogue en `const <name>=(décodeur)();` (XOR + base64).
function encodeCatalogNamed(name, obj) {
  const json = JSON.stringify(obj);
  const bytes = Buffer.from(json, 'utf-8');
  const key = Buffer.from(KEY, 'utf-8');
  const xored = Buffer.from(bytes.map((c, i) => c ^ key[i % key.length]));
  const blob = b64(xored), keyB64 = b64(key);
  return (
    'const ' + name + '=(()=>{const k=atob("' + keyB64 + '"),s=atob("' + blob + '"),' +
    'a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)^k.charCodeAt(i%k.length);' +
    'return JSON.parse(new TextDecoder().decode(a));})();'
  );
}

// Évalue le bloc catalogue (un ou plusieurs `const NOM = {…}`) et encode chaque
// catalogue trouvé (MIC_CATALOG, IEM_CATALOG). Tolérant : virgules finales, etc.
function encodeCatalogs(blockText) {
  const ev = new Function(
    blockText + '\nreturn {' +
    'MIC_CATALOG: typeof MIC_CATALOG!=="undefined"?MIC_CATALOG:null,' +
    'IEM_CATALOG: typeof IEM_CATALOG!=="undefined"?IEM_CATALOG:null};'
  )();
  const parts = [];
  if (ev.MIC_CATALOG) parts.push(encodeCatalogNamed('MIC_CATALOG', ev.MIC_CATALOG));
  if (ev.IEM_CATALOG) parts.push(encodeCatalogNamed('IEM_CATALOG', ev.IEM_CATALOG));
  if (!parts.length) throw new Error('aucun catalogue (MIC_CATALOG / IEM_CATALOG) trouvé entre les marqueurs CATALOG');
  return parts.join('\n');
}

async function minifyEngine(engineText) {
  // n'expose que generatePlan ; tout le reste est interne à l'IIFE
  const wrapped =
    'var generatePlan=(function(){\n' +
    engineText.replace('function generatePlan(mics, channels, opts = {})', 'function _gp(mics, channels, opts = {})') +
    '\nreturn _gp;})();';
  const res = await minify(wrapped, { compress: true, mangle: true }); // pas de toplevel : generatePlan reste global
  if (res.error) throw res.error;
  let code = res.code.trim();
  if (!code.endsWith(';')) code += ';';
  return code;
}

const between = (s, a, b) => {
  const i = s.indexOf(a), j = s.indexOf(b);
  if (i < 0 || j < 0 || j < i) throw new Error('marqueurs introuvables : ' + a + ' / ' + b);
  return { full: s.slice(i, j + b.length), afterStart: s.slice(i + a.length, j) };
};
const stripFirstLine = s => s.replace(/^[^\n]*\n/, '');               // retire le reste de la ligne START

const main = async () => {
  let html = readFileSync(SRC, 'utf-8');

  // — catalogues (micros + IEM) —
  const cat = between(html, '/* === CATALOG:START', '/* === CATALOG:END === */');
  const catBlock = stripFirstLine(cat.afterStart);   // tout le code entre les marqueurs
  html = html.replace(cat.full, '/* catalogues encodés au build */\n' + encodeCatalogs(catBlock));

  // — moteur —
  const eng = between(html, '/* === ENGINE:START', '/* === ENGINE:END === */');
  const engText = stripFirstLine(eng.afterStart).trim();
  html = html.replace(eng.full, '/* moteur minifié au build */\n' + await minifyEngine(engText));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, html, 'utf-8');
  console.log('✓ dist/index.html généré (' + html.length + ' caractères) — prêt pour Cloudflare Pages.');
};

main().catch(e => { console.error('Échec du build :', e); process.exit(1); });
