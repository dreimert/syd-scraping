// Constitue une copie locale du site de l'INSA, pour pouvoir travailler hors
// ligne — ou le jour où l'INSA aura encore déplacé quelque chose.
//
//     node backup.js
//
// Les pages html sont réécrites pour que les liens qu'elles contiennent
// pointent vers le serveur local (cf. serve.js) : la copie est autonome.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const BASE_URL = 'https://www.insa-lyon.fr'
const LOCAL_URL = process.env.LOCAL_URL ?? 'http://localhost:8000'
const DIR = 'backup'

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

/**
 * Écrit un contenu dans backup/, en recréant l'arborescence du site
 * @param {string} path - Le chemin de l'URL, par exemple /fr/formation/catalogue
 * @param {string|Uint8Array} content - Le contenu à écrire
 */
async function save (path, content) {
  // Une url qui finit par / ou sans extension devient un fichier index.html
  const file = join(DIR, /\.[a-z]{2,4}$/i.test(path) ? path : join(path, 'index.html'))
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, content)
  return file
}

async function run () {
  const pages = ['/fr/formation/catalogue']
  const pdfs = new Set()
  const vus = new Set()

  // 1. Le catalogue, puis chaque page de formation qu'il liste.
  for (let i = 0; i < pages.length; i++) {
    const path = pages[i]
    if (vus.has(path)) continue
    vus.add(path)

    const response = await fetch(BASE_URL + path)
    if (!response.ok) {
      console.error(`  ${response.status} ${path}`)
      continue
    }
    let html = await response.text()

    // On ne descend qu'un niveau : le catalogue liste les formations.
    if (path === '/fr/formation/catalogue') {
      for (const [, href] of html.matchAll(/href="(\/fr\/formation\/[^"#?]*)"/g)) {
        if (!/catalogue|formations-|formation-doc/.test(href)) pages.push(href)
      }
    }

    for (const [, href] of html.matchAll(/href="([^"]*\.pdf)"/gi)) {
      if (/catalog/i.test(href)) pdfs.add(href.replace(BASE_URL, ''))
    }

    // La copie doit être autonome : les liens absolus vers l'INSA sont
    // réécrits vers le serveur local.
    html = html.replaceAll(BASE_URL, LOCAL_URL)
    console.log(`html ${await save(path, html)}`)
    await sleep(500)
  }

  // 2. Les pdfs des catalogues.
  for (const path of pdfs) {
    const response = await fetch(BASE_URL + path)
    if (!response.ok) {
      console.error(`  ${response.status} ${path}`)
      continue
    }
    const pdf = new Uint8Array(await response.arrayBuffer())
    console.log(`pdf  ${await save(path, pdf)} (${Math.round(pdf.length / 1024)} Ko)`)
    await sleep(500)
  }

  console.log(`\n${vus.size} pages, ${pdfs.size} pdfs dans ${DIR}/`)
}

run()
