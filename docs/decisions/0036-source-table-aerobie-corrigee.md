# ADR 0036 — La table aérobie vient du Guide du conseiller, pas de l'aide-mémoire

- **Statut** : acceptée
- **Date** : 2026-07-31
- **Corrige** : [[0031-table-aerobie-cpafla]] (dont l'attribution était fautive)
- **Contexte lié** : [[0025-encodage-cpafla-repli-acsm]], [[0029-norme-unique-cpafla]]

## Contexte

L'ADR 0031 a encodé la table de cotation du VO2max en l'attribuant à
l'**aide-mémoire « Évaluation des avantages pour la santé », outil n° 26
(SPAP-SCPE)** — la feuille que Marie-Eve avait alors transmise.

Le 2026-07-31, Nicholas a fourni la page d'origine : **tableau 4.10 du *Guide du
conseiller en condition physique et habitudes de vie*, 3ᵉ édition** — « VO2max
estimé : évaluation des avantages pour la santé ».

Les deux documents portent le même tableau : l'aide-mémoire le reproduit. La
comparaison a été faite avant toute modification, bande par bande.

## Ce qui était juste, et ce qui ne l'était pas

**Les valeurs étaient exactes.** Les 48 seuils (12 bandes × 4 bornes) encodés en
v0.9.67 correspondent au dixième près au tableau du guide. Aucune cote de client
n'a jamais été fausse, et aucune valeur ne change avec cette ADR.

**L'attribution ne l'était pas.** L'app annonçait l'aide-mémoire sur quatre
surfaces : feuille « Exporter les barèmes », dashboard, rapport PDF et
Paramètres. Or Marie n'a pas cet aide-mémoire sous la main — elle a le guide.
Une feuille de référence qu'elle imprime, et sur laquelle elle s'appuie en
consultation, renvoyait donc vers un document introuvable.

Le raisonnement de l'ADR 0031 (« ce sont deux publications distinctes, les citer
indifféremment recréerait le défaut corrigé en v0.9.64 ») était bon dans son
principe et faux dans son application : il n'y avait pas deux publications, mais
deux tables **du même guide**.

## Décision

1. Citer la capacité aérobie comme **« CPAFLA / ÉCPHV — Guide du conseiller,
   3ᵉ éd., tableau 4.10 »**.
2. **Conserver une source distincte** de celle des tests musculosquelettiques,
   qui viennent des figures 7-18 / 7-19. La distinction ne porte plus sur la
   publication mais sur le **numéro de tableau** — ce qui reste utile : Marie
   doit pouvoir retrouver la bonne page dans son guide.
3. Corriger la portée annoncée : le tableau couvre **15 à 69 ans**. La mention
   « adultes de 20 à 65 ans » provenait du libellé de l'aide-mémoire et sous-
   estimait la couverture réelle.

Aucune valeur de cotation n'est modifiée. L'ADR 0031 reste valide sur le fond —
la décision d'encoder cette table, et ses 27 % de cotes changées par rapport à
l'ACSM, tiennent toujours. Seule sa **source** est corrigée ici.

## Vérification

- Un test (`norms.test.ts`) transcrit **le tableau entier** et le compare bande
  par bande. L'exhaustivité est délibérée : une seule borne qui dériverait ne
  ferait rien planter, elle ferait basculer un client d'une catégorie à l'autre
  de façon parfaitement plausible — le genre d'erreur qu'on ne découvre jamais.
- Deux tests couvrent les bornes de tranche (19 ans et 20 ans ne tombent pas
  dans le même groupe) et le hors-plage (14 et 70 ans → aucune table, repli
  ACSM explicite plutôt qu'extrapolation).
- Les libellés de source sont rendus et vérifiés dans `bareme.test.ts`, y
  compris l'**absence** de l'ancienne mention.

## Conséquences

- La correction n'a touché qu'un seul endroit (`bareme.ts`) : depuis la v0.9.64
  la source est **déduite** de la table réellement utilisée, donc les quatre
  surfaces suivent sans pouvoir diverger. C'est cette architecture qui a rendu
  la correction triviale — l'ADR 0031 avait raison de l'imposer.
- La feuille « Exporter les barèmes » doit être **réimprimée** : celle en
  circulation cite l'aide-mémoire.
- L'ADR 0031 n'est pas modifiée (les ADR sont immuables). Son titre et son texte
  conservent l'attribution d'origine ; cette ADR-ci fait foi sur ce point.

## Leçon

Une valeur juste attribuée à la mauvaise source ne se manifeste par aucun
symptôme : rien ne plante, aucun chiffre n'est faux, les tests passent. Elle ne
se découvre que le jour où quelqu'un cherche la référence — ici, en imprimant la
feuille. Quand une source est fournie par capture ou par photocopie, noter le
**document d'origine** et pas seulement celui qu'on a reçu.
