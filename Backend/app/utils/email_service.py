import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# Email Configuration - Configure these environment variables or update directly
EMAIL_CONFIG = {
    "smtp_server": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
    "smtp_port": int(os.getenv("SMTP_PORT", "587")),
    "sender_email": os.getenv("SENDER_EMAIL", "your_email@gmail.com"),
    "sender_password": os.getenv("SENDER_PASSWORD", "your_app_password"),
    "use_tls": os.getenv("SMTP_USE_TLS", "True").lower() == "true"
}


def send_crowd_alert_email(recipient_email, feed_name, zone_name, crowd_density, threshold):
    """
    Send a crowd density alert email to the user.
    
    Args:
        recipient_email (str): User's email address
        feed_name (str): Name of the video feed/file
        zone_name (str): Name of the monitored zone
        crowd_density (float): Current crowd density percentage (0-100)
        threshold (float): Alert threshold percentage
    
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        if not recipient_email:
            return False, "Recipient email not provided"
        
        if not EMAIL_CONFIG["sender_email"] or EMAIL_CONFIG["sender_email"] == "your_email@gmail.com":
            logger.warning("Email service not configured. Update SENDER_EMAIL and SENDER_PASSWORD environment variables.")
            return False, "Email service not configured on server"
        
        # Create email message
        sender_email = EMAIL_CONFIG["sender_email"]
        message = MIMEMultipart("alternative")
        message["Subject"] = f"🚨 Crowd Alert: High Density Detected in {zone_name}"
        message["From"] = sender_email
        message["To"] = recipient_email
        
        # Plain text version
        text = f"""
Crowd Density Alert!

Feed: {feed_name}
Zone: {zone_name}
Current Crowd Density: {crowd_density:.1f}%
Alert Threshold: {threshold:.1f}%
Alert Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

The crowd density in the monitored zone has exceeded your configured threshold.
Please check the dashboard for more details.

---
Crowd Count Video Analytics System
"""
        
        # HTML version
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #e74c3c;">🚨 Crowd Density Alert!</h2>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Feed:</strong> {feed_name}</p>
                        <p><strong>Zone:</strong> {zone_name}</p>
                        <p style="font-size: 18px; color: #e74c3c;">
                            <strong>Current Crowd Density:</strong> {crowd_density:.1f}%
                        </p>
                        <p><strong>Alert Threshold:</strong> {threshold:.1f}%</p>
                        <p><strong>Alert Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                    </div>
                    
                    <p>The crowd density in the monitored zone has exceeded your configured threshold. 
                       Please log in to your dashboard to review the details and take necessary actions.</p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999;">
                        Crowd Count Video Analytics System<br>
                        This is an automated alert message.
                    </p>
                </div>
            </body>
        </html>
        """
        
        # Attach both versions
        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)
        
        # Send email
        with smtplib.SMTP(EMAIL_CONFIG["smtp_server"], EMAIL_CONFIG["smtp_port"]) as server:
            if EMAIL_CONFIG["use_tls"]:
                server.starttls()
            
            server.login(EMAIL_CONFIG["sender_email"], EMAIL_CONFIG["sender_password"])
            server.sendmail(sender_email, recipient_email, message.as_string())
        
        logger.info(f"✅ Alert email sent to {recipient_email} for {zone_name} in {feed_name}")
        return True, "Alert email sent successfully"
    
    except smtplib.SMTPAuthenticationError:
        error_msg = "SMTP authentication failed. Check SENDER_EMAIL and SENDER_PASSWORD."
        logger.error(f"❌ {error_msg}")
        return False, error_msg
    
    except smtplib.SMTPException as e:
        error_msg = f"SMTP error: {str(e)}"
        logger.error(f"❌ {error_msg}")
        return False, error_msg
    
    except Exception as e:
        error_msg = f"Failed to send alert email: {str(e)}"
        logger.error(f"❌ {error_msg}")
        return False, error_msg


def test_email_configuration(recipient_email):
    """
    Test if email configuration is working by sending a test email.
    
    Args:
        recipient_email (str): Email to send test message to
    
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        sender_email = EMAIL_CONFIG["sender_email"]
        
        message = MIMEMultipart("alternative")
        message["Subject"] = "Test: Crowd Count Alert System"
        message["From"] = sender_email
        message["To"] = recipient_email
        
        text = "This is a test email from the Crowd Count Video Analytics System."
        html = """
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>✅ Email Configuration Test</h2>
                <p>This is a test email from the Crowd Count Video Analytics System.</p>
                <p>If you received this, your alert notifications are working correctly!</p>
            </body>
        </html>
        """
        
        message.attach(MIMEText(text, "plain"))
        message.attach(MIMEText(html, "html"))
        
        with smtplib.SMTP(EMAIL_CONFIG["smtp_server"], EMAIL_CONFIG["smtp_port"]) as server:
            if EMAIL_CONFIG["use_tls"]:
                server.starttls()
            
            server.login(EMAIL_CONFIG["sender_email"], EMAIL_CONFIG["sender_password"])
            server.sendmail(sender_email, recipient_email, message.as_string())
        
        logger.info(f"✅ Test email sent to {recipient_email}")
        return True, "Test email sent successfully"
    
    except Exception as e:
        error_msg = f"Test email failed: {str(e)}"
        logger.error(f"❌ {error_msg}")
        return False, error_msg
