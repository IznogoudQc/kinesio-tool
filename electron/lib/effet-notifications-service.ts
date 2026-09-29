import { app, Notification, shell } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import log from 'electron-log'
import { readBooleanSetting, readSetting, writeBooleanSetting, writeSetting } from './settings-store'
import {
  cleEffet,
  EFFET_RACINE,
  enregistrerCleEffet,
  journaliserEchec,
  recupererFils,
  sourceCleEffet,
  type SourceCle
} from './effet-api'
import {
  construireNotification,
  filsANotifier,
  nonLusParCourriel,
  lireEtatVu,
  majEtatVu,
  type EtatVu
} from '../../src/lib/effet-notifications'

/**
 * Prévient Marie sur son bureau quand une cliente lui écrit dans Effet.
 *
 * Elle travaille dans Kinésio Outils toute la journée et n'ouvre Effet que
 * pour répondre : sans cette veille, un message pouvait attendre des heures.
 *
 * Ce module porte les effets — le réseau, le disque, la notification. Les
 * décisions (quoi annoncer, quoi mémoriser) vivent dans
 * `src/lib/effet-notifications.ts`, où elles se testent sans Electron.
 *
 * RAPPEL : aucun texte de message ne passe par ici. Ni notification, ni
 * journal, ni fichier d'état.
 */

/** Entre 2 et 3 minutes, comme demandé. 150 s tombe au milieu. */
const PERIODE_MS = 150_000
/** Laisse l'application démarrer avant la première interrogation. */
const DELAI_DEMARRAGE_MS = 15_000

const CLE_ACTIVE = 'effet.notifications.actives'
const CLE_DERNIERE_VERIF = 'effet.notifications.derniereVerification'

/** Le fichier d'état voisine avec les autres données de l'outil. */
function cheminEtat(): string {
  return join(app.getPath('userData'), 'effet-fils-vus.json')
}

/**
 * Vrai tant que la clé en place n'a pas été refusée.
 *
 * Un 401 ne se corrige pas tout seul : rejouer l'échec toutes les deux minutes
 * ne ferait que remplir le journal. On s'arrête donc jusqu'à ce qu'une nouvelle
 * clé soit saisie dans Paramètres (ou au prochain lancement).
 */
let cleUtilisable = true
let minuterie: NodeJS.Timeout | null = null

/**
 * Messages non lus par courriel de cliente, pour la pastille de la liste des
 * clients. Remis à jour à chaque vérification aboutie.
 *
 * Que des nombres : aucun texte de message, aucun nom. Volontairement en
 * mémoire et non sur le disque — la liste se rafraîchit à son ouverture, et un
 * compte périmé survivant à un redémarrage vaudrait moins que pas de compte.
 */
let nonLus: Record<string, number> = {}

async function lireEtat(): Promise<EtatVu> {
  try {
    return lireEtatVu(JSON.parse(await readFile(cheminEtat(), 'utf-8')))
  } catch {
    // Fichier absent au premier lancement, ou illisible : on repart de zéro.
    // Conséquence assumée : les fils en cours seront mémorisés sans être
    // annoncés, puisque la première vérification enregistre tout ce qu'elle voit.
    return {}
  }
}

async function ecrireEtat(etat: EtatVu): Promise<void> {
  try {
    await writeFile(cheminEtat(), JSON.stringify(etat, null, 2), 'utf-8')
  } catch (err) {
    log.error('[effet] impossible d’écrire l’état des fils vus', err instanceof Error ? err.message : err)
  }
}

/** Une vérification. Retourne `true` si elle a abouti — l'heure n'avance que
 *  dans ce cas, sinon l'interface mentirait sur la fraîcheur des données. */
async function verifierUneFois(): Promise<boolean> {
  if (!cleUtilisable) return false

  // Pas de clé : on se tait. La carte de Paramètres le dit déjà, et une ligne
  // de journal toutes les 150 s n'apprendrait rien de plus.
  const cle = cleEffet()
  if (!cle) return false

  const resultat = await recupererFils(cle)

  if (!resultat.ok) {
    if (resultat.raison === 'veille') {
      // La base dort : ce n'est pas une panne. Rien à annoncer, et surtout on
      // ne touche pas à l'état — l'effacer ferait renotifier au réveil.
      return false
    }
    if (resultat.raison === 'cle_invalide') {
      log.error('[effet] la clé d’accès est refusée — veille interrompue jusqu’à une nouvelle clé')
      cleUtilisable = false
      return false
    }
    journaliserEchec('réseau', resultat.detail)
    return false
  }

  const vu = await lireEtat()
  const aNotifier = filsANotifier(resultat.fils, vu)

  // Les non-lus par courriel, gardés en mémoire pour la liste des clients. En
  // mémoire seulement : la liste se rafraîchit à son ouverture, et écrire ces
  // comptes sur le disque n'ajouterait qu'un fichier à tenir à jour.
  nonLus = nonLusParCourriel(resultat.fils)

  // L'heure de vérification avance même quand l'interrupteur est coupé : Marie
  // doit pouvoir distinguer « personne ne m'a écrit » de « ça ne marche plus ».
  writeSetting(CLE_DERNIERE_VERIF, new Date().toISOString())

  if (aNotifier.length > 0) {
    // On mémorise AVANT d'afficher : si la notification échoue, on préfère une
    // annonce manquée à la même annonce répétée toutes les deux minutes.
    await ecrireEtat(majEtatVu(vu, resultat.fils))

    if (readBooleanSetting(CLE_ACTIVE, true)) {
      afficher(aNotifier)
    } else {
      log.info(`[effet] ${aNotifier.length} fil(s) en attente — notifications coupées`)
    }
  } else {
    // Rien à annoncer, mais on enregistre quand même : les messages écrits par
    // la coach elle-même doivent être marqués comme vus, sinon la première
    // réponse de la cliente rejouerait tout l'échange.
    await ecrireEtat(majEtatVu(vu, resultat.fils))
  }

  return true
}

