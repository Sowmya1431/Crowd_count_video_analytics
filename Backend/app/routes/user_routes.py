from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.main import mongo
import logging

logger = logging.getLogger(__name__)

user_bp = Blueprint("user", __name__)

# ✅ Test route to confirm blueprint works
@user_bp.route("/test", methods=["GET"])
@jwt_required(optional=True)
def test_user_route():
    current_user = get_jwt_identity()
    if current_user:
        return jsonify({"message": f"Hello {current_user}!"}), 200
    else:
        return jsonify({"message": "Hello, Guest!"}), 200


# ✅ Example of a real route
@user_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    current_user = get_jwt_identity()
    return jsonify({"message": f"Welcome to your profile, {current_user}!"}), 200


# Return feeds for the current user under /api/user/feeds to match frontend expectations
@user_bp.route("/feeds", methods=["GET"])
@jwt_required()
def user_feeds():
    current_user = get_jwt_identity()
    # current_user may be a dict with email
    email = current_user if isinstance(current_user, str) else (current_user.get("email") if current_user else None)
    if not email:
        return jsonify({"error": "Unable to determine user"}), 400

    try:
        docs = mongo.db.feeds.find({"email": email}).sort("upload_time", -1)
    except Exception:
        return jsonify({"error": "DB query failed"}), 500

    feeds = []
    for f in docs:
        feeds.append({
            "_id": str(f.get("_id")),
            "filename": f.get("filename"),
            "summary": f.get("summary"),
            "zones": f.get("zones", [])
        })

    return jsonify({"feeds": feeds}), 200


# ============================================
# ALERT SETTINGS ENDPOINTS
# ============================================

# Get alert settings for current user
@user_bp.route("/alert-settings", methods=["GET"])
@jwt_required()
def get_alert_settings():
    """Retrieve alert email and threshold settings for the current user."""
    try:
        current_user = get_jwt_identity()
        email = current_user if isinstance(current_user, str) else (current_user.get("email") if current_user else None)
        
        if not email:
            return jsonify({"error": "Unable to determine user"}), 400
        
        user = mongo.db.users.find_one({"email": email})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "alert_email": user.get("alert_email", email),
            "crowd_threshold": user.get("crowd_threshold", 70),
            "alerts_enabled": user.get("alerts_enabled", True)
        }), 200
    
    except Exception as e:
        logger.error(f"Error retrieving alert settings: {e}")
        return jsonify({"error": "Failed to retrieve alert settings"}), 500


# Update alert settings (email, threshold, enable/disable)
@user_bp.route("/alert-settings", methods=["POST"])
@jwt_required()
def update_alert_settings():
    """Update alert email, threshold, and enabled status for the current user."""
    try:
        current_user = get_jwt_identity()
        email = current_user if isinstance(current_user, str) else (current_user.get("email") if current_user else None)
        
        if not email:
            return jsonify({"error": "Unable to determine user"}), 400
        
        data = request.get_json()
        
        # Validate input
        alert_email = data.get("alert_email", "").strip()
        crowd_threshold = data.get("crowd_threshold")
        alerts_enabled = data.get("alerts_enabled")
        
        # Validate email format (basic check)
        if alert_email and "@" not in alert_email:
            return jsonify({"error": "Invalid email format"}), 400
        
        # Validate threshold is a number between 0-100
        if crowd_threshold is not None:
            try:
                crowd_threshold = float(crowd_threshold)
                if crowd_threshold < 0 or crowd_threshold > 100:
                    return jsonify({"error": "Threshold must be between 0 and 100"}), 400
            except (ValueError, TypeError):
                return jsonify({"error": "Threshold must be a number"}), 400
        
        # Build update object with only provided fields
        update_obj = {}
        if alert_email:
            update_obj["alert_email"] = alert_email
        if crowd_threshold is not None:
            update_obj["crowd_threshold"] = crowd_threshold
        if alerts_enabled is not None:
            update_obj["alerts_enabled"] = bool(alerts_enabled)
        
        if not update_obj:
            return jsonify({"error": "No settings provided to update"}), 400
        
        result = mongo.db.users.update_one(
            {"email": email},
            {"$set": update_obj}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "User not found"}), 404
        
        logger.info(f"Alert settings updated for user {email}")
        
        return jsonify({
            "message": "Alert settings updated successfully",
            "alert_email": update_obj.get("alert_email", email),
            "crowd_threshold": update_obj.get("crowd_threshold", 70),
            "alerts_enabled": update_obj.get("alerts_enabled", True)
        }), 200
    
    except Exception as e:
        logger.error(f"Error updating alert settings: {e}")
        return jsonify({"error": "Failed to update alert settings"}), 500


# Test email configuration
@user_bp.route("/test-alert-email", methods=["POST"])
@jwt_required()
def test_alert_email():
    """Send a test alert email to verify email configuration."""
    try:
        from app.utils.email_service import test_email_configuration
        
        current_user = get_jwt_identity()
        email = current_user if isinstance(current_user, str) else (current_user.get("email") if current_user else None)
        
        if not email:
            return jsonify({"error": "Unable to determine user"}), 400
        
        data = request.get_json()
        test_email = data.get("email", email)
        
        if not test_email:
            return jsonify({"error": "Email address required"}), 400
        
        success, message = test_email_configuration(test_email)
        
        if success:
            return jsonify({"message": message, "success": True}), 200
        else:
            return jsonify({"error": message, "success": False}), 500
    
    except Exception as e:
        logger.error(f"Error sending test email: {e}")
        return jsonify({"error": f"Failed to send test email: {str(e)}"}), 500
