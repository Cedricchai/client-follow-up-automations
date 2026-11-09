# La consigne à donner à Claude Code (offerte dans la vidéo)

> Utilisée pour construire ce système le 07/11/2026 (version anglaise : `prompt-claude-code.md`). À coller dans Claude Code, dans un dossier vide. Remplace ce qui est entre crochets.
> C'est la consigne d'origine, mot pour mot. Depuis le 9 novembre, le repo envoie tout seul le lien de rendez-vous et les relances après annulation (les relances de devis restent des brouillons) ; chaque mail se règle en haut de `Code.gs`. Marche aussi avec Codex (ChatGPT) : testé le 9 novembre, pas installé chez Google.
> Tu n'es pas sur Google (Outlook, Excel…) ? Dis quels outils tu utilises dans le premier paragraphe : Claude Code l'adaptera, mais cette version n'est pas testée, et certains outils peuvent être payants.

---

Je suis [photographe / artisan / indépendant]. J'envoie des devis, j'oublie de relancer, et je perds le fil des rendez-vous.

Construis-moi un système de suivi client **sans n8n ni serveur** : un script Google Apps Script à coller dans un Google Sheet, qui tourne chez Google même quand mon ordinateur est éteint. Explique chaque étape simplement : je veux comprendre ce que fait le script avant de le lancer.

Ce qu'il doit faire :
1. Chaque matin : les devis sans réponse depuis 3 jours, puis 7 jours → un **brouillon** de relance dans Gmail (jamais d'envoi automatique), une seule relance par jour et par devis, jamais un devis validé ou refusé.
2. Quand je passe un devis à « validé » : un mail au client avec mon lien Cal.com [mon lien] pré-rempli (nom, e-mail, et la réf du devis dans les notes).
3. Quand un client réserve, reporte ou annule sur Cal.com : mettre à jour la bonne ligne grâce à la réf du devis (une adresse « application web » que Cal.com appelle, protégée par une clé secrète). Un report ne change que la date.
4. Après une annulation : brouillon de relance à 7 jours puis à 15 jours, avec le lien pour reprendre une date.
5. Chaque lundi : un rapport par mail (devis relancés, validés, annulations, rendez-vous de la semaine).
6. Un mode simulation activé au départ, les réglages en haut du script, une fonction qui crée le tableau, une qui installe les déclencheurs sans doublon.
7. Des tests de toutes les règles que je peux lancer sans Google, sur des devis fictifs.

Mes mails aux clients sont en [français / anglais], signés [mon nom].
