import sharp from 'sharp'

/**
 * Retire le fond uniforme d'une image (typiquement blanc/cream) en le rendant
 * transparent. Échantillonne les 4 coins pour détecter la couleur de fond,
 * puis met l'alpha à 0 pour tous les pixels dans la tolérance.
 *
 * @param inputBuffer Buffer de l'image source (PNG/JPG/WEBP)
 * @param tolerance Tolérance RGB pour considérer un pixel comme "fond" (0-255, défaut 30)
 * @returns Buffer PNG avec fond transparent
 */
export async function removeUniformBackground(inputBuffer: Buffer, tolerance = 30): Promise<Buffer> {
  // Lire l'image en raw RGBA
  const { data, info } = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  const { width, height } = info

  // Échantillonner les 4 coins + 4 points proches des coins pour détecter la couleur de fond
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [5, 5],
    [width - 6, 5],
    [5, height - 6],
    [width - 6, height - 6]
  ]

  let bgR = 0,
    bgG = 0,
    bgB = 0
  for (const [x, y] of corners) {
    const idx = (y * width + x) * 4
    bgR += data[idx]
    bgG += data[idx + 1]
    bgB += data[idx + 2]
  }
  bgR = Math.round(bgR / corners.length)
  bgG = Math.round(bgG / corners.length)
  bgB = Math.round(bgB / corners.length)

  console.log(`[bg-remover] Couleur de fond détectée: RGB(${bgR}, ${bgG}, ${bgB})`)

  // Mettre alpha=0 pour les pixels proches du fond
  let transparentCount = 0
  for (let i = 0; i < data.length; i += 4) {
    const dr = Math.abs(data[i] - bgR)
    const dg = Math.abs(data[i + 1] - bgG)
    const db = Math.abs(data[i + 2] - bgB)
    if (dr < tolerance && dg < tolerance && db < tolerance) {
      data[i + 3] = 0
      transparentCount++
    }
  }

  const total = width * height
  console.log(
    `[bg-remover] Transparence: ${transparentCount}/${total} pixels (${((100 * transparentCount) / total).toFixed(1)}%)`
  )

  return await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer()
}
