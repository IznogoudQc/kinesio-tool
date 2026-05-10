import { app } from 'electron'
import { join } from 'node:path'
import { mkdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

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
 * Optimise l'image source (recadrage carré 512×512, conversion WebP q85) et
 * l'écrit dans le dossier des avatars. Supprime l'ancienne photo si fournie.
 * Retourne le nom du fichier créé (à stocker en DB).
 */
export async function saveAvatar(sourcePath: string, oldFilename?: string | null): Promise<string> {
  await ensureAvatarsDir()
  if (oldFilename) await deleteAvatar(oldFilename)
  const filename = `${randomUUID()}.webp`
  const destPath = join(avatarsDir(), filename)
  await sharp(sourcePath)
    .rotate() // respecte l'orientation EXIF avant le recadrage
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .webp({ quality: 85 })
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
