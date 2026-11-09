// Tests de toutes les règles du suivi client, sans Google : node tests/tester-suivi.mjs
// Lit Code.gs tel quel. Données fictives (aucun vrai client).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const module = {exports: {}};
vm.runInNewContext(fs.readFileSync(path.join(ici, '..', 'Code.gs'), 'utf8'), {module, console});
const S = module.exports, C = S.COL;
const echecs = [];
let total = 0;
const verifier = (nom, obtenu, attendu) => { total++; if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) echecs.push(`ÉCHEC ${nom} : attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`); };
const ligne = champs => { const l = Array(S.TITRES.length).fill(''); Object.entries(champs).forEach(([k, v]) => { l[C[k]] = v; }); return l; };
const auj = new Date(2026, 10, 9); // lundi 09/11/2026

// 1. Relances de devis
const base = {client: 'Sophie Martin', email: 'sophie@example.com', prestation: 'séance famille', montant: '350', ref: 'D-001', statut: 'envoyé'};
[
  ['3 jours pile', {dateDevis: '06/11/2026'}, 1],
  ['2 jours', {dateDevis: '07/11/2026'}, 0],
  ['7 jours, relance 1 faite', {dateDevis: '02/11/2026', relance1: '05/11/2026'}, 2],
  ['10 jours jamais relancé : la 1 d\'abord', {dateDevis: '30/10/2026'}, 1],
  ['validé', {dateDevis: '30/10/2026', statut: 'Validé'}, 0],
  ['refusé', {dateDevis: '30/10/2026', statut: 'refusé'}, 0],
  ['deux relances déjà faites', {dateDevis: '20/10/2026', relance1: '23/10/2026', relance2: '27/10/2026'}, 0],
  ['relance 1 faite aujourd\'hui', {dateDevis: '20/10/2026', relance1: '09/11/2026'}, 0],
  ['sans e-mail', {dateDevis: '01/11/2026', email: ''}, 0],
  ['e-mail mal écrit', {dateDevis: '01/11/2026', email: 'sophie@example'}, 0],
  ['sans date', {dateDevis: ''}, 0],
  ['date dans le futur', {dateDevis: '12/11/2026'}, 0],
  ['vraie date du tableau', {dateDevis: new Date(2026, 10, 6)}, 1],
].forEach(([nom, x, att]) => verifier(`devis : ${nom}`, S.relanceDevisAFaire(ligne({...base, ...x}), auj), att));

// 2. Relances après annulation (7 puis 15 jours)
const annule = {...base, statut: 'validé', statutRdv: 'annulé'};
[
  ['7 jours après annulation', {dateAnnulation: '02/11/2026', relancesAnnulation: 0}, 1],
  ['6 jours', {dateAnnulation: '03/11/2026', relancesAnnulation: 0}, 0],
  ['15 jours, 1 relance faite', {dateAnnulation: '25/10/2026', relancesAnnulation: 1}, 2],
  ['10 jours, 1 relance faite', {dateAnnulation: '30/10/2026', relancesAnnulation: 1}, 0],
  ['plafond atteint', {dateAnnulation: '01/10/2026', relancesAnnulation: 2}, 0],
  ['RDV pris, pas annulé', {dateAnnulation: '01/10/2026', statutRdv: 'pris'}, 0],
  ['annulé sans date', {dateAnnulation: ''}, 0],
].forEach(([nom, x, att]) => verifier(`annulation : ${nom}`, S.relanceAnnulationAFaire(ligne({...annule, ...x}), auj), att));

// 3. Lien de rendez-vous pré-rempli : nom, e-mail, réf en tête des notes
const lien = S.lienRdv(ligne({...base, client: 'Élodie Dupont'}));
verifier('lien : nom encodé', lien.includes('name=%C3%89lodie%20Dupont'), true);
verifier('lien : réf en tête des notes', lien.includes('notes=D-001%20-%20s%C3%A9ance%20famille'), true);

