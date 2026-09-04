import { app } from 'electron'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { bilans, clients, mesuresCirconferences, mesuresPlisCutanes, settings } from '../../db/schema'
import { getAvatarPath } from './avatars'
import { safeClientFileName, todayISODate } from './report-generator'
import { scopeBilansTo } from '../../src/lib/report-scope'

/** Gabarit HTML autonome produit par `vite.standalone.config.ts` + `scripts/inline-standalone.mjs`. */
function templatePath(): string {
  const packaged = join(app.getAppPath(), 'out', 'standalone', 'template.html')
  if (existsSync(packaged)) return packaged
  return join(process.cwd(), 'out', 'standalone', 'template.html')
}

function readSetting(key: string): string | null {
  return getDb().select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
}

/** Parse la chaîne JSON du planning de jeûne en tableau (ou `null` si vide/invalide). */
function parseJeunePlanning(raw: string | null): unknown[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
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
export async function generateInteractiveReportHtml(clientId: string, bilanId?: string): Promise<string> {
  return buildStandaloneHtml(clientId, 'report', 'Bilan-interactif', bilanId)
}

/**
 * Écrit un document HTML **autonome** DÉDIÉ à la nutrition & au jeûne (distinct du
 * bilan). Même gabarit, mais `docType: 'nutrition'` → le renderer monte
 * `NutritionDocument` au lieu du bilan interactif.
 */
export async function generateNutritionDocumentHtml(clientId: string): Promise<string> {
  return buildStandaloneHtml(clientId, 'nutrition', 'Nutrition-jeune')
}

/**
 * Écrit le document « Suivi des mesures » : les prises de l'onglet Mesures.
 *
 * Les bilans n'en parlent pas — la synchronisation ne va que du bilan vers les
 * mesures, donc une prise faite entre deux bilans n'apparaissait dans aucun
 * document remis au client.
 */
export async function generateMesuresDocumentHtml(clientId: string): Promise<string> {
  return buildStandaloneHtml(clientId, 'mesures', 'Suivi-mesures')
}

/** Journal alimentaire vierge imprimable (grille 7 jours). */
export async function generateFoodJournalHtml(clientId: string): Promise<string> {
  return buildStandaloneHtml(clientId, 'foodlog', 'Journal-alimentaire')
}

/**
 * Écrit le formulaire d'habitudes de vie dans un fichier temporaire.
 *
 * Le HTML est **construit par le renderer**, pas ici. Ce n'est pas un caprice :
 * `tsconfig.node` émet du JavaScript, donc il ne peut pas activer
 * `allowImportingTsExtensions` — et par conséquent tout module de `src/lib/`
 * partagé avec le processus principal doit être autonome, sans import de frère
 * (c'est le cas de `report-scope`, `client-folders`, `qaap`…). Or le générateur
 * du formulaire a besoin des 25 énoncés et du format de code. Les recopier ici
 * pour satisfaire le compilateur créerait deux sources de vérité, exactement le
 * genre de divergence qui a coûté plusieurs correctifs à ce projet.
 *
 * Le processus principal ne fait donc qu'écrire les octets qu'on lui donne.
 */
export async function writeFantasticFormHtml(clientId: string, html: string): Promise<string> {
  const client = getDb().select().from(clients).where(eq(clients.id, clientId)).get()
  if (!client) throw new Error('Client introuvable.')

  const outPath = join(
    tmpdir(),
    `Questionnaire-habitudes-de-vie-${safeClientFileName(client.name)}-${todayISODate()}.html`
  )
  await writeFile(outPath, html, 'utf-8')
  return outPath
}

/**
 * Prises de mesures d'un client, colonnes brutes, ordre chronologique.
 *
 * Les `notes` sont retirées : écrites pendant la mesure, pour la kinésiologue,
 * elles n'ont pas à voyager dans un document remis au client. Le retrait se
 * fait ICI, à la source, plutôt que dans le rendu — une colonne oubliée dans un
 * composant se retrouverait dans le fichier.
 */
function chargerMesures(clientId: string) {
  const db = getDb()
  const sansNotes = <T extends { notes?: string | null }>(lignes: T[]) =>
    lignes.map(({ notes: _notes, ...reste }) => reste)
  return {
    circonferences: sansNotes(
      db
        .select()
        .from(mesuresCirconferences)
        .where(eq(mesuresCirconferences.clientId, clientId))
        .orderBy(asc(mesuresCirconferences.date))
        .all()
    ),
    plis: sansNotes(
      db
        .select()
        .from(mesuresPlisCutanes)
        .where(eq(mesuresPlisCutanes.clientId, clientId))
        .orderBy(asc(mesuresPlisCutanes.date))
        .all()
    )
  }
}

async function buildStandaloneHtml(
  clientId: string,
  docType: 'report' | 'nutrition' | 'foodlog' | 'mesures',
  filePrefix: string,
  /** Bilan a ouvrir par defaut. Absent = bilan de synthese. */
  bilanId?: string
): Promise<string> {
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
  const all = rows
    .map(b => ({
      id: b.id,
      clientId: b.clientId,
      date: b.date,
      data: JSON.parse(b.data) as Record<string, unknown>,
      source: b.source,
      createdAt: b.createdAt
    }))
    .reverse()

  // Rapport d'un bilan précis : on borne l'historique à SA date. Sans ça, un
  // document daté de 2011 montrerait des courbes montant jusqu'en 2026 et
  // proposerait de se comparer à des bilans qui n'existaient pas encore.
  const cible = bilanId ? all.find(b => b.id === bilanId) ?? null : null
  const list = scopeBilansTo(all, bilanId)


  const kinesiologist = readSetting('profile.name') ?? 'Marie-Eve Riendeau'

  const data = {
    docType,
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
      nutritionProteinPerKg: client.nutritionProteinPerKg,
      nutritionFatMaxG: client.nutritionFatMaxG,
      nutritionFatMode: client.nutritionFatMode,
      nutritionFatPct: client.nutritionFatPct,
      nutritionTargetKcal: client.nutritionTargetKcal,
      nutritionMacroManual: client.nutritionMacroManual,
      nutritionManualProteinG: client.nutritionManualProteinG,
      nutritionManualFatG: client.nutritionManualFatG,
      nutritionManualCarbG: client.nutritionManualCarbG,
      nutritionManualFiberG: client.nutritionManualFiberG,
      nutritionRepasParJour: client.nutritionRepasParJour,
      principePersoTitre: client.principePersoTitre,
      principePersoTexte: client.principePersoTexte,
      jeuneType: client.jeuneType,
      jeuneFenetreDebut: client.jeuneFenetreDebut,
      jeuneFenetreFin: client.jeuneFenetreFin,
      jeuneNotes: client.jeuneNotes,
      jeunePlanning: parseJeunePlanning(client.jeunePlanning),
      hydratationMlParJour: client.hydratationMlParJour,
      supplementsNotes: client.supplementsNotes,
      alimentsPrivilegier: client.alimentsPrivilegier,
      alimentsEviter: client.alimentsEviter,
      nutritionMot: client.nutritionMot,
      reportHiddenSections: client.reportHiddenSections,
      nutritionMenu: client.nutritionMenu
    },
    avatarDataUrl: await avatarDataUrl(client.avatarFilename),
    bilans: list,
    // Chargées seulement pour le document qui les affiche : les inclure partout
    // gonflerait chaque bilan interactif de données qu'il n'utilise pas.
    ...(docType === 'mesures' ? { mesures: chargerMesures(clientId) } : {}),
    /** Bilan ouvert par défaut. `null` = bilan de synthèse (toutes dernières valeurs). */
    selectedBilanId: cible?.id ?? null,
    // Pas de `norms` dans le payload : le renderer suit `DEFAULT_NORMS`, comme le
    // dashboard et le PDF. On lisait ici `categorization_norms`, un réglage retiré
    // en v0.9.31 — la lecture retombait donc toujours sur ACSM et le HTML cotait
    // dans une autre norme que l'écran.
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

  const outPath = join(tmpdir(), `${filePrefix}-${safeClientFileName(client.name)}-${todayISODate()}.html`)
  await writeFile(outPath, html, 'utf-8')
  return outPath
}
