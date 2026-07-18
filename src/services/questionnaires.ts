/**
 * Couche service « API-ready » pour les questionnaires d'admission d'un client
 * (Q-AAP, etc.). Aucun composant React n'appelle l'IPC directement — voir
 * docs/decisions/0002-architecture-api-ready.md.
 */
export const questionnairesService = {
  /** Questionnaires du client, du plus récent au plus ancien. */
  async list(clientId: string): Promise<Questionnaire[]> {
    return window.api.questionnaires.list(clientId)
  },
  async create(clientId: string, payload: QuestionnaireCreateInput): Promise<Questionnaire> {
    return window.api.questionnaires.create(clientId, payload)
  },
  async update(id: string, payload: QuestionnaireUpdateInput): Promise<Questionnaire> {
    return window.api.questionnaires.update(id, payload)
  },
  async delete(id: string): Promise<void> {
    return window.api.questionnaires.delete(id)
  },
  async getById(id: string): Promise<Questionnaire | null> {
    return window.api.questionnaires.getById(id)
  }
}
