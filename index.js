const TikaServer = require('tika-server')
const rp = require('request-promise')
const cheerio = require('cheerio')
const Promise = require('bluebird')

// Télécharger une page HTML
const getHtml = (url) => {
  if (url) {
    return rp(url)
      // en cas de réussite
      .then(function (htmlString) {
        // console.log(htmlString)
        return htmlString
      })
      // en cas d'échec
      .catch(function (err) {
        console.error('getHtml :: RP ERROR:', err)
      })
  } else {
    // si l'url est vide
    console.error('getHtml :: url undefined')
    return Promise.resolve(undefined)
  }
}

// Télécharger un pdf
const getPdf = (url) => {
  if (url) {
    return rp({
      url: url,
      encoding: null // pour télécharger le binaire
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

const downloadAndAnalysePdf = (urls = ['http://planete.insa-lyon.fr/scolpeda/f/ects?id=36736&_lang=fr'], db = {}) => {
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
      console.log(url);
      // Extraction du texte.
      return getPdf(url).then((pdf) => {
        // console.log('pdf', pdf)
        if (pdf) {
          return ts.queryText(pdf).then((data) => {
            const code = /CODE : ([^\n]*)/.exec(data)[1]
            const ects = /ECTS : ([^\n]*)/.exec(data)[1]
            const cours = /Cours : ([^\n]*) h/.exec(data)[1]
            const td = /TD : ([^\n]*) h/.exec(data)[1]
            const tp = /TP : ([^\n]*) h/.exec(data)[1]
            const projet = /Projet : ([^\n]*) h/.exec(data)[1]
            const pedagogique = /pédagogique : ([^\n]*) h/.exec(data)[1]
            const personnel = /Travail personnel : ([^\n]*) h/.exec(data)[1]
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
              prof: extraction[1],
              email: extraction[2]
            }

            return db
          })
        } else {
          return db
        }
      })
    }, db) // crée une base de données avec assoication test = 42. Mettre {} pour initiliser la db comme une DB vide.
  }).then((db) => {
    return ts.stop().then(() => db)
  }).catch((err) => {
    console.log(`TIKA ERROR: ${err}`)
    return db;
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

const extractUrlFormations = (url = 'https://www.insa-lyon.fr/fr/formation/diplomes/ING') => {
  return getHtml(url).then((html) => {
    const $ = cheerio.load(html)
    const urls = $('.diplome table tr td:nth-child(2) a').map(function () {
      return $(this).attr('href')
    }).get()
    // console.log('urls:', urls)
    return urls
  })
}

// extractUrlPdfs('https://www.insa-lyon.fr/fr/formation/parcours/729/4/1').then((urls) => {
//   downloadAndAnalysePdf(urls).then((db) => console.log(JSON.stringify(db, null, 2)))
// })

extractUrlFormations().then((formations) => {
  return Promise.reduce(formations, (db, formation) => {
    console.log(formation);
    const url = 'https://www.insa-lyon.fr'+formation
    console.log(url);
    return extractUrlPdfs(url, db).then((urls) => {
      return downloadAndAnalysePdf(urls)
    })
  }, {})
}).then((db) => console.log(JSON.stringify(db, null, 2)))
