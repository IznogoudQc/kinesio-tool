# ADR 0017 — Migration vers un data router (`createHashRouter`) pour `useBlocker`

**Statut** : Accepté
**Date** : 2026-07-05

## Contexte

L'onglet Mesures pouvait perdre une saisie non enregistrée quand l'utilisateur quittait la page (changement d'onglet
client, retour à la liste, autre client). On veut un **avertissement « modifications non enregistrées »** qui intercepte
la navigation sortante. Le mécanisme idiomatique en React Router est `useBlocker`.

**Contrainte** : `useBlocker` n'est disponible qu'avec un **data router** (`createHashRouter` + `RouterProvider`). L'app
utilisait `<HashRouter><Routes>…</Routes></HashRouter>` (routeur « composant »), incompatible.

## Décision

Migration de `App.tsx` de `<HashRouter>` vers `createHashRouter([...])` + `<RouterProvider>`. L'arbre de routes est
transposé tel quel (mêmes chemins, mêmes `element`, mêmes redirections `<Navigate>`), y compris la route autonome
`/report/:id` et le layout `AppShell`.

Migration **contenue à `App.tsx`** : tous les autres composants n'utilisent que des hooks/comptés compatibles data router
(`useNavigate`, `NavLink`, `Link`, `Outlet`, `useParams`, `useSearchParams`, `useLocation`, `useOutletContext`,
`useMatch`). `UpdateToast` (hors `RouterProvider`) n'utilise aucun hook de routeur. react-router-dom ^7.15.

### Garde dans `MesuresTab`
- Chaque panneau (Circonférences, Plis) remonte son état « dirty » = **nouvelle** saisie non enregistrée
  (`!editId && champs remplis` — on n'alerte pas en mode édition d'une ligne déjà en base).
- `MesuresTab` combine les deux et appelle `useBlocker(dirty)`. Quand `blocker.state === 'blocked'`, un dialogue
  « Modifications non enregistrées » propose **Rester** (`blocker.reset()`) ou **Quitter sans enregistrer**
  (`blocker.proceed()`).
- Pas de `beforeunload` (fermeture app) : en Electron son comportement est incohérent et risque de piéger la fermeture.
  Le garde couvre toute la navigation **intra-app**, qui est le cas signalé.

## Conséquences

- **+** Garde complet sur toutes les sorties intra-app (onglets, sidebar, retour), sans intercepter chaque lien.
- **+** Combiné à v0.1.71 (deux panneaux montés), la saisie ne se perd plus ni au changement de sous-onglet, ni à la
  navigation sortante.
- **−** Changement structurel du bootstrap de navigation (tout passe par le data router). Régressions possibles sur la
  navigation en général → à surveiller. Vérifié : typecheck, build, lint OK ; aucun autre fichier ne référence l'ancien API.
- **−** L'alerte ne couvre pas la fermeture de l'app (choix assumé, cf. `beforeunload`).
