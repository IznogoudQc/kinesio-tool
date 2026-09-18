/**
 * Le mode d'emploi de restauration, déposé à côté des sauvegardes.
 *
 * Il existe parce qu'une sauvegarde qu'on ne sait pas relire n'est pas une
 * sauvegarde. Le jour où il sert, l'app n'est PAS installée — il n'y a qu'un PC
 * neuf, un dossier OneDrive synchronisé, et quelqu'un qui cherche quoi faire.
 * D'où un `.txt` lisible dans le Bloc-notes, et non une page d'aide dans l'app.
 *
 * Module séparé du service pour une seule raison : le texte se teste. Les
 * libellés qu'il cite (« Importer », « Fusionner ») sont ceux des boutons réels
 * de `ClientsPage` — un mode d'emploi qui nomme un bouton inexistant est pire
 * que pas de mode d'emploi, donc `backup-memo.test.ts` le vérifie.
 */

/**
 * Largeur du cadre et des filets, en caractères.
 *
 * 76 et non 66 : la ligne de texte la plus longue du mémo en fait 73, et un filet
 * plus court que le paragraphe qu'il souligne donne l'impression d'un fichier
 * abîmé. `backup-memo.test.ts` vérifie qu'aucune ligne ne dépasse.
 */
const LARGEUR = 76

const RELEASES_URL = 'https://github.com/IznogoudQc/kinesio-tool/releases'
const CONTACT = 'njean9@gmail.com'

/** Une ligne du cadre : `║ texte …espaces… ║`, toujours de la même largeur. */
function encadre(texte: string): string {
  return `║ ${texte.padEnd(LARGEUR - 4)} ║`
}

function regle(char = '─'): string {
  return char.repeat(LARGEUR)
}

/**
 * Le texte du mémo.
 *
 * `dossier` est écrit tel quel : Marie a le VRAI chemin sous les yeux, pas un
 * `C:\\Users\\<ton nom>\\…` à compléter — sur un PC neuf, le nom d'utilisateur
 * Windows n'est pas forcément le même que sur l'ancien.
 */
export function memoRestauration(dossier: string, maintenant: Date): string {
  const date = maintenant.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })

  const lignes = [
    `╔${'═'.repeat(LARGEUR - 2)}╗`,
    encadre('KINÉSIO OUTILS — COMMENT RESTAURER MES CLIENTS'),
    encadre('En cas de perte, de vol ou de remplacement du PC'),
    `╚${'═'.repeat(LARGEUR - 2)}╝`,
    '',
    'Bonjour Marie,',
    '',
    'Si tu lis ce fichier sur un NOUVEAU PC, c’est qu’il est arrivé quelque',
    'chose à l’ancien. Tous tes clients sont sauvegardés ici, dans ce dossier.',
    'Quatre étapes et tu les retrouves.',
    '',
    regle(),
    'ÉTAPE 1 — INSTALLER KINÉSIO OUTILS',
    regle(),
    `Va sur : ${RELEASES_URL}`,
    'Prends la version la plus haute de la liste, et dans ses fichiers le',
    '« .exe » (son nom ressemble à « Kinesio Outils Setup 1.2.3.exe »).',
    '',
    'Double-clique dessus. Windows va afficher « Éditeur inconnu » ou',
    '« Windows a protégé votre ordinateur » : c’est normal, l’application',
    'n’est pas signée. Clique sur « Informations complémentaires » puis sur',
    '« Exécuter quand même ».',
    '',
    'Un raccourci « Kinésio Outils » apparaît sur le Bureau.',
    '',
    regle(),
    'ÉTAPE 2 — CONNECTER ONEDRIVE',
    regle(),
    'Si OneDrive n’est pas déjà en place sur ce PC, installe-le depuis',
    'https://onedrive.live.com et connecte-toi avec LE MÊME compte Microsoft',
    'que sur l’ancien PC.',
    '',
    'Attends ensuite que la synchronisation finisse : l’icône OneDrive, en bas',
    'à droite près de l’horloge, ne doit plus tourner. Tant qu’elle tourne, le',
    'fichier de sauvegarde n’est peut-être pas encore descendu sur ce PC.',
    '',
    regle(),
    'ÉTAPE 3 — TROUVER LA DERNIÈRE SAUVEGARDE',
    regle(),
    'Elle est dans ce dossier-ci :',
    '',
    `  ${dossier}`,
    '',
    'Cherche le fichier « kinesio-backup-AAAA-MM-JJ.kinesio » dont la date est',
    'la plus récente. C’est celui-là qu’il faut.',
    '',
    regle(),
    'ÉTAPE 4 — IMPORTER DANS L’APPLICATION',
    regle(),
    'Ouvre Kinésio Outils. La liste des clients est vide, c’est attendu.',
    '',
    '  1. En haut à droite, clique sur « Importer ».',
    '  2. Une fenêtre de choix de fichier s’ouvre : sélectionne le fichier',
    '     .kinesio repéré à l’étape 3.',
    '  3. L’application montre ce qu’elle a trouvé (nombre de clients, de',
    '     bilans, de mesures). Vérifie que le compte te semble juste.',
    '  4. Clique sur « Fusionner ».',
    '',
    'Pourquoi « Fusionner » et pas « Remplacer » : sur une installation neuve',
    'les deux font la même chose, mais « Fusionner » ne supprime jamais rien.',
    'C’est le bouton sans risque, même si tu te trompes de fichier.',
    '',
    'Tes clients réapparaissent avec leurs photos, bilans, mesures, notes et',
    'questionnaires signés.',
    '',
    regle(),
    'SI QUELQUE CHOSE NE VA PAS',
    regle(),
    `Écris à Nicholas : ${CONTACT}`,
    '',
    'N’efface SURTOUT PAS les fichiers de ce dossier, même s’ils semblent ne',
    'pas fonctionner. Ce sont les seules copies.',
    '',
    regle(),
    'Ce fichier est réécrit à chaque sauvegarde.',
    `Dernière mise à jour : ${date}`,
    regle(),
    ''
  ]

  // CRLF : un .txt ouvert dans le Bloc-notes d'un Windows plus ancien affiche
  // sinon tout le mémo sur une seule ligne.
  return lignes.join('\r\n')
}

/** Nom du fichier. En majuscules pour qu'il se remarque parmi les sauvegardes. */
export const MEMO_FILENAME = 'COMMENT-RESTAURER.txt'
