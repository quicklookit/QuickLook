from fastapi import FastAPI
from utils.trends import fetch_trends
from utils.sheet import update_google_sheet
from utils.mailer import send_weekly_summary

app = FastAPI()

@app.get("/ping")
def ping():
    return {"status": "ok"}

@app.post("/update")
def update():
    trends_df = fetch_trends()
    update_google_sheet(trends_df)
    send_weekly_summary(trends_df)
    return {"status": "updated and emailed", "rows": len(trends_df)}