# ADR 0003 — Stratégie de minimisation Loi 25 par localité

**Statut** : Accepté
**Date** : 2026-05-09

## Contexte

Marie-Eve est kinésiologue au Québec. Comme professionnelle qui collecte des renseignements personnels (et de nature sensible — santé/forme physique), elle est assujettie à :

- **Loi 25** (modernisation de la protection des renseignements personnels)
- **LRSSS** (Loi sur les renseignements de santé et de services sociaux)
- **Code de déontologie de la Fédération des kinésiologues du Québec (FKQ)**

Ces obligations s'appliquent à elle **peu importe l'outil** qu'elle utilise. Le choix d'architecture de l'app peut soit **alléger** soit **alourdir** ces obligations.

## Décision

**Tout reste local sur le PC de Marie-Eve.** L'app ne :
- Ne stocke aucune donnée sur un serveur
- Ne transmet aucune donnée à un tiers
- Ne fait aucun appel réseau sauf le SMTP de Marie-Eve elle-même (via son compte pro)

Conséquence : **l'app et le développeur (toi) n'ont quasi aucune obligation Loi 25**. Marie-Eve garde ses obligations professionnelles normales — qu'elle aurait de toute façon avec un cahier papier.

## Ce que cette stratégie élimine

- ❌ Pas d'EFVP pour transfert hors Québec
- ❌ Pas d'entente écrite avec un sous-traitant (Supabase, AWS, etc.)
- ❌ Pas de politique de cookies
- ❌ Pas de notification de bris liée à une intrusion web
- ❌ Pas de désignation d'un responsable côté outil
- ❌ Pas d'hébergement Canadien à valider

## Ce qui reste à la charge de Marie-Eve (pas du tool)

(reproduit ici pour clarté — ne change pas selon l'outil utilisé)

- Désigner un responsable de la protection des renseignements personnels (= elle-même)
- Politique de confidentialité interne
- Consentement éclairé du client lors de la collecte
- Permettre l'accès, rectification, suppression des données
- Tenir un registre des incidents de confidentialité
- Déclarer à la CAI tout incident à risque sérieux (ex: vol du PC)
- Politique de conservation/destruction (FKQ : 5 ans après dernière consultation)
- Chiffrement des données sensibles (recommandation : BitLocker au niveau OS)

## Scope v1

L'app v1 **ne facilite pas activement** ces obligations à Marie-Eve. Elle reproduit simplement sa pratique actuelle (envoi d'emails avec PJ). Voir [[../specs/01-features#v3]] pour les features de conformité renforcée prévues plus tard.

## Conséquences

**Positives** :
- Développement v1 ultra rapide — aucune feature Loi 25 à implémenter au départ
- Risque légal pour le développeur quasi nul
- Marie-Eve n'a pas besoin de signer d'entente de sous-traitance avec qui que ce soit

**Négatives** :
- Si Marie-Eve veut un jour un portail client web → migration à faire (architecture déjà préparée pour, voir ADR 0004)
- Si son PC est volé sans BitLocker activé, le bris est total et déclarable à la CAI — à documenter dans le manuel utilisateur

## Alternatives considérées

- **Hébergement Supabase au Canada dès le jour 1** — rejeté, sur-ingénierie pour une utilisatrice unique, déclenche toutes les obligations Loi 25 sans bénéfice immédiat
- **Service géré tiers (Jane App, GOrendezvous)** — rejeté pour la v1, mais reste une option valable si Marie-Eve veut un portail RDV un jour
