const TikaServer = require('tika-server')
const rp = require('request-promise')
const cheerio = require('cheerio')
const Promise = require('bluebird')

// Télécharger une page HTML
const getHtml = (url) => {
  if (url) {
    return rp(url)
      .then(function (htmlString) {
        // console.log(htmlString)
        return htmlString
      })
      .catch(function (err) {
        console.error('getHtml :: RP ERROR:', err)
      })
  } else {
    console.error('getHtml :: url undefined')
    return Promise.resolve(undefined)
  }
}

// Télécharger un pdf
const getPdf = (url) => {
  if (url) {
    return rp({
      url: url,
      encoding: null
    }).then(function (pdf) {
      // console.log('PDF download')
      return pdf
    }).catch(function (err) {
      console.error('getPdf :: RP ERROR:', err)
    })
  } else {
    console.error('getPdf :: url undefined')
    return Promise.resolve(undefined)
  }
}

const downloadAndAnalysePdf = (urls = ['http://planete.insa-lyon.fr/scolpeda/f/ects?id=36736&_lang=fr']) => {
  // Lance le serveur Tika
  // Doc : https://www.npmjs.com/package/tika-server
  const ts = new TikaServer()

  ts.on('debug', (msg) => {
    // console.log(`DEBUG: ${msg}`)
  })

  // Lance le serveur tika
  return ts.start().then(() => {
    // Pour chaque url ...
    return Promise.reduce(urls, (db, url) => {
      // Extraction du texte.
      return getPdf(url).then((pdf) => {
        // console.log('pdf', pdf)
        if (pdf) {
          return ts.queryText(pdf).then((data) => {
            // console.log(data)
            const code = /CODE : ([^\n]*)/.exec(data)[1]
            console.log('Code :', code)
            return db
          })
        } else {
          return db
        }
      })
    }, { test: 42 }) // crée une base de données avec assoication test = 42. Mettre {} pour initiliser la db comme une DB vide.
  }).then((db) => {
    return ts.stop().then(() => db)
  }).catch((err) => {
    console.log(`TIKA ERROR: ${err}`)
  })
}

// Analyser du html
// DOc : https://github.com/cheeriojs/cheerio
// ou encore : https://github.com/sfrenot/competence/blob/master/formation/crawl.coffee
const extractUrlPdfs = (url) => {
  return getHtml(url).then((html) => {
    const $ = cheerio.load(html)
    const urls = $('#block-system-main .content-offre-formations table a').map(function () {
      return $(this).attr('href')
    }).get()
    // console.log('urls:', urls)
    return urls
  })
}

extractUrlPdfs('https://www.insa-lyon.fr/fr/formation/parcours/729/4/1').then(console.log)

downloadAndAnalysePdf().then((db) => console.log(JSON.stringify(db, null, 2)))

// Créer une base de données
const db = {}

// Écrire dans la base de données

db['code'] = {
  a: 1,
  b: 2
}

// Afficher le contenu d'une variable en json
console.log(JSON.stringify(db, null, 2))
