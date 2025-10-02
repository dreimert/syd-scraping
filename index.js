import pdfParse from 'pdf-parse'
import * as cheerio from 'cheerio'

// le mot clef 'await' permet d'attendre la fin d'une opération asynchrone

/**
 * Permet d'attendre duration ms
 * @param {number} duration - Durée en millisecondes
 * @returns {Promise<void>} Promise qui se résout après la durée spécifiée
 */
function sleep (duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
}

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
 * @returns {Promise<Buffer|undefined>} Le contenu du PDF sous forme de Buffer, ou undefined en cas d'erreur
 */
async function getPdf (url) {
  if (url) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      console.error('getPdf :: FETCH ERROR:', error)
    }
  } else {
    console.error('getPdf :: url undefined')
  }
}

/**
 * Télécharge et analyse des fichiers PDF
 * @param {string[]} urls - Tableau d'URLs des fichiers PDF à télécharger et analyser
 * @returns {Promise<Object|undefined>} Base de données contenant les codes extraits des PDFs, ou undefined en cas d'erreur
 */
async function downloadAndAnalysePdf (urls) {
  try {
    // Crée une base de données avec assoication test = 42. Mettre {} pour initiliser la db comme une DB vide.
    /** @type {{[key: string]: string}} */
    const db = { test: '42' }

    for (let url of urls) {
      const pdf = await getPdf(url)

      // console.log('pdf', pdf)

      if (pdf) {
        const data = await pdfParse(pdf);
        const txt = data.text;

        const code = /CODE :\n([^\n]*)/.exec(txt)?.[1]

        if (code) {
          console.log('Code :', code)
          db[code] = "Je fais ça au pif, juste pour montrer que je peux modifier la db"
        }
      }
    }

    return db
  } catch (error) {
    console.error(`downloadAndAnalysePdf :: ERROR: ${error}`)
  }
}

/**
 * Analyser du html pour extraire les URLs des PDFs
 * @param {string} url - L'URL de la page HTML à analyser
 * @returns {Promise<string[]>} Tableau des URLs des fichiers PDF trouvés sur la page
 */
async function extractUrlPdfs (url) {
  const html = await getHtml(url)
  if (!html) {
    return []
  }
  // Doc : https://github.com/cheeriojs/cheerio
  // ou encore : https://github.com/sfrenot/competence/blob/master/formation/crawl.coffee
  const $ = cheerio.load(html)
  const urls = $('#block-system-main .content-offre-formations table a').map(function () {
    return $(this).attr('href')
  }).get()
  // console.log('urls:', urls)
  return urls
}

// Exemple
async function run () {
  console.log('Extracting urls...')
  console.log(await extractUrlPdfs('https://www.insa-lyon.fr/fr/formation/parcours/729/4/1'))

  console.log('Downloading and analysing pdfs...')
  const db = await downloadAndAnalysePdf(['http://planete.insa-lyon.fr/scolpeda/f/ects?id=36736&_lang=fr'])

  // Afficher le contenu d'une variable en json pour plus de lisibilité
  console.log(JSON.stringify(db, null, 2))
}

// Lance l'exemple
run()
