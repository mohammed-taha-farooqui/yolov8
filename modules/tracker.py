import math
from collections import deque


class Tracker:
    """
    Advanced Centroid and Motion Vector Tracker for Crowd Monitoring.
    Tracks object IDs, calculates trajectories, velocity, and movement directions.
    """
    def __init__(self, max_disappeared=15, max_distance=60):
        # Store center points: {id: (cx, cy)}
        self.center_points = {}
        # Store trajectory history: {id: deque([(cx, cy), ...], maxlen=15)}
        self.trajectories = {}
        # Store velocity and direction: {id: {'dx': float, 'dy': float, 'speed': float, 'direction': str}}
        self.motion_info = {}
        # Track disappearance frame count: {id: count}
        self.disappeared = {}
        self.id_count = 0
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    def _get_cardinal_direction(self, dx, dy, min_dist=2.0):
        speed = math.hypot(dx, dy)
        if speed < min_dist:
            return "Stationary"
        angle = math.degrees(math.atan2(-dy, dx))  # Image y goes downward
        if angle < 0:
            angle += 360

        if 45 <= angle < 135:
            return "North"
        elif 135 <= angle < 225:
            return "West"
        elif 225 <= angle < 315:
            return "South"
        else:
            return "East"

    def update(self, objects_rect):
        """
        objects_rect can be a list of [x1, y1, x2, y2] bounding boxes.
        Returns: list of [x1, y1, x2, y2, object_id, direction, speed, trajectory]
        """
        objects_bbs_ids = []
        new_centers = []

        # Convert bounding boxes to centers
        for rect in objects_rect:
            x1, y1, x2, y2 = rect[:4]
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            new_centers.append((cx, cy, (x1, y1, x2, y2)))

        matched_new = set()
        matched_existing = set()

        # Match new detections to existing tracks using nearest neighbor
        for obj_id, pt in list(self.center_points.items()):
            min_dist = float('inf')
            best_idx = None
            for idx, (ncx, ncy, _) in enumerate(new_centers):
                if idx in matched_new:
                    continue
                dist = math.hypot(ncx - pt[0], ncy - pt[1])
                if dist < min_dist and dist < self.max_distance:
                    min_dist = dist
                    best_idx = idx

            if best_idx is not None:
                ncx, ncy, (x1, y1, x2, y2) = new_centers[best_idx]
                dx = ncx - pt[0]
                dy = ncy - pt[1]
                speed = math.hypot(dx, dy)
                direction = self._get_cardinal_direction(dx, dy)

                self.center_points[obj_id] = (ncx, ncy)
                self.disappeared[obj_id] = 0
                self.trajectories[obj_id].append((ncx, ncy))
                self.motion_info[obj_id] = {
                    'dx': dx,
                    'dy': dy,
                    'speed': speed,
                    'direction': direction
                }

                objects_bbs_ids.append([
                    x1, y1, x2, y2, obj_id, direction, speed,
                    list(self.trajectories[obj_id])
                ])
                matched_new.add(best_idx)
                matched_existing.add(obj_id)
            else:
                self.disappeared[obj_id] = self.disappeared.get(obj_id, 0) + 1

        # Register new objects for unmatched detections
        for idx, (ncx, ncy, (x1, y1, x2, y2)) in enumerate(new_centers):
            if idx not in matched_new:
                new_id = self.id_count
                self.id_count += 1
                self.center_points[new_id] = (ncx, ncy)
                self.trajectories[new_id] = deque([(ncx, ncy)], maxlen=15)
                self.motion_info[new_id] = {
                    'dx': 0.0,
                    'dy': 0.0,
                    'speed': 0.0,
                    'direction': "Stationary"
                }
                self.disappeared[new_id] = 0

                objects_bbs_ids.append([
                    x1, y1, x2, y2, new_id, "Stationary", 0.0,
                    list(self.trajectories[new_id])
                ])

        # Remove objects that disappeared for too many frames
        for obj_id in list(self.disappeared.keys()):
            if self.disappeared[obj_id] > self.max_disappeared:
                self.center_points.pop(obj_id, None)
                self.trajectories.pop(obj_id, None)
                self.motion_info.pop(obj_id, None)
                self.disappeared.pop(obj_id, None)

        return objects_bbs_ids

    def get_summary_movement(self):
        """Calculates dominant crowd flow direction and average speed."""
        if not self.motion_info:
            return {
                "dominant_direction": "Stationary",
                "average_speed": 0.0,
                "directions": {"North": 0, "South": 0, "East": 0, "West": 0, "Stationary": 0}
            }

        counts = {"North": 0, "South": 0, "East": 0, "West": 0, "Stationary": 0}
        total_speed = 0.0
        active_count = len(self.motion_info)

        for info in self.motion_info.values():
            d = info.get('direction', 'Stationary')
            counts[d] = counts.get(d, 0) + 1
            total_speed += info.get('speed', 0.0)

        # Dominant direction (excluding stationary if moving people exist)
        moving_counts = {k: v for k, v in counts.items() if k != 'Stationary'}
        if moving_counts and max(moving_counts.values()) > 0:
            dominant = max(moving_counts, key=moving_counts.get)
        else:
            dominant = "Stationary"

        avg_speed = round(total_speed / max(1, active_count), 2)
        return {
            "dominant_direction": dominant,
            "average_speed": avg_speed,
            "directions": counts
        }

    def reset(self):
        """Reset all tracking states."""
        self.center_points.clear()
        self.trajectories.clear()
        self.motion_info.clear()
        self.disappeared.clear()
        self.id_count = 0