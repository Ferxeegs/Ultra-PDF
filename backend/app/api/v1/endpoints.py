from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Form
from fastapi.responses import FileResponse
from app.services.pdf_service import PDFService
import uuid, os, shutil

router = APIRouter()

# Folder tetap konsisten dengan docker-compose
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

def remove_file(path: str):
    if os.path.exists(path):
        os.remove(path)

@router.post("/compress")
async def compress_pdf(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...), 
    quality: str = Form("medium")
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Hanya file PDF yang diizinkan")

    file_id = str(uuid.uuid4())
    input_path = f"{UPLOAD_DIR}/{file_id}.pdf"
    output_path = f"{OUTPUT_DIR}/compressed_{file_id}.pdf"

    # Simpan file yang diupload
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Proses kompresi
    success = await PDFService.compress_pdf(input_path, output_path, quality)

    if not success:
        remove_file(input_path)
        raise HTTPException(status_code=500, detail="Gagal mengompresi PDF")

    # Jadwalkan penghapusan file sementara setelah file dikirim ke user
    background_tasks.add_task(remove_file, input_path)
    
    # Mengembalikan file secara langsung sebagai download
    return FileResponse(
        path=output_path, 
        filename=f"compressed_{file.filename}",
        background=background_tasks.add_task(remove_file, output_path)
    )