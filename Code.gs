/**
 * Suivi client d'un photographe (ou de tout indépendant qui envoie des devis), sans n8n ni serveur.
 * Tout tourne gratuitement chez Google, ordinateur éteint. Construit avec Claude Code.
 *
 *   1. Devis en attente      → brouillon de relance à 3 jours, puis à 7 jours (tu relis : le tableau peut ne pas être à jour)
 *   2. Devis passé à « validé » → mail envoyé au client avec un lien de rendez-vous pré-rempli (Cal.com)
 *   3. Rendez-vous pris, reporté ou annulé sur Cal.com → le tableau se met à jour tout seul
 *   4. Rendez-vous annulé    → relance envoyée à 7 jours, puis à 15 jours, avec le lien pour reprendre une date
 *   5. Chaque lundi          → un rapport de la semaine dans ta boîte mail
 *
 * Les rendez-vous arrivent dans ton agenda (Google ou iCloud, donc aussi sur iPhone) grâce à Cal.com lui-même :
 * aucun code pour ça, voir le README.
 * Mise en route pas à pas : README.md. Commence TOUJOURS avec SIMULATION = true.
 */

// ================================================================ réglages
const NOM_FEUILLE = 'Suivi';
const SIGNATURE = 'Ton prénom';
const LANGUE = 'fr';                                  // 'fr' ou 'en' : langue des mails, du tableau et du rapport
const LIEN_RDV = 'https://cal.com/TON-COMPTE/TON-EVENEMENT'; // ta page de réservation Cal.com
const CLE_WEBHOOK = 'change-moi-par-une-longue-phrase-secrete'; // protège l'adresse que Cal.com appelle
const JOURS_RELANCE_DEVIS = [3, 7];                   // relances d'un devis sans réponse
const JOURS_RELANCE_ANNULATION = [7, 15];             // relances après un rendez-vous annulé
// Pour chaque mail : 'envoyer' (part tout seul) ou 'brouillon' (il t'attend dans Gmail, pour le relire ou le personnaliser)
const ENVOI_RELANCES_DEVIS = 'brouillon';             // brouillon par défaut : un client a pu dire oui au téléphone sans que le tableau le sache
const ENVOI_LIEN_RDV = 'envoyer';                     // le lien Cal.com part dès que tu écris « validé »
const ENVOI_RELANCES_ANNULATION = 'envoyer';          // l'annulation vient de Cal.com : l'information est sûre
const SIMULATION = true;                              // true = écrit dans le journal ce qu'il ferait, sans rien toucher

// Colonnes du tableau « Suivi » (0 = colonne A). La ligne 1 contient les titres.
const COL = {
  client: 0, email: 1, prestation: 2, montant: 3, ref: 4, dateDevis: 5, statut: 6,
  relance1: 7, relance2: 8, lienEnvoye: 9, dateRdv: 10, statutRdv: 11, dateAnnulation: 12, relancesAnnulation: 13,
};
const TITRES = LANGUE === 'en'
  ? ['Client', 'Email', 'Service', 'Amount', 'Quote ref', 'Quote date', 'Status',
    'Follow-up 1', 'Follow-up 2', 'Booking link sent', 'Appointment date', 'Appointment status', 'Cancellation date', 'Cancellation follow-ups']
  : ['Client', 'E-mail', 'Prestation', 'Montant', 'Réf devis', 'Date du devis', 'Statut',
    'Relance 1', 'Relance 2', 'Lien RDV envoyé', 'Date RDV', 'Statut RDV', 'Date annulation', 'Relances annulation'];

// ================================================================ les règles (testables sans Google)
// Les fonctions internes finissent par « _ » : Apps Script ne les montre pas dans la liste « Exécuter ».
const texte_ = x => String(x == null ? '' : x).trim();
const minuscule_ = x => texte_(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function emailValide_(x) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texte_(x)); }
function enDate_(x) {
  if (x instanceof Date && !isNaN(x)) return x;
  const s = texte_(x);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?$/); // 05/11/2026 ou 05/11/2026 14:30
  const d = m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : new Date(s);
  return isNaN(d) ? null : d;
}
function minuit_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function joursEntre_(a, b) { return Math.round((minuit_(b) - minuit_(a)) / 86400000); }
// Le statut se lit en français ou en anglais, quelle que soit la langue choisie (validé, approved, refusé, declined…)
const estValide_ = l => /valid|approv|accept/.test(minuscule_(l[COL.statut]));
const estClos_ = l => estValide_(l) || /refus|perdu|signe|oui|declin|reject|lost|yes/.test(minuscule_(l[COL.statut]));
const estAnnule_ = x => /^(annul|cancel)/.test(minuscule_(x));
const STATUT_RDV = LANGUE === 'en' ? {pris: 'booked', annule: 'cancelled'} : {pris: 'pris', annule: 'annulé'};

