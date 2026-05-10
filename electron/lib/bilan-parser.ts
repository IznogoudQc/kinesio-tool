import mammoth from 'mammoth'

export interface BilanData {
  taille_cm?: number
  poids_kg?: number
  imc?: number
  tour_taille_cm?: number
  tour_hanche_cm?: number
  pli_triceps?: number
  pli_biceps?: number
  pli_sous_scap?: number
  pli_iliaque?: number
  pli_mollet?: number
  pli_cuisse?: number
  pourcentage_gras?: number
  vo2max?: number
  test_aerobie?: string
  fc_repos?: number
  pa_systolique?: number
  pa_diastolique?: number
  pushups?: number
  situps?: number
  saut_vertical_cm?: number
  puissance_jambes_watts?: number
  flexion_tronc_cm?: number
  endurance_dos_sec?: number
  score_composition?: number
  indice_sante_dos?: number
  score_musculo_global?: number
  score_global?: number
}

export interface ExtractedBilan {
  date: string
  data: BilanData
}

export interface ParsedBilanResult {
  current: ExtractedBilan
  history: ExtractedBilan[]
}

const FRENCH_MONTHS: Record<string, number> = {
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

function parseFrenchNumber(s: string | undefined | null): number | undefined {
  if (s === undefined || s === null) return undefined
  const cleaned = s.trim().replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? undefined : n
}

function normalizeMonth(raw: string): number | undefined {
  const key = raw.toLowerCase().replace(/\.$/, '')
  return FRENCH_MONTHS[key]
}

function findAllFrenchDates(s: string): { iso: string; raw: string; index: number }[] {
  const re = /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(20\d{2})/g
  const out: { iso: string; raw: string; index: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const month = normalizeMonth(m[2])
    if (!month) continue
    const day = parseInt(m[1], 10)
    const year = parseInt(m[3], 10)
    out.push({
      iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      raw: m[0],
      index: m.index
    })
  }
  return out
}

function findDocumentDate(text: string): string | undefined {
  const head = text.slice(0, 2000)
  const dates = findAllFrenchDates(head)
  if (dates.length === 0) return undefined
  return dates[0].iso
}

function matchAfter(text: string, label: RegExp, valueRe: RegExp): string | undefined {
  const labelMatch = text.match(label)
  if (!labelMatch || labelMatch.index === undefined) return undefined
  const after = text.slice(labelMatch.index + labelMatch[0].length)
  const v = after.match(valueRe)
  return v?.[1]
}

function chevronValue(text: string, labelPattern: string): string | undefined {
  const re = new RegExp(`${labelPattern}\\s*►\\s*(-?\\d+(?:[,.]\\d+)?)`, 'i')
  const m = text.match(re)
  return m?.[1]
}

function extractCurrent(text: string): BilanData {
  const data: BilanData = {}

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

  // Anthropometry: section between "Taille\nPoids\nIMC\nCirconfér. de la taille" and next major heading
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

  // Skinfolds: first occurrence after "Plis Cutanés"
  const pliStart = text.search(/Plis Cutan[ée]s/)
  if (pliStart !== -1) {
    const pliSection = text.slice(pliStart, pliStart + 800)
    data.pli_triceps = parseFrenchNumber(matchAfter(pliSection, /Triceps\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
    data.pli_biceps = parseFrenchNumber(matchAfter(pliSection, /Biceps\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
    data.pli_sous_scap = parseFrenchNumber(
      matchAfter(pliSection, /(?:Subscapulaire|Sousscapular|Sous-scap[a-zé]*)\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/)
    )
    data.pli_iliaque = parseFrenchNumber(
      matchAfter(pliSection, /(?:Cr[êèe]te iliaque|Iliaque)\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/)
    )
    data.pli_mollet = parseFrenchNumber(matchAfter(pliSection, /Mollet\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
    data.pli_cuisse = parseFrenchNumber(matchAfter(pliSection, /Cuisse\s*[\n\r]+/, /^\s*(\d+(?:[,.]\d+)?)/))
  }

  // Hanche
  const hancheMatch = text.match(/Hanche\s*[\n\r]+\s*(\d+(?:[,.]\d+)?)/)
  if (hancheMatch) data.tour_hanche_cm = parseFrenchNumber(hancheMatch[1])

  // Test aerobie: heading "Aptitude Aérobie <test name>" before main body
  const testMatch = text.match(/Aptitude A[ée]robie\s+([^\n(]+?)\s*\n\s*\n\s*(?:À am[ée]liorer|Acceptable|Bien|Tr[èe]s bien|Excellent)/)
  if (testMatch) data.test_aerobie = testMatch[1].trim()

  return data
}

interface HistoryRow {
  label: string
  values: (number | undefined)[]
  field: keyof BilanData
}

function extractHistory(text: string): ExtractedBilan[] {
  // Anchor on "Indice de masse corporelle" — first row of the historical table.
  // The dates block immediately precedes it; this is more reliable than picking
  // among the multiple date sequences scattered through trend charts.
  const tableMatch = text.match(/Indice de masse corporelle\s*[\n\r]/)
  if (!tableMatch || tableMatch.index === undefined) return []

  const before = text.slice(0, tableMatch.index)
  const datesBefore = findAllFrenchDates(before)
  if (datesBefore.length < 2) return []

  // Walk backwards collecting dates that are clustered tightly (the table header)
  const consecutive: { iso: string; raw: string; index: number }[] = []
  for (let i = datesBefore.length - 1; i >= 0; i--) {
    if (consecutive.length === 0) {
      consecutive.push(datesBefore[i])
      continue
    }
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

  function readRow(label: RegExp): (number | undefined)[] | undefined {
    const m = tail.match(label)
    if (!m || m.index === undefined) return undefined
    const after = tail.slice(m.index + m[0].length)
    // Read up to next non-numeric label (anything starting with a letter on its own line)
    // by collecting up to N numeric tokens
    const numRe = /(-?\d+(?:[,.]\d+)?)/g
    const out: (number | undefined)[] = []
    let nm: RegExpExecArray | null
    let lastEnd = 0
    while ((nm = numRe.exec(after)) !== null && out.length < n) {
      // If between lastEnd and nm.index there's a letter (label starting), stop
      const between = after.slice(lastEnd, nm.index)
      if (out.length > 0 && /[A-Za-zÀ-ÿ]{3,}/.test(between)) break
      out.push(parseFrenchNumber(nm[1]))
      lastEnd = nm.index + nm[0].length
    }
    if (out.length < 2) return undefined
    while (out.length < n) out.push(undefined)
    return out
  }

  const rows: HistoryRow[] = []
  const defs: { re: RegExp; field: keyof BilanData; label: string }[] = [
    { re: /Indice de masse corporelle\s*[\n\r]+/, field: 'imc', label: 'IMC' },
    { re: /Composition corporelle\s*[\n\r]+/, field: 'score_composition', label: 'Composition' },
    { re: /Pourcentage de gras\s*[\n\r]+/, field: 'pourcentage_gras', label: '% gras' },
    { re: /Circonf[ée]rence de la taille\s*[\n\r]+/, field: 'tour_taille_cm', label: 'Tour de taille' },
    { re: /Triceps\s*[\n\r]+/, field: 'pli_triceps', label: 'Pli triceps' },
    { re: /Biceps\s*[\n\r]+/, field: 'pli_biceps', label: 'Pli biceps' },
    { re: /(?:Subscapulaire|Sousscapular|Sous-scap[a-zé]*)\s*[\n\r]+/, field: 'pli_sous_scap', label: 'Pli sous-scapulaire' },
    { re: /(?:Cr[êèe]te iliaque|Iliaque)\s*[\n\r]+/, field: 'pli_iliaque', label: 'Pli iliaque' },
    { re: /Hanche\s*[\n\r]+/, field: 'tour_hanche_cm', label: 'Tour de hanche' }
  ]

  for (const def of defs) {
    const values = readRow(def.re)
    if (values) rows.push({ label: def.label, values, field: def.field })
  }

  if (rows.length === 0) return []

  // Build one ExtractedBilan per historical date (skip index 0 which is current)
  const result: ExtractedBilan[] = []
  for (let i = 1; i < n; i++) {
    const data: BilanData = {}
    for (const row of rows) {
      const v = row.values[i]
      if (v !== undefined) (data[row.field] as number | undefined) = v
    }
    if (Object.keys(data).length > 0) {
      result.push({ date: dates[i], data })
    }
  }
  return result
}

export async function parseBilanDocx(input: Buffer | string): Promise<ParsedBilanResult> {
  const result =
    typeof input === 'string'
      ? await mammoth.extractRawText({ path: input })
      : await mammoth.extractRawText({ buffer: input })
  const text: string = result.value
  const date = findDocumentDate(text)
  if (!date) {
    throw new Error('Impossible de trouver la date du bilan dans le document.')
  }
  const data = extractCurrent(text)
  const history = extractHistory(text)
  return {
    current: { date, data },
    history
  }
}
