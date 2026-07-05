export const clientsService = {
  async list(): Promise<Client[]> {
    return window.api.clients.list()
  },

  async create(data: {
    name: string
    email: string
    birthdate?: string | null
    sex?: 'F' | 'M' | null
    unitLength?: 'cm' | 'in'
    unitWeight?: 'kg' | 'lb'
  }): Promise<Client> {
    return window.api.clients.create(data)
  },

  async update(
    id: string,
    data: {
      name?: string
      email?: string
      birthdate?: string | null
      sex?: 'F' | 'M' | null
      unitLength?: 'cm' | 'in'
      unitWeight?: 'kg' | 'lb'
      nutritionEnabled?: boolean
      nutritionTargetBodyFat?: number | null
      nutritionActivityLevel?: 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif' | null
      nutritionRateKgPerWeek?: number | null
      nutritionProteinPerLbLean?: number | null
      nutritionFatMaxG?: number | null
      nutritionTargetKcal?: number | null
    }
  ): Promise<Client> {
    return window.api.clients.update(id, data)
  },

  async delete(id: string): Promise<void> {
    return window.api.clients.delete(id)
  },

  // ── Photo de profil ───────────────────────────────────────────────────────
  /** Ouvre le dialog natif de sélection d'une image ; renvoie une data URL à recadrer. */
  async pickAvatar(): Promise<{ canceled: true } | { canceled: false; dataUrl: string }> {
    return window.api.clients.pickAvatar()
  },

  /**
   * Enregistre la photo de profil. `croppedBytes` = version carrée recadrée par
   * l'éditeur (utilisée pour les avatars circulaires) ; `originalBytes` = la photo
   * d'origine non recadrée (affichée en plein corps dans l'onglet Mesures).
   * Retourne le client à jour.
   */
  async setAvatar(
    id: string,
    croppedBase64: string,
    originalBase64: string
  ): Promise<Client> {
    return window.api.clients.setAvatar(id, croppedBase64, originalBase64)
  },

  /** Supprime la photo de profil ; retourne le client à jour. */
  async removeAvatar(id: string): Promise<Client> {
    return window.api.clients.removeAvatar(id)
  },

  /** Renvoie une data URL affichable, ou `null` si le fichier est introuvable. */
  async getAvatarUrl(filename: string): Promise<string | null> {
    return window.api.clients.getAvatarUrl(filename)
  }
}
