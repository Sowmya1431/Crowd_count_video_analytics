# Email Alert System - Visual Architecture

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER DASHBOARD (Frontend)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Profile Menu (Top Right)                                    │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │ Signed in as: user@example.com                        │  │   │
│  │  ├────────────────────────────────────────────────────────┤  │   │
│  │  │ 🔔 Alert Settings  ← Click here                       │  │   │
│  │  │ 🚪 Logout                                             │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                ↓                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  📋 Alert Settings Modal                                     │   │
│  │  ├─ Toggle: ☑ Alerts Enabled                               │   │
│  │  ├─ Email: john@example.com                                 │   │
│  │  ├─ Threshold Slider: ███████░░ 70%                         │   │
│  │  ├─ [Send Test Email] [Save Settings] [Close]               │   │
│  │  └─ Settings saved to: users collection → alert_email field │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
                    [POST /api/user/alert-settings]
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Flask)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  POST /api/user/alert-settings                                       │
│  ├─ Validate email format                                            │
│  ├─ Validate threshold (0-100)                                       │
│  ├─ Save to users collection:                                        │
│  │  {                                                                │
│  │    "email": "user@example.com",                                   │
│  │    "alert_email": "john@example.com",  ← NEWLY SET              │
│  │    "crowd_threshold": 70,               ← NEWLY SET              │
│  │    "alerts_enabled": true               ← NEWLY SET              │
│  │  }                                                                │
│  └─ Return updated settings to frontend                              │
│                                                                       │
│                         [User uploads video]                          │
│                                  ↓                                    │
│  POST /api/feeds/upload                                              │
│  ├─ Save video to GridFS                                             │
│  ├─ Extract metadata (fps, resolution, duration)                     │
│  ├─ Generate detection samples                                       │
│  └─ Return feed_id to frontend                                       │
│                                                                       │
│                    [User draws zone polygon]                          │
│                                  ↓                                    │
│  POST /api/feeds/{feed_id}/zones                                     │
│  ├─ Create zone with polygon coordinates                             │
│  └─ Store in feeds.zones array                                       │
│                                                                       │
│              [User analyzes zone - KEY PART]                          │
│                                  ↓                                    │
│  POST /api/feeds/{feed_id}/analyze_zone                              │
│  ├─ Load feed from MongoDB                                           │
│  ├─ Load zone polygon                                                │
│  ├─ Process cached detections frame-by-frame:                        │
│  │  └─ For each frame: count people inside polygon                   │
│  ├─ Calculate statistics:                                            │
│  │  ├─ peak_count: max people at any moment                          │
│  │  ├─ avg_count: average across frames                              │
│  │  ├─ crowd_density = peak_count (as percentage)                    │
│  │  └─ dwell_times: how long each person stayed                      │
│  ├─ Save analysis results to MongoDB                                 │
│  │                                                                    │
│  │                    ← HERE IS WHERE ALERTS TRIGGER! →              │
│  │                                                                    │
│  └─ ✅ NEW ALERT LOGIC:                                              │
│     ├─ Load user's alert settings from database:                     │
│     │  {                                                              │
│     │    "alert_email": "john@example.com",                          │
│     │    "crowd_threshold": 70,                                      │
│     │    "alerts_enabled": true                                      │
│     │  }                                                              │
│     ├─ IF crowd_density > threshold:                                 │
│     │  ├─ Call send_crowd_alert_email()                             │
│     │  ├─ Send email via SMTP:                                       │
│     │  │  Recipient: alert_email                                    │
│     │  │  Subject: 🚨 Crowd Alert: High Density in [Zone Name]      │
│     │  │  Body:                                                      │
│     │  │    Feed: Main Entrance                                      │
│     │  │    Zone: Entry Gate                                         │
│     │  │    Crowd Density: 85.5%                                     │
│     │  │    Threshold: 70.0%                                         │
│     │  │    Time: 2024-03-29 14:30:45                                │
│     │  └─ (Professional HTML + Plain text)                           │
│     ├─ Log to alerts collection:                                     │
│     │  {                                                              │
│     │    "user_email": "user@example.com",                           │
│     │    "alert_email": "john@example.com",                          │
│     │    "feed_id": ObjectId("..."),                                 │
│     │    "feed_name": "Main Entrance",                               │
│     │    "zone_id": "zone-123",                                      │
│     │    "zone_name": "Entry Gate",                                  │
│     │    "crowd_density": 85.5,                                      │
│     │    "threshold": 70.0,                                          │
│     │    "sent_at": ISODate("2024-03-29T14:30:45Z"),                 │
│     │    "status": "sent"                                            │
│     │  }                                                              │
│     └─ Return analysis results with alert status                     │
│                                                                       │
│                 ✉️ EMAIL SERVICE (email_service.py)                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ send_crowd_alert_email(recipient, feed, zone, density)      │    │
│  ├─ Create MIME email with HTML + plain text parts             │    │
│  ├─ Connect to SMTP server:                                    │    │
│  │  └─ Server: env.SMTP_SERVER (smtp.gmail.com)               │    │
│  │  └─ Port: env.SMTP_PORT (587)                              │    │
│  │  └─ TLS: env.SMTP_USE_TLS (True)                           │    │
│  ├─ Authenticate with:                                         │    │
│  │  └─ User: env.SENDER_EMAIL (your.gmail@gmail.com)          │    │
│  │  └─ Pass: env.SENDER_PASSWORD (app-specific-password)      │    │
│  ├─ Send email                                                 │    │
│  └─ Log success/failure                                        │    │
│  └─ Errors handled gracefully (doesn't break analysis)         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  POST /api/user/test-alert-email                                    │
│  ├─ Same as above but with test message                             │
│  └─ Allows users to verify setup works                              │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
                    [Email arrives in inbox!]
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    📧 EMAIL RECEIVED                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  From: your.app@gmail.com                                            │
│  To: john@example.com                                                │
│  Subject: 🚨 Crowd Alert: High Density Detected in Entry Gate        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Crowd Density Alert!                                        │    │
│  │                                                             │    │
│  │ Feed: Main Entrance                                        │    │
│  │ Zone: Entry Gate                                           │    │
│  │ Current Crowd Density: 85.5%                               │    │
│  │ Alert Threshold: 70.0%                                     │    │
│  │ Alert Time: 2024-03-29 14:30:45                            │    │
│  │                                                             │    │
│  │ The crowd density in the monitored zone has exceeded your  │    │
│  │ configured threshold. Please check the dashboard for more  │    │
│  │ details.                                                   │    │
│  │                                                             │    │
│  │ [Manage Alerts] [View Dashboard]                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      📊 MONGODB AUDIT TRAIL                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  alerts collection:                                                  │
│  {                                                                    │
│    "_id": ObjectId("60d5ec49c1234567890abcdef"),                     │
│    "user_email": "user@example.com",                                 │
│    "alert_email": "john@example.com",                                │
│    "feed_id": ObjectId("60d5ec49c1234567890abcde1"),                 │
│    "feed_name": "Main Entrance",                                     │
│    "zone_id": "zone-123",                                            │
│    "zone_name": "Entry Gate",                                        │
│    "crowd_density": 85.5,          ← Actual density detected         │
│    "threshold": 70.0,              ← User's configured threshold     │
│    "sent_at": ISODate("2024-03-29T14:30:45.123Z"),                   │
│    "status": "sent"                ← Audit record                    │
│  }                                                                    │
│                                                                       │
│  ✅ All alerts are logged and searchable by date, user, zone, etc.   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Configuration Flow

```
┌──────────────────────────────────────────────────────────┐
│  1. INSTALL DEPENDENCIES                                 │
│     pip install -r requirements.txt                       │
│     (adds python-dotenv for env variable support)         │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  2. CONFIGURE SMTP (Gmail example)                        │
│                                                           │
│  Windows PowerShell:                                      │
│  $env:SENDER_EMAIL = "your.gmail@gmail.com"              │
│  $env:SENDER_PASSWORD = "16_char_app_password"           │
│  $env:SMTP_SERVER = "smtp.gmail.com"                     │
│  $env:SMTP_PORT = "587"                                  │
│  $env:SMTP_USE_TLS = "True"                              │
│                                                           │
│  OR Create Backend/.env file                             │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  3. START BACKEND                                         │
│     cd Backend                                            │
│     python run.py                                         │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  4. START FRONTEND                                        │
│     cd frontend                                           │
│     npm run dev                                           │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  5. USER CONFIGURES IN DASHBOARD                          │
│     - Login                                               │
│     - Profile Menu → Alert Settings                       │
│     - Enter email + set threshold                         │
│     - Send test email                                     │
│     - Save settings                                       │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  6. ANALYZE VIDEO ZONES                                  │
│     - Upload video                                        │
│     - Draw polygon zone                                   │
│     - Analyze zone                                        │
│     - System sends alert if threshold exceeded            │
└──────────────────────────────────────────────────────────┘
```

## Key Components

### Frontend Components
- **UserDashboard.jsx**: Main dashboard with alert modal
- **Alert Settings Modal**: Email + threshold configuration
- **Profile Menu**: Access point for settings

### Backend Modules
- **email_service.py**: SMTP email sending
- **user_routes.py**: Alert endpoint handlers
- **feeds_routes.py**: Analysis logic with alert trigger

### Database
- **users collection**: Stores alert config per user
- **alerts collection**: Audit trail of sent alerts

### Configuration
- Environment variables for SMTP credentials
- No hardcoded passwords or secrets

---

**Last Updated**: 2024-03-29
