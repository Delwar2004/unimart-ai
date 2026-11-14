# UniMart AI: An Intelligent University Marketplace for Student-to-Student Commerce

## 1. Project Overview
UniMart AI is a university-exclusive web marketplace engineered for students to buy, sell, exchange, request, and give away items within their campus community (textbooks, calculators, electronics, academic materials, and personal belongings).

The system integrates intelligent services such as natural-language search, personalized product recommendations, automated product description generation, price suggestions, image-based category detection, and an AI marketplace assistant.

---

## 2. Technology Stack

- **Frontend:** React (v19) + Vite + Tailwind CSS (v4) + JavaScript (ES Modules)
- **Backend:** Node.js + Express.js (RESTful API architecture)
- **Database:** MongoDB + Mongoose ODM (NoSQL)
- **External AI:** External AI API integration (managed exclusively on the backend)

---

## 3. Project Structure

```
UniMart-AI/
├── backend/
│   ├── src/
│   │   ├── config/          # Database connection and environment config
│   │   ├── constants/       # Global system enums (roles, statuses)
│   │   ├── controllers/     # Request handlers
│   │   ├── middlewares/     # Error handling, 404, auth (future)
│   │   ├── models/          # Foundational Mongoose schemas (User, Category, Product)
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic & AI services (future)
│   │   ├── utils/           # Response helpers and validators
│   │   └── server.js        # Server entry point
│   ├── .env.example         # Environment template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── assets/          # Static assets & icons
│   │   ├── components/      # UI components
│   │   ├── context/         # React Contexts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Application views
│   │   ├── services/        # API client and service layer
│   │   ├── utils/           # Utility functions
│   │   ├── App.jsx          # App shell
│   │   ├── index.css        # Tailwind directives
│   │   └── main.jsx         # React root
│   ├── .env.example         # Frontend environment template
│   ├── vite.config.js
│   └── package.json
├── docs/                    # Project documentation
├── .gitignore               # Root gitignore
└── README.md
```

---

## 4. MongoDB Requirement

> [!IMPORTANT]
> The database implementation uses **MongoDB with Mongoose**.
> MySQL, SQL queries, Sequelize, and relational ORMs are **NOT used**.

### Initial Collections & Models:
- **`User` (`backend/src/models/User.js`):** Supports university email uniqueness, student ID, department, batch, phone, avatar, bio, verification flags, account status, campus location, and reputation counters.
- **`Category` (`backend/src/models/Category.js`):** Supports category names, unique slugs, icons, descriptions, and subcategories array.
- **`Product` (`backend/src/models/Product.js`):** Supports listings (`sell`, `exchange`, `giveaway`), prices, condition, images, campus pickup location, listing status (`available`, `reserved`, `sold`), exchange preferences, moderation status, compound indexes, and text search indexes (`title`, `description`, `tags`).

---

## 5. Getting Started

### Prerequisites
- Node.js (v18+ recommended, verified on v24)
- npm (v9+)
- MongoDB server running locally on `localhost:27017` or a MongoDB Atlas URI

### Configuration
1. **Backend:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env if your MongoDB URI or port differ
   ```
2. **Frontend:**
   ```bash
   cd frontend
   cp .env.example .env
   # Default API Base URL: http://localhost:5000/api/v1
   ```

### Running the Backend
```bash
cd backend
npm install
npm run dev
# Server runs on http://localhost:5000
# Health check available at: http://localhost:5000/api/v1/health
```

### Running the Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```
