# 0046 — Un brouillon local pour les questionnaires en cours de saisie

Statut : acceptée — 2026-10-15

## Contexte

Marie a perdu un questionnaire à moitié rempli en fermant l'application. Rien
n'était enregistré : l'onglet Questionnaires tient toute la saisie dans un seul
état React (`editing`), et ne descend en base qu'au clic sur « Enregistrer ».
Fermer la fenêtre, ou cliquer « Annuler » par mégarde, et vingt minutes de
saisie disparaissent sans un mot.

La garde de navigation (`useBlocker`) ne protégeait que les déplacements
*internes* à l'application. La fermeture de la fenêtre Electron ne passe pas par
le routeur : elle n'était pas couverte, et c'est précisément par là que la
perte est arrivée.

Un questionnaire de santé se remplit avec le client en face de soi, en
interrompant pour parler. C'est la saisie la plus longue de l'application et la
plus susceptible d'être laissée en plan.

## Décision

**Chaque modification du formulaire est recopiée dans un brouillon**, et
l'onglet le propose au retour.

Trois choix dans cette décision.

**Un brouillon n'est pas un questionnaire.** Il ne descend pas en base,
n'apparaît pas dans l'historique, n'entre dans aucun rapport et n'est jamais
archivé. Un formulaire à trois réponses sur vingt n'a rien à dire du client, et
l'historique est un dossier, pas un chantier. Écrire une ligne en base à chaque
frappe aurait aussi fait apparaître des Q-AAP non signés dans le dossier, que
l'archivage automatique aurait eu à traiter.

**Il vit dans le stockage local de la fenêtre**, sous
`kinesio.questionnaire-brouillon.<clientId>.<type>` — à côté des autres
préférences d'affichage, qui y sont déjà. Une clé par client **et** par type :
sans le type, ouvrir un Q-AAP écraserait le questionnaire de santé commencé la
veille ; sans le client, le brouillon de l'un se proposerait chez l'autre, le
pire défaut possible dans un dossier de santé.

**Il est proposé, jamais restauré d'office.** Un formulaire qui se remplirait
tout seul à l'ouverture de l'onglet laisserait Marie dans le doute sur ce
qu'elle a réellement enregistré. Une bande dorée annonce la saisie et sa date :
« Reprendre » ou « Jeter ».

Les décisions (clé, péremption, comparaison de contenus, mise en forme de
l'heure) vivent dans `src/lib/questionnaire-brouillon.ts`, sans React ni
Electron, et sont couvertes par 20 tests.

## Conséquences

**Un brouillon ne suit ni la sauvegarde OneDrive ni un transfert de poste.** Le
stockage local n'est pas dans le fichier SQLite. C'est assumé : un brouillon
protège la demi-heure de saisie en cours, pas le dossier du client — c'est
l'enregistrement qui fait cela. Transférer un chantier d'un poste à l'autre n'a
aucun sens pour Marie, qui travaille sur un seul portable.

**Un brouillon de plus de 30 jours n'est plus proposé** (`PEREMPTION_JOURS`). Un
questionnaire se remplit en une séance, parfois deux. Un brouillon de six
semaines n'est pas une saisie interrompue mais un formulaire ouvert puis oublié,
et le proposer ferait douter Marie de ce qu'elle a enregistré.

**Une recopie qui échoue ne fait pas tomber la saisie.** Un stockage saturé rend
`null` au lieu de lever, et l'onglet le dit en rouge : « Enregistrez avant de
fermer l'application. » Perdre le brouillon est fâcheux ; vider le formulaire à
l'écran parce qu'une recopie a levé serait exactement le défaut qu'on répare.

**« Annuler » demande confirmation** quand le formulaire a bougé — il est voisin
de « Enregistrer », et ce qu'il jette ne se retrouve nulle part. Un formulaire
intouché se referme sans question, et ne retient plus la navigation non plus.

**Le texte de la garde de navigation change de sens.** Il annonçait une perte ;
il annonce maintenant un brouillon. Laisser l'ancien avertissement pousserait
Marie à enregistrer un formulaire à moitié rempli par crainte de le perdre —
soit un faux questionnaire dans le dossier, l'inverse du but.

## Écartées

**Enregistrer en base à chaque frappe, avec un drapeau « brouillon ».** Plus
durable, mais une migration, un canal IPC, un service, et surtout un état
intermédiaire que tout lecteur du dossier devrait désormais filtrer :
historique, rapports, archivage du Q-AAP, export, transfert. Un chantier
visible partout pour protéger une demi-heure de saisie.

**Un `beforeunload` qui retient la fermeture de la fenêtre.** Une fenêtre qui
refuse de se fermer est une mauvaise réponse à « j'ai perdu mes données » : la
recopie continue rend la question inutile, et Marie retrouve sa saisie au
retour sans avoir eu à répondre à quoi que ce soit.
