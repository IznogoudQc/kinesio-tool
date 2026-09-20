/** Kinésio Pulse — l'app web des programmes d'entraînement, séparée de Outils.
 *  Comme partout, le renderer passe par un service : jamais d'appel IPC depuis
 *  un composant. L'adresse et sa validation vivent côté processus principal. */

/** La barre latérale affiche le mot de passe, Paramètres le modifie, et les deux
 *  vivent côte à côte à l'écran : sans ce signal, la barre montrerait l'ancienne
 *  valeur jusqu'au prochain changement de page. */
const PASSWORD_CHANGED = 'pulse:password-changed'

export const pulseService = {
  /** Ouvre Pulse dans le navigateur par défaut. Lève si l'adresse configurée
   *  n'est pas une https vers un hôte attendu. */
  async open(): Promise<void> {
    return window.api.pulse.open()
  },

  /** Mot de passe en vigueur : le remplacement enregistré, sinon celui livré
   *  avec l'app. `null` si les deux sont vides. */
  async getPassword(): Promise<string | null> {
    return window.api.pulse.getPassword()
  },

  /** Les deux séparément — le champ de Paramètres ne montre que `saisi`, sans
   *  quoi un « Enregistrer » sans modification figerait la valeur livrée. */
  async getPasswordSettings(): Promise<{ saisi: string | null; livre: string | null }> {
    return window.api.pulse.getPasswordSettings()
  },

  /** Chaîne vide = efface le mot de passe. */
  async setPassword(value: string): Promise<void> {
    await window.api.pulse.setPassword(value)
    window.dispatchEvent(new Event(PASSWORD_CHANGED))
  },

  /** S'abonne aux changements. Retourne la fonction de désabonnement. */
  onPasswordChanged(cb: () => void): () => void {
    window.addEventListener(PASSWORD_CHANGED, cb)
    return () => window.removeEventListener(PASSWORD_CHANGED, cb)
  },

  /** Copie le mot de passe dans le presse-papiers. `false` s'il n'y en a pas. */
  async copyPassword(): Promise<boolean> {
    return window.api.pulse.copyPassword()
  }
}
