/**
 * Macros d'un repas, CALCULÉES à partir des poids écrits.
 *
 * ── Pourquoi calculer plutôt que demander ───────────────────────────────────
 *
 * Depuis la v0.9.182 chaque repas porte un poids sur ses TROIS sources —
 * protéines, glucides, lipides. Des poids et une table de composition suffisent
 * à faire des multiplications : le résultat est le même à chaque fois,
 * n'importe qui peut le recouper, et il ne dépend d'aucun modèle. Une
 * estimation d'IA, elle, change d'un appel à l'autre et ne se vérifie pas.
 *
 * Avant, seule la protéine était pesée : calculer les glucides aurait compté le
 * poulet et ignoré le quinoa, les lipides auraient compté la feta et ignoré
 * l'huile. Des chiffres faussement précis, plus trompeurs qu'une estimation
 * assumée. C'est ce qui a motivé le passage aux trois poids.
 *
 * ── Ce que ce module ne fait PAS ────────────────────────────────────────────
 *
 * Il ne devine rien. Un aliment pesé qu'il ne connaît pas est signalé dans
 * `inconnus`, pas remplacé par un aliment qui lui ressemble : compter une
 * dorade comme un saumon donnerait un chiffre faux avec l'air d'être juste.
 *
 * Les légumes et aromates ne sont pas pesés et ne sont donc pas comptés. C'est
 * assumé : leur apport est marginal devant celui des trois sources, et exiger
 * un poids sur le concombre rendrait les menus illisibles.
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
 * `prioritaire` gagne quel que soit l'ordre des mots ; sinon c'est la
 * correspondance la plus proche du poids qui l'emporte.
 */
const SYNONYMES: { motif: RegExp; aliment: string; prioritaire?: boolean }[] = [
  // ── Pièges d'inclusion ────────────────────────────────────────────────────
  // « hauts de cuisse de poulet » contient « poulet », qui apparaît APRÈS.
  { motif: /haut(s)? de cuisse|cuisse(s)? de poulet|pilon/i, aliment: 'Poulet, haut de cuisse', prioritaire: true },
  // « huile d'olive » contient « olive » : sans priorité, une huile serait
  // comptée comme des olives — 100 g de lipides contre 11.
  { motif: /huile d.olive|huile/i, aliment: 'Huile d’olive', prioritaire: true },
  // « beurre d'arachide » contient « arachide » mais aussi, chez certains,
  // « beurre d'amande » : les deux sont distincts et tous deux prioritaires.
  { motif: /beurre d.arachide/i, aliment: 'Beurre d’arachide naturel', prioritaire: true },
  { motif: /patate douce|patates douces/i, aliment: 'Patate douce', prioritaire: true },

  // ── Protéines ─────────────────────────────────────────────────────────────
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

  // ── Glucides ──────────────────────────────────────────────────────────────
  { motif: /quinoa/i, aliment: 'Quinoa' },
  { motif: /riz/i, aliment: 'Riz brun' },
  { motif: /p[âa]tes|spaghetti|penne|fusilli/i, aliment: 'Pâtes de blé entier' },
  { motif: /pain|pita|bagel|tortilla/i, aliment: 'Pain de blé entier, pita' },
  { motif: /couscous/i, aliment: 'Couscous de blé entier' },
  { motif: /gruau|avoine|flocons/i, aliment: 'Avoine (gruau)' },
  { motif: /orge|boulgour|bulgur/i, aliment: 'Orge, boulgour' },
  {
    motif: /petits fruits|bleuet|framboise|fraise|mangue|pomme|poire|banane|p[êe]che|orange|raisin|melon|ananas/i,
    aliment: 'Fruits frais'
  },

  // ── Lipides ───────────────────────────────────────────────────────────────
  { motif: /avocat/i, aliment: 'Avocat' },
  { motif: /olives/i, aliment: 'Olives' },
  { motif: /amande|noix de grenoble|noix|pacane|pistache/i, aliment: 'Amandes, noix de Grenoble' },
  {
    motif: /graines de tournesol|graines de citrouille|tournesol|citrouille/i,
    aliment: 'Graines de tournesol, de citrouille'
  },
  { motif: /graines de lin|lin moulu/i, aliment: 'Graines de lin moulues' },
  { motif: /tahini/i, aliment: 'Tahini' }
]

