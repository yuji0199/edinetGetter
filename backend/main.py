import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, stocks, edinet, analysis, portfolio, growth
import models
from database import engine

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="EDINET Fundamental Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

app.include_router(auth.router, prefix="/api")
app.include_router(stocks.router, prefix="/api")
app.include_router(edinet.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(portfolio.router, prefix="/api")
app.include_router(growth.router, prefix="/api")

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to EDINET Fundamental Analysis API"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
