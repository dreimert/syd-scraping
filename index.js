const TikaServer = require('tika-server')
const rp = require('request-promise')
const cheerio = require('cheerio')

// le mot clef 'await' permet d'attendre la fin d'une opération asynchrone

// Télécharger une page HTML
async function getHtml (url) {
  if (url) {
    try {
      return await rp(url)
    } catch (error) {
      console.error('getHtml :: RP ERROR:', error)
    }
  } else {
    console.error('getHtml :: url undefined')
  }
}

// Télécharger un pdf
async function getPdf (url) {
  if (url) {
    try {
      return await rp({ url: url, encoding: null })
    } catch (error) {
      console.error('getPdf :: RP ERROR:', error)
    }
  } else {
    console.error('getPdf :: url undefined')
  }
}

async function downloadAndAnalysePdf (urls) {
  try {
    // Lance le serveur Tika
    // Doc : https://www.npmjs.com/package/tika-server
    const ts = new TikaServer()

    ts.on('debug', (msg) => {
      // Si vous voulez voir ce qui se passe dans le serveur Tika
      // console.log(`DEBUG: ${msg}`)
    })

    // Lance le serveur tika et attend qu'il soit prêt
    await ts.start()

    // Crée une base de données avec assoication test = 42. Mettre {} pour initiliser la db comme une DB vide.
    const db = { test: 42 }

    for (let url of urls) {
      const pdf = await getPdf(url)

      // console.log('pdf', pdf)
      if (pdf) {
        const data = await ts.queryText(pdf)
        // console.log(data)
        const code = /CODE : ([^\n]*)/.exec(data)?.[1]
        console.log('Code :', code)
        db[code] = "Je fais ça au pif, juste pour montrer que je peux modifier la db"
      }
    }

    // Arrete le serveur tika
    await ts.stop()

    return db
  } catch (error) {
    console.error(`downloadAndAnalysePdf :: ERROR: ${error}`)
  }
}

// Analyser du html
// Doc : https://github.com/cheeriojs/cheerio
// ou encore : https://github.com/sfrenot/competence/blob/master/formation/crawl.coffee
async function extractUrlPdfs (url) {
  const html = await getHtml(url)
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
