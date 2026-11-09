# Client follow-up automations, without n8n or a server

*[Version française : README.fr.md](README.fr.md)*

Five automations for a freelancer who sends quotes (built for a photographer, works for any small business): quote follow-ups, a pre-filled booking link when a quote is approved, a sheet that updates itself when a client books, reschedules or cancels, follow-ups after a cancellation, and a Monday report. It all runs for free inside your Google account, with your computer off.

Built with Claude Code on 7 November 2026. It is the n8n-free rewrite of automations I built in August for a photographer. Every name and email in this repo is fake.

> **Language note:** the code comments and the log messages are in French. The emails to your clients, the sheet headers and the Monday report are in English when you set `LANGUE = 'en'` (step 6). Statuses can be typed in English or French (`approved` or `validé`).

## What it does

| When | What happens |
|---|---|
| Every morning around 8 am | Quotes with no answer after 3 days, then 7 days, get a follow-up **draft** in Gmail |
| You set a quote to `approved` | The client gets an email with your booking link, already filled in (name, email, quote ref) |
| The client books, reschedules or cancels on Cal.com | The sheet updates itself: appointment date and status |
| 7 days, then 15 days after a cancellation | A follow-up draft with the link to pick a new date |
| Every Monday around 8 am | A report in your inbox: quotes followed up, approved, cancellations, appointments for the week |
| Appointment booked | Cal.com adds it to your calendar **itself** |

**Cost:** nothing extra to run it. Google Sheets, Apps Script and Gmail are free, and Cal.com has a free plan. You only need Claude Code (a Claude subscription) to build or adapt the script.
**Computer:** it can be off, everything runs at Google.
**Sending:** follow-ups are always drafts. The booking-link email is a draft by default (set `ENVOI_LIEN_RDV = 'envoyer'` to send it automatically).

## Install (9 steps)

1. **The sheet:** create a new Google Sheet, then **Extensions → Apps Script**.
2. **The code:** paste `Code.gs`, save, then run **`creerTableau`** (it creates the sheet).
3. **Google's permission screen:** Google says it **hasn't verified this app**. That's normal for a script you made yourself: **Advanced → Go to the project**, then allow.
4. **The "Suivi" sheet** appears with its 14 columns. You fill in the first 7, the script fills in the rest. Add a fake quote, or import `tests/quotes-example.csv` (File → Import).
5. **The simulation:** run `quotidien` and `rapportHebdo`. With `SIMULATION = true`, the **execution log** says what it would do, without touching anything.
6. **The settings**, at the top of the script:
   - `SIGNATURE`: your name;
   - `LANGUE`: `'en'` for English (emails, sheet headers, report), `'fr'` for French;
   - `LIEN_RDV`: your Cal.com booking page;
   - `CLE_WEBHOOK`: a long sentence only you know.

   If you change `LANGUE` after step 2, run `creerTableau` again to rewrite the headers.
7. **The web app:** **Deploy → New deployment → Web app**, "Execute as: me", "Who has access: anyone". Copy the address. Without your secret key, this address changes nothing (tested).
8. **Cal.com:**
   - **Webhook:** **Settings → Developer → Webhooks**, paste the address and add `?cle=` followed by your secret sentence. Tick *Booking created*, *Booking rescheduled* and *Booking cancelled*. Cal.com's free plan has webhooks.
   - **Calendar:** in Apps, connect your calendar so bookings show up in it.
   - **Notes field:** keep it on your event type. That's where the quote ref travels.
9. **Live mode:** set `SIMULATION = false`, then run **`installerDeclencheurs` once**. From there, it runs by itself.

## The columns of the "Suivi" sheet

Client · Email · Service · Amount · Quote ref · Quote date · Status (`sent` / `approved` / `declined`) · Follow-up 1 · Follow-up 2 · Booking link sent · Appointment date · Appointment status (`booked` / `cancelled`) · Cancellation date · Cancellation follow-ups.
You fill in the first 7. The script fills in the rest.
**Dates:** type them as normal dates in the sheet (Google Sheets understands your own date format), or as `2026-11-06`. Dates stored as plain text are read as day/month/year.

## Tested for real (7 and 8 November 2026, demo account)

Tested in my lab, on a Google account created only for these tests and a free Cal.com account, in French.

| Test | Result |
|---|---|
| Simulation with 6 fake clients | Announces exactly the 2 expected quote follow-ups and the cancellation follow-up, nothing for the others |
| Live mode | 3 correct drafts in Gmail (first name, service, amount, link); dates written in the sheet |
| Run twice in a row | 0 follow-ups the second time: no duplicates on the same day |
| Typing "validé" in the sheet | Booking-link draft with the pre-filled link, "Booking link sent" column filled |
| A **real** booking, a **real** reschedule and a **real** cancellation on Cal.com | The sheet follows: booked + date, then the new date (status kept), then cancelled + cancellation date; times converted to the sheet's time zone |
| Wrong key | Nothing changes |
| Unknown ref | Alert email "booking with no matching quote" |
| 8 am trigger | On 8 November, it prepared a follow-up draft by itself at 8:18 am |
| Monday report | Received by itself on Monday 9 November at 8:35 am, with the right numbers |
| Calendar | Checked with Google Calendar. iCloud and iPhone not checked |

**Logic tests:** `node tests/tester-suivi.mjs` replays every rule on fake data. 43 checks at the time of filming (7 November); **60** since English support was added on 9 November (English statuses, sheet and report). To make sure the tests are useful, the code was broken on purpose: the tests caught it.

**Good to know:** a reschedule does not send a cancellation (tested twice: by the business owner and by the client). A very old cancellation, found late, can get both follow-ups two days in a row (rare).

## Who it's for, and its limits

- **Made for the Google world:** Google Sheets, Apps Script, Gmail, and Google Calendar (through Cal.com). It's the only setup I tested.
- **On Outlook, Excel or other tools**, this code won't work as is. You can give the prompt (`prompt-claude-code.md`) to Claude Code and tell it which tools you use so it adapts it, but that's not tested, and some tools (for example in the Microsoft world) can cost money.
- **The emails are fixed templates** you change in `Code.gs`: no AI writes them every day. Test on 9 November 2026: the Gemini API free tier was refused for the projects I tried.
- If you want to connect lots of different tools with blocks, or have an AI write every email, a tool like n8n (paid in the cloud) is still simpler.

## Files

- `Code.gs`: the rules first (testable without Google), then the part that talks to Google.
- `tests/tester-suivi.mjs`: every rule replayed on fake data. `tests/quotes-example.csv` / `tests/devis-exemple.csv`: fake quotes in English / French.
- `prompt-claude-code.md`: the prompt to give Claude Code to rebuild or adapt the system (French version: `consigne-claude-code.md`).

## License

MIT: you can use, change and share this code freely, even for your business, as long as you keep the `LICENSE` file.
