from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.main import mongo

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
