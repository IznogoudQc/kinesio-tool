import { dialog, ipcMain } from 'electron'
import keytar from 'keytar'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { readSetting, writeSetting } from '../lib/settings-store'
import { DEFAULT_SUPPLEMENTS } from '../../src/lib/supplements'
import {
  DEFAULT_FOODS_GOOD,
  DEFAULT_FOODS_BAD,
  SUGGESTIONS_PROTEINES,
  SUGGESTIONS_GLUCIDES,
  SUGGESTIONS_LIPIDES,
  SUGGESTIONS_PREF_SEMAINE,
  SUGGESTIONS_PREF_WEEKEND
} from '../../src/lib/food-suggestions'
import { MACROS_PAR_100G } from '../../src/lib/food-macros'
import { DEFAULT_PAIN_SUGGESTIONS } from '../../src/lib/pain-suggestions'
import { DEFAULT_BILAN_EMAIL, DEFAULT_MESURES_EMAIL, DEFAULT_NUTRITION_EMAIL } from '../../src/lib/email-templates'

const KEYTAR_SERVICE = 'kinesio-outils'
const KEYTAR_ACCOUNT = 'smtp-password'

const KEYS = {
  profileName: 'profile.name',
  profileSignature: 'profile.signature',
  smtp: 'smtp.config',
  emailTemplate: 'email.template',
  emailTemplateNutrition: 'email.template_nutrition',
  emailTemplateMesures: 'email.template_mesures',
  // `categorization_norms` retiré (v0.9.31) : l'app suit uniquement le CPAFLA.
  // Une éventuelle ligne résiduelle en base est simplement ignorée.
  mesureFields: 'mesures.fields',
  documentsFolder: 'documents.folder',
  supplements: 'nutrition.supplements',
  foodsGood: 'nutrition.foods_good',
  foodsBad: 'nutrition.foods_bad',
  foodsProteines: 'nutrition.foods_proteines',
  foodsGlucides: 'nutrition.foods_glucides',
  foodsLipides: 'nutrition.foods_lipides',
  prefSemaine: 'nutrition.pref_semaine',
  prefWeekend: 'nutrition.pref_weekend',
  painSuggestions: 'pain.suggestions',
  /** Dernier dossier d'où un menu a été importé — pour y rouvrir directement. */
  menuImportFolder: 'nutrition.menu_import_folder',
  /** Composition des aliments ajustée par Marie (grammes pour 100 g). */
  foodMacros: 'nutrition.food_macros',
  /** Adresse d'Effet — l'app web des programmes d'entraînement. (Clé nommée
   *  `pulse.*` : l'app s'appelait Kinésio Pulse. Ne pas renommer, les réglages
   *  déjà enregistrés chez Marie seraient perdus.) */
  pulseUrl: 'pulse.url',
  /** Mot de passe de connexion à Effet, en clair. Voir `getPulsePassword`. */
  pulsePassword: 'pulse.password'
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

// Textes par défaut partagés avec le renderer (src/lib/email-templates.ts).
const DEFAULT_TEMPLATE = DEFAULT_BILAN_EMAIL

/** Adresse d'Effet tant que rien n'est écrit en base. Elle changera le jour où
 *  l'app aura un nom de domaine — d'où le réglage plutôt qu'une constante dans
 *  le composant. Tout nouvel hôte doit AUSSI entrer dans `PULSE_ALLOWED_HOSTS`. */
export const DEFAULT_PULSE_URL = 'https://kinesio-effet.fly.dev'

/**
 * TEMPORAIRE — À RETIRER AU LANCEMENT OFFICIEL.
 *
 * Mot de passe d'Effet livré avec l'application, pour que Marie n'ait pas à le
 * chercher ni à le saisir. Le réglage `pulse.password` le remplace quand il est
 * renseigné ; c'est seulement la valeur de repli.
 *
 * Le dépôt est public : cette chaîne est donc publiée sur GitHub et reste dans
 * l'historique et dans les installateurs déjà diffusés, y compris après son
 * retrait d'ici. La retirer ne la dépublie pas — il faudra CHANGER le mot de
 * passe dans Effet, pas seulement effacer cette ligne.
 *
 * Mettre '' pour désactiver la valeur livrée (la barre latérale n'affiche alors
 * plus rien tant que rien n'est saisi dans Paramètres).
 */
export const DEFAULT_PULSE_PASSWORD = 'wm9segaxun85'

/** Les seuls hôtes vers lesquels `pulse:open` acceptera d'ouvrir le navigateur.
 *  `shell.openExternal` sur une URL non contrôlée est une porte ouverte connue :
 *  on la referme ici, même si l'URL vient aujourd'hui de nos propres réglages.
 *
 *  `kinesio-pulse.fly.dev` reste toléré : l'app s'appelait Pulse avant Effet, et
 *  une installation qui a l'ancienne adresse écrite dans ses réglages primerait
 *  sur `DEFAULT_PULSE_URL`. Sans elle ici, le bouton casserait au lieu de suivre.
 *  À retirer une fois qu'on a vérifié qu'aucun poste ne pointe plus dessus. */
export const PULSE_ALLOWED_HOSTS: readonly string[] = [
  'kinesio-effet.fly.dev',
  'kinesio-pulse.fly.dev'
]

// Façades `async` sur le magasin partagé : les dizaines d'appels `await
// readKey(...)` de ce fichier restent inchangés.
async function readKey(key: string): Promise<string | null> {
  return readSetting(key)
}

async function writeKey(key: string, value: string): Promise<void> {
  writeSetting(key, value)
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

  // ── Modèle de courriel du document NUTRITION (distinct du bilan) ────────────
  ipcMain.handle('settings:templateNutrition:get', async () => {
    const raw = await readKey(KEYS.emailTemplateNutrition)
    if (!raw) return DEFAULT_NUTRITION_EMAIL
    try {
      return EmailTemplateSchema.parse(JSON.parse(raw))
    } catch {
      return DEFAULT_NUTRITION_EMAIL
    }
  })
  ipcMain.handle('settings:templateNutrition:default', () => DEFAULT_NUTRITION_EMAIL)
  ipcMain.handle('settings:templateNutrition:set', async (_e, data: unknown) => {
    const validated = EmailTemplateSchema.parse(data)
    await writeKey(KEYS.emailTemplateNutrition, JSON.stringify(validated))
  })

  // ── Modèle de courriel du SUIVI DES MESURES (distinct des deux autres) ──────
  ipcMain.handle('settings:templateMesures:get', async () => {
    const raw = await readKey(KEYS.emailTemplateMesures)
    if (!raw) return DEFAULT_MESURES_EMAIL
    try {
      return EmailTemplateSchema.parse(JSON.parse(raw))
    } catch {
      return DEFAULT_MESURES_EMAIL
    }
  })
  ipcMain.handle('settings:templateMesures:default', () => DEFAULT_MESURES_EMAIL)
  ipcMain.handle('settings:templateMesures:set', async (_e, data: unknown) => {
    const validated = EmailTemplateSchema.parse(data)
    await writeKey(KEYS.emailTemplateMesures, JSON.stringify(validated))
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

  // Cinq listes, un seul jeu de handlers. Le motif précédent en demandait trois
  // par liste — quinze au total, tous identiques à la clé près, et autant de
  // méthodes à recopier dans le préchargement, les types et le service.
  const LISTES = {
    good: { key: KEYS.foodsGood, defaut: DEFAULT_FOODS_GOOD },
    bad: { key: KEYS.foodsBad, defaut: DEFAULT_FOODS_BAD },
    proteines: { key: KEYS.foodsProteines, defaut: SUGGESTIONS_PROTEINES },
    glucides: { key: KEYS.foodsGlucides, defaut: SUGGESTIONS_GLUCIDES },
    lipides: { key: KEYS.foodsLipides, defaut: SUGGESTIONS_LIPIDES },
    pref_semaine: { key: KEYS.prefSemaine, defaut: SUGGESTIONS_PREF_SEMAINE },
    pref_weekend: { key: KEYS.prefWeekend, defaut: SUGGESTIONS_PREF_WEEKEND }
  } as const
  const NomListe = z.enum(['good', 'bad', 'proteines', 'glucides', 'lipides', 'pref_semaine', 'pref_weekend'])

  ipcMain.handle('settings:foodList:get', async (_e, nom: unknown) => {
    const l = LISTES[NomListe.parse(nom)]
    return readFoodList(l.key, l.defaut)
  })
  ipcMain.handle('settings:foodList:set', async (_e, nom: unknown, value: unknown) => {
    await writeKey(LISTES[NomListe.parse(nom)].key, JSON.stringify(FoodListSchema.parse(value)))
  })
  ipcMain.handle('settings:foodList:default', (_e, nom: unknown) => LISTES[NomListe.parse(nom)].defaut)

  // ── Composition des aliments (globale, tous clients) ────────────────────────
  // Bornes 0-100 : ce sont des grammes POUR 100 g d'aliment. Au-delà, la valeur
  // n'a pas de sens physique, et une faute de frappe (310 au lieu de 31) fausse
  // silencieusement le calcul des protéines de tous les menus.
  const MacrosSchema = z.record(
    z.string().min(1).max(120),
    z.object({
      p: z.number().min(0).max(100),
      g: z.number().min(0).max(100),
      l: z.number().min(0).max(100)
    })
  )

  ipcMain.handle('settings:foodMacros:get', async () => {
    const raw = await readKey(KEYS.foodMacros)
    if (!raw) return MACROS_PAR_100G
    try {
      const parsed = MacrosSchema.safeParse(JSON.parse(raw))
      // Les valeurs du code d'abord, celles de Marie par-dessus : un aliment
      // ajouté plus tard au code apparaît, et ses ajustements survivent.
      return parsed.success ? { ...MACROS_PAR_100G, ...parsed.data } : MACROS_PAR_100G
    } catch {
      return MACROS_PAR_100G
    }
  })
  ipcMain.handle('settings:foodMacros:set', async (_e, value: unknown) => {
    await writeKey(KEYS.foodMacros, JSON.stringify(MacrosSchema.parse(value)))
  })
  ipcMain.handle('settings:foodMacros:default', () => MACROS_PAR_100G)

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

/** Adresse d'Effet, telle que configurée (ou la valeur par défaut).
 *  L'appelant valide toujours l'URL avant de l'ouvrir — voir `ipc/pulse.ts`. */
export async function getPulseUrl(): Promise<string> {
  return (await readKey(KEYS.pulseUrl))?.trim() || DEFAULT_PULSE_URL
}

/**
 * Mot de passe de connexion à Effet.
 *
 * Ce qui est saisi dans Paramètres l'emporte ; sinon on sert
 * `DEFAULT_PULSE_PASSWORD`, livré avec l'app. `null` seulement si les deux sont
 * vides — la barre latérale n'affiche alors rien.
 *
 * En clair dans `kinesio.db`, contrairement au mot de passe SMTP qui passe par
 * keytar : dépannage temporaire assumé, le temps qu'Effet ait sa propre façon
 * de garder Marie connectée. Conséquence à connaître — la sauvegarde
 * quotidienne emporte la base entière, donc ce mot de passe part dans OneDrive
 * avec elle.
 */
export async function getPulsePassword(): Promise<string | null> {
  return (await getSavedPulsePassword()) || DEFAULT_PULSE_PASSWORD || null
}

/**
 * Le remplacement enregistré SEUL, sans repli sur la valeur livrée — `null`
 * quand il n'y en a pas.
 *
 * C'est ce que la carte de Paramètres doit montrer : un champ prérempli avec la
 * valeur livrée se fait réenregistrer telle quelle au premier clic sur
 * « Enregistrer », et ce remplacement figé gagnerait ensuite sur toute nouvelle
 * valeur livrée par une mise à jour, sans que rien ne le signale.
 */
export async function getSavedPulsePassword(): Promise<string | null> {
  return (await readKey(KEYS.pulsePassword))?.trim() || null
}

/** Chaîne vide = on oublie la saisie et on revient au mot de passe livré avec
 *  l'app. L'espace de bord est retiré : c'est le prix d'un copier-coller. */
export async function setPulsePassword(value: string): Promise<void> {
  await writeKey(KEYS.pulsePassword, value.trim())
}

/** Dossier configuré pour l'export des documents clients (ou `null`). Le dossier
 *  peut avoir été déplacé depuis — l'export le (re)crée au besoin. */
export async function getDocumentsFolder(): Promise<string | null> {
  return readKey(KEYS.documentsFolder)
}

/**
 * Dernier dossier d'où un menu a été importé.
 *
 * Marie récupère toujours ses menus au même endroit — le dossier de travail où
 * l'IA les dépose. Sans mémoire, elle refait le même chemin à chaque import.
 */
export async function getMenuImportFolder(): Promise<string | null> {
  return readKey(KEYS.menuImportFolder)
}

export async function setMenuImportFolder(folder: string): Promise<void> {
  await writeKey(KEYS.menuImportFolder, folder)
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
