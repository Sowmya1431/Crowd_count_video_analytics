import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key")

    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY",
        "your_jwt_secret_key"
    )

    MONGO_URI = os.getenv("MONGO_URI")
    
    # Allow large file uploads (500MB)
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024