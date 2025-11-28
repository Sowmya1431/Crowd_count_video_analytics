import os

class Config:
    SECRET_KEY = "your_secret_key"
    JWT_SECRET_KEY = "your_jwt_secret_key"  # Add this for JWT
    MONGO_URI = "mongodb://localhost:27017/crowdcount_db"
