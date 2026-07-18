# ADR 0023 — Partage des mesures entre Bilan et onglet Mesures

**Statut** : Accepté
**Date** : 2026-07-18

## Contexte

Un bilan complet prend aussi des mesures (poids, grandeur, circonférences, plis) ; l'onglet Mesures est « un
petit bilan non complet ». Aujourd'hui les deux stockent **séparément** — bilan dans `bilans.data` (JSON),
Mesures dans `mesures_circonferences` / `mesures_plis_cutanes`. Marie devait donc saisir deux fois. Décidé avec
Nicholas : **synchroniser à l'enregistrement**, dans les deux sens.

## Décision

**Un seul sens : Bilan → Mesures.** À l'enregistrement (ou l'import) d'un bilan, ses mesures partagées sont
**recopiées** dans les tables Mesures pour la **même date**. L'inverse (Mesures → Bilan) est **volontairement
exclu** : Nicholas ne veut PAS que les données saisies dans Mesures remontent dans le bilan (et pas de bilan
créé depuis une prise).

Comme les deux côtés stockent en **métrique** (cm, kg, mm), **aucune conversion** — juste un renommage de champ
(`src/lib/measure-sync-map.ts`, testé) : poids, grandeur (= `taille_cm` du bilan), tour de taille/hanche, biceps
fléchi/cuisse/épaules-pec, et les 4 plis.

`syncBilanToMesures` (`electron/lib/measure-sync.ts`) : upsert des tables circonférences + plis pour la date
(création si besoin ; les plis calculent le % de gras via âge + sexe). Appelé par les handlers IPC bilans
(create/update/import) après écriture ; écrit **directement en base** → pas de boucle.

## Conséquences

- **+** Les mesures prises pendant un bilan apparaissent dans l'historique/les graphes de Mesures — pas de double
  saisie côté Mesures.
- **+** Pas de migration ni de conversion (tout en métrique) ; pas d'effet de bord côté Bilan (une prise de
  Mesures n'affecte jamais la liste des bilans).
- **−** **Duplication** de la donnée (deux stockages) ; le bilan fait autorité (« dernier bilan enregistré gagne »
  pour la date). Éditer une prise de Mesures ne met PAS à jour le bilan → divergence possible et assumée.
- **−** La suppression n'est **pas** synchronisée (par prudence).

### Historique
La v0.8.0 avait implémenté la synchronisation **dans les deux sens** ; le sens Mesures → Bilan a été retiré juste
après (à la demande de Nicholas) car il créait des bilans partiels indésirables.
