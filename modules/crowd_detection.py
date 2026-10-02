import cv2
import numpy as np
import time
import os
from .tracker import Tracker
from . import config

tracker = Tracker()
frame_fps = 0.0
last_frame_time = time.time()


def set_video_source(source_path, source_type="file"):
    """Switch active video capture source safely."""
    global tracker
    with config.camera_lock:
        if config.camera is not None and config.camera.isOpened():
            config.camera.release()
            config.camera = None

        config.current_source = source_path
        config.source_type = source_type
        config.camera = config.open_camera(source_path)
        tracker.reset()
        config.crowd_count = 0
        config.weapon_detected = False
        config.overcrowding_alert = False
        print(f"[INFO] Video source switched to: {source_path} (Type: {source_type})")


def get_crowd_stats():
    """Return a dictionary of all current crowd monitoring metrics."""
    global frame_fps
    is_weapon = config.weapon_detected or config.simulated_weapon_alert
    is_overcrowded = config.crowd_count >= config.overcrowding_threshold or config.simulated_overcrowding_alert

    # Density category determination
    ratio = min(100, int((config.crowd_count / max(1, config.overcrowding_threshold)) * 100))
    if ratio < 35:
        density_label = "Low"
    elif ratio < 75:
        density_label = "Moderate"
    elif ratio < 100:
        density_label = "High"
    else:
        density_label = "Critical Overcrowded"

    with config.alert_lock:
        recent_alerts = list(config.alert_history[:15])

    return {
        "count": config.crowd_count,
        "density_level": density_label,
        "density_ratio": ratio,
        "dominant_direction": config.dominant_direction,
        "average_speed": config.average_speed,
        "movement_breakdown": config.movement_breakdown,
        "weapon_detected": is_weapon,
        "overcrowding_alert": is_overcrowded,
        "threshold": config.overcrowding_threshold,
        "fps": round(frame_fps, 1),
        "source": os.path.basename(str(config.current_source)) if config.source_type != "webcam" else "Live WebCam",
        "source_type": config.source_type,
        "alerts": recent_alerts
    }


def reset_crowd_count():
    global tracker
    with config.camera_lock:
        tracker.reset()
        config.crowd_count = 0
        config.weapon_detected = False
        config.overcrowding_alert = False


def get_crowd_count():
    return config.crowd_count


def get_weapon_status():
    return config.weapon_detected or config.simulated_weapon_alert


def draw_hud_box(img, x1, y1, x2, y2, color, label=None, line_len=15):
    """Draw futuristic HUD style bounding box."""
    # Main subtle box
    cv2.rectangle(img, (x1, y1), (x2, y2), color, 1)

    # Accent corners
    # Top-Left
    cv2.line(img, (x1, y1), (x1 + line_len, y1), color, 2)
    cv2.line(img, (x1, y1), (x1, y1 + line_len), color, 2)
    # Top-Right
    cv2.line(img, (x2, y1), (x2 - line_len, y1), color, 2)
    cv2.line(img, (x2, y1), (x2, y1 + line_len), color, 2)
    # Bottom-Left
    cv2.line(img, (x1, y2), (x1 + line_len, y2), color, 2)
    cv2.line(img, (x1, y2), (x1, y2 - line_len), color, 2)
    # Bottom-Right
    cv2.line(img, (x2, y2), (x2 - line_len, y2), color, 2)
    cv2.line(img, (x2, y2), (x2, y2 - line_len), color, 2)

    if label:
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(img, (x1, y1 - th - 6), (x1 + tw + 6, y1), color, -1)
        cv2.putText(img, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)


