/**
 * Replie `out/standalone/standalone.html` + son JS + son CSS en un unique
 * fichier `out/standalone/template.html`, sans aucune requête réseau.
 * Évite une dépendance (vite-plugin-singlefile) pour une trentaine de lignes.
 */
import { readFile, writeFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const dir = join(process.cwd(), 'out', 'standalone')
const htmlPath = join(dir, 'standalone.html')
if (!existsSync(htmlPath)) {
  console.error('inline-standalone: build introuvable —', htmlPath)
  process.exit(1)
}

let html = await readFile(htmlPath, 'utf-8')
const js = await readFile(join(dir, 'app.js'), 'utf-8')
const css = existsSync(join(dir, 'app.css')) ? await readFile(join(dir, 'app.css'), 'utf-8') : ''

// `</script>` dans une chaîne JS fermerait la balise hôte prématurément.
const safeJs = js.replace(/<\/script>/gi, '<\/script>')

// Remplacement par FONCTION, jamais par chaîne : `$&`, `` $` `` et `$'` sont des
// motifs spéciaux de String.replace, et le bundle minifié en contient.
html = html.replace(/<link[^>]*href="[^"]*app\.css"[^>]*>/, () => (css ? `<style>${css}</style>` : ''))
html = html.replace(/<script[^>]*src="[^"]*app\.js"[^>]*><\/script>/, () => `<script type="module">${safeJs}</script>`)

// Ne cherche que des attributs pointant vers les fichiers qu'on vient d'inliner.
if (/(?:src|href)="[^"]*app\.(?:js|css)"/.test(html)) {
  console.error('inline-standalone: une référence externe subsiste dans le HTML.')
  process.exit(1)
}

await writeFile(join(dir, 'template.html'), html, 'utf-8')
await rm(htmlPath)
await rm(join(dir, 'app.js'))
if (css) await rm(join(dir, 'app.css'))
console.log(`inline-standalone: template.html écrit (${Math.round(html.length / 1024)} Ko)`)
