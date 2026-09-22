import { setTimeout as sleep } from 'node:timers/promises'
import { extractText, getDocumentProxy } from 'unpdf'
import * as cheerio from 'cheerio'

// le mot clef 'await' permet d'attendre la fin d'une opération asynchrone

// En temps normal on tape sur le site de l'INSA. Pour travailler hors ligne :
//     npm run backup   (une fois, avec du réseau)
//     npm run serve    (dans un terminal)
//     BASE_URL=http://localhost:8000 node index.js
const BASE_URL = process.env.BASE_URL ?? 'https://www.insa-lyon.fr'

/**
 * Télécharger une page HTML
 * @param {string} url - L'URL de la page HTML à télécharger
 * @returns {Promise<string|undefined>} Le contenu HTML de la page, ou undefined en cas d'erreur
 */
async function getHtml (url) {
  if (url) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.text()
    } catch (error) {
      console.error('getHtml :: FETCH ERROR:', error)
    }
  } else {
    console.error('getHtml :: url undefined')
  }
}

/**
 * Télécharger un pdf
 * @param {string} url - L'URL du fichier PDF à télécharger
 * @returns {Promise<Uint8Array|undefined>} Le contenu du PDF, ou undefined en cas d'erreur
 */
async function getPdf (url) {
  if (url) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      // Un PDF est un fichier binaire : pas de .text() ici, sinon on le corrompt.
      return new Uint8Array(await response.arrayBuffer())
    } catch (error) {
      console.error('getPdf :: FETCH ERROR:', error)
    }
  } else {
    console.error('getPdf :: url undefined')
  }
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
  if (!html) {
    return []
  }
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
  if (!html) {
    return []
  }
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
 * @returns {Promise<Object|undefined>} Base de données contenant les codes extraits des PDFs, ou undefined en cas d'erreur
 */
async function downloadAndAnalysePdf (urls) {
  try {
    // Crée une base de données avec l'association test = 42. Mettre {} pour initialiser la db comme une DB vide.
    /** @type {{[key: string]: string}} */
    const db = { test: '42' }

    for (let url of urls) {
      const pdf = await getPdf(url)

      // console.log('pdf', pdf)

      if (pdf) {
        const txt = await pdfToText(pdf)

        // Un catalogue contient une fiche par cours : ici on ne récupère que
        // la première. À vous de toutes les extraire.
        const code = /CODE : ([^\n]*)/.exec(txt)?.[1]

        if (code) {
          console.log('Code :', code)
          db[code] = "Je fais ça au pif, juste pour montrer que je peux modifier la db"
        }
      }

      // On reste poli avec les serveurs de l'INSA.
      await sleep(500)
    }

    return db
  } catch (error) {
    console.error(`downloadAndAnalysePdf :: ERROR: ${error}`)
  }
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

// Lance l'exemple
run()
