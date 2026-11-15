# Automatisations de suivi client, sans n8n, sans serveur à louer ni à gérer

*[English version: README.md](README.md)*

Cinq automatisations pour un indépendant qui envoie des devis (construites pour un photographe, valables pour toute petite entreprise) : relance des devis, lien de rendez-vous pré-rempli quand un devis est validé, tableau qui se met à jour tout seul quand un client réserve, reporte ou annule, relances après une annulation, et rapport du lundi. Tout tourne gratuitement dans ton compte Google, ordinateur éteint.

Construit avec Claude Code le 7 novembre 2026. C'est la réécriture sans n8n des automatisations faites en août pour un photographe. Tous les noms et e-mails de ce repo sont fictifs.

## Ce que ça fait

| Quand | Ce qui se passe |
|---|---|
| Chaque matin vers 8 h | Les devis sans réponse depuis 3 jours, puis 7 jours, reçoivent un **brouillon** de relance dans Gmail |
| Tu passes un devis à « validé » | Le client reçoit un mail avec ton lien de réservation, déjà rempli (nom, e-mail, réf du devis) |
| Le client réserve, reporte ou annule sur Cal.com | Le tableau se met à jour tout seul : date du RDV, statut |
| 7 jours, puis 15 jours après une annulation | Un mail de relance avec le lien pour reprendre une date |
| Chaque lundi vers 8 h | Un rapport dans ta boîte mail : devis relancés, validés, annulations, rendez-vous de la semaine |
| Rendez-vous pris | Cal.com l'ajoute **lui-même** à ton agenda |

**Coût** : rien de plus pour le faire tourner. Google Sheets, Apps Script et Gmail sont gratuits, et Cal.com a une offre gratuite. Il faut seulement Claude Code (un abonnement Claude) pour construire ou adapter le script.
**Ordinateur** : il peut être éteint, tout tourne chez Google.
**Envois** : les relances de devis sont des **brouillons** par défaut, parce que le tableau ne peut pas savoir qu'un client t'a déjà dit oui au téléphone. Le mail du lien de rendez-vous et les relances après annulation **partent tout seuls** par défaut : ils sont déclenchés par ton « validé » ou par Cal.com. Chacun se règle en haut du script, sur `'envoyer'` ou `'brouillon'`.

## Installation (9 étapes)

Les noms entre parenthèses sont ceux des boutons quand Google est en anglais. Les menus de Cal.com sont donnés en anglais.

