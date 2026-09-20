/** Kinésio Pulse — l'app web des programmes d'entraînement, séparée de Outils.
 *  Comme partout, le renderer passe par un service : jamais d'appel IPC depuis
 *  un composant. L'adresse et sa validation vivent côté processus principal. */
export const pulseService = {
  /** Ouvre Pulse dans le navigateur par défaut. Lève si l'adresse configurée
   *  n'est pas une https vers un hôte attendu. */
  async open(): Promise<void> {
    return window.api.pulse.open()
  }
}
