# 0024 — Le % de gras est catégorisé selon la grille de Marie (et non le percentile ACSM)

- **Statut** : accepté
- **Date** : 2026-07-19
- **Contexte** : bilan / composition corporelle

## Contexte

Le pourcentage de gras corporel était décrit de **deux façons contradictoires** dans un
même rapport client :

- **Percentile ACSM** (À améliorer / Acceptable / Bien / Très bien / Excellent) — utilisé
  pour le libellé de la carte composite (ex. « % de gras corporel → **Très bien** ») **et**
  pour la cote du % de gras dans le **score de composition**.
- **Grille de risque de Marie** (Risques potentiels / Optimal / **En santé** / Risques
  modérés / Risques élevés, `body-fat-risk.ts`) — affichée dans la section détaillée.

Pour un homme à 23,1 %, la carte disait « Très bien » et la grille « En santé ». Les deux
systèmes répondent à des questions différentes (classement de population vs zone de risque
santé), d'où la contradiction perçue par la kinésiologue.

## Décision

Le **% de gras est coté et libellé selon la grille de Marie** — sa référence clinique —
**partout** :

- Un helper `bodyFatGridRating(pct, sex)` (`src/lib/body-fat-risk.ts`) renvoie le libellé de
  zone (« En santé ») **et** une cote 0-4 (`Category`), via la table :
  `optimal→EXCELLENT, sante→TRES_BIEN, potentiel→BIEN, modere→ACCEPTABLE, eleve→A_AMELIORER`.
- `bilan-computed.catFor` utilise cette grille pour `pourcentage_gras` (au lieu du percentile) →
  la contribution du % de gras au **score de composition** et le composite `bodyFat` suivent la
  grille.
- Le rapport (`ReportPage.CompositeBreakdown`) affiche le libellé de zone pour le % de gras.
  Le document interactif (`EditorialReport`) excluait déjà `bodyFat` du percentile — il était
  donc **déjà** aligné sur la grille ; c'est le PDF qui divergeait.

Le percentile ACSM reste la référence pour tous les **autres** champs (IMC, VO2max, tour de
taille, force, etc.).

## Conséquences

- Le rapport PDF et le document HTML disent désormais le **même mot** pour le % de gras.
- Le score de composition peut **changer** pour certains clients (la grille et le percentile ne
  concordent pas toujours). Cas Nicholas (30,2 % H → « Risques modérés » → ACCEPTABLE) : identique
  à l'ancien percentile → score inchangé.
- La cotation des **zones extrêmes** (« Risques potentiels » = trop maigre → `BIEN`) est
  indicative, à valider avec Marie. Rare en pratique.
- Les cartes composites **0-4** du dashboard (`BilanSynthesisCards`, dont « % gras corporel »)
  gardent le vocabulaire 0-4 (langage des composites) — non aligné sur la grille pour l'instant.
  À rediscuter si besoin.
