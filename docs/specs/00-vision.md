# Vision

## Pourquoi cet outil existe

Marie-Eve est kinésiologue. Son travail quotidien implique :
- Gérer une liste de clients (coordonnées, suivi)
- Rédiger et envoyer des bilans de forme physique
- Répondre aux courriels de suivi

Aujourd'hui, ces tâches sont éparpillées entre plusieurs outils (carnet papier, Word, Outlook, contacts du téléphone). **L'outil Kinésio Outils centralise ces tâches dans une application desktop locale, sans cloud, sans portail client.**

## Principes directeurs

1. **100 % local** — toutes les données vivent sur le PC de Marie-Eve. Aucun cloud, aucun serveur, aucun partage. Voir [[../decisions/0003-strategie-loi25-minimisation]].
2. **Reproduire la pratique actuelle** — l'outil ne lui impose pas de nouveaux workflows. Il rend les workflows existants plus rapides.
3. **Single user** — Marie-Eve est la seule utilisatrice. Pas d'authentification multi-utilisateur, pas de gestion de rôles.
4. **API-ready** — l'architecture est pensée pour qu'une migration web future (si Marie-Eve le veut un jour) ne nécessite pas une réécriture. Voir [[../decisions/0004-architecture-api-ready]].

## Ce que l'outil n'est pas

- Pas un dossier médical électronique (DSE)
- Pas un système de prise de RDV en ligne
- Pas un portail client
- Pas un outil de facturation
- Pas un outil multi-utilisateur

Ces fonctions pourront éventuellement être ajoutées si Marie-Eve en exprime le besoin, mais elles sont **explicitement hors scope v1**.
