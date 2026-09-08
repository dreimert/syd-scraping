// CORRIGÉ du TD de scraping.
//
//     node index.js               # contre le site de l'INSA
//     BASE_URL=http://localhost:8000 node index.js   # contre la copie locale
//
// Par défaut on ne collecte pas les contacts : cf. la section « Cadre légal »
// du README, principe de minimisation. Pour les récupérer quand même :
//
//     AVEC_CONTACTS=oui node index.js

import * as cheerio from 'cheerio'
import { extractText, getDocumentProxy } from 'unpdf'
import { writeFile } from 'node:fs/promises'

const BASE_URL = process.env.BASE_URL ?? 'https://www.insa-lyon.fr'
const AVEC_CONTACTS = process.env.AVEC_CONTACTS === 'oui'

/**
 * Permet d'attendre duration ms
 * @param {number} duration - Durée en millisecondes
 * @returns {Promise<void>}
 */
const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

/**
 * Télécharger une page HTML
 * @param {string} url
 * @returns {Promise<string|undefined>}
 */
async function getHtml (url) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } catch (error) {
    console.error(`getHtml :: ${url} :: ${error.message}`)
  }
}

/**
 * Télécharger un pdf
 * @param {string} url
 * @returns {Promise<Uint8Array|undefined>}
 */
async function getPdf (url) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    console.error(`getPdf :: ${url} :: ${error.message}`)
  }
}

/**
 * Transforme un pdf en texte
 * @param {Uint8Array} pdf
 * @returns {Promise<string>}
 */
async function pdfToText (pdf) {
  const { text } = await extractText(await getDocumentProxy(pdf), { mergePages: true })
  return text
}

/**
 * Le catalogue liste les formations de l'INSA
 * @param {string} html
 * @returns {string[]} Les chemins des pages de formation, dédoublonnés
 */
function extractUrlFormations (html) {
  const $ = cheerio.load(html)
  const urls = $('a[href^="/fr/formation/"]').map((i, e) => $(e).attr('href')).get()
  // On enlève le catalogue lui-même et les pages de rubrique, qui ne sont pas
  // des formations.
  return [...new Set(urls)].filter((url) => !/catalogue|formations-|formation-doc/.test(url))
}

/**
 * Une page de formation publie le catalogue du département en pdf
 * @param {string} html
 * @returns {string[]} Les URLs des pdfs de catalogue
 */
function extractUrlPdfs (html) {
  const $ = cheerio.load(html)
  const urls = $('a[href$=".pdf"]').map((i, e) => $(e).attr('href')).get()
  // Les pages contiennent aussi des plaquettes commerciales, sans fiche.
  return urls.filter((url) => /catalog/i.test(url))
}

/**
 * L'année de début du millésime, déduite du nom du fichier.
 * Les deux formats rencontrés : 2026-2027 et 25-26.
 * @param {string} url
 * @returns {number} 0 si on ne sait pas
 */
function annee (url) {
  const long = /(\d{4})-\d{4}/.exec(url)
  if (long) return Number(long[1])
  const court = /\D(\d{2})-\d{2}\D/.exec(url)
  if (court) return 2000 + Number(court[1])
  return 0
}

/**
 * Une formation publie parfois plusieurs catalogues : plusieurs millésimes, et
 * une version anglaise. On garde le français le plus récent.
 *
 * C'est un choix, pas une vérité : il faut pouvoir le justifier.
 *
 * @param {string[]} urls
 * @returns {string|undefined}
 */
function choisirCatalogue (urls) {
  // « catalogue » est français, « catalog » est anglais.
  const francais = urls.filter((url) => /catalogue/i.test(url))
  const candidats = francais.length > 0 ? francais : urls
  return candidats.sort((a, b) => annee(b) - annee(a))[0]
}

/**
 * Un catalogue contient une centaine de fiches, chacune introduite par
 * « IDENTIFICATION ». On découpe là-dessus.
 * @param {string} texte
 * @returns {string[]} Un bloc de texte par fiche
 */
function decouperFiches (texte) {
  // Le premier morceau est le sommaire du catalogue : il n'a pas de CODE et
  // sera écarté par analyserFiche.
  return texte.split('IDENTIFICATION').slice(1)
}

/**
 * @param {string} bloc - Le texte d'une fiche
 * @param {RegExp} regex
 * @returns {string|undefined}
 */
const champ = (bloc, regex) => regex.exec(bloc)?.[1]

/**
 * Le nombre d'heures d'un poste horaire.
 * Les deux formats rencontrés : « Cours : 4h » et « Cours : 8.0 h ».
 * @param {string} bloc
 * @param {string} poste
 * @returns {number|undefined}
 */
