/**
 * Report des mesures d'un bilan vers l'onglet Mesures (voir docs/decisions/0023).
 * Exécuté dans le main process. **Un seul sens** : Bilan → Mesures.
 *
 * `syncBilanToMesures` : après un bilan (enregistré/importé), reporte ses mesures
 * dans les tables Mesures (circonférences + plis) pour la même date. L'inverse
 * (Mesures → Bilan) n'existe PAS : une prise de Mesures ne modifie jamais un bilan.
 *
 * Tout est en métrique des deux côtés → aucune conversion. Écrit directement en
 * base (jamais via les handlers IPC) → pas de boucle.
 */
import { and, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { mesuresCirconferences, mesuresPlisCutanes, clients } from '../../db/schema'
import { calculateAge, calculateBodyFat, type Sex } from '../../src/lib/body-fat-calculator'
import { CIRC_MAP, numOrNull } from '../../src/lib/measure-sync-map'

/** Reporte les mesures d'un bilan (déjà enregistré) dans les tables Mesures. */
export function syncBilanToMesures(clientId: string, date: string, bilanData: Record<string, unknown>): void {
  const db = getDb()
  const now = new Date().toISOString()

  // ── Circonférences (+ poids + grandeur) ──
  const circVals: Record<string, number> = {}
  for (const m of CIRC_MAP) {
    const v = numOrNull(bilanData[m.bilan])
    if (v !== null) circVals[m.circ] = v
  }
  if (Object.keys(circVals).length > 0) {
    const existing = db
      .select()
      .from(mesuresCirconferences)
      .where(and(eq(mesuresCirconferences.clientId, clientId), eq(mesuresCirconferences.date, date)))
      .get()
    if (existing) {
      db.update(mesuresCirconferences).set(circVals).where(eq(mesuresCirconferences.id, existing.id)).run()
    } else {
      db.insert(mesuresCirconferences)
        .values({ id: crypto.randomUUID(), clientId, date, ...circVals, createdAt: now })
        .run()
    }
  }

  // ── Plis cutanés (les 4 requis + profil pour le % de gras) ──
  const t = numOrNull(bilanData['pli_triceps'])
  const b = numOrNull(bilanData['pli_biceps'])
  const s = numOrNull(bilanData['pli_sous_scap'])
  const i = numOrNull(bilanData['pli_iliaque'])
  if (t !== null && b !== null && s !== null && i !== null) {
    const client = db.select().from(clients).where(eq(clients.id, clientId)).get()
    if (client?.sex === 'F' || client?.sex === 'M') {
      if (client.birthdate) {
        const age = calculateAge(client.birthdate)
        const calc = calculateBodyFat({ triceps: t, biceps: b, sousscapulaire: s, iliaque: i }, age, client.sex as Sex)
        const vals = {
          triceps: t,
          biceps: b,
          sousscapulaire: s,
          iliaque: i,
          somme4Plis: calc.sumPlis,
          densiteCorporelle: calc.density,
          pourcentageGrasSiri: calc.bodyFatSiri,
          pourcentageGrasBrozek: calc.bodyFatBrozek,
          ageAuCalcul: age,
          sexeAuCalcul: client.sex
        }
        const existing = db
          .select()
          .from(mesuresPlisCutanes)
          .where(and(eq(mesuresPlisCutanes.clientId, clientId), eq(mesuresPlisCutanes.date, date)))
          .get()
        if (existing) {
          db.update(mesuresPlisCutanes).set(vals).where(eq(mesuresPlisCutanes.id, existing.id)).run()
        } else {
          db.insert(mesuresPlisCutanes)
            .values({ id: crypto.randomUUID(), clientId, date, ...vals, createdAt: now })
            .run()
        }
      }
    }
  }
}
