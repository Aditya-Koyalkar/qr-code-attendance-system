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
  const [newStudent, setNewStudent] = useState({ name: "", rollNo: "", parentEmail: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceDateTime, setAttendanceDateTime] = useState("");
  const [attendances, setAttendances] = useState([]);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    if (isSignedIn) {
      fetchClassDetails();
      fetchAttendances();
    }
  }, [isSignedIn, id]);

  const fetchClassDetails = async () => {
    try {
      const [classResponse, studentsResponse] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/classes/${id}`),
        axios.get(`${BACKEND_URL}/api/students/${id}`),
      ]);

      setClassDetails(classResponse.data);
      setStudents(studentsResponse.data);
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
    if (!newStudent.name.trim() || !newStudent.rollNo.trim() || !newStudent.parentEmail.trim()) {
      setError("Please fill in all fields");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newStudent.parentEmail)) {
      setError("Please enter a valid parent email address");
      return;
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/api/students`, {
        name: newStudent.name,
        rollNo: newStudent.rollNo,
        classId: id,
        parentEmail: newStudent.parentEmail,
      });
      setStudents([...students, response.data]);
      setNewStudent({ name: "", rollNo: "", parentEmail: "" });
      setShowAddStudentModal(false);
      setError("");
    } catch (error) {
      console.error("Error adding student:", error);
      setError(error.response?.data?.error || "Failed to add student. Please try again.");
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm("Are you sure you want to remove this student?")) return;

    try {
      await axios.delete(`${BACKEND_URL}/api/students/${studentId}`);
      setStudents(students.filter((student) => student._id !== studentId));
    } catch (error) {
      console.error("Error deleting student:", error);
      setError("Failed to remove student. Please try again.");
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

  const filteredStudents = students.filter(
    (student) => student.name.toLowerCase().includes(searchQuery.toLowerCase()) || student.rollNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isSignedIn) {
    navigate("/signin");
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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

        {/* Attendance Records */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance Records</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attendances.map((attendance) => (
              <div
                key={attendance._id}
                onClick={() => navigate(`/attendance/${attendance._id}`)}
                className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition duration-300 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium text-gray-900">{new Date(attendance.date).toLocaleString()}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.rollNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2.5 mr-2">
                          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${student.attendanceRate || 0}%` }}></div>
                        </div>
                        <span>{student.attendanceRate || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleViewHistory(student)} className="text-blue-600 hover:text-blue-900 mr-4 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View History
                      </button>
                      <button onClick={() => handleDeleteStudent(student._id)} className="text-red-600 hover:text-red-900">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
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
                    setNewStudent({ name: "", rollNo: "", parentEmail: "" });
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
                    <label htmlFor="rollNo" className="block text-sm font-medium text-gray-700 mb-2">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      id="rollNo"
                      value={newStudent.rollNo}
                      onChange={(e) => setNewStudent({ ...newStudent, rollNo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter roll number"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Student Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter student name"
                    />
                  </div>
                  <div>
                    <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700 mb-2">
                      Parent/Guardian Email
                    </label>
                    <input
                      type="email"
                      id="parentEmail"
                      value={newStudent.parentEmail}
                      onChange={(e) => setNewStudent({ ...newStudent, parentEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter parent/guardian email"
                    />
                    <p className="mt-1 text-sm text-gray-500">Attendance notifications will be sent to this email address</p>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddStudentModal(false);
                      setNewStudent({ name: "", rollNo: "", parentEmail: "" });
                      setError("");
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-300"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
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
