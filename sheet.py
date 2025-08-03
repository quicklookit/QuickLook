import gspread
import pandas as pd
from oauth2client.service_account import ServiceAccountCredentials
import os

SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
SHEET_NAME = "weekly_data"

scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]

creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)
client = gspread.authorize(creds)
sheet = client.open_by_key(SHEET_ID).worksheet(SHEET_NAME)

def update_google_sheet(df: pd.DataFrame):
    rows = df.values.tolist()
    header = df.columns.tolist()
    sheet.clear()
    sheet.append_row(header)
    sheet.append_rows(rows)