from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import router as api_router
import os

app = FastAPI(title="UltraPDF Backend API")

# Pastikan direktori penyimpanan ada
os.makedirs("uploads", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Di produksi, ganti dengan domain Next.js Anda
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "UltraPDF Backend is running with Ghostscript!"}