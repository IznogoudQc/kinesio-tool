/**
 * Modèles de courriel par défaut, PARTAGÉS entre le renderer (aperçu / éditeur
 * des Réglages) et le main (défaut servi par l'IPC settings). Variables
 * remplacées à l'envoi : {{client_name}}, {{date}}, {{coach_name}}, {{signature}}.
 */

export interface EmailTemplate {
  subject: string
  body: string
}

/** Courriel d'envoi du BILAN (rapport PDF + document interactif). */
export const DEFAULT_BILAN_EMAIL: EmailTemplate = {
  subject: 'Bilan de forme physique - {{client_name}}',
  body:
    'Bonjour {{client_name}},\n\n' +
    'Vous trouverez ci-joint votre bilan de forme physique daté du {{date}}, sous deux formes.\n\n' +
    '1. Le rapport PDF — la version complète, à consulter, imprimer ou conserver.\n\n' +
    '2. Le document interactif (fichier .html) — ouvrez-le dans votre navigateur en double-cliquant dessus. ' +
    "Vous pourrez y explorer vos résultats, passer d'un bilan à l'autre et suivre votre progression dans le temps. " +
    "Il fonctionne sans connexion Internet, et aucune de vos données n'est transmise : tout est contenu dans le fichier.\n\n" +
    "N'hésitez pas à me contacter pour toute question.\n\n" +
    '{{signature}}'
}

/** Courriel d'envoi du DOCUMENT NUTRITION (plan + journal alimentaire). */
export const DEFAULT_NUTRITION_EMAIL: EmailTemplate = {
  subject: 'Votre plan nutrition - {{client_name}}',
  body: `Bonjour {{client_name}},

Vous trouverez ci-joint votre plan nutrition, en deux fichiers :

1. Le document nutrition (.html) — ouvrez-le dans votre navigateur en double-cliquant dessus. Il rassemble votre objectif, vos macros, votre planning de jeûne, l'hydratation, les aliments à privilégier et vos idées de menu. Il fonctionne sans connexion.

2. Le journal alimentaire (.html) — à imprimer et à remplir au fil de la semaine pour noter ce que vous mangez, puis à rapporter à votre prochaine rencontre.

Au plaisir de suivre vos progrès,

{{signature}}`
}
