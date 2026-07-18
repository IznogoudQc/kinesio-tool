import { dialog, ipcMain } from 'electron'
import keytar from 'keytar'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { settings } from '../../db/schema'
import { DEFAULT_SUPPLEMENTS } from '../../src/lib/supplements'
import { DEFAULT_FOODS_GOOD, DEFAULT_FOODS_BAD } from '../../src/lib/food-suggestions'
import { DEFAULT_PAIN_SUGGESTIONS } from '../../src/lib/pain-suggestions'

const KEYTAR_SERVICE = 'kinesio-outils'
const KEYTAR_ACCOUNT = 'smtp-password'

const KEYS = {
  profileName: 'profile.name',
  profileSignature: 'profile.signature',
  smtp: 'smtp.config',
  emailTemplate: 'email.template',
  categorizationNorms: 'categorization_norms',
  mesureFields: 'mesures.fields',
  documentsFolder: 'documents.folder',
  supplements: 'nutrition.supplements',
  foodsGood: 'nutrition.foods_good',
  foodsBad: 'nutrition.foods_bad',
  painSuggestions: 'pain.suggestions'
} as const

/** Listes d'aliments proposés (à privilégier / à éviter), globales et éditables. */
const FoodListSchema = z.array(z.string().trim().min(1).max(120)).max(200)

/** Bibliothèque de suggestions de douleur : famille → liste de phrases. */
const PainSuggestionsSchema = z.record(
  z.string().min(1).max(40),
  z.array(z.string().trim().min(1).max(200)).max(100)
)

/** Bibliothèque de suppléments (globale, éditable par Marie). Absence de réglage
 *  → liste par défaut. Nom obligatoire ; moment facultatif. */
const SupplementsSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(80),
      timing: z.string().trim().max(200)
    })
  )
  .max(100)

const CategorizationNormsSchema = z.enum(['acsm', 'cpafla'])
const DEFAULT_CATEGORIZATION_NORMS = 'acsm' as const

// Circonférences que Marie-Eve choisit de saisir. Absence de réglage → l'UI les
// affiche toutes. Masquer un champ n'efface aucune donnée déjà en base.
const MesureFieldsSchema = z.array(
  z.enum([
    'cou',
    'epaule',
    'bicepsG',
    'bicepsD',
    'poitrine',
    'taille',
    'abdomen',
    'hanche',
    'cuisseG',
    'cuisseD',
    'molletG',
    'molletD'
  ])
)

const ProfileSchema = z.object({
  name: z.string().max(200).trim(),
  signature: z.string().max(2000)
})

const SmtpConfigSchema = z.object({
  host: z.string().min(1).max(255).trim(),
  port: z.number().int().min(1).max(65535),
  user: z.string().max(255).trim(),
  secure: z.boolean()
})

const PasswordSchema = z.string().min(1).max(500)

const EmailTemplateSchema = z.object({
  subject: z.string().max(500),
  body: z.string().max(10000)
})

const DEFAULT_PROFILE = {
  name: 'Marie-Eve Riendeau',
  signature: 'Marie-Eve Riendeau\nKinésiologue'
}

// Chaque envoi porte DEUX pièces jointes (voir `reports:send-email`) : le rapport
// PDF et le document interactif. Le texte par défaut les annonce et dit quoi en faire.
const DEFAULT_TEMPLATE = {
  subject: 'Bilan de forme physique - {{client_name}}',
  body:
    'Bonjour {{client_name}},\n\n' +
    'Vous trouverez ci-joint votre bilan de forme physique daté du {{date}}, sous deux formes.\n\n' +
    '1. Le rapport PDF — la version complète, à consulter, imprimer ou conserver.\n\n' +
    '2. Le document interactif (fichier .html) — ouvrez-le dans votre navigateur en double-cliquant dessus. ' +
    'Vous pourrez y explorer vos résultats, passer d\'un bilan à l\'autre et suivre votre progression dans le temps. ' +
    'Il fonctionne sans connexion Internet, et aucune de vos données n\'est transmise : tout est contenu dans le fichier.\n\n' +
    'N\'hésitez pas à me contacter pour toute question.\n\n' +
    '{{signature}}'
}

