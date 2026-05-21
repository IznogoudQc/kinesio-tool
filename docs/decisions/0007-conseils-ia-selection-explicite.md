# ADR 0007 — Conseils IA : sélection explicite + payload anonymisé

**Statut** : Accepté
**Date** : 2026-05-15

## Contexte

Marie-Eve veut une assistance générative pour produire des conseils kinésio à partir des données chiffrées du client (catégories, percentiles, deltas). Trois axes de design fondamentaux à arbitrer :

1. **Quand l'IA est-elle invoquée ?** Auto sur chaque card (1 bouton par métrique) vs sélection multi-métriques avec un seul appel intégré.
2. **Quelles données partent vers l'API tierce ?** Tout le client vs sous-ensemble anonymisé curaté par l'utilisatrice.
3. **L'utilisatrice valide-t-elle le payload avant l'envoi ?** Envoi automatique vs preview + confirmation.

## Options

### A. Bouton par métrique, conseils isolés
- Pour chaque card avec une catégorie/percentile, un bouton « Conseils IA ».
- Chaque clic = un appel API distinct, conseils sur cette seule métrique.
- Avantage : simple à concevoir, atomique.
- Inconvénient : Marie-Eve doit synthétiser elle-même les conseils, et ne voit pas les corrélations (« si VO2max bas + tour de taille élevé, le programme intégré est différent que pour chacun isolément »). Multiplie les appels API et donc le coût.

### B. Sélection multi-métriques + un seul appel holistique ← retenu
- Toggle « Mode conseils IA » qui fait apparaître une case à cocher sur chaque métrique catégorisable.
- Marie-Eve coche les métriques pertinentes pour ce client (curation humaine).
- Un seul bouton « Générer les conseils IA » → appel unique qui propose un programme INTÉGRÉ tenant compte des corrélations.
- Avantage : moins d'appels API, conseils plus pertinents (un kiné raisonne sur le profil global), curation explicite.
- Inconvénient : 1 toggle de plus à apprendre, l'utilisatrice doit prendre 30 secondes pour cocher.

### C. Tout-automatique sur tout le client
- Au clic « Générer », tout le profil + tous les bilans + toutes les mesures du client partent vers l'API.
- L'IA décide quels axes prioritaires.
- Avantage : zéro effort utilisatrice.
- Inconvénient : énormément de données identifiables potentiellement envoyées à un tiers (RGPD/Loi 25 à risque), perte de contrôle, coût API plus élevé.

## Décision

**Option B retenue**, avec **trois garde-fous de confiance** :

1. **Curation humaine explicite** : Marie-Eve choisit consciemment quelles métriques sont incluses. Aucun « auto-include » silencieux. Un mode dédié (toggle) rend la sélection intentionnelle.
2. **Payload anonymisé visible avant envoi** : modal de preview qui affiche **exactement** ce qui va partir (sexe, âge, métriques + catégories + percentiles). Pas de nom, courriel, ni notes. Confirmation requise.
3. **Aucun envoi automatique** : pas de poll, pas de pré-fetch — l'API est appelée uniquement quand l'utilisatrice clique « Confirmer et générer ».

## Architecture

### Composants

```
DashboardLayout
  └── AIAdviceProvider (contexte)
        ├── Toggle « Mode conseils IA » (bouton top-right)
        ├── Bandeau d'aide (visible si mode actif)
        ├── <Outlet /> (MesuresOverview / BilanOverview)
        │     ├── <MetricSelectable selectionKey="…" data={…}>
        │     │     └── <StatCardXL /> | <MiniStatCard /> | <BarRow /> | etc.
        │     └── …
        └── <AIAdvicePanel /> (FAB + modal payload + modal résultat)
```

- `AIAdviceContext` : state `mode` (bool) + `selection: Map<key, MetricSelection>`. Méthodes `toggleMode`, `toggle(key, data)`, `clear`. Reset complet quand on quitte le mode (pour éviter des sélections fantômes).
- `<MetricSelectable>` : wrapper qui rend ses enfants tels quels hors mode IA. En mode IA, ajoute un anneau gold + case à cocher en absolute top-right. Le clic sur le wrapper toggle la métrique.
- `<AIAdvicePanel>` : FAB en bas-droite quand mode actif, et les 2 modals (payload + résultat).

### Format du payload
```ts
interface AIAdvicePayload {
  sex: 'F' | 'M' | null
  age: number | null
  metrics: Array<{
    key: string         // ex: 'stat:vo2max', 'mesures:tour_taille'
    label: string       // ex: 'VO2max', 'Tour de taille'
    value: number | string
    unit?: string
    category?: string   // ex: 'Très bien', 'Élevé (OMS)'
    percentile?: number
    deltaPct?: number
  }>
}
```

### Format de réponse attendu de l'IA
```ts
interface AIAdvice {
  diagnostic: string              // 2-3 phrases sur ce que les métriques disent ENSEMBLE
  objectifsPrioritaires: string[] // 1-3 objectifs SMART
  programmeIntegre: {
    cardio: string[]
    musculation: string[]
    souplesse: string[]
    habitudes: string[]
  }
  echeance: string
  warnings: string[]
}
```

Le prompt système (à brancher en v0.1.31) précisera :
- Tu es un assistant pour un kinésiologue canadien.
- Tu reçois des données anonymes avec **plusieurs** métriques.
- Ta tâche : identifier les **liens** entre les métriques et proposer un programme **intégré** (PAS des conseils isolés par métrique).
- Format de réponse : JSON strict suivant le schéma ci-dessus.

## v0.1.30 — état actuel (architecture + UI complets, API mockée)

- ✅ Contexte + provider + hook `useAIAdvice()`
- ✅ Wrapper `<MetricSelectable>` réutilisable
- ✅ Toggle dans `DashboardLayout` + bandeau d'aide
- ✅ Cases à cocher sur 4 hero stats (StatCardXL) + 6 barres musculo + 5 cards de MesuresOverview (BigStatCard ×2, MiniStatCard ×4, RatioTHCard)
- ✅ FAB avec compte + annuler
- ✅ Modal payload preview (affiche exactement ce qui partira)
- ✅ Modal résultat avec sections Diagnostic / Objectifs / Programme intégré (cardio/muscu/souplesse/habitudes) / Échéance / Avertissements
- ✅ Bouton **Copier** fonctionnel (presse-papier en markdown)
- ✅ Service `aiAdviceService.generate(payload)` mocké (1.5-2.5s simulé, réponse hardcodée plausible basée sur le payload)
- ✅ Carte Settings « Conseils IA » avec UI provider (Anthropic / OpenAI) + clé API (non persistée)

## v0.1.31 — à venir (vrai appel API + persistance clé)

- IPC handler `ai:generate` avec fetch direct vers Anthropic / OpenAI
- Clé API persistée dans keytar (réutilise le pattern SMTP cf. v0.1.5)
- Gestion erreurs réseau (timeout, 429 rate limit, 401 mauvaise clé) → message clair
- Bouton « Enregistrer » de la carte Settings devient actif
- Désactivation du mode IA dans le dashboard si aucune clé configurée + tooltip « Configurez votre clé API dans Paramètres pour activer. »

## v0.1.32 — actions de sortie (au-delà du Copier)

- Bouton **Envoyer au client par courriel** : pré-remplit le template SMTP existant avec le markdown des conseils, édition possible avant envoi.
- Bouton **Sauvegarder dans les notes du client** : nécessite d'abord d'activer le tab `Notes` (actuellement `PlaceholderTab`).

## Conséquences

- **Loi 25** : le payload est anonyme par construction (aucun nom/email/notes). Donc même envoi vers un tiers américain (Anthropic, OpenAI), pas de PII transmise. Marie-Eve garde la responsabilité de ne pas saisir d'informations identifiantes dans les notes des bilans qu'elle commente — c'est déjà sa pratique aujourd'hui.
- **Coût API maîtrisé** : un seul appel par session d'analyse, déclenché par un clic explicite. Pas de pré-fetch.
- **Auditabilité** : Marie-Eve a vu le payload exact avant l'envoi → si l'IA hallucine, elle peut comparer ce qu'elle a envoyé vs la réponse.

## Si on revient en arrière

- Retirer `<AIAdviceProvider>` du `DashboardLayout` → tous les `<MetricSelectable>` deviennent transparents (le hook retourne un objet inactif par défaut).
- Supprimer `AIAdvicePanel`, `aiAdvice` service, `AIProviderCard` settings.
- Aucun impact sur le reste du dashboard (cards intactes hors mode IA).

Marie-Eve a validé l'approche à l'oral le 2026-05-15.
