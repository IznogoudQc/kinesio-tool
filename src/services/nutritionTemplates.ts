/** Couche service pour les modèles de protocole nutrition (app-level). */
export const nutritionTemplatesService = {
  async list(): Promise<NutritionTemplate[]> {
    return window.api.nutritionTemplates.list()
  },

  /** Enregistre un nouveau modèle. `data` = JSON des réglages nutrition capturés. */
  async save(name: string, data: string): Promise<NutritionTemplate> {
    return window.api.nutritionTemplates.save({ name, data })
  },

  async delete(id: string): Promise<void> {
    return window.api.nutritionTemplates.delete(id)
  }
}