/** Relance de devis à préparer aujourd'hui : 1, 2… ou 0. Une seule par jour et par devis. */
function relanceDevisAFaire_(l, aujourdhui) {
  if (estClos_(l) || !emailValide_(l[COL.email])) return 0;
  const envoi = enDate_(l[COL.dateDevis]);
  if (!envoi) return 0;
  const faites = [enDate_(l[COL.relance1]), enDate_(l[COL.relance2])];
  const n = faites.filter(Boolean).length;
  if (n >= JOURS_RELANCE_DEVIS.length) return 0;
  if (faites.some(d => d && joursEntre_(d, aujourdhui) === 0)) return 0;
  return joursEntre_(envoi, aujourdhui) >= JOURS_RELANCE_DEVIS[n] ? n + 1 : 0;
}

/** Relance après annulation : numéro à préparer aujourd'hui, ou 0. Compte depuis la date d'annulation. */
function relanceAnnulationAFaire_(l, aujourdhui) {
  if (!estAnnule_(l[COL.statutRdv]) || !emailValide_(l[COL.email])) return 0;
  const annul = enDate_(l[COL.dateAnnulation]);
  if (!annul) return 0;
  const n = parseInt(texte_(l[COL.relancesAnnulation]) || '0', 10) || 0;
  if (n >= JOURS_RELANCE_ANNULATION.length) return 0;
  return joursEntre_(annul, aujourdhui) >= JOURS_RELANCE_ANNULATION[n] ? n + 1 : 0;
}

/** Lien de réservation pré-rempli : nom, e-mail, et la réf du devis dans les notes (c'est elle qui relie le RDV à la ligne). */
function lienRdv_(l) {
  const notes = [texte_(l[COL.ref]), texte_(l[COL.prestation])].filter(Boolean).join(' - ');
  return `${LIEN_RDV}?name=${encodeURIComponent(texte_(l[COL.client]))}&email=${encodeURIComponent(texte_(l[COL.email]))}&notes=${encodeURIComponent(notes)}`;
}

/** Ce que Cal.com envoie (webhook) → {type, ref, debut, nom, email}. type : pris, reporte, annule, ou null si ignoré. */
function lireEvenementCal_(json) {
  const types = {BOOKING_CREATED: 'pris', BOOKING_RESCHEDULED: 'reporte', BOOKING_CANCELLED: 'annule'};
  const p = (json && json.payload) || {};
  const invite = (p.attendees && p.attendees[0]) || {};
  return {
    type: types[json && json.triggerEvent] || null,
    ref: texte_(p.additionalNotes || (p.responses && p.responses.notes && p.responses.notes.value)).split(' - ')[0].trim(),
    debut: p.startTime ? new Date(p.startTime) : null,
    nom: texte_(invite.name), email: texte_(invite.email),
  };
}

/**
 * Où et quoi écrire pour un événement Cal.com : {ligne (index dans lignes), modifs {colonne: valeur}} ou {ligne: -1}.
 * Un report ne change que la date (pas le statut ni le compteur) ; une annulation remet le compteur de relances à 0.
 */
function appliquerEvenement_(lignes, evt, maintenant) {
  const i = evt.ref ? lignes.findIndex((l, k) => k > 0 && texte_(l[COL.ref]) === evt.ref) : -1;
  if (i < 0 || !evt.type) return {ligne: -1, modifs: {}};
  if (evt.type === 'pris') return {ligne: i, modifs: {[COL.dateRdv]: evt.debut, [COL.statutRdv]: STATUT_RDV.pris}};
  if (evt.type === 'reporte') return {ligne: i, modifs: {[COL.dateRdv]: evt.debut}};
  return {ligne: i, modifs: {[COL.statutRdv]: STATUT_RDV.annule, [COL.dateAnnulation]: maintenant, [COL.relancesAnnulation]: 0}};
}

