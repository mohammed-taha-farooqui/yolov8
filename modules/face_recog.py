import cv2
import os
import time
from . import config

# Optional face_recognition module import
try:
    import face_recognition
    HAS_FACE_REC = True
except ImportError:
    face_recognition = None
    HAS_FACE_REC = False


def generate_face_frame():
    """Generates video frames with face detection and recognition overlays."""
    frame_skip = 2
    frame_counter = 0

    while config.face_detection_enabled:
        with config.camera_lock:
            if config.camera is None or not config.camera.isOpened():
                config.camera = config.open_camera(config.current_source)
                if not config.camera.isOpened():
                    time.sleep(0.5)
                    continue

            success, frame = config.camera.read()
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
        if frame_counter % frame_skip != 0:
            continue

        h, w = frame.shape[:2]
        target_w = 640
        target_h = int(h * (target_w / w))
        frame = cv2.resize(frame, (target_w, target_h))

        if HAS_FACE_REC and len(config.known_faces_encoding) > 0:
            # Full facial recognition
            try:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                face_locations = face_recognition.face_locations(rgb_frame)
                face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

                for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
                    matches = face_recognition.compare_faces(config.known_faces_encoding, face_encoding)
                    name = "Unknown Person"
                    if True in matches:
                        first_match_index = matches.index(True)
                        name = config.known_faces_name[first_match_index]

                    cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0) if name != "Unknown Person" else (0, 165, 255), 2)
                    cv2.putText(frame, name, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            except Exception as e:
                pass
        else:
            # Fallback: Face detection indicator HUD
            cv2.putText(frame, "FACE DETECTION ACTIVE", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 200), 2)
            cv2.putText(frame, f"Registered Persons: {len(config.known_faces_name)}", (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
