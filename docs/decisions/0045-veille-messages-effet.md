# 0045 — Prévenir Marie quand une cliente écrit dans Effet

Statut : acceptée — 2026-09-28

## Contexte

Les clientes de Marie lui écrivent depuis [[Effet]] (`kinesio-effet.fly.dev`),
l'app d'entraînement. Elle passe sa journée dans Kinésio Outils et n'ouvre Effet
que pour répondre : jusqu'ici, un message pouvait attendre des heures parce que
rien ne l'en avertissait. Elle ne le découvrait qu'en ouvrant la console.

Effet expose déjà ce qu'il faut, rien n'a été ajouté de ce côté :

- `GET /coach/fils` — par cliente : le nom, la date du dernier message, son
  auteur, le nombre de non-lus, et un `apercu` du texte.
- `503 { code: 'base_en_veille' }` quand la base dort (Fly.io endort les
  machines inactives).
- `401` quand la clé ne vaut plus rien.

## Décision

Une veille dans le processus principal : `GET /coach/fils` toutes les 150
secondes, et une notification Windows quand une cliente a écrit.

**La notification ne porte jamais le contenu du message.** Une cliente : « Julie
t'a écrit ». Plusieurs : « 3 nouveaux messages ». C'est la contrainte
structurante de ce lot, pas un détail d'affichage — Marie reçoit ses clientes
dans la même pièce que son écran, et faire apparaître les mots de l'une devant
l'autre est inacceptable. Le champ `apercu` arrive dans la réponse et s'arrête
à `filsANotifier` : il n'entre ni dans la notification, ni dans le journal, ni
dans le fichier d'état. Un test le vérifie explicitement.

On interroge `/coach/fils` et non `/coach/fils/non-lus` : la notification a
besoin du nom et du compte par cliente, que le simple total ne donne pas.

### Découpage

- `src/lib/effet-notifications.ts` — les décisions, sans Electron ni réseau :
  qui notifier, quel texte, quoi mémoriser. Testable en `node --test`.
- `electron/lib/effet-api.ts` — l'appel HTTP et les trois réponses du contrat.
- `electron/lib/effet-notifications-service.ts` — les effets : minuterie,
  fichier d'état, notification, journal.

### État local

`userData/effet-fils-vus.json` : par `clientId`, la date du dernier message déjà
vu. Rien d'autre — ni nom, ni texte. Il survit au redémarrage, sinon chaque
lancement rejouerait les notifications de la veille.

On y mémorise **tous** les fils datés, y compris ceux dont le dernier mot est
celui de Marie. Sans cela, un message qu'elle a écrit resterait « jamais vu » et
la première réponse de la cliente aurait rejoué tout l'échange.

### Conduite en cas d'ennui

| Réponse | Conduite |
|---------|----------|
| `503 base_en_veille` | Rien affiché, état intact. Ce n'est pas une panne : l'effacer ferait tout renotifier au réveil. |
| `401` | Une ligne au journal, puis la veille s'arrête jusqu'au prochain démarrage. Rejouer l'échec toutes les deux minutes ne ferait que remplir le journal. |
| Réseau, délai dépassé | Silence, une ligne au journal. Une notification d'erreur toutes les deux minutes rendrait l'outil insupportable. |

L'heure de dernière vérification n'avance **que** sur un contrôle abouti :
sinon l'interface mentirait sur la fraîcheur de ce qu'elle montre.

### Deux choses visibles

Dans Paramètres : un interrupteur (Marie est en séance, elle ne veut pas être
dérangée) et l'heure du dernier contrôle. Sans cette heure, « personne ne m'a
écrit » et « ça ne marche plus » se ressemblent trop.

L'interrupteur coupe les notifications, **pas** le sondage : l'heure continue
d'avancer, ce qui permet de vérifier que la veille fonctionne toujours.

## La clé d'accès

Saisie par Marie dans Paramètres → « Messages des clientes », chiffrée par
`safeStorage` (DPAPI sous Windows) et rangée en base64 dans la table `settings`
(`effet.cle`). L'IPC est à sens unique : l'interface peut envoyer une clé, jamais
la relire — elle ne sait que `cleConfiguree`. La clé ne transite que dans
l'en-tête `Authorization`, n'est jamais journalisée, jamais incluse dans un
message d'erreur. Si le chiffrement n'est pas disponible, rien n'est enregistré.

Une sauvegarde restaurée sur un autre poste rend le blob illisible : la veille
se comporte alors comme sans clé, et Marie la ressaisit.

Une nouvelle clé lève le verrou posé par un `401` et déclenche une vérification
immédiate.

**Écartés** : le `.env` (absent de l'application installée, et electron-vite ne
le charge pas dans `process.env`) ; l'injection au build via
`import.meta.env.MAIN_VITE_*` (la clé finirait en clair dans `app.asar` de
chaque release publiée).

## Alternatives écartées

- **Afficher un aperçu du message** — le confort ne vaut pas le risque de
  montrer les mots d'une cliente à une autre.
- **WebSocket ou notification poussée depuis Effet** — aurait demandé du travail
  côté Effet, alors que le contrat existant suffit. Un sondage de deux minutes
  est bien assez réactif pour des messages qui attendaient des heures.
- **Sonder `/coach/fils/non-lus`** — plus léger, mais sans le nom ni le
  détail par cliente la notification n'aurait rien pu dire d'utile.
