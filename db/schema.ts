import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  // ISO date (AAAA-MM-JJ), nullable — sert au calcul de l'âge pour les plis cutanés.
  birthdate: text('birthdate'),
  // 'F' | 'M' | null — sert à la silhouette + aux coefficients Durnin-Womersley.
  sex: text('sex'),
  // Nom du fichier de la photo de profil (ex. `uuid.webp`), stockée dans
  // `userData/avatars/` — pas le chemin complet. null = pas de photo, fallback silhouette.
  avatarFilename: text('avatar_filename'),
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
export const mesuresCirconferences = sqliteTable('mesures_circonferences', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  cou: real('cou'),
  epauleG: real('epaule_g'),
  epauleD: real('epaule_d'),
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
