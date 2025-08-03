import os
import requests
import pandas as pd

MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")

RECIPIENTS = ["teroexpat@gmail.com"]  # add more as needed

def send_weekly_summary(df: pd.DataFrame):
    latest = df.tail(1).T.reset_index()
    latest.columns = ["Keyword", "Latest"]
    body = "\n".join(f"{row.Keyword}: {row.Latest}" for _, row in latest.iterrows())

    for recipient in RECIPIENTS:
        requests.post(
            f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages",
            auth=("api", MAILGUN_API_KEY),
            data={
                "from": f"Quick Market <noreply@{MAILGUN_DOMAIN}>",
                "to": recipient,
                "subject": "📊 Weekly Market Trends Summary",
                "text": body
            }
        )