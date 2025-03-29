from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import mediapipe as mp
import base64
import json
import time
from fastapi import HTTPException

### Create FastAPI instance with custom docs and openapi url
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

print("Starting FastAPI server...")

blink_timestamps = []
blink_counter = 0

# Correct the dictionary by providing a value for "timestamp"
amb_light_data = {"ambient_light": "light", "timestamp": None}
last_known_state = None  # Initialize the last known state
state_changes = []  # List to store state changes

direction_changes = []  # List to store direction changes
last_known_direction = None  # Initialize the last known direction

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

# Add a debounce time (in seconds)
DEBOUNCE_TIME = 0.5
last_change_time = time.time()

def detect_eye_direction(frame):
    """
    Detect eye gaze direction by tracking pupil positions relative to eye corners.
    Returns: "left", "right", "center", or "unknown".
    """
    global last_known_direction, direction_changes, last_change_time

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
    #print(f"Left pupil ratio X: {left_pupil_ratio_x:.3f}, Right pupil ratio X: {right_pupil_ratio_x:.3f}, Avg X: {avg_pupil_ratio_x:.3f}")
    #print(f"Left pupil ratio Y: {left_pupil_ratio_y:.3f}, Right pupil ratio Y: {right_pupil_ratio_y:.3f}, Avg Y: {avg_pupil_ratio_y:.3f}")
    
    # Define direction based on the horizontal and vertical average pupil ratio
    if avg_pupil_ratio_x < 0.45:
        current_direction = "right"
    elif avg_pupil_ratio_x > 0.55:
        current_direction = "left"
    else:
        current_direction = "center"

    # Check if the direction has changed
    current_time = time.time()
    if last_known_direction is None:
        # Initialize the last known direction
        last_known_direction = current_direction
        direction_changes.append({
            "looking_away": 0 if current_direction == "center" else 1,
            "timestamp": current_time
        })
    elif current_direction != last_known_direction and (current_time - last_change_time) > DEBOUNCE_TIME:
        # Direction has changed and debounce time has passed
        direction_changes.append({
            "looking_away": 0 if current_direction == "center" else 1,
            "timestamp": current_time
        })
        last_known_direction = current_direction  # Update the last known direction
        last_change_time = current_time  # Update the last change time

    return current_direction


def process_ambient_light(frame):
    try:
        #print("Processing ambient light")
        
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
    Returns: (bool, list) - A tuple containing blink status and updated timestamps
    """
    global blink_counter
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

    #print(f"Left EAR: {left_ear:.3f}, Right EAR: {right_ear:.3f}, Avg EAR: {avg_ear:.3f}")
    
    # Dynamic threshold adjustment based on current average EAR (could be optimized with training)
    EAR_THRESHOLD = 0.25  # Threshold decreases when the person is blinking more
    #print(f"Adjusted EAR Threshold: {EAR_THRESHOLD:.3f}")
    
    # Convert numpy.bool_ to Python bool before returning
    is_blinking = bool(avg_ear < EAR_THRESHOLD)  # Convert to Python bool

    if is_blinking:
        # Only append timestamp if this is the start of a new blink
        current_time = time.time()
        # Only append if enough time has passed since last blink (0.5s threshold)
        if not blink_timestamps or current_time - blink_timestamps[-1] >= 0.25:
            blink_counter += 1
            blink_timestamps.append(time.time())
            print(f"Blink detected! EAR: {avg_ear:.3f}")
    print(blink_counter)
    return {
        "is_blinking": is_blinking,
        "blink_timestamps": blink_timestamps
    }

@app.post("/api/py/detect-eye-direction")
async def detect_direction(request: Request):
    global last_known_direction, direction_changes
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
            "is_blinking": False,
            "direction_changes": direction_changes 
        }
        
        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0]
            
            # Detect eye direction
            response_data["direction"] = detect_eye_direction(frame)
            
            # Detect blink and extract is_blinking from the returned dictionary
            blink_result = detect_blink(face_landmarks, img_w, img_h)
            response_data["is_blinking"] = bool(blink_result["is_blinking"])
        
        print(response_data)
        return response_data
        
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        return {"error": str(e), "status": "error", "direction_changes": direction_changes}

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
        
        # Default response
        response = {
            "is_blinking": False,
            "blink_timestamps": []
        }
        
        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0]
            # Get the result dictionary from detect_blink
            blink_result = detect_blink(face_landmarks, img_w, img_h)
            response = blink_result  # Use the complete result dictionary
        print(response)
        return response
        
    except Exception as e:
        print(f"Error processing frame for blink: {str(e)}")
        return {"error": str(e), "status": "error", "is_blinking": False, "blink_timestamps": []}


@app.post("/api/py/detect-ambient-light")
async def detect_ambient_light_endpoint(request: Request):
    global last_known_state, state_changes
    try:
        # Get the frame data from the request
        data = await request.json()
        image_data = data['frame'].split(',')[1]  # Remove the data URL prefix
        
        # Decode base64 image
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Calculate ambient light regardless of face detection
        brightness = process_ambient_light(frame)
        
        # Determine the current state based on brightness
        current_state = "bright" if brightness >= 70 else "dark"
        
        # Check if the state has changed
        if last_known_state is None:
            # Initialize the last known state
            last_known_state = current_state
            amb_light_data["timestamp"] = time.time()  # Store initial timestamp
            state_changes.append(amb_light_data.copy())  # Store initial state
        elif current_state != last_known_state:
            # State has changed, update the timestamp and state
            amb_light_data["ambient_light"] = current_state
            amb_light_data["timestamp"] = time.time()
            last_known_state = current_state  # Update the last known state
            state_changes.append(amb_light_data.copy())  # Store state change
        
        response_data = {
            "amb_light": amb_light_data["ambient_light"],
            "timestamp": amb_light_data["timestamp"],
            "state_changes": state_changes  # Include state changes in the response
        }
        print(response_data)
        return response_data
        
    except Exception as e:
        print(f"Error processing frame for ambient light: {str(e)}")
        return {"error": str(e), "status": "error"}


@app.get("/api/py/helloFastApi")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}