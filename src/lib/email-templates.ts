/**
 * Modèles de courriel par défaut, PARTAGÉS entre le renderer (aperçu / éditeur
 * des Réglages) et le main (défaut servi par l'IPC settings). Variables
 * remplacées à l'envoi : {{client_name}}, {{date}}, {{coach_name}}, {{signature}}.
 */

/**
 * ── Pourquoi jamais « double-cliquez » ─────────────────────────────────────
 *
 * Sur Windows, un .html s'ouvre avec l'application ASSOCIÉE à ce type de
 * fichier. Dès qu'un éditeur (VS Code, Bloc-notes, Notepad++) a pris
 * l'association — souvent sans que la personne l'ait voulu — le double-clic
 * affiche le code source. Des clientes et clients de Marie-Eve s'y sont
 * heurtés.
 *
 * Le clic droit → « Ouvrir avec » fonctionne quelle que soit l'association.
 * C'est la seule consigne à donner dans ces modèles.
 */

export interface EmailTemplate {
  subject: string
  body: string
}

/**
 * La consigne d'ouverture qui échouait, et celle qui la remplace.
 *
 * Un modèle enregistré une seule fois ne repasse plus jamais par le texte par
 * défaut : corriger les constantes ci-dessous ne suffisait donc pas. Une reprise
 * au démarrage (`electron/lib/fix-email-open-hint.ts`) applique la même règle
 * aux modèles déjà en base.
 *
 * Elle vit ICI, avec les textes, pour qu'une future reformulation ne laisse pas
 * la reprise pointer sur une phrase qui n'existe plus.
 */
const ANCIENNE_CONSIGNE = 'ouvrez-le dans votre navigateur en double-cliquant dessus'

const NOUVELLE_CONSIGNE =
  'enregistrez-le, puis faites un clic droit dessus et choisissez « Ouvrir avec » → Chrome, Edge ou Firefox'

/**
 * Corrige un corps de courriel enregistré, ou rend `null` s'il n'y a rien à
 * corriger.
 *
 * UNE phrase, remplacée là où elle apparaît : un modèle réécrit dans les mots de
 * Marie-Eve ne la contient pas et n'est donc pas modifié.
 */
export function corrigerConsigneOuverture(body: string): string | null {
  if (!body.includes(ANCIENNE_CONSIGNE)) return null
  return body.split(ANCIENNE_CONSIGNE).join(NOUVELLE_CONSIGNE)
}

/** Courriel d'envoi du BILAN (rapport PDF + document interactif). */
export const DEFAULT_BILAN_EMAIL: EmailTemplate = {
  subject: 'Bilan de forme physique - {{client_name}}',
  body:
    'Bonjour {{client_name}},\n\n' +
    'Vous trouverez ci-joint votre bilan de forme physique daté du {{date}}, sous deux formes.\n\n' +
    '1. Le rapport PDF — la version complète, à consulter, imprimer ou conserver.\n\n' +
    '2. Le document interactif (fichier .html) — enregistrez-le, puis faites un clic droit dessus et choisissez « Ouvrir avec » → Chrome, Edge ou Firefox. ' +
    "Vous pourrez y explorer vos résultats, passer d'un bilan à l'autre et suivre votre progression dans le temps. " +
    "Il fonctionne sans connexion Internet, et aucune de vos données n'est transmise : tout est contenu dans le fichier.\n\n" +
    "N'hésitez pas à me contacter pour toute question.\n\n" +
    '{{signature}}'
}

/**
 * Copie que la coach s'envoie à elle-même. Court par construction : elle sait
 * déjà ce qu'elle s'envoie et pourquoi. Ce qui compte, c'est de retrouver le
 * courriel dans sa boîte — d'où le nom du client et la date dans le sujet.
 */
export const DEFAULT_COPIE_BILAN_EMAIL: EmailTemplate = {
  subject: 'Bilan - {{client_name}} - {{date}}',
  body: 'Bilan de {{client_name}} du {{date}}.\n\nRapport PDF et document interactif ci-joints.'
}

/** Copie à soi-même du document nutrition. */
export const DEFAULT_COPIE_NUTRITION_EMAIL: EmailTemplate = {
  subject: 'Nutrition - {{client_name}} - {{date}}',
  body: 'Plan nutrition de {{client_name}} du {{date}}.\n\nDocument nutrition et journal alimentaire ci-joints.'
}

/**
 * Courriel d'envoi du SUIVI DES MESURES (PDF + document HTML).
 *
 * Texte par défaut : Marie-Eve le modifie dans Paramètres → Courriel, comme
 * ceux du bilan et de la nutrition. C'est aussi celui que rend le bouton
 * « Rétablir le texte par défaut ».
 */
export const DEFAULT_MESURES_EMAIL: EmailTemplate = {
  subject: 'Vos mesures - {{client_name}}',
  body:
    'Bonjour {{client_name}},\n\n' +
    'Vous trouverez ci-joint le suivi de vos mesures, sous deux formes.\n\n' +
    '1. Le PDF — à consulter, imprimer ou conserver.\n\n' +
    '2. Le document interactif (fichier .html) — enregistrez-le, puis faites un clic droit dessus et choisissez « Ouvrir avec » → Chrome, Edge ou Firefox. ' +
    "Il montre chaque mesure et son évolution depuis la première prise, fonctionne sans connexion Internet, et aucune de vos données n'est transmise : tout est contenu dans le fichier." + '\n\n' +
    "N'hésitez pas à me contacter pour toute question." + '\n\n' +
    '{{signature}}'
}

/** Copie à soi-même du suivi des mesures. */
export const DEFAULT_COPIE_MESURES_EMAIL: EmailTemplate = {
  subject: 'Mesures - {{client_name}} - {{date}}',
  body: 'Suivi des mesures de {{client_name}} du {{date}}.\n\nPDF et document interactif ci-joints.'
}

/** Courriel d'envoi du DOCUMENT NUTRITION (plan + journal alimentaire). */
export const DEFAULT_NUTRITION_EMAIL: EmailTemplate = {
  subject: 'Votre plan nutrition - {{client_name}}',
  body: `Bonjour {{client_name}},

Vous trouverez ci-joint votre plan nutrition, en trois fichiers :

1. Le PDF — la version complète, à consulter, imprimer ou conserver.

2. Le document interactif (.html) — le même contenu, à lire à l'écran : enregistrez-le, puis faites un clic droit dessus et choisissez « Ouvrir avec » → Chrome, Edge ou Firefox. Il rassemble votre objectif, vos macros, votre planning de jeûne, l'hydratation, les aliments à privilégier et vos idées de menu, et fonctionne sans connexion.

3. Le journal alimentaire (PDF) — à imprimer et à remplir au fil de la semaine pour noter ce que vous mangez, puis à rapporter à votre prochaine rencontre.

Au plaisir de suivre vos progrès,

{{signature}}`
}
