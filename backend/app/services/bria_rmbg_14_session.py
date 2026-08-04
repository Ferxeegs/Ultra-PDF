import os
from typing import List

import numpy as np
import pooch
from PIL import Image
from PIL.Image import Image as PILImage

from rembg.sessions.base import BaseSession

MODEL_URL = "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx"
MODEL_SHA256 = "sha256:8cafcf770b06757c4eaced21b1a88e57fd2b66de01b8045f35f01535ba742e0f"
INPUT_SIZE = (1024, 1024)
MEAN = np.array([0.5, 0.5, 0.5], dtype=np.float32)
STD = np.array([1.0, 1.0, 1.0], dtype=np.float32)


class BriaRmBg14Session(BaseSession):
    """BRIA RMBG v1.4 — preprocessing/postprocessing per official HuggingFace utilities."""

    def predict(self, img: PILImage, *args, **kwargs) -> List[PILImage]:
        orig_size = img.size

        im = img.convert("RGB").resize(INPUT_SIZE, Image.Resampling.LANCZOS)
        im_ary = np.array(im, dtype=np.float32)
        if im_ary.ndim == 2:
            im_ary = im_ary[:, :, np.newaxis]

        im_ary = im_ary / 255.0
        im_ary = (im_ary - MEAN) / STD
        im_tensor = im_ary.transpose(2, 0, 1)
        input_name = self.inner_session.get_inputs()[0].name

        ort_outs = self.inner_session.run(
            None,
            {input_name: np.expand_dims(im_tensor, 0).astype(np.float32)},
        )

        pred = ort_outs[0][:, 0, :, :]
        ma = np.max(pred)
        mi = np.min(pred)
        pred = (pred - mi) / (ma - mi + 1e-8)
        pred = np.squeeze(pred)

        # Sigmoid contrast enhancement — pushes soft background (0.1-0.4)
        # toward 0 and soft foreground (0.6-0.9) toward 1.0.
        # This eliminates semi-transparent background residue that otherwise
        # survives all downstream refinement.
        gain = 10.0   # steepness of the sigmoid curve
        cutoff = 0.5  # center point (pixels below → suppressed, above → boosted)
        pred = 1.0 / (1.0 + np.exp(-gain * (pred - cutoff)))

        mask = Image.fromarray((pred * 255).astype("uint8"), mode="L")
        mask = mask.resize(orig_size, Image.Resampling.LANCZOS)

        return [mask]

    @classmethod
    def download_models(cls, *args, **kwargs):
        fname = f"{cls.name(*args, **kwargs)}.onnx"
        pooch.retrieve(
            MODEL_URL,
            None if cls.checksum_disabled(*args, **kwargs) else MODEL_SHA256,
            fname=fname,
            path=cls.u2net_home(*args, **kwargs),
            progressbar=True,
        )
        return os.path.join(cls.u2net_home(*args, **kwargs), fname)

    @classmethod
    def name(cls, *args, **kwargs):
        return "bria-rmbg-1.4"
