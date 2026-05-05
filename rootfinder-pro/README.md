<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8751e172-b451-4f30-8f99-931de15e5302

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Math parser

Supported functions, precision limits, and domain restrictions are documented in [docs/math-functions.md](docs/math-functions.md).

## Server persistence

Set `DATABASE_URL` to a PostgreSQL connection string in production. The server creates `users` and `calculations` automatically; `/health` reports `storage: "postgres"` when cloud persistence is active.
