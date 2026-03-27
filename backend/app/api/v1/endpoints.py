from typing import List
import uuid
import os
import logging
import shutil
from pathlib import Path
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    BackgroundTasks,
    HTTPException,
    Form,
    Request,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from app.services.pdf_service import PDFService
from app.services.image_service import ImageService
from app.utils.security import (
    validate_file_size,
    validate_file_extension,
    validate_file_content,
    sanitize_filename,
    get_safe_file_path,
)
from app.middleware.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "outputs")

ALLOWED_QUALITIES = ["low", "medium", "high"]


class QualityInput(BaseModel):
    quality: str = Field(default="medium", pattern="^(low|medium|high)$")


def remove_file(path: str):
    try:
        if path and os.path.exists(path):
            os.remove(path)
            logger.info(f"File removed: {path}")
    except Exception as e:
        logger.error(f"Error removing file {path}: {e}")


def remove_directory(path: str):
    """Remove directory and all its contents"""
    try:
        if path and os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
            logger.info(f"Directory removed: {path}")
    except Exception as e:
        logger.error(f"Error removing directory {path}: {e}")


@router.post("/compress")
@limiter.limit("10/minute")
async def compress_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    quality: str = Form("medium"),
):
    if quality not in ALLOWED_QUALITIES:
        raise HTTPException(
            status_code=400,
            detail=f"Quality must be one of: {', '.join(ALLOWED_QUALITIES)}",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    if not validate_file_extension(file.filename):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_id = str(uuid.uuid4())
    sanitized_filename = sanitize_filename(file.filename)
    max_size = int(os.getenv("MAX_FILE_SIZE_MB", "500")) * 1024 * 1024

    try:
        input_path = get_safe_file_path(UPLOAD_DIR, f"{file_id}.pdf")
        output_path = get_safe_file_path(OUTPUT_DIR, f"compressed_{file_id}.pdf")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_size = 0
    try:
        chunk_size = 4 * 1024 * 1024
        first_chunk = await file.read(chunk_size)

        if not first_chunk:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        if first_chunk[:4] != b"%PDF":
            raise HTTPException(
                status_code=400,
                detail="Invalid file content. Only PDF files are allowed",
            )

        file_size = len(first_chunk)

        with open(input_path, "wb", buffering=8 * 1024 * 1024) as buffer:
            buffer.write(first_chunk)
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > max_size:
                    buffer.close()
                    remove_file(input_path)
                    raise HTTPException(
                        status_code=413, detail="File size exceeds maximum limit"
                    )
                buffer.write(chunk)

        if not validate_file_size(file_size):
            remove_file(input_path)
            raise HTTPException(status_code=413, detail="File size validation failed")

        if file_size < 10 * 1024 * 1024:
            if not validate_file_content(input_path):
                remove_file(input_path)
                raise HTTPException(status_code=400, detail="Invalid file content type")

        success = await PDFService.compress_pdf(input_path, output_path, quality)
        if not success:
            remove_file(input_path)
            raise HTTPException(status_code=500, detail="Failed to compress PDF")

    except Exception as e:
        remove_file(input_path)
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail="Internal server error")
        raise e

    background_tasks.add_task(remove_file, input_path)
    background_tasks.add_task(remove_file, output_path)

    return FileResponse(
        path=output_path,
        filename=f"compressed_{sanitized_filename}",
        media_type="application/pdf",
    )


@router.post("/convert-docx")
@limiter.limit("5/minute")
async def convert_docx_to_pdf_endpoint(
    request: Request, background_tasks: BackgroundTasks, file: UploadFile = File(...)
):
    if not file.filename or not file.filename.lower().endswith((".docx", ".doc")):
        raise HTTPException(
            status_code=400, detail="Only .docx and .doc files are allowed"
        )

    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix.lower()
    sanitized_name = sanitize_filename(file.filename)
    max_size_docx = int(os.getenv("MAX_DOCX_SIZE_MB", "100")) * 1024 * 1024

    try:
        input_path = get_safe_file_path(UPLOAD_DIR, f"{file_id}{ext}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_size = 0
    try:
        chunk_size = 4 * 1024 * 1024
        with open(input_path, "wb", buffering=8 * 1024 * 1024) as buffer:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > max_size_docx:
                    buffer.close()
                    remove_file(input_path)
                    raise HTTPException(
                        status_code=413, detail="DOCX file exceeds maximum limit"
                    )
                buffer.write(chunk)

        if not validate_file_size(file_size):
            remove_file(input_path)
            raise HTTPException(status_code=413, detail="File size validation failed")

        pdf_path, user_profile_dir = await PDFService.convert_docx_to_pdf(input_path, OUTPUT_DIR)

        if not pdf_path or not os.path.exists(pdf_path):
            remove_file(input_path)
            if user_profile_dir:
                remove_directory(user_profile_dir)
            raise HTTPException(status_code=500, detail="Conversion failed")

        background_tasks.add_task(remove_file, input_path)
        background_tasks.add_task(remove_file, pdf_path)
        if user_profile_dir:
            background_tasks.add_task(remove_directory, user_profile_dir)

        return FileResponse(
            path=pdf_path,
            filename=f"{Path(sanitized_name).stem}.pdf",
            media_type="application/pdf",
        )

    except Exception as e:
        remove_file(input_path)
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail="Error during conversion")
        raise e