/** Chiffres du rapport de la semaine (les 7 derniers jours) et rendez-vous des 7 prochains jours. */
function statsSemaine_(lignes, aujourdhui) {
  const recent = x => { const d = enDate_(x); return d && joursEntre_(d, aujourdhui) >= 0 && joursEntre_(d, aujourdhui) < 7; };
  const corps = lignes.slice(1).filter(l => texte_(l[COL.client]) || texte_(l[COL.email]));
  const aVenir = corps.filter(l => { const d = enDate_(l[COL.dateRdv]); return d && !estAnnule_(l[COL.statutRdv])
    && joursEntre_(aujourdhui, d) >= 0 && joursEntre_(aujourdhui, d) < 7; })
    .sort((a, b) => enDate_(a[COL.dateRdv]) - enDate_(b[COL.dateRdv]));
  return {
    relancesDevis: corps.filter(l => recent(l[COL.relance1]) || recent(l[COL.relance2])).length,
    devisValides: corps.filter(l => recent(l[COL.lienEnvoye])).length,
    devisEnAttente: corps.filter(l => !estClos_(l) && enDate_(l[COL.dateDevis])).length,
    annulations: corps.filter(l => recent(l[COL.dateAnnulation])).length,
    rdvAVenir: aVenir.map(l => ({client: texte_(l[COL.client]), date: enDate_(l[COL.dateRdv]), prestation: texte_(l[COL.prestation])})),
  };
}

// ================================================================ les textes des mails
const prenom_ = l => texte_(l[COL.client]).split(' ')[0] || (LANGUE === 'en' ? 'there' : 'Bonjour');
const TEXTES = {
  fr: {
    relanceDevis: (l, n) => ({
      sujet: `Votre devis : ${texte_(l[COL.prestation]) || 'séance photo'}`,
      corps: `Bonjour ${prenom_(l)},\n\n${n === 1 ? 'Je me permets de revenir vers vous' : 'Je reviens une dernière fois vers vous'} au sujet de mon devis${texte_(l[COL.prestation]) ? ` « ${texte_(l[COL.prestation])} »` : ''}${texte_(l[COL.montant]) ? ` (${texte_(l[COL.montant])} €)` : ''}.\nAvez-vous pu le regarder ? Je reste disponible pour en parler ou l'ajuster.\n\nBien cordialement,\n${SIGNATURE}`,
    }),
    lienRdv: l => ({
      sujet: `On fixe la date de votre séance, ${prenom_(l)} ?`,
      corps: `Bonjour ${prenom_(l)},\n\nMerci pour votre accord ! Choisissez le créneau qui vous arrange ici :\n\n${lienRdv_(l)}\n\nVous recevrez une confirmation avec tous les détails. Si rien ne vous convient, répondez simplement à ce mail.\n\nÀ bientôt,\n${SIGNATURE}`,
    }),
    rapport: (s, rdv) => ({
      sujet: 'Ton suivi client de la semaine',
      corps: `Ta semaine en chiffres (7 derniers jours) :\n- ${s.relancesDevis} devis relancé(s)\n- ${s.devisValides} devis validé(s)\n- ${s.annulations} annulation(s)\n- ${s.devisEnAttente} devis toujours en attente\n\nTes rendez-vous des 7 prochains jours :\n${rdv || '- aucun'}`,
    }),
    alerte: evt => ({
      sujet: 'Cal.com : rendez-vous sans devis correspondant',
      corps: `Type : ${evt.type}\nClient : ${evt.nom} <${evt.email}>\nRéf lue dans les notes : « ${evt.ref} »\nRien n'a été écrit dans le tableau.`,
    }),
    relanceAnnulation: (l, n) => ({
      sujet: n === 1 ? 'On retrouve une date pour votre séance ?' : 'Toujours là quand vous serez prêt',
      corps: `Bonjour ${prenom_(l)},\n\n${n === 1 ? "Votre séance a été annulée : pas de souci. Si vous voulez, on trouve une nouvelle date ensemble, voici le lien :" : "Un dernier petit mot, sans pression : si le projet revient, le lien est toujours là."}\n\n${lienRdv_(l)}\n\nBelle journée,\n${SIGNATURE}`,
    }),
  },
  en: {
    relanceDevis: (l, n) => ({
      sujet: `Your quote: ${texte_(l[COL.prestation]) || 'photo session'}`,
      corps: `Hi ${prenom_(l)},\n\n${n === 1 ? 'Just following up' : 'One last follow-up'} on my quote${texte_(l[COL.prestation]) ? ` for your ${texte_(l[COL.prestation])}` : ''}${texte_(l[COL.montant]) ? ` (${texte_(l[COL.montant])})` : ''}.\nHave you had a chance to look at it? Happy to talk it through or adjust it.\n\nBest,\n${SIGNATURE}`,
    }),
    lienRdv: l => ({
      sujet: `Let's book a time, ${prenom_(l)}`,
      corps: `Hi ${prenom_(l)},\n\nGreat news that you'd like to move forward. Pick a time that suits you here:\n\n${lienRdv_(l)}\n\nYou'll get a confirmation with all the details. If nothing fits, just reply to this email.\n\nTalk soon,\n${SIGNATURE}`,
    }),
    rapport: (s, rdv) => ({
      sujet: 'Your client follow-up this week',
      corps: `Your week in numbers (last 7 days):\n- ${s.relancesDevis} quote(s) followed up\n- ${s.devisValides} quote(s) approved\n- ${s.annulations} cancellation(s)\n- ${s.devisEnAttente} quote(s) still waiting\n\nYour appointments in the next 7 days:\n${rdv || '- none'}`,
    }),
    alerte: evt => ({
      sujet: 'Cal.com: booking with no matching quote',
      corps: `Type: ${evt.type}\nClient: ${evt.nom} <${evt.email}>\nRef found in the notes: "${evt.ref}"\nNothing was written in the sheet.`,
    }),
    relanceAnnulation: (l, n) => ({
      sujet: n === 1 ? "Let's find a new time for your shoot" : 'Still here whenever you are ready',
      corps: `Hi ${prenom_(l)},\n\n${n === 1 ? 'Your session was cancelled, no problem at all. If you like, we can find a new date, here is the link:' : 'One last note, no pressure: if the project comes back, the link is still here.'}\n\n${lienRdv_(l)}\n\nHave a great day,\n${SIGNATURE}`,
    }),
  },
};
const T_ = () => TEXTES[LANGUE] || TEXTES.fr;

