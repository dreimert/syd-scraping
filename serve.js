// Sert la copie locale du site (dossier backup/, issu de l'archive fournie par
// l'intervenant), pour travailler hors ligne.
//
//     npm run serve
//
// Puis, dans un autre terminal :
//
//     BASE_URL=http://localhost:8000 node index.js

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'

const DIR = 'backup'
// Port imposé : les liens de la copie ont été réécrits en dur vers
// http://localhost:8000. Sur un autre port, les pages s'afficheraient mais
// les liens vers les pdfs pointeraient ailleurs.
const PORT = 8000

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
}

createServer(async (request, response) => {
  // On enlève la query string : /f/ects?id=42 doit lire le fichier /f/ects
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  // normalize empêche de sortir de DIR avec des ../
  const file = join(DIR, normalize(path))
  const candidats = extname(file) ? [file] : [join(file, 'index.html'), file]

  for (const candidat of candidats) {
    try {
      const content = await readFile(candidat)
      response.writeHead(200, { 'content-type': TYPES[extname(candidat)] ?? 'application/octet-stream' })
      console.log(`200 ${path}`)
      return response.end(content)
    } catch {
      // On essaie le candidat suivant
    }
  }

  console.log(`404 ${path}`)
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  response.end("Pas dans la copie locale. Avez-vous décompressé l'archive dans backup/ ?\n")
}).listen(PORT, () => {
  console.log(`Copie locale servie sur http://localhost:${PORT}`)
  console.log(`Lancez le scraper avec : BASE_URL=http://localhost:${PORT} node index.js`)
})