/** Poids d'un œuf moyen, calibre « gros ». Sert à convertir « 3 œufs ». */
const POIDS_OEUF_G = 50

/**
 * Protéines d'une mesure de supplément, quand la dose n'est pas écrite.
 *
 * Une mesure de whey du commerce fait 30 g de poudre à ~80 % de protéines. Ce
 * chiffre est une HYPOTHÈSE — la seule du module — et toute ligne qui s'en sert
 * ressort avec `hypothese: true` pour que l'écran puisse le dire. Les glucides
 * et lipides d'un isolat sont négligeables et ne sont pas comptés.
 */
const PROTEINES_PAR_MESURE_G = 24

/** Densité de l'huile : « 15 ml » d'huile pèsent moins de 15 g. */
const DENSITE_HUILE = 0.92

/** « 180 g », « 250g », et les millilitres d'une huile. */
const POIDS = /(\d+)\s*(g|ml)\b/gi
/** « 3 œufs », « 2 oeufs ». */
const OEUFS = /(\d+)\s*(?:œufs?|oeufs?)/gi
/** Une mesure de supplément protéiné, sans dose chiffrée. */
const MESURE_WHEY = /(\d+)?\s*mesures?\s+de\s+prot[ée]ine|whey|cas[ée]ine|isolat/i

/** Un aliment pesé, reconnu ou non. */
export interface PortionPesee {
  /** L'intitulé de la table de composition, ou le texte brut si inconnu. */
  aliment: string
  grammes: number
  /** Ce que la portion apporte, `null` si l'aliment n'est pas dans la table. */
  macros: MacrosPour100g | null
}

