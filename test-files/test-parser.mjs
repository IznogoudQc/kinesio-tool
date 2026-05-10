import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import mammoth from 'mammoth'

// Inline copy of parser logic for testing without compiling TS
const FRENCH_MONTHS = {
  janvier: 1, janv: 1, jan: 1,
  'février': 2, fevrier: 2, 'fév': 2, fev: 2, feb: 2,
  mars: 3, mar: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7, jui: 7,
  'août': 8, aout: 8, 'aoû': 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  'décembre': 12, decembre: 12, 'déc': 12, dec: 12
}
function parseFrenchNumber(s) {
  if (s === undefined || s === null) return undefined
  const cleaned = String(s).trim().replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? undefined : n
}
function normalizeMonth(raw) {
  return FRENCH_MONTHS[raw.toLowerCase().replace(/\.$/, '')]
}
function findAllFrenchDates(s) {
  const re = /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(20\d{2})/g
  const out = []
  let m
  while ((m = re.exec(s)) !== null) {
    const month = normalizeMonth(m[2])
    if (!month) continue
    out.push({
      iso: `${m[3]}-${String(month).padStart(2,'0')}-${String(parseInt(m[1])).padStart(2,'0')}`,
      raw: m[0],
      index: m.index
    })
  }
  return out
}
function findDocumentDate(text) {
  const head = text.slice(0, 2000)
  const dates = findAllFrenchDates(head)
  return dates[0]?.iso
}
function chevronValue(text, labelPattern) {
  const re = new RegExp(`${labelPattern}\\s*►\\s*(-?\\d+(?:[,.]\\d+)?)`, 'i')
  return text.match(re)?.[1]
}
function matchAfter(text, label, valueRe) {
  const labelMatch = text.match(label)
  if (!labelMatch || labelMatch.index === undefined) return undefined
  const after = text.slice(labelMatch.index + labelMatch[0].length)
  return after.match(valueRe)?.[1]
}
function extractCurrent(text) {
  const data = {}
  data.pourcentage_gras = parseFrenchNumber(chevronValue(text, 'Pourcentage de Gras(?: Corporelle)?'))
  data.vo2max = parseFrenchNumber(chevronValue(text, 'Aptitude A[ée]robie\\s*\\(VO2max\\)'))
  data.indice_sante_dos = parseFrenchNumber(chevronValue(text, 'Indice de Sant[ée] du Dos'))
  data.score_musculo_global = parseFrenchNumber(chevronValue(text, 'Aptitude Musculosquelettique Globale'))
  data.score_global = parseFrenchNumber(chevronValue(text, 'Sant[ée] et Condition Physique Globale'))
  data.score_composition = parseFrenchNumber(chevronValue(text, 'Composition Corporelle'))
  data.pa_systolique = parseFrenchNumber(chevronValue(text, 'Pression Art[ée]rielle Systolique'))
  data.pa_diastolique = parseFrenchNumber(chevronValue(text, 'Pression Art[ée]rielle Diastolique'))
  data.fc_repos = parseFrenchNumber(chevronValue(text, 'Fr[ée]quence Cardiaque Pr[ée]-Exerci[cs]e'))
  data.pushups = parseFrenchNumber(chevronValue(text, 'Extension des Bras'))
  data.situps = parseFrenchNumber(chevronValue(text, 'Redressement Assis Partiel'))
  data.saut_vertical_cm = parseFrenchNumber(chevronValue(text, 'Saut vertical'))
  data.puissance_jambes_watts = parseFrenchNumber(chevronValue(text, 'Puissance des Jambes'))
  data.flexion_tronc_cm = parseFrenchNumber(chevronValue(text, 'Flexion Avant du Tronc'))
  data.endurance_dos_sec = parseFrenchNumber(chevronValue(text, 'Endurance des Extenseurs du Dos'))

  const anthroStart = text.search(/Taille\s*\n\s*Poids\s*\n\s*IMC/)
  if (anthroStart !== -1) {
    const anthroEnd = text.indexOf('Composition Corporelle ►', anthroStart)
    const section = text.slice(anthroStart, anthroEnd === -1 ? anthroStart + 600 : anthroEnd)
    const cmMatches = [...section.matchAll(/(\d+(?:[,.]\d+)?)\s*cm(?!\/)/g)]
    const kgMatch = section.match(/(\d+(?:[,.]\d+)?)\s*kg(?!\/)/)
    const imcMatch = section.match(/(\d+(?:[,.]\d+)?)\s*kg\/m/)
    if (cmMatches[0]) data.taille_cm = parseFrenchNumber(cmMatches[0][1])
    if (cmMatches[1]) data.tour_taille_cm = parseFrenchNumber(cmMatches[1][1])
    if (kgMatch) data.poids_kg = parseFrenchNumber(kgMatch[1])
    if (imcMatch) data.imc = parseFrenchNumber(imcMatch[1])
  }
  const pliStart = text.search(/Plis Cutan[ée]s/)
  if (pliStart !== -1) {
    const pliSection = text.slice(pliStart, pliStart + 800)
    data.pli_triceps = parseFrenchNumber(matchAfter(pliSection, /Triceps\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
    data.pli_biceps = parseFrenchNumber(matchAfter(pliSection, /Biceps\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
    data.pli_sous_scap = parseFrenchNumber(matchAfter(pliSection, /(?:Subscapulaire|Sousscapular|Sous-scap[a-zé]*)\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
    data.pli_iliaque = parseFrenchNumber(matchAfter(pliSection, /(?:Cr[êèe]te iliaque|Iliaque)\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
    data.pli_mollet = parseFrenchNumber(matchAfter(pliSection, /Mollet\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
    data.pli_cuisse = parseFrenchNumber(matchAfter(pliSection, /Cuisse\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
  }
  const hancheMatch = text.match(/Hanche\s*[\n\r]+\s*(\d+(?:[,.]\d+)?)/)
  if (hancheMatch) data.tour_hanche_cm = parseFrenchNumber(hancheMatch[1])
  const testMatch = text.match(/Aptitude A[ée]robie\s+([^\n(]+?)\s*\n\s*\n\s*(?:À am[ée]liorer|Acceptable|Bien|Tr[èe]s bien|Excellent)/)
  if (testMatch) data.test_aerobie = testMatch[1].trim()
  return data
}
function extractHistory(text) {
  const tableMatch = text.match(/Indice de masse corporelle\s*[\n\r]/)
  if (!tableMatch || tableMatch.index === undefined) return []
  const before = text.slice(0, tableMatch.index)
  const datesBefore = findAllFrenchDates(before)
  if (datesBefore.length < 2) return []
  const consecutive = []
  for (let i = datesBefore.length - 1; i >= 0; i--) {
    if (consecutive.length === 0) { consecutive.push(datesBefore[i]); continue }
    const last = consecutive[consecutive.length - 1]
    const dist = last.index - (datesBefore[i].index + datesBefore[i].raw.length)
    if (dist < 50) consecutive.push(datesBefore[i])
    else break
  }
  consecutive.reverse()
  if (consecutive.length < 2) return []
  const tail = text.slice(tableMatch.index, tableMatch.index + 5000)
  const dates = consecutive.map(d => d.iso)
  const n = dates.length
  function readRow(label) {
    const m = tail.match(label)
    if (!m || m.index === undefined) return undefined
    const after = tail.slice(m.index + m[0].length)
    const numRe = /(-?\d+(?:[,.]\d+)?)/g
    const out = []
    let nm
    let lastEnd = 0
    while ((nm = numRe.exec(after)) !== null && out.length < n) {
      const between = after.slice(lastEnd, nm.index)
      if (out.length > 0 && /[A-Za-zÀ-ÿ]{3,}/.test(between)) break
      out.push(parseFrenchNumber(nm[1]))
      lastEnd = nm.index + nm[0].length
    }
    if (out.length < 2) return undefined
    while (out.length < n) out.push(undefined)
    return out
  }
  const defs = [
    { re: /Indice de masse corporelle\s*[\n\r]+/, field: 'imc' },
    { re: /Composition corporelle\s*[\n\r]+/, field: 'score_composition' },
    { re: /Pourcentage de gras\s*[\n\r]+/, field: 'pourcentage_gras' },
    { re: /Circonf[ée]rence de la taille\s*[\n\r]+/, field: 'tour_taille_cm' },
    { re: /Triceps\s*[\n\r]+/, field: 'pli_triceps' },
    { re: /Biceps\s*[\n\r]+/, field: 'pli_biceps' },
    { re: /(?:Subscapulaire|Sousscapular|Sous-scap[a-zé]*)\s*[\n\r]+/, field: 'pli_sous_scap' },
    { re: /(?:Cr[êèe]te iliaque|Iliaque)\s*[\n\r]+/, field: 'pli_iliaque' },
    { re: /Hanche\s*[\n\r]+/, field: 'tour_hanche_cm' }
  ]
  const rows = []
  for (const def of defs) {
    const values = readRow(def.re)
    if (values) rows.push({ field: def.field, values })
  }
  const result = []
  for (let i = 1; i < n; i++) {
    const data = {}
    for (const row of rows) {
      const v = row.values[i]
      if (v !== undefined) data[row.field] = v
    }
    if (Object.keys(data).length > 0) result.push({ date: dates[i], data })
  }
  return result
}

const filePath = resolve('test-files/2025 09-04 Nicholas Jean (1).docx')
const buf = await readFile(filePath)
const r = await mammoth.extractRawText({ buffer: buf })
const text = r.value
console.log('=== DATE ===')
console.log(findDocumentDate(text))
console.log('=== CURRENT DATA ===')
console.log(JSON.stringify(extractCurrent(text), null, 2))
console.log('=== HISTORY ===')
console.log(JSON.stringify(extractHistory(text), null, 2))