// ================================================================ ce qui touche à Google
function feuille_() {
  const f = SpreadsheetApp.getActive().getSheetByName(NOM_FEUILLE);
  if (!f) throw new Error(`Feuille « ${NOM_FEUILLE} » introuvable : lance creerTableau une fois.`);
  return f;
}
const ecrire_ = (f, i, col, valeur) => { if (!SIMULATION) f.getRange(i + 1, col + 1).setValue(valeur); };
function brouillonOuEnvoi_(email, {sujet, corps}, envoyer) {
  if (SIMULATION) return console.log(`[simulation] ${envoyer ? 'ENVOI' : 'brouillon'} → ${email} : ${sujet}`);
  if (envoyer) GmailApp.sendEmail(email, sujet, corps); else GmailApp.createDraft(email, sujet, corps);
}

/** Une fois, au départ : crée la feuille « Suivi » avec les bons titres. */
function creerTableau() {
  const classeur = SpreadsheetApp.getActive();
  const f = classeur.getSheetByName(NOM_FEUILLE) || classeur.insertSheet(NOM_FEUILLE);
  f.getRange(1, 1, 1, TITRES.length).setValues([TITRES]).setFontWeight('bold');
  f.setFrozenRows(1);
}

/** Chaque matin : relances de devis et relances après annulation. */
function quotidien() {
  const f = feuille_(), lignes = f.getDataRange().getValues(), aujourdhui = new Date();
  let devis = 0, annul = 0;
  for (let i = 1; i < lignes.length; i++) {
    const l = lignes[i];
    const n = relanceDevisAFaire_(l, aujourdhui);
    if (n) { brouillonOuEnvoi_(texte_(l[COL.email]), T_().relanceDevis(l, n), ENVOI_RELANCES_DEVIS === 'envoyer'); ecrire_(f, i, n === 1 ? COL.relance1 : COL.relance2, aujourdhui); devis++; }
    const a = relanceAnnulationAFaire_(l, aujourdhui);
    if (a) { brouillonOuEnvoi_(texte_(l[COL.email]), T_().relanceAnnulation(l, a), ENVOI_RELANCES_ANNULATION === 'envoyer'); ecrire_(f, i, COL.relancesAnnulation, a); annul++; }
  }
  console.log(`${devis} relance(s) de devis (${SIMULATION ? 'simulées' : ENVOI_RELANCES_DEVIS}), ${annul} relance(s) après annulation (${SIMULATION ? 'simulées' : ENVOI_RELANCES_ANNULATION}).`);
}

