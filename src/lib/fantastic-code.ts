/**
 * Code de retour du questionnaire FANTASTIC.
 *
 * Le client remplit le formulaire HTML qu'on lui a envoyé, puis renvoie ses
 * réponses à Marie-Eve. Comme l'application est **entièrement locale** — pas de
 * serveur, pas de portail — il faut un format qui traverse un courriel.
 *
 * ── Pourquoi un code et pas du JSON encodé ──────────────────────────────────
 * Chaque réponse tient sur un chiffre (0-4). Vingt-cinq énoncés, c'est donc
 * vingt-cinq caractères. Un client sur téléphone peut recopier ça dans une
 * réponse de courriel ; il ne peut pas recopier trois cents caractères de
 * base64, et il n'arrivera pas toujours à joindre un fichier.
 *
 *     FT1 4321043210432104321043210 7A
 *     ─┬─ ────────────┬──────────── ─┬
 *      │              │              └── contrôle
 *      │              └── 25 réponses, « - » si non répondu
 *      └── format + version
 *
 * ── Pourquoi un caractère de contrôle ───────────────────────────────────────
 * Un code recopié à la main peut perdre un chiffre ou en intervertir deux. Sans
 * contrôle, l'import réussirait quand même et écrirait de mauvaises réponses
 * dans le dossier du client — une erreur *silencieuse*, la pire espèce. Le
 * contrôle transforme ça en refus visible.
 *
 * Module PUR — partagé tel quel par l'application et par le formulaire HTML
 * autonome, pour que les deux côtés ne puissent pas diverger.
 */

import { FANTASTIC_KEYS, emptyFantastic, type FantasticAnswers } from './fantastic.ts'

/** Préfixe + version du format. Incrémenter si l'encodage change. */
export const CODE_PREFIX = 'FT1'

/** Marque une réponse absente dans le code. */
const VIDE = '-'

/** Alphabet du caractère de contrôle — 32 valeurs, sans I/O/0/1 (confusions). */
const CTRL_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/**
 * Somme de contrôle sur deux caractères.
 *
 * Chaque position est pondérée par son rang, ce qui rend l'inversion de deux
 * chiffres voisins détectable — une simple somme ne la verrait pas.
 */
function checksum(body: string): string {
  let a = 0
  let b = 0
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i)
    a = (a + c * (i + 1)) % 1024
    b = (b + a) % 1024
  }
  return CTRL_ALPHABET[a % 32] + CTRL_ALPHABET[b % 32]
}

/** Encode des réponses en code de retour. */
export function encodeFantasticCode(answers: FantasticAnswers): string {
  let body = ''
  for (const k of FANTASTIC_KEYS) {
    const v = answers[k]
    body += typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4 ? String(v) : VIDE
  }
  return CODE_PREFIX + body + checksum(CODE_PREFIX + body)
}

export type DecodeResult =
  | { ok: true; answers: FantasticAnswers; answered: number }
  | { ok: false; reason: string }

/**
 * Décode un code de retour.
 *
 * Tolérant sur la **forme** — espaces, tirets de mise en page, minuscules, tout
 * ce qu'un client de messagerie peut ajouter en repliant les lignes — et strict
 * sur le **fond** : un contenu douteux est refusé plutôt qu'importé à moitié.
 */
export function decodeFantasticCode(raw: string): DecodeResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'Aucun code fourni.' }

  // On retire tout ce qui n'est ni un chiffre, ni une lettre, ni le marqueur de
  // réponse absente : espaces, retours de ligne, tirets longs insérés par les
  // messageries. Le « - » de VIDE est conservé.
  const clean = raw
    .trim()
    .toUpperCase()
    .replace(/[\s–—_.]/g, '')

  if (clean === '') return { ok: false, reason: 'Aucun code fourni.' }
  if (!clean.startsWith(CODE_PREFIX)) {
    return { ok: false, reason: 'Ce n’est pas un code de questionnaire FANTASTIC (il doit commencer par FT1).' }
  }

  const attendu = CODE_PREFIX.length + FANTASTIC_KEYS.length + 2
  if (clean.length !== attendu) {
    const ecart = clean.length < attendu ? 'incomplet' : 'trop long'
    return {
      ok: false,
      reason: `Code ${ecart} : ${clean.length} caractères au lieu de ${attendu}. Il a probablement été tronqué à la copie.`
    }
  }

  const body = clean.slice(0, CODE_PREFIX.length + FANTASTIC_KEYS.length)
  const ctrl = clean.slice(-2)
  if (checksum(body) !== ctrl) {
    return { ok: false, reason: 'Code invalide — un caractère a été modifié à la copie. Redemandez-le au client.' }
  }

  const answers = emptyFantastic()
  let answered = 0
  const chiffres = body.slice(CODE_PREFIX.length)
  for (let i = 0; i < FANTASTIC_KEYS.length; i++) {
    const c = chiffres[i]
    if (c === VIDE) continue
    if (c < '0' || c > '4') {
      return { ok: false, reason: `Réponse illisible à l’énoncé ${i + 1}.` }
    }
    answers[FANTASTIC_KEYS[i]] = Number(c)
    answered++
  }

  if (answered === 0) return { ok: false, reason: 'Ce code ne contient aucune réponse.' }
  return { ok: true, answers, answered }
}

/** Découpe le code en groupes de 5 pour l'affichage — plus facile à recopier. */
export function formatCodeForDisplay(code: string): string {
  return (code.match(/.{1,5}/g) ?? [code]).join(' ')
}
