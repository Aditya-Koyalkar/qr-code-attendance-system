import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import axios from "axios";
import { BACKEND_URL } from "../lib/env";

export default function MarkAttendancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSignedIn, user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [students, setStudents] = useState([]);
  const [showStudentList, setShowStudentList] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      verifyAttendance();
      fetchStudents();
    }
  }, [isSignedIn, id]);

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

  const handleMarkAttendance = async (studentId) => {
    try {
      setLoading(true);
      setError("");
      await axios.post(`${BACKEND_URL}/api/mark-attendance/${id}`, { studentId });
      setSuccess(true);
      setSelectedStudent(null);
      setShowStudentList(false);
    } catch (error) {
      console.error("Error marking attendance:", error);
      setError(error.response?.data?.message || "Failed to mark attendance");
    } finally {
      setLoading(false);
    }
  };

  if (!isSignedIn) {
    navigate("/signin");
    return null;
  }

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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Mark Attendance</h2>
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
            <p className="text-gray-600">Select your name from the list to mark attendance</p>
          </div>

          {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>}

          {!showStudentList ? (
            <button
              onClick={() => setShowStudentList(true)}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Select Your Name</span>
            </button>
          ) : (
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
                          handleMarkAttendance(student._id);
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
                        <div className="flex items-center space-x-2">
                          {student.hasMarkedAttendance ? (
                            <span className="text-green-600 text-sm font-medium flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              Marked
                            </span>
                          ) : selectedStudent?._id === student._id && loading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-center text-gray-500">No verified students found. Please verify your account first.</div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Make sure you are connected to the same WiFi network as your faculty</p>
          </div>
        </div>
      </div>
    </div>
  );
}
