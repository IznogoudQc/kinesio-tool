import { safeStorage } from 'electron'
import log from 'electron-log'
import { readSetting, writeSetting } from './settings-store'
import type { FilCoach } from '../../src/lib/effet-notifications'

/**
 * Le peu d'API d'Effet dont Kinésio Outils a besoin : savoir si une cliente a
 * écrit. Rien n'est envoyé vers Effet, on ne fait que lire.
 *
 * La clé d'accès ne transite que dans l'en-tête `Authorization`. Elle n'est
 * jamais journalisée, jamais renvoyée à l'interface, jamais incluse dans un
 * message d'erreur — d'où les messages volontairement vagues plus bas.
 */

const BASE = 'https://kinesio-effet.fly.dev/api'
export const EFFET_RACINE = 'https://kinesio-effet.fly.dev'

/** Délai au-delà duquel on abandonne : Fly.io réveille ses machines à froid,
 *  mais si rien ne vient en 20 s, mieux vaut réessayer au tour suivant. */
const DELAI_MS = 20_000

/**
 * Résultat d'une interrogation.
 *
 * `veille` et `cle_invalide` sont distingués du reste parce qu'ils appellent
 * une conduite précise : la première n'est pas une panne, la seconde ne sert à
 * rien de réessayer.
 */
export type ResultatFils =
  | { ok: true; fils: FilCoach[] }
  | { ok: false; raison: 'veille' }
  | { ok: false; raison: 'cle_invalide' }
  | { ok: false; raison: 'reseau'; detail: string }

/** Réglage où dort la clé, chiffrée, en base64. */
const CLE_REGLAGE = 'effet.cle'

/**
 * La clé d'accès à Effet, saisie par Marie dans Paramètres.
 *
 * Chiffrée par `safeStorage` (DPAPI sous Windows) : le blob en base ne se lit
 * qu'avec la session Windows qui l'a écrit. Une sauvegarde restaurée sur un
 * autre poste le rend illisible — on retombe alors sur « pas de clé », et
 * Marie la ressaisit.
 *
 * Retourne `null` si rien n'est configuré — l'appelant se tait alors, plutôt
 * que de sonder une API qui refusera de toute façon.
 */
export function cleEffet(): string | null {
  const blob = readSetting(CLE_REGLAGE)
  if (!blob) return null
  try {
    const cle = safeStorage.decryptString(Buffer.from(blob, 'base64')).trim()
    return cle.length > 0 ? cle : null
  } catch {
    log.warn('[effet] clé enregistrée illisible sur ce poste — à ressaisir')
    return null
  }
}

/**
 * Enregistre la clé, ou l'efface si `cle` est vide.
 *
 * Lève si le chiffrement n'est pas disponible : mieux vaut pas de clé qu'une
 * clé en clair dans la base.
 */
export function enregistrerCleEffet(cle: string): void {
  const propre = cle.trim()
  if (propre.length === 0) {
    writeSetting(CLE_REGLAGE, '')
    log.info('[effet] clé effacée')
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Le chiffrement du système n’est pas disponible : la clé n’a pas été enregistrée.')
  }
  writeSetting(CLE_REGLAGE, safeStorage.encryptString(propre).toString('base64'))
  log.info('[effet] clé enregistrée')
}

/** Ce que renvoie l'API, avant qu'on lui fasse confiance. */
function estFil(v: unknown): v is FilCoach {
  if (!v || typeof v !== 'object') return false
  const f = v as Record<string, unknown>
  return typeof f['clientId'] === 'string' && typeof f['nom'] === 'string' && typeof f['nonLus'] === 'number'
}

/**
 * `GET /coach/fils` — la liste des fils, déjà triée par Effet.
 *
 * On interroge cette route plutôt que le simple compte de non-lus : la
 * notification a besoin du nom de la cliente et du compte par fil, que le
 * compte global ne donne pas.
 */
export async function recupererFils(cle: string): Promise<ResultatFils> {
  const controleur = new AbortController()
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MS)
  try {
    const reponse = await fetch(`${BASE}/coach/fils`, {
      headers: { Authorization: `Bearer ${cle}`, Accept: 'application/json' },
      signal: controleur.signal
    })

    if (reponse.status === 401) return { ok: false, raison: 'cle_invalide' }

    if (reponse.status === 503) {
      // La base dort. Le corps porte `{ code: 'base_en_veille' }` ; on se
      // contente du 503 si le corps est illisible, la conduite est la même.
      const corps = (await reponse.json().catch(() => null)) as { code?: string } | null
      if (!corps || corps.code === 'base_en_veille') return { ok: false, raison: 'veille' }
      return { ok: false, raison: 'reseau', detail: 'HTTP 503' }
    }

    if (!reponse.ok) return { ok: false, raison: 'reseau', detail: `HTTP ${reponse.status}` }

    const donnees: unknown = await reponse.json()
    if (!Array.isArray(donnees)) return { ok: false, raison: 'reseau', detail: 'réponse inattendue' }
    return { ok: true, fils: donnees.filter(estFil) }
  } catch (err) {
    // Le message d'une erreur réseau peut contenir l'URL, jamais l'en-tête :
    // il n'y a donc pas de clé à fuiter ici. On reste tout de même succinct.
    const detail = err instanceof Error ? err.name : 'erreur inconnue'
    return { ok: false, raison: 'reseau', detail }
  } finally {
    clearTimeout(minuterie)
  }
}

/** Journalise sans jamais écrire la clé ni un contenu de message. */
export function journaliserEchec(raison: string, detail?: string): void {
  log.info(`[effet] vérification sans résultat : ${raison}${detail ? ` (${detail})` : ''}`)
}