def generate_crowd_frame():
    """Continuous generator yielding JPEG MJPEG stream with detection overlays."""
    global tracker, frame_fps, last_frame_time

    model = config.get_yolo_model()
    frame_skip = 2
    frame_counter = 0

    while True:
        with config.camera_lock:
            if config.camera is None or not config.camera.isOpened():
                config.camera = config.open_camera(config.current_source)
                if not config.camera.isOpened():
                    time.sleep(0.5)
                    continue

            success, frame = config.camera.read()

            # If video ends or stream interrupted, automatically loop back to beginning
            if not success or frame is None:
                if config.source_type in ["file", "uploaded"]:
                    config.camera.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    success, frame = config.camera.read()
                    if not success or frame is None:
                        time.sleep(0.1)
                        continue
                else:
                    time.sleep(0.1)
                    continue

        frame_counter += 1
        now = time.time()
        dt = now - last_frame_time
        if dt > 0:
            frame_fps = 0.9 * frame_fps + 0.1 * (1.0 / dt)
        last_frame_time = now

        # Standardize resolution for smooth streaming & rendering
        h, w = frame.shape[:2]
        target_w = 720
        target_h = int(h * (target_w / w))
        frame = cv2.resize(frame, (target_w, target_h))

        detected_people_boxes = []
        detected_weapons = []

        # Run inference if model available
        if model is not None and frame_counter % frame_skip == 0:
            try:
                # Ultralytics YOLOv8 syntax
                if hasattr(model, 'predict'):
                    results = model.predict(frame, conf=0.35, verbose=False)
                    for r in results:
                        for box in r.boxes:
                            cls_id = int(box.cls[0].item())
                            cls_name = model.names.get(cls_id, '')
                            coords = box.xyxy[0].cpu().numpy().astype(int)
                            x1, y1, x2, y2 = coords[:4]

                            if cls_name == 'person':
                                detected_people_boxes.append([x1, y1, x2, y2])
                            elif cls_name in ['knife', 'scissors', 'gun', 'weapon', 'baseball bat']:
                                detected_weapons.append((x1, y1, x2, y2, cls_name))
                else:
                    # Fallback to YOLOv5 torch.hub pandas syntax
                    results = model(frame)
                    for _, row in results.pandas().xyxy[0].iterrows():
                        x1, y1, x2, y2 = int(row['xmin']), int(row['ymin']), int(row['xmax']), int(row['ymax'])
                        name = str(row['name'])
                        if name == 'person':
                            detected_people_boxes.append([x1, y1, x2, y2])
                        elif name in ['knife', 'gun', 'scissors', 'weapon']:
                            detected_weapons.append((x1, y1, x2, y2, name))
            except Exception as e:
                pass

        # Update tracker
        tracked_objects = tracker.update(detected_people_boxes)
        config.crowd_count = len(tracked_objects)

        # Movement insights calculation
        movement_summary = tracker.get_summary_movement()
        config.dominant_direction = movement_summary["dominant_direction"]
        config.average_speed = movement_summary["average_speed"]
        config.movement_breakdown = movement_summary["directions"]

        # Weapon detection status
        has_weapon = len(detected_weapons) > 0 or config.simulated_weapon_alert
        config.weapon_detected = has_weapon
        if has_weapon:
            config.add_alert("Weapon Detected", "Potential weapon or weapon-like object detected!", severity="critical")

        # Overcrowding status
        is_overcrowded = config.crowd_count >= config.overcrowding_threshold or config.simulated_overcrowding_alert
        config.overcrowding_alert = is_overcrowded
        if is_overcrowded:
            config.add_alert("Overcrowding Anomaly", f"Density threshold exceeded: {config.crowd_count} people in zone.", severity="critical" if config.crowd_count > config.overcrowding_threshold * 1.3 else "warning")

        # Draw overlays
        # 1. Monitoring ROI Area
        if config.show_roi_boundary:
            roi_pts = np.array([[15, 15], [target_w - 15, 15], [target_w - 15, target_h - 15], [15, target_h - 15]], np.int32)
            cv2.polylines(frame, [roi_pts], True, (0, 220, 255), 1, cv2.LINE_AA)
            cv2.putText(frame, "ZONE: MAIN PLAZA", (25, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 255), 1, cv2.LINE_AA)

        # 2. People Bounding Boxes & Trajectories
        for obj in tracked_objects:
            x1, y1, x2, y2, obj_id, direction, speed, traj = obj

            # Draw trajectory trails
            if config.show_motion_trails and len(traj) > 1:
                for idx in range(1, len(traj)):
                    alpha = idx / len(traj)
                    thickness = max(1, int(alpha * 2))
                    cv2.line(frame, traj[idx - 1], traj[idx], (0, 255, 200), thickness, cv2.LINE_AA)

            # Draw bounding box
            if config.show_bounding_boxes:
                box_color = (0, 255, 130)  # Green default
                if is_overcrowded:
                    box_color = (0, 140, 255)  # Orange for high density
                dir_arrow = {"North": "^", "South": "v", "East": ">", "West": "<", "Stationary": "o"}.get(direction, "")
                label = f"#{obj_id} {dir_arrow}"
                draw_hud_box(frame, x1, y1, x2, y2, box_color, label)

        # 3. Weapons Overlays
        for wx1, wy1, wx2, wy2, wname in detected_weapons:
            cv2.rectangle(frame, (wx1, wy1), (wx2, wy2), (0, 0, 255), 2)
            cv2.putText(frame, f"ALERT: {wname.upper()}", (wx1, wy1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)

        # 4. Simulation Overlays for UI demo
        if config.simulated_weapon_alert:
            # Draw synthetic weapon detection badge on upper right
            cv2.rectangle(frame, (target_w - 240, 20), (target_w - 20, 65), (0, 0, 200), -1)
            cv2.putText(frame, "SIMULATED WEAPON ALERT", (target_w - 230, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        # 5. Top Status Bar HUD
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (target_w, 45), (10, 15, 25), -1)
        cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)

        count_color = (0, 0, 255) if is_overcrowded else (0, 255, 100)
        cv2.putText(frame, f"CROWD: {config.crowd_count}", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, count_color, 2, cv2.LINE_AA)
        cv2.putText(frame, f"FLOW: {config.dominant_direction.upper()}", (200, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 220, 220), 1, cv2.LINE_AA)
        cv2.putText(frame, f"FPS: {round(frame_fps, 1)}", (target_w - 110, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1, cv2.LINE_AA)

        # Encode to JPEG
        ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if not ret:
            continue
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
