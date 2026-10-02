import os
import threading
import cv2

# Project Base Directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Resource Paths
PHOTOS_DIR = os.path.join(BASE_DIR, "photos")
TEST_VIDEOS_DIR = os.path.join(BASE_DIR, "test_videos")
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Ensure required directories exist
os.makedirs(PHOTOS_DIR, exist_ok=True)
os.makedirs(TEST_VIDEOS_DIR, exist_ok=True)

# Default Video File
DEFAULT_VIDEO_PATH = os.path.join(TEST_VIDEOS_DIR, "video_3.mp4")

# Stream & Model State
current_source = DEFAULT_VIDEO_PATH
source_type = "file"  # "file", "webcam", or "uploaded"
camera = None
camera_lock = threading.Lock()

# YOLO Model Instance (loaded lazily)
model = None
model_lock = threading.Lock()

# Crowd Monitoring Configuration & Metrics
overcrowding_threshold = 20
crowd_count = 0
density_level = "Low"  # Low, Moderate, High, Critical Overcrowding
density_ratio = 0.0    # 0.0 to 100.0%
dominant_direction = "Stationary"
average_speed = 0.0
movement_breakdown = {"North": 0, "South": 0, "East": 0, "West": 0, "Stationary": 0}

# Anomaly & Threat Detection States
weapon_detected = False
overcrowding_alert = False
stampede_alert = False

# Demo / Simulation Flags for UI testing
simulated_weapon_alert = False
simulated_overcrowding_alert = False

# Alert Logs (Recent 50 alerts)
alert_history = []
alert_lock = threading.Lock()

# Face Detection Settings
face_detection_enabled = False
known_faces_encoding = []
known_faces_name = []

# Display Overlays Options
show_bounding_boxes = True
show_motion_trails = True
show_roi_boundary = True

# ROI Monitoring Area Polygon [(x, y), ...]
roi_area = [(10, 10), (10, 470), (630, 470), (630, 10)]

def add_alert(alert_type, message, severity="warning"):
    """Thread-safe append of an alert event."""
    from datetime import datetime
    import time
    with alert_lock:
        alert_event = {
            "id": int(time.time() * 1000),
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "type": alert_type,
            "message": message,
            "severity": severity  # "critical", "warning", "info"
        }
        # Avoid duplicate alerts of same type within 3 seconds
        if alert_history:
            last = alert_history[0]
            if last["type"] == alert_type and (time.time() * 1000 - last["id"]) < 3000:
                return
        alert_history.insert(0, alert_event)
        if len(alert_history) > 50:
            alert_history.pop()

def get_yolo_model():
    """Lazily and safely load the YOLO model."""
    global model
    with model_lock:
        if model is None:
            try:
                from ultralytics import YOLO
                # Load YOLOv8 nano model for high inference speed
                model = YOLO("yolov8n.pt")
                print("[INFO] Ultralytics YOLOv8 loaded successfully.")
            except Exception as e:
                print(f"[WARN] Error loading Ultralytics YOLO: {e}")
                try:
                    import torch
                    model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)
                    print("[INFO] YOLOv5 loaded via torch hub.")
                except Exception as ex2:
                    print(f"[ERROR] Could not load YOLO model: {ex2}")
                    model = None
        return model

def open_camera(source):
    """Open a VideoCapture instance for file or camera index with DirectShow acceleration on Windows."""
    try:
        if (isinstance(source, str) and source.isdigit()) or isinstance(source, int):
            idx = int(source)
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(idx)
        else:
            cap = cv2.VideoCapture(source)
        return cap
    except Exception as e:
        print(f"[ERROR] Failed to open video source {source}: {e}")
        return cv2.VideoCapture()

