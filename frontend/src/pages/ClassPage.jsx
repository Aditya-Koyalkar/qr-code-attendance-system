import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import axios from "axios";
import { BACKEND_URL } from "../lib/env";

export default function ClassPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);
  const [classDetails, setClassDetails] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showCreateAttendanceModal, setShowCreateAttendanceModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentAttendanceHistory, setStudentAttendanceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: "",
    rollNo: "",
    parentEmail: "",
    email: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceDateTime, setAttendanceDateTime] = useState("");
  const [attendances, setAttendances] = useState([]);
  const [qrCode, setQrCode] = useState(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isSignedIn) {
      fetchClassDetails();
      fetchAttendances();
    }
  }, [isSignedIn, id]);

  const fetchClassDetails = async () => {
    try {
      const [classResponse, studentsResponse, attendancesResponse] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/classes/${id}`),
        axios.get(`${BACKEND_URL}/api/students/${id}`),
        axios.get(`${BACKEND_URL}/api/attendances/${id}`),
      ]);

      // Get all attendance sessions for this class
      const attendanceSessions = attendancesResponse.data;

      // Get all attendance logs for these sessions
      const attendanceLogs = await Promise.all(
        attendanceSessions.map((session) => axios.get(`${BACKEND_URL}/api/attendance/${session._id}/students`))
      );

      // Calculate attendance rate for each student
      const studentsWithAttendance = studentsResponse.data.map((student) => {
        const totalSessions = attendanceSessions.length;
        const presentSessions = attendanceLogs.reduce((count, logResponse) => {
          const studentLog = logResponse.data.find((log) => log._id === student._id);
          return count + (studentLog?.hasMarkedAttendance ? 1 : 0);
        }, 0);

        const attendanceRate = totalSessions > 0 ? (presentSessions / totalSessions) * 100 : 0;

        return {
          ...student,
          attendanceRate: attendanceRate.toFixed(1),
        };
      });

      setClassDetails(classResponse.data);
      setStudents(studentsWithAttendance);
    } catch (error) {
      console.error("Error fetching class details:", error);
      setError("Failed to load class details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendances = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/attendances/${id}`);
      setAttendances(response.data);
    } catch (error) {
      console.error("Error fetching attendances:", error);
      setError("Failed to load attendance records. Please try again.");
    }
  };

  const handleCreateAttendance = async (e) => {
    e.preventDefault();
    if (!attendanceDateTime.trim()) {
      setError("Please select a date and time");
      return;
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/create-attendance`, {
        classId: id,
        date: attendanceDateTime,
      });

      setQrCode(response.data.qrCode);
      setAttendances([...attendances, { _id: response.data.attendanceId, date: attendanceDateTime }]);
      setAttendanceDateTime("");
      setShowCreateAttendanceModal(false);
      setError("");
    } catch (error) {
      console.error("Error creating attendance:", error);
      setError("Failed to create attendance session. Please try again.");
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.rollNo || !newStudent.parentEmail || !newStudent.email) {
      setError("All fields are required");
      return;
    }

    try {
      setLoading(true); // Set loading state
      const response = await axios.post(`${BACKEND_URL}/api/students`, {
        ...newStudent,
        classId: id,
      });

      // Refresh the data
      await Promise.all([fetchClassDetails(), fetchAttendances()]);

      setShowAddStudentModal(false);
      setNewStudent({ name: "", rollNo: "", parentEmail: "", email: "" });
      setError("");
      setSuccess("Student added successfully. A verification email has been sent to the student.");

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error adding student:", error);
      setError(error.response?.data?.error || "Failed to add student");
    } finally {
      setLoading(false); // Clear loading state
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (
      !window.confirm(
        "Are you sure you want to remove this student? This will also delete all their attendance records. This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setError(""); // Clear any existing errors
      const response = await axios.delete(`${BACKEND_URL}/api/students/${studentId}`);
      setSuccess(
        `Student ${response.data.deletedStudent.name} (${response.data.deletedStudent.rollNo}) has been removed successfully. All attendance records have been deleted.`
      );

      // Revalidate all data
      await Promise.all([
        fetchClassDetails(), // Refresh students list
        fetchAttendances(), // Refresh attendance records
      ]);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error deleting student:", error);
      if (error.response?.status === 404) {
        setError("Student not found. They may have already been deleted.");
      } else {
        setError(error.response?.data?.error || "Failed to remove student and their records. Please try again.");
      }
      // Clear error message after 5 seconds
      setTimeout(() => {
        setError("");
      }, 5000);
    }
  };

  const handleViewHistory = async (student) => {
    setSelectedStudent(student);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/students/${student._id}/attendance-history`);
      setStudentAttendanceHistory(response.data);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      setError("Failed to load attendance history. Please try again.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteAttendance = async (attendanceId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this attendance session? This will delete all attendance records for this session. This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.delete(`${BACKEND_URL}/api/attendance/${attendanceId}`);
      setSuccess(`Attendance session for ${new Date(response.data.deletedAttendance.date).toLocaleString()} has been deleted successfully.`);

      // Refresh the data
      await Promise.all([fetchClassDetails(), fetchAttendances()]);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error deleting attendance:", error);
      setError(error.response?.data?.error || "Failed to delete attendance session");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (student) => student.name.toLowerCase().includes(searchQuery.toLowerCase()) || student.rollNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isSignedIn) {
    navigate("/signin");
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate("/dashboard")} className="text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">{classDetails?.name}</h1>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowCreateAttendanceModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-300 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Create Attendance
              </button>
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Student
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>}
        {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">{success}</div>}

        {/* Attendance Records */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance Records</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attendances.map((attendance) => (
              <div key={attendance._id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium text-gray-900">{new Date(attendance.date).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => navigate(`/attendance/${attendance._id}`)} className="text-blue-600 hover:text-blue-900 p-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteAttendance(attendance._id)} className="text-red-600 hover:text-red-900 p-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {attendances.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500">No attendance records yet. Create one to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Search and Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="bg-blue-50 px-4 py-2 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Total Students</p>
                <p className="text-2xl font-semibold text-blue-700">{students.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Students List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.rollNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          student.isVerified ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {student.isVerified ? (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Verified
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pending
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2.5 mr-2">
                          <div
                            className={`h-2.5 rounded-full ${
                              student.attendanceRate >= 75 ? "bg-green-600" : student.attendanceRate >= 50 ? "bg-yellow-600" : "bg-red-600"
                            }`}
                            style={{ width: `${student.attendanceRate}%` }}
                          ></div>
                        </div>
                        <span>{student.attendanceRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleViewHistory(student)} className="text-blue-600 hover:text-blue-900 mr-4 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View History
                      </button>
                      <button onClick={() => handleDeleteStudent(student._id)} className="text-red-600 hover:text-red-900 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchQuery ? "No students found matching your search." : "No students added yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Student Modal */}
        {showAddStudentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Add New Student</h2>
                <button
                  onClick={() => {
                    setShowAddStudentModal(false);
                    setNewStudent({ name: "", rollNo: "", parentEmail: "", email: "" });
                    setError("");
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleAddStudent}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="rollNo" className="block text-sm font-medium text-gray-700">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      id="rollNo"
                      value={newStudent.rollNo}
                      onChange={(e) => setNewStudent({ ...newStudent, rollNo: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Student Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700">
                      Parent Email
                    </label>
                    <input
                      type="email"
                      id="parentEmail"
                      value={newStudent.parentEmail}
                      onChange={(e) => setNewStudent({ ...newStudent, parentEmail: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddStudentModal(false);
                      setNewStudent({ name: "", rollNo: "", parentEmail: "", email: "" });
                      setError("");
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
                    Add Student
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Attendance Modal */}
        {showCreateAttendanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Create Attendance Session</h2>
                <button
                  onClick={() => {
                    setShowCreateAttendanceModal(false);
                    setAttendanceDateTime("");
                    setError("");
                    setQrCode(null);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {!qrCode ? (
                <form onSubmit={handleCreateAttendance}>
                  <div className="mb-4">
                    <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 mb-2">
                      Date and Time
                    </label>
                    <input
                      type="datetime-local"
                      id="dateTime"
                      value={attendanceDateTime}
                      onChange={(e) => setAttendanceDateTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateAttendanceModal(false);
                        setAttendanceDateTime("");
                        setError("");
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-300"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
                      Create Session
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">Share this QR code with your students to mark attendance</p>
                  <img src={qrCode} alt="Attendance QR Code" className="mx-auto mb-4 max-w-[200px]" />
                  <button
                    onClick={() => {
                      setShowCreateAttendanceModal(false);
                      setQrCode(null);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendance History Modal */}
        {showHistoryModal && selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Attendance History</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedStudent.name} - Roll No: {selectedStudent.rollNo}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedStudent(null);
                    setStudentAttendanceHistory([]);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {studentAttendanceHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {studentAttendanceHistory.map((record) => (
                            <tr key={record._id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(record.date).toLocaleDateString()}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    record.status === "present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {record.status === "present" ? "Present" : "Absent"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {record.markedAt ? new Date(record.markedAt).toLocaleTimeString() : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No attendance records found for this student.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
