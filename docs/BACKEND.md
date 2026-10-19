# Optional backend: schedules and webhooks with the browser closed

Status: **design only, not built.** Needs the owner's go-ahead because it adds
a server-side key and possible running costs.

## Why
Today schedules run only while a STARNET tab is open, and the API key lives in
the browser. Running jobs at 8:00 with the laptop closed, or posting results to
LINE/Slack/Discord/email, needs code that runs on a server.

## Shape (Netlify, same site)
- `netlify/functions/run-task.ts`: takes `{ cls, prompt, input, model, tools }`,
  calls Claude with `ANTHROPIC_API_KEY` from a Netlify environment variable
  (never sent to the browser), returns the text and file ids.
- `netlify/functions/cron.ts` (Netlify Scheduled Function, `schedule: "*/15 * * * *"`):
  reads schedules from Netlify Blobs, runs the due ones through `run-task`,
  stores results in Blobs, then calls the destination webhook.
- Destinations (per schedule): Slack/Discord incoming webhook URL, LINE Messaging
  API push (channel token as env var), email through Resend or SendGrid (API key
  as env var).
- Auth: a single owner passphrase (`STARNET_ADMIN_TOKEN` env var); the browser
  sends it in a header to manage schedules. Without it the functions refuse.
- UI: Settings gets "Server mode"; when on, schedules are saved to the server and
  the Outbox pulls server results on load.

## Costs and limits to confirm with the owner
- Netlify free tier: 125k function calls and 100 build hours a month; scheduled
  functions have a 30 s limit (long Claude answers need background functions, a
  paid feature, or shorter outputs).
- Claude usage is billed to the server key, so the daily token guard moves to the
  server (checked in `run-task`).
- LINE/Slack/Discord webhooks are free; email providers have free tiers.

## Done looks like
A schedule created with the tab closed afterwards still runs at its time, its
result appears in the Outbox on next visit, and the chosen webhook receives it.
