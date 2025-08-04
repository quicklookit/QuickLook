from pytrends.request import TrendReq
import pandas as pd
import os

KEYWORDS = [
    "cosmetics", "lipstick", "airline ticket sales", "PMI index", "interest rates",
    "mortgage lending", "credit card debt", "job openings", "house prices",
    "European Central Bank", "Federal Reserve", "bank of international settlements", "XRP"
]

def fetch_trends():
    pytrends = TrendReq()
    pytrends.build_payload(KEYWORDS, timeframe='now 1-d')
    df = pytrends.interest_over_time().drop(columns=['isPartial'])
    df.reset_index(inplace=True)
    return df