/** Déclencheur « à la modification » : un devis passe à « validé » → lien de rendez-vous au client. */
function surModification(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== NOM_FEUILLE) return;
  if (e.range.getColumn() !== COL.statut + 1 || e.range.getRow() === 1) return;
  const f = e.range.getSheet(), i = e.range.getRow() - 1;
  const l = f.getRange(i + 1, 1, 1, TITRES.length).getValues()[0];
  if (!estValide_(l) || texte_(l[COL.lienEnvoye]) || !emailValide_(l[COL.email])) return;
  brouillonOuEnvoi_(texte_(l[COL.email]), T_().lienRdv(l), ENVOI_LIEN_RDV === 'envoyer');
  ecrire_(f, i, COL.lienEnvoye, new Date());
}

/**
 * L'adresse que Cal.com appelle à chaque réservation, report ou annulation (Déployer → Application web).
 * Dans Cal.com, l'adresse du webhook se termine par ?cle=<CLE_WEBHOOK> : sans la bonne clé, on ne fait rien.
 */
function doPost(e) {
  const rien = ContentService.createTextOutput('ok');
  if (!e || !e.parameter || e.parameter.cle !== CLE_WEBHOOK) return rien;
  let json;
  try { json = JSON.parse(e.postData.contents); } catch (err) { return rien; }
  const evt = lireEvenementCal_(json);
  if (!evt.type) return rien;
  const f = feuille_(), lignes = f.getDataRange().getValues();
  const {ligne, modifs} = appliquerEvenement_(lignes, evt, new Date());
  if (ligne < 0) {
    const {sujet, corps} = T_().alerte(evt);
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), sujet, corps);
    return rien;
  }
  Object.entries(modifs).forEach(([col, valeur]) => ecrire_(f, ligne, Number(col), valeur));
  if (SIMULATION) console.log(`[simulation] ${evt.type} → ligne ${ligne + 1} : ${JSON.stringify(modifs)}`);
  return rien;
}

/** Chaque lundi : le rapport de la semaine, envoyé à toi-même. */
function rapportHebdo() {
  const s = statsSemaine_(feuille_().getDataRange().getValues(), new Date());
  const tz = Session.getScriptTimeZone();
  const rdv = s.rdvAVenir.map(r => `- ${Utilities.formatDate(r.date, tz, 'EEE dd/MM HH:mm')} : ${r.client}${r.prestation ? ` (${r.prestation})` : ''}`).join('\n');
  const {sujet, corps} = T_().rapport(s, rdv);
  if (SIMULATION) return console.log(`[simulation] rapport :\n${corps}`);
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), sujet, corps);
}

/** Une fois, quand la simulation te plaît : installe les trois déclencheurs (sans doublon si tu la relances). */
function installerDeclencheurs() {
  const fonctions = ['quotidien', 'rapportHebdo', 'surModification'];
  ScriptApp.getProjectTriggers().filter(d => fonctions.includes(d.getHandlerFunction())).forEach(d => ScriptApp.deleteTrigger(d));
  ScriptApp.newTrigger('quotidien').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('rapportHebdo').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  ScriptApp.newTrigger('surModification').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  console.log('Déclencheurs installés : chaque matin vers 8 h, chaque lundi vers 8 h, et à chaque modification du tableau.');
}

// Pour les tests hors Google (Node) ; ignoré par Apps Script
if (typeof module !== 'undefined') module.exports = {relanceDevisAFaire: relanceDevisAFaire_, relanceAnnulationAFaire: relanceAnnulationAFaire_,
  lienRdv: lienRdv_, lireEvenementCal: lireEvenementCal_, appliquerEvenement: appliquerEvenement_, statsSemaine: statsSemaine_, TEXTES, COL, TITRES,
  ENVOI: {relancesDevis: ENVOI_RELANCES_DEVIS, lienRdv: ENVOI_LIEN_RDV, relancesAnnulation: ENVOI_RELANCES_ANNULATION}};