/** Affiche la notification et câble le clic. */
function afficher(aNotifier: ReturnType<typeof filsANotifier>): void {
  const contenu = construireNotification(aNotifier)
  if (!contenu) return
  if (!Notification.isSupported()) {
    log.info('[effet] notifications non supportées sur ce poste')
    return
  }

  // `contenu.corps` ne porte qu'un prénom ou un décompte — jamais un message.
  const notification = new Notification({ title: contenu.titre, body: contenu.corps })
  notification.on('click', () => {
    void shell.openExternal(`${EFFET_RACINE}${contenu.chemin}`)
  })
  notification.show()
  log.info(`[effet] ${aNotifier.length} fil(s) annoncé(s)`)
}

/** Démarre la veille. Appelé une fois, au lancement de l'application. */
export function demarrerVeilleEffet(): void {
  if (minuterie) return
  setTimeout(() => void verifierUneFois(), DELAI_DEMARRAGE_MS)
  minuterie = setInterval(() => void verifierUneFois(), PERIODE_MS)
}

export function arreterVeilleEffet(): void {
  if (minuterie) clearInterval(minuterie)
  minuterie = null
}

export interface EtatVeille {
  /** L'interrupteur de l'interface. */
  actives: boolean
  /** ISO de la dernière vérification ABOUTIE, ou `null` si aucune encore. */
  derniereVerification: string | null
  /** Vrai si une clé est en usage, qu'elle vienne de Paramètres ou du `.env`. */
  cleConfiguree: boolean
  /** Sa provenance : `env` n'arrive que sur le poste de développement. */
  cleSource: SourceCle
  /** Faux quand aucune clé n'est configurée ou qu'elle a été refusée : sans
   *  cela, une heure qui n'avance plus resterait inexplicable. */
  operationnelle: boolean
}

export function etatVeille(): EtatVeille {
  const cleSource = sourceCleEffet()
  const cleConfiguree = cleSource !== null
  return {
    actives: readBooleanSetting(CLE_ACTIVE, true),
    derniereVerification: readSetting(CLE_DERNIERE_VERIF),
    cleConfiguree,
    cleSource,
    operationnelle: cleUtilisable && cleConfiguree
  }
}

/**
 * Enregistre (ou efface, si vide) la clé saisie dans Paramètres.
 *
 * Une nouvelle clé lève le verrou posé par un 401 et déclenche une vérification
 * immédiate : Marie voit tout de suite si la clé est acceptée.
 */
export async function definirCleEffet(cle: string): Promise<EtatVeille> {
  enregistrerCleEffet(cle)
  cleUtilisable = true
  if (cleEffet()) await verifierUneFois()
  return etatVeille()
}

/** Coupe ou rétablit les notifications. Le sondage, lui, continue : l'heure de
 *  dernière vérification doit avancer même pendant une séance. */
export function definirNotificationsActives(actives: boolean): void {
  writeBooleanSetting(CLE_ACTIVE, actives)
  log.info(`[effet] notifications ${actives ? 'activées' : 'coupées'}`)
}

/**
 * Messages non lus par courriel — pour la pastille de la liste des clients.
 *
 * Lu à l'ouverture de la liste. Rien n'est poussé vers l'interface : une
 * pastille qui apparaît d'elle-même pendant que Marie lit son écran n'apportait
 * pas assez pour justifier le câblage d'un événement.
 *
 * Vide tant qu'aucune vérification n'a abouti — donc aucune pastille, plutôt
 * que des pastilles fausses.
 */
export function nonLusParClient(): Record<string, number> {
  return { ...nonLus }
}

/** Pour le bouton « Vérifier maintenant » de l'interface. */
export async function verifierMaintenant(): Promise<EtatVeille> {
  await verifierUneFois()
  return etatVeille()
}
