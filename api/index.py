from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import mediapipe as mp
import base64
import json
import time
from fastapi import HTTPException
import firebase_admin
from firebase_admin import credentials, messaging
import asyncio
import os
from typing import Dict
from contextlib import asynccontextmanager

### Create FastAPI instance with custom docs and openapi url
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    asyncio.create_task(send_notifications())
    yield
    # Shutdown
    pass

app = FastAPI(
    docs_url="/api/py/docs", 
    openapi_url="/api/py/openapi.json",
    lifespan=lifespan
)

print("Starting FastAPI server...")

blink_timestamps = []
blink_counter = 0

# Correct the dictionary by providing a value for "timestamp"
amb_light_data = {"ambient_light": "light", "timestamp": None}
last_known_state = None  # Initialize the last known state
state_changes = []  # List to store state changes

direction_changes = []  # List to store direction changes
last_known_direction = None  # Initialize the last known direction


# Initialize global variables for distance tracking
distance_changes = []  # List to store distance changes
last_known_distance_state = None  # Initialize the last known distance state
state_start_time = time.time()  # Track the start time of the current state


# Initialize Firebase Admin SDK
cred = credentials.Certificate("firebase-credentials.json")
firebase_admin.initialize_app(cred)

# Store FCM tokens
fcm_tokens: Dict[str, str] = {}

# Variables for look away notification debouncing
LOOKAWAY_NOTIFICATION_COOLDOWN = 30  # Seconds between notifications
last_lookaway_notification_time = 0

# Function to send look away notification
def send_lookaway_notification():
    global last_lookaway_notification_time
    current_time = time.time()
    
    # Check if enough time has passed since the last notification
    if current_time - last_lookaway_notification_time < LOOKAWAY_NOTIFICATION_COOLDOWN:
        return
    
    try:
        for token in fcm_tokens.values():
            message = messaging.Message(
                notification=messaging.Notification(
                    title="Look Away Reminder",
                    body="Please take a break and look away from the screen for 20 seconds!"
                ),
                token=token
            )
            try:
                messaging.send(message)
                print(f"Look away notification sent successfully to token: {token[:10]}...")
                last_lookaway_notification_time = current_time  # Update last notification time
            except Exception as e:
                print(f"Failed to send look away notification to token {token[:10]}...: {str(e)}")
    except Exception as e:
        print(f"Error sending look away notification: {str(e)}")

# Variables for notification debouncing
DISTANCE_NOTIFICATION_COOLDOWN = 30  # Seconds between notifications
last_distance_notification_time = 0
BLINK_NOTIFICATION_COOLDOWN = 10  # Seconds between blink notifications
last_blink_notification_time = 0
last_blink_time = time.time()  # Track the last time user blinked

# Function to send distance warning notification
def send_distance_warning_notification():
    global last_distance_notification_time
    current_time = time.time()
    
    # Check if enough time has passed since the last notification
    if current_time - last_distance_notification_time < DISTANCE_NOTIFICATION_COOLDOWN:
        return
    
    try:
        for token in fcm_tokens.values():
            message = messaging.Message(
                notification=messaging.Notification(
                    title="Distance Warning",
                    body="You're too close to the screen! Please lean back for better posture."
                ),
                token=token
            )
            try:
                messaging.send(message)
                print(f"Distance warning notification sent successfully to token: {token[:10]}...")
                last_distance_notification_time = current_time  # Update last notification time
            except Exception as e:
                print(f"Failed to send distance warning notification to token {token[:10]}...: {str(e)}")
    except Exception as e:
        print(f"Error sending distance warning notification: {str(e)}")

# Function to send blink reminder notification
def send_blink_reminder_notification():
    global last_blink_notification_time
    current_time = time.time()
    
    # Check if enough time has passed since the last notification
    if current_time - last_blink_notification_time < BLINK_NOTIFICATION_COOLDOWN:
        return
    
    try:
        for token in fcm_tokens.values():
            message = messaging.Message(
                notification=messaging.Notification(
                    title="Blink Reminder",
                    body="Remember to blink! Your eyes need moisture to stay healthy."
                ),
                token=token
            )
            try:
                messaging.send(message)
                print(f"Blink reminder notification sent successfully to token: {token[:10]}...")
                last_blink_notification_time = current_time  # Update last notification time
            except Exception as e:
                print(f"Failed to send blink reminder notification to token {token[:10]}...: {str(e)}")
    except Exception as e:
        print(f"Error sending blink reminder notification: {str(e)}")