async function readKey(key: string): Promise<string | null> {
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get()
  return row?.value ?? null
}

async function writeKey(key: string, value: string): Promise<void> {
  const db = getDb()
  const now = new Date().toISOString()
  const existing = db.select().from(settings).where(eq(settings.key, key)).get()
  if (existing) {
    db.update(settings).set({ value, updatedAt: now }).where(eq(settings.key, key)).run()
  } else {
    db.insert(settings).values({ key, value, updatedAt: now }).run()
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:profile:get', async () => {
    const name = await readKey(KEYS.profileName)
    const signature = await readKey(KEYS.profileSignature)
    return {
      name: name ?? DEFAULT_PROFILE.name,
      signature: signature ?? DEFAULT_PROFILE.signature
    }
  })

  ipcMain.handle('settings:profile:set', async (_e, data: unknown) => {
    const validated = ProfileSchema.parse(data)
    await writeKey(KEYS.profileName, validated.name)
    await writeKey(KEYS.profileSignature, validated.signature)
  })

  ipcMain.handle('settings:smtp:get', async () => {
    const raw = await readKey(KEYS.smtp)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      return SmtpConfigSchema.parse(parsed)
    } catch {
      return null
    }
  })

  ipcMain.handle('settings:smtp:set', async (_e, data: unknown) => {
    const validated = SmtpConfigSchema.parse(data)
    await writeKey(KEYS.smtp, JSON.stringify(validated))
  })

  ipcMain.handle('settings:smtp:setPassword', async (_e, password: unknown) => {
    const validated = PasswordSchema.parse(password)
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, validated)
  })

  ipcMain.handle('settings:smtp:hasPassword', async () => {
    const pwd = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
    return pwd !== null && pwd.length > 0
  })

  ipcMain.handle('settings:smtp:test', async () => {
    try {
      const raw = await readKey(KEYS.smtp)
      if (!raw) return { success: false, error: 'Configuration SMTP introuvable.' }
      const cfg = SmtpConfigSchema.parse(JSON.parse(raw))
      const password = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
      if (!password) return { success: false, error: 'Mot de passe SMTP non configuré.' }

      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: password }
      })
      await transporter.verify()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('settings:template:get', async () => {
    const raw = await readKey(KEYS.emailTemplate)
    if (!raw) return DEFAULT_TEMPLATE
    try {
      return EmailTemplateSchema.parse(JSON.parse(raw))
    } catch {
      return DEFAULT_TEMPLATE
    }
  })

  /** Le texte par défaut, sans l'enregistrer — sert au bouton « Rétablir ». */
  ipcMain.handle('settings:template:default', () => DEFAULT_TEMPLATE)

  ipcMain.handle('settings:template:set', async (_e, data: unknown) => {
    const validated = EmailTemplateSchema.parse(data)
    await writeKey(KEYS.emailTemplate, JSON.stringify(validated))
  })

  ipcMain.handle('settings:norms:get', async () => {
    const raw = await readKey(KEYS.categorizationNorms)
    if (!raw) return DEFAULT_CATEGORIZATION_NORMS
    const parsed = CategorizationNormsSchema.safeParse(raw)
    return parsed.success ? parsed.data : DEFAULT_CATEGORIZATION_NORMS
  })

  ipcMain.handle('settings:norms:set', async (_e, value: unknown) => {
    const validated = CategorizationNormsSchema.parse(value)
    await writeKey(KEYS.categorizationNorms, validated)
  })

  ipcMain.handle('settings:mesureFields:get', async () => {
    const raw = await readKey(KEYS.mesureFields)
    if (!raw) return null
    try {
      const parsed = MesureFieldsSchema.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  })

  ipcMain.handle('settings:mesureFields:set', async (_e, value: unknown) => {
    const validated = MesureFieldsSchema.parse(value)
    await writeKey(KEYS.mesureFields, JSON.stringify(validated))
  })

  // ── Bibliothèque de suppléments (globale, tous clients) ─────────────────────
  ipcMain.handle('settings:supplements:get', async () => {
    const raw = await readKey(KEYS.supplements)
    if (!raw) return DEFAULT_SUPPLEMENTS
    try {
      const parsed = SupplementsSchema.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : DEFAULT_SUPPLEMENTS
    } catch {
      return DEFAULT_SUPPLEMENTS
    }
  })

  ipcMain.handle('settings:supplements:set', async (_e, value: unknown) => {
    const validated = SupplementsSchema.parse(value)
    await writeKey(KEYS.supplements, JSON.stringify(validated))
  })

  ipcMain.handle('settings:supplements:default', () => DEFAULT_SUPPLEMENTS)

  // ── Listes d'aliments proposés (globales, tous clients) ─────────────────────
  const readFoodList = async (key: string, fallback: string[]): Promise<string[]> => {
    const raw = await readKey(key)
    if (!raw) return fallback
    try {
      const parsed = FoodListSchema.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : fallback
    } catch {
      return fallback
    }
  }

  ipcMain.handle('settings:foodsGood:get', async () => readFoodList(KEYS.foodsGood, DEFAULT_FOODS_GOOD))
  ipcMain.handle('settings:foodsGood:set', async (_e, value: unknown) => {
    await writeKey(KEYS.foodsGood, JSON.stringify(FoodListSchema.parse(value)))
  })
  ipcMain.handle('settings:foodsGood:default', () => DEFAULT_FOODS_GOOD)

  ipcMain.handle('settings:foodsBad:get', async () => readFoodList(KEYS.foodsBad, DEFAULT_FOODS_BAD))
  ipcMain.handle('settings:foodsBad:set', async (_e, value: unknown) => {
    await writeKey(KEYS.foodsBad, JSON.stringify(FoodListSchema.parse(value)))
  })
  ipcMain.handle('settings:foodsBad:default', () => DEFAULT_FOODS_BAD)

  // ── Bibliothèque de suggestions de douleur (globale, tous clients) ──────────
  ipcMain.handle('settings:painSuggestions:get', async () => {
    const raw = await readKey(KEYS.painSuggestions)
    if (!raw) return DEFAULT_PAIN_SUGGESTIONS
    try {
      const parsed = PainSuggestionsSchema.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : DEFAULT_PAIN_SUGGESTIONS
    } catch {
      return DEFAULT_PAIN_SUGGESTIONS
    }
  })
  ipcMain.handle('settings:painSuggestions:set', async (_e, value: unknown) => {
    await writeKey(KEYS.painSuggestions, JSON.stringify(PainSuggestionsSchema.parse(value)))
  })
  ipcMain.handle('settings:painSuggestions:default', () => DEFAULT_PAIN_SUGGESTIONS)

  // ── Dossier des documents clients ──────────────────────────────────────────
  ipcMain.handle('settings:documentsFolder:get', async () => readKey(KEYS.documentsFolder))

  ipcMain.handle('settings:documentsFolder:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choisir le dossier des documents clients',
      buttonLabel: 'Choisir ce dossier',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const folder = result.filePaths[0]
    await writeKey(KEYS.documentsFolder, folder)
    return folder
  })
}

/** Dossier configuré pour l'export des documents clients (ou `null`). Le dossier
 *  peut avoir été déplacé depuis — l'export le (re)crée au besoin. */
export async function getDocumentsFolder(): Promise<string | null> {
  return readKey(KEYS.documentsFolder)
}

export async function getSmtpCredentials(): Promise<
  | { host: string; port: number; user: string; secure: boolean; password: string }
  | null
> {
  const raw = await readKey(KEYS.smtp)
  if (!raw) return null
  try {
    const cfg = SmtpConfigSchema.parse(JSON.parse(raw))
    const password = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
    if (!password) return null
    return { ...cfg, password }
  } catch {
    return null
  }
}

export async function getProfile(): Promise<{ name: string; signature: string }> {
  const name = await readKey(KEYS.profileName)
  const signature = await readKey(KEYS.profileSignature)
  return {
    name: name ?? DEFAULT_PROFILE.name,
    signature: signature ?? DEFAULT_PROFILE.signature
  }
}
