from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app.main import mongo
import logging

logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin", __name__)

# ✅ Helper: Check if the current user is an admin
def is_admin(user_email):
    """Check if user is admin by querying database"""
    user = mongo.db.users.find_one({"email": user_email})
    return user and user.get("role") == "admin"

def check_admin_from_jwt():
    """Check if current JWT user is admin (directly from JWT or database)"""
    try:
        identity = get_jwt_identity()
        logger.info(f"[Admin Check] JWT Identity: {identity}")
        
        # If identity is a dict with role, use it directly
        if isinstance(identity, dict):
            email = identity.get("email")
            role = identity.get("role")
            
            # Trust the role from JWT
            if role == "admin":
                return True, email
            
            # Fallback: check database
            return is_admin(email), email
        
        # If identity is just a string (old format), check database
        return is_admin(identity), identity
        
    except Exception as e:
        logger.error(f"[Admin Check] Error: {e}")
        return False, None


# ✅ Get all users (Admin only)
@admin_bp.route("/users", methods=["GET"])
@jwt_required()
def get_all_users():
    is_admin_user, current_user_email = check_admin_from_jwt()
    
    if not is_admin_user:
        logger.warning(f"[Get Users] Access denied for: {current_user_email}")
        return jsonify({"error": "Access denied. Admins only."}), 403

    # Only fetch users with role "user" (exclude admins)
    users = mongo.db.users.find({"role": "user"})
    user_list = []
    for user in users:
        user_list.append({
            "id": str(user["_id"]),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
            "email": user.get("email"),
            "role": user.get("role")
        })
    return jsonify(user_list), 200


# ✅ Add new user (Admin only)
@admin_bp.route("/users", methods=["POST"])
@jwt_required()
def add_user():
    is_admin_user, current_user_email = check_admin_from_jwt()

    if not is_admin_user:
        return jsonify({"error": "Access denied. Admins only."}), 403

    data = request.get_json()
    required_fields = ["first_name", "last_name", "email", "password", "role"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    # Check if user with same email AND same role already exists
    # This allows same email for different roles (e.g., admin@example.com as admin and user)
    if mongo.db.users.find_one({"email": data["email"], "role": data["role"]}):
        return jsonify({"error": f"A {data['role']} with this email already exists"}), 400

    # Insert new user
    mongo.db.users.insert_one({
        "first_name": data["first_name"],
        "last_name": data["last_name"],
        "email": data["email"],
        "password": data["password"],  # ⚠️ Make sure to hash if bcrypt is used
        "role": data["role"]
    })

    return jsonify({"message": "User added successfully"}), 201


# ✅ Edit user (Admin only)
@admin_bp.route("/users/<user_id>", methods=["PUT"])
@jwt_required()
def edit_user(user_id):
    is_admin_user, current_user_email = check_admin_from_jwt()

    if not is_admin_user:
        return jsonify({"error": "Access denied. Admins only."}), 403

    data = request.get_json()
    update_fields = {k: v for k, v in data.items() if k in ["first_name", "last_name", "email", "role"]}

    result = mongo.db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
    if result.modified_count == 0:
        return jsonify({"error": "User not found or no changes made"}), 404

    return jsonify({"message": "User updated successfully"}), 200


# ✅ Delete user (Admin only)
@admin_bp.route("/users/<user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    is_admin_user, current_user_email = check_admin_from_jwt()

    if not is_admin_user:
        return jsonify({"error": "Access denied. Admins only."}), 403

    result = mongo.db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"message": "User deleted successfully"}), 200


# New: Get current admin profile
@admin_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_admin_profile():
    is_admin_user, current_user_email = check_admin_from_jwt()

    if not is_admin_user:
        return jsonify({"error": "Access denied. Admins only."}), 403

    user = mongo.db.users.find_one({"email": current_user_email})
    if not user:
        return jsonify({"error": "Admin user not found"}), 404

    profile = {
        "id": str(user["_id"]),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "email": user.get("email"),
        "role": user.get("role"),
        # add additional fields here if needed (e.g., "profile_pic": user.get("profile_pic"))
    }
    return jsonify(profile), 200


# ✅ Get all feeds with user details (Admin only)
@admin_bp.route("/feeds", methods=["GET"])
@jwt_required()
def get_all_feeds():
    is_admin_user, current_user_email = check_admin_from_jwt()

    if not is_admin_user:
        return jsonify({"error": "Access denied. Admins only."}), 403

    try:
        # Get all feeds
        feeds_cursor = mongo.db.feeds.find()
        feeds_list = []
        
        for feed in feeds_cursor:
            # Get user details for this feed
            user = mongo.db.users.find_one({"email": feed.get("email")})
            
            feed_data = {
                "id": str(feed["_id"]),
                "feed_name": feed.get("feed_name"),
                "filename": feed.get("filename"),
                "upload_time": feed.get("upload_time").isoformat() if feed.get("upload_time") else None,
                "user_email": feed.get("email"),
                "user_first_name": user.get("first_name") if user else "Unknown",
                "user_last_name": user.get("last_name") if user else "User",
                "zones": feed.get("zones", []),
                "analysis_history": feed.get("analysis_history", []),
                "video_metadata": feed.get("video_metadata", {}),
                "first_frame": feed.get("first_frame")
            }
            
            # Add analysis summary
            zones = feed.get("zones", [])
            total_analyses = 0
            for zone in zones:
                if zone.get("last_analysis"):
                    total_analyses += 1
            
            feed_data["total_zones"] = len(zones)
            feed_data["analyzed_zones"] = total_analyses
            
            feeds_list.append(feed_data)
        
        # Sort by upload time (newest first)
        feeds_list.sort(key=lambda x: x.get("upload_time") or "", reverse=True)
        
        return jsonify(feeds_list), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to fetch feeds: {str(e)}"}), 500


# ✅ Get specific feed details (Admin only)
@admin_bp.route("/feeds/<feed_id>", methods=["GET"])
@jwt_required()
def get_feed_details(feed_id):
    is_admin_user, current_user_email = check_admin_from_jwt()

    if not is_admin_user:
        return jsonify({"error": "Access denied. Admins only."}), 403

    try:
        feed = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
        if not feed:
            return jsonify({"error": "Feed not found"}), 404
        
        # Get user details
        user = mongo.db.users.find_one({"email": feed.get("email")})
        
        feed_data = {
            "id": str(feed["_id"]),
            "feed_name": feed.get("feed_name"),
            "filename": feed.get("filename"),
            "upload_time": feed.get("upload_time").isoformat() if feed.get("upload_time") else None,
            "user_email": feed.get("email"),
            "user_first_name": user.get("first_name") if user else "Unknown",
            "user_last_name": user.get("last_name") if user else "User",
            "zones": feed.get("zones", []),
            "analysis_history": feed.get("analysis_history", []),
            "video_metadata": feed.get("video_metadata", {}),
            "first_frame": feed.get("first_frame"),
            "detections_cache": feed.get("detections_cache", [])
        }
        
        # Format zone data with analysis details
        for zone in feed_data["zones"]:
            if zone.get("created_at"):
                zone["created_at"] = zone["created_at"].isoformat() if hasattr(zone["created_at"], 'isoformat') else zone["created_at"]
            if zone.get("last_analysis"):
                zone["last_analysis"] = zone["last_analysis"].isoformat() if hasattr(zone["last_analysis"], 'isoformat') else zone["last_analysis"]
        
        return jsonify(feed_data), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to fetch feed details: {str(e)}"}), 500
