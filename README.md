# Cosmetics CRM & Inventory Management Platform 💄📦

A robust full-stack CRM and inventory management application designed for cosmetics businesses, retail operations, and product tracking. The platform provides secure role-based access, comprehensive inventory lifecycle management, and dynamic sales metric aggregations.

---

## 🛠️ Tech Stack

- **Backend:** Python, FastAPI, Pydantic (v2)
- **Database:** MongoDB (PyMongo Driver)
- **Security & Authentication:** JWT (JSON Web Tokens), Passlib (Bcrypt hashing)
- **Frontend:** Vanilla JavaScript, HTML5, Modern CSS
- **API Documentation:** Interactive OpenAPI documentation via Swagger UI

---

## ✨ Key Features

- **Authentication & Security:** 
  - Token-based authentication using OAuth2 & JWT.
  - Password hashing via Bcrypt.
  - Role-Based Access Control (Admin/User privileges).
- **Product & Stock Management:** 
  - Real-time stock status monitoring.
  - CRUD operations for beauty and skincare inventory.
  - Low-stock alerting logic.
- **Sales & Orders Pipeline:** 
  - Order creation and customer profile linking.
  - MongoDB aggregation pipelines for instant revenue and transaction metrics.
- **Interactive API Documentation:** Automatically generated interactive endpoints accessible through Swagger UI.

---

## 📁 Project Architecture

```text
cosmetics-crm-app/
├── routes/             # API modular route handlers
├── database.py         # MongoDB connection setup
├── main.py             # FastAPI entry point & middleware
├── schemas.py          # Pydantic data validation models
├── index.html          # Dashboard frontend layout
├── App.js              # Client-side API integration logic
├── requirements.txt    # Project dependencies
└── .gitignore          # Environment and cache exclusion rules

🚀 Getting Started
Prerequisites
Python 3.10+

MongoDB instance running locally (e.g., mongodb://localhost:27017) or via MongoDB Atlas

### 1. Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/FAIZMOHAMMED123/cosmetics-crm-app.git](https://github.com/FAIZMOHAMMED123/cosmetics-crm-app.git)
   cd cosmetics-crm-app

   python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
pip install -r requirements.txt
MONGO_URI=mongodb://localhost:27017
DB_NAME=cosmetics_crm
JWT_SECRET_KEY=your_jwt_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

### 4. Run the Application

Start the FastAPI server:

```bash
uvicorn main:app --reload

API Base URL: http://127.0.0.1:8000

Swagger UI Documentation: http://127.0.0.1:8000/docs

Redoc Documentation: http://127.0.0.1:8000/redoc

👤 Author
Mohammed FAIZ

Computer Engineering Student at ENSA Fès (USMBA)
GitHub