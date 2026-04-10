/**
 * ABAP19 Mail Service
 * Email notification service for SAP Fiori Configuration Management
 *
 * Endpoints:
 *   GET  /health              - Health check
 *   POST /api/notify          - Send notification email (called from Fiori apps)
 *   GET  /admin               - Admin UI (password protected)
 *   POST /api/admin/login     - Admin login
 *   GET  /api/admin/config    - Get current recipients (admin only)
 *   POST /api/admin/config    - Update recipients (admin only)
 *   POST /api/admin/test      - Send test email (admin only)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const templates = require('./templates');

const app = express();
const PORT = process.env.PORT || 3000;

// === Middleware ===
app.use(cors({
  origin: '*',  // CSP on SAP side already verified open; restrict later if needed
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'x-admin-token']
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// === In-memory recipients store (persisted to recipients.json) ===
const RECIPIENTS_FILE = path.join(__dirname, 'recipients.json');

function loadRecipients() {
  // Try loading from file first
  if (fs.existsSync(RECIPIENTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(RECIPIENTS_FILE, 'utf8'));
    } catch (e) {
      console.error('Failed to load recipients.json, using env defaults');
    }
  }
  // Fallback to env variables
  return {
    MANAGER:  (process.env.MAIL_MANAGER  || '').split(',').map(s => s.trim()).filter(Boolean),
    KEY_USER: (process.env.MAIL_KEY_USER || '').split(',').map(s => s.trim()).filter(Boolean),
    IT_ADMIN: (process.env.MAIL_IT_ADMIN || '').split(',').map(s => s.trim()).filter(Boolean)
  };
}

function saveRecipients(data) {
  fs.writeFileSync(RECIPIENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let recipients = loadRecipients();

// === Event → Role mapping ===
const EVENT_ROLES = {
  SUBMITTED:   ['MANAGER'],
  APPROVED:    ['KEY_USER'],
  REJECTED:    ['KEY_USER'],
  PROMOTED:    ['KEY_USER', 'MANAGER'],
  ROLLED_BACK: ['KEY_USER', 'MANAGER'],
  ACTIVE:      ['IT_ADMIN']
};

// === Nodemailer transporter ===
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return transporter;
}

// === Admin session tokens (in-memory) ===
const adminTokens = new Set();
function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}
function isValidAdminToken(token) {
  return token && adminTokens.has(token);
}

// === Middleware: API key check ===
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!process.env.API_KEY || key === process.env.API_KEY) {
    return next();
  }
  return res.status(401).json({ error: 'Invalid API key' });
}

// === Middleware: Admin auth ===
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (isValidAdminToken(token)) {
    return next();
  }
  return res.status(401).json({ error: 'Admin authentication required' });
}

// ============================================================
// ROUTES
// ============================================================

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'abap19-mail-service',
    time: new Date().toISOString(),
    gmailConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  });
});

// --- Root: redirect to admin ---
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// --- Admin UI ---
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- Send notification (called from Fiori apps) ---
app.post('/api/notify', requireApiKey, async (req, res) => {
  try {
    const payload = req.body || {};
    const event = payload.event;

    if (!event || !templates[event]) {
      return res.status(400).json({
        error: 'Invalid or missing event type',
        validEvents: Object.keys(templates)
      });
    }

    // Determine recipients
    const roles = EVENT_ROLES[event] || [];
    const toList = [];
    roles.forEach(role => {
      (recipients[role] || []).forEach(email => {
        if (email && !toList.includes(email)) toList.push(email);
      });
    });

    if (toList.length === 0) {
      console.warn('[notify] No recipients for event: ' + event);
      return res.json({ success: false, warning: 'No recipients configured for ' + event });
    }

    // Build email
    const tmpl = templates[event](payload);
    const mailOptions = {
      from: '"ABAP19 System" <' + process.env.GMAIL_USER + '>',
      to: toList.join(','),
      subject: tmpl.subject,
      html: tmpl.html
    };

    // Send (await but catch errors)
    const info = await getTransporter().sendMail(mailOptions);
    console.log('[notify] Sent ' + event + ' to ' + toList.join(',') + ' (id=' + info.messageId + ')');

    res.json({ success: true, event: event, recipients: toList, messageId: info.messageId });
  } catch (err) {
    console.error('[notify] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Admin login ---
app.post('/api/admin/login', (req, res) => {
  const password = (req.body && req.body.password) || '';
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin password not configured on server' });
  }
  if (password === process.env.ADMIN_PASSWORD) {
    const token = generateToken();
    adminTokens.add(token);
    // Auto-expire token after 2 hours
    setTimeout(() => adminTokens.delete(token), 2 * 60 * 60 * 1000);
    return res.json({ success: true, token: token });
  }
  res.status(401).json({ error: 'Invalid password' });
});

// --- Admin logout ---
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  adminTokens.delete(req.headers['x-admin-token']);
  res.json({ success: true });
});

// --- Get recipients (admin) ---
app.get('/api/admin/config', requireAdmin, (req, res) => {
  res.json({
    recipients: recipients,
    gmailUser: process.env.GMAIL_USER || '(not configured)',
    events: EVENT_ROLES
  });
});

// --- Update recipients (admin) ---
app.post('/api/admin/config', requireAdmin, (req, res) => {
  try {
    const body = req.body || {};
    const newRecipients = {
      MANAGER:  Array.isArray(body.MANAGER)  ? body.MANAGER.filter(Boolean)  : [],
      KEY_USER: Array.isArray(body.KEY_USER) ? body.KEY_USER.filter(Boolean) : [],
      IT_ADMIN: Array.isArray(body.IT_ADMIN) ? body.IT_ADMIN.filter(Boolean) : []
    };

    // Basic email validation
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = [];
    Object.keys(newRecipients).forEach(role => {
      newRecipients[role].forEach(email => {
        if (!emailRe.test(email)) invalid.push(email);
      });
    });
    if (invalid.length > 0) {
      return res.status(400).json({ error: 'Invalid emails: ' + invalid.join(', ') });
    }

    recipients = newRecipients;
    saveRecipients(recipients);
    res.json({ success: true, recipients: recipients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Send test email (admin) ---
app.post('/api/admin/test', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const event = body.event || 'SUBMITTED';

    if (!templates[event]) {
      return res.status(400).json({ error: 'Invalid event' });
    }

    const testPayload = {
      event: event,
      reqId: 'TEST-' + Date.now(),
      reqTitle: 'Test Email - ' + event,
      module: 'FI',
      envId: 'DEV',
      triggeredBy: 'admin.test',
      reason: event === 'REJECTED' ? 'Đây là email test từ trang admin' : undefined
    };

    // Send to admin's chosen recipients for this event
    const roles = EVENT_ROLES[event] || [];
    const toList = [];
    roles.forEach(role => {
      (recipients[role] || []).forEach(email => {
        if (email && !toList.includes(email)) toList.push(email);
      });
    });

    if (toList.length === 0) {
      return res.status(400).json({ error: 'No recipients configured for ' + event });
    }

    const tmpl = templates[event](testPayload);
    const info = await getTransporter().sendMail({
      from: '"ABAP19 System (Test)" <' + process.env.GMAIL_USER + '>',
      to: toList.join(','),
      subject: '[TEST] ' + tmpl.subject,
      html: tmpl.html
    });

    res.json({ success: true, recipients: toList, messageId: info.messageId });
  } catch (err) {
    console.error('[test] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Start server ===
app.listen(PORT, () => {
  console.log('============================================');
  console.log('ABAP19 Mail Service running on port ' + PORT);
  console.log('============================================');
  console.log('Health:  http://localhost:' + PORT + '/health');
  console.log('Admin:   http://localhost:' + PORT + '/admin');
  console.log('Gmail:   ' + (process.env.GMAIL_USER || 'NOT CONFIGURED'));
  console.log('API key: ' + (process.env.API_KEY ? 'SET' : 'OPEN (no key required)'));
  console.log('============================================');
});