# Background notification task
async def send_notifications():
    print("Starting notification service...")
    while True:
        try:
            # Create a list to store coroutines
            # tasks = []
            # for token in fcm_tokens.values():
            #     message = messaging.Message(
            #         notification=messaging.Notification(
            #             title="Posture Check",
            #             body="Remember to lean back and maintain good posture!"
            #         ),
            #         token=token
            #     )
            #     try:
            #         # Send message synchronously since firebase-admin doesn't support async
            #         messaging.send(message)
            #         print(f"Notification sent successfully to token: {token[:10]}...")
            #     except Exception as e:
            #         print(f"Failed to send notification to token {token[:10]}...: {str(e)}")
            
            # Wait for 10 seconds before sending next batch
            await asyncio.sleep(10)
        except Exception as e:
            print(f"Error in notification service: {str(e)}")
            await asyncio.sleep(1)  # Wait briefly before retrying

@app.post("/api/py/register-fcm-token")
async def register_fcm_token(request: Request):
    try:
        data = await request.json()
        user_id = data.get("userId", "default")
        token = data.get("token")
        
        if not token:
            raise HTTPException(status_code=400, detail="FCM token is required")
        
        fcm_tokens[user_id] = token
        return {"message": "FCM token registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

        # Send notification when user looks away from the screen
        if current_direction in ["left", "right"]:
            send_lookaway_notification()
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
    global blink_timestamps, blink_counter, last_blink_time
    """
    Detect if the person is blinking by calculating the eye aspect ratio (EAR)
    Returns: Object with blinks and blink_timestamps
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

    # Dynamic threshold adjustment based on current average EAR
    EAR_THRESHOLD = 0.25
    
    # Convert numpy.bool_ to Python bool before returning
    is_blinking = bool(avg_ear < EAR_THRESHOLD)

    current_time = time.time()
    
    if is_blinking:
        # Only append timestamp if this is the start of a new blink
        # Only append if enough time has passed since last blink (0.25s threshold)
        if not blink_timestamps or current_time - blink_timestamps[-1] >= 0.25:
            blink_counter += 1
            blink_timestamps.append(current_time)
            last_blink_time = current_time  # Update last blink time
            print(f"Blink detected! EAR: {avg_ear:.3f}")
    else:
        # Check if it's been more than 5 seconds since the last blink
        if current_time - last_blink_time > 5:
            send_blink_reminder_notification()
    
    return {
        "is_blinking": is_blinking,
        "blink_timestamps": blink_timestamps
    }

@app.post("/api/py/detect-eye-direction")
async def detect_direction(request: Request):
    global direction_changes, last_known_direction, last_change_time

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
    global blink_timestamps, blink_counter
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
    global last_known_state, state_changes, last_change_time

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

def check_distance(frame):
    global last_known_distance_state, distance_changes, state_start_time

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

        # Determine the current distance state
        if distance < 50:
            current_distance_state = "close"
            # Send notification when user is too close
            send_distance_warning_notification()
        elif 50 <= distance <= 100:
            current_distance_state = "med"
        else:
            current_distance_state = "far"

        # Check if the distance state has changed
        current_time = time.time()
        if last_known_distance_state is None:
            # Initialize the last known distance state
            last_known_distance_state = current_distance_state
            state_start_time = current_time  # Initialize the start time
        elif current_distance_state != last_known_distance_state:
            # State has changed, log the time spent in the previous state

            distance_changes.append({
                "distance": last_known_distance_state,
                "start_time": state_start_time,
                "end_time": current_time,
            })
            # Update the last known state and start time
            last_known_distance_state = current_distance_state
            state_start_time = current_time

        # Visualize key points (optional)
        cv2.line(frame, (0, y1), (iw, y1), (0, 255, 0), 1)
        cv2.line(frame, (0, y2), (iw, y2), (0, 0, 255), 1)
        cv2.putText(frame, f"{distance:.2f} cm", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

    return distance


@app.post("/api/py/check-distance")
async def check_distance_endpoint(request: Request):
    global distance_changes

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
            "distance_cm": distance_cm,
            "distance_changes": distance_changes  # Include distance changes in the response

        }
        
        print(f"Distance: {distance_cm:.2f} cm")
        return response_data
        
    except Exception as e:
        print(f"Error processing frame for distance check: {str(e)}")
        return {"error": str(e), "status": "error"}

@app.get("/api/py/helloFastApi")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}
