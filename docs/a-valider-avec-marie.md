# À valider avec Marie et son ancien logiciel

Liste vivante des points où l'app repose sur une **déduction**, une **source non
vérifiée** ou une **décision réversible**. Chacun peut fausser un chiffre remis à
un client — d'où l'intérêt de les fermer un par un.

Mise à jour : 2026-08-03 · version publiée : v0.9.117

**Comment lire** : 🔴 fausse potentiellement un chiffre · 🟡 affichage ou libellé
seulement · 🟢 décision prise, réversible si Marie change d'avis.

---

## 🔴 1. Barème de la pression artérielle systolique — *bloquant*

**Ce qu'on a mis** : `< 120 mmHg → cote 4, sinon 0`.

**D'où ça vient** : d'un rétro-calcul sur **4 bilans seulement** — 112 → 4,
113 → 4, 122 → 0, 129 → 0. C'est la règle la plus simple compatible avec ces
quatre points. Rien d'autre ne l'appuie.

**Pourquoi ça compte** : la PA systolique est une des cinq composantes du score
global. Un barème plus fin changerait la note remise au client.

**Ce qu'il faut** : la fenêtre **Propriétés** du test « Pression artérielle
systolique », onglet des cotes / de la classification — la même fenêtre qui avait
donné la formule `AverageRatings(...)`. Vérifier que les **bornes en mmHg** sont
lisibles et qu'il n'y a pas de distinction homme/femme ou par âge.

**Déjà écarté, ne pas y revenir** : la table clinique affichée sur la carte
(120/130/140/160) **n'est pas** celle du score. Elle prédit la cote 3 à 122 et
129 mmHg, là où l'ancien logiciel donne 0. Une recherche exhaustive de tout
découpage à 5 niveaux ne laisse que des jeux confinés entre 114 et 122 mmHg —
8 mmHg pour cinq zones, cliniquement absurde. Voir [[0033-score-global-formule-confirmee]].

---

## 🔴 2. Figures 7-4 / 7-5 / 7-6 — composition corporelle

**Ce qu'on a mis** : les tables de `cpafla-composition.ts`, saisies d'après le
Guide du conseiller.

**Le risque** : c'est le **seul barème dont la transcription n'a jamais été
recontrôlée contre la source**, et c'est aussi **le seul de ce genre à entrer
dans le score global** (composante « Composition corporelle »). Une ligne mal
recopiée déplace une cote, donc la note finale.

**Ce qu'il faut** : des photos nettes des **figures 7-4 (hommes)**, **7-5
(femmes)** et **7-6 (catégories)**, plus la **formule de la page 7-18**.

---

## 🟡 3. Seuils de la pression diastolique

**Ce qu'on affiche** : Optimale < 80 · Normale 80-84 · Pré-HT 85-89 ·
HT1 90-99 · HT2 ≥ 100.

**Le doute** : l'ancien logiciel montrait **75 / 80 / 90 / 100**, pas
80 / 85 / 90 / 100.

**Portée** : affichage seulement — la diastolique n'entre pas dans le score. Un
client peut néanmoins se voir étiqueter « Pré-hypertension » d'un côté et
« Normale » de l'autre.

**Ce qu'il faut** : que Marie confirme les bornes qu'elle veut voir. Non modifié
sans son accord.

---

## 🟡 4. Table VO2max « ACSM »

**Ce qu'on a mis** : un hybride recalibré, pas la 11ᵉ édition ACSM exacte. Trois
tables ont été réalignées sur des valeurs publiées ; les autres viennent d'une
migration mécanique avec extrapolation `P90 = 2·p75 − p50`.

**Portée** : la catégorie affichée (Bien / Très bien…). L'aptitude aérobie entre
dans le score global via sa cote, donc un décalage de percentile peut déplacer la
cote.

**Ce qu'il faut** : savoir quelle table Marie utilise réellement — ACSM, CPAFLA,
ou celle de son logiciel. Voir [[acsm_vo2max_approximatif]].

---

## 🟡 5. Tables CPAFLA musculo — note combinée et dos

**Ce qu'on a mis** : les tables du guide CPHV, sélectionnables mais **pas par
défaut**, avec repli sur ACSM.

**Ce qui reste** : la note combinée et l'indice du dos n'ont pas été calibrés
contre l'ancien logiciel. Voir [[0013-tables-cpafla]] et [[cpafla_norme]].

---

## 🟢 6. Composantes exclues du score global

La formule de l'ancien logiciel compte **sept** composantes ; on en calcule
**cinq**.

| Composante | Statut |
|---|---|
| `[166]` | Exclue — Marie ne l'utilise pas |
| `[Questionnaire combiné]` | Exclue — pas rempli à chaque fois |

**À revalider si** Marie se met à remplir le questionnaire systématiquement : il
faudra le réintégrer, et **les scores changeront**. La structure le prévoit déjà
(une composante non mesurée est exclue, pas comptée 0).

---

## 🟡 7. Tour de taille — barème autonome *(en attente)*

Marie veut colorer le tour de taille **par le tour de taille seul**, sans risque
IMC ni risque combiné. Problème : le **tableau 4.4 ne contient aucun seuil
indépendant de l'IMC** — ses seuils (90, 100, 110, 125 cm chez l'homme) ne valent
que combinés à une bande d'IMC.

**Ce qu'il faut** : quels seuils Marie utilise quand elle regarde le tour de
taille seul. Le référentiel standard indépendant existe (Santé Canada :
94 / 102 cm hommes, 80 / 88 cm femmes) mais **ce n'est pas le 4.4**.

Plan écrit, rien codé. Bloqué sur cette réponse.

---

## 🟡 8. Lipides 30-40 % — page exacte

Le repère est encodé et attribué au **Guide du conseiller CPAFLA, 3ᵉ éd.**
d'après ta confirmation. La photo transmise ne montrait ni numéro de tableau ni
page.

**Ce qu'il faut** : la page ou le chapitre, pour compléter [[0037-lipides-grammes-ou-pourcentage]].

---

## 🟡 9. Glucides nets — les polyols

On calcule **glucides de l'aliment moins ses fibres**. Certaines conventions
retirent aussi les **polyols**.

**Portée** : une phrase de définition, aucun calcul. Mais ce texte part chez les
clients. Voir [[0039-glucides-nets-correction]].

---

## 🟢 10. Guide alimentaire — présentation

Les huit recommandations sont affichées en **deux volets** (aliments / habitudes),
comme dans le guide d'origine. La photo de Marie les montrait en **liste unique
de huit**.

Changement d'une ligne si elle préfère sa mise en page.

---

## Le principe qui vaut pour tous

Aucun barème n'est inscrit dans le code sans source confirmée. Cette règle vient
d'une erreur réelle : une table avait été attribuée au mauvais ouvrage, puis
corrigée par [[0036-source-table-aerobie-corrigee]]. Depuis, une attribution non
vérifiée est traitée comme une dette, pas comme un détail.

Quand une réponse arrive, elle se solde ainsi : encoder la valeur **telle qu'elle
est écrite**, jamais telle qu'on l'imagine ; un test qui verrouille les bornes ;
une ADR qui dit d'où ça vient.