// 4. Événements Cal.com (même forme que les vrais webhooks reçus en août)
const cal = (triggerEvent, notes, startTime = '2026-11-14T09:00:00.000Z') => ({triggerEvent, payload: {additionalNotes: notes, startTime, attendees: [{name: 'Sophie Martin', email: 'sophie@example.com'}]}});
const evt = S.lireEvenementCal(cal('BOOKING_CREATED', 'D-001 - séance famille'));
verifier('cal : type', evt.type, 'pris');
verifier('cal : réf lue avant « - »', evt.ref, 'D-001');
verifier('cal : début', evt.debut.toISOString(), '2026-11-14T09:00:00.000Z');
verifier('cal : événement inconnu ignoré', S.lireEvenementCal({triggerEvent: 'MEETING_ENDED', payload: {}}).type, null);

const lignes = [S.TITRES, ligne({...base, ref: 'D-001'}), ligne({...base, ref: 'D-002', client: 'Karim B.'})];
const maintenant = new Date(2026, 10, 9, 10, 0);
const pris = S.appliquerEvenement(lignes, S.lireEvenementCal(cal('BOOKING_CREATED', 'D-002 - mariage')), maintenant);
verifier('cal : pris → bonne ligne', pris.ligne, 2);
verifier('cal : pris → statut', pris.modifs[C.statutRdv], 'pris');
const reporte = S.appliquerEvenement(lignes, S.lireEvenementCal(cal('BOOKING_RESCHEDULED', 'D-001', '2026-11-20T14:00:00.000Z')), maintenant);
verifier('cal : report → date seulement', Object.keys(reporte.modifs).map(Number), [C.dateRdv]);
const annul = S.appliquerEvenement(lignes, S.lireEvenementCal(cal('BOOKING_CANCELLED', 'D-001')), maintenant);
verifier('cal : annulation → statut, date, compteur à 0', [annul.modifs[C.statutRdv], annul.modifs[C.relancesAnnulation]], ['annulé', 0]);
verifier('cal : réf inconnue → aucune ligne', S.appliquerEvenement(lignes, S.lireEvenementCal(cal('BOOKING_CREATED', 'D-999')), maintenant).ligne, -1);
const avecEspace = [S.TITRES, ligne({...base, ref: 'DEV 014'})];
verifier('cal : réf avec espace', S.appliquerEvenement(avecEspace, S.lireEvenementCal(cal('BOOKING_CREATED', 'DEV 014 - mariage')), maintenant).ligne, 1);
verifier('cal : sans réf → aucune ligne', S.appliquerEvenement(lignes, S.lireEvenementCal(cal('BOOKING_CREATED', '')), maintenant).ligne, -1);

// 5. Rapport de la semaine
const semaine = [S.TITRES,
  ligne({...base, ref: 'A', dateDevis: '01/11/2026', relance1: '04/11/2026'}),                       // relancé cette semaine, en attente
  ligne({...base, ref: 'B', statut: 'validé', lienEnvoye: '06/11/2026', dateRdv: '12/11/2026 10:00', statutRdv: 'pris'}), // validé + RDV à venir
  ligne({...base, ref: 'C', statut: 'validé', lienEnvoye: '20/10/2026', dateRdv: '30/11/2026 10:00', statutRdv: 'pris'}), // RDV trop loin
  ligne({...base, ref: 'D', statut: 'validé', statutRdv: 'annulé', dateAnnulation: '08/11/2026', dateRdv: '10/11/2026 9:00'}), // annulé
  ligne({...base, ref: 'E', dateDevis: '20/10/2026', relance1: '23/10/2026'}),                       // relancé il y a longtemps
  ligne({...base, ref: 'F', dateDevis: '25/10/2026', relance1: '28/10/2026', relance2: '02/11/2026'}), // dernière relance il y a 7 jours pile : hors semaine
];
const st = S.statsSemaine(semaine, auj);
verifier('rapport : chiffres', [st.relancesDevis, st.devisValides, st.annulations, st.devisEnAttente], [1, 1, 1, 3]);
verifier('rapport : RDV à venir (pas l\'annulé, pas le lointain)', st.rdvAVenir.map(r => r.client + ' ' + r.date.getDate()), ['Sophie Martin 12']);

