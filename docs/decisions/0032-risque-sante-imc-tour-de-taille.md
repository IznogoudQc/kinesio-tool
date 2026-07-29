# ADR 0032 — Risque santé IMC + tour de taille : affiché, jamais coté

- **Statut** : acceptée
- **Date** : 2026-07-28
- **Contexte lié** : [[0024-grille-pourcentage-gras-marie]], [[0031-table-aerobie-cpafla]]

## Contexte

Depuis la v0.9.44/0.9.46, l'IMC et le tour de taille sont **mentionnés sans être
évalués** : on affiche la valeur, jamais de cote. Nicholas est revenu là-dessus
(« on pourrait inclure IMC et le tour de taille ») en fournissant la section
correspondante de l'aide-mémoire ÉAS (SPAP-SCPE) que Marie-Eve utilise.

## Décision

Afficher le **risque pour la santé** de cette feuille — échelle Moindre → Accru
→ Élevé → Très élevé → Extrêmement élevé — et **ne rien changer aux scores**.

Pourquoi ne pas les coter :

1. **Double comptage.** L'IMC et le tour de taille alimentent déjà la note de
   composition (`cpaflaComposition`, Fig. 7-4/7-5) et l'indice de santé du dos
   (`cpaflaWaistPoints`). Les recoter les compterait deux fois.
2. **Parité.** Le score global reproduit l'ancien logiciel sur 7 bilans sur 7.
   Ajouter deux composantes le ferait bouger sans justification.
3. **Ce n'est pas la même échelle.** Le risque santé est orienté à l'envers de
   l'échelle de condition physique (0-4) ; « Moindre » n'est pas « Excellent ».

C'est le patron déjà retenu pour le % de gras (ADR 0024) : une lecture santé
affichée au client, pendant que la valeur brute alimente les scores en coulisse.

## Les deux mesures sont lues ensemble, toujours

Le tour de taille ne fait que **relever** le risque de la bande d'IMC. Un homme
d'IMC 23 avec 92 cm de tour de taille passe de « Moindre » à « Élevé », alors
qu'un homme d'IMC 27 avec 95 cm reste à « Accru » : l'IMC le plus bas porte ici
le risque le plus haut. C'est le cas que cette feuille existe pour attraper,
d'où le refus d'afficher la colonne IMC seule.

## Transcription

Première photo inexploitable : colonnes décalées par l'angle de prise de vue,
« ≥ 125 » lu deux fois chez les hommes. Encodage refusé à ce stade — se tromper
d'une ligne aurait imprimé « extrêmement élevé » à un client dont le risque est
« élevé ». La seconde photo montre **6 entrées par colonne pour 6 tranches
d'IMC**, ce qui rend la correspondance 1:1 par position, sans dépendre de
l'inclinaison.

## Conséquences

- Nouveau module `src/lib/norms/health-risk.ts` — aucune cote produite.
- La phrase d'explication vit **dans le module**, pas dans les trois vues : les
  barèmes ont montré (v0.9.64-66) qu'un même texte écrit trois fois finit par
  diverger trois fois.
- Un tour de taille non mesuré n'est jamais présenté comme « sous le seuil ».
- Reste vrai : l'IMC et le tour de taille n'ont toujours pas de `TestKey` et ne
  reçoivent ni percentile ni cote nulle part.
