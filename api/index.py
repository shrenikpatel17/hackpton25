from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import mediapipe as mp
import base64
import json
from fastapi import HTTPException

### Create FastAPI instance with custom docs and openapi url
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

print("Starting FastAPI server...")
# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

def detect_eye_direction(frame):
    """
    Detect eye gaze direction by tracking pupil positions relative to eye corners.
    Returns: "left", "right", "center", or "unknown".
    """

    print("Running improved detect_eye_direction")
    
    # Convert the BGR image to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Get image dimensions
    img_h, img_w = frame.shape[:2]
    
    # Process the frame and detect facial landmarks
    results = face_mesh.process(rgb_frame)
    
    if not results.multi_face_landmarks:
        return "unknown"
    
    face_landmarks = results.multi_face_landmarks[0]
    
    # MediaPipe indices for eye landmarks
    left_eye_landmarks = [33, 133, 159, 145, 468]
    right_eye_landmarks = [362, 263, 386, 374, 473]
    
    # Extract normalized landmarks and convert to pixel coordinates
    def get_landmark_coords(landmark_index):
        landmark = face_landmarks.landmark[landmark_index]
        x, y = int(landmark.x * img_w), int(landmark.y * img_h)
        return (x, y)
    
    # Get eye corner and pupil coordinates
    left_eye_left = get_landmark_coords(33)
    left_eye_right = get_landmark_coords(133)
    left_eye_pupil = get_landmark_coords(468)
    
    right_eye_left = get_landmark_coords(362)
    right_eye_right = get_landmark_coords(263)
    right_eye_pupil = get_landmark_coords(473)
    
    # Calculate relative position of pupils within the eye sockets
    left_eye_width = left_eye_right[0] - left_eye_left[0]
    left_eye_height = left_eye_right[1] - left_eye_left[1]
    if left_eye_width == 0:  # Prevent division by zero
        left_eye_width = 1
    if left_eye_height == 0:
        left_eye_height = 1
    
    left_pupil_ratio_x = (left_eye_pupil[0] - left_eye_left[0]) / left_eye_width
    left_pupil_ratio_y = (left_eye_pupil[1] - left_eye_left[1]) / left_eye_height
    
    right_eye_width = right_eye_right[0] - right_eye_left[0]
    right_eye_height = right_eye_right[1] - right_eye_left[1]
    if right_eye_width == 0:  # Prevent division by zero
        right_eye_width = 1
    if right_eye_height == 0:  # Prevent division by zero
        right_eye_height = 1
    
    right_pupil_ratio_x = (right_eye_pupil[0] - right_eye_left[0]) / right_eye_width
    right_pupil_ratio_y = (right_eye_pupil[1] - right_eye_left[1]) / right_eye_height
    
    # Calculate the horizontal (x) average pupil ratio
    avg_pupil_ratio_x = (left_pupil_ratio_x + right_pupil_ratio_x) / 2
    avg_pupil_ratio_y = (left_pupil_ratio_y + right_pupil_ratio_y) / 2
    
    # For debugging: Print the horizontal and vertical ratios
    print(f"Left pupil ratio X: {left_pupil_ratio_x:.3f}, Right pupil ratio X: {right_pupil_ratio_x:.3f}, Avg X: {avg_pupil_ratio_x:.3f}")
    print(f"Left pupil ratio Y: {left_pupil_ratio_y:.3f}, Right pupil ratio Y: {right_pupil_ratio_y:.3f}, Avg Y: {avg_pupil_ratio_y:.3f}")
    
    # Define direction based on the horizontal and vertical average pupil ratio
    if avg_pupil_ratio_x < 0.45:
        return "right"
    elif avg_pupil_ratio_x > 0.55:
        return "left"
    else:
        return "center"


def process_ambient_light(frame):
    try:
        print("Processing ambient light")
        
        # Convert the BGR image to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Calculate average brightness
        brightness = np.mean(gray)

        return float(brightness)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}") 
    



def detect_blink(face_landmarks, img_w, img_h):
    """
    Detect if the person is blinking by calculating the eye aspect ratio (EAR)
    """
    # Indices for the eye landmarks (vertical and horizontal points)
    LEFT_EYE = [362, 385, 387, 373, 380, 374]
    RIGHT_EYE = [33, 160, 158, 133, 153, 144]
    
    def calculate_ear(eye_points):
        # Convert normalized coordinates to pixel coordinates
        points = []
        for idx in eye_points:
            landmark = face_landmarks.landmark[idx]
            x = int(landmark.x * img_w)
            y = int(landmark.y * img_h)
            points.append((x, y))
        
        # Calculate the eye aspect ratio
        # EAR = (||p2-p6|| + ||p3-p5||) / (2||p1-p4||)
        vertical_dist1 = np.linalg.norm(np.array(points[1]) - np.array(points[5]))
        vertical_dist2 = np.linalg.norm(np.array(points[2]) - np.array(points[4]))
        horizontal_dist = np.linalg.norm(np.array(points[0]) - np.array(points[3]))
        
        # EAR should not be 0 (if points are too close)
        ear = (vertical_dist1 + vertical_dist2) / (2.0 * horizontal_dist) if horizontal_dist > 0 else 0
        return ear
    
    # Calculate EAR for both eyes
    left_ear = calculate_ear(LEFT_EYE)
    right_ear = calculate_ear(RIGHT_EYE)
    
    # Average EAR of both eyes
    avg_ear = (left_ear + right_ear) / 2.0

    print(f"Left EAR: {left_ear:.3f}, Right EAR: {right_ear:.3f}, Avg EAR: {avg_ear:.3f}")
    
    # Dynamic threshold adjustment based on current average EAR (could be optimized with training)
    EAR_THRESHOLD = 0.25  # Threshold decreases when the person is blinking more
    print(f"Adjusted EAR Threshold: {EAR_THRESHOLD:.3f}")
    
    # Convert numpy.bool_ to Python bool before returning
    is_blinking = bool(avg_ear < EAR_THRESHOLD)  # Convert to Python bool
    if is_blinking:
        print(f"Blink detected! EAR: {avg_ear:.3f}")
    
    return is_blinking

