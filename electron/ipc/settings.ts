import { ipcMain } from 'electron'
import keytar from 'keytar'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { settings } from '../../db/schema'

const KEYTAR_SERVICE = 'kinesio-outils'
const KEYTAR_ACCOUNT = 'smtp-password'

const KEYS = {
  profileName: 'profile.name',
  profileSignature: 'profile.signature',
  smtp: 'smtp.config',
  emailTemplate: 'email.template'
} as const

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
  name: 'Marie-Eve Bélanger',
  signature: 'Marie-Eve Bélanger\nKinésiologue'
}

const DEFAULT_TEMPLATE = {
  subject: 'Bilan de forme physique - {{client_name}}',
  body:
    'Bonjour {{client_name}},\n\n' +
    'Vous trouverez ci-joint votre bilan de forme physique daté du {{date}}.\n\n' +
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

  ipcMain.handle('settings:template:set', async (_e, data: unknown) => {
    const validated = EmailTemplateSchema.parse(data)
    await writeKey(KEYS.emailTemplate, JSON.stringify(validated))
  })
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