function heures (bloc, poste) {
  const valeur = champ(bloc, new RegExp(`${poste}\\s*:\\s*([\\d.]+)\\s*h`))
  return valeur === undefined ? undefined : Number(valeur)
}

/**
 * Extrait les informations d'une fiche.
 *
 * Toutes les regexes tolèrent les espaces autour des deux-points : selon les
 * catalogues, on lit « CODE : X » ou « CODE :X ». Sans le \s*, on perd
 * plusieurs centaines de fiches sans s'en apercevoir.
 *
 * @param {string} bloc
 * @returns {Object|undefined} undefined si le bloc n'est pas une fiche
 */
function analyserFiche (bloc) {
  const code = champ(bloc, /CODE\s*:\s*([A-Z0-9][A-Z0-9-]*)/)
  if (!code) return

  const fiche = {
    code,
    ects: Number(champ(bloc, /ECTS\s*:\s*([\d.]+)/)),
    cours: heures(bloc, 'Cours'),
    td: heures(bloc, 'TD'),
    tp: heures(bloc, 'TP'),
    projet: heures(bloc, 'Projet'),
    // Les catalogues de département ont un poste « Evaluation » que les
    // anciennes fiches n'avaient pas. Sans lui, l'invariant plus bas est faux
    // pour toutes les fiches qui ont un examen compté dans le présentiel.
    evaluation: heures(bloc, 'Evaluation') ?? 0,
    personnel: heures(bloc, 'Travail personnel'),
    total: heures(bloc, 'Total')
  }

  if (AVEC_CONTACTS) {
    const contact = /CONTACT\s*\n([^\n]*)\n\s*([\w.-]+@[\w.-]+\.[a-z]{2,})/i.exec(bloc)
    fiche.enseignant = contact?.[1].replace(/\s*:\s*$/, '')
    fiche.email = contact?.[2]
  }

  return fiche
}

async function run () {
  const db = {}
  const sansCatalogue = []
  const incompletes = []
  const incoherentes = []
  let doublons = 0
  let pdfs = 0

  // 1. Le catalogue donne la liste des formations.
  const formations = extractUrlFormations(await getHtml(`${BASE_URL}/fr/formation/catalogue`) ?? '')
  console.log(`${formations.length} formations`)

  for (const formation of formations) {
    const html = await getHtml(BASE_URL + formation)
    await sleep(500)
    if (!html) continue

    // 2. Chaque formation publie — ou non — le catalogue de son département.
    const url = choisirCatalogue(extractUrlPdfs(html))
    if (!url) {
      // C'est ça, la réponse à « quel département n'a pas de fiche ? ».
      sansCatalogue.push(formation)
      continue
    }

    const pdf = await getPdf(url)
    await sleep(500)
    if (!pdf) continue
    pdfs++

    // 3. Chaque catalogue contient une centaine de fiches.
    for (const bloc of decouperFiches(await pdfToText(pdf))) {
      const fiche = analyserFiche(bloc)
      if (!fiche) continue

      // Un même EC est partagé par plusieurs formations : le code sert de clef
      // primaire, on ne le compte qu'une fois.
      if (db[fiche.code]) {
        doublons++
        continue
      }
      db[fiche.code] = fiche

      if (Number.isNaN(fiche.ects) || fiche.cours === undefined) incompletes.push(fiche.code)
      // Invariant : le total doit être la somme du détail.
      const somme = fiche.cours + fiche.td + fiche.tp + fiche.projet + fiche.evaluation + fiche.personnel
      if (fiche.total !== undefined && Math.abs(somme - fiche.total) > 0.01) {
        incoherentes.push(fiche.code)
      }
    }
  }

  await writeFile('db.json', JSON.stringify(db, null, 2))

  // Un scraper doit dire ce qu'il n'a pas réussi à faire, sinon son silence
  // passe pour un succès.
  console.log(`\n${pdfs} catalogues analysés`)
  console.log(`${Object.keys(db).length} fiches dans db.json (${doublons} doublons écartés)`)
  console.log(`${sansCatalogue.length} formations sans catalogue :`)
  for (const formation of sansCatalogue) console.log(`  ${formation}`)
  console.log(`${incompletes.length} fiches avec un champ manquant`)
  console.log(`${incoherentes.length} fiches dont le total ne colle pas au détail`)
  if (!AVEC_CONTACTS) console.log('\nContacts non collectés (AVEC_CONTACTS=oui pour les avoir).')
}

run()
