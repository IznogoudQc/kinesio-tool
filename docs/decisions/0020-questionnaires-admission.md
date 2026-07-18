# ADR 0020 — Section Questionnaires d'admission (Q-AAP en premier)

**Statut** : Accepté
**Date** : 2026-07-17

## Contexte

Marie remplit à la main plusieurs formulaires d'admission papier avant de travailler avec un client :
le **Q-AAP** (Questionnaire sur l'aptitude à l'activité physique / PAR-Q, standard SCPE), un
**questionnaire de santé** (blessures musculo-squelettiques, zones de tension) et une fiche
**objectifs & habitudes de vie**. Elle veut les numériser dans l'app.

Décidé avec Nicholas : **commencer par le Q-AAP**, formulaires **datés avec historique** (comme les
bilans), schéma corporel du questionnaire de santé simplifié (cases + texte) — à faire plus tard.

## Décision

Une **section « Questionnaires »** = nouvel onglet client, sur le patron Bilans/Notes.

- **Stockage** : une seule table `questionnaires` (`id`, `client_id` FK cascade, `type`, `date`,
  `data` JSON, `created_at`, `updated_at`), migration Drizzle `0024`. Le champ **`type`** discrimine le
  formulaire (`'qaap'` pour l'instant ; `'sante'`, `'objectifs'` à venir) et **`data`** porte le JSON
  propre à chaque type. Un seul modèle de données pour tous les questionnaires → ajouter un type =
  ajouter un schéma zod + un formulaire, sans migration.
- **Logique pure** `src/lib/qaap.ts` (+ test) : les 7 questions officielles SCPE, réponses tri-état
  (OUI/NON/non répondu), `qaapHasWarning` (un seul « OUI » ⇒ recommandation médicale), et la
  **validité 12 mois** (`qaapExpiryDate` / `qaapIsExpired`, robuste au 29 février).
- **IPC** `electron/ipc/questionnaires.ts` : `list|create|update|delete|get-by-id` (zod, validation
  du `data` par `type`). Préload + `window.api.questionnaires` + service
  `src/services/questionnaires.ts` (architecture API-ready, ADR 0002).
- **UI** `src/pages/client/tabs/QuestionnairesTab.tsx` : bouton « Nouveau Q-AAP », formulaire 7
  questions Oui/Non + bannière d'alerte si un « OUI » + précisions, historique antéchronologique
  (statut « OUI » / « aucun OUI », badge validité/expiré). Garde `useBlocker` (ADR 0017).

## Conséquences

- **+** Numérise l'admission ; historique daté ; réutilise les patrons existants (CRUD, blocker).
- **+** Modèle extensible : les 2 autres questionnaires s'ajoutent sans changer la table.
- **+** Le Q-AAP apporte une vraie valeur clinique : alerte automatique « consulter un médecin » et
  suivi de la validité 12 mois.
- **−** Pas (encore) de signature électronique ni de rendu PDF du Q-AAP — la valeur légale reste au
  papier signé pour l'instant ; à évaluer plus tard.
- **−** Le schéma corporel du questionnaire de santé sera simplifié (cases + texte), pas une carte
  cliquable fidèle au papier.
