import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import axios from "axios";
import { BACKEND_URL } from "../lib/env";

export default function AttendancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [attendanceStats, setAttendanceStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    percentage: 0,
  });

  useEffect(() => {
    if (isSignedIn) {
      fetchAttendanceDetails();
    }
  }, [isSignedIn, id]);

  const fetchAttendanceDetails = async () => {
    try {
      const [attendanceResponse, studentsResponse] = await Promise.all([
        axios.get(`${BACKEND_URL}/attendance/${id}`),
        axios.get(`${BACKEND_URL}/api/attendance/${id}/students`),
      ]);

      setAttendance(attendanceResponse.data);
      setStudents(studentsResponse.data);

      // Calculate attendance stats
      const totalStudents = studentsResponse.data.length;
      const presentStudents = studentsResponse.data.filter((student) => student.marked).length;
      const absentStudents = totalStudents - presentStudents;
      const percentage = totalStudents > 0 ? (presentStudents / totalStudents) * 100 : 0;

      setAttendanceStats({
        total: totalStudents,
        present: presentStudents,
        absent: absentStudents,
        percentage: percentage.toFixed(1),
      });
    } catch (error) {
      console.error("Error fetching attendance details:", error);
      setError("Failed to load attendance details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
              <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Attendance Session</h1>
            </div>
            <div className="text-sm text-gray-500">{attendance?.date && new Date(attendance.date).toLocaleString()}</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QR Code Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance QR Code</h2>
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg shadow-md mb-4">
                <img src={attendance?.qrCode} alt="Attendance QR Code" className="w-64 h-64 object-contain" />
              </div>
              <p className="text-sm text-gray-600 text-center mb-4">
                Share this QR code with your students to mark their attendance. Students must be on the same WiFi network to mark attendance.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/mark-attendance/${id}`;
                    navigator.clipboard.writeText(link);
                    alert("Link copied to clipboard!");
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                  Copy Link
                </button>
                <button
                  onClick={() => {
                    const canvas = document.createElement("canvas");
                    const img = new Image();
                    img.src = attendance?.qrCode;
                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      const ctx = canvas.getContext("2d");
                      ctx.drawImage(img, 0, 0);
                      const link = document.createElement("a");
                      link.download = `attendance-qr-${new Date().toISOString()}.png`;
                      link.href = canvas.toDataURL();
                      link.click();
                    };
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-300 flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download QR
                </button>
              </div>
            </div>
          </div>

          {/* Attendance Stats Section */}
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-500 font-medium">Total Students</p>
                <p className="text-2xl font-semibold text-gray-900">{attendanceStats.total}</p>
              </div>
              <div className="bg-green-50 rounded-lg shadow-sm p-4">
                <p className="text-sm text-green-600 font-medium">Present</p>
                <p className="text-2xl font-semibold text-green-700">{attendanceStats.present}</p>
              </div>
              <div className="bg-red-50 rounded-lg shadow-sm p-4">
                <p className="text-sm text-red-600 font-medium">Absent</p>
                <p className="text-2xl font-semibold text-red-700">{attendanceStats.absent}</p>
              </div>
              <div className="bg-blue-50 rounded-lg shadow-sm p-4">
                <p className="text-sm text-blue-600 font-medium">Attendance Rate</p>
                <p className="text-2xl font-semibold text-blue-700">{attendanceStats.percentage}%</p>
              </div>
            </div>

            {/* Students List */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Student Attendance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.rollNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              student.marked ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {student.marked ? "Present" : "Absent"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.markedAt ? new Date(student.markedAt).toLocaleTimeString() : "-"}
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                          No students in this class.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
