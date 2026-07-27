# 0028 — Parité exacte de l'indice de santé du dos et de l'aptitude musculosquelettique

- **Statut** : accepté
- **Date** : 2026-07-27
- **Contexte** : scores composites / parité avec le logiciel d'origine
- **Remplace partiellement** : ADR 0026 (nomogramme), ADR 0025
- **Complète** : ADR 0027 (composition CPAFLA)

## Contexte

Marie voulait retrouver dans l'app les mêmes chiffres que son ancien logiciel pour
l'**indice de santé du dos**. Les figures du guide CPHV fournies par Marie
(Fig. 7-24 pondérations, 7-25 nomogramme, 7-26 conversion) ont permis de trancher
deux questions restées ouvertes depuis l'ADR 0026, en confrontant la formule aux
**6 rapports Word réellement produits** par le logiciel d'origine (2011 → juin 2026).

## Décision

### 1. Le score garde ses décimales — pas de nomogramme

Le guide décrit un **nomogramme** (Fig. 7-25) qui convertit (note max, note obtenue)
en entier 0-4. Mais ce nomogramme n'est que la version **arrondie** du rapport
`obtenue / max × 4` ; le logiciel d'origine affiche la valeur **non arrondie**
(« 3,6 points », « 2,6 points », « 1,7 point »).

`cpaflaCombine` retourne désormais le rapport brut. L'arrondi du guide reste
disponible via `cpaflaNomogramme()` (non utilisé pour l'affichage).

Impact : le bilan de juin 2026 affichait **4** au lieu de **3,6**.

### 2. Le tour de taille se cote via les tables de composition (Fig. 7-4/7-5)

Il n'existe pas de table « tour de taille » autonome dans le protocole : les points
du tour de taille viennent des **tables de composition corporelle**, et dépendent
donc de la **bande d'IMC**. C'est cette cote qu'utilise l'indice de santé du dos —
pas les seuils Santé Canada d'`acsm.ts`, qui donnaient des cotes différentes.

Nouveau helper `cpaflaWaistPoints(imc, ct, sex)` (`cpafla-composition.ts`).

Vérifié (homme, IMC 29,6-32,2) : 93 cm → 4 · 97/99/100 cm → 2 · 103 cm → 0.
La table ACSM aurait donné 2 / 1 / 0 — d'où l'écart.

### 3. Appliqué quelle que soit la norme, et CPAFLA devient le défaut

La méthode CPAFLA est la **seule formule sourcée** pour ces deux composites (la
variante « ACSM » était une approximation inventée par l'app). Elle s'applique donc
dès que le **sexe** du client est connu, indépendamment du réglage de norme.

`DEFAULT_NORMS` passe à `'cpafla'` (et son doublon `DEFAULT_CATEGORIZATION_NORMS`
côté IPC). Les tests sans table CPAFLA (VO2max, % gras, IMC, tour de taille)
retombent automatiquement sur ACSM via `getRange`.

### 4. Le questionnaire d'activité physique reste exclu

Fig. 7-24 lui donne un poids ×2, mais il n'apparaît que dans le rapport de **2011** :
Marie ne l'administre plus systématiquement. Il reste hors du calcul (note maximale
réduite, comportement prévu par le guide). Confirmé par Marie le 2026-07-27.

## Étalons de validation

Nicholas Jean (homme, 176 cm) — rapports du logiciel d'origine :

| Bilan | IMC | Taille | Cote taille | Dos calculé | Dos réel | Musculo calculé | Musculo réel |
|---|---|---|---|---|---|---|---|
| 2011-08-17 | 32,4 | — | — | *(exclu : contient le questionnaire)* | 1,7 | 17/24×4 = **2,83** | 2,8 |
| 2025-09-04 | 32,2 | 103 | 0 | 13/20×4 = **2,60** | 2,6 | 21/24×4 = **3,50** | 3,5 |
| 2025-12-04 | 31,0 | 100 | 2 | **2,00** | 2,0 | — | — |
| 2026-01-22 | 30,6 | 99 | 2 | **2,00** | 2,0 | — | — |
| 2026-02-26 | 30,3 | 97 | 2 | **2,00** | 2,0 | — | — |
| 2026-06-25 | 29,6 | 93 | 4 | 18/20×4 = **3,60** | 3,6 | 22/24×4 = **3,67** | 3,7 |

Vérification de bout en bout via `computeBilan` sur le bilan du 25 juin 2026 :
dos **3,6**, musculo **3,7**, composition **4,0** — identiques au rapport.

Le seul bilan non reproduit est **2011**, précisément parce qu'il inclut le
questionnaire d'activité physique (point 4). Son *musculo*, lui, est reproduit.

Tests de non-régression : `src/lib/norms/cpafla-parite.test.ts`.

## Conséquences

- Les scores affichés **changent** pour les bilans existants (décimales, et cote de
  taille différente). C'est le but : ils étaient faux.
- Les bornes de catégorie (0,5 / 1,5 / 2,5 / 3,5) étaient déjà les bonnes.
- **Reste ouvert** : le score global (« Santé et Condition Physique Globale ») ne
  correspond pas encore. L'ancien logiciel semble y inclure le % de gras, mais aucune
  combinaison testée ne reproduit à la fois 2,2 (sept. 2025) et 4,0 (juin 2026) —
  à investiguer séparément.
