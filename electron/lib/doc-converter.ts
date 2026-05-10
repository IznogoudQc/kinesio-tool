import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import log from 'electron-log'

/** Emplacements habituels du binaire LibreOffice (Windows / Linux / macOS). */
const SOFFICE_PATHS = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice'
]

function findLibreOffice(): string | null {
  return SOFFICE_PATHS.find(p => existsSync(p)) ?? null
}

/** Conversion via Microsoft Word (COM, Windows uniquement). */
async function convertViaWord(docPath: string, outputPath: string): Promise<void> {
  if (process.platform !== 'win32') throw new Error('Word disponible uniquement sur Windows')
  const psScript = `
    $ErrorActionPreference = 'Stop'
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    try {
      $doc = $word.Documents.Open('${docPath.replace(/'/g, "''")}', $false, $true)
      $doc.SaveAs([ref]'${outputPath.replace(/'/g, "''")}', [ref]16)
      $doc.Close()
      exit 0
    } catch { Write-Error $_.Exception.Message; exit 1 }
    finally { $word.Quit() }
  `.trim()
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], { windowsHide: true })
    let stderr = ''
    ps.stderr.on('data', d => (stderr += d.toString()))
    ps.on('close', code =>
      code === 0 && existsSync(outputPath) ? resolve() : reject(new Error(stderr.trim() || `Word a échoué (code ${code})`))
    )
    ps.on('error', reject)
  })
}

/** Conversion via LibreOffice (`soffice --headless`). */
async function convertViaLibreOffice(docPath: string, outputDir: string): Promise<string> {
  const soffice = findLibreOffice()
  if (!soffice) throw new Error('LibreOffice introuvable')
  return new Promise((resolve, reject) => {
    const proc = spawn(soffice, ['--headless', '--convert-to', 'docx', '--outdir', outputDir, docPath], {
      windowsHide: true
    })
    let stderr = ''
    proc.stderr.on('data', d => (stderr += d.toString()))
    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || 'Conversion LibreOffice échouée'))
        return
      }
      // LibreOffice écrit `<nom-original>.docx` dans outputDir
      const baseName = docPath.split(/[/\\]/).pop()!.replace(/\.doc$/i, '.docx')
      const expectedPath = join(outputDir, baseName)
      if (existsSync(expectedPath)) resolve(expectedPath)
      else reject(new Error('Fichier .docx non produit par LibreOffice'))
    })
    proc.on('error', reject)
  })
}

/**
 * Convertit un `.doc` en `.docx` dans un fichier temporaire et retourne son chemin.
 * Stratégie : Word d'abord (rapide, Windows), sinon LibreOffice. L'appelant est
 * responsable de supprimer le fichier temporaire après usage.
 */
export async function convertDocToDocx(docPath: string): Promise<string> {
  const outputDir = tmpdir()
  const outputPath = join(outputDir, `kinesio-${randomUUID()}.docx`)

  // Essai 1 : Microsoft Word (rapide sur Windows)
  if (process.platform === 'win32') {
    try {
      await convertViaWord(docPath, outputPath)
      return outputPath
    } catch (err) {
      log.warn('[doc-converter] Word indisponible, repli sur LibreOffice :', (err as Error).message)
    }
  }

  // Essai 2 : LibreOffice
  try {
    return await convertViaLibreOffice(docPath, outputDir)
  } catch (err) {
    log.warn('[doc-converter] LibreOffice indisponible :', (err as Error).message)
    throw new Error(
      'Conversion .doc → .docx impossible : ni Microsoft Word ni LibreOffice ne sont installés. ' +
        'Installez l\'un des deux (LibreOffice est gratuit : https://www.libreoffice.org), ' +
        'ou ré-enregistrez le bilan au format .docx depuis Word.'
    )
  }
}
