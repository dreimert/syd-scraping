import { setTimeout as sleep } from 'node:timers/promises'
import { extractText, getDocumentProxy } from 'unpdf'
import * as cheerio from 'cheerio'

// le mot clef 'await' permet d'attendre la fin d'une opération asynchrone

// En temps normal on tape sur le site de l'INSA. Pour travailler hors ligne,
// décompresser l'archive fournie par l'intervenant (dossier backup/), puis :
//     npm run serve    (dans un terminal)
//     BASE_URL=http://localhost:8000 node index.js
const BASE_URL = process.env.BASE_URL ?? 'https://www.insa-lyon.fr'

// On se présente : le User-Agent dit au serveur qui fait ces requêtes et
// comment le joindre. C'est de la politesse, et c'est de la transparence au
// sens de la CNIL (cf. README). Ajoutez-y votre propre contact.
const HEADERS = { 'User-Agent': 'syd-scraping (TD INSA Lyon ; https://github.com/dreimert/syd-scraping)' }

// Les deux fonctions de téléchargement lèvent une erreur au lieu de renvoyer
// undefined : un scraper doit crier quand il échoue (cf. README). C'est à
// l'appelant de décider s'il peut continuer sans cette page.

/**
 * Télécharger une page HTML
 * @param {string} url - L'URL de la page HTML à télécharger
 * @returns {Promise<string>} Le contenu HTML de la page
 * @throws {Error} Si l'URL est absente ou si le serveur ne répond pas 2xx
 */
async function getHtml (url) {
  if (!url) {
    throw new Error('getHtml :: url undefined')
  }
  const response = await fetch(url, { headers: HEADERS })
  if (!response.ok) {
    throw new Error(`getHtml :: HTTP ${response.status} sur ${url}`)
  }
  return await response.text()
}

/**
 * Télécharger un pdf
 * @param {string} url - L'URL du fichier PDF à télécharger
 * @returns {Promise<Uint8Array>} Le contenu du PDF
 * @throws {Error} Si l'URL est absente ou si le serveur ne répond pas 2xx
 */
async function getPdf (url) {
  if (!url) {
    throw new Error('getPdf :: url undefined')
  }
  const response = await fetch(url, { headers: HEADERS })
  if (!response.ok) {
    throw new Error(`getPdf :: HTTP ${response.status} sur ${url}`)
  }
  // Un PDF est un fichier binaire : pas de .text() ici, sinon on le corrompt.
  return new Uint8Array(await response.arrayBuffer())
}

/**
 * Transforme un pdf en texte
 * Doc : https://github.com/unjs/unpdf
 * @param {Uint8Array} pdf - Le contenu du PDF
 * @returns {Promise<string>} Le texte extrait du PDF
 */
async function pdfToText (pdf) {
  const document = await getDocumentProxy(pdf)
  // mergePages : on veut un seul texte, pas un tableau d'une entrée par page.
  const { text } = await extractText(document, { mergePages: true })
  return text
}

/**
 * Analyser le catalogue pour extraire les URLs des pages de formation
 * Doc : https://github.com/cheeriojs/cheerio
 * @param {string} url - L'URL du catalogue des formations
 * @returns {Promise<string[]>} Tableau des URLs des pages de formation
 */
async function extractUrlFormations (url) {
  const html = await getHtml(url)
  const $ = cheerio.load(html)
  const urls = $('a[href^="/fr/formation/"]').map(function () {
    return BASE_URL + $(this).attr('href')
  }).get()
  // Une même formation est souvent listée plusieurs fois : on dédoublonne.
  return [...new Set(urls)]
}

/**
 * Analyser une page de formation pour extraire les URLs des pdfs du catalogue
 * @param {string} url - L'URL de la page de formation à analyser
 * @returns {Promise<string[]>} Tableau des URLs des pdfs trouvés sur la page
 */
async function extractUrlPdfs (url) {
  const html = await getHtml(url)
  const $ = cheerio.load(html)
  const urls = $('a[href$=".pdf"]').map(function () {
    return $(this).attr('href')
  }).get()
  // Attention : les pages de formation contiennent aussi des plaquettes
  // commerciales, qui n'ont pas les fiches de cours. On ne garde que les
  // catalogues. Le nommage n'est pas uniforme : catalogue-…, catalog-…,
  // doc-catalogue-…, doc-catalog-…
  // console.log('urls:', urls)
  return urls.filter((url) => /catalog/i.test(url))
}

/**
 * Télécharge et analyse des fichiers PDF
 * @param {string[]} urls - Tableau d'URLs des fichiers PDF à télécharger et analyser
 * @returns {Promise<Object>} Base de données contenant les codes extraits des PDFs
 */
async function downloadAndAnalysePdf (urls) {
  // La base : une entrée par EC, indexée par son code. Le format attendu
  // est décrit dans le README (« Format de sortie »).
  /** @type {{[code: string]: Object}} */
  const db = {}

  for (let url of urls) {
    // On reste poli avec les serveurs de l'INSA, y compris quand la requête
    // précédente a échoué.
    await sleep(500)

    // Un pdf qui ne se télécharge pas ne doit pas faire perdre les autres :
    // on attrape l'erreur, on la signale bruyamment, et on passe au suivant.
    // Attraper une erreur, ce n'est pas la faire disparaître : sans ce
    // console.error, on retomberait dans l'échec silencieux.
    let pdf
    try {
      pdf = await getPdf(url)
    } catch (error) {
      console.error(`Impossible de télécharger ${url} :`, error)
      continue
    }
    const txt = await pdfToText(pdf)

    // Un catalogue contient une fiche par cours : ici on ne récupère que
    // la première. À vous de toutes les extraire.
    const code = /CODE : ([^\n]*)/.exec(txt)?.[1]

    if (code) {
      console.log('Code :', code)
      // Pour l'instant on ne connaît que le code. À vous de remplir le reste.
      db[code] = { code, ue: null, ects: null, heures: null, catalogue: url }
    } else {
      // Un catalogue sans aucun code, c'est suspect : on le signale.
      console.warn(`Aucun code trouvé dans ${url}`)
    }
  }

  return db
}

// Exemple
async function run () {
  console.log('Extracting formations...')
  console.log(await extractUrlFormations(BASE_URL + '/fr/formation/catalogue'))

  console.log('Extracting urls...')
  console.log(await extractUrlPdfs(BASE_URL + '/fr/formation/telecommunications-services-usages'))

  console.log('Downloading and analysing pdfs...')
  const db = await downloadAndAnalysePdf([BASE_URL + '/sites/www.insa-lyon.fr/files/doc-catalogue-telecoms-2026-2027.pdf'])

  // Afficher le contenu d'une variable en json pour plus de lisibilité
  console.log(JSON.stringify(db, null, 2))
}

export { getHtml, getPdf, pdfToText, extractUrlFormations, extractUrlPdfs, downloadAndAnalysePdf }

// Lance l'exemple seulement si on exécute ce fichier (node index.js), pas
// quand un test l'importe.
if (import.meta.main) {
  run()
}
