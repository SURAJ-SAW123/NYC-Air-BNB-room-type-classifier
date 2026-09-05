# NYC Airbnb Room Type Classifier

A machine learning web app that predicts the **room type** (Entire home/apt, Private room, or Shared room) of an NYC Airbnb listing based on its location, pricing, reviews, and host details — served through a FastAPI backend and a custom dark-themed frontend.

**Live demo:** https://nyc-air-bnb-room-type-classifier.vercel.app
**API:** https://nyc-air-bnb-room-type-classifier.onrender.com

---

## What it does

You enter details about a listing — coordinates, borough/neighbourhood, price, minimum nights, review activity, host's listing count, and availability — and the model predicts the most likely room type along with a probability breakdown across all classes.

---

## Tech stack

**Machine Learning**
- `scikit-learn` — trained classification pipeline (preprocessing + model bundled together)
- `pandas` / `numpy` — data handling
- `joblib` — model serialization (`Model_Pipeline.pkl`)
- Trained and explored in `NYC.ipynb` (Jupyter Notebook)

**Backend**
- `FastAPI` — REST API serving the model
- `Pydantic` — request validation matching the model's expected input schema
- `Uvicorn` — ASGI server
- CORS enabled for cross-origin requests from the frontend

**Frontend**
- Plain **HTML / CSS / JavaScript** — no framework, no build step
- Custom dark theme with NYC-skyline motif, animated probability bars, and live request/response preview
- `localStorage` used to remember the API URL per browser

**Deployment**
- **Render** — hosts the FastAPI backend
- **Vercel** — hosts the static frontend
- **GitHub** — version control, connected to both platforms for auto-redeploy on push

---

## Project structure

```
├── main.py                # FastAPI app + /predict endpoint
├── Model_Pipeline.pkl     # Trained scikit-learn pipeline (serialized)
├── NYC.ipynb              # Notebook used to explore data & train the model
├── requirements.txt       # Backend Python dependencies
├── index.html             # Frontend markup
├── style.css              # Dark theme styling & animations
├── script.js              # Form logic, validation, API calls, result rendering
└── .gitignore
```

---

## API

### `GET /`
Health check. Returns a simple greeting string.

### `POST /predict`
Accepts a JSON body describing a listing and returns the predicted room type with class probabilities.

**Request body**
```json
{
  "latitude": 40.7128,
  "longitude": -73.9654,
  "price": 145,
  "minimum_nights": 2,
  "number_of_reviews": 37,
  "reviews_per_month": 1.8,
  "calculated_host_listings_count": 3,
  "availability_365": 210,
  "neighbourhood_group": "Brooklyn",
  "neighbourhood": "Williamsburg"
}
```

**Response**
```json
{
  "Predicted_room_type": "Entire home/apt",
  "Probability": [0.72, 0.21, 0.07]
}
```

---

## Running it locally

**Backend**
```bash
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend**
Just open `index.html` in a browser, or serve it:
```bash
python -m http.server 5500
```
Then click the gear icon in the UI and point it at `http://localhost:8000` (or your deployed backend URL).

---

## Deployment notes

- Backend is pinned to **Python 3.11** (via `.python-version`) because `scikit-learn`/`pandas` don't ship prebuilt wheels for newer Python versions, and the model was trained under `scikit-learn==1.6.1`.
- Render's free tier spins the backend down after inactivity — the first request after idling can take 30–60 seconds to respond while it wakes up.
- The frontend's default API URL is set in `script.js` (`DEFAULT_API_BASE`) so it works out of the box for visitors without needing manual configuration.
