<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a5b5384e-6b8f-457a-994c-be8036c130e4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Zoom attendance (campus portal)

Same Vercel project as **campusbyinnovit.com**. In the navbar, use the **Campus portal** dropdown → **Zoom attendance**.

Direct URL: `https://campusbyinnovit.com/attendance`

Add these in **Vercel → Environment Variables**:

| Variable | Required |
|----------|----------|
| `ZOOM_ACCOUNT_ID` | Yes |
| `ZOOM_CLIENT_ID` | Yes |
| `ZOOM_CLIENT_SECRET` | Yes |
| `ZOOM_USER_EMAIL` | Yes (class host Zoom email) |

Directors sign in with the same **admin username/password** as the quiz admin panel (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
