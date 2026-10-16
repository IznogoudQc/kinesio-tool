/**
 * Le brouillon d'un questionnaire en cours de saisie.
 *
 * Marie a perdu un questionnaire de santé à moitié rempli en fermant
 * l'application : rien n'était enregistré tant qu'elle n'avait pas cliqué
 * « Enregistrer ». Désormais chaque frappe est recopiée dans un brouillon, et
 * l'onglet le propose au retour.
 *
 * Un brouillon n'est PAS un questionnaire. Il ne descend pas en base, n'apparaît
 * pas dans l'historique, n'entre dans aucun rapport : un formulaire à trois
 * réponses sur vingt n'a rien à dire du client, et l'historique est un dossier,
 * pas un chantier. Il vit dans le stockage local de la fenêtre, à côté des
 * autres préférences d'affichage, et disparaît à l'enregistrement.
 *
 * Conséquence assumée : un brouillon ne suit pas une sauvegarde OneDrive ni un
 * transfert d'un poste à l'autre. Il protège la demi-heure de saisie en cours,
 * pas le dossier du client — c'est l'enregistrement qui fait cela.
 *
 * Le module ne connaît pas les questionnaires : il range et relit une donnée
 * opaque sous une clé. Le vocabulaire des types reste à l'onglet.
 */

/** Ce dont le module a besoin d'un stockage — `window.localStorage` en satisfait
 *  la forme, et un objet simple suffit à le tester. */
export interface StockageSimple {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
  removeItem(cle: string): void
}

/** Un brouillon tel qu'il est rangé. */
export interface Brouillon {
  /** Forme de l'enregistrement. Un brouillon d'une autre version est ignoré
   *  plutôt que deviné : mieux vaut repartir à vide que restaurer de travers. */
  version: 1
  /** Dernière recopie, en ISO. Sert à le dater à l'écran et à le périmer. */
  enregistreLe: string
  /** Questionnaire existant en cours de retouche, `null` pour un nouveau. */
  id: string | null
  /** La date du questionnaire, telle qu'elle est dans le formulaire. */
  date: string
  /** Le contenu du formulaire, tel quel. */
  data: unknown
}

/**
 * Au-delà, un brouillon n'est plus proposé.
 *
 * Un questionnaire se remplit en une séance, parfois en deux. Un brouillon de
 * six semaines n'est pas une saisie interrompue, c'est un formulaire ouvert par
 * curiosité puis oublié : le proposer ferait douter Marie de ce qu'elle a
 * enregistré.
 */
export const PEREMPTION_JOURS = 30

const PREFIXE = 'kinesio.questionnaire-brouillon'

/**
 * La clé d'un brouillon : un par client ET par type.
 *
 * Sans le type, ouvrir un Q-AAP écraserait le questionnaire de santé commencé
 * la veille. Sans le client, le brouillon de l'un se proposerait chez l'autre —
 * le pire défaut possible dans un dossier de santé.
 */
export function cleBrouillon(clientId: string, type: string): string {
  return `${PREFIXE}.${clientId}.${type}`
}

/**
 * Relit un brouillon. `null` s'il n'y en a pas, s'il est illisible, s'il vient
 * d'une autre version ou s'il est périmé.
 *
 * Un brouillon illisible est effacé au passage : le garder reviendrait à le
 * relire — et à échouer — à chaque ouverture de l'onglet.
 */
export function lireBrouillon(
  stockage: StockageSimple,
  clientId: string,
  type: string,
  maintenant: Date = new Date()
): Brouillon | null {
  const cle = cleBrouillon(clientId, type)
  const brut = stockage.getItem(cle)
  if (brut === null) return null

  let lu: unknown
  try {
    lu = JSON.parse(brut)
  } catch {
    stockage.removeItem(cle)
    return null
  }

  if (!estBrouillon(lu)) {
    stockage.removeItem(cle)
    return null
  }

  const age = maintenant.getTime() - new Date(lu.enregistreLe).getTime()
  // `age < 0` : une horloge qui a reculé. On garde — un brouillon daté de
  // demain reste la saisie de Marie, et ce n'est pas au stockage de trancher.
  if (age > PEREMPTION_JOURS * 24 * 3600 * 1000) {
    stockage.removeItem(cle)
    return null
  }

  return lu
}

/**
 * Recopie un brouillon. Rend l'enregistrement rangé — l'appelant y lit l'heure
 * à afficher sans relire le stockage.
 *
 * Un stockage plein (quota) ne doit pas faire tomber la saisie : on échoue en
 * silence et on rend `null`. Perdre le brouillon est fâcheux ; perdre le
 * formulaire à l'écran, parce qu'une recopie a levé, serait exactement le
 * défaut qu'on répare.
 */
export function ecrireBrouillon(
  stockage: StockageSimple,
  clientId: string,
  type: string,
  brouillon: Omit<Brouillon, 'version' | 'enregistreLe'>,
  maintenant: Date = new Date()
): Brouillon | null {
  const range: Brouillon = {
    version: 1,
    enregistreLe: maintenant.toISOString(),
    id: brouillon.id,
    date: brouillon.date,
    data: brouillon.data
  }
  try {
    stockage.setItem(cleBrouillon(clientId, type), JSON.stringify(range))
  } catch {
    return null
  }
  return range
}

/** Efface le brouillon — à l'enregistrement, ou quand Marie l'abandonne. */
export function effacerBrouillon(stockage: StockageSimple, clientId: string, type: string): void {
  try {
    stockage.removeItem(cleBrouillon(clientId, type))
  } catch {
    // Un stockage indisponible n'a de toute façon rien gardé.
  }
}

/**
 * Deux contenus de formulaire se valent-ils ?
 *
 * Sert à ne rien recopier d'un formulaire qu'on vient d'ouvrir et où rien n'a
 * été touché — sinon l'onglet proposerait au retour de « reprendre » un
 * questionnaire vide. L'ordre des clés ne compte pas : un même formulaire passé
 * par plusieurs `{ ...data }` n'a aucune raison de les garder dans l'ordre.
 *
 * `undefined` et une clé absente sont tenus pour la même chose : une case vidée
 * repasse par l'un ou par l'autre selon le champ, et la distinction n'a aucun
 * sens pour Marie.
 */
export function memeContenu(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => memeContenu(v, b[i]))
  }

  const oa = a as Record<string, unknown>
  const ob = b as Record<string, unknown>
  const cles = new Set([...Object.keys(oa), ...Object.keys(ob)])
  for (const c of cles) {
    if (oa[c] === undefined && ob[c] === undefined) continue
    if (!memeContenu(oa[c], ob[c])) return false
  }
  return true
}

/** L'heure seule — « 14 h 32 ». Vide si la date est illisible. Sert sous le
 *  formulaire, où le jour va de soi : la recopie vient d'avoir lieu. */
export function heureSeule(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

/** L'heure d'un brouillon, pour le dire à Marie : « aujourd'hui, 14 h 32 ». */
export function heureBrouillon(iso: string, maintenant: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const heure = heureSeule(iso)
  const memeJour =
    d.getFullYear() === maintenant.getFullYear() &&
    d.getMonth() === maintenant.getMonth() &&
    d.getDate() === maintenant.getDate()
  if (memeJour) return `aujourd’hui, ${heure}`

  const hier = new Date(maintenant)
  hier.setDate(hier.getDate() - 1)
  const memeHier =
    d.getFullYear() === hier.getFullYear() && d.getMonth() === hier.getMonth() && d.getDate() === hier.getDate()
  if (memeHier) return `hier, ${heure}`

  return `${d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })}, ${heure}`
}

function estBrouillon(v: unknown): v is Brouillon {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (o.version !== 1) return false
  if (typeof o.enregistreLe !== 'string' || Number.isNaN(new Date(o.enregistreLe).getTime())) return false
  if (o.id !== null && typeof o.id !== 'string') return false
  if (typeof o.date !== 'string') return false
  return true
}
