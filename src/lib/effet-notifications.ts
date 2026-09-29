/**
 * Décide ce qu'il faut annoncer à Marie quand une cliente écrit dans Effet.
 *
 * Volontairement sans Electron ni réseau : tout ce qui décide vit ici et se
 * teste en `node --test`, le processus principal ne garde que les effets
 * (sonder, notifier, écrire le fichier d'état).
 *
 * ── LA RÈGLE QUI PRIME ──────────────────────────────────────────────────────
 * Le TEXTE d'un message ne sort jamais d'ici. Ni dans la notification, ni dans
 * le journal, ni dans l'état gardé sur le disque. Marie reçoit ses clientes
 * dans la même pièce que son écran : afficher les mots de l'une devant l'autre
 * est inacceptable. Le champ `apercu` arrive dans la réponse de l'API et
 * s'arrête à la frontière de ce module — `filsANotifier` le retire, et aucune
 * fonction n'en construit de texte.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Un fil de discussion tel que le renvoie `GET /coach/fils`. */
export interface FilCoach {
  clientId: string
  /**
   * Courriel de la cliente chez Effet — la seule jointure possible avec les
   * clients de Kinésio Outils : les identifiants sont propres à chaque base et
   * les noms diffèrent (« Marie » là-bas, « Marie-Eve Riendeau » ici).
   *
   * `NOT NULL` dans le schéma d'Effet, donc toujours une chaîne. Typé
   * facultatif malgré tout : une version d'Effet antérieure à l'ajout du champ
   * ne doit pas faire tomber la veille.
   */
  email?: string
  nom: string
  /** ISO 8601 du dernier message, ou `null` si le fil est vide. */
  derniere: string | null
  /** Texte du dernier message. NE DOIT JAMAIS RESSORTIR DE CE MODULE. */
  apercu: string | null
  auteurDernier: 'cliente' | 'coach' | null
  nonLus: number
}

/** Un fil jugé digne d'une notification, débarrassé de tout contenu. */
export interface FilANotifier {
  clientId: string
  nom: string
  derniere: string
  nonLus: number
}

/** Ce qu'on garde entre deux démarrages : par cliente, la date déjà vue. */
export type EtatVu = Record<string, string>

export interface Notification {
  titre: string
  corps: string
  /** Page à ouvrir au clic, chemin relatif à la racine d'Effet. */
  chemin: string
}

/** Le prénom seul : « Julie t'a écrit » se lit mieux que le nom complet, et en
 *  dit déjà moins si quelqu'un regarde l'écran par-dessus l'épaule. */
export function prenomDe(nom: string): string {
  return nom.trim().split(/\s+/)[0] ?? nom
}

/**
 * Les fils qui méritent une notification : une cliente a écrit, il reste des
 * messages non lus, et ce dernier message est plus récent que ce qu'on avait
 * déjà annoncé.
 *
 * Un fil dont le dernier mot est celui de la coach ne notifie rien, même s'il
 * porte des non-lus : ces non-lus sont alors ceux d'un échange déjà vu.
 */
export function filsANotifier(fils: FilCoach[], vu: EtatVu): FilANotifier[] {
  const retenus: FilANotifier[] = []
  for (const fil of fils) {
    if (fil.nonLus <= 0) continue
    if (fil.auteurDernier !== 'cliente') continue
    if (!fil.derniere) continue
    const dejaVu = vu[fil.clientId]
    // Comparaison de dates et non d'égalité de chaînes : une horloge serveur
    // qui recule ou un fuseau différent ne doivent pas rejouer une annonce.
    if (dejaVu && Date.parse(fil.derniere) <= Date.parse(dejaVu)) continue
    // `apercu` est laissé derrière : la suite du programme ne peut plus le lire.
    retenus.push({
      clientId: fil.clientId,
      nom: fil.nom,
      derniere: fil.derniere,
      nonLus: fil.nonLus
    })
  }
  return retenus
}

