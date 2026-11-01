import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "cosmetics_db")

# Connexion avec certifi pour éviter les blocages SSL sous Windows
client = MongoClient(MONGODB_URI, tlsCAFile=certifi.where())
db = client[DB_NAME]

# Collection Produits Cosmétiques
products_collection = db["products"]
customers_collection = db["customers"]
orders_collection = db["orders"]
users_collection = db["users"]
