# Automatisations de suivi client, sans n8n ni serveur

*[English version: README.md](README.md)*

Cinq automatisations pour un indépendant qui envoie des devis (construites pour un photographe, valables pour toute petite entreprise) : relance des devis, lien de rendez-vous pré-rempli quand un devis est validé, tableau qui se met à jour tout seul quand un client réserve, reporte ou annule, relances après une annulation, et rapport du lundi. Tout tourne gratuitement dans ton compte Google, ordinateur éteint.

Construit avec Claude Code le 7 novembre 2026. C'est la réécriture sans n8n des automatisations faites en août pour un photographe. Tous les noms et e-mails de ce repo sont fictifs.

## Ce que ça fait

| Quand | Ce qui se passe |
|---|---|
| Chaque matin vers 8 h | Les devis sans réponse depuis 3 jours, puis 7 jours, reçoivent un **brouillon** de relance dans Gmail |
| Tu passes un devis à « validé » | Le client reçoit un mail avec ton lien de réservation, déjà rempli (nom, e-mail, réf du devis) |
| Le client réserve, reporte ou annule sur Cal.com | Le tableau se met à jour tout seul : date du RDV, statut |
| 7 jours, puis 15 jours après une annulation | Un brouillon de relance avec le lien pour reprendre une date |
| Chaque lundi vers 8 h | Un rapport dans ta boîte mail : devis relancés, validés, annulations, rendez-vous de la semaine |
| Rendez-vous pris | Cal.com l'ajoute **lui-même** à ton agenda |

