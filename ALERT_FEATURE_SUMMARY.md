# Crowd Count Alert Feature - Implementation Summary

## What Was Implemented

A complete **email alert system** that notifies users when crowd density in a monitored zone exceeds their configured threshold.

## Workflow

```
Frontend Dashboard
    ↓
User sets email + threshold in Alert Settings modal
    ↓
Settings saved to MongoDB users collection
    ↓
User uploads video and draws polygon zones
    ↓
User analyzes zone (system detects crowd)
    ↓
Crowd density calculated as percentage
    ↓
IF density > threshold → Send email alert
    ↓
Alert logged to MongoDB for audit trail
```

## Components Added

### 1. Backend - Email Service Module
**File**: `Backend/app/utils/email_service.py`

Functions:
- `send_crowd_alert_email()` - Sends professional HTML email alerts
- `test_email_configuration()` - Validates SMTP settings

Features:
- SMTP support (Gmail, Outlook, Yahoo, custom)
- HTML + plain text email templates
- Error handling and logging
- Configuration via environment variables

### 2. Backend - API Endpoints
**File**: `Backend/app/routes/user_routes.py`

New endpoints:
- `GET /api/user/alert-settings` - Get user's alert configuration
- `POST /api/user/alert-settings` - Update alert settings (email, threshold, enable/disable)
- `POST /api/user/test-alert-email` - Send test email to verify setup

### 3. Backend - Alert Trigger Logic
**File**: `Backend/app/routes/feeds_routes.py`

Modified `analyze_zone()` endpoint to:
1. Get user's alert settings from database
2. Calculate crowd density percentage from detected objects
3. Compare to user's threshold
4. If exceeded:
   - Send email via SMTP
   - Log alert record to MongoDB
   - Display success/error messages

### 4. Frontend - Alert Settings UI
**File**: `frontend/src/components/Userdashboard.jsx`

Added:
- **Alert Settings Modal** with:
  - Toggle to enable/disable alerts
  - Email input field
  - Threshold slider (0-100%)
  - "Send Test Email" button
  - Save settings button
  
- **Profile Menu** now includes "Alert Settings" option with bell icon

- **State Management** for:
  - Alert settings (email, threshold, enabled)
  - Loading states
  - Error handling

- **API Calls** to:
  - Load settings on app startup
  - Save updated settings
  - Send test email

### 5. Database Schema

**Users Collection** - Added fields:
```javascript
{
  "alert_email": "user@example.com",    // Email for alerts
  "crowd_threshold": 70,                // 0-100% density threshold
  "alerts_enabled": true                // Toggle on/off
}
```

**Alerts Collection** - New collection:
```javascript
{
  "user_email": "user@example.com",
  "alert_email": "alerts@example.com",
  "feed_id": ObjectId,
  "feed_name": "Main Entrance",
  "zone_id": "zone-123",
  "zone_name": "Entry Gate",
  "crowd_density": 85.5,
  "threshold": 75.0,
  "sent_at": ISODate(...),
  "status": "sent"
}
```

## Setup Instructions

### 1. Install Dependencies
```bash
cd Backend
pip install -r requirements.txt  # Added python-dotenv
```

### 2. Configure Email (SMTP)

Using Gmail (recommended):
```bash
# PowerShell
$env:SENDER_EMAIL = "your.gmail@gmail.com"
$env:SENDER_PASSWORD = "your_16_char_app_password"  # From Google App Passwords
$env:SMTP_SERVER = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USE_TLS = "True"

# Then start the backend
python run.py
```

See `EMAIL_ALERT_SETUP.md` for detailed instructions.

### 3. Frontend Configuration

Already implemented - no additional setup needed. Users can:
1. Log in to dashboard
2. Click Profile Icon → "Alert Settings"
3. Enter email and set threshold
4. Test email
5. Save settings

## How Alerts Work

### Flow During Video Analysis

1. **User analyzes a zone** in uploaded video
2. **Backend processes the video frame-by-frame**
   - Detects people using YOLOv8
   - Checks if they're inside polygon zone
   - Counts unique people
3. **Calculates statistics**:
   - Peak crowd count (max people at once)
   - Average crowd count
   - Crowd density percentage
4. **Checks against threshold**
   ```
   IF peak_count > crowd_threshold:
       → Send email alert
       → Log to alerts collection
   ```
5. **Email includes**:
   - Feed name & zone name
   - Current crowd density %
   - User's threshold %
   - Timestamp
   - Professional HTML formatting

## Key Features

✅ **User Control**
- Users set their own email and threshold
- Can enable/disable alerts
- Can test email anytime

✅ **Professional Emails**
- HTML formatted with styling
- Plain text fallback
- Includes all relevant info

✅ **Audit Trail**
- Every sent alert logged to DB
- User email, density, threshold recorded
- Timestamp and feed/zone info

✅ **Error Handling**
- Graceful fallback if email fails
- Analysis still completes
- Errors logged to server console

✅ **Security**
- Environment variables for credentials
- No hardcoded passwords
- SMTP authentication required

## Files Modified

### Backend
- `Backend/requirements.txt` - Added python-dotenv
- `Backend/app/routes/user_routes.py` - Added 3 new routes
- `Backend/app/routes/feeds_routes.py` - Added alert checking logic
- `Backend/app/utils/email_service.py` - NEW module

### Frontend
- `frontend/src/components/Userdashboard.jsx` - Added alert UI and logic

### Documentation
- `Backend/EMAIL_ALERT_SETUP.md` - Complete setup guide
- Updated this summary

## Troubleshooting

### Test email not sending?
1. Verify SENDER_EMAIL and SENDER_PASSWORD are set
2. For Gmail, use App Password (not regular password)
3. Check server logs for "[Alert]" messages

### Alert not triggering?
1. Verify alert_email field is set in user profile
2. Check crowd_threshold is below actual density %
3. Review server logs during zone analysis

### Email goes to spam?
- Add sender email to contacts
- Mark as "Not spam"
- Check email syntax

See `EMAIL_ALERT_SETUP.md` for full troubleshooting guide.

## Testing Checklist

- [ ] Backend installed with python-dotenv
- [ ] SMTP credentials configured (email + password)
- [ ] Backend started: `python run.py`
- [ ] Frontend running: `npm run dev`
- [ ] User logged in to dashboard
- [ ] Alert Settings modal opens from profile menu
- [ ] Can enter email and set threshold
- [ ] "Send Test Email" works (check inbox)
- [ ] Upload a video with a zone
- [ ] Analyze zone with threshold set low (e.g., 10%)
- [ ] Email received when crowd detected
- [ ] Alert logged in MongoDB `alerts` collection

## Next Improvements (Optional)

- [ ] Web push notifications in addition to email
- [ ] Email digest (batch alerts over time)
- [ ] Alert rules per zone (different thresholds)
- [ ] Slack/webhook integration
- [ ] Alert history in dashboard UI
- [ ] Unsubscribe from alerts
- [ ] Multiple recipient emails per user

---

**Implementation Date**: 2024-03-29  
**Status**: ✅ Complete and Ready to Use  
**Version**: 1.0
