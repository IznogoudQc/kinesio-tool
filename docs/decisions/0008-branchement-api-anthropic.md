# ADR 0008 — Branchement réel de l'API Anthropic Claude

**Statut** : Accepté
**Date** : 2026-05-15

## Contexte

La v0.1.30 a livré l'architecture complète + UI des conseils IA avec une réponse mockée côté renderer. Marie-Eve a validé l'UX (toggle, sélection multi-métriques, payload preview, modal résultat, copier en markdown). Il est temps de brancher pour de vrai.

Trois axes à arbitrer :
1. **Quel provider ?** Anthropic vs OpenAI vs les deux.
2. **Où vit la clé API et l'appel HTTP ?** Renderer vs main process.
3. **Quelle gestion des erreurs ?** Catégorisation vs message générique.

## Décisions

### Provider : Anthropic Claude only (pour v0.1.31)

- Marie-Eve fait du clinique léger, pas de génération créative — Claude Sonnet (compromis qualité/coût équilibré) suffit largement.
- Garder un seul provider simplifie : un seul format d'API, un seul format d'erreur, un seul prompt à maintenir. Si on ajoute OpenAI plus tard, on extrait l'abstraction.
- Modèle de génération : `claude-sonnet-4-6` (Sonnet 4.6 — dernier en date au moment de la décision).
- Modèle pour test de connexion : `claude-haiku-4-5-20251001` (plus rapide + moins cher pour un simple ping).

### Clé + appel HTTP dans le main process

- La clé API est stockée dans **keytar** (trousseau OS Windows / macOS / Linux), même pattern que le mot de passe SMTP (cf. v0.1.5).
- L'appel `fetch` vers `https://api.anthropic.com/v1/messages` se fait dans le **main process** Electron, jamais dans le renderer.
- Avantage : la clé ne traverse jamais `contextBridge`, donc elle ne fuit pas vers la sandbox renderer (où une éventuelle XSS pourrait l'aspirer).
- Le renderer reçoit uniquement `{ ok, advice }` ou `{ ok: false, error, code }`.

### Catégorisation des erreurs

Le main retourne un `code: AIErrorCode` que le renderer peut interpréter pour afficher des UX contextuelles :

| Code | Cause | UX |
|------|-------|-----|
| `NO_API_KEY` | keytar vide | Modal « Allez dans Réglages » + bouton navigation |
| `INVALID_KEY` | HTTP 401 | Toast rouge « Clé API invalide ou révoquée » |
| `RATE_LIMIT` | HTTP 429 | Toast « Réessayez dans un instant » |
| `NETWORK` | fetch a throw | Toast « Erreur réseau » |
| `TIMEOUT` | 30s écoulé | Toast « Anthropic n'a pas répondu » |
| `BAD_RESPONSE` | JSON parse/schema | Toast technique pour debug |

## Implémentation

### IPC — `electron/ipc/ai.ts`
Cinq handlers :
- `ai:has-api-key` → `boolean` (lit keytar)
- `ai:set-api-key` → écrit dans keytar (validation zod `min(1).max(500)`)
- `ai:remove-api-key` → supprime de keytar
- `ai:test-connection` → ping Haiku avec « ping » + max_tokens=10, retourne `{ ok, error?, code? }`
- `ai:generate(payload)` → appel Sonnet avec prompt système (~600 mots, codé dans `electron/ipc/ai.ts`), parse le JSON renvoyé, valide via zod (`AdviceSchema`), retourne `{ ok, advice?, error?, code? }`

### Prompt système
Codé dans `ai.ts` :
- « Tu es un assistant pour un kinésiologue canadien »
- Précise que les métriques sont **sélectionnées explicitement** par l'utilisatrice → cherche les LIENS entre elles
- Demande un JSON strict avec `diagnostic`, `objectifsPrioritaires`, `programmeIntegre.{cardio,musculation,souplesse,habitudes}`, `echeance`, `warnings`
- Règles : sobre, factuel, 3-6 items par liste, tenir compte de l'âge/sexe, warnings auto pour tour de taille très élevé OMS + âge ≥ 50

### Parsing
Anthropic peut ajouter du texte autour du JSON (« Voici le résultat : { … } »). On extrait le premier `{` au dernier `}` puis `JSON.parse` puis validation zod. Si l'un des trois échoue → `BAD_RESPONSE`.

### Coût estimé
- Génération : ~750 tokens input + ~2000 tokens output. Sonnet 4.6 ≈ 3 $/M input + 15 $/M output = **~0.0023 + 0.030 = ~0.032 $/conseil**.
- Avec 5 analyses/semaine, Marie-Eve dépense ~0.65 $/mois. Soutenable.
- Ping de test : Haiku, ~5 tokens, négligeable (< 0.0001 $/test).

### Loi 25 — payload anonymisé
Le payload envoyé à Anthropic ne contient **AUCUNE PII** :
- ✅ Sexe (M/F), âge (entier)
- ✅ Valeurs numériques + catégories + percentiles
- ❌ PAS de nom, courriel, notes, date de naissance exacte (juste l'âge en années), commentaires libres

Le contrat est garanti par construction côté `AIAdvicePanel.tsx` qui n'inclut que `sex`, `age` calculé via `computeAge()`, et les `MetricSelection` (label + valeur + unité + catégorie + percentile — pas d'identifiant).

Anthropic est aux États-Unis (OpenAI aussi) — cf. politique de confidentialité Anthropic : pas de réutilisation des prompts pour entraîner des modèles dans le plan API standard. Compatible Loi 25 québécoise pour un payload anonyme.

## Conséquences

- **Marie-Eve doit fournir sa clé** (gratuit jusqu'à 5 $ de crédit de bienvenue, ensuite à charge). Doc accessible : https://console.anthropic.com/.
- **Dépendance réseau** : l'app reste utilisable sans, la feature IA est juste désactivée gracieusement (modal NO_API_KEY).
- **Pas de fallback offline** : si Anthropic est down, Marie-Eve voit une erreur. Acceptable pour une feature optionnelle.
- **Pas de retry automatique** : un échec = un message d'erreur, à elle de réessayer. Évite le hammering API en cas de souci persistant.

## Si on revient en arrière

- Désactiver `registerAIHandlers()` dans `main.ts` (commenter une ligne).
- Le frontend continue de fonctionner — `aiAdviceService.generate()` rejette avec une erreur claire.
- Pour réactiver le mock v0.1.30 : restaurer le fichier `aiAdvice.ts` depuis l'historique git.

Marie-Eve a validé l'orientation lors d'un échange du 2026-05-15.
