/**
 * Nettoyage unique au démarrage : efface les circonférences aberrantes issues du
 * bug d'import pré-v0.9.18, où un **pli cutané** (Biceps, Cuisse — en mm) était
 * recopié comme **circonférence** du même nom (en cm). Voir bilan-parser.ts.
 *
 * Heuristique **sans faux positif** : une vraie circonférence de biceps fléchi ne
 * descend jamais sous ~20 cm, ni une cuisse sous ~30 cm. Toute valeur en dessous
 * est donc la valeur du pli (mm) recopiée par erreur → on l'efface.
 *
 * Corrige les **bilans** (source) ET les **copies dans l'onglet Mesures**
 * (`mesures_circonferences`, colonnes bicepsG/cuisseG synchronisées à l'import).
 * Idempotent + protégé par un drapeau `settings` → ne s'exécute qu'une fois.
 */
import { eq, isNotNull } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { bilans, mesuresCirconferences, settings } from '../../db/schema'

const FLAG = 'cleanup.circ_pli_dup_v1'

/** Champs de circonférence (bilan) + seuil sous lequel la valeur est forcément un
 *  pli recopié (jamais une vraie circonférence en cm). */
const BILAN_FIELDS: { key: string; maxImplausibleCm: number }[] = [
  { key: 'circ_biceps_flechi_cm', maxImplausibleCm: 20 },
  { key: 'circ_cuisse_cm', maxImplausibleCm: 30 }
]

/** Colonnes correspondantes dans `mesures_circonferences` (copies synchronisées). */
const MESURE_COLS: { col: 'bicepsG' | 'cuisseG'; maxImplausibleCm: number }[] = [
  { col: 'bicepsG', maxImplausibleCm: 20 },
  { col: 'cuisseG', maxImplausibleCm: 30 }
]

export function cleanupCircPliDuplicatesOnce(): void {
  const db = getDb()
  const done = db.select().from(settings).where(eq(settings.key, FLAG)).get()
  if (done) return

  let bilansFixed = 0
  let mesuresFixed = 0

  // ── Bilans (source) ──
  const rows = db.select().from(bilans).all()
  for (const r of rows) {
    let data: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(r.data)
      if (!parsed || typeof parsed !== 'object') continue
      data = parsed as Record<string, unknown>
    } catch {
      continue
    }
    let changed = false
    for (const f of BILAN_FIELDS) {
      const v = data[f.key]
      if (typeof v === 'number' && v > 0 && v < f.maxImplausibleCm) {
        delete data[f.key]
        changed = true
      }
    }
    if (changed) {
      try {
        db.update(bilans).set({ data: JSON.stringify(data) }).where(eq(bilans.id, r.id)).run()
        bilansFixed++
      } catch {
        // un bilan qui échoue ne doit pas bloquer les autres
      }
    }
  }

  // ── Copies dans l'onglet Mesures ──
  for (const m of MESURE_COLS) {
    try {
      const circRows = db
        .select()
        .from(mesuresCirconferences)
        .where(isNotNull(mesuresCirconferences[m.col]))
        .all()
      for (const row of circRows) {
        const v = row[m.col]
        if (typeof v === 'number' && v > 0 && v < m.maxImplausibleCm) {
          db.update(mesuresCirconferences)
            .set({ [m.col]: null })
            .where(eq(mesuresCirconferences.id, row.id))
            .run()
          mesuresFixed++
        }
      }
    } catch {
      // colonne absente ou autre — on n'empêche pas le démarrage
    }
  }

  db.insert(settings)
    .values({ key: FLAG, value: `bilans:${bilansFixed} mesures:${mesuresFixed}`, updatedAt: new Date().toISOString() })
    .run()
}
