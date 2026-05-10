/**
 * Couche service "API-ready" pour les mesures (circonférences + plis cutanés).
 * Aucun composant React n'appelle l'IPC directement — voir
 * docs/decisions/0002-architecture-api-ready.md.
 *
 * Le calcul du pourcentage de gras (Durnin-Womersley → Siri / Brozek) est fait
 * côté main process à la création/modification d'une entrée de plis cutanés ;
 * le renderer en fait un aperçu en temps réel via `src/lib/body-fat-calculator.ts`.
 */
export const mesuresService = {
  circonferences: {
    async list(clientId: string): Promise<MesureCirconferences[]> {
      return window.api.mesures.circ.list(clientId)
    },
    async create(clientId: string, data: CirconferencesInput): Promise<MesureCirconferences> {
      return window.api.mesures.circ.create(clientId, data)
    },
    async update(id: string, data: CirconferencesInput): Promise<MesureCirconferences> {
      return window.api.mesures.circ.update(id, data)
    },
    async delete(id: string): Promise<void> {
      return window.api.mesures.circ.delete(id)
    }
  },
  plis: {
    async list(clientId: string): Promise<MesurePlisCutanes[]> {
      return window.api.mesures.plis.list(clientId)
    },
    async create(clientId: string, data: PlisInput): Promise<MesurePlisCutanes> {
      return window.api.mesures.plis.create(clientId, data)
    },
    async update(id: string, data: PlisInput): Promise<MesurePlisCutanes> {
      return window.api.mesures.plis.update(id, data)
    },
    async delete(id: string): Promise<void> {
      return window.api.mesures.plis.delete(id)
    }
  }
}
