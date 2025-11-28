from flask import Blueprint, request, jsonify
from app.main import mongo, bcrypt
from flask_jwt_extended import create_access_token
from datetime import timedelta

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not all([first_name, last_name, email, password, role]):
        return jsonify({"error": "All fields are required"}), 400

    # Check if user with same email AND same role already exists
    # This allows same email for different roles (e.g., admin@example.com as admin and user)
    existing_user = mongo.db.users.find_one({"email": email, "role": role})
    if existing_user:
        return jsonify({"error": f"A {role} with this email already exists"}), 409

    hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")

    mongo.db.users.insert_one({
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "password": hashed_pw,
        "role": role
    })

    return jsonify({"message": "User registered successfully"}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not all([email, password, role]):
        return jsonify({"error": "All fields are required"}), 400

    user = mongo.db.users.find_one({"email": email, "role": role})
    if user and bcrypt.check_password_hash(user["password"], password):
        token = create_access_token(identity={"email": email, "role": role}, expires_delta=timedelta(hours=1))
        return jsonify({
            "message": "Login successful",
            "token": token,
            "role": role,
            "firstName": user.get("first_name"),
            "lastName": user.get("last_name"),
            "email": email
        }), 200

    return jsonify({"error": "Invalid credentials"}), 401
