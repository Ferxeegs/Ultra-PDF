import asyncio
import io
import logging
import os
from functools import lru_cache

from rembg import new_session, remove
from PIL import Image

logger = logging.getLogger(__name__)


def _execution_providers() -> list[str]:
    """
    Default: CPU only — avoids native crashes / ERR_EMPTY_RESPONSE when CUDA
    is missing or mismatched (onnxruntime-gpu without matching driver/cuDNN).

    Set REMBG_USE_CUDA=1 to prefer CUDA (requires onnxruntime-gpu + working GPU stack).
    """
    if os.getenv("REMBG_USE_CUDA", "").strip().lower() in ("1", "true", "yes", "on"):
        return ["CUDAExecutionProvider", "CPUExecutionProvider"]
    return ["CPUExecutionProvider"]


def _u2net_home() -> str:
    return os.getenv("U2NET_HOME", "/app/.u2net")


def _model_filename(model_name: str) -> str:
    return f"{model_name}.onnx"


def _is_local_model_available(model_name: str) -> bool:
    return os.path.exists(os.path.join(_u2net_home(), _model_filename(model_name)))


@lru_cache(maxsize=4)
def _get_session(model_name: str):
    """
    Create singleton rembg session by model.
    GPU only when REMBG_USE_CUDA=1 and onnxruntime-gpu is installed.
    """
    providers = _execution_providers()

    logger.info(
        "Initializing rembg session with model=%s providers=%s",
        model_name,
        providers,
    )
    return new_session(model_name=model_name, providers=providers)


class ImageService:
    @staticmethod
    async def remove_background(image_bytes: bytes) -> bytes:
        if not image_bytes:
            raise ValueError("Empty image bytes")

        def _process() -> bytes:
            preferred_model = os.getenv("REMBG_MODEL_NAME", "u2net")
            max_side = int(os.getenv("REMBG_MAX_SIDE", "1600"))
            image_data = image_bytes

            # Resize gambar besar untuk menurunkan beban CPU/RAM saat inferensi.
            with Image.open(io.BytesIO(image_bytes)) as img:
                width, height = img.size
                longest_side = max(width, height)
                if longest_side > max_side:
                    ratio = max_side / float(longest_side)
                    new_size = (max(1, int(width * ratio)), max(1, int(height * ratio)))
                    resized = img.resize(new_size, Image.LANCZOS)
                    buffer = io.BytesIO()
                    # PNG menjaga detail untuk segmentasi foreground.
                    resized.save(buffer, format="PNG")
                    image_data = buffer.getvalue()

            # Prioritas: model lokal lebih dulu (cepat dan konsisten).
            model_candidates = [preferred_model, "u2net", "u2netp"]
            model_candidates = list(dict.fromkeys(model_candidates))

            selected_model = next(
                (m for m in model_candidates if _is_local_model_available(m)),
                None,
            )

            if not selected_model:
                logger.warning(
                    "No local rembg model found in '%s'. Trying online fetch for model '%s'.",
                    _u2net_home(),
                    preferred_model,
                )
                try:
                    session = _get_session(preferred_model)
                except Exception as exc:
                    raise RuntimeError(
                        "No local rembg model found and online model download failed. "
                        f"Place u2net.onnx or u2netp.onnx in '{_u2net_home()}', "
                        "or ensure container DNS/internet works."
                    ) from exc
            else:
                session = _get_session(selected_model)

            output = remove(image_data, session=session, force_return_bytes=True)
            if isinstance(output, bytes):
                return output
            if hasattr(output, "read"):
                return output.read()
            if isinstance(output, io.BytesIO):
                return output.getvalue()
            raise ValueError("Failed to process image")

        return await asyncio.to_thread(_process)
