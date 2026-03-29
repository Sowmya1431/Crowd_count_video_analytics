# Email Alert Setup Guide

## Overview
This guide explains how to set up email alerts for the Crowd Count Video Analytics Dashboard. When crowd density in a monitored zone exceeds the user's configured threshold, an automated email alert will be sent.

## Architecture

```
User Dashboard (Frontend)
    ↓
User sets email + threshold in Alert Settings
    ↓
Backend API (`/api/user/alert-settings`) stores settings
    ↓
Video Processing → Zone Analysis → Crowd Detection
    ↓
IF crowd_density > threshold:
    → Read user's alert email from MongoDB
    → Send email via SMTP service
    → Log alert to database for audit
```

## Setup Steps

### Step 1: Configure SMTP Settings (Gmail Example)

The email service supports any SMTP server. Gmail is recommended for simplicity.

#### Using Gmail:

1. **Enable 2-Factor Authentication** (if not already enabled):
   - Go to myaccount.google.com
   - Click "Security" in the left menu
   - Enable "2-Step Verification"

2. **Create an App Password**:
   - Go to myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your device)
   - Google will generate a 16-character password
   - **Copy this password** (you'll need it in the next step)

3. **Set Environment Variables**:

   **On Windows PowerShell:**
   ```powershell
   # Navigate to Backend directory
   cd .\Backend\

   # Create/edit .env file
   $env:SENDER_EMAIL = "your.gmail@gmail.com"
   $env:SENDER_PASSWORD = "your_16_char_app_password"
   $env:SMTP_SERVER = "smtp.gmail.com"
   $env:SMTP_PORT = "587"
   $env:SMTP_USE_TLS = "True"

   # Then run the app
   python run.py
   ```

   **Alternative: Create a .env file in Backend directory:**
   ```
   SENDER_EMAIL=your.gmail@gmail.com
   SENDER_PASSWORD=your_16_char_app_password
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USE_TLS=True
   ```

   Then in `Backend/app/config.py`, update the loading:
   ```python
   import os
   from dotenv import load_dotenv
   
   load_dotenv()
   
   class Config:
       SECRET_KEY = "your_secret_key"
       JWT_SECRET_KEY = "your_jwt_secret_key"
       MONGO_URI = "mongodb://localhost:27017/crowdcount_db"
   ```

#### Using Other SMTP Providers:

For Outlook:
```
SMTP_SERVER = smtp.outlook.com
SMTP_PORT = 587
```

For Yahoo Mail:
```
SMTP_SERVER = smtp.mail.yahoo.com
SMTP_PORT = 587
```

### Step 2: Update Requirements (Already Done)

The `requirements.txt` has been updated with `python-dotenv` for environment variable management.

To install:
```bash
cd Backend
pip install -r requirements.txt
```

### Step 3: Configure User Alert Settings

#### Via Frontend Dashboard:

1. **Log in to the User Dashboard**
2. **Click the Profile Icon** (top-right corner)
3. **Select "Alert Settings"**
4. **Configure**:
   - **Enable Alerts**: Toggle ON/OFF
   - **Alert Email**: Enter the email where alerts should be sent
   - **Crowd Threshold**: Set percentage (0-100%). Alert triggers when exceeded.
   - **Send Test Email**: Click to verify configuration works
5. **Save Settings**

#### Via API (for testing):

```bash
# Get current alert settings
curl -X GET http://127.0.0.1:5000/api/user/alert-settings \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update alert settings
curl -X POST http://127.0.0.1:5000/api/user/alert-settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "alert_email": "john@example.com",
    "crowd_threshold": 75,
    "alerts_enabled": true
  }'

# Send test email
curl -X POST http://127.0.0.1:5000/api/user/test-alert-email \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com"}'
```

### Step 4: How Alerts Are Triggered

When you analyze a zone in a video:

1. **System detects crowd** in the monitored polygon zone
2. **Calculates crowd density percentage** based on:
   - Maximum number of people in zone at any moment
   - Frame dimensions
3. **Compares to user's threshold**
4. **If density > threshold**:
   - Constructs professional HTML email
   - Sends via configured SMTP server
   - Logs alert to `alerts` MongoDB collection
   - Includes feed name, zone name, density %, timestamp

### Step 5: Email Templates

The system sends professional HTML emails containing:

- **Subject**: 🚨 Crowd Alert: High Density Detected in [Zone Name]
- **Body includes**:
  - Feed name and zone name
  - Current crowd density percentage
  - User's configured threshold
  - Alert timestamp
  - Link to dashboard for review

### Step 6: Database Schema

#### User Profile (users collection):
```mongodb
{
  "_id": ObjectId,
  "email": "user@example.com",
  "alert_email": "alerts@example.com",     // NEW
  "crowd_threshold": 75,                   // NEW (0-100)
  "alerts_enabled": true,                  // NEW
  "first_name": "John",
  "last_name": "Doe",
  "role": "user",
  ...
}
```

#### Alert Log (alerts collection):
```mongodb
{
  "_id": ObjectId,
  "user_email": "user@example.com",
  "alert_email": "alerts@example.com",
  "feed_id": ObjectId,
  "feed_name": "Main Entrance",
  "zone_id": "zone-123",
  "zone_name": "Entry Gate",
  "crowd_density": 85.5,
  "threshold": 75.0,
  "sent_at": ISODate("2024-03-29T10:30:00Z"),
  "status": "sent"
}
```

## Troubleshooting

### Email Not Sending

**Problem**: Test email fails with authentication error

**Solution**:
1. Verify SENDER_EMAIL and SENDER_PASSWORD are correct
2. For Gmail, ensure you're using **App Password** (not regular password)
3. Check SMTP_SERVER and SMTP_PORT are correct
4. Verify environment variables are set:
   ```bash
   # Windows PowerShell
   $env:SENDER_EMAIL
   $env:SENDER_PASSWORD
   ```

### Check Server Logs

```bash
# Windows
cd Backend
python run.py
# Look for "[Alert]" prefixed logs
```

Successful send looks like:
```
[Alert] 🚨 THRESHOLD EXCEEDED! Sending alert to john@example.com
[Alert] ✅ Alert email sent to john@example.com
```

Failed send looks like:
```
[Alert] ❌ SMTP authentication failed. Check SENDER_EMAIL and SENDER_PASSWORD.
```

### Email Landed in Spam

Some emails may go to spam. Users should:
1. Check spam/junk folder
2. Mark email as "Not spam"
3. Add sender email to contacts

## Features

### User Controls
- ✅ Enable/disable alerts globally
- ✅ Customize alert email address
- ✅ Set crowd density threshold (%)
- ✅ Test email configuration
- ✅ Multiple zones supported (each can trigger alerts)

### Backend Features
- ✅ Automatic alert checking during zone analysis
- ✅ Professional HTML email templates
- ✅ Audit trail of all sent alerts
- ✅ Error logging and recovery
- ✅ Support for any SMTP provider

### Email Features
- ✅ Professional HTML formatting
- ✅ Plain text fallback
- ✅ Real-time density percentage
- ✅ Timestamp and date information
- ✅ Feed and zone identification

## API Endpoints

### GET `/api/user/alert-settings`
Retrieve current user's alert configuration.

**Response**:
```json
{
  "alert_email": "user@example.com",
  "crowd_threshold": 70,
  "alerts_enabled": true
}
```

### POST `/api/user/alert-settings`
Update user's alert configuration.

**Request Body**:
```json
{
  "alert_email": "newemail@example.com",
  "crowd_threshold": 80,
  "alerts_enabled": true
}
```

**Response**: Updated configuration object

### POST `/api/user/test-alert-email`
Send a test email to verify configuration.

**Request Body**:
```json
{
  "email": "test@example.com"
}
```

**Response**:
```json
{
  "message": "Test email sent successfully",
  "success": true
}
```

## Files Modified/Created

### Backend
- ✅ `Backend/requirements.txt` - Added python-dotenv
- ✅ `Backend/app/utils/email_service.py` - NEW email service module
- ✅ `Backend/app/routes/user_routes.py` - Added alert endpoints
- ✅ `Backend/app/routes/feeds_routes.py` - Added alert checking in analysis

### Frontend
- ✅ `frontend/src/components/Userdashboard.jsx` - Added alert settings UI and modal

## Security Notes

⚠️ **Important**:
- Never commit SENDER_PASSWORD to git
- Use environment variables, not hardcoded values
- Consider using .env file (add to .gitignore)
- App passwords are safer than regular passwords for APIs

## Performance Considerations

- Email sending is **non-blocking** - analysis completes before email sends
- If email fails, analysis results are still saved
- Alerts are logged asynchronously
- No impact on video processing speed

## Next Steps

1. ✅ Install requirements: `pip install -r requirements.txt`
2. ✅ Configure SMTP credentials (email + password)
3. ✅ Test with "Send Test Email" in dashboard
4. ✅ Analyze a video with zones
5. ✅ Check email when threshold is exceeded
6. ✅ Review alert logs in MongoDB (alerts collection)

## Contact & Support

For issues or questions:
- Check server logs in Backend directory
- Verify email configuration in `.env` or environment variables
- Review alert settings in user dashboard

---

**Version**: 1.0  
**Last Updated**: 2024-03-29  
**Status**: Production Ready
