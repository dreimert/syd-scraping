const TikaServer = require("tika-server");
const rp = require('request-promise');
const cheerio = require('cheerio');

// Télécharger une page HTML
const getHtml = (url) => {
  return rp(url)
  .then(function (htmlString) {
    // console.log(htmlString);
    return htmlString;
  })
  .catch(function (err) {
    console.error("RP ERROR:", err)
  });
}

// Télécharger un pdf
const getPdf = (url) => {
  return rp({
    url: url,
    encoding: null
  }).then(function (pdf) {
    // console.log("PDF download");
    return pdf;
  }).catch(function (err) {
    console.error("RP ERROR:", err)
  });
}

// Récupérer la liste des formations
const getFormations = () => {
  return getHtml('https://www.insa-lyon.fr/fr/formation/diplomes/ING').then((html) => {
    const $ = cheerio.load(html);
    // Pour obtenir le selecteur, j'explore la page avec mon navigateur
    const urls = $('.diplome table a').map(function() {
      return $(this).attr('href');
    }).get();
    return urls; // Ne pas oublier de retourner un résultat
  })
}

const getPdfUrlsParcours = (url) => {
  return getHtml(url).then((html) => {
    const $ = cheerio.load(html);
    const urls = $('#block-system-main .content-offre-formations table a').map(function() {
      return $(this).attr('href');
    }).get();
    return urls; // Ne pas oublier de retourner un résultat
  })
}

// Renvoie plus de 3000 urls
const getAllPdfUrl = () => {
  return getFormations().then((urls) => {
    // Pour chaque url de formation, on récupère la liste des urls de pdf.
    // Ici, je fais toutes les requetes en parallèle
    // ce qui peut poser des problèmes si la machine n'a pas assez de mémoire.
    return Promise.all(urls.map((url) => {
      // url relative : /fr/formation/parcours/729/5/1
      return getPdfUrlsParcours(`https://www.insa-lyon.fr${url}`)
    })).then((urls) => {
      // urls de la forme [[...], [...], [...]]
      return [].concat.apply([], urls); // Applatissement du tableau
    })
  })
}

// Lance le serveur Tika
// Doc : https://www.npmjs.com/package/tika-server
const ts = new TikaServer();
const db = {}

ts.on("debug", (msg) => {
  // console.log(`DEBUG: ${msg}`)
})

// Lance le serveur tika
ts.start().then(() => {
  return getAllPdfUrl().then((listeUrlPdfs) => {
    // Pour chaque url ...
    return listeUrlPdfs.reduce((p, url) => {
      // Le reduce sert ici à éviter de faire toutes les requetes en même temps.
      // Il y a plus de 3000 pdfs...
      return p.then(() => {
        // Extraction du texte.
        // On vérifie qu'il y a bien une url
        if (url) {
          return getPdf(url).then((pdf) => {
            // console.log("pdf", pdf);
            if (pdf) {
              // Et qu'il y a bien un pdf.
              return ts.queryText(pdf).then((data) => {
                // console.log(data)
                const code = /CODE : ([^\n]*)/.exec(data)[1];
                console.log("code :", code);
                db[code] = true;
              });
            }
          })
        }
      })
    }, Promise.resolve()) // Initilise le reduce avec une promesse
  })
}).then(() => {
  return ts.stop()
}).catch((err) => {
  console.log(`TIKA ERROR: ${err}`, err)
  return ts.stop()
}).then(() => {
  console.log(JSON.stringify(db, null, 2));
})

// Version simple.
// Il peut être bon de loguer les pages manquantes
// pour les rapporter aux responsables.