export interface MacrosRepas {
  /** Protéines, glucides nets et lipides (g), arrondis. */
  p: number
  g: number
  l: number
  /** Calories, dérivées des trois par les facteurs d'Atwater (4 / 4 / 9). */
  kcal: number
  /** Le détail, pour que Marie voie d'où vient le chiffre. */
  portions: PortionPesee[]
  /** Textes pesés dont l'aliment est inconnu — les totaux les ignorent. */
  inconnus: string[]
  /**
   * Aliments connus MENTIONNÉS mais sans poids — donc non comptés.
   *
   * Sans cette liste, un menu écrit avant la v0.9.182 (poids sur la seule
   * protéine) sous-comptait en silence : le quinoa et l'huile disparaissaient
   * des totaux, et 1400 kcal s'affichaient comme 470. Un chiffre trop bas sans
   * explication est pire qu'un chiffre absent.
   */
  nonPeses: string[]
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
    const bat =
      gagnant === null
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
 * laissait qu'une chaîne vide.
 */
function extraitAvant(texte: string, position: number): string {
  const bout = texte.slice(Math.max(0, position - 48), position).replace(/[\s(]+$/, '')
  const mots = bout.split(/[,:]/).pop() ?? bout
  return mots.trim().replace(/\s+/g, ' ') || 'portion pesée'
}

/** Ce qu'apporte `grammes` d'un aliment, ou `null` s'il est inconnu. */
function apport(aliment: string, grammes: number, table: TableMacros): MacrosPour100g | null {
  const m = table[aliment]
  if (!m) return null
  return { p: (m.p * grammes) / 100, g: (m.g * grammes) / 100, l: (m.l * grammes) / 100 }
}

/**
 * Calcule les macros d'UNE ligne de repas.
 *
 * @param ligne « Dîner : poulet grillé (150 g), quinoa (150 g), huile (15 ml) »
 * @param table composition à utiliser — celle du code par défaut, ou celle que
 *              Marie a ajustée dans les Paramètres
 */
export function macrosDeLigne(ligne: string, table: TableMacros = MACROS_PAR_100G): MacrosRepas {
  const portions: PortionPesee[] = []
  const inconnus: string[] = []
  let hypothese = false

  // ── Poids explicites ──────────────────────────────────────────────────────
  for (const m of ligne.matchAll(POIDS)) {
    const position = m.index ?? 0
    const aliment = alimentAvant(ligne, position)
    // Les millilitres ne pèsent des grammes que pour l'eau. L'huile, seul
    // liquide vraiment pesé dans un menu, fait 0,92 g/ml.
    const estMl = m[2].toLowerCase() === 'ml'
    const brut = Number(m[1])
    const grammes = Math.round(estMl && aliment === 'Huile d’olive' ? brut * DENSITE_HUILE : brut)
    if (!aliment) {
      inconnus.push(`${extraitAvant(ligne, position)} (${brut} ${m[2]})`)
      portions.push({ aliment: extraitAvant(ligne, position), grammes, macros: null })
      continue
    }
    portions.push({ aliment, grammes, macros: apport(aliment, grammes, table) })
  }

  // ── Ce qui se compte à l'unité ────────────────────────────────────────────
  for (const m of ligne.matchAll(OEUFS)) {
    const grammes = Number(m[1]) * POIDS_OEUF_G
    portions.push({ aliment: 'Œufs', grammes, macros: apport('Œufs', grammes, table) })
  }

  // ── Supplément protéiné sans dose écrite ──────────────────────────────────
  if (MESURE_WHEY.test(ligne)) {
    const mesures = Number(/(\d+)\s*mesures?/i.exec(ligne)?.[1] ?? 1)
    hypothese = true
    portions.push({
      aliment: 'Supplément protéiné',
      grammes: 0,
      macros: { p: mesures * PROTEINES_PAR_MESURE_G, g: 0, l: 0 }
    })
  }

  // ── Ce qui est nommé mais pas pesé ────────────────────────────────────────
  const comptes = new Set(portions.map(x => x.aliment))
  const norm = normalise(ligne)
  const nonPeses = [
    ...new Set(
      SYNONYMES.filter(s => !comptes.has(s.aliment) && new RegExp(s.motif.source, 'i').test(norm))
        .map(s => s.aliment)
    )
  ]

  const somme = (cle: 'p' | 'g' | 'l') =>
    Math.round(portions.reduce((t, x) => t + (x.macros?.[cle] ?? 0), 0))
  const p = somme('p')
  const g = somme('g')
  const l = somme('l')
  // Facteurs d'Atwater : 4 kcal par gramme de protéines et de glucides, 9 par
  // gramme de lipides. Les calories ne sont donc pas une mesure de plus mais
  // une conséquence des trois — elles ne peuvent pas les contredire.
  return { p, g, l, kcal: Math.round(4 * p + 4 * g + 9 * l), portions, inconnus, nonPeses, hypothese }
}

/** Le même calcul sur une journée entière (ses lignes de repas). */
export function macrosDeJournee(lignes: string[], table: TableMacros = MACROS_PAR_100G): MacrosRepas {
  const parRepas = lignes.map(l => macrosDeLigne(l, table))
  const somme = (cle: 'p' | 'g' | 'l' | 'kcal') => parRepas.reduce((t, r) => t + r[cle], 0)
  return {
    p: somme('p'),
    g: somme('g'),
    l: somme('l'),
    kcal: somme('kcal'),
    portions: parRepas.flatMap(r => r.portions),
    inconnus: parRepas.flatMap(r => r.inconnus),
    nonPeses: [...new Set(parRepas.flatMap(r => r.nonPeses))],
    hypothese: parRepas.some(r => r.hypothese)
  }
}