// 6. Les mails, en français et en anglais : complets et avec le lien quand il le faut
for (const langue of ['fr', 'en']) {
  const t = S.TEXTES[langue], l = ligne({...base, ref: 'D-001'});
  verifier(`textes ${langue} : relance 1 ≠ relance 2`, t.relanceDevis(l, 1).corps !== t.relanceDevis(l, 2).corps, true);
  verifier(`textes ${langue} : lien dans le mail de validation`, t.lienRdv(l).corps.includes('notes=D-001'), true);
  verifier(`textes ${langue} : lien dans la relance d'annulation`, t.relanceAnnulation(l, 1).corps.includes('cal.com'), true);
  verifier(`textes ${langue} : prénom du client`, t.lienRdv(l).corps.includes('Sophie'), true);
}

// 7. Le rapport et l'alerte, dans les deux langues
const rdvTexte = '- lun. 12/11 10:00 : Sophie Martin';
verifier('rapport fr : chiffres', S.TEXTES.fr.rapport(st, rdvTexte).corps.includes('1 devis relancé(s)'), true);
verifier('rapport fr : sans RDV', S.TEXTES.fr.rapport(st, '').corps.endsWith('- aucun'), true);
verifier('rapport en : chiffres', S.TEXTES.en.rapport(st, rdvTexte).corps.includes('1 quote(s) followed up'), true);
verifier('rapport en : sans RDV', S.TEXTES.en.rapport(st, '').corps.endsWith('- none'), true);
for (const langue of ['fr', 'en']) verifier(`alerte ${langue} : la réf lue`, S.TEXTES[langue].alerte({type: 'pris', nom: 'X', email: 'x@example.com', ref: 'D-999'}).corps.includes('D-999'), true);

// 8. Le même code réglé en anglais (LANGUE = 'en') : tableau, statuts écrits, et statuts tapés en anglais
const moduleEn = {exports: {}};
const codeEn = fs.readFileSync(path.join(ici, '..', 'Code.gs'), 'utf8').replace("const LANGUE = 'fr';", "const LANGUE = 'en';");
vm.runInNewContext(codeEn, {module: moduleEn, console});
const E = moduleEn.exports;
verifier('anglais : titres du tableau', [E.TITRES.length, E.TITRES[1], E.TITRES[6]], [14, 'Email', 'Status']);
const baseEn = {...base, statut: 'sent'};
[
  ['approved', 0], ['Approved', 0], ['accepted', 0], ['declined', 0], ['lost', 0], ['signed', 0], ['sent', 1],
].forEach(([statut, att]) => verifier(`anglais : statut « ${statut} »`, E.relanceDevisAFaire(ligne({...baseEn, statut, dateDevis: '06/11/2026'}), auj), att));
const lignesEn = [E.TITRES, ligne({...base, ref: 'D-001'})];
const prisEn = E.appliquerEvenement(lignesEn, {type: 'pris', ref: 'D-001', debut: new Date(2026, 10, 12, 10)}, auj);
const annulEn = E.appliquerEvenement(lignesEn, {type: 'annule', ref: 'D-001'}, auj);
verifier('anglais : statut RDV écrit', [prisEn.modifs[C.statutRdv], annulEn.modifs[C.statutRdv]], ['booked', 'cancelled']);
verifier('anglais : relance après « cancelled »', E.relanceAnnulationAFaire(ligne({...base, statut: 'approved', statutRdv: 'cancelled', dateAnnulation: '02/11/2026', relancesAnnulation: 0}), auj), 1);
const semaineEn = [E.TITRES,
  ligne({...base, ref: 'B', statut: 'approved', dateRdv: '12/11/2026 10:00', statutRdv: 'booked'}),
  ligne({...base, ref: 'D', statut: 'approved', dateRdv: '10/11/2026 9:00', statutRdv: 'cancelled', dateAnnulation: '08/11/2026'})];
verifier('anglais : RDV à venir sans l\'annulé', E.statsSemaine(semaineEn, auj).rdvAVenir.map(r => r.date.getDate()), [12]);

console.log(echecs.join('\n'));
console.log(`${total - echecs.length}/${total} vérifications OK`);
process.exit(echecs.length ? 1 : 0);
