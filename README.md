# 📊 Quick Market Look – Frontend

This is the Next.js (React) frontend dashboard for visualizing weekly Google Trends data.

---

## ✅ Features

- 📈 Line charts for all selected keywords
- 🌡️ Market heat thermometer (composite index)
- 🔗 Correlation heatmap (positive/negative relationships)
- 📬 Email subscription form (connected to backend)

---

## 🧪 Local Setup

```bash
npm install
npm run dev
```

Then visit: [http://localhost:3000](http://localhost:3000)

---

## 🔧 Backend Integration

This frontend fetches data from your FastAPI backend. Make sure to update all API URLs in `pages/index.js` and `components/SubscribeForm.js`.

Example:

```js
fetch('https://your-backend-url.com/weekly-data')
```

Update to your actual backend URL like:

```js
fetch('https://market-backend.up.railway.app/weekly-data')
```

---

## 🚀 Deploy to Vercel

1. Push this project to a GitHub repo (e.g. `market-trends-frontend`)
2. Go to [https://vercel.com/import](https://vercel.com/import)
3. Choose your GitHub repo
4. Accept the defaults:
   - Framework: **Next.js**
   - Build command: `npm run build`
   - Output dir: `.next`
5. Click **Deploy**

After deploy, update the environment or code with your actual backend URL.

---

## 💌 Subscriptions

Users can subscribe via email. The frontend sends addresses to:

```http
POST /subscribe
```

Handled by your backend, which saves subscribers and includes them in weekly summaries.

---

## 📁 Project Structure

```
pages/
  index.js         // Main dashboard
components/
  Thermometer.js   // Composite index gauge
  CorrelationHeatmap.js // Correlation matrix
  SubscribeForm.js // Email form
```

Enjoy your real-time market sentiment dashboard!
