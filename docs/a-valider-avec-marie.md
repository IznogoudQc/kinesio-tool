# À valider avec Marie et son ancien logiciel

Liste vivante des points où l'app repose sur une **déduction**, une **source non
vérifiée** ou une **décision réversible**. Source publique très utile pour ce
projet : les **variables dérivées de l'Enquête canadienne sur les mesures de la
santé** (Statistique Canada), qui spécifient les mêmes calculs que le Guide du
conseiller — elles ont fermé les points 2 et 7. Chacun peut fausser un chiffre remis à
un client — d'où l'intérêt de les fermer un par un.

Mise à jour : 2026-08-04 · version publiée : v0.9.126

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

## ✅ 2. Composition corporelle — RÉSOLU (2026-08-04)

C'était le point le plus inquiétant : le seul barème entrant dans le score dont
la transcription n'avait jamais été recontrôlée. **Fermé par une source
publique**, trouvée par Nicholas.

Statistique Canada — Enquête canadienne sur les mesures de la santé, variables
dérivées `SFMDBCA`, `HWMDWSTA` et `SFMDS5A` (tableaux 20-21). Ce document
spécifie le même calcul, en citant le Guide du conseiller 3ᵉ éd.

**Ce qui est confirmé** :

- La **formule**, à l'identique : `(tour de taille × 1,5 + plis) ÷ 2,5`.
- Les **trois entrées** — tour de taille, IMC, somme des 5 plis.
- La **colonne du tour de taille** (tableau 14, `HWMDWSTA`) : concordance sur
  **38 010 combinaisons**. C'est la colonne décisive — Marie ne mesurant pas le
  mollet, la note de composition vaut exactement ces points. Nos six bilans n'en
  couvraient que **4 cases sur 36**.
- La **colonne des plis** (tableaux 20-21, `SFMDS5A`) : concordance sur
  **46 426 combinaisons**.
- Le calcul **reproduit l'ancien logiciel** sur les 6 bilans réels disponibles.

Deux tests rejouent les conditions de StatCan sur toute la grille.

**Coquille repérée dans la page source** : au tableau 14, la ligne « 1 » répète
chez la femme l'intervalle 79,9-87,1, identique à la ligne « 3 ». Lue au pied de
la lettre, elle laisse **5 796 combinaisons sans aucune règle** — une femme d'IMC
normal à plus de 87 cm ne serait couverte par rien. On lit donc « > 87 », par
symétrie avec les hommes (« > 101 ») : la spécification redevient complète et
concorde alors parfaitement avec nos tables.

**Trois écarts de borne trouvés et corrigés** au passage — aucun n'était visible
sur nos bilans, tous auraient pu fausser un cas limite :

- L'IMC **35,0** appartenait chez nous à la bande 32,5-35,0 ; StatCan le place
  dans la dernière (« BMI > 34,99 »). Cet écart touchait aussi les points d'IMC
  et de tour de taille, pas seulement ceux des plis.
- Une somme de **55 mm** (hommes) et de **84 mm** (femmes) sous IMC 18,5 valait
  3 chez nous, 4 chez StatCan.

**Leçon** : les six bilans réels ne prouvaient que les plages qu'ils traversent.
La spécification publique a couvert le reste — y compris la colonne des plis,
que Marie ne mesure jamais et qu'aucune donnée n'aurait pu départager.

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

## ✅ 7. Tour de taille jugé seul — RÉSOLU (2026-08-04)

**Source retenue** : Statistique Canada — Enquête canadienne sur les mesures de
la santé, variable dérivée **HWMDWSTA**. Choisie plutôt que la fenêtre
Propriétés de l'ancien logiciel pour avoir une référence **publique et
citable** (décision de Nicholas).

| | Hommes | Femmes |
|---|---|---|
| **4** Excellent | moins de 94 cm | moins de 80 cm |
| **3** Risque potentiel | 94 à 101 cm | 80 à 87 cm |
| **1** Risque considérable | plus de 101 cm | plus de 87 cm |

Deux détails qui se perdent facilement, tous deux verrouillés par un test :

- La **borne haute est incluse** — 101 cm reste « Risque potentiel ». Écrire
  `< 102` marcherait sur des entiers mais classerait 101,5 cm du mauvais côté.
- Les cotes **sautent le 2**. C'est ainsi que la fenêtre de l'ancien logiciel
  l'imprime ; normaliser en 4/3/2 inventerait une cote.

**Divergence assumée** : la fenêtre de l'ancien logiciel montrait **90** chez les
femmes, Statistique Canada dit **87**. On suit la source publique. Concrètement,
une cliente entre 88 et 90 cm est classée « Risque considérable » ici et
« Risque potentiel » dans son logiciel.

L'ancienne table Santé Canada (qui disait 88) est supprimée. Ce barème reste
distinct de la cote de tour de taille utilisée par l'indice du dos et le
musculo, qui vient des tables de composition — les deux coexistent.

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
