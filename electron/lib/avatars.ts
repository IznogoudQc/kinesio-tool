import { app } from 'electron'
import { join } from 'node:path'
import { mkdir, readFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { removeUniformBackground } from './background-remover'

// Les photos de profil vivent sur disque dans `userData/avatars/{uuid}.webp` —
// seul le nom de fichier est stocké en DB (colonne `clients.avatar_filename`).
function avatarsDir(): string {
  return join(app.getPath('userData'), 'avatars')
}

export async function ensureAvatarsDir(): Promise<void> {
  const dir = avatarsDir()
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

/**
 * Optimise l'image source (chemin disque ou buffer déjà recadré côté renderer :
 * recadrage carré 512×512, conversion WebP q85) et l'écrit dans le dossier des
 * avatars. Supprime l'ancienne photo si fournie. Retourne le nom du fichier créé
 * (à stocker en DB).
 */
export async function saveAvatar(source: string | Buffer, oldFilename?: string | null): Promise<string> {
  await ensureAvatarsDir()
  if (oldFilename) await deleteAvatar(oldFilename)
  const filename = `${randomUUID()}.webp`
  const destPath = join(avatarsDir(), filename)
  await sharp(source)
    .rotate() // respecte l'orientation EXIF avant le recadrage
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .webp({ quality: 85 })
    .toFile(destPath)
  return filename
}

/**
 * Version « plein corps » de la photo : l'image originale non recadrée. On
 * retire d'abord le fond uniforme (blanc/cream) pour le rendre transparent —
 * le personnage « flotte » alors sur le fond de l'onglet Mesures — puis on
 * redimensionne et on convertit en WebP avec alpha. Affichée dans l'onglet
 * Mesures à la place de la silhouette générique. Supprime l'ancien fichier si
 * fourni. Retourne le nom du fichier créé.
 */
export async function saveFullbodyAvatar(source: string | Buffer, oldFilename?: string | null): Promise<string> {
  await ensureAvatarsDir()
  if (oldFilename) await deleteAvatar(oldFilename)

  // Normaliser en Buffer avec orientation EXIF appliquée (removeUniformBackground
  // travaille sur des pixels raw, pas sur un chemin disque ni les métadonnées EXIF).
  const inputBuffer = typeof source === 'string' ? await readFile(source) : source
  const oriented = await sharp(inputBuffer).rotate().toBuffer()

  // Étape 1 : retirer le fond uniforme (blanc/cream) → PNG transparent
  const cleanedPng = await removeUniformBackground(oriented, 30)

  // Étape 2 : redimensionner et sauver en WebP avec transparence préservée
  const filename = `${randomUUID()}.webp`
  const destPath = join(avatarsDir(), filename)
  await sharp(cleanedPng)
    .resize(800, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100 }) // alphaQuality élevé pour bien préserver la transparence
    .toFile(destPath)
  return filename
}

export async function deleteAvatar(filename: string): Promise<void> {
  if (!filename) return
  const path = join(avatarsDir(), filename)
  if (existsSync(path)) await unlink(path)
}

export function getAvatarPath(filename: string): string {
  return join(avatarsDir(), filename)
}
