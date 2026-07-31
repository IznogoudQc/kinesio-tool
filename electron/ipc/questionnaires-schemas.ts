/**
 * Schémas de validation des questionnaires — module PUR.
 *
 * Séparé du câblage IPC (`questionnaires.ts`) pour être testable : ce dernier
 * importe la base de données, donc `node --test` ne peut pas le charger. Or
 * c'est précisément ici qu'un défaut passe inaperçu — `.strip()` supprime en
 * silence tout champ non déclaré, et c'est ainsi que la signature du Q-AAP a
 * disparu à l'enregistrement en v0.9.85 sans qu'aucune erreur ne soit levée.
 */

import { z } from 'zod'

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (attendu AAAA-MM-JJ)')

/**
 * Signature manuscrite du client.
 *
 * Le tracé est borné : une signature PNG fait quelques dizaines de kilo-octets,
 * 2 Mo laisse une marge confortable tout en empêchant qu'une image quelconque
 * finisse stockée dans la base. Le préfixe est vérifié pour la même raison — on
 * accepte une image PNG, pas une chaîne arbitraire.
 */
const QaapSignatureSchema = z
  .object({
    dataUrl: z
      .string()
      .max(2_000_000, 'Signature trop volumineuse.')
      .regex(/^data:image\/png;base64,/, 'Format de signature inattendu.'),
    signerName: z.string().min(1).max(200),
    signedAt: z.string().datetime(),
    answersAtSigning: z.array(z.boolean().nullable()).length(7)
  })
  .strip()

// Q-AAP : 7 réponses tri-état (OUI=true / NON=false / non répondu=null) + textes.
//
// ⚠️ `.strip()` supprime SILENCIEUSEMENT tout champ non déclaré ici. C'est ainsi
// que la signature a été perdue en v0.9.85 : elle s'affichait à l'écran (état
// local du formulaire) mais disparaissait à l'enregistrement, sans la moindre
// erreur. Tout nouveau champ de `QaapData` doit être ajouté ici, sans quoi il
// ne sera jamais persisté.
export const QaapDataSchema = z
  .object({
    answers: z.array(z.boolean().nullable()).length(7),
    precision: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional(),
    signature: QaapSignatureSchema.optional()
  })
  .strip()

// Objectifs & habitudes de vie : uniquement des champs texte libres, tous optionnels.
const ObjectifsDataSchema = z
  .object({
    objectif: z.string().max(2000).optional(),
    preferences: z.string().max(2000).optional(),
    activitePresente: z.string().max(2000).optional(),
    activitesPassees: z.string().max(2000).optional(),
    equipement: z.string().max(2000).optional(),
    sommeil: z.string().max(2000).optional(),
    alimentation: z.string().max(2000).optional(),
    travailHoraire: z.string().max(2000).optional(),
    planification: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional()
  })
  .strip()

// Questionnaire de santé : conditions, zones de tension (cases), restrictions.
const SanteDataSchema = z
  .object({
    conditions: z.string().max(2000).optional(),
    // Zones marquées sur la silhouette : id de région → { sévérité, description }.
    zonesDetail: z
      .record(
        z.string().max(40),
        z.object({ severity: z.enum(['jaune', 'rouge']), description: z.string().max(1000).optional() })
      )
      .optional(),
    // Ancien format (sévérité seule) — accepté en lecture pour rétro-compat.
    zonesSeverity: z.record(z.string().max(40), z.enum(['jaune', 'rouge'])).optional(),
    // Ancien format (cases à cocher) — accepté en lecture pour rétro-compat.
    zones: z.array(z.string().max(60)).max(40).optional(),
    zonesAutre: z.string().max(500).optional(),
    restrictions: z.boolean().nullable().optional(),
    restrictionsDetail: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional()
  })
  .strip()

const TYPE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  qaap: QaapDataSchema,
  objectifs: ObjectifsDataSchema,
  sante: SanteDataSchema
}

export const QuestionnaireType = z.enum(['qaap', 'objectifs', 'sante'])

/** Valide `data` selon `type`. Rejette un type inconnu. */
export function parseDataForType(type: string, data: unknown): unknown {
  const schema = TYPE_SCHEMAS[type]
  if (!schema) throw new Error(`Type de questionnaire inconnu : ${type}`)
  return schema.parse(data)
}
