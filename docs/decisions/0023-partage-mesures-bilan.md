# ADR 0023 — Partage des mesures entre Bilan et onglet Mesures

**Statut** : Accepté
**Date** : 2026-07-18

## Contexte

Un bilan complet prend aussi des mesures (poids, grandeur, circonférences, plis) ; l'onglet Mesures est « un
petit bilan non complet ». Aujourd'hui les deux stockent **séparément** — bilan dans `bilans.data` (JSON),
Mesures dans `mesures_circonferences` / `mesures_plis_cutanes`. Marie devait donc saisir deux fois. Décidé avec
Nicholas : **synchroniser à l'enregistrement**, dans les deux sens.

## Décision

Les mesures partagées sont **recopiées à l'enregistrement** vers l'autre stockage, pour la **même date**. Comme
les deux côtés stockent en **métrique** (cm, kg, mm), il n'y a **aucune conversion** — juste un renommage de
champ (`src/lib/measure-sync-map.ts`, testé) : poids, grandeur (= `taille_cm` du bilan), tour de taille/hanche,
biceps fléchi/cuisse/épaules-pec, et les 4 plis.

- **Bilan enregistré/importé → Mesures** : upsert des tables circonférences + plis pour la date (création si
  besoin ; les plis calculent le % de gras via âge + sexe).
- **Prise de Mesures enregistrée → Bilan** : fusion des champs mesures dans le bilan de la date (**création**
  d'un bilan `source: 'mesures'` si aucun n'existe — une prise de Mesures devient un bilan partiel).
- Réalisé dans le **main process** (`electron/lib/measure-sync.ts`), appelé par les handlers IPC après écriture.
  Les fonctions écrivent **directement en base** (jamais via les handlers) → **pas de boucle**.

## Conséquences

- **+** Une seule saisie ; les mesures d'un bilan apparaissent dans l'historique/les graphes de Mesures, et
  inversement.
- **+** Pas de migration ni de conversion (tout en métrique).
- **−** **Duplication** de la donnée (deux stockages) synchronisés au « dernier enregistrement gagne » par date ;
  une divergence est possible si on édite hors de ce chemin.
- **−** Une prise de Mesures autonome **crée un bilan partiel** (visible dans la liste des bilans) — cohérent avec
  « Mesures = petit bilan », mais peut surprendre. La suppression n'est **pas** synchronisée (par prudence).
