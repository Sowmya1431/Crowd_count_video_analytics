import os
import time
import json
import cv2
import numpy as np
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file, current_app, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from app.database.connection import mongo
import traceback
import logging
import io
from gridfs import GridFS
from werkzeug.utils import secure_filename

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to use YOLO if installed
try:
    from ultralytics import YOLO
    import torch
    YOLO_AVAILABLE = True
except Exception:
    YOLO_AVAILABLE = False

feeds_bp = Blueprint("feeds", __name__)

# GridFS for storing videos in MongoDB
fs = None

def init_gridfs():
    """Initialize GridFS connection."""
    global fs
    if fs is None:
        try:
            fs = GridFS(mongo.db)
            logger.info("[GridFS] ✅ GridFS initialized successfully")
        except Exception as e:
            logger.error(f"[GridFS] ❌ Failed to initialize: {e}")
            raise

# Temporary directories for processing
TEMP_DIR = os.path.join(os.getcwd(), "temp_processing")
PREVIEW_DIR = os.path.join(os.getcwd(), "temp_previews")
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)


# ========================================
# DETECTION OPTIMIZATION GUIDE
# ========================================
# 
# SPEED PRIORITY (Fast processing, good accuracy):
#   - Model: yolov8n.pt
#   - imgsz: 480 or 320
#   - conf: 0.25
#   - iou: 0.45
#   - half: True (if GPU available)
#   - Processing: ~30-50 FPS on GPU, ~8-15 FPS on CPU
#
# BALANCED (Good speed, good accuracy) - CURRENT:
#   - Model: yolov8n.pt or yolov8s.pt
#   - imgsz: 640
#   - conf: 0.35
#   - iou: 0.45
#   - half: True (if GPU available)
#   - Processing: ~20-35 FPS on GPU, ~5-10 FPS on CPU
#
# ACCURACY PRIORITY (Best accuracy, slower):
#   - Model: yolov8m.pt or yolov8l.pt
#   - imgsz: 640 or 1280
#   - conf: 0.45
#   - iou: 0.40
#   - half: True (if GPU available)
#   - Processing: ~10-20 FPS on GPU, ~2-5 FPS on CPU
#
# MODEL SIZES (download automatically on first use):
#   - yolov8n.pt: 3.2 MB  - Fastest
#   - yolov8s.pt: 11.2 MB - Small
#   - yolov8m.pt: 25.9 MB - Medium
#   - yolov8l.pt: 43.7 MB - Large
#   - yolov8x.pt: 68.2 MB - Extra Large (best accuracy)
#
# ========================================

# -------------------------
# YOLO or HOG detector initialization
# -------------------------
def init_detector():
    """Initialize YOLOv8 or fallback to HOG detector."""
    if YOLO_AVAILABLE:
        try:
            # SPEED vs ACCURACY: Choose model based on your needs
            # yolov8n.pt - Fastest, good accuracy (current)
            # yolov8s.pt - Slightly slower, better accuracy
            # yolov8m.pt - Balanced speed and accuracy
            # yolov8l.pt - Slower, high accuracy
            model = YOLO("yolov8n.pt")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model.to(device)
            logger.info(f"[Detector] ✅ YOLOv8 model loaded on {device}")

            def detect(frame):
                try:
                    # Optimized settings for SPEED and ACCURACY balance
                    results = model.predict(
                        frame, 
                        imgsz=640,  # Image size: 640 for better accuracy, 480 for speed, 320 for max speed
                        conf=0.30,  # Confidence threshold: 0.30 for better detection (was 0.35)
                        iou=0.45,   # IoU threshold for NMS: lower = fewer overlapping boxes
                        verbose=False,
                        half=torch.cuda.is_available(),  # Use FP16 on GPU for 2x speed boost
                        device=device,
                        agnostic_nms=False,  # Class-agnostic NMS (faster)
                        max_det=300  # Maximum detections per image
                    )
                    boxes = []
                    for r in results:
                        if not hasattr(r, "boxes") or r.boxes is None:
                            continue
                        for box in r.boxes:
                            try:
                                cls_id = int(box.cls.cpu().numpy())
                            except Exception:
                                try:
                                    cls_id = int(np.array(box.cls).item())
                                except:
                                    cls_id = None
                            
                            label = model.names.get(cls_id, str(cls_id)) if cls_id is not None else None
                            if label and label.lower() == "person":
                                try:
                                    xyxy = box.xyxy[0].cpu().numpy()
                                except:
                                    xyxy = np.array(box.xyxy[0])
                                x1, y1, x2, y2 = map(int, map(float, xyxy))
                                boxes.append((x1, y1, x2, y2))
                    return boxes
                except Exception as e:
                    logger.warning(f"Detection error: {e}")
                    return []

            return detect

        except Exception as e:
            logger.error(f"[Detector] ⚠️ YOLO initialization failed: {e}")
            traceback.print_exc()

    # Fallback to HOG detector
    logger.info("[Detector] ⚙️ Using fallback HOG detector")
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

    def detect(frame):
        try:
            rects, _ = hog.detectMultiScale(frame, winStride=(8, 8), padding=(4, 4), scale=1.05)
            return [(int(x), int(y), int(x + w), int(y + h)) for (x, y, w, h) in rects]
        except Exception as e:
            logger.warning(f"HOG detection error: {e}")
            return []

    return detect