1. **Le tableau** : crée un nouveau Google Sheet, puis **Extensions → Apps Script**.
2. **Le code** : colle `Code.gs`, enregistre, puis lance **`creerTableau`** avec **Exécuter** (*Run*) : il crée la feuille.
3. **L'autorisation Google** : Google affiche **« Google n'a pas validé cette application »** (*Google hasn't verified this app*). C'est normal pour un script que tu as fait toi-même : **Paramètres avancés → Accéder au projet** (*Advanced → Go to … (unsafe)*), puis autorise.
4. **La feuille « Suivi »** apparaît avec ses 14 colonnes. Tu remplis les 7 premières, le script remplit le reste. Tape un faux devis, ou importe `tests/devis-exemple.csv` (Fichier → Importer).
   - Pour essayer une vraie réservation à l'étape 8, mets **ta propre adresse avec un alias** : `ton.adresse+sophie@gmail.com`. Gmail ignore ce qui suit le `+`, le mail arrive chez toi, et Cal.com l'accepte. Avec une adresse en `@example.com`, Cal.com refuse la réservation.
   - La date du devis doit avoir **au moins 3 jours**, sinon aucune relance n'est proposée. Si ton Google Sheets est en anglais, le mois s'écrit d'abord : `11/08/2026` pour le 8 novembre.
5. **La simulation** : lance `quotidien` et `rapportHebdo`. Avec `SIMULATION = true`, le **journal d'exécution** (*Execution log*) dit ce qu'il ferait, sans rien toucher.
6. **Les réglages**, en haut du script :
   - `SIGNATURE` : ton nom ;
   - `LANGUE` : `'fr'` ou `'en'` (mails, titres du tableau et rapport) ;
   - `LIEN_RDV` : ton lien de rendez-vous Cal.com (voir « Préparer Cal.com », juste en dessous) ;
   - `CLE_WEBHOOK` : une longue phrase que toi seul connais, **sans espace ni accent** (des mots séparés par des tirets) : elle ira dans une adresse web ;
   - `ENVOI_RELANCES_DEVIS`, `ENVOI_LIEN_RDV`, `ENVOI_RELANCES_ANNULATION` : `'envoyer'` (part tout seul) ou `'brouillon'` (tu relis d'abord) ;
   - **en dernier, le mode réel** : `SIMULATION = false`, puis enregistre. À l'étape suivante, le déploiement garde une copie du code tel qu'il est à ce moment-là, et c'est cette copie que Cal.com appellera. Rien ne part tout seul pour autant : il n'y a encore ni déclencheur ni webhook.

   Si tu changes `LANGUE` après l'étape 2, relance `creerTableau` pour réécrire les titres.

   **Préparer Cal.com** (pour avoir ton lien de rendez-vous) :
   1. crée un compte gratuit sur cal.com ;
   2. **l'agenda** : **Apps → Installed apps → Calendar**, connecte ton agenda pour que les rendez-vous y arrivent et que les créneaux déjà pris soient bloqués ;
   3. **tes disponibilités** : **Availability**, règle tes jours, tes heures et ton fuseau horaire ;
   4. **le lien** : dans **Links**, crée un lien avec un titre et une durée ;
   5. dans les réglages de ce lien : **Add to calendar** = ton agenda ; dans **Booking form**, laisse **Additional notes** visible. C'est là que voyage la réf du devis ;
   6. copie le lien (**Copy link**) et colle-le dans `LIEN_RDV`.
7. **L'application web** : **Déployer → Nouveau déploiement → Application web** (*Deploy → New deployment → Web app*), « Exécuter en tant que : moi », « Accès : tout le monde ». Copie l'adresse : elle finit par `/exec`. Sans ta clé secrète, cette adresse ne modifie rien (testé).
8. **Le webhook Cal.com** : **Settings → Developer → Webhooks → New**.
   - **Subscriber URL** : colle l'adresse de l'étape 7, puis **ajoute au bout `?cle=` et ta phrase secrète**, exactement celle de `CLE_WEBHOOK` :
     - avant : `https://script.google.com/macros/s/…/exec`
     - après : `https://script.google.com/macros/s/…/exec?cle=ma-longue-phrase-secrete`
   - **Event triggers** : clique sur *Clear all triggers* (la liste est longue), puis coche seulement *Booking created*, *Booking rescheduled* et *Booking canceled*.
   - Laisse **Secret** vide : la clé est déjà dans l'adresse. L'offre gratuite de Cal.com a les webhooks.
   - **Si le tableau ne bouge pas après une réservation**, relis cette adresse : elle doit finir par `/exec?cle=` suivi de ta phrase. Rien ne signale l'oubli : Cal.com enregistre le webhook et le client reçoit son mail quand même.
9. **Les déclencheurs** : lance **une seule fois** `installerDeclencheurs`. À partir de là, ça tourne tout seul.

**Bon à savoir** : si tu changes plus tard ta clé secrète ou la langue, la copie déployée ne le sait pas. Fais **Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer** (*Deploy → Manage deployments*) : l'adresse ne change pas.

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
| Envoi automatique (9 novembre) | Mail du lien envoyé tout seul dès le passage à « validé » ; relance après annulation envoyée toute seule par la routine du matin ; les deux reçus |
| Installation complète rejouée (13 novembre) | Dans l'ordre de ce README, Google et Cal.com en anglais : réservation, report et annulation écrits dans le tableau ; relance après annulation et rapport lancés à la main |
| Agenda | Vérifié avec Google Agenda. iCloud et iPhone pas regardés |

**Tests de la logique** : `node tests/tester-suivi.mjs` rejoue toutes les règles sur des données fictives. 43 vérifications au moment du tournage (7 novembre) ; **61** depuis le 9 novembre (statuts, tableau et rapport en anglais ; réglages d'envoi). Pour vérifier que les tests servent à quelque chose, le code a été cassé exprès : les tests l'ont vu.

**Bon à savoir** : un report n'envoie pas d'annulation (testé deux fois : par le photographe et par le client). Une annulation très ancienne, découverte tard, peut recevoir ses deux relances deux jours de suite (cas rare).

## Pour qui, et ses limites

- **Fait pour l'environnement Google** : Google Sheets, Apps Script, Gmail et Google Agenda (par Cal.com). C'est le seul environnement testé.
- **Sur Outlook, Excel ou d'autres outils**, ce code ne marche pas tel quel. Tu peux donner la consigne (`consigne-claude-code.md`) à Claude Code en précisant tes outils pour qu'il l'adapte, mais ce n'est pas testé, et certains outils (par exemple chez Microsoft) peuvent être payants.
- **Les mails sont des modèles fixes** que tu modifies dans `Code.gs` : aucune IA ne les rédige au quotidien. Essai du 9 novembre 2026 : la formule gratuite de l'API Gemini a été refusée pour les projets essayés.
- **Avec Codex (ChatGPT) au lieu de Claude Code** : le 9 novembre, la même consigne donnée à Codex a construit une version qui marche, avec ses propres tests (90/90 réussis), en 8 minutes environ. Cette version n'a pas été installée chez Google.
- Si tu veux relier beaucoup d'outils différents en blocs, ou qu'une IA rédige chaque mail, un outil comme n8n (payant en ligne) reste plus simple.

## Les fichiers

- `Code.gs` : les règles d'abord (testables sans Google), puis ce qui touche à Google.
- `tests/tester-suivi.mjs` : toutes les règles rejouées sur des données fictives. `tests/devis-exemple.csv` / `tests/quotes-example.csv` : faux devis en français / en anglais.
- `consigne-claude-code.md` : la consigne à donner à Claude Code pour refaire ou adapter le système (version anglaise : `prompt-claude-code.md`).

## Licence

MIT : tu peux utiliser, modifier et partager ce code librement, même pour ton activité, en gardant le fichier `LICENSE`.
