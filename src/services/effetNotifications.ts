/** Veille sur les messages des clientes dans Effet — façade renderer.
 *
 *  Comme les autres services, aucun composant n'appelle `window.api` en direct
 *  (voir docs/decisions/0002-architecture-api-ready.md). */
export const effetNotificationsService = {
  getStatus(): Promise<EffetVeilleStatus> {
    return window.api.effetNotifications.getStatus()
  },

  setActives(actives: boolean): Promise<EffetVeilleStatus> {
    return window.api.effetNotifications.setActives(actives)
  },

  verifier(): Promise<EffetVeilleStatus> {
    return window.api.effetNotifications.verifier()
  },

  /** Chaîne vide = efface la clé. */
  setCle(cle: string): Promise<EffetVeilleStatus> {
    return window.api.effetNotifications.setCle(cle)
  },

  /** Non-lus par courriel, pour la pastille de la liste des clients. Vide tant
   *  qu'aucune vérification n'a abouti. */
  nonLus(): Promise<Record<string, { nonLus: number; clientId: string }>> {
    return window.api.effetNotifications.nonLus()
  }
}
