# 0026 — Note combinée CPAFLA (pondérations + nomogramme) pour musculo et santé du dos

- **Statut** : accepté (sous norme CPAFLA — en calibration)
- **Date** : 2026-07-19
- **Contexte** : bilan / scores composites
- **Complète** : ADR 0025 (tables CPAFLA), 0024 (% gras grille)

## Contexte

Sous CPAFLA, le guide CPHV n'agrège pas les cotes par simple moyenne (ce que faisait
l'app). Chaque test reçoit une **note pondérée** (cote 0-4 × poids), on somme, puis un
**nomogramme** (Fig. 7-21 musculo / 7-25 dos) convertit (note max présente, note obtenue)
en score 0-4. Marie veut la parité avec son ancien logiciel.

## Décision

Nouveau module `src/lib/norms/cpafla-combined.ts` :

- **Nomogramme** ≡ `arrondi-demie-inférieure(obtenue / max × 4)` (`Math.ceil(x − 0.5)`),
  validé sur les exemples résolus du guide (dos 23/28 → 3 ; musculo 13/24 → 2).
- **Note obtenue** = Σ(cote 0-4 × poids) sur les tests présents ; **note max** = Σ(4 × poids)
  sur les tests présents (un test non mesuré est exclu des deux → note max réduite).
- **Pondérations par sexe** (Fig. 7-20 / 7-24) :
  - Musculo — H : extension des bras ×2 ; F : flexion du tronc ×2 ; autres ×1.
  - Santé du dos — extension du dos ×2 partout ; circonférence de la taille ×2 chez la femme ;
    autres ×1.

Câblé dans `bilan-computed` : **si `norms === 'cpafla'`** (et sexe connu), `musculoGlobal` et
`backHealth` utilisent cette méthode ; **sinon** (ACSM, défaut), le calcul historique est
conservé (aucune régression du comportement par défaut).

## Mesures exclues (choix de Marie)

L'app ne capte pas deux mesures du guide → **exclues** (note max réduite via le nomogramme,
comportement prévu par le guide « si une mesure n'est pas prise, ne pas l'inclure ») :

- **Force de préhension** (dynamomètre) — note combinée musculo.
- **Niveau d'activité physique** (catégorie du questionnaire, Fig. 4-6) — santé du dos.

## Conséquences

- Sous CPAFLA, la note combinée musculo intègre désormais **flexion du tronc** et **endurance
  du dos** (via pondérations), et la santé du dos suit les poids officiels — plus proche du
  logiciel de Marie que la moyenne 0-4.
- Le score composite affiché devient un **entier 0-4** (propre au nomogramme) sous CPAFLA.
- **À valider** : le nomogramme est reproduit par formule (arrondi-demie-inférieure), non par
  transcription cellule par cellule. À vérifier sur des cas réels vs le logiciel de Marie ; un
  écart aux bornes (½) signalerait qu'il faut encoder la grille exacte.
- Fig. 7-20 avait une **inversion H/F** corrigée à la main par la coach de Marie — pondérations
  encodées selon la correction (extension des bras ×2 = hommes ; flexion ×2 = femmes).
