# ADR 0034 — FC max ajustable par client

- **Statut** : acceptée
- **Date** : 2026-07-29

## Contexte

Les cinq zones d'entraînement découlaient entièrement de la prédiction de
Tanaka (208 − 0,7 × âge). Marie-Eve a demandé de pouvoir les ajuster : un client
sous bêta-bloquants ou très entraîné s'écarte largement de la formule, et lui
prescrire des zones calculées sur une FC max fausse n'a aucun intérêt clinique.

## Décision

**Ce qui est ajustable : la FC max**, pas les paliers de pourcentage. Les cinq
zones se recalculent à partir d'elle. C'est le besoin réel — une seule valeur à
saisir, cinq bornes correctes en sortie — plutôt que cinq seuils à gérer.

**Portée : le client**, pas le bilan. Une zone d'entraînement est une
prescription, pas une mesure ponctuelle : elle doit être identique sur le
dashboard et sur les documents remis, quel que soit le bilan consulté. Colonne
`clients.fc_max_manuel` (migration 0028), `null` = prédiction.

## L'ajustement voyage dans le PROFIL

`BilanProfile.fcMaxManuel`, alimenté par `buildBilanProfile(client)`.

C'est le point important. Le dashboard, le rapport PDF et le document HTML
construisent tous leur profil avec ce helper depuis la v0.9.65 : l'ajustement
les atteint donc tous les trois **sans câblage par surface**, et aucune ne peut
l'oublier. Passer la valeur en paramètre séparé aurait recréé exactement le
genre de divergence corrigé cette semaine sur les barèmes et les normes.

## L'étiquette suit la source

`BilanComputed.fcMaxSource` (`'manuel' | 'tanaka' | null`). Les trois surfaces
l'affichent : « FC max mesurée · saisie par la kinésiologue » ou « FC max
prédite · Tanaka ». Annoncer « prédite » sur une valeur saisie serait le défaut
corrigé en v0.9.64-66, où les barèmes affichaient « ACSM » sur des chiffres
CPAFLA.

## Garde-fous

- Bornes 100-230 bpm, à l'IPC **et** dans le champ de saisie. Au-delà c'est une
  faute de frappe, et des zones aberrantes seraient pires que la prédiction.
- Valeur absente, nulle ou `NaN` → repli silencieux sur Tanaka.
- Un client sans date de naissance n'a pas de prédiction, mais une FC max
  mesurée lui donne quand même ses zones.
- Le document HTML ne reçoit pas de fonction d'enregistrement : il partage le
  composant avec le dashboard mais reste en lecture seule.
