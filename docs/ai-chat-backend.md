# Connecting the AI chat

The floating **AI** button works without any setup: Quick links and "Read the Analysis Tool" run inside the site.
The **Ask the assistant** chat needs a small server, because an AI key must never be placed in website code.

## What the site sends and expects

`POST <AI_CHAT_URL>` with JSON:

```json
{ "messages": [{ "role": "user", "content": "What does Over/Under mean?" }], "context": "optional summary of the Analysis Tool" }
```

It expects JSON back: `{ "reply": "text to show" }`.

## Turning it on

1. Deploy a small endpoint (a Render Web Service, Cloudflare Worker, etc.) that keeps your AI provider key in its own
   environment variables, calls the AI provider with `messages` (plus `context` as background), and returns `{ "reply": ... }`.
2. Allow your site's address in its CORS settings.
3. Add rate limiting, so nobody can run up your AI bill.
4. In Render, on the Static Site, set the environment variable `AI_CHAT_URL` to the endpoint's full URL and redeploy
   (it is baked in at build time).

Tell the assistant in its system prompt to give general information only, never financial advice or profit promises.