@app.post("/api/py/detect-eye-direction")
async def detect_direction(request: Request):
    try:
        # Get the frame data from the request
        data = await request.json()
        image_data = data['frame'].split(',')[1]  # Remove the data URL prefix
        
        # Decode base64 image
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Get image dimensions
        img_h, img_w = frame.shape[:2]
        
        # Convert the BGR image to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process the frame and detect facial landmarks
        results = face_mesh.process(rgb_frame)
        
        response_data = {
            "direction": "unknown",
            "is_blinking": False
        }
        
        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0]
            
            # Detect eye direction
            response_data["direction"] = detect_eye_direction(frame)
            
            # Detect blink and convert to Python bool
            response_data["is_blinking"] = bool(detect_blink(face_landmarks, img_w, img_h))
            
        print(f"Eye direction: {response_data['direction']}, Blinking: {response_data['is_blinking']}")
        return response_data
        
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        return {"error": str(e), "status": "error"}  # Add status field for better error handling

@app.post("/api/py/detect-blink")
async def detect_blink_endpoint(request: Request):
    try:
        # Get the frame data from the request
        data = await request.json()
        image_data = data['frame'].split(',')[1]  # Remove the data URL prefix
        
        # Decode base64 image
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Get image dimensions
        img_h, img_w = frame.shape[:2]
        
        # Convert the BGR image to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process the frame and detect facial landmarks
        results = face_mesh.process(rgb_frame)
        
        is_blinking = False
        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0]
            is_blinking = bool(detect_blink(face_landmarks, img_w, img_h))
            
        return {"is_blinking": is_blinking}
        
    except Exception as e:
        print(f"Error processing frame for blink: {str(e)}")
        return {"error": str(e), "status": "error"}


@app.post("/api/py/detect-ambient-light")
async def detect_ambient_light_endpoint(request: Request):
    try:
         # Get the frame data from the request
        data = await request.json()
        image_data = data['frame'].split(',')[1]  # Remove the data URL prefix
        
        # Decode base64 image
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Calculate ambient light regardless of face detection
        brightness = process_ambient_light(frame)
        
        # Convert brightness to string "dark" or "bright" based on threshold
        amb_light = "bright" if brightness >= 70 else "dark"
        
        response_data = {
            "amb_light": amb_light
        }
                        
        print(f"Ambient light: {response_data['amb_light']}")
        return response_data
        
    except Exception as e:
        print(f"Error processing frame for ambient light: {str(e)}")
        return {"error": str(e), "status": "error"}

def check_distance(frame):
    """
    Calculate the distance between user and screen using facial landmarks.
    Returns distance in centimeters
    """
    # Define key point indices (MediaPipe face mesh indices)
    FOREHEAD_TOP = 10    # Forehead top key point
    NOSE_TIP = 4         # Nose tip key point
    REAL_VERTICAL_DISTANCE = 8.0  # Actual vertical distance from forehead to nose tip (in centimeters, needs user measurement)
    FOCAL_LENGTH = 700            # Example value, needs recalibration!

    print("Running check_distance")
    # Convert image format and detect facial key points
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)

    distance = None

    if results.multi_face_landmarks:
        face_landmarks = results.multi_face_landmarks[0]

        # Get key point coordinates
        forehead = face_landmarks.landmark[FOREHEAD_TOP]
        nose_tip = face_landmarks.landmark[NOSE_TIP]

        # Calculate vertical pixel distance (forehead to nose tip)
        ih, iw, _ = frame.shape
        y1 = int(forehead.y * ih)  # Forehead Y coordinate
        y2 = int(nose_tip.y * ih)   # Nose tip Y coordinate
        pixel_distance = abs(y2 - y1)

        # Calculate actual distance
        if pixel_distance > 0:
            distance = (REAL_VERTICAL_DISTANCE * FOCAL_LENGTH) / pixel_distance

        # Visualize key points (optional)
        cv2.line(frame, (0, y1), (iw, y1), (0, 255, 0), 1)
        cv2.line(frame, (0, y2), (iw, y2), (0, 0, 255), 1)
        cv2.putText(frame, f"{distance:.2f} cm", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

    return distance


@app.post("/api/py/check-distance")
async def check_distance_endpoint(request: Request):
    try:
        # Get the frame data from the request
        data = await request.json()
        image_data = data['frame'].split(',')[1]  # Remove the data URL prefix
        
        # Decode base64 image
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Check distance
        distance_cm = check_distance(frame)
        
        response_data = {
            "distance_cm": distance_cm
        }
        
        print(f"Distance: {distance_cm:.2f} cm")
        return response_data
        
    except Exception as e:
        print(f"Error processing frame for distance check: {str(e)}")
        return {"error": str(e), "status": "error"}

@app.get("/api/py/helloFastApi")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}