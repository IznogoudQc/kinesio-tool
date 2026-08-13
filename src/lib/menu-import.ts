/**
 * Relecture d'un menu produit AILLEURS.
 *
 * Le bouton « Copier le prompt » permet d'essayer la consigne dans un autre
 * modèle. Sans chemin de retour, il fallait recopier sept journées à la main.
 * Ce module relit la réponse et la rend au champ de saisie.
 *
 * ── Pourquoi être tolérant ──────────────────────────────────────────────────
 *
 * La consigne exige du JSON strict, et l'API le respecte. Une interface de
 * conversation, elle, ajoute presque toujours quelque chose autour : une phrase
 * d'introduction, un bloc ```json, un « Voici le menu : ». Refuser pour cette
 * raison ferait porter à Marie un nettoyage qui n'a aucun intérêt clinique.
 *
 * La tolérance s'arrête à la FORME. Le contenu n'est jamais deviné : une
 * journée absente reste vide, elle n'est pas complétée par une autre.
 */

/** Le résultat d'une relecture : des journées, et ce qu'il faut signaler. */
export interface MenuImporte {
  /** Une entrée par journée, dans l'ordre. Chaîne vide = journée non fournie. */
  journees: string[]
  /** Ce qui mérite un mot à l'écran — jamais bloquant. */
  avertissements: string[]
}

export type ResultatImport = { ok: true; menu: MenuImporte } | { ok: false; erreur: string }

/** En-tête que la consigne interdit, mais qu'une IA ajoute parfois quand même. */
const ENTETE_JOURNEE = /^journée\s*\d+\s*[:.\-–—]?\s*/i

/** Isole l'objet JSON d'un texte qui peut être entouré de prose ou de ```json. */
function extraireJson(texte: string): unknown {
  const t = texte.trim()
  if (!t) throw new Error('vide')
  // Le premier { ou [ et son dernier partenaire : couvre le bloc de code, la
  // phrase d'introduction, et les deux à la fois.
  const debuts = [t.indexOf('{'), t.indexOf('[')].filter(i => i !== -1)
  if (!debuts.length) throw new Error('pas de json')
  const debut = Math.min(...debuts)
  const fin = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  if (fin < debut) throw new Error('pas de json')
  return JSON.parse(t.slice(debut, fin + 1))
}

/** Les lignes d'une journée, quelle que soit la forme reçue. */
function lignesDe(journee: unknown): string[] | null {
  const brut = Array.isArray(journee)
    ? journee
    : journee && typeof journee === 'object' && Array.isArray((journee as { lignes?: unknown }).lignes)
      ? (journee as { lignes: unknown[] }).lignes
      : null
  if (!brut) return null
  return brut
    .filter((l): l is string => typeof l === 'string')
    .map(l => l.trim().replace(ENTETE_JOURNEE, '').trim())
    .filter(Boolean)
}

/** Les journées d'une réponse, que l'objet soit enveloppé ou non. */
function journeesDe(donnees: unknown): unknown[] | null {
  if (Array.isArray(donnees)) return donnees
  if (donnees && typeof donnees === 'object') {
    const j = (donnees as { journees?: unknown }).journees
    if (Array.isArray(j)) return j
  }
  return null
}

/**
 * Relit un menu collé ou lu dans un fichier.
 *
 * @param texte    la réponse brute, telle que reçue
 * @param nbJours  le nombre de journées du menu (7 aujourd'hui)
 * @param nbLignes le nombre de repas attendus par journée — sert seulement à
 *                 signaler un écart, jamais à rejeter
 */
export function importerMenu(texte: string, nbJours: number, nbLignes?: number): ResultatImport {
  let donnees: unknown
  try {
    donnees = extraireJson(texte)
  } catch {
    return {
      ok: false,
      erreur:
        'Aucun menu lisible. Le texte doit contenir la réponse JSON du modèle — celle qui commence par « { "journees" ». Une phrase autour ne gêne pas.'
    }
  }

  const brutes = journeesDe(donnees)
  if (!brutes) {
    return { ok: false, erreur: 'Le JSON ne contient pas de liste « journees ».' }
  }

  const avertissements: string[] = []
  const lues = brutes.map(lignesDe)
  if (lues.some(l => l === null)) {
    avertissements.push('Des journées étaient illisibles et ont été laissées vides.')
  }
  if (brutes.length > nbJours) {
    avertissements.push(`${brutes.length} journées reçues : seules les ${nbJours} premières sont reprises.`)
  }

  const journees = Array.from({ length: nbJours }, (_, i) => (lues[i] ?? []).join('\n\n'))
  const remplies = journees.filter(j => j !== '').length
  if (remplies === 0) {
    return { ok: false, erreur: 'Le menu lu ne contient aucun repas.' }
  }
  if (remplies < nbJours) {
    avertissements.push(`${remplies} journée(s) sur ${nbJours} — les autres restent vides.`)
  }

  if (typeof nbLignes === 'number') {
    const ecarts = lues
      .slice(0, nbJours)
      .map((l, i) => (l && l.length && l.length !== nbLignes ? i + 1 : 0))
      .filter(Boolean)
    if (ecarts.length) {
      avertissements.push(
        `Journée(s) ${ecarts.join(', ')} : nombre de repas différent de la structure (${nbLignes} attendus). À vérifier.`
      )
    }
  }

  return { ok: true, menu: { journees, avertissements } }
}
