// Génère index.html à partir de donnees/evolutions.json.
//
//     node page.js
//
// Page statique, sans dépendance ni script externe : elle est servie telle
// quelle par GitHub Pages.

import { readFile, writeFile } from 'node:fs/promises'

const LIBELLES = {
  'formation+': ['Nouvelle formation', 'ajout'],
  'formation-': ['Formation disparue', 'retrait'],
  'pdf+': ['Nouveau catalogue', 'ajout'],
  'pdf-': ['Catalogue disparu', 'retrait'],
  'pdf~': ['Catalogue republié', 'modif'],
  'fiche+': ['Nouvelle fiche', 'ajout'],
  'fiche-': ['Fiche disparue', 'retrait'],
  'fiche~': ['Fiche modifiée', 'modif'],
  'échec': ['Échec de relevé', 'echec']
}

const echappe = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const court = (url) => String(url).replace(/^https?:\/\/[^/]+\//, '').replace(/^sites\/www\.insa-lyon\.fr\/files\//, '')
const date = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

/**
 * Une courbe minimaliste, en SVG, sans bibliothèque.
 * @param {number[]} valeurs - du plus ancien au plus récent
 * @returns {string}
 */
function courbe (valeurs) {
  const min = Math.min(...valeurs)
  const max = Math.max(...valeurs)
  // Une courbe plate n'apprend rien et se confond avec un soulignement.
  if (valeurs.length < 2 || min === max) return ''
  const amplitude = max - min
  const points = valeurs.map((v, i) => {
    const x = (i / (valeurs.length - 1)) * 100
    const y = 30 - ((v - min) / amplitude) * 26 - 2
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
  return `<svg class="courbe" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"/></svg>`
}

function carte (libelle, valeur, valeurs) {
  const precedente = valeurs.at(-2)
  const delta = precedente === undefined || precedente === valeur ? '' :
    `<span class="delta ${valeur > precedente ? 'hausse' : 'baisse'}">${valeur > precedente ? '+' : ''}${valeur - precedente}</span>`
  return `<div class="carte"><div class="libelle">${libelle}</div><div class="valeur">${valeur}${delta}</div>${courbe(valeurs)}</div>`
}

function evenement (e) {
  const [libelle, classe] = LIBELLES[e.type] ?? [e.type, 'modif']
  let detail = ''
  if (e.type === 'fiche~') detail = `<code>${echappe(e.champ)}</code> ${echappe(e.avant)} → <strong>${echappe(e.apres)}</strong>`
  else if (e.type === 'pdf~') detail = `${e.avantTaille} → ${e.taille} octets`
  else if (e.type === 'pdf+' || e.type === 'pdf-') detail = `${e.fiches} fiches`
  else if (e.type === 'échec') detail = `HTTP ${echappe(e.statut)}`
  else if (e.pdf) detail = `dans ${echappe(court(e.pdf))}`
  return `<li class="${classe}"><span class="type">${libelle}</span><span class="cle">${echappe(court(e.cle))}</span><span class="detail">${detail}</span></li>`
}

function releve (r, index) {
  if (!r.evenements.length) {
    return `<section class="releve calme"><h3>${date(r.date)}</h3><p class="rien">Aucune évolution.</p></section>`
  }
  // Un relevé d'amorçage annonce tout le site : on le replie.
  const gros = r.evenements.length > 25
  const liste = r.evenements.map(evenement).join('\n')
  const corps = gros
    ? `<details><summary>${r.evenements.length} évolutions</summary><ul class="evenements">${liste}</ul></details>`
    : `<ul class="evenements">${liste}</ul>`
  return `<section class="releve"><h3>${date(r.date)} <span class="compte">${r.evenements.length}</span></h3>${corps}</section>`
}

async function run () {
  const historique = JSON.parse(await readFile('donnees/evolutions.json', 'utf8'))
  const dernier = historique[0]
  const anciens = [...historique].reverse()
  const serie = (clef) => anciens.map((r) => r.resume[clef] ?? 0)

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Veille — offre de formation INSA Lyon</title>
<style>
  :root {
    color-scheme: light dark;
    --fond: #fbfbfa; --carte: #fff; --texte: #1a1a18; --doux: #6b6b66;
    --trait: #e3e3df; --ajout: #2f7d4f; --retrait: #b4453c;
    --modif: #a1651a; --echec: #b4453c; --accent: #3b6ea5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fond: #17171a; --carte: #202024; --texte: #ececea; --doux: #9a9a94;
      --trait: #32323a; --ajout: #6fbf8b; --retrait: #e08b82;
      --modif: #d9a441; --echec: #e08b82; --accent: #7aa9dd;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fond); color: var(--texte);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .page { max-width: 62rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; letter-spacing: -.01em; }
  .chapeau { color: var(--doux); margin: 0 0 2rem; }
  .chapeau a { color: var(--accent); }
  .cartes { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); margin-bottom: 2.5rem; }
  .carte { background: var(--carte); border: 1px solid var(--trait); border-radius: .6rem; padding: .85rem .9rem; }
  .libelle { color: var(--doux); font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
  .valeur { font-size: 1.7rem; font-variant-numeric: tabular-nums; margin-top: .15rem; }
  .delta { font-size: .8rem; margin-left: .4rem; vertical-align: .35rem; }
  .delta.hausse { color: var(--ajout); } .delta.baisse { color: var(--retrait); }
  .courbe { display: block; width: 100%; height: 1.8rem; margin-top: .4rem; overflow: visible; }
  .courbe polyline { fill: none; stroke: var(--accent); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: .05em; color: var(--doux);
    border-bottom: 1px solid var(--trait); padding-bottom: .5rem; }
  .releve { margin: 1.5rem 0; }
  .releve h3 { font-size: .95rem; font-weight: 600; margin: 0 0 .5rem; }
  .compte { background: var(--trait); border-radius: 1rem; padding: .05rem .5rem; font-size: .78rem; font-weight: 400; }
  .calme h3 { font-weight: 400; color: var(--doux); }
  .rien { color: var(--doux); margin: 0; font-size: .9rem; }
  .evenements { list-style: none; margin: 0; padding: 0; }
  .evenements li { display: grid; gap: .1rem .75rem; padding: .45rem .7rem; border-left: 3px solid var(--trait);
    background: var(--carte); margin-bottom: 2px; border-radius: 0 .3rem .3rem 0; }
  @media (min-width: 46rem) { .evenements li { grid-template-columns: 11rem minmax(0, 1fr) auto; align-items: baseline; } }
  li.ajout { border-left-color: var(--ajout); } li.retrait { border-left-color: var(--retrait); }
  li.modif { border-left-color: var(--modif); } li.echec { border-left-color: var(--echec); }
  .type { font-size: .8rem; color: var(--doux); }
  .cle { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .82rem; overflow-wrap: anywhere; }
  .detail { font-size: .82rem; color: var(--doux); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  details summary { cursor: pointer; color: var(--doux); font-size: .9rem; padding: .3rem 0; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--trait); color: var(--doux); font-size: .85rem; }
  footer a { color: var(--accent); }
</style>
</head>
<body>
<div class="page">
<h1>Veille sur l'offre de formation de l'INSA Lyon</h1>
<p class="chapeau">Relevé chaque nuit depuis <a href="https://www.insa-lyon.fr/fr/formation/catalogue">le catalogue des formations</a>.
Dernier passage : ${date(dernier.date)}.</p>

<div class="cartes">
  ${carte('Formations', dernier.resume.formations, serie('formations'))}
  ${carte('Sans catalogue', dernier.resume.sansCatalogue, serie('sansCatalogue'))}
  ${carte('Catalogues pdf', dernier.resume.pdfs, serie('pdfs'))}
  ${carte('Fiches d\'EC', dernier.resume.fiches, serie('fiches'))}
  ${carte('Face-à-face faux', dernier.resume.anomaliesFaceAFace, serie('anomaliesFaceAFace'))}
  ${carte('Totaux faux', dernier.resume.anomaliesTotal, serie('anomaliesTotal'))}
  ${carte('Échecs', dernier.resume.echecs, serie('echecs'))}
</div>

<h2>Historique</h2>
${historique.map(releve).join('\n')}

<footer>
<p>TD de scraping du cours de systèmes distribués — département Télécommunications, INSA Lyon.
Données relevées sur le site public de l'INSA ; aucune donnée personnelle n'est collectée ni publiée ici.</p>
<p>${historique.length} relevés · <a href="donnees/evolutions.json">evolutions.json</a> · <a href="donnees/etat.json">etat.json</a></p>
</footer>
</div>
</body>
</html>
`
  await writeFile('index.html', html)
  console.log(`index.html écrit (${historique.length} relevés, ${(html.length / 1024).toFixed(0)} Ko)`)
}

run()
