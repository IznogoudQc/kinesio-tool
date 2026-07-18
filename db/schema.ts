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
  // Macros en saisie manuelle : Marie tape directement les grammes (glucides déduits).
  // `nutritionMacroManual` actif → on utilise `nutritionTargetKcal` (calories),
  // `nutritionManualProteinG` et `nutritionManualFatG` au lieu de la formule.
  nutritionMacroManual: integer('nutrition_macro_manual', { mode: 'boolean' }).notNull().default(false),
  nutritionManualProteinG: real('nutrition_manual_protein_g'),
  nutritionManualFatG: real('nutrition_manual_fat_g'),
  nutritionManualCarbG: real('nutrition_manual_carb_g'),
  // Nombre de repas / jour pour répartir les macros. `null` = défaut (3).
  nutritionRepasParJour: integer('nutrition_repas_par_jour'),
  // Principe personnalisé optionnel (6e pilier) montré en clôture du rapport
  // client. Si `principePersoTitre` est rempli, un principe supplémentaire
  // s'affiche (HTML + PDF). Éditable par Marie, par client.
  principePersoTitre: text('principe_perso_titre'),
  principePersoTexte: text('principe_perso_texte'),
  // ── Nutrition & jeûne (onglet dédié) ──────────────────────────────────────
  // Jeûne intermittent : type de protocole + fenêtre d'alimentation (HH:MM) + consignes.
  jeuneType: text('jeune_type', { enum: ['16:8', '18:6', '20:4', 'omad', '5:2'] }),
  jeuneFenetreDebut: text('jeune_fenetre_debut'),
  jeuneFenetreFin: text('jeune_fenetre_fin'),
  jeuneNotes: text('jeune_notes'),
  // Planning de jeûne flexible — tableau JSON de « programmes » (fenêtre quotidienne
  // ou jeûne prolongé + récurrence). Voir src/lib/fasting-planning.ts. `null`/`[]` = aucun.
  jeunePlanning: text('jeune_planning'),
  // Hydratation : cible en ml/jour. `null` = calcul auto d'après le poids.
  hydratationMlParJour: real('hydratation_ml_par_jour'),
  // Suppléments, aliments à privilégier / à éviter, mot de Marie sur la nutrition (textes libres).
  supplementsNotes: text('supplements_notes'),
  alimentsPrivilegier: text('aliments_privilegier'),
  alimentsEviter: text('aliments_eviter'),
  nutritionMot: text('nutrition_mot'),
  // Idées de menu (journées types) — souvent générées par l'IA puis ajustées par Marie.
  nutritionMenu: text('nutrition_menu'),
  // Goûts du client (préférences personnelles, ≠ des recommandations cliniques
  // « privilégier / éviter »). Alimentent la génération IA des idées de menu.
  alimentsAimes: text('aliments_aimes'),
  alimentsPasAimes: text('aliments_pas_aimes'),
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

// Notes cliniques libres de Marie sur un client — journal daté, PRIVÉ (jamais
// exposé dans le rapport envoyé au client). Voir docs/decisions/0019.
export const clientNotes = sqliteTable('client_notes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  // Date de la note (ISO AAAA-MM-JJ) — souvent la date de séance.
  date: text('date').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export type ClientNote = typeof clientNotes.$inferSelect
export type NewClientNote = typeof clientNotes.$inferInsert

// Questionnaires d'admission d'un client — datés, avec historique (comme les
// bilans). `type` discrimine le formulaire ('qaap' pour l'instant ; 'sante' et
// 'objectifs' à venir) ; `data` = JSON propre à chaque type. Voir docs/decisions/0020.
export const questionnaires = sqliteTable('questionnaires', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  date: text('date').notNull(),
  data: text('data').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export type Questionnaire = typeof questionnaires.$inferSelect
export type NewQuestionnaire = typeof questionnaires.$inferInsert

// Modèles de protocole nutrition réutilisables (app-level, pas par client). `data`
// = JSON d'un sous-ensemble des réglages nutrition, appliqué à un client en 1 clic.
export const nutritionTemplates = sqliteTable('nutrition_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  data: text('data').notNull(),
  createdAt: text('created_at').notNull()
})

export type NutritionTemplate = typeof nutritionTemplates.$inferSelect
export type NewNutritionTemplate = typeof nutritionTemplates.$inferInsert