DETECTOR = init_detector()


# -------------------------
# Helper Functions
# -------------------------
def _get_email_from_jwt():
    """Extract email from JWT identity."""
    try:
        ident = get_jwt_identity()
        if isinstance(ident, str):
            return ident
        if isinstance(ident, dict):
            return ident.get("email")
    except Exception as e:
        logger.error(f"JWT extraction error: {e}")
    return None


def _is_admin_email(email):
    """Check whether given email is admin by consulting users collection."""
    try:
        user = mongo.db.users.find_one({"email": email})
        return bool(user and user.get("role") == "admin")
    except Exception:
        return False


def _boxes_to_serializable(boxes):
    """Convert boxes to list of [x1,y1,x2,y2] ints for JSON/Mongo storage."""
    out = []
    for b in boxes:
        try:
            x1, y1, x2, y2 = b
            out.append([int(x1), int(y1), int(x2), int(y2)])
        except Exception:
            continue
    return out


def _is_point_in_polygon(point, polygon):
    """Check if a point (x, y) is inside a polygon."""
    try:
        poly_array = np.array(polygon, dtype=np.int32)
        result = cv2.pointPolygonTest(poly_array, point, False)
        return result >= 0
    except Exception as e:
        logger.warning(f"Point in polygon test failed: {e}")
        return False


def cleanup_temp_file(filepath):
    """Safely remove temporary file."""
    try:
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
            logger.debug(f"[Cleanup] Removed temp file: {filepath}")
    except Exception as e:
        logger.warning(f"[Cleanup] Failed to remove {filepath}: {e}")


# -------------------------
# Helper: Check if box is in zone
# -------------------------
def _is_box_in_zone(box, polygon):
    """Check if bounding box center is inside the polygon zone."""
    try:
        x1, y1, x2, y2 = box
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
        return _is_point_in_polygon((center_x, center_y), polygon)
    except Exception:
        return False


