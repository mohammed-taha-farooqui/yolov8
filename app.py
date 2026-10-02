import sys
import os

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Ensure the main dir and modules dir are on sys.path
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
sys.path.append(BASE_DIR)
sys.path.append(os.path.join(BASE_DIR, "modules"))

from flask import Flask, render_template, Response, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename

from modules import config
from modules.crowd_detection import (
    generate_crowd_frame,
    get_crowd_stats,
    reset_crowd_count,
    get_crowd_count,
    get_weapon_status,
    set_video_source
)
from modules.face_recog import generate_face_frame

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Allowed video extensions for upload
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    """Render modern Crowd Monitoring Command Center."""
    return render_template("index.html")


@app.route('/video')
def video():
    """Primary crowd detection video stream (MJPEG)."""
    return Response(
        generate_crowd_frame(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


# --- Legacy compatibility endpoints ---

@app.route('/crowd_count')
def crowd_count_legacy():
    return jsonify(count=get_crowd_count())


@app.route('/weapon_status')
def weapon_status_legacy():
    return jsonify(weapon_detected=get_weapon_status())


@app.route('/start_crowd_count')
def start_crowd_count():
    reset_crowd_count()
    return jsonify(status="Crowd Count Stream Restarted")


# --- Modern REST API Endpoints ---

@app.route('/api/stats')
def api_stats():
    """Real-time analytics and telemetry for the web interface."""
    stats = get_crowd_stats()
    return jsonify(stats)


@app.route('/api/set_source', methods=['POST'])
def api_set_source():
    """Switch video source to sample video, uploaded file, or live webcam."""
    data = request.get_json(force=True, silent=True) or {}
    source_type = data.get('type', 'file')
    source_path = data.get('source', '')

    if source_type == 'webcam':
        set_video_source("0", source_type="webcam")
        config.add_alert("Source Changed", "Switched to Live WebCam Feed (Camera 0)", severity="info")
        return jsonify(status="Switched to Live WebCam", source="Live WebCam", type="webcam")

    elif source_type == 'sample':
        sample_path = os.path.join(config.TEST_VIDEOS_DIR, "video_3.mp4")
        if os.path.exists(sample_path):
            set_video_source(sample_path, source_type="file")
            config.add_alert("Source Changed", "Switched to Sample Video (Station Crowd)", severity="info")
            return jsonify(status="Switched to Sample Video", source="video_3.mp4", type="file")
        else:
            return jsonify(error="Sample video not found"), 404

    elif source_type == 'file' and source_path:
        # Check in test_videos directory
        full_path = os.path.join(config.TEST_VIDEOS_DIR, os.path.basename(source_path))
        if os.path.exists(full_path):
            set_video_source(full_path, source_type="file")
            config.add_alert("Source Changed", f"Switched to video file: {os.path.basename(source_path)}", severity="info")
            return jsonify(status="Switched to video file", source=os.path.basename(source_path), type="file")
        elif os.path.exists(source_path):
            set_video_source(source_path, source_type="file")
            return jsonify(status="Switched to video file", source=os.path.basename(source_path), type="file")
        else:
            return jsonify(error="Video file not found"), 404

    return jsonify(error="Invalid source configuration"), 400


@app.route('/api/upload', methods=['POST'])
def api_upload_video():
    """Upload a new video file for crowd analysis."""
    if 'video' not in request.files:
        return jsonify(error="No video file provided"), 400

    file = request.files['video']
    if file.filename == '':
        return jsonify(error="No selected file"), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        save_path = os.path.join(config.TEST_VIDEOS_DIR, filename)
        file.save(save_path)

        # Immediately switch feed to the uploaded video
        set_video_source(save_path, source_type="uploaded")
        config.add_alert("Video Uploaded", f"Successfully uploaded and activated: {filename}", severity="info")

        return jsonify(
            status="Video uploaded successfully",
            filename=filename,
            path=save_path
        )

    return jsonify(error="Invalid file format. Allowed: mp4, avi, mov, mkv, webm"), 400


@app.route('/api/videos', methods=['GET'])
def api_list_videos():
    """List available sample and uploaded videos in test_videos/."""
    videos = []
    if os.path.exists(config.TEST_VIDEOS_DIR):
        for f in os.listdir(config.TEST_VIDEOS_DIR):
            if allowed_file(f):
                videos.append(f)
    return jsonify(videos=videos, current=os.path.basename(str(config.current_source)))


@app.route('/api/set_threshold', methods=['POST'])
def api_set_threshold():
    """Configure overcrowding alert threshold."""
    data = request.get_json(force=True, silent=True) or {}
    threshold = data.get('threshold')
    try:
        threshold = int(threshold)
        if threshold > 0:
            config.overcrowding_threshold = threshold
            config.add_alert("Threshold Updated", f"Overcrowding alert threshold set to {threshold} people.", severity="info")
            return jsonify(status="Threshold updated", threshold=threshold)
    except (ValueError, TypeError):
        pass
    return jsonify(error="Invalid threshold value"), 400


@app.route('/api/test_alert', methods=['POST'])
def api_test_alert():
    """Trigger or clear a simulated alert for testing & demo purposes."""
    data = request.get_json() or {}
    alert_type = data.get('type')  # 'weapon', 'overcrowding', 'clear'

    if alert_type == 'weapon':
        config.simulated_weapon_alert = not config.simulated_weapon_alert
        state = config.simulated_weapon_alert
        if state:
            config.add_alert("Simulated Weapon Alert", "DEMO: Weapon threat triggered manually.", severity="critical")
        return jsonify(simulated_weapon=state)

    elif alert_type == 'overcrowding':
        config.simulated_overcrowding_alert = not config.simulated_overcrowding_alert
        state = config.simulated_overcrowding_alert
        if state:
            config.add_alert("Simulated Overcrowding", "DEMO: High density threshold alert triggered.", severity="warning")
        return jsonify(simulated_overcrowding=state)

    elif alert_type == 'clear':
        config.simulated_weapon_alert = False
        config.simulated_overcrowding_alert = False
        return jsonify(status="Simulations cleared")

    return jsonify(error="Unknown simulation type"), 400


@app.route('/api/clear_alerts', methods=['POST'])
def api_clear_alerts():
    """Clear alert history and acknowledge warnings."""
    with config.alert_lock:
        config.alert_history.clear()
    config.simulated_weapon_alert = False
    config.simulated_overcrowding_alert = False
    return jsonify(status="Alerts acknowledged and cleared")


@app.route('/api/toggle_overlay', methods=['POST'])
def api_toggle_overlay():
    """Toggle bounding boxes, motion trails, or ROI polygon."""
    data = request.get_json() or {}
    overlay = data.get('overlay')

    if overlay == 'boxes':
        config.show_bounding_boxes = not config.show_bounding_boxes
        return jsonify(boxes=config.show_bounding_boxes)
    elif overlay == 'trails':
        config.show_motion_trails = not config.show_motion_trails
        return jsonify(trails=config.show_motion_trails)
    elif overlay == 'roi':
        config.show_roi_boundary = not config.show_roi_boundary
        return jsonify(roi=config.show_roi_boundary)

    return jsonify(error="Invalid overlay type"), 400


# --- Facial Recognition Endpoints ---

@app.route('/face_video')
def face_video():
    """Face detection and identification video stream."""
    if config.face_detection_enabled:
        return Response(generate_face_frame(), mimetype='multipart/x-mixed-replace; boundary=frame')
    else:
        return "Face detection is not currently active.", 400


@app.route('/toggle_face_detection')
def toggle_face_detection():
    config.face_detection_enabled = not config.face_detection_enabled
    return jsonify(
        status="Face detection started" if config.face_detection_enabled else "Face detection stopped",
        enabled=config.face_detection_enabled
    )


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  [SYSTEM] REAL-TIME CROWD MONITORING SYSTEM")
    print("  [SYSTEM] Server running at: http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
