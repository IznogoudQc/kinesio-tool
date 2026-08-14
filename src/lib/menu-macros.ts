/**
 * Protéines d'un repas, CALCULÉES à partir des poids écrits.
 *
 * ── Pourquoi calculer plutôt que demander ───────────────────────────────────
 *
 * Depuis la v0.9.174 la source de protéines de chaque repas porte un poids en
 * grammes. Un poids et une table de composition suffisent à faire une
 * multiplication : le résultat est le même à chaque fois, n'importe qui peut le
 * recouper, et il ne dépend d'aucun modèle. Une estimation d'IA, elle, change
 * d'un appel à l'autre et ne se vérifie pas.
 *
 * C'est ce qui distingue ce chiffre des calories, glucides et lipides : eux
 * n'ont pas de poids à multiplier — le quinoa est « 1 tasse », le brocoli n'a
 * pas de quantité — et restent donc des estimations affichées comme telles.
 *
 * ── Ce que ce module ne fait PAS ────────────────────────────────────────────
 *
 * Il ne devine rien. Un aliment pesé qu'il ne connaît pas est signalé dans
 * `inconnus`, pas remplacé par un aliment qui lui ressemble : compter une
 * dorade comme un saumon donnerait un chiffre faux avec l'air d'être juste.
 *
 * ⚠️ Sert à ce que Marie VÉRIFIE le travail de l'IA. Rien n'est stocké et rien
 * n'entre dans le document du client — le calcul de l'apport d'une personne
 * relève de la nutritionniste.
 */
import { MACROS_PAR_100G, type MacrosPour100g, type TableMacros } from './food-macros.ts'

/**
 * Ce qu'on cherche dans le texte, et l'entrée de la table qui lui correspond.
 *
 * Les intitulés de la table sont des catégories (« Poulet, dinde ») alors que
 * les menus écrivent des plats (« salade de poulet grillé »). Cette liste est
 * le pont entre les deux, écrite à la main pour rester lisible et testable.
 *
 * L'ordre compte : le premier motif qui correspond gagne. Les plus spécifiques
 * d'abord — « fromage cottage » avant « fromage ».
 */
const SYNONYMES: { motif: RegExp; aliment: string; prioritaire?: boolean }[] = [
  // `prioritaire` : gagne quel que soit l'ordre des mots. « hauts de cuisse de
  // poulet » contient « poulet », qui apparaît APRÈS — sans priorité, la règle
  // de proximité choisirait la poitrine et surestimerait de 6 g aux 100 g.
  { motif: /haut(s)? de cuisse|cuisse(s)? de poulet|pilon/i, aliment: 'Poulet, haut de cuisse', prioritaire: true },
  { motif: /cottage/i, aliment: 'Fromage cottage' },
  { motif: /feta|ricotta/i, aliment: 'Fromage feta, ricotta' },
  { motif: /yogourt|yaourt/i, aliment: 'Yogourt grec' },
  { motif: /poulet|dinde|poitrine/i, aliment: 'Poulet, dinde' },
  { motif: /saumon|truite/i, aliment: 'Saumon, truite' },
  { motif: /sardine|maquereau/i, aliment: 'Poissons gras (saumon, sardines)' },
  { motif: /morue|tilapia|poisson blanc|aiglefin|sole/i, aliment: 'Poisson blanc (morue, tilapia)' },
  { motif: /thon/i, aliment: 'Thon en conserve' },
  { motif: /crevette/i, aliment: 'Crevettes' },
  { motif: /tofu|tempeh/i, aliment: 'Tofu, tempeh' },
  {
    motif: /pois chiches|lentille|l[ée]gumineuse|haricots (blancs|rouges|noirs)/i,
    aliment: 'Légumineuses (pois chiches, lentilles)'
  },
  { motif: /amande|noix de grenoble|noix/i, aliment: 'Amandes, noix de Grenoble' },
  { motif: /beurre d.arachide/i, aliment: 'Beurre d’arachide naturel' },
  { motif: /tahini/i, aliment: 'Tahini' }
]

/** Poids d'un œuf moyen, calibre « gros ». Sert à convertir « 3 œufs ». */
const POIDS_OEUF_G = 50

/**
 * Protéines d'une mesure de supplément, quand la dose n'est pas écrite.
 *
 * Une mesure de whey du commerce fait 30 g de poudre à ~80 % de protéines. Ce
 * chiffre est une HYPOTHÈSE — la seule du module — et toute ligne qui s'en sert
 * ressort avec `hypothese: true` pour que l'écran puisse le dire.
 */
const PROTEINES_PAR_MESURE_G = 24

/** « 180 g », « 1 filet, 150 g », « 250g » — un poids et sa position. */
const POIDS = /(\d+)\s*g\b/gi
/** « 3 œufs », « 2 oeufs ». */
const OEUFS = /(\d+)\s*(?:œufs?|oeufs?)/gi
/** Une mesure de supplément protéiné, sans dose chiffrée. */
const MESURE_WHEY = /(\d+)?\s*mesures?\s+de\s+prot[ée]ine|whey|cas[ée]ine|isolat/i

/** Un aliment pesé, reconnu ou non. */
export interface PortionPesee {
  /** L'intitulé de la table de composition, ou le texte brut si inconnu. */
  aliment: string
  grammes: number
  /** Protéines apportées, `null` si l'aliment n'est pas dans la table. */
  proteinesG: number | null
}