# -------------------------
# FEED upload (stores in MongoDB GridFS, NO auto-analysis)
# -------------------------
@feeds_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_video():
    """Handle video upload and store in MongoDB GridFS. Detection happens later after zones are defined."""
    init_gridfs()
    
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    if "video" not in request.files:
        return jsonify({"error": "No video file uploaded"}), 400

    video_file = request.files["video"]
    feed_name = request.form.get("feed_name", "").strip()
    
    if not video_file or video_file.filename == "":
        return jsonify({"error": "No video file selected"}), 400
    
    ext = os.path.splitext(video_file.filename)[1].lower()
    if ext not in [".mp4", ".avi", ".mov", ".mkv", ".webm"]:
        return jsonify({"error": "Invalid file type. Supported: mp4, avi, mov, mkv, webm"}), 400

    if not feed_name:
        feed_name = os.path.splitext(video_file.filename)[0]

    timestamp = int(time.time())
    safe_basename = "".join(c for c in feed_name if c.isalnum() or c in (' ', '-', '_')).strip()
    if not safe_basename:
        safe_basename = "video"
    filename = f"{safe_basename}_{timestamp}{ext}"

    temp_path = None
    video_id = None

    try:
        # Read video file into memory
        logger.info(f"[Upload] Reading video file: {video_file.filename}")
        video_bytes = video_file.read()
        
        if len(video_bytes) == 0:
            return jsonify({"error": "Empty video file"}), 400
        
        logger.info(f"[Upload] Video size: {len(video_bytes)} bytes")
        
        # Store in GridFS
        video_id = fs.put(
            video_bytes,
            filename=filename,
            content_type=video_file.content_type or 'video/mp4',
            upload_date=datetime.utcnow(),
            metadata={
                "owner": current_user_email,
                "original_filename": video_file.filename,
                "feed_name": feed_name
            }
        )
        
        logger.info(f"[Upload] ✅ Video stored in GridFS: {filename} (ID: {video_id})")
    except Exception as e:
        logger.error(f"[Upload] Failed to store video in GridFS: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to save video: {str(e)}"}), 500

    # Extract video metadata for frontend
    try:
        # Ensure temp directory exists
        os.makedirs(TEMP_DIR, exist_ok=True)
        
        # Save temporarily for OpenCV processing
        temp_path = os.path.join(TEMP_DIR, f"temp_{filename}")
        logger.info(f"[Upload] Saving temp file to: {temp_path}")
        
        with open(temp_path, 'wb') as f:
            f.write(video_bytes)
        
        logger.info(f"[Upload] Extracting video metadata: {temp_path}")
        cap = cv2.VideoCapture(temp_path)
        
        if not cap.isOpened():
            raise Exception("Could not open video file")
            
    except Exception as e:
        logger.error(f"[Upload] Failed to process video: {e}")
        traceback.print_exc()
        cleanup_temp_file(temp_path)
        
        # Delete from GridFS if upload failed
        if video_id:
            try:
                fs.delete(video_id)
            except:
                pass
        
        return jsonify({"error": f"Could not process video: {str(e)}"}), 500

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if width == 0 or height == 0:
        width, height = int(cap.get(3)), int(cap.get(4))
    
    if width == 0 or height == 0:
        width, height = 640, 480  # Default fallback
    
    # Extract first frame for preview (base64 encoded)
    ret, first_frame = cap.read()
    first_frame_base64 = None
    if ret and first_frame is not None:
        try:
            import base64
            _, buffer = cv2.imencode('.jpg', first_frame)
            first_frame_base64 = base64.b64encode(buffer).decode('utf-8')
        except Exception as e:
            logger.warning(f"[Upload] Failed to encode first frame: {e}")
    
    # Generate detections for video playback
    logger.info(f"[Upload] Generating detections for video playback...")
    detections_cache = []
    try:
        cap2 = cv2.VideoCapture(temp_path)
        frame_idx = 0
        frame_step = max(1, int(fps / 5))  # Sample at 5 fps for performance
        
        while True:
            ret, frame = cap2.read()
            if not ret:
                break
            
            if frame_idx % frame_step == 0:
                try:
                    boxes = DETECTOR(frame)
                    timestamp = frame_idx / fps
                    detections_cache.append({
                        "timestamp": timestamp,
                        "frame": frame_idx,
                        "boxes": _boxes_to_serializable(boxes)
                    })
                except Exception as e:
                    logger.warning(f"Detection error at frame {frame_idx}: {e}")
            
            frame_idx += 1
            
            # Show progress every 100 frames
            if frame_idx % 100 == 0:
                logger.info(f"[Upload] Processed {frame_idx}/{total_frames} frames...")
        
        cap2.release()
        logger.info(f"[Upload] ✅ Generated {len(detections_cache)} detection samples")
    except Exception as e:
        logger.error(f"[Upload] Failed to generate detections: {e}")
        detections_cache = []
    
    cap.release()
    cleanup_temp_file(temp_path)
    
    duration = round(total_frames / fps, 2) if total_frames > 0 and fps > 0 else 0.0
    
    logger.info(f"[Upload] Video properties - FPS: {fps}, Size: {width}x{height}, Frames: {total_frames}, Duration: {duration}s")

    feed_doc = {
        "email": current_user_email,
        "feed_name": feed_name,
        "filename": filename,
        "video_id": video_id,  # GridFS file ID
        "upload_time": datetime.utcnow(),
        "video_metadata": {
            "width": width,
            "height": height,
            "fps": float(fps),
            "total_frames": total_frames,
            "duration": duration
        },
        "zones": [],
        "detections_cache": detections_cache,  # Populated during upload for video playback
        "analysis_history": [],  # Store all zone analyses
        "first_frame": first_frame_base64
    }

    try:
        res = mongo.db.feeds.insert_one(feed_doc)
        feed_id = str(res.inserted_id)
        logger.info(f"[Upload] ✅ Feed created: {feed_id}")
    except Exception as e:
        logger.error(f"[Upload] DB insert failed: {e}")
        traceback.print_exc()
        
        # Delete from GridFS if DB insert failed
        if video_id:
            try:
                fs.delete(video_id)
            except:
                pass
        
        return jsonify({"error": "Database insert failed"}), 500

    return jsonify({
        "message": "Video uploaded successfully. Draw zones and analyze.",
        "feed_id": feed_id,
        "feed_name": feed_name,
        "video_metadata": feed_doc["video_metadata"],
        "first_frame": first_frame_base64
    }), 200


