"""
Antrian job konversi in-memory.

Konversi LibreOffice untuk dokumen besar sering melewati batas timeout HTTP
(dan proxy di depannya). Endpoint konversi karena itu bisa dijalankan dalam
mode async: request mengembalikan job_id, frontend melakukan polling status,
dan hasil diunduh terpisah. Job juga bisa dibatalkan di tengah jalan.

Catatan: penyimpanan bersifat per-proses. Kalau backend nanti diskalakan ke
banyak worker, store ini perlu dipindah ke Redis.
"""

import asyncio
import logging
import os
import shutil
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

logger = logging.getLogger(__name__)

JOB_TTL_SECONDS = int(os.getenv("JOB_TTL_SECONDS", "1800"))  # 30 menit
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "4"))

STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_ERROR = "error"
STATUS_CANCELLED = "cancelled"


@dataclass
class ConversionJob:
    id: str
    name: str
    status: str = STATUS_QUEUED
    progress: int = 0
    message: str = "Menunggu antrian"
    error: Optional[str] = None
    result_path: Optional[str] = None
    result_filename: Optional[str] = None
    media_type: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    # Berkas/direktori sementara yang dihapus saat job dibersihkan
    cleanup_paths: list[str] = field(default_factory=list)
    task: Optional[asyncio.Task] = field(default=None, repr=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.id,
            "name": self.name,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
            "filename": self.result_filename,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
        }


class JobStore:
    def __init__(self):
        self._jobs: dict[str, ConversionJob] = {}
        self._semaphore: Optional[asyncio.Semaphore] = None

    def _get_semaphore(self) -> asyncio.Semaphore:
        # Dibuat lazily supaya terikat ke event loop yang sedang berjalan
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
        return self._semaphore

    def create(
        self,
        name: str,
        runner: Callable[[ConversionJob], Awaitable[None]],
        cleanup_paths: Optional[list[str]] = None,
    ) -> ConversionJob:
        self.purge_expired()

        job = ConversionJob(id=uuid.uuid4().hex, name=name)
        job.cleanup_paths = list(cleanup_paths or [])
        self._jobs[job.id] = job
        job.task = asyncio.create_task(self._run(job, runner))
        logger.info(f"Job dibuat: {job.id} ({name})")
        return job

    async def _run(
        self, job: ConversionJob, runner: Callable[[ConversionJob], Awaitable[None]]
    ):
        try:
            async with self._get_semaphore():
                job.status = STATUS_RUNNING
                job.progress = 5
                job.message = "Memproses"
                await runner(job)

            if job.status == STATUS_RUNNING:
                job.status = STATUS_DONE
                job.progress = 100
                job.message = "Selesai"
        except asyncio.CancelledError:
            job.status = STATUS_CANCELLED
            job.message = "Dibatalkan"
            self._remove_files(job)
            raise
        except Exception as e:
            logger.error(f"Job {job.id} gagal: {e}", exc_info=True)
            job.status = STATUS_ERROR
            job.error = str(e)
            job.message = "Gagal"
            self._remove_files(job)
        finally:
            job.finished_at = time.time()

    def get(self, job_id: str) -> Optional[ConversionJob]:
        return self._jobs.get(job_id)

    async def cancel(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if not job or job.status in (STATUS_DONE, STATUS_ERROR, STATUS_CANCELLED):
            return False

        if job.task:
            job.task.cancel()
            try:
                await job.task
            except (asyncio.CancelledError, Exception):
                pass

        job.status = STATUS_CANCELLED
        job.message = "Dibatalkan"
        return True

    def finish(
        self,
        job: ConversionJob,
        result_path: str,
        result_filename: str,
        media_type: str,
    ):
        job.result_path = result_path
        job.result_filename = result_filename
        job.media_type = media_type
        job.progress = 100
        job.message = "Selesai"
        job.status = STATUS_DONE

    def purge_expired(self):
        now = time.time()
        expired = [
            job_id
            for job_id, job in self._jobs.items()
            if job.finished_at and now - job.finished_at > JOB_TTL_SECONDS
        ]

        for job_id in expired:
            job = self._jobs.pop(job_id, None)
            if job:
                self._remove_files(job, include_result=True)
                logger.info(f"Job kedaluwarsa dibersihkan: {job_id}")

    def _remove_files(self, job: ConversionJob, include_result: bool = False):
        paths = list(job.cleanup_paths)
        if include_result and job.result_path:
            paths.append(job.result_path)

        for path in paths:
            try:
                if not path or not os.path.exists(path):
                    continue
                if os.path.isdir(path):
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    os.remove(path)
            except Exception as e:
                logger.error(f"Gagal membersihkan {path}: {e}")


job_store = JobStore()
