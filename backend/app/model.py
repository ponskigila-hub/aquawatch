from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import ResNet18_Weights, resnet18


class ResNet18Heatmap(nn.Module):
    """ResNet18 encoder plus a task-specific dense prediction head.

    ImageNet weights initialize the encoder. For real weather forecasting, the
    dense head (and ideally the backbone) must be fine-tuned on gridded,
    time-labelled meteorological data and loaded from a task checkpoint.
    """

    def __init__(self, pretrained: bool = True) -> None:
        super().__init__()
        weights = ResNet18_Weights.DEFAULT if pretrained else None
        backbone = resnet18(weights=weights)
        self.encoder = nn.Sequential(*list(backbone.children())[:-2])
        self.decoder = nn.Sequential(
            # Two conditioning channels: normalized lead time and target type.
            nn.Conv2d(514, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 1, kernel_size=1),
        )

    def forward(
        self,
        x: torch.Tensor,
        output_size: tuple[int, int],
        horizon_hours: int,
        variable: str,
    ) -> torch.Tensor:
        features = self.encoder(x)
        lead_plane = features.new_full(
            (features.shape[0], 1, features.shape[2], features.shape[3]),
            float(horizon_hours) / 240.0,
        )
        variable_plane = features.new_full(
            (features.shape[0], 1, features.shape[2], features.shape[3]),
            1.0 if variable == "anomaly" else 0.0,
        )
        logits = self.decoder(torch.cat((features, lead_plane, variable_plane), dim=1))
        return F.interpolate(logits, size=output_size, mode="bilinear", align_corners=False).sigmoid()


class SpatialForecaster:
    """CPU-first raster inference wrapper with checkpoint/pretrained status."""

    def __init__(self) -> None:
        # Ensure repeatable fallback visuals across local runs. This is NOT
        # a substitute for training or scientific validation.
        torch.manual_seed(42)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        checkpoint_path = os.getenv("AQUAWATCH_MODEL_CHECKPOINT", "").strip()
        download_pretrained = os.getenv("AQUAWATCH_DOWNLOAD_PRETRAINED", "true").lower() in {"1", "true", "yes"}
        self.model: ResNet18Heatmap
        self.pretrained_loaded = False
        self.checkpoint_loaded = False
        self.load_warning: str | None = None

        try:
            # Use the standard ImageNet pretrained encoder by default. If the
            # host is offline and weights are not cached, continue in demo mode.
            self.model = ResNet18Heatmap(pretrained=download_pretrained)
            self.pretrained_loaded = download_pretrained
        except Exception as exc:
            self.load_warning = f"Could not load pretrained ResNet18 weights ({type(exc).__name__}); initialized an untrained backbone for demo use."
            self.model = ResNet18Heatmap(pretrained=False)

        if checkpoint_path:
            path = Path(checkpoint_path).expanduser()
            if not path.is_file():
                raise FileNotFoundError(f"AQUAWATCH_MODEL_CHECKPOINT does not exist: {path}")
            checkpoint = torch.load(path, map_location="cpu", weights_only=True)
            state_dict = checkpoint.get("state_dict", checkpoint) if isinstance(checkpoint, dict) else checkpoint
            self.model.load_state_dict(state_dict, strict=True)
            self.checkpoint_loaded = True

        self.model.to(self.device).eval()

    @property
    def model_status(self) -> str:
        if self.checkpoint_loaded:
            return "fine_tuned_checkpoint_loaded"
        if self.pretrained_loaded:
            return "pretrained_encoder_untrained_forecast_head"
        return "untrained_demo_model"

    def predict(self, spatial_data: np.ndarray, horizon_hours: int, variable: str) -> np.ndarray:
        if spatial_data.ndim != 2:
            raise ValueError("Expected a two-dimensional H x W spatial array")
        values = np.asarray(spatial_data, dtype=np.float32)
        if not np.isfinite(values).all():
            raise ValueError("Spatial data must contain only finite values")

        minimum, maximum = float(values.min()), float(values.max())
        if maximum - minimum < 1e-8:
            normalized = np.zeros_like(values, dtype=np.float32)
        else:
            normalized = (values - minimum) / (maximum - minimum)

        # ResNet18 accepts 3-channel images; replicate the scalar weather field.
        image = torch.from_numpy(normalized)[None, None, :, :].repeat(1, 3, 1, 1)
        image = F.interpolate(image, size=(224, 224), mode="bilinear", align_corners=False)
        mean = torch.tensor([0.485, 0.456, 0.406], device=image.device).view(1, 3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225], device=image.device).view(1, 3, 1, 1)
        image = ((image - mean) / std).to(self.device)

        with torch.inference_mode():
            prediction = self.model(
                image,
                output_size=values.shape,
                horizon_hours=horizon_hours,
                variable=variable,
            )[0, 0]
        result = prediction.detach().cpu().numpy().astype(np.float32)
        return np.clip(result, 0.0, 1.0)