**Coût** : rien de plus pour le faire tourner. Google Sheets, Apps Script et Gmail sont gratuits, et Cal.com a une offre gratuite. Il faut seulement Claude Code (un abonnement Claude) pour construire ou adapter le script.
**Ordinateur** : il peut être éteint, tout tourne chez Google.
**Envois** : les relances sont toujours des brouillons. Le mail du lien de rendez-vous est un brouillon par défaut (`ENVOI_LIEN_RDV = 'envoyer'` pour qu'il parte tout seul).

## Installation (9 étapes)

1. **Le tableau** : crée un nouveau Google Sheet, puis **Extensions → Apps Script**.
2. **Le code** : colle `Code.gs`, enregistre, puis lance **`creerTableau`** (il crée la feuille).
3. **L'autorisation Google** : Google affiche **« Google n'a pas validé cette application »**. C'est normal pour un script que tu as fait toi-même : **Paramètres avancés → Accéder au projet**, puis autorise.
4. **La feuille « Suivi »** apparaît avec ses 14 colonnes. Tu remplis les 7 premières, le script remplit le reste. Tape un faux devis, ou importe `tests/devis-exemple.csv` (Fichier → Importer).
5. **La simulation** : lance `quotidien` et `rapportHebdo`. Avec `SIMULATION = true`, le **journal d'exécution** dit ce qu'il ferait, sans rien toucher.
6. **Les réglages**, en haut du script :
   - `SIGNATURE` : ton nom ;
   - `LANGUE` : `'fr'` ou `'en'` (mails, titres du tableau et rapport) ;
   - `LIEN_RDV` : ta page Cal.com ;
   - `CLE_WEBHOOK` : une longue phrase que toi seul connais.

   Si tu changes `LANGUE` après l'étape 2, relance `creerTableau` pour réécrire les titres.
7. **L'application web** : **Déployer → Nouveau déploiement → Application web**, « Exécuter en tant que : moi », « Accès : tout le monde ». Copie l'adresse. Sans ta clé secrète, cette adresse ne modifie rien (testé).
8. **Cal.com** :
   - **Webhook** : **Paramètres → Développeur → Webhooks**, colle l'adresse en ajoutant `?cle=` puis ta phrase secrète. Coche *Booking created*, *Booking rescheduled* et *Booking cancelled*. L'offre gratuite de Cal.com a les webhooks.
   - **Agenda** : dans Applications, connecte ton agenda pour que les rendez-vous y arrivent.
   - **Champ « notes »** : laisse-le actif sur ton type de rendez-vous. C'est là que voyage la réf du devis.
9. **Le mode réel** : `SIMULATION = false`, puis lance **une seule fois** `installerDeclencheurs`. À partir de là, ça tourne tout seul.

## Les colonnes de la feuille « Suivi »

Client · E-mail · Prestation · Montant · Réf devis · Date du devis · Statut (envoyé / validé / refusé) · Relance 1 · Relance 2 · Lien RDV envoyé · Date RDV · Statut RDV (pris / annulé) · Date annulation · Relances annulation.
Tu remplis les 7 premières. Le script remplit les autres. Les statuts se tapent en français ou en anglais (`validé` ou `approved`).

## Testé en réel (7 et 8 novembre 2026, compte de démonstration)

Testé dans mon labo, sur un compte Google créé spécialement pour ces tests et un Cal.com gratuit, en français.

| Test | Résultat |
|---|---|
| Simulation : 6 clients fictifs | Annonce exactement les 2 relances de devis et la relance après annulation attendues, rien pour les autres |
| Mode réel | 3 brouillons corrects dans Gmail (prénom, prestation, montant, lien) ; dates écrites dans le tableau |
| Relancé deux fois de suite | 0 relance au 2e passage : pas de doublon le même jour |
| Taper « validé » dans le tableau | Brouillon « On fixe la date de votre séance » avec le lien pré-rempli, colonne « Lien RDV envoyé » remplie |
| **Vraie** réservation, **vrai** report et **vraie** annulation sur Cal.com | Le tableau suit : « pris » + date, puis nouvelle date (statut gardé), puis « annulé » + date d'annulation ; l'heure est convertie au fuseau du tableau |
| Mauvaise clé | Rien n'est modifié |
| Réf inconnue | Mail d'alerte « rendez-vous sans devis correspondant » |
| Déclencheur de 8 h | Le 8 novembre, il a préparé tout seul une relance à 8 h 18 |
| Rapport du lundi | Reçu tout seul le lundi 9 novembre à 8 h 35, avec les bons chiffres |
| Agenda | Vérifié avec Google Agenda. iCloud et iPhone pas regardés |

**Tests de la logique** : `node tests/tester-suivi.mjs` rejoue toutes les règles sur des données fictives. 43 vérifications au moment du tournage (7 novembre) ; **60** depuis l'ajout de l'anglais le 9 novembre (statuts, tableau et rapport en anglais). Pour vérifier que les tests servent à quelque chose, le code a été cassé exprès : les tests l'ont vu.

**Bon à savoir** : un report n'envoie pas d'annulation (testé deux fois : par le photographe et par le client). Une annulation très ancienne, découverte tard, peut recevoir ses deux relances deux jours de suite (cas rare).

## Pour qui, et ses limites

- **Fait pour l'environnement Google** : Google Sheets, Apps Script, Gmail et Google Agenda (par Cal.com). C'est le seul environnement testé.
- **Sur Outlook, Excel ou d'autres outils**, ce code ne marche pas tel quel. Tu peux donner la consigne (`consigne-claude-code.md`) à Claude Code en précisant tes outils pour qu'il l'adapte, mais ce n'est pas testé, et certains outils (par exemple chez Microsoft) peuvent être payants.
- **Les mails sont des modèles fixes** que tu modifies dans `Code.gs` : aucune IA ne les rédige au quotidien. Essai du 9 novembre 2026 : la formule gratuite de l'API Gemini a été refusée pour les projets essayés.
- Si tu veux relier beaucoup d'outils différents en blocs, ou qu'une IA rédige chaque mail, un outil comme n8n (payant en ligne) reste plus simple.

## Les fichiers

- `Code.gs` : les règles d'abord (testables sans Google), puis ce qui touche à Google.
- `tests/tester-suivi.mjs` : toutes les règles rejouées sur des données fictives. `tests/devis-exemple.csv` / `tests/quotes-example.csv` : faux devis en français / en anglais.
- `consigne-claude-code.md` : la consigne à donner à Claude Code pour refaire ou adapter le système (version anglaise : `prompt-claude-code.md`).

## Licence

MIT : tu peux utiliser, modifier et partager ce code librement, même pour ton activité, en gardant le fichier `LICENSE`.
