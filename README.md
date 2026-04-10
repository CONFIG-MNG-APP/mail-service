# ABAP19 Mail Service

Email notification service for the ABAP19 SAP Fiori Configuration Management System.

Sends automated Gmail notifications when configuration requests are submitted, approved, rejected, promoted, or rolled back.

---

## Architecture

```
SAP Fiori Apps (s40lp1.ucc.cit.tum.de)
         │
         │ fetch POST /api/notify
         ▼
Mail Service (Render.com)
         │
         │ SMTP
         ▼
   Gmail (recipients)
```

---

## Features

- **6 event types**: SUBMITTED, APPROVED, REJECTED, PROMOTED, ROLLED_BACK, ACTIVE
- **Role-based recipients**: Manager / Key User / IT Admin
- **Admin UI** at `/admin` — manage email recipients from a web interface
- **Test email** — send sample emails to verify config
- **API key protection** for notification endpoint
- **Persistent recipients** stored in `recipients.json` (edited via admin UI)

---

## Quick Start (Local)

```bash
npm install
cp .env.example .env
# edit .env with your Gmail + password + recipients
npm start
```

Then open [http://localhost:3000/admin](http://localhost:3000/admin) to manage recipients.

---

## Deploy to Render.com

### 1. Push code to GitHub

```bash
git init
git remote add origin git@github.com:CONFIG-MNG-APP/mail-service.git
git add .
git commit -m "Initial mail service"
git push -u origin main
```

### 2. Create Web Service on Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New → Web Service**
3. Connect GitHub repo `CONFIG-MNG-APP/mail-service`
4. Configure:
   - **Name**: `abap19-mail`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3. Add Environment Variables

In Render dashboard → Environment tab, add:

| Key | Value |
|---|---|
| `GMAIL_USER` | `your.email@gmail.com` |
| `GMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` |
| `API_KEY` | `abap19-mail-secret-key` (or any string) |
| `ADMIN_PASSWORD` | `strong-password-here` |
| `MAIL_MANAGER` | `manager@example.com` (optional fallback) |
| `MAIL_KEY_USER` | `user@example.com` (optional fallback) |
| `MAIL_IT_ADMIN` | `admin@example.com` (optional fallback) |

### 4. Get Gmail App Password

1. Enable 2-Step Verification at [myaccount.google.com/security](https://myaccount.google.com/security)
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Create app password → copy 16 chars → paste into `GMAIL_APP_PASSWORD`

### 5. Deploy

Render auto-deploys on push. After deploy, service URL looks like:
```
https://abap19-mail.onrender.com
```

Open `https://abap19-mail.onrender.com/admin` → login with `ADMIN_PASSWORD` → manage recipients.

---

## API Endpoints

### `GET /health`
Health check (no auth).

```bash
curl https://abap19-mail.onrender.com/health
```

### `POST /api/notify`
Send notification email. Called from Fiori apps.

**Headers:**
- `Content-Type: application/json`
- `x-api-key: <API_KEY>`

**Body:**
```json
{
  "event": "SUBMITTED",
  "reqId": "abc-123",
  "reqTitle": "Update FI Limit",
  "module": "FI",
  "envId": "DEV",
  "triggeredBy": "user1",
  "reason": "Optional, for REJECTED"
}
```

**Valid events:** `SUBMITTED`, `APPROVED`, `REJECTED`, `PROMOTED`, `ROLLED_BACK`, `ACTIVE`

### `GET /admin`
Admin web UI (browser only).

### `POST /api/admin/login`
```json
{ "password": "admin-password" }
```
Returns `{ token }` for subsequent admin calls.

### `GET /api/admin/config`
Returns current recipients (requires `x-admin-token`).

### `POST /api/admin/config`
Update recipients (requires `x-admin-token`).
```json
{
  "MANAGER": ["mgr1@example.com", "mgr2@example.com"],
  "KEY_USER": ["user1@example.com"],
  "IT_ADMIN": ["admin@example.com"]
}
```

### `POST /api/admin/test`
Send a test email for a given event.
```json
{ "event": "SUBMITTED" }
```

---

## Event → Recipients Mapping

| Event | Recipients |
|---|---|
| `SUBMITTED` | Manager |
| `APPROVED` | Key User |
| `REJECTED` | Key User |
| `PROMOTED` | Key User + Manager |
| `ROLLED_BACK` | Key User + Manager |
| `ACTIVE` | IT Admin |

---

## Troubleshooting

**Email not sending:**
- Check `/health` — verify `gmailConfigured: true`
- Check Render logs for errors
- Verify Gmail App Password (not regular password)
- Make sure 2-Step Verification is enabled on Gmail account

**Render free tier sleeps after 15 min inactivity:**
- First request after sleep takes 30-50 seconds
- Emails still send, just slower on cold start
- Fix later with a cron keep-alive job

**Admin login fails:**
- Check `ADMIN_PASSWORD` env var is set on Render
- Tokens expire after 2 hours

---

## License

MIT
