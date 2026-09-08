import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Un extrait réel du catalogue des télécoms, converti en texte par unpdf.
// Les contacts y ont été remplacés par des valeurs bidons : on n'a aucune
// raison de stocker les données personnelles de collègues dans un dépôt git.
const texte = readFileSync(new URL('./extrait-catalogue-telecoms.txt', import.meta.url), 'utf8')

// Les valeurs ci-dessous ont été relevées à la main dans le pdf.
// C'est ça, la référence : ce que votre code produit doit correspondre.
const PBS1 = {
  code: 'TC-3-S1-EC-PBS',
  ects: '1',
  cours: '4',
  td: '16',
  tp: '0',
  projet: '0',
  personnel: '4'
}

test('on extrait le code du premier cours', () => {
  const code = /CODE : ([^\n]*)/.exec(texte)?.[1]
  assert.equal(code, PBS1.code)
})

test('on extrait les ECTS et les horaires du premier cours', () => {
  assert.equal(/ECTS : ([\d.]+)/.exec(texte)?.[1], PBS1.ects)
  assert.equal(/Cours : ([\d.]+) ?h/.exec(texte)?.[1], PBS1.cours)
  assert.equal(/TD : ([\d.]+) ?h/.exec(texte)?.[1], PBS1.td)
  assert.equal(/TP : ([\d.]+) ?h/.exec(texte)?.[1], PBS1.tp)
  assert.equal(/Projet : ([\d.]+) ?h/.exec(texte)?.[1], PBS1.projet)
  assert.equal(/Travail personnel : ([\d.]+) ?h/.exec(texte)?.[1], PBS1.personnel)
})

test('un extrait de deux fiches donne bien deux cours', () => {
  // `exec` ne rend que la première occurrence. Pour toutes les avoir, il faut
  // le drapeau `g` et `matchAll`. C'est le piège n°1 de ce TD.
  const codes = [...texte.matchAll(/CODE : ([^\n]*)/g)].map((m) => m[1])
  assert.deepEqual(codes, ['TC-3-S1-EC-PBS', 'TC-3-S1-EC-SIS'])
})

test('le total est cohérent avec le détail des horaires', () => {
  // Un test intéressant ne compare pas seulement à une valeur attendue :
  // il vérifie une propriété qui doit rester vraie sur les 2800 fiches.
  const total = Number(/Total : ([\d.]+) ?h/.exec(texte)?.[1])
  const faceAFace = Number(/Face à face pédagogique : ([\d.]+) ?h/.exec(texte)?.[1])
  const personnel = Number(/Travail personnel : ([\d.]+) ?h/.exec(texte)?.[1])
  assert.equal(total, faceAFace + personnel)
})
