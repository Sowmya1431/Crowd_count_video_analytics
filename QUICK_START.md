# 🚀 Quick Start Guide - Email Alerts Feature

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies (30 seconds)
```bash
cd Backend
pip install -r requirements.txt
```

### Step 2: Set Email Credentials (1 minute)

**For Gmail** (simplest option):

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Generate an app password (Google will give you 16 characters)
3. Copy it, then run:

```powershell
# Windows PowerShell
$env:SENDER_EMAIL = "your.gmail@gmail.com"
$env:SENDER_PASSWORD = "16_char_password_from_google"
$env:SMTP_SERVER = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USE_TLS = "True"
```

**For other providers** (Outlook, Yahoo, Custom):
See `EMAIL_ALERT_SETUP.md`

### Step 3: Start Backend (30 seconds)
```bash
python run.py
```

Check logs for "YOLOv8 model loaded" ✅

### Step 4: Start Frontend (30 seconds)
```bash
cd frontend
npm run dev
```

### Step 5: Configure Alert Settings (1 minute)
1. Log in to dashboard
2. Click **Profile Icon** (top-right) → **Alert Settings**
3. Toggle ✓ Enable Alerts
4. Enter your email
5. Set Threshold (try 10% for testing)
6. Click **Send Test Email** → Check inbox
7. Click **Save Settings**

### Step 6: Test the Alert (1 minute)
1. Upload any video
2. Draw a simple rectangle polygon zone
3. Click **Analyze Zone**
4. If people detected > threshold → Email sent! ✅

## 📧 What You'll Receive

```
From: your.gmail@gmail.com
To: your.email@example.com
Subject: 🚨 Crowd Alert: High Density Detected in [Zone Name]

Body:
Feed: Main Entrance
Zone: Entry Gate
Current Crowd Density: 85.5%
Alert Threshold: 70.0%
Alert Time: 2024-03-29 14:30:45

→ Professional HTML email with styling
→ Plain text fallback
→ All detection details included
```

## 🔍 Verify It's Working

### In Browser Console
```javascript
// Fetch alert settings
fetch('http://127.0.0.1:5000/api/user/alert-settings', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
}).then(r => r.json()).then(console.log)
```

### In MongoDB
```javascript
// Check user has alert settings
db.users.findOne({ email: "your@email.com" })
// Should show: alert_email, crowd_threshold, alerts_enabled

// Check alerts log
db.alerts.find({ user_email: "your@email.com" })
// Shows history of all sent alerts
```

### In Backend Logs
Look for:
```
[Alert] Checking: density=85.5%, threshold=70.0%
[Alert] 🚨 THRESHOLD EXCEEDED! Sending alert to john@example.com
[Alert] ✅ Alert email sent to john@example.com
```

If email fails, you'll see:
```
[Alert] ❌ SMTP authentication failed. Check SENDER_EMAIL and SENDER_PASSWORD.
```

## ❓ Troubleshooting

### Test Email Not Sending?
```bash
# Verify environment variables are set
$env:SENDER_EMAIL
$env:SENDER_PASSWORD
```

If empty, set them again and restart Flask.

### For Gmail Errors
- Use **App Password**, NOT your Gmail password
- Get it from [myaccount.google.com/apppasswords](myaccount.google.com/apppasswords)
- 2-Factor Auth must be enabled

### Email Goes to Spam?
- Add sender email to contacts
- Mark as "Not spam"
- Check spam folder

## 📚 Full Documentation

- **Setup Details**: `EMAIL_ALERT_SETUP.md`
- **Architecture**: `ARCHITECTURE_DIAGRAM.md`
- **Implementation**: `ALERT_FEATURE_SUMMARY.md`

## 🎯 Key Features

✅ Set custom alert email  
✅ Configure density threshold (0-100%)  
✅ Enable/disable alerts anytime  
✅ Test email configuration  
✅ Professional HTML emails  
✅ Complete audit trail  
✅ No impact on video processing  

## 🔐 Security

- Environment variables (no hardcoded passwords)
- SMTP authentication required
- Works with any SMTP provider
- Encrypted SMTP connections (TLS)

---

**Need Help?** Check logs or see full setup guide: `EMAIL_ALERT_SETUP.md`

**Status**: ✅ Ready to Use!
