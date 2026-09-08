/**
 * Reprise unique au démarrage : corrige la consigne d'ouverture du fichier
 * `.html` dans les modèles de courriel DÉJÀ ENREGISTRÉS.
 *
 * ── Pourquoi ────────────────────────────────────────────────────────────────
 *
 * Nos modèles disaient « ouvrez-le dans votre navigateur en double-cliquant
 * dessus ». Sur Windows, un `.html` s'ouvre avec l'application ASSOCIÉE à ce
 * type de fichier : dès qu'un éditeur (VS Code, Bloc-notes, Notepad++) a pris
 * l'association, le double-clic affiche le code source. Des clientes et clients
 * de Marie-Eve s'y sont heurtés.
 *
 * Le texte par défaut est corrigé (v0.9.211), mais un modèle enregistré une
 * seule fois — même sans l'avoir réécrit — ne repasse plus jamais par le
 * défaut. Sans cette reprise, le courriel du bilan continuerait d'envoyer la
 * consigne qui échoue.
 *
 * ── Ce qu'elle touche, et rien d'autre ──────────────────────────────────────
 *
 * UNE phrase, remplacée à l'identique là où elle apparaît. Un modèle réécrit
 * par Marie-Eve dans ses propres mots ne contient pas cette phrase : il n'est
 * pas modifié. Le sujet n'est jamais touché.
 *
 * La règle elle-même (quelle phrase, remplacée par quoi) vit dans
 * `src/lib/email-templates.ts`, avec les textes qu'elle corrige : une future
 * reformulation ne peut donc pas laisser cette reprise pointer sur une phrase
 * disparue. Ici, il ne reste que la partie base de données.
 *
 * Idempotent et protégée par un drapeau `settings` — elle ne s'exécute qu'une
 * fois, et une deuxième exécution ne trouverait de toute façon plus rien.
 */
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { settings } from '../../db/schema'
import { corrigerConsigneOuverture } from '../../src/lib/email-templates'

const FLAG = 'fix.email_open_hint_v1'

/** Les trois modèles éditables (bilan, nutrition, suivi des mesures). */
const CLES_MODELES = ['email.template', 'email.template_nutrition', 'email.template_mesures']

/** Applique la correction aux modèles enregistrés. Ne s'exécute qu'une fois. */
export function fixEmailOpenHintOnce(): void {
  const db = getDb()
  if (db.select().from(settings).where(eq(settings.key, FLAG)).get()) return

  let corriges = 0
  for (const cle of CLES_MODELES) {
    const ligne = db.select().from(settings).where(eq(settings.key, cle)).get()
    if (!ligne) continue
    try {
      const modele = JSON.parse(ligne.value) as { subject?: unknown; body?: unknown }
      if (typeof modele.body !== 'string') continue
      const corrige = corrigerConsigneOuverture(modele.body)
      if (corrige === null) continue
      db.update(settings)
        .set({ value: JSON.stringify({ ...modele, body: corrige }), updatedAt: new Date().toISOString() })
        .where(eq(settings.key, cle))
        .run()
      corriges++
    } catch {
      // Valeur illisible : on la laisse telle quelle plutôt que de la réécrire.
    }
  }

  db.insert(settings)
    .values({ key: FLAG, value: `modeles:${corriges}`, updatedAt: new Date().toISOString() })
    .run()
}
