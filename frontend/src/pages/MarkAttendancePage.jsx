import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL } from "../lib/env";

export default function MarkAttendancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [students, setStudents] = useState([]);
  const [showStudentList, setShowStudentList] = useState(false);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    verifyAttendance();
    fetchStudents();
  }, [id]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const verifyAttendance = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/attendance/${id}/verify`);
      if (response.data.success) {
        setAttendanceData(response.data);
      }
    } catch (error) {
      console.error("Error verifying attendance:", error);
      setError(error.response?.data?.message || "Failed to verify attendance session");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/attendance/${id}/students`);
      const verifiedStudents = response.data.filter((student) => student.isVerified);
      setStudents(verifiedStudents);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  // Camera functions
  const startCamera = async () => {
    console.log("Starting camera...");
    setCameraError(null);
    setIsCameraLoading(true);

    try {
      // Check if running in secure context
      if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
        throw new Error("Camera access requires HTTPS or localhost");
      }

      // Check browser support
      if (!navigator.mediaDevices) {
        console.error("mediaDevices not available");
        throw new Error("Your browser doesn't support camera access. Please use a modern browser.");
      }

      if (!navigator.mediaDevices.getUserMedia) {
        console.error("getUserMedia not available");
        throw new Error("Your browser doesn't support camera access. Please use a modern browser.");
      }

      // Stop any existing stream
      stopCamera();

      // Request camera access with basic constraints first
      console.log("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });
      console.log("Camera access granted:", stream);

      // Set up video stream
      if (videoRef.current) {
        console.log("Setting up video stream...");
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error("Video element not found"));
            return;
          }

          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded");
            resolve();
          };

          videoRef.current.onerror = (e) => {
            console.error("Video error:", e);
            reject(new Error("Failed to load video stream"));
          };

          // Set a timeout in case the video never loads
          setTimeout(() => {
            reject(new Error("Video stream timeout"));
          }, 5000);
        });

        setShowCamera(true);
        setIsCameraLoading(false);
        console.log("Camera started successfully");
      } else {
        throw new Error("Video element not found. Please refresh the page and try again.");
      }
    } catch (error) {
      console.error("Camera access error:", error);
      setIsCameraLoading(false);

      let errorMessage = "Failed to access camera. ";
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMessage += "Please allow camera access and refresh the page.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorMessage += "No camera found. Please connect a camera.";
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        errorMessage += "Camera is being used by another application.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage += "Camera doesn't support the required settings.";
      } else {
        errorMessage += error.message || "Unknown error occurred.";
      }

      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    console.log("Stopping camera...");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setShowCamera(false);
    setIsCameraLoading(false);
  };

  const capturePhoto = () => {
    console.log("Capturing photo...");
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      setCameraError("Video not ready. Please wait and try again.");
      return;
    }

    try {
      const canvas = canvasRef.current || document.createElement("canvas");
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const photoDataUrl = canvas.toDataURL("image/jpeg", 0.8);

      if (photoDataUrl && photoDataUrl !== "data:,") {
        setPhotoData(photoDataUrl);
        stopCamera();
        console.log("Photo captured successfully");
      } else {
        throw new Error("Failed to capture photo data");
      }
    } catch (error) {
      console.error("Photo capture error:", error);
      setCameraError("Failed to capture photo. Please try again.");
    }
  };

  const retakePhoto = () => {
    console.log("Retaking photo...");
    setPhotoData(null);
    setCameraError(null);
    startCamera();
  };

  const handleMarkAttendance = async (studentId) => {
    if (!photoData) {
      setError("Please take a photo first");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Extract base64 data
      const base64Data = photoData.split(",")[1];
      if (!base64Data) {
        throw new Error("Invalid photo data");
      }

      await axios.post(`${BACKEND_URL}/api/mark-attendance/${id}`, {
        studentId,
        photoData: base64Data,
      });

      setSuccess(true);
      setSelectedStudent(null);
      setShowStudentList(false);
      setPhotoData(null);
    } catch (error) {
      console.error("Error marking attendance:", error);
      const errorMessage = error.response?.data?.message || "Failed to mark attendance";
      const errorDetails = error.response?.data?.details || "";
      setError(errorDetails ? `${errorMessage}. ${errorDetails}` : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !attendanceData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying attendance session...</p>
        </div>
      </div>
    );
  }

  if (error && !attendanceData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to Mark Attendance Please ensure you are connected to the same WiFi network as your faculty and use the same device which you
              used to verify your email
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-green-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Attendance Marked Successfully!</h2>
            <p className="text-gray-600 mb-4">Your attendance has been recorded.</p>
            <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Mark Attendance</h1>
            <p className="text-gray-600">Select your name and take a photo to mark attendance</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Student Selection Section */}
          {!selectedStudent && !showStudentList && (
            <button
              onClick={() => setShowStudentList(true)}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Select Your Name</span>
            </button>
          )}

          {/* Student List */}
          {showStudentList && (
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search your name..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onChange={(e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    const filteredStudents = students.filter(
                      (student) => student.name.toLowerCase().includes(searchTerm) || student.rollNo.toLowerCase().includes(searchTerm)
                    );
                    setStudents(filteredStudents);
                  }}
                />
                <button onClick={() => setShowStudentList(false)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {students.length > 0 ? (
                  students.map((student) => (
                    <button
                      key={student._id}
                      onClick={() => {
                        if (!student.hasMarkedAttendance) {
                          setSelectedStudent(student);
                          setShowStudentList(false);
                          startCamera();
                        }
                      }}
                      disabled={loading || student.hasMarkedAttendance}
                      className={`w-full px-4 py-3 text-left transition duration-300 ${loading ? "opacity-50 cursor-not-allowed" : ""} ${
                        student.hasMarkedAttendance ? "bg-green-50 cursor-default" : "hover:bg-gray-50"
                      } ${selectedStudent?._id === student._id ? "bg-blue-50" : ""}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{student.name}</p>
                          <p className="text-sm text-gray-500">Roll No: {student.rollNo}</p>
                        </div>
                        {student.hasMarkedAttendance && (
                          <span className="text-green-600 text-sm font-medium flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Marked
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-center text-gray-500">No verified students found</div>
                )}
              </div>
            </div>
          )}

          {/* Camera Section */}
          {selectedStudent && !photoData && (
            <div className="mt-6 bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-3">Take Your Photo</h2>

              {/* Video Element */}
              <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full max-w-md mx-auto ${!showCamera ? "hidden" : ""}`}
                  style={{ transform: "scaleX(-1)" }}
                />
              </div>

              {!showCamera && !isCameraLoading && (
                <div className="space-y-4">
                  <button
                    onClick={startCamera}
                    className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                    disabled={isCameraLoading}
                  >
                    Start Camera
                  </button>
                  <p className="text-sm text-gray-500 text-center">Make sure you allow camera access when prompted</p>
                </div>
              )}

              {isCameraLoading && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-gray-600">Loading camera...</p>
                </div>
              )}

              {cameraError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  <p className="font-medium">{cameraError}</p>
                  <button onClick={startCamera} className="mt-2 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
                    Try Again
                  </button>
                </div>
              )}

              {showCamera && (
                <div className="space-y-4">
                  <div className="flex justify-center space-x-4">
                    <button onClick={capturePhoto} className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors">
                      📸 Capture Photo
                    </button>
                    <button onClick={stopCamera} className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Photo Preview and Submit Section */}
          {photoData && (
            <div className="mt-6 bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-3">Photo Preview</h2>
              <div className="space-y-4">
                <img src={photoData} alt="Captured photo" className="w-full max-w-md mx-auto rounded-lg shadow-md" />
                <div className="flex justify-center space-x-4">
                  <button onClick={retakePhoto} className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors">
                    Retake Photo
                  </button>
                  <button
                    onClick={() => handleMarkAttendance(selectedStudent._id)}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors"
                    disabled={loading}
                  >
                    {loading ? "Marking Attendance..." : "Submit Attendance"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Make sure you are connected to the same WiFi network as your faculty</p>
          </div>
        </div>
      </div>
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
