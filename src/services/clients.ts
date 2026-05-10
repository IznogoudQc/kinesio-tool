export const clientsService = {
  async list(): Promise<Client[]> {
    return window.api.clients.list()
  },

  async create(data: { name: string; email: string }): Promise<Client> {
    return window.api.clients.create(data)
  },

  async update(
    id: string,
    data: { name?: string; email?: string; birthdate?: string | null; sex?: 'F' | 'M' | null }
  ): Promise<Client> {
    return window.api.clients.update(id, data)
  },

  async delete(id: string): Promise<void> {
    return window.api.clients.delete(id)
  },

  // ── Photo de profil ───────────────────────────────────────────────────────
  /** Ouvre le dialog natif de sélection d'une image. */
  async pickAvatar(): Promise<{ canceled: true } | { canceled: false; filePath: string }> {
    return window.api.clients.pickAvatar()
  },

  /** Optimise et enregistre l'image comme photo de profil ; retourne le client à jour. */
  async setAvatar(id: string, sourcePath: string): Promise<Client> {
    return window.api.clients.setAvatar(id, sourcePath)
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