export interface ProteinesRepas {
  /** Total calculé, arrondi au gramme. */
  totalG: number
  /** Le détail, pour que Marie voie d'où vient le chiffre. */
  portions: PortionPesee[]
  /** Textes pesés dont l'aliment est inconnu — le total les ignore. */
  inconnus: string[]
  /** Vrai si une mesure de supplément a été comptée sans dose écrite. */
  hypothese: boolean
}

/** Retire accents et casse, pour comparer du texte écrit à la main. */
function normalise(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * L'aliment auquel se rapporte un poids : on lit à REBOURS depuis le poids.
 *
 * « salade de lentilles au poulet grillé (180 g) » — deux aliments connus dans
 * la même phrase, et c'est le poulet qui est pesé parce qu'il est le plus
 * proche des parenthèses. Prendre le premier motif rencontré donnerait les
 * lentilles, et un chiffre faux.
 */
function alimentAvant(texte: string, positionDuPoids: number): string | null {
  const avant = normalise(texte.slice(0, positionDuPoids))
  let gagnant: { aliment: string; index: number; prioritaire: boolean } | null = null
  for (const { motif, aliment, prioritaire } of SYNONYMES) {
    const global = new RegExp(motif.source, 'gi')
    let m: RegExpExecArray | null
    let dernier = -1
    while ((m = global.exec(avant)) !== null) dernier = m.index
    if (dernier === -1) continue
    // Une correspondance prioritaire l'emporte sur une ordinaire, où qu'elle
    // soit ; entre égales, c'est la plus proche du poids qui gagne.
    const bat = gagnant === null
      ? true
      : !!prioritaire !== gagnant.prioritaire
        ? !!prioritaire
        : dernier > gagnant.index
    if (bat) gagnant = { aliment, index: dernier, prioritaire: !!prioritaire }
  }
  return gagnant ? gagnant.aliment : null
}

/**
 * Le texte juste avant un poids, pour nommer un aliment inconnu à l'écran.
 *
 * La parenthèse ouvrante du poids est retirée AVANT le découpage : sans ça
 * « dorade au four aux olives (180 g) » se coupait sur cette parenthèse et ne
 * laissait qu'une chaîne vide — Marie lisait « (portion pesée) » au lieu du nom
 * de l'aliment qu'on lui demande de vérifier.
 */
function extraitAvant(texte: string, position: number): string {
  const bout = texte
    .slice(Math.max(0, position - 48), position)
    .replace(/[\s(]+$/, '')
  const mots = bout.split(/[,:]/).pop() ?? bout
  return mots.trim().replace(/\s+/g, ' ') || 'portion pesée'
}

function proteinesDe(aliment: string, grammes: number, table: TableMacros): number | null {
  const m: MacrosPour100g | undefined = table[aliment]
  return m ? (m.p * grammes) / 100 : null
}

/**
 * Calcule les protéines d'UNE ligne de repas.
 *
 * @param ligne « Dîner : salade de poulet grillé (180 g), quinoa, concombre »
 * @param table composition à utiliser — celle du code par défaut, ou celle que
 *              Marie a ajustée dans les Paramètres
 */
export function proteinesDeLigne(
  ligne: string,
  table: TableMacros = MACROS_PAR_100G
): ProteinesRepas {
  const portions: PortionPesee[] = []
  const inconnus: string[] = []
  let hypothese = false

  // ── Poids explicites ──────────────────────────────────────────────────────
  for (const m of ligne.matchAll(POIDS)) {
    const grammes = Number(m[1])
    const position = m.index ?? 0
    const aliment = alimentAvant(ligne, position)
    if (!aliment) {
      inconnus.push(`${extraitAvant(ligne, position)} (${grammes} g)`)
      portions.push({ aliment: extraitAvant(ligne, position), grammes, proteinesG: null })
      continue
    }
    portions.push({ aliment, grammes, proteinesG: proteinesDe(aliment, grammes, table) })
  }

  // ── Ce qui se compte à l'unité ────────────────────────────────────────────
  for (const m of ligne.matchAll(OEUFS)) {
    const grammes = Number(m[1]) * POIDS_OEUF_G
    portions.push({ aliment: 'Œufs', grammes, proteinesG: proteinesDe('Œufs', grammes, table) })
  }

  // ── Supplément protéiné sans dose écrite ──────────────────────────────────
  if (MESURE_WHEY.test(ligne)) {
    const mesures = Number(/(\d+)\s*mesures?/i.exec(ligne)?.[1] ?? 1)
    hypothese = true
    portions.push({
      aliment: 'Supplément protéiné',
      grammes: 0,
      proteinesG: mesures * PROTEINES_PAR_MESURE_G
    })
  }

  const totalG = Math.round(portions.reduce((t, p) => t + (p.proteinesG ?? 0), 0))
  return { totalG, portions, inconnus, hypothese }
}

/** Le même calcul sur une journée entière (ses lignes de repas). */
export function proteinesDeJournee(
  lignes: string[],
  table: TableMacros = MACROS_PAR_100G
): ProteinesRepas {
  const parRepas = lignes.map(l => proteinesDeLigne(l, table))
  return {
    totalG: parRepas.reduce((t, r) => t + r.totalG, 0),
    portions: parRepas.flatMap(r => r.portions),
    inconnus: parRepas.flatMap(r => r.inconnus),
    hypothese: parRepas.some(r => r.hypothese)
  }
}
