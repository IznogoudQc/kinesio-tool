# ADR 0035 — Signature électronique du Q-AAP

- **Statut** : acceptée
- **Date** : 2026-07-29

## Contexte

Le Q-AAP est un formulaire d'attestation : le client déclare avoir répondu
honnêtement aux sept questions. Il était rempli dans l'app sans trace de cette
attestation.

## Décision

Signature **manuscrite tracée à l'écran** (souris, doigt ou stylet), stockée
dans le JSON du questionnaire — aucune migration. Le client seul signe, ce que
prévoit le formulaire SCPE.

## Ce qui est conservé, et pourquoi

```ts
interface QaapSignature {
  dataUrl: string            // le tracé, PNG
  signerName: string         // le nom saisi
  signedAt: string           // horodatage ISO
  answersAtSigning: (boolean | null)[]
}
```

- **`signerName`** — une signature manuscrite est souvent illisible. Un dossier
  doit rester interprétable dans dix ans par quelqu'un d'autre que Marie-Eve.
- **`answersAtSigning`** — sans cette copie, impossible de distinguer « signé
  tel quel » de « signé, puis modifié ». Un formulaire d'attestation dont les
  réponses ont bougé après coup ne vaut plus rien, et il faut pouvoir le voir.
  `qaapSignatureStale()` le détecte ; l'app le signale et le PDF l'imprime.

## Règles

- **On ne signe pas un formulaire incomplet.** Attester des réponses qui
  n'existent pas n'a aucun sens : le pavé est désactivé tant que les sept
  questions ne sont pas répondues.
- **Une signature caduque n'est jamais supprimée en silence.** L'app affiche un
  avertissement et propose de refaire signer ; le document imprimé porte la
  mention « des réponses ont été modifiées après cette signature ».
- **Le PDF existe.** Une signature qu'on ne peut pas produire hors de
  l'application ne sert à rien : c'est en cas de contestation qu'il faut sortir
  le document. Route `/qaap/:id` + `generateQaapPdf`, même mécanique que les
  barèmes.

## Défaut corrigé au passage

La table `questionnaires` n'était **pas incluse dans l'export/import** de
dossiers clients. Un Q-AAP signé aurait donc disparu au transfert d'un poste à
l'autre — ce qui vide la signature de son sens. Ajoutée au format, en
`optional()` pour que les fichiers déjà exportés restent importables.

## Portée juridique — non revendiquée

Ce mécanisme produit un **enregistrement** : un tracé, un nom, un horodatage et
l'état exact du formulaire signé. Il ne prétend pas constituer une signature
électronique qualifiée au sens de la Loi concernant le cadre juridique des
technologies de l'information. Si Marie-Eve a besoin d'une valeur probante
particulière, c'est à valider auprès de son ordre professionnel — l'application
ne doit pas le laisser supposer à sa place.
