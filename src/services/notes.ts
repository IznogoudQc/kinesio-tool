/**
 * Couche service « API-ready » pour les notes cliniques d'un client (journal
 * daté, privé). Aucun composant React n'appelle l'IPC directement — voir
 * docs/decisions/0002-architecture-api-ready.md.
 */
export const notesService = {
  async list(clientId: string): Promise<ClientNote[]> {
    return window.api.notes.list(clientId)
  },
  async create(clientId: string, data: ClientNoteInput): Promise<ClientNote> {
    return window.api.notes.create(clientId, data)
  },
  async update(id: string, data: ClientNoteInput): Promise<ClientNote> {
    return window.api.notes.update(id, data)
  },
  async delete(id: string): Promise<void> {
    return window.api.notes.delete(id)
  }
}
