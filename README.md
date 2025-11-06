
# Vibe Commerce — Mock E‑Com Cart (Full Stack)

## Tech
- **Frontend:** React + Vite (vanilla CSS, responsive)
- **Backend:** Node.js + Express (+ `sqlite3` for optional persistence; falls back to in‑memory)
- **API style:** REST
- **DB:** SQLite (auto‑init). If SQLite fails, in‑memory is used automatically.


### 1) Backend
```bash
cd backend
npm i
npm run start   # starts on http://localhost:4000
```
> On first run it seeds products and creates `vibe_cart.db`. If SQLite is unavailable, it prints a warning and uses in‑memory storage (no setup required).

### 2) Frontend
bash
cd ../frontend
npm i
npm run dev     # opens http://localhost:5173 (proxy to backend at :4000)

