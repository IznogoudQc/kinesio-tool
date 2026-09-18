# ADR 0041 — Sauvegarde quotidienne du dossier complet vers OneDrive

**Statut** : Accepté
**Date** : 2026-09-18
**Version** : v0.9.219

> Numérotation : la spec de départ demandait « ADR 0012 ». Ce numéro est libre
> (un creux entre [[0011-refonte-rapport-pdf]] et [[0013-tables-cpafla]]) mais il
> daterait de mai 2026 une décision de septembre. Les ADR se numérotent dans
> l'ordre où elles sont prises, donc 0041.

**Amende [[0003-strategie-loi25-minimisation]]** — voir « Conséquence Loi 25 »
plus bas. Ce n'est pas un détail : la 0003 affirmait que l'app « ne transmet
aucune donnée à un tiers », et ce n'est plus vrai.

## Contexte

Tout vit sur le PC de Marie-Eve : `kinesio.db`, les photos, les documents
générés. C'est le fondement de [[0003-strategie-loi25-minimisation]] et ça a bien
servi. Mais ça veut dire qu'un seul événement — PC volé, SSD mort, rançongiciel —
efface la totalité des dossiers clients, y compris les bilans importés de
l'ancien logiciel qui remontent à 2011 et n'existent plus ailleurs.

L'app savait déjà exporter et réimporter des dossiers (`.kinesio`,
`ipc/transfer.ts`), mais seulement à la main, client par client, sur un geste
explicite. Une sauvegarde qui dépend d'un geste quotidien n'a jamais lieu.

## Décision

**Un fichier `.kinesio` de TOUT le dossier, écrit chaque jour dans OneDrive.**

