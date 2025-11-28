from flask import Flask
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_pymongo import PyMongo
from app.config import Config
from flask_cors import CORS

# Initialize extensions
bcrypt = Bcrypt()
jwt = JWTManager()
mongo = PyMongo()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    # Enable CORS for API routes and explicitly allow Authorization header
    # This ensures browser preflight requests (for requests with Authorization) succeed.
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"])

    # Initialize extensions
    bcrypt.init_app(app)
    jwt.init_app(app)
    mongo.init_app(app)

    # Import and register blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.user_routes import user_bp
    from app.routes.admin_routes import admin_bp
    from app.routes.feeds_routes import feeds_bp   # ✅ NEW IMPORT

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(feeds_bp, url_prefix="/api/feeds")  # ✅ REGISTERED NEW ROUTE

    return app
