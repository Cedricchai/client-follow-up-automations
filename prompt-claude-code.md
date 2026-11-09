# The prompt to give Claude Code (from the video)

> English version of the prompt used to build this system on 7 November 2026 (French version: `consigne-claude-code.md`). Paste it into Claude Code, in an empty folder. Replace what's between brackets.
> This is the original prompt, translated word for word. Since 9 November, the repo sends the booking link and the cancellation follow-ups automatically by default (quote follow-ups stay drafts); each email can be switched at the top of `Code.gs`. Works with Codex (ChatGPT) too: tested on 9 November, not installed at Google.
> Not using Google (Outlook, Excel…)? Say which tools you use in the first paragraph: Claude Code will adapt it, but that version isn't tested and some tools may cost money.

---

I'm a [photographer / tradesperson / freelancer]. I send quotes, I forget to follow up, and I lose track of appointments.

Build me a client follow-up system **without n8n or a server**: a Google Apps Script to paste into a Google Sheet, that runs at Google even when my computer is off. Explain each step simply: I want to understand what the script does before I run it.

What it must do:
1. Every morning: quotes with no answer after 3 days, then 7 days → a follow-up **draft** in Gmail (never sent automatically), at most one follow-up per quote per day, never for an approved or declined quote.
2. When I set a quote to "approved": an email to the client with my Cal.com link [my link], pre-filled (name, email, and the quote ref in the notes).
3. When a client books, reschedules or cancels on Cal.com: update the right row using the quote ref (a "web app" address that Cal.com calls, protected by a secret key). A reschedule only changes the date.
4. After a cancellation: a follow-up draft at 7 days, then at 15 days, with the link to pick a new date.
5. Every Monday: a report by email (quotes followed up, approved, cancellations, appointments for the week).
6. A simulation mode turned on at the start, the settings at the top of the script, one function that creates the sheet, one that installs the triggers without duplicates.
7. Tests for every rule that I can run without Google, on fake quotes.

My emails to clients are in [English / French], signed [my name].