- Dossier : `<racine OneDrive>\Kinesio-Outils\backups\`
- Nom : `kinesio-backup-AAAA-MM-JJ.kinesio` (un par journée, réécrit si relancé)
- Contenu : le même bundle que l'export manuel — clients, bilans,
  circonférences, plis, notes, questionnaires (donc les signatures), photos en
  base64. Un seul constructeur pour les deux
  (`lib/client-bundle-builder.ts`), pour qu'une colonne ajoutée au schéma ne
  puisse pas se retrouver dans l'export et manquer dans la sauvegarde.
- Déclenchement : 5 s après le démarrage de l'app, si la dernière réussie a plus
  de **20 h**. Pas 24 h : à 24 h, une app ouverte chaque matin à la même heure
  raterait un jour sur deux.
- Rétention : **7 journées + une par semaine sur 8 semaines**
  (`src/lib/backup-retention.ts`, module pur et testé).
- Restauration : import manuel du dernier `.kinesio` depuis OneDrive, par le
  chemin d'import qui existe déjà. Rien de neuf à écrire, rien de neuf à tester
  le jour où ça compte.
- Mode d'emploi : un `COMMENT-RESTAURER.txt` réécrit à côté des sauvegardes à
  chaque passage (`lib/backup-memo.ts`). Une sauvegarde qu'on ne sait pas relire
  n'est pas une sauvegarde, et le jour où elle sert **l'app n'est pas
  installée** — il ne reste qu'un PC neuf, un dossier synchronisé, et quelqu'un
  qui cherche quoi faire. D'où un `.txt` que le Bloc-notes ouvre, et non une page
  d'aide dans l'app. Il porte le chemin RÉEL du dossier (le nom d'utilisateur
  Windows n'est pas forcément le même sur le nouveau PC) et cite les libellés
  exacts des boutons — un test le vérifie contre `ClientsPage`, parce qu'un mode
  d'emploi qui nomme un bouton inexistant est pire que pas de mode d'emploi.
  Écrit en UTF-8 **avec BOM** et en CRLF : sans ça, le Bloc-notes d'un Windows
  plus ancien rend les accents et le cadre en charabia. La même procédure est
  dépliable dans les Paramètres, pour que Marie sache que le fichier existe avant
  d'en avoir besoin.

### Pas d'API Microsoft

On écrit dans un dossier local ; le client OneDrive de Windows téléverse. Donc
aucun OAuth, aucun jeton à renouveler, rien qui puisse expirer en silence et
laisser Marie sans sauvegarde pendant six mois sans qu'elle le sache.

La détection du dossier (`lib/onedrive.ts`) essaie, dans l'ordre : les variables
`%OneDrive%` / `%OneDriveConsumer%` / `%OneDriveCommercial%`, puis le registre
(`HKCU\Software\Microsoft\OneDrive\Accounts`, tous les comptes), puis
`%USERPROFILE%\OneDrive`. Si rien n'est trouvé, **la sauvegarde se désactive et
le dit dans les Paramètres** — elle n'écrit pas ailleurs, parce qu'un dossier
`Kinesio-Outils` posé hors de OneDrive ne serait jamais synchronisé et donnerait
une fausse impression de sécurité.

### Écriture en deux temps

Fichier `.part` puis renommage dans le même dossier. OneDrive surveille le
dossier et téléverse dès qu'un fichier apparaît : écrire directement sous le nom
final lui donnerait à synchroniser un JSON tronqué, et c'est cette version
tronquée qui attendrait dans le nuage.

## Conséquence Loi 25 — ce qui change pour Marie

[[0003-strategie-loi25-minimisation]] éliminait plusieurs obligations en
s'appuyant sur un fait : aucune donnée ne quitte le PC. **Cette ADR casse ce
fait**, volontairement.

Les données sont des renseignements personnels de santé. Elles partent en clair
chez Microsoft, donc **hors Québec** pour un compte OneDrive grand public. Ce qui
en découle, et qui appartient à Marie (pas à l'app ni au développeur) :

- une **EFVP** (évaluation des facteurs relatifs à la vie privée) est requise
  pour une communication de renseignements personnels hors Québec — c'était le
  premier point que la 0003 listait comme éliminé ;
- BitLocker, que la 0003 recommandait, protège le disque local mais **pas** la
  copie OneDrive ;
- le registre des incidents et l'obligation de déclaration à la CAI couvrent
  maintenant aussi une compromission du compte Microsoft.

L'app dit la vérité là-dessus à l'écran : la carte des Paramètres indique que les
fichiers sont en clair et synchronisés chez Microsoft, hors Québec. Marie peut
désactiver la sauvegarde d'une case à cocher.

## Alternatives rejetées

**API Microsoft Graph.** OAuth, jetons à rafraîchir, application à enregistrer
chez Microsoft, consentement à re-donner. Tout ça pour écrire un fichier que le
client OneDrive déjà installé sait synchroniser. Et un jeton qui expire est un
échec silencieux — le pire mode de panne pour une sauvegarde.

**Chiffrement AES avec passphrase.** Rejeté après discussion avec Marie. Une
passphrase oubliée rend la sauvegarde inutile le jour précis où elle sert, et
c'est le scénario le plus probable : on la cherche trois ans après l'avoir posée,
dans l'urgence, sur un PC neuf. Une sauvegarde en clair qui s'ouvre vaut mieux
qu'un chiffrement parfait qu'on ne peut plus lire. Le jour où ça devient
insuffisant, la piste est un mot de passe rangé dans le trousseau Windows
(`keytar` est déjà une dépendance pour le SMTP) plutôt qu'une passphrase à
mémoriser.

**Sauvegarde à la fermeture de l'app** plutôt qu'au démarrage. Rejeté : la
fermeture est le moment où l'utilisatrice veut que ça s'arrête, et un processus
qui s'attarde pour écrire quelques mégaoctets ressemble à une app qui plante.

**Copier `kinesio.db` directement.** Plus simple, mais un fichier SQLite copié
pendant qu'il est ouvert peut être incohérent, et le `.kinesio` a un avantage
décisif : le chemin de restauration existe déjà et est déjà testé.

## Conséquences

**Positives**

- Un vol de PC coûte au pire une journée de saisie, pas quinze ans de dossiers.
- Aucune dépendance nouvelle, aucun compte à créer, aucun jeton à surveiller.
- Le chemin de restauration est celui de l'import, donc éprouvé.
- L'export manuel et la sauvegarde partagent un constructeur : ils ne peuvent
  plus diverger.

**Négatives**

- Les obligations Loi 25 de Marie s'alourdissent (voir plus haut).
- Sans OneDrive, la fonction n'existe pas — aucun repli (pas de choix de dossier
  arbitraire, par choix : voir plus haut).
- Le fichier contient tout, donc grossit avec le dossier. À l'échelle d'une
  pratique individuelle avec photos en `.webp`, ça reste des mégaoctets.
- Un poste partagé par deux Windows différents sauvegarderait dans deux OneDrive
  différents. Non traité : Marie travaille seule sur son PC.