@router.post("/convert-ppt")
@limiter.limit("5/minute")
async def convert_ppt_to_pdf_endpoint(
    request: Request, background_tasks: BackgroundTasks, file: UploadFile = File(...)
):
    if not file.filename or not file.filename.lower().endswith((".ppt", ".pptx")):
        raise HTTPException(
            status_code=400, detail="Only .ppt and .pptx files are allowed"
        )

    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix.lower()
    sanitized_name = sanitize_filename(file.filename)
    max_size_ppt = int(os.getenv("MAX_PPT_SIZE_MB", "100")) * 1024 * 1024

    try:
        input_path = get_safe_file_path(UPLOAD_DIR, f"{file_id}{ext}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_size = 0
    try:
        chunk_size = 4 * 1024 * 1024
        with open(input_path, "wb", buffering=8 * 1024 * 1024) as buffer:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > max_size_ppt:
                    buffer.close()
                    remove_file(input_path)
                    raise HTTPException(
                        status_code=413, detail="PPT file exceeds maximum limit"
                    )
                buffer.write(chunk)

        if not validate_file_size(file_size):
            remove_file(input_path)
            raise HTTPException(status_code=413, detail="File size validation failed")

        pdf_path, user_profile_dir = await PDFService.convert_ppt_to_pdf(input_path, OUTPUT_DIR)

        if not pdf_path or not os.path.exists(pdf_path):
            remove_file(input_path)
            if user_profile_dir:
                remove_directory(user_profile_dir)
            raise HTTPException(status_code=500, detail="Conversion failed")

        background_tasks.add_task(remove_file, input_path)
        background_tasks.add_task(remove_file, pdf_path)
        if user_profile_dir:
            background_tasks.add_task(remove_directory, user_profile_dir)

        return FileResponse(
            path=pdf_path,
            filename=f"{Path(sanitized_name).stem}.pdf",
            media_type="application/pdf",
        )

    except Exception as e:
        remove_file(input_path)
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail="Error during conversion")
        raise e


@router.post("/convert-image")
@limiter.limit("10/minute")
async def convert_image_to_pdf_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    file_id = str(uuid.uuid4())
    output_path = get_safe_file_path(OUTPUT_DIR, f"combined_{file_id}.pdf")
    input_paths = []
    total_size = 0
    max_total_size = int(os.getenv("MAX_IMAGE_TOTAL_SIZE_MB", "100")) * 1024 * 1024

    try:
        for file in files:
            if not file.filename or not file.filename.lower().endswith(
                (".jpg", ".jpeg", ".png", ".webp")
            ):
                continue

            ext = Path(file.filename).suffix.lower()
            temp_path = get_safe_file_path(UPLOAD_DIR, f"{uuid.uuid4()}{ext}")

            with open(temp_path, "wb") as buffer:
                while True:
                    chunk = await file.read(4 * 1024 * 1024)
                    if not chunk:
                        break
                    total_size += len(chunk)

                    if total_size > max_total_size:
                        buffer.close()
                        remove_file(temp_path)
                        for p in input_paths:
                            remove_file(p)
                        raise HTTPException(
                            status_code=413, detail="Total images size exceeds limit"
                        )

                    buffer.write(chunk)

            if not validate_file_content(temp_path):
                remove_file(temp_path)
                continue

            input_paths.append(temp_path)

        if not input_paths:
            raise HTTPException(status_code=400, detail="No valid images uploaded")

        success = await PDFService.convert_image_to_pdf(input_paths, output_path)

        if not success:
            for p in input_paths:
                remove_file(p)
            raise HTTPException(status_code=500, detail="Image conversion failed")

        for p in input_paths:
            background_tasks.add_task(remove_file, p)
        background_tasks.add_task(remove_file, output_path)

        return FileResponse(
            path=output_path,
            filename="converted_images.pdf",
            media_type="application/pdf",
        )

    except Exception as e:
        for p in input_paths:
            remove_file(p)
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail="Internal server error")
        raise e


@router.post("/remove-bg")
@limiter.limit("10/minute")
async def remove_image_background(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(
            status_code=400, detail="Only .jpg, .jpeg, .png, and .webp are allowed"
        )

    file_id = str(uuid.uuid4())
    max_size = int(os.getenv("MAX_IMAGE_SIZE_MB", "20")) * 1024 * 1024
    sanitized_filename = sanitize_filename(file.filename)

    try:
        input_path = get_safe_file_path(UPLOAD_DIR, f"{file_id}{ext}")
        output_path = get_safe_file_path(OUTPUT_DIR, f"removed_bg_{file_id}.png")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_size = 0

    try:
        chunk_size = 4 * 1024 * 1024
        with open(input_path, "wb", buffering=8 * 1024 * 1024) as buffer:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > max_size:
                    buffer.close()
                    remove_file(input_path)
                    raise HTTPException(
                        status_code=413, detail="Image file exceeds maximum limit"
                    )
                buffer.write(chunk)

        if not validate_file_size(file_size):
            remove_file(input_path)
            raise HTTPException(status_code=413, detail="File size validation failed")

        if not validate_file_content(input_path):
            remove_file(input_path)
            raise HTTPException(status_code=400, detail="Invalid image content")

        with open(input_path, "rb") as image_file:
            result_bytes = await ImageService.remove_background(image_file.read())

        with open(output_path, "wb") as out:
            out.write(result_bytes)

    except Exception as e:
        remove_file(input_path)
        remove_file(output_path)
        if not isinstance(e, HTTPException):
            logger.error("Remove background failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to remove background")
        raise e

    background_tasks.add_task(remove_file, input_path)
    background_tasks.add_task(remove_file, output_path)

    return FileResponse(
        path=output_path,
        filename=f"{Path(sanitized_filename).stem}-transparent.png",
        media_type="image/png",
    )