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

async function downloadAndAnalysePdf (urls, db = {}) {
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

    for (let url of urls) {
      const pdf = await getPdf(url)

      // console.log('pdf', pdf)
      if (pdf) {
        const data = await ts.queryText(pdf)
        // console.log(data)

        const code = /CODE : ([^\n]*)/.exec(data)?.[1]
        const ects = /ECTS : ([^\n]*)/.exec(data)?.[1]
        const cours = /Cours : ([^\n]*) h/.exec(data)?.[1]
        const td = /TD : ([^\n]*) h/.exec(data)?.[1]
        const tp = /TP : ([^\n]*) h/.exec(data)?.[1]
        const projet = /Projet : ([^\n]*) h/.exec(data)?.[1]
        const pedagogique = /pédagogique : ([^\n]*) h/.exec(data)?.[1]
        const personnel = /Travail personnel : ([^\n]*) h/.exec(data)?.[1]
        const extraction = /CONTACT\n\n([^\n]*)\n([^\n]*)/.exec(data)

        db[code] = {
          code: code,
          ects: ects,
          cours: cours,
          td: td,
          tp: tp,
          projet: projet,
          pedagogique: pedagogique,
          personnel: personnel,
          prof: extraction?.[1],
          email: extraction?.[2]
        }
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

async function extractUrlFormations (url = 'https://www.insa-lyon.fr/fr/formation/diplomes/ING') {
  const html = await getHtml(url)
  const $ = cheerio.load(html)
  const urls = $('.diplome table tr td:nth-child(2) a').map(function () {
    return $(this).attr('href')
  }).get()
  // console.log('urls:', urls)
  return urls
}

// Exemple
async function run () {
  const formations = await extractUrlFormations()

  let db = {}

  for (let formation of formations) {
    console.log(formation)

    const urls = await extractUrlPdfs(`https://www.insa-lyon.fr${formation}`)

    await downloadAndAnalysePdf(urls, db)
  }

  console.log(JSON.stringify(db, null, 2))
}

// Lance l'exemple
run()
