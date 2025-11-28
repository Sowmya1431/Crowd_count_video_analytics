# Detection Speed & Accuracy Configuration Guide

## Quick Settings

### Current Configuration: **BALANCED**
- ✅ Model: `yolov8n.pt`
- ✅ Image Size: `640`
- ✅ Confidence: `0.35`
- ✅ IoU Threshold: `0.45`
- ✅ Half Precision: `True` (GPU only)

## How to Change Settings

Edit `Backend/app/routes/feeds_routes.py` in the `init_detector()` function (around line 95):

### Option 1: MAXIMUM SPEED 🚀
**Best for: Real-time webcam, fast processing, low-end hardware**

```python
model = YOLO("yolov8n.pt")  # Fastest model
results = model.predict(
    frame, 
    imgsz=480,        # ← Change to 480 or 320
    conf=0.25,        # ← Change to 0.25
    iou=0.45,
    verbose=False,
    half=torch.cuda.is_available(),
    device=device,
    agnostic_nms=False,
    max_det=300
)
```

**Expected Performance:**
- GPU: 30-50 FPS
- CPU: 8-15 FPS
- Accuracy: Good (might miss some small/distant people)

---

### Option 2: BALANCED ⚖️ (Current)
**Best for: Most use cases, good balance**

```python
model = YOLO("yolov8n.pt")  # Fast model
results = model.predict(
    frame, 
    imgsz=640,        # ← Standard size
    conf=0.35,        # ← Balanced threshold
    iou=0.45,
    verbose=False,
    half=torch.cuda.is_available(),
    device=device,
    agnostic_nms=False,
    max_det=300
)
```

**Expected Performance:**
- GPU: 20-35 FPS
- CPU: 5-10 FPS
- Accuracy: Very Good

---

### Option 3: MAXIMUM ACCURACY 🎯
**Best for: Critical applications, quality over speed**

```python
model = YOLO("yolov8m.pt")  # ← Change to medium or large model
results = model.predict(
    frame, 
    imgsz=640,        # ← Keep at 640 (or 1280 for extreme accuracy)
    conf=0.45,        # ← Higher confidence = fewer false positives
    iou=0.40,         # ← Stricter overlap threshold
    verbose=False,
    half=torch.cuda.is_available(),
    device=device,
    agnostic_nms=False,
    max_det=300
)
```

**Expected Performance:**
- GPU: 10-20 FPS (yolov8m), 5-15 FPS (yolov8l)
- CPU: 2-5 FPS (yolov8m), 1-3 FPS (yolov8l)
- Accuracy: Excellent (detects small/distant people better)

---

## Available YOLO Models

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| **yolov8n.pt** | 3.2 MB | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | Real-time, Webcam |
| **yolov8s.pt** | 11.2 MB | ⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | Balanced |
| **yolov8m.pt** | 25.9 MB | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | High accuracy |
| **yolov8l.pt** | 43.7 MB | ⚡⚡ | ⭐⭐⭐⭐⭐ | Best accuracy |
| **yolov8x.pt** | 68.2 MB | ⚡ | ⭐⭐⭐⭐⭐ | Maximum accuracy |

---

## Parameter Explanations

### `imgsz` - Image Size
- **320**: Maximum speed, lower accuracy (small people might be missed)
- **480**: Fast speed, good accuracy (current speed mode)
- **640**: Standard size, balanced (current balanced mode)
- **1280**: Slow, excellent for small/distant objects

### `conf` - Confidence Threshold
- **0.20**: More detections, more false positives
- **0.25**: Good for crowded scenes (speed mode)
- **0.35**: Balanced - recommended (current)
- **0.45**: Fewer false positives, might miss some people
- **0.60**: Very strict, only very confident detections

### `iou` - IoU Threshold (Non-Maximum Suppression)
- **0.40**: Stricter, fewer overlapping boxes (accuracy mode)
- **0.45**: Balanced (current)
- **0.50**: More permissive, more boxes in crowded areas

### `half` - Half Precision (FP16)
- **True**: 2x faster on GPU, same accuracy
- **False**: Full precision, slower but works on all devices

### `max_det` - Maximum Detections
- **100**: Fewer boxes, faster (for sparse crowds)
- **300**: Balanced (current)
- **1000**: For very dense crowds

---

## Quick Recommendations

### For Webcam / Live Feeds:
```python
model = YOLO("yolov8n.pt")
imgsz=480
conf=0.25
```

### For Uploaded Videos (Quality Matters):
```python
model = YOLO("yolov8s.pt")  # or yolov8m.pt
imgsz=640
conf=0.35
```

### For Dense Crowds:
```python
model = YOLO("yolov8n.pt")
imgsz=640
conf=0.30
max_det=500
```

---

## Testing Your Changes

1. Edit `feeds_routes.py` with your chosen settings
2. Restart the Flask backend: `python run.py`
3. Upload a test video or use webcam
4. Check FPS and detection quality
5. Adjust parameters if needed

---

## GPU vs CPU Performance

| Configuration | GPU (NVIDIA) | CPU (Modern) |
|---------------|--------------|--------------|
| yolov8n + 480 | 40-50 FPS | 10-15 FPS |
| yolov8n + 640 | 25-35 FPS | 6-10 FPS |
| yolov8s + 640 | 20-30 FPS | 4-7 FPS |
| yolov8m + 640 | 12-18 FPS | 2-4 FPS |

**Note:** GPU with `half=True` provides ~2x speedup with same accuracy!

---

## Troubleshooting

### Detection too slow?
- Switch to `yolov8n.pt`
- Lower `imgsz` to 480 or 320
- Lower `conf` to 0.25

### Missing people in crowd?
- Increase model size to `yolov8s.pt` or `yolov8m.pt`
- Keep `imgsz=640`
- Lower `conf` to 0.25-0.30

### Too many false positives?
- Increase `conf` to 0.40-0.50
- Lower `iou` to 0.40
- Use larger model (yolov8s or yolov8m)

### Want best possible accuracy?
- Use `yolov8m.pt` or `yolov8l.pt`
- Set `imgsz=640` or `1280`
- Set `conf=0.40`
- Set `iou=0.40`
