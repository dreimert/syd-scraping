const fs = require('fs')
const path = require('path')
const rp = require('request-promise')
const cheerio = require('cheerio')

const directory = './site'

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

async function write (path, name, content) {
  path = `${directory}/${path.replace('https://www.insa-lyon.fr/', '')}`

  console.log('path:', path)

  if (!fs.existsSync(path)){
    fs.mkdirSync(path, { recursive: true });
  }

  console.log('write:', `${path}/${name}`)
  if (content) {
    try {
      return await fs.writeFileSync(`${path}/${name}`, content, { flag: 'w'})
    } catch (error) {
      console.error('writeHtml :: FS ERROR:', error)
    }
  } else {
    console.error('writeHtml :: content undefined')
  }
}

// Analyser du html
// Doc : https://github.com/cheeriojs/cheerio
// ou encore : https://github.com/sfrenot/competence/blob/master/formation/crawl.coffee
async function extractUrlPdfs (url) {
  const html = await getHtml(url)
  await write(url, 'index.html', html)
  const $ = cheerio.load(html)
  const urls = $('#block-system-main .content-offre-formations table a').map(function () {
    return $(this).attr('href')
  }).get()
  // console.log('urls:', urls)
  return urls
}

async function extractUrlFormations (url = 'https://www.insa-lyon.fr/fr/formation/diplomes/ING') {
  const html = await getHtml(url)
  await write('', 'index.html', html)
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

    for (let url of urls) {
      console.log('url', url);
      const pdf = await getPdf(url)
      const [path, params] = url.split('?')
      await write(path.replace('https://planete.insa-lyon.fr/scolpeda/', ''), params.split('&')[0].split('=')[1], pdf)
    }
  }

  console.log(JSON.stringify(db, null, 2))
}

// Lance l'exemple
run()
