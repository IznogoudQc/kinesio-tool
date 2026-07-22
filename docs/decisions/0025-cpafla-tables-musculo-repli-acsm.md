# 0025 — Encodage des tables CPAFLA musculosquelettiques + repli sur ACSM

- **Statut** : accepté (en calibration — non défaut)
- **Date** : 2026-07-19
- **Contexte** : bilan / normes de catégorisation
- **Complète** : ADR 0013 (ossature CPAFLA), ADR 0006 (convention catégories→percentiles)

## Contexte

Marie-Eve a fourni le **Guide du conseiller en condition physique et habitudes de
vie (CPHV / ÉCPHV), 3ᵉ édition** (SCPE) — la source officielle des barèmes de son
ancien logiciel. Jusqu'ici, `cpafla.ts` était une ossature vide (`null` partout) faute
de source (ADR 0013).

## Décision

1. **Tables musculosquelettiques encodées** dans `src/lib/norms/cpafla.ts` depuis les
   Figures **7-18** (hommes) et **7-19** (femmes), tranches 15-19 … 60-69 × sexe :
   `pushups`, `situps`, `trunkFlexion`, `verticalJump`, `legPower`, `backEndurance`.
   Conversion catégories → percentiles via le helper `band(a, b, tb, e)` : borne basse
   Acceptable→p10, Bien→p25, Très bien→p50, Excellent→p75, p90 = 2·p75 − tb.
   `categorizeRaw` fait `value >= p75 → Excellent`, ce qui reproduit exactement les
   intervalles contigus du guide. (Force de préhension non encodée : aucun champ de
   bilan correspondant.)

2. **Repli sur ACSM** pour les tests sans table CPAFLA (VO2max/mCAFT, IMC, tour de
   taille), dans les **deux** points d'entrée : `norms/index.getRange` et
   `bilan-computed.categorizeRaw` (`getCpaflaRange(...) ?? getAcsmRange(...)`). Sinon
   ces scores disparaîtraient sous la norme CPAFLA. Le **% de gras** ne passe plus par
   la norme du tout (grille de Marie, ADR 0024).

3. **Sélecteur de norme réactivé** dans Paramètres → Bilans (`NormsCard`), ACSM /
   CPAFLA, **ACSM restant le défaut**. CPAFLA marqué « En calibration ».

## Conséquences

- Marie peut sélectionner CPAFLA et comparer les cotes à son ancien logiciel test par
  test — objectif de **parité**.
- Sous CPAFLA, le musculosquelettique suit le guide ; l'aérobie et l'IMC/tour de taille
  restent ACSM (repli), le % de gras la grille de Marie.
- **À valider / à venir** (Marie a le livre complet) :
  - La **note combinée** musculosquelettique et l'**Indice de santé du dos** utilisent
    des *notes pondérées* CPAFLA propres (Figures 7-20/7-24) et un nomogramme
    (7-21/7-25) qui **diffèrent** de la moyenne 0-4 actuelle de l'app. À calibrer dans
    un lot ultérieur (« on debug ensemble »).
  - Tables CPAFLA de composition (somme des 5 plis) non encodées — non nécessaires tant
    que le % de gras suit la grille de Marie.
- Transcription manuelle de ~360 seuils → **risque d'erreur** ; couvert par des tests
  ponctuels (`norms.test.ts`) et à revalider visuellement avec Marie.