# -------------------------
# Stream Video from GridFS
# -------------------------
@feeds_bp.route("/video/<feed_id>", methods=["GET"])
@jwt_required(optional=True)
def serve_video(feed_id):
    """Serve video from GridFS with streaming support."""
    init_gridfs()
    
    # Try to get user from JWT or query parameter
    current_user_email = _get_email_from_jwt()
    
    # If no JWT in header, check for token in query param
    if not current_user_email:
        from flask_jwt_extended import decode_token
        token = request.args.get('token')
        if token:
            try:
                decoded = decode_token(token)
                identity = decoded.get('sub')
                if isinstance(identity, str):
                    current_user_email = identity
                elif isinstance(identity, dict):
                    current_user_email = identity.get('email')
            except Exception as e:
                logger.warning(f"Token decode error: {e}")
    
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    video_id = feed_obj.get("video_id")
    if not video_id:
        return jsonify({"error": "Video not found"}), 404

    try:
        grid_out = fs.get(video_id)
        
        def generate():
            try:
                while True:
                    chunk = grid_out.read(1024 * 1024)  # 1MB chunks
                    if not chunk:
                        break
                    yield chunk
            except Exception as e:
                logger.error(f"[Video] Streaming error: {e}")
        
        response = Response(
            generate(),
            mimetype=grid_out.content_type or 'video/mp4',
            headers={
                'Content-Disposition': f'inline; filename="{grid_out.filename}"',
                'Accept-Ranges': 'bytes',
                'Content-Length': str(grid_out.length)
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"[Video] Error serving video: {e}")
        traceback.print_exc()
        return jsonify({"error": "Could not load video"}), 500


# -------------------------
# List Feeds
# -------------------------
@feeds_bp.route("", methods=["GET"])
@jwt_required()
def list_feeds():
    """List all feeds for the current user."""
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        docs = mongo.db.feeds.find(
            {"email": current_user_email},
            {"detections_cache": 0}
        ).sort("upload_time", -1)
    except Exception as e:
        logger.error(f"[List] DB query failed: {e}")
        return jsonify({"error": "Database query failed"}), 500

    feeds = []
    for f in docs:
        try:
            feeds.append({
                "_id": str(f.get("_id")),
                "feed_name": f.get("feed_name", f.get("filename", "Untitled")),
                "filename": f.get("filename"),
                "upload_time": f.get("upload_time").isoformat() if f.get("upload_time") else None,
                "summary": f.get("summary", {}),
                "zones": f.get("zones", []),
                "zone_count": len(f.get("zones", [])),
                "has_video": bool(f.get("video_id")),
                "status": f.get("status", "ready"),  # Include processing status
                "status_error": f.get("status_error")  # Include any error message
            })
        except Exception as e:
            logger.warning(f"[List] Error processing feed: {e}")
            continue
    
    logger.info(f"[List] Returned {len(feeds)} feeds for {current_user_email}")
    return jsonify({"feeds": feeds}), 200


# -------------------------
# Get Specific Feed
# -------------------------
@feeds_bp.route("/<feed_id>", methods=["GET"])
@jwt_required()
def get_feed(feed_id):
    """Get a specific feed by ID."""
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        feed_obj = mongo.db.feeds.find_one(
            {"_id": ObjectId(feed_id)},
            {"detections_cache": 0}
        )
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    try:
        feed_data = {
            "_id": str(feed_obj.get("_id")),
            "feed_name": feed_obj.get("feed_name", feed_obj.get("filename", "Untitled")),
            "filename": feed_obj.get("filename"),
            "upload_time": feed_obj.get("upload_time").isoformat() if feed_obj.get("upload_time") else None,
            "summary": feed_obj.get("summary", {}),
            "zones": feed_obj.get("zones", []),
            "video_metadata": feed_obj.get("video_metadata", {}),
            "analysis_history": feed_obj.get("analysis_history", []),
            "status": feed_obj.get("status", "ready"),  # Include processing status
            "status_error": feed_obj.get("status_error")  # Include any error message
        }
    except Exception as e:
        logger.error(f"[Feed] Error preparing feed data: {e}")
        return jsonify({"error": "Error loading feed data"}), 500

    return jsonify({"feed": feed_data}), 200


# -------------------------
# Return raw detections cache for a feed
# -------------------------
@feeds_bp.route("/<feed_id>/detections", methods=["GET"])
@jwt_required()
def get_detections(feed_id):
    """Return cached detections for a feed (used by frontend for live playback counts)."""
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    detections_cache = feed_obj.get("detections_cache", [])

    # Return minimal detection info (frame, timestamp, boxes)
    return jsonify({"detections": detections_cache}), 200


# -------------------------
# ZONE CRUD
# -------------------------
@feeds_bp.route("/<feed_id>/zones", methods=["POST"])
@jwt_required()
def create_zone(feed_id):
    """Create a new zone for a feed."""
    data = request.get_json() or {}
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    zone_name = data.get("zone_name", "").strip()
    polygon = data.get("polygon")
    
    if not polygon or len(polygon) < 3:
        return jsonify({"error": "Polygon must contain at least 3 points"}), 400

    try:
        polygon = [[int(x), int(y)] for x, y in polygon]
    except Exception:
        return jsonify({"error": "Invalid polygon format. Expected [[x,y], [x,y], ...]"}), 400

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    zone_id = str(ObjectId())
    zone_doc = {
        "zone_id": zone_id,
        "zone_name": zone_name or f"Zone-{zone_id[-6:]}",
        "polygon": polygon,
        "created_at": datetime.utcnow(),
        "total_count": 0,
        "last_analysis": None
    }

    try:
        mongo.db.feeds.update_one(
            {"_id": ObjectId(feed_id)},
            {"$push": {"zones": zone_doc}}
        )
        logger.info(f"[Zone] ✅ Created zone {zone_id} for feed {feed_id}")
    except Exception as e:
        logger.error(f"[Zone] Failed to create zone: {e}")
        return jsonify({"error": "Database update failed"}), 500

    return jsonify({
        "message": "Zone created successfully",
        "zone": zone_doc
    }), 201


@feeds_bp.route("/<feed_id>/zones", methods=["GET"])
@jwt_required()
def list_zones(feed_id):
    """List all zones for a feed."""
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    zones = feed_obj.get("zones", [])
    
    # Convert datetime objects to ISO format
    for zone in zones:
        if isinstance(zone.get("created_at"), datetime):
            zone["created_at"] = zone["created_at"].isoformat()
        if isinstance(zone.get("analyzed_at"), datetime):
            zone["analyzed_at"] = zone["analyzed_at"].isoformat()
    
    return jsonify({"zones": zones}), 200


@feeds_bp.route("/<feed_id>/zones/<zone_id>", methods=["PUT"])
@jwt_required()
def update_zone(feed_id, zone_id):
    """Update an existing zone."""
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    data = request.get_json() or {}

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    zones = feed_obj.get("zones", [])
    idx = next((i for i, z in enumerate(zones) if z.get("zone_id") == zone_id), None)
    if idx is None:
        return jsonify({"error": "Zone not found"}), 404

    update_fields = {}
    if "zone_name" in data:
        update_fields[f"zones.{idx}.zone_name"] = data["zone_name"].strip()
    
    if "polygon" in data:
        polygon = data["polygon"]
        if not polygon or len(polygon) < 3:
            return jsonify({"error": "Polygon must have at least 3 points"}), 400
        try:
            polygon = [[int(x), int(y)] for x, y in polygon]
            update_fields[f"zones.{idx}.polygon"] = polygon
        except Exception:
            return jsonify({"error": "Invalid polygon format"}), 400

    if not update_fields:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        mongo.db.feeds.update_one(
            {"_id": ObjectId(feed_id)},
            {"$set": update_fields}
        )
        logger.info(f"[Zone] ✅ Updated zone {zone_id} in feed {feed_id}")
    except Exception as e:
        logger.error(f"[Zone] Failed to update zone: {e}")
        return jsonify({"error": "Database update failed"}), 500

    return jsonify({"message": "Zone updated successfully"}), 200


@feeds_bp.route("/<feed_id>/zones/<zone_id>", methods=["DELETE"])
@jwt_required()
def delete_zone(feed_id, zone_id):
    """Delete a zone."""
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    try:
        result = mongo.db.feeds.update_one(
            {"_id": ObjectId(feed_id)},
            {"$pull": {"zones": {"zone_id": zone_id}}}
        )
        logger.info(f"[Zone] ✅ Deleted zone {zone_id} from feed {feed_id}")
    except Exception as e:
        logger.error(f"[Zone] Failed to delete zone: {e}")
        return jsonify({"error": "Database update failed"}), 500

    if result.modified_count == 0:
        return jsonify({"error": "Zone not found or already deleted"}), 404

    return jsonify({"message": "Zone deleted successfully"}), 200


# -------------------------
# Analyze zone with history tracking
# -------------------------
@feeds_bp.route("/<feed_id>/analyze_zone", methods=["POST"])
@jwt_required()
def analyze_zone(feed_id):
    """Analyze crowd density in a specific zone using cached detections."""
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    data = request.get_json() or {}
    zone_id = data.get("zone_id")
    frame_step = int(data.get("frame_step", 1))

    if not zone_id:
        return jsonify({"error": "zone_id is required"}), 400

    if frame_step < 1:
        frame_step = 1

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    zones = feed_obj.get("zones", [])
    zone = next((z for z in zones if z.get("zone_id") == zone_id), None)
    if not zone:
        return jsonify({"error": "Zone not found"}), 404

    polygon = zone["polygon"]
    detections_cache = feed_obj.get("detections_cache", [])
    fps = float(feed_obj.get("summary", {}).get("fps", 10.0))

    if not detections_cache:
        return jsonify({"error": "No cached detections available. Please re-upload the video."}), 400

    logger.info(f"[Analysis] Analyzing zone {zone_id} with frame_step={frame_step}")

    # COUNTING LOGIC:
    # For each frame, we count how many UNIQUE people are in the zone at that moment.
    # We do NOT sum across all frames (that would count same person 100s of times).
    # Instead, we track:
    #   - count_in_zone: Number of people in zone in THIS frame
    #   - avg_count: Average people across all frames
    #   - peak_count: Maximum people in zone at any single moment
    #   - total_count: Same as peak_count (max occupancy)
    #   - total_persons_passed: Total unique persons that entered the zone (tracking across frames)
    
    counts = []
    timestamps = []
    tracked_persons = []  # List of tracked persons across frames
    next_person_id = 0
    iou_threshold = 0.3  # IoU threshold for matching persons across frames
    
    def calculate_iou(box1, box2):
        """Calculate Intersection over Union between two bounding boxes"""
        x1_1, y1_1, x2_1, y2_1 = box1
        x1_2, y1_2, x2_2, y2_2 = box2
        
        # Calculate intersection area
        x_left = max(x1_1, x1_2)
        y_top = max(y1_1, y1_2)
        x_right = min(x2_1, x2_2)
        y_bottom = min(y2_1, y2_2)
        
        if x_right < x_left or y_bottom < y_top:
            return 0.0
        
        intersection_area = (x_right - x_left) * (y_bottom - y_top)
        box1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
        box2_area = (x2_2 - x1_2) * (y2_2 - y1_2)
        union_area = box1_area + box2_area - intersection_area
        
        return intersection_area / union_area if union_area > 0 else 0.0
    
    for det in detections_cache:
        frame_idx = det.get("frame")
        
        if frame_step > 1 and (frame_idx % frame_step) != 0:
            continue
        
        boxes = det.get("boxes", [])
        count_in_zone = 0  # Count for THIS frame only
        boxes_in_zone = []  # Boxes currently in zone for this frame
        
        for box in boxes:
            try:
                x1, y1, x2, y2 = box
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2
                
                if _is_point_in_polygon((cx, cy), polygon):
                    count_in_zone += 1
                    boxes_in_zone.append(box)
            except Exception as e:
                logger.warning(f"[Analysis] Error processing box: {e}")
                continue
        
        # Track persons across frames using IoU matching
        current_frame_persons = []
        for box in boxes_in_zone:
            matched = False
            best_match_id = None
            best_iou = 0.0
            
            # Try to match with existing tracked persons
            for person in tracked_persons:
                if person['last_frame'] >= frame_idx - 10:  # Only consider recent detections (within 10 frames)
                    iou = calculate_iou(box, person['last_box'])
                    if iou > iou_threshold and iou > best_iou:
                        best_iou = iou
                        best_match_id = person['id']
                        matched = True
            
            if matched and best_match_id is not None:
                # Update existing person
                for person in tracked_persons:
                    if person['id'] == best_match_id:
                        person['last_box'] = box
                        person['last_frame'] = frame_idx
                        current_frame_persons.append(best_match_id)
                        break
            else:
                # New person detected
                tracked_persons.append({
                    'id': next_person_id,
                    'first_frame': frame_idx,
                    'last_frame': frame_idx,
                    'last_box': box
                })
                current_frame_persons.append(next_person_id)
                next_person_id += 1
        
        counts.append(count_in_zone)
        timestamps.append(det.get("timestamp", round(frame_idx / fps, 2)))

    if not counts:
        return jsonify({"error": "No frames analyzed. Check zone definition."}), 400

    try:
        avg_count = float(np.mean(counts))
        peak_count = int(np.max(counts))
        peak_idx = int(np.argmax(counts))
        peak_time = timestamps[peak_idx] if peak_idx < len(timestamps) else 0.0
        # Total count represents the peak occupancy (max people at once)
        # NOT the sum across all frames (which would count same people multiple times)
        total_detections = peak_count
        min_count = int(np.min(counts))
        # Total unique persons that passed through the zone
        total_persons_passed = len(tracked_persons)
    except Exception as e:
        logger.error(f"[Analysis] Error calculating statistics: {e}")
        return jsonify({"error": "Error calculating analysis statistics"}), 500

    analysis_summary = {
        "zone_id": zone_id,
        "zone_name": zone.get("zone_name"),
        "frames_analyzed": len(counts),
        "frame_step": frame_step,
        "fps": float(fps),
        "duration": timestamps[-1] if timestamps else 0.0,
        "avg_count": avg_count,
        "min_count": min_count,
        "peak_count": peak_count,
        "peak_time": peak_time,
        "total_count": total_detections,
        "total_persons_passed": total_persons_passed,
        "counts_per_frame": counts,
        "timestamps": timestamps,
        "analyzed_at": datetime.utcnow().isoformat(),
        "analyzed_by": current_user_email
    }

    try:
        # Update zone with latest analysis (replaces previous analysis, does not accumulate)
        mongo.db.feeds.update_one(
            {"_id": ObjectId(feed_id), "zones.zone_id": zone_id},
            {"$set": {
                "zones.$.last_analysis": analysis_summary,
                "zones.$.total_count": total_detections,
                "zones.$.analyzed_at": datetime.utcnow()
            }}
        )
        
        # Add to analysis history
        history_entry = {
            "analysis_id": str(ObjectId()),
            "zone_id": zone_id,
            "zone_name": zone.get("zone_name"),
            "timestamp": datetime.utcnow(),
            "avg_count": avg_count,
            "peak_count": peak_count,
            "total_count": total_detections,
            "total_persons_passed": total_persons_passed,
            "duration": timestamps[-1] if timestamps else 0.0,
            "analyzed_by": current_user_email
        }
        
        mongo.db.feeds.update_one(
            {"_id": ObjectId(feed_id)},
            {"$push": {"analysis_history": history_entry}}
        )
        
        logger.info(f"[Analysis] ✅ Completed zone analysis for {zone_id}: avg={avg_count:.2f}, peak={peak_count}")
    except Exception as e:
        logger.error(f"[Analysis] Failed to store results: {e}")
        return jsonify({"error": "Failed to save analysis results"}), 500

    return jsonify({
        "message": "Zone analysis completed successfully",
        "analysis": analysis_summary
    }), 200


# -------------------------
# Get analysis history
# -------------------------
@feeds_bp.route("/<feed_id>/analysis_history", methods=["GET"])
@jwt_required()
def get_analysis_history(feed_id):
    """Get analysis history for a feed."""
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    history = feed_obj.get("analysis_history", [])
    
    # Convert datetime objects to ISO format
    for item in history:
        if isinstance(item.get("timestamp"), datetime):
            item["timestamp"] = item["timestamp"].isoformat()
    
    return jsonify({
        "feed_id": feed_id,
        "history": history
    }), 200


# -------------------------
# Delete Feed
# -------------------------
@feeds_bp.route("/<feed_id>", methods=["DELETE"])
@jwt_required()
def delete_feed(feed_id):
    """Delete a feed and its video from GridFS."""
    init_gridfs()
    
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    # Delete video from GridFS
    video_id = feed_obj.get("video_id")
    if video_id:
        try:
            fs.delete(video_id)
            logger.info(f"[Delete] ✅ Removed video from GridFS: {video_id}")
        except Exception as e:
            logger.warning(f"[Delete] Failed to remove video: {e}")

    # Delete from database
    try:
        mongo.db.feeds.delete_one({"_id": ObjectId(feed_id)})
        logger.info(f"[Delete] ✅ Deleted feed {feed_id} from database")
    except Exception as e:
        logger.error(f"[Delete] Failed to delete feed: {e}")
        return jsonify({"error": "Database deletion failed"}), 500

    return jsonify({"message": "Feed deleted successfully"}), 200


# -------------------------
# Get First Frame with Zones Preview
# -------------------------
@feeds_bp.route("/<feed_id>/preview", methods=["GET"])
@jwt_required()
def get_preview_frame(feed_id):
    """Get first frame of video with zones drawn."""
    init_gridfs()
    
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        feed_obj = mongo.db.feeds.find_one({"_id": ObjectId(feed_id)})
    except Exception:
        return jsonify({"error": "Invalid feed ID"}), 400

    if not feed_obj:
        return jsonify({"error": "Feed not found"}), 404

    owner_email = feed_obj.get("email")
    if current_user_email != owner_email and not _is_admin_email(current_user_email):
        return jsonify({"error": "Access denied"}), 403

    video_id = feed_obj.get("video_id")
    if not video_id:
        return jsonify({"error": "Video not found"}), 404

    temp_path = None
    try:
        # Get video from GridFS
        grid_out = fs.get(video_id)
        video_bytes = grid_out.read()
        
        # Save temporarily
        temp_path = os.path.join(TEMP_DIR, f"temp_preview_{feed_id}.mp4")
        with open(temp_path, 'wb') as f:
            f.write(video_bytes)
        
        cap = cv2.VideoCapture(temp_path)
        ret, frame = cap.read()
        cap.release()
        
        cleanup_temp_file(temp_path)
        
        if not ret or frame is None:
            return jsonify({"error": "Unable to read video frame"}), 500
        
        # Draw zones on frame
        zones = feed_obj.get("zones", [])
        for zone in zones:
            polygon = zone.get("polygon", [])
            if len(polygon) >= 3:
                pts = np.array(polygon, np.int32)
                pts = pts.reshape((-1, 1, 2))
                cv2.polylines(frame, [pts], isClosed=True, color=(0, 255, 0), thickness=3)
                
                # Draw zone name
                if zone.get("zone_name"):
                    x, y = polygon[0]
                    cv2.putText(frame, zone["zone_name"], (int(x), int(y) - 10),
                              cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # Encode frame as JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        
        return Response(
            buffer.tobytes(),
            mimetype='image/jpeg',
            headers={'Cache-Control': 'no-cache'}
        )
        
    except Exception as e:
        logger.error(f"[Preview] Error generating preview: {e}")
        cleanup_temp_file(temp_path)
        return jsonify({"error": "Could not generate preview"}), 500


# -------------------------
# Health Check
# -------------------------
@feeds_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint with system status."""
    detector_status = "YOLO (GPU)" if YOLO_AVAILABLE and torch.cuda.is_available() else \
                     "YOLO (CPU)" if YOLO_AVAILABLE else "HOG"
    
    # Check GridFS connection
    gridfs_status = "disconnected"
    try:
        init_gridfs()
        list(fs.find().limit(1))
        gridfs_status = "connected"
    except Exception as e:
        logger.error(f"[Health] GridFS check failed: {e}")
    
    # Check MongoDB connection
    mongo_status = "disconnected"
    try:
        mongo.db.command('ping')
        mongo_status = "connected"
    except Exception as e:
        logger.error(f"[Health] MongoDB check failed: {e}")
    
    return jsonify({
        "status": "healthy" if gridfs_status == "connected" and mongo_status == "connected" else "degraded",
        "detector": detector_status,
        "gridfs": gridfs_status,
        "mongodb": mongo_status,
        "timestamp": datetime.utcnow().isoformat()
    }), 200


# -------------------------
# Analyze single image/frame (for webcam or client-side frames)
# -------------------------
@feeds_bp.route("/analyze_frame", methods=["POST"])
@jwt_required()
def analyze_frame():
    """Analyze a single image frame sent from the client. Accepts multipart 'frame' file or raw bytes.
    Optional form field 'zones' (JSON list of polygons) to limit counts to zones.
    Returns detected boxes (filtered by zones) and count.
    """
    current_user_email = _get_email_from_jwt()
    if not current_user_email:
        return jsonify({"error": "Unable to identify user"}), 401

    try:
        # Load zones if provided (multiple polygons)
        zones = None
        if 'zones' in request.form:
            try:
                zones_raw = request.form.get('zones') or 'null'
                zones = json.loads(zones_raw)
                # Validate that zones is a list of polygons
                if zones and isinstance(zones, list):
                    zones = [z for z in zones if isinstance(z, list) and len(z) >= 3]
                if not zones:
                    zones = None
            except Exception as e:
                logger.warning(f"[analyze_frame] Failed to parse zones: {e}")
                zones = None

        # Get image bytes
        frame_bytes = None
        if 'frame' in request.files:
            f = request.files['frame']
            frame_bytes = f.read()
        else:
            # try raw body
            frame_bytes = request.get_data() or None

        if not frame_bytes:
            return jsonify({"error": "No frame provided"}), 400

        # Decode into OpenCV image
        arr = np.frombuffer(frame_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Could not decode image"}), 400

        # Run detector
        try:
            boxes = DETECTOR(img) or []
        except Exception as e:
            logger.error(f"[analyze_frame] Detector error: {e}")
            boxes = []

        boxes_serial = _boxes_to_serializable(boxes)

        # Filter boxes by zones on server-side
        filtered_boxes = []
        if zones:
            # Only return boxes inside at least one zone
            for box in boxes_serial:
                try:
                    x1, y1, x2, y2 = box
                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2
                    # Check if box center is in any zone
                    in_any_zone = False
                    for polygon in zones:
                        if _is_point_in_polygon((cx, cy), polygon):
                            in_any_zone = True
                            break
                    if in_any_zone:
                        filtered_boxes.append(box)
                except Exception:
                    continue
        else:
            # No zones defined, return all boxes
            filtered_boxes = boxes_serial

        return jsonify({
            "count": int(len(filtered_boxes)),
            "boxes": filtered_boxes
        }), 200
    except Exception as e:
        logger.error(f"[analyze_frame] Unexpected error: {e}")
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500