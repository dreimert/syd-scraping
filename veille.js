// Veille sur l'offre de formation de l'INSA.
//
//     node veille.js
//
// Relève l'état courant du site, le compare à l'état précédent et consigne les
// évolutions. Conçu pour tourner une fois par nuit.
//
// Deux principes :
//   - on ne retélécharge que ce qui a changé (requêtes conditionnelles) ;
//   - tout ce qui échoue devient un événement, jamais un silence.

import * as cheerio from 'cheerio'
import { extractText, getDocumentProxy } from 'unpdf'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const BASE_URL = process.env.BASE_URL ?? 'https://www.insa-lyon.fr'
const ETAT = 'donnees/etat.json'
const EVOLUTIONS = 'donnees/evolutions.json'
const UA = 'Veille TD scraping SYD - INSA Lyon (damien.reimert@insa-lyon.fr)'

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

/**
 * @param {string} chemin
 * @param {any} defaut
 * @returns {Promise<any>}
 */
async function lireJson (chemin, defaut) {
  try {
    return JSON.parse(await readFile(chemin, 'utf8'))
  } catch {
    return defaut
  }
}

/**
 * Une requête, avec l'en-tête qui dit qui nous sommes.
 * @param {string} url
 * @param {Record<string,string>} entetes
 * @returns {Promise<Response>}
 */
async function requete (url, entetes = {}) {
  return fetch(url, { headers: { 'user-agent': UA, ...entetes } })
}

const POSTES = ['Cours', 'TD', 'TP', 'Projet', 'Evaluation', 'Face à face pédagogique', 'Travail personnel', 'Total']
const CLEFS = ['cours', 'td', 'tp', 'projet', 'evaluation', 'ff', 'personnel', 'total']

/**
 * Le nombre d'heures d'un poste. Les libellés sont parfois coupés par un saut
 * de ligne (« Face à face\npédagogique »), d'où le \s+ entre les mots.
 * @param {string} bloc
 * @param {string} poste
 * @returns {number|undefined}
 */
function heures (bloc, poste) {
  const m = new RegExp(`${poste.replace(/ /g, '\\s+')}\\s*:\\s*([\\d.]+)\\s*h`).exec(bloc)
  return m ? Number(m[1]) : undefined
}

/**
 * Extrait toutes les fiches d'un catalogue.
 * @param {string} texte
 * @returns {Record<string, Object>} indexé par code d'EC
 */
function analyser (texte) {
  const fiches = {}
  for (const bloc of texte.split('IDENTIFICATION').slice(1)) {
    const code = /CODE\s*:\s*([A-Z0-9][A-Z0-9-]*)/.exec(bloc)?.[1]
    if (!code) continue
    const fiche = { ects: Number(/ECTS\s*:\s*([\d.]+)/.exec(bloc)?.[1]) }
    POSTES.forEach((poste, i) => { fiche[CLEFS[i]] = heures(bloc, poste) })
    fiches[code] = fiche
  }
  return fiches
}

/**
 * Les deux invariants horaires des fiches.
 * @param {Object} f
 * @returns {string[]} les invariants violés
 */
function anomalies (f) {
  const ko = []
  if ([f.cours, f.td, f.tp, f.evaluation, f.ff].every((v) => v !== undefined) &&
      Math.abs(f.ff - (f.cours + f.td + f.tp + f.evaluation)) > 0.01) ko.push('face-à-face')
  if ([f.ff, f.projet, f.personnel, f.total].every((v) => v !== undefined) &&
      Math.abs(f.total - (f.ff + f.projet + f.personnel)) > 0.01) ko.push('total')
  return ko
}

async function releve (precedent) {
  const etat = { date: new Date().toISOString(), formations: {}, pdfs: {}, echecs: [] }

  // 1. Le catalogue.
  const reponse = await requete(`${BASE_URL}/fr/formation/catalogue`)
  if (!reponse.ok) throw new Error(`catalogue inaccessible : HTTP ${reponse.status}`)
  const $c = cheerio.load(await reponse.text())
  const formations = [...new Set($c('a[href^="/fr/formation/"]').map((i, e) => $c(e).attr('href')).get())]
    .filter((u) => !/catalogue|formations-|formation-doc/.test(u))
    .sort()

  // 2. Chaque page de formation, et les catalogues pdf qu'elle publie.
  for (const formation of formations) {
    await sleep(500)
    const r = await requete(BASE_URL + formation)
    if (!r.ok) {
      etat.echecs.push({ url: formation, statut: r.status })
      // On reprend ce qu'on savait, pour ne pas annoncer une disparition qui
      // n'est qu'une panne passagère.
      if (precedent.formations[formation]) etat.formations[formation] = precedent.formations[formation]
      continue
    }
    const $ = cheerio.load(await r.text())
    const pdfs = $('a[href$=".pdf"]').map((i, e) => $(e).attr('href')).get()
      .filter((u) => /catalog/i.test(u))
      .map((u) => (u.startsWith('http') ? u : BASE_URL + u))
    etat.formations[formation] = { pdfs: [...new Set(pdfs)].sort() }
  }

  // 3. Les pdfs, en ne retéléchargeant que ceux qui ont bougé.
  const tous = [...new Set(Object.values(etat.formations).flatMap((f) => f.pdfs))].sort()
  for (const url of tous) {
    await sleep(500)
    const avant = precedent.pdfs?.[url]
    const conditionnel = avant?.etag ? { 'if-none-match': avant.etag } : {}
    const r = await requete(url, conditionnel)

    if (r.status === 304) {
      etat.pdfs[url] = { ...avant, retelecharge: false }
      continue
    }
    if (!r.ok) {
      etat.echecs.push({ url, statut: r.status })
      if (avant) etat.pdfs[url] = avant
      continue
    }

    const octets = new Uint8Array(await r.arrayBuffer())
    // pdf.js transfère le buffer à son worker : après l'analyse, octets.length
    // vaut 0. On relève la taille avant.
    const taille = octets.length
    const { text } = await extractText(await getDocumentProxy(octets), { mergePages: true })
    etat.pdfs[url] = {
      etag: r.headers.get('etag') ?? undefined,
      modifie: r.headers.get('last-modified') ?? undefined,
      taille,
      fiches: analyser(text),
      retelecharge: true
    }
  }

  return etat
}

