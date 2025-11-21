# Project 9: L'Oréal Routine Builder
L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder. 

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Secrets & deployment

- **Do not commit real API keys.** This repo uses `secrets.js` for local development; ensure `secrets.js` is added to `.gitignore`.
- To add your OpenAI API key to Cloudflare Workers (recommended), run:

```
wrangler secret put OPENAI_API_KEY
```

- For local development, create a `secrets.js` file in the project root with the contents:

```
/* Local dev only — DO NOT COMMIT real keys. */
window.OPENAI_API_KEY = 'sk-REPLACE_WITH_YOUR_KEY';
```

Replace the placeholder with your real key only on your local machine.