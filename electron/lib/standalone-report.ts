import { app } from 'electron'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { bilans, clients, settings } from '../../db/schema'
import { getAvatarPath } from './avatars'
import { safeClientFileName, todayISODate } from './report-generator'

/** Gabarit HTML autonome produit par `vite.standalone.config.ts` + `scripts/inline-standalone.mjs`. */
function templatePath(): string {
  const packaged = join(app.getAppPath(), 'out', 'standalone', 'template.html')
  if (existsSync(packaged)) return packaged
  return join(process.cwd(), 'out', 'standalone', 'template.html')
}

function readSetting(key: string): string | null {
  return getDb().select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
}

async function avatarDataUrl(filename: string | null): Promise<string | null> {
  if (!filename) return null
  const path = getAvatarPath(filename)
  if (!existsSync(path)) return null
  return `data:image/webp;base64,${(await readFile(path)).toString('base64')}`
}

/**
 * Écrit un document HTML **autonome** (aucune requête réseau) pour un client, et
 * retourne son chemin dans le dossier temporaire.
 *
 * Mise en page éditoriale (src/standalone/EditorialReport.tsx). Le document ne
 * contient que ce que le client peut voir : ni notes cliniques, ni conseils IA,
 * ni signaux à surveiller (voir ADR 0019).
 */
export async function generateInteractiveReportHtml(clientId: string): Promise<string> {
  const tpl = templatePath()
  if (!existsSync(tpl)) {
    throw new Error(
      "Le gabarit du document interactif est absent. Lancez `npm run build` (il produit out/standalone/template.html)."
    )
  }

  const db = getDb()
  const client = db.select().from(clients).where(eq(clients.id, clientId)).get()
  if (!client) throw new Error('Client introuvable.')

  // Le renderer attend la liste du plus récent au plus ancien (comme le Dashboard).
  const rows = db.select().from(bilans).where(eq(bilans.clientId, clientId)).orderBy(asc(bilans.date)).all()
  const list = rows
    .map(b => ({
      id: b.id,
      clientId: b.clientId,
      date: b.date,
      data: JSON.parse(b.data) as Record<string, unknown>,
      source: b.source,
      createdAt: b.createdAt
    }))
    .reverse()

  const kinesiologist = readSetting('profile.name') ?? 'Marie-Eve Riendeau'

  const data = {
    client: {
      name: client.name,
      sex: client.sex,
      birthdate: client.birthdate,
      unitWeight: client.unitWeight,
      // Module « objectif chiffré & nutrition » — la section ne s'affiche que
      // si Marie-Eve l'a activé pour ce client.
      nutritionEnabled: client.nutritionEnabled,
      nutritionTargetBodyFat: client.nutritionTargetBodyFat,
      nutritionActivityLevel: client.nutritionActivityLevel,
      nutritionRateKgPerWeek: client.nutritionRateKgPerWeek,
      nutritionProteinPerLbLean: client.nutritionProteinPerLbLean,
      nutritionFatMaxG: client.nutritionFatMaxG,
      nutritionTargetKcal: client.nutritionTargetKcal,
      principePersoTitre: client.principePersoTitre,
      principePersoTexte: client.principePersoTexte,
      jeuneType: client.jeuneType,
      jeuneFenetreDebut: client.jeuneFenetreDebut,
      jeuneFenetreFin: client.jeuneFenetreFin,
      jeuneNotes: client.jeuneNotes,
      hydratationMlParJour: client.hydratationMlParJour,
      supplementsNotes: client.supplementsNotes,
      alimentsPrivilegier: client.alimentsPrivilegier,
      alimentsEviter: client.alimentsEviter,
      nutritionMot: client.nutritionMot
    },
    avatarDataUrl: await avatarDataUrl(client.avatarFilename),
    bilans: list,
    norms: readSetting('categorization_norms') === 'cpafla' ? 'cpafla' : 'acsm',
    kinesiologist,
    // Le mot de la fin, comme dans le PDF. `data.notes` du bilan = observations
    // que Marie-Eve destine au client (à ne pas confondre avec ses notes privées).
    signature: readSetting('profile.signature') ?? `${kinesiologist}
Kinésiologue`,
    generatedAt: new Date().toISOString()
  }

  // `</` et `<!--` fermeraient la balise <script> hôte depuis l'intérieur du JSON.
  const payload = JSON.stringify(data).replace(/</g, '\\u003c')
  const html = (await readFile(tpl, 'utf-8')).replace(
    '<!--REPORT_DATA-->',
    // Remplacement par fonction : `$&` & co sont des motifs spéciaux de String.replace.
    () => `<script>window.__REPORT_DATA__=${payload}</script>`
  )

  const outPath = join(tmpdir(), `Bilan-interactif-${safeClientFileName(client.name)}-${todayISODate()}.html`)
  await writeFile(outPath, html, 'utf-8')
  return outPath
}
