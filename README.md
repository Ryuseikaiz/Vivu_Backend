# Vivu Backend API

Backend server for Vivu Travel Agent application.

## Tech Stack
- Node.js + Express
- MongoDB (Mongoose)
- JWT Authentication
- Google Gemini AI
- PayOS Payment Integration

## Deployment on Vercel

### Prerequisites
1. Create a Vercel account
2. Install Vercel CLI: `npm i -g vercel`

### Deploy Steps
1. Connect this repository to Vercel
2. Set Root Directory to: `.` (root)
3. Set Framework Preset: `Other`
4. Add all environment variables (see below)

### Required Environment Variables

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
GEMINI_API_KEY=your_gemini_api_key
CLIENT_URL=https://your-frontend-domain.vercel.app
GOOGLE_CLIENT_ID=your_google_client_id
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
PAYOS_CLIENT_ID=your_payos_client_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key
```

## Local Development

```bash
npm install
npm run dev
```

Server runs on http://localhost:5000