/**
 * Le texte affiché sur le bureau. Une cliente : on la nomme. Plusieurs : on
 * compte, sans nommer personne.
 *
 * Retourne `null` quand il n'y a rien à annoncer, pour que l'appelant n'ait pas
 * à tester la liste vide de son côté.
 */
export function construireNotification(aNotifier: FilANotifier[]): Notification | null {
  if (aNotifier.length === 0) return null

  if (aNotifier.length === 1) {
    const fil = aNotifier[0]
    return {
      titre: 'Effet',
      corps: `${prenomDe(fil.nom)} t’a écrit`,
      chemin: `/coach/notes/${fil.clientId}`
    }
  }

  const total = aNotifier.reduce((somme, fil) => somme + fil.nonLus, 0)
  return {
    titre: 'Effet',
    corps: `${total} nouveaux messages`,
    chemin: '/coach/notes'
  }
}

/**
 * L'état à écrire après une vérification réussie.
 *
 * On mémorise TOUS les fils datés, pas seulement ceux qu'on vient d'annoncer :
 * sans cela, un message de la coach elle-même resterait « jamais vu », et la
 * moindre réponse ultérieure de la cliente aurait rejoué une notification pour
 * un échange déjà connu.
 *
 * Les clientes absentes de la réponse gardent leur date : l'API ne renvoie que
 * les fils actifs, et oublier une cliente reviendrait à la renotifier le jour
 * où elle réécrit.
 */
export function majEtatVu(vu: EtatVu, fils: FilCoach[]): EtatVu {
  const suivant: EtatVu = { ...vu }
  for (const fil of fils) {
    if (!fil.derniere) continue
    const connu = suivant[fil.clientId]
    if (!connu || Date.parse(fil.derniere) > Date.parse(connu)) {
      suivant[fil.clientId] = fil.derniere
    }
  }
  return suivant
}

/**
 * Met un courriel sous une forme comparable : `Marie.R@Hotmail.ca` et
 * `marie.r@hotmail.ca ` désignent la même boîte, et les deux applications ne
 * l'ont pas forcément saisi de la même façon.
 *
 * On s'arrête à la casse et aux espaces. Pas de normalisation plus savante
 * (retrait des points, gestion du `+étiquette`) : deux adresses qui ne
 * diffèrent que par là PEUVENT appartenir à deux personnes, et rapprocher à
 * tort deux clientes serait pire que ne pas les rapprocher.
 */
export function normaliserCourriel(courriel: string): string {
  return courriel.trim().toLowerCase()
}

/**
 * Les non-lus par courriel, prêts à être croisés avec les clients de Kinésio
 * Outils pour afficher une pastille.
 *
 * Ne porte QUE des nombres : ni nom, ni date, ni contenu. Les fils sans
 * courriel — une version d'Effet trop ancienne — sont ignorés en silence :
 * mieux vaut une pastille manquante qu'une pastille posée sur la mauvaise
 * cliente.
 */
export function nonLusParCourriel(fils: FilCoach[]): Record<string, number> {
  const parCourriel: Record<string, number> = {}
  for (const fil of fils) {
    // `typeof` plutôt qu'un simple test de vérité : `estFil` ne contrôle pas ce
    // champ, et un `email` inattendu (nombre, objet) ferait lever `.trim()` —
    // donc tomber toute la vérification, notifications comprises.
    if (typeof fil.email !== 'string' || fil.nonLus <= 0) continue
    const cle = normaliserCourriel(fil.email)
    if (!cle) continue
    // Cumul plutôt qu'écrasement : si deux fils partageaient un courriel, les
    // additionner reste juste, tandis qu'en écraser un perdrait des messages.
    parCourriel[cle] = (parCourriel[cle] ?? 0) + fil.nonLus
  }
  return parCourriel
}

/** Écarte ce qui n'est pas un état valide : un fichier tronqué ou bricolé à la
 *  main ne doit pas empêcher l'outil de démarrer. */
export function lireEtatVu(brut: unknown): EtatVu {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {}
  const etat: EtatVu = {}
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (typeof valeur === 'string' && Number.isFinite(Date.parse(valeur))) etat[cle] = valeur
  }
  return etat
}