/**
 * Compare deux relevés et en tire la liste des évolutions.
 * @param {Object} avant
 * @param {Object} apres
 * @returns {Object[]}
 */
function comparer (avant, apres) {
  const evenements = []
  const ajoute = (type, cle, detail) => evenements.push({ type, cle, ...detail })

  for (const f of Object.keys(apres.formations)) {
    if (!avant.formations?.[f]) ajoute('formation+', f)
  }
  for (const f of Object.keys(avant.formations ?? {})) {
    if (!apres.formations[f]) ajoute('formation-', f)
  }

  const avantPdfs = avant.pdfs ?? {}
  for (const url of Object.keys(apres.pdfs)) {
    const a = avantPdfs[url]
    const b = apres.pdfs[url]
    const nb = Object.keys(b.fiches ?? {}).length
    if (!a) { ajoute('pdf+', url, { fiches: nb }); continue }

    // Un pdf dont l'etag change a été republié : on détaille les fiches.
    if (a.etag !== b.etag || a.taille !== b.taille) {
      ajoute('pdf~', url, { taille: b.taille, avantTaille: a.taille })
      const fa = a.fiches ?? {}
      const fb = b.fiches ?? {}
      for (const code of Object.keys(fb)) {
        if (!fa[code]) { ajoute('fiche+', code, { pdf: url }); continue }
        for (const champ of ['ects', ...CLEFS]) {
          if (fa[code][champ] !== fb[code][champ]) {
            ajoute('fiche~', code, { pdf: url, champ, avant: fa[code][champ], apres: fb[code][champ] })
          }
        }
      }
      for (const code of Object.keys(fa)) {
        if (!fb[code]) ajoute('fiche-', code, { pdf: url })
      }
    }
  }
  for (const url of Object.keys(avantPdfs)) {
    if (!apres.pdfs[url]) ajoute('pdf-', url, { fiches: Object.keys(avantPdfs[url].fiches ?? {}).length })
  }

  for (const echec of apres.echecs) ajoute('échec', echec.url, { statut: echec.statut })

  return evenements
}

/**
 * Les chiffres du jour, pour la page.
 * @param {Object} etat
 */
function resume (etat) {
  const fiches = Object.values(etat.pdfs).flatMap((p) => Object.entries(p.fiches ?? {}))
  const uniques = new Map(fiches)
  let ff = 0; let total = 0
  for (const f of uniques.values()) {
    const ko = anomalies(f)
    if (ko.includes('face-à-face')) ff++
    if (ko.includes('total')) total++
  }
  return {
    formations: Object.keys(etat.formations).length,
    sansCatalogue: Object.values(etat.formations).filter((f) => !f.pdfs.length).length,
    pdfs: Object.keys(etat.pdfs).length,
    fiches: uniques.size,
    anomaliesFaceAFace: ff,
    anomaliesTotal: total,
    retelecharges: Object.values(etat.pdfs).filter((p) => p.retelecharge).length,
    echecs: etat.echecs.length
  }
}

async function run () {
  await mkdir('donnees', { recursive: true })
  const precedent = await lireJson(ETAT, { formations: {}, pdfs: {}, echecs: [] })
  const historique = await lireJson(EVOLUTIONS, [])

  const etat = await releve(precedent)
  const evenements = comparer(precedent, etat)
  const chiffres = resume(etat)

  historique.unshift({ date: etat.date, resume: chiffres, evenements })
  await writeFile(ETAT, JSON.stringify(etat, null, 2))
  await writeFile(EVOLUTIONS, JSON.stringify(historique, null, 2))

  console.log(chiffres)
  console.log(`${evenements.length} évolutions`)
  for (const e of evenements.slice(0, 40)) console.log(' ', e.type, e.cle, e.champ ? `${e.champ} ${e.avant} -> ${e.apres}` : '')
}

run()
