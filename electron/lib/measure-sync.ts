/**
 * Synchronisation à l'enregistrement des mesures PARTAGÉES entre un bilan et
 * l'onglet Mesures (voir docs/decisions/0023). Exécuté dans le main process.
 *
 * - `syncBilanToMesures` : après un bilan, reporte ses mesures dans les tables
 *   Mesures (circonférences + plis) pour la même date.
 * - `syncMesuresToBilan` : après une prise de Mesures, reporte dans le bilan de
 *   cette date (fusion s'il existe, sinon création d'un bilan `source: 'mesures'`).
 *
 * Pas de boucle : ces fonctions écrivent DIRECTEMENT en base (elles n'appellent
 * jamais les handlers IPC qui, eux, les déclenchent). Tout est en métrique des
 * deux côtés → aucune conversion.
 */
import { and, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { bilans, mesuresCirconferences, mesuresPlisCutanes, clients } from '../../db/schema'
import { calculateAge, calculateBodyFat, type Sex } from '../../src/lib/body-fat-calculator'
import { CIRC_MAP, PLIS_MAP, numOrNull } from '../../src/lib/measure-sync-map'

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

/** Reporte une prise de Mesures (déjà enregistrée) dans le bilan de cette date. */
export function syncMesuresToBilan(clientId: string, date: string): void {
  const db = getDb()
  const circ = db
    .select()
    .from(mesuresCirconferences)
    .where(and(eq(mesuresCirconferences.clientId, clientId), eq(mesuresCirconferences.date, date)))
    .get()
  const plis = db
    .select()
    .from(mesuresPlisCutanes)
    .where(and(eq(mesuresPlisCutanes.clientId, clientId), eq(mesuresPlisCutanes.date, date)))
    .get()
  if (!circ && !plis) return

  const patch: Record<string, number> = {}
  if (circ) {
    for (const m of CIRC_MAP) {
      const v = numOrNull((circ as Record<string, unknown>)[m.circ])
      if (v !== null) patch[m.bilan] = v
    }
  }
  if (plis) {
    for (const m of PLIS_MAP) {
      const v = numOrNull((plis as Record<string, unknown>)[m.plis])
      if (v !== null) patch[m.bilan] = v
    }
  }
  if (Object.keys(patch).length === 0) return

  const existing = db.select().from(bilans).where(and(eq(bilans.clientId, clientId), eq(bilans.date, date))).get()
  const now = new Date().toISOString()
  if (existing) {
    let data: Record<string, unknown> = {}
    try {
      const parsed: unknown = JSON.parse(existing.data)
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>
    } catch {
      data = {}
    }
    db.update(bilans).set({ data: JSON.stringify({ ...data, ...patch }) }).where(eq(bilans.id, existing.id)).run()
  } else {
    db.insert(bilans)
      .values({ id: crypto.randomUUID(), clientId, date, data: JSON.stringify(patch), source: 'mesures', createdAt: now })
      .run()
  }
}
