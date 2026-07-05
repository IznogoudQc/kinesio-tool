import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  // ISO date (AAAA-MM-JJ), nullable — sert au calcul de l'âge pour les plis cutanés.
  birthdate: text('birthdate'),
  // 'F' | 'M' | null — sert à la silhouette + aux coefficients Durnin-Womersley.
  sex: text('sex'),
  // Photo de profil — fichiers `uuid.webp` dans `userData/avatars/` (pas le chemin complet).
  // `avatarFilename` : version carrée recadrée par l'éditeur (avatars circulaires).
  // `avatarFullbodyFilename` : image originale non recadrée, affichée dans l'onglet Mesures
  // à la place de la silhouette générique. null = pas de photo, fallback silhouette/sexe.
  avatarFilename: text('avatar_filename'),
  avatarFullbodyFilename: text('avatar_fullbody_filename'),
  // Préférences d'unités pour l'affichage/saisie — la DB stocke TOUJOURS en métrique
  // (cm, kg) ; la conversion se fait côté UI. Voir src/lib/units.ts.
  unitLength: text('unit_length', { enum: ['cm', 'in'] }).notNull().default('cm'),
  unitWeight: text('unit_weight', { enum: ['kg', 'lb'] }).notNull().default('kg'),
  // Module « Objectif chiffré & nutrition » — activable par client (opt-in).
  // Quand activé, le rapport calcule les livres à perdre pour atteindre
  // `nutritionTargetBodyFat` (% de gras visé) et propose des macros indicatives
  // selon `nutritionActivityLevel`. Voir docs/decisions/0015.
  nutritionEnabled: integer('nutrition_enabled', { mode: 'boolean' }).notNull().default(false),
  nutritionTargetBodyFat: real('nutrition_target_body_fat'),
  nutritionActivityLevel: text('nutrition_activity_level', {
    enum: ['sedentaire', 'leger', 'modere', 'actif', 'tres_actif']
  }),
  // Rythme de perte visé (kg/semaine) — pilote l'échéance estimée ET le déficit
  // calorique des macros (1 kg gras ≈ 7700 kcal). `null` = rythme par défaut.
  nutritionRateKgPerWeek: real('nutrition_rate_kg_per_week'),
  // Formule des macros, modifiable par Marie. `null` = valeurs par défaut
  // (protéines 1 g/lb de masse maigre, lipides plafond 60 g, glucides = reste).
  nutritionProteinPerLbLean: real('nutrition_protein_per_lb_lean'),
  nutritionFatMaxG: real('nutrition_fat_max_g'),
  // Calories cibles fixées manuellement (kcal). `null` = calcul automatique.
  nutritionTargetKcal: real('nutrition_target_kcal'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
})

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert

export const bilans = sqliteTable('bilans', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  data: text('data').notNull(),
  source: text('source').notNull(),
  createdAt: text('created_at').notNull()
})

export type Bilan = typeof bilans.$inferSelect
export type NewBilan = typeof bilans.$inferInsert

// Circonférences corporelles — toutes les mesures en cm, réelles, nullables.
// `poidsKg` est toujours stocké en kg (la conversion lb se fait côté UI).
export const mesuresCirconferences = sqliteTable('mesures_circonferences', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  poidsKg: real('poids_kg'),
  cou: real('cou'),
  epaule: real('epaule'),
  bicepsG: real('biceps_g'),
  bicepsD: real('biceps_d'),
  poitrine: real('poitrine'),
  taille: real('taille'),
  abdomen: real('abdomen'),
  hanche: real('hanche'),
  cuisseG: real('cuisse_g'),
  cuisseD: real('cuisse_d'),
  molletG: real('mollet_g'),
  molletD: real('mollet_d'),
  notes: text('notes'),
  createdAt: text('created_at').notNull()
})

export type MesureCirconferences = typeof mesuresCirconferences.$inferSelect
export type NewMesureCirconferences = typeof mesuresCirconferences.$inferInsert

// Plis cutanés (mm) + valeurs calculées (Durnin-Womersley → Siri / Brozek).
// L'âge et le sexe utilisés pour le calcul sont figés au moment de l'enregistrement.
export const mesuresPlisCutanes = sqliteTable('mesures_plis_cutanes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  triceps: real('triceps').notNull(),
  biceps: real('biceps').notNull(),
  sousscapulaire: real('sousscapulaire').notNull(),
  iliaque: real('iliaque').notNull(),
  somme4Plis: real('somme_4_plis').notNull(),
  densiteCorporelle: real('densite_corporelle').notNull(),
  pourcentageGrasSiri: real('pourcentage_gras_siri').notNull(),
  pourcentageGrasBrozek: real('pourcentage_gras_brozek').notNull(),
  ageAuCalcul: integer('age_au_calcul').notNull(),
  sexeAuCalcul: text('sexe_au_calcul').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull()
})

export type MesurePlisCutanes = typeof mesuresPlisCutanes.$inferSelect
export type NewMesurePlisCutanes = typeof mesuresPlisCutanes.$inferInsert
