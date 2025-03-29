import cv2
import mediapipe as mp
import numpy as np
import time
from scipy.spatial import distance as dist

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)
mp_drawing = mp.solutions.drawing_utils
drawing_spec = mp_drawing.DrawingSpec(thickness=1, circle_radius=1)

# MediaPipe indices for left and right eyes
# For MediaPipe Face Mesh, eye landmarks are different from dlib
# Left eye indices
LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
# Right eye indices
RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]

# Function to calculate Eye Aspect Ratio (EAR)
def eye_aspect_ratio(eye_landmarks):
    # Vertical eye landmarks (top, bottom)
    A = dist.euclidean(eye_landmarks[0], eye_landmarks[4])
    B = dist.euclidean(eye_landmarks[1], eye_landmarks[5])
    
    # Horizontal eye landmarks (left, right)
    C = dist.euclidean(eye_landmarks[2], eye_landmarks[3])
    
    # Calculate EAR
    ear = (A + B) / (2.0 * C)
    return ear

def detect_blinks():
    blink_timestamps = []
    # Define constants
    EYE_AR_THRESH = 3.0  # EAR threshold for blink detection (may need adjustment for MediaPipe)
    EYE_AR_CONSEC_FRAMES = 1  # Number of consecutive frames for blink
    
    # Initialize counters
    COUNTER = 0
    TOTAL_BLINKS = 0
    
    # Initialize webcam
    print("Starting video stream...")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return
    
    # Allow the camera to warm up
    time.sleep(1.0)
    
    print("Blink detection activated. Press 'q' to quit.")
    
    while True:
        
        # Read frame
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to capture image")
            break
        
        # Flip the image horizontally for a later selfie-view display
        frame = cv2.flip(frame, 1)
        
        # Convert the BGR image to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process the frame with MediaPipe Face Mesh
        results = face_mesh.process(rgb_frame)
        
        # Draw the face mesh annotations on the image
        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                mp_drawing.draw_landmarks(
                    image=frame,
                    landmark_list=face_landmarks,
                    connections=mp_face_mesh.FACEMESH_TESSELATION,
                    landmark_drawing_spec=None,
                    connection_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=1, circle_radius=1)
                )
                
                # Extract eye landmarks
                left_eye_landmarks = []
                right_eye_landmarks = []
                
                for idx in LEFT_EYE:
                    lm = face_landmarks.landmark[idx]
                    left_eye_landmarks.append((int(lm.x * frame.shape[1]), int(lm.y * frame.shape[0])))
                
                for idx in RIGHT_EYE:
                    lm = face_landmarks.landmark[idx]
                    right_eye_landmarks.append((int(lm.x * frame.shape[1]), int(lm.y * frame.shape[0])))
                
                # Calculate EAR for both eyes
                # We'll use a subset of landmarks for EAR calculation
                left_ear = eye_aspect_ratio([
                    left_eye_landmarks[0],   # top
                    left_eye_landmarks[8],   # top
                    left_eye_landmarks[12],  # right
                    left_eye_landmarks[4],   # left
                    left_eye_landmarks[5],   # bottom
                    left_eye_landmarks[11]   # bottom
                ])
                
                right_ear = eye_aspect_ratio([
                    right_eye_landmarks[0],   # top
                    right_eye_landmarks[8],   # top
                    right_eye_landmarks[12],  # right
                    right_eye_landmarks[4],   # left
                    right_eye_landmarks[5],   # bottom
                    right_eye_landmarks[11]   # bottom
                ])
                
                # Average the EAR together for both eyes
                ear = (left_ear + right_ear) / 2.0
                
                # Check if EAR is below the blink threshold
                if ear > EYE_AR_THRESH:
                    COUNTER += 1
                    blink_timestamp = time.time()
                    print(blink_timestamp)
                    # Add blink timestamp to array
                    blink_timestamps.append(blink_timestamp)
                else:
                    # If the eyes were closed for a sufficient number of frames,
                    # increment the total number of blinks
                    if COUNTER >= EYE_AR_CONSEC_FRAMES:
                        TOTAL_BLINKS += 1
                    
                    # Reset the frame counter
                    COUNTER = 0
                
                # Display the EAR and blink count
                cv2.putText(frame, f"EAR: {ear:.2f}", (300, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                cv2.putText(frame, f"Blinks: {TOTAL_BLINKS}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                
                # If eyes are currently closed, display "BLINK DETECTED"
                if COUNTER >= EYE_AR_CONSEC_FRAMES:
                    cv2.putText(frame, "BLINK DETECTED!", (10, 60),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        # Display the frame
        cv2.imshow("Blink Detection", frame)
        
        # Break the loop when 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    # Release the webcam and close windows
    cap.release()
    cv2.destroyAllWindows()
    
    # Print the entire blink_timestamps array
    print("\nBlink Timestamps Array:")
    print(blink_timestamps)
    
    return blink_timestamps

if __name__ == "__main__":
    detect_blinks()