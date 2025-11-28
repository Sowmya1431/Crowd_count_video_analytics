from flask import Flask
from app.database.connection import mongo

app = Flask(__name__)
app.config["MONGO_URI"] ="mongodb://localhost:27017/crowdcount_db"
mongo.init_app(app)


