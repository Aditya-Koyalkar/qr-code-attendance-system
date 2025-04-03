import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL } from "../lib/env";

const MarkAttendance = () => {
  const { id: attendanceId } = useParams(); // Get attendance ID from URL
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    verifyConstraints();
  }, []);

  // Step 1: Verify IP and Device Constraints
  const verifyConstraints = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/attendance/${attendanceId}/verify`);

      if (response.data.success) {
        fetchStudents();
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError("Failed to verify constraints. Please try again.");
    }
  };

  // Step 2: Fetch students for this attendance session
  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/attendance/${attendanceId}/students`);
      setStudents(response.data);
    } catch (error) {
      setError("Failed to load students.");
    }
  };

  // Step 3: Handle Attendance Submission
  const handleMarkAttendance = async () => {
    if (!selectedStudentId) return alert("Please select a student.");

    try {
      const response = await axios.post(`${BACKEND_URL}/api/mark-attendance/${attendanceId}`, { studentId: selectedStudentId });

      if (response.data.success) {
        alert("Attendance marked successfully!");
        navigate("/"); // Redirect after marking attendance
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError("Failed to mark attendance.");
    }
  };

  return (
    <div>
      <h1>Mark Attendance</h1>
      {error ? <p style={{ color: "red" }}>{error}</p> : null}

      {students.length > 0 && (
        <>
          <h2>Select Your Name</h2>
          <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
            <option value="">Select Student</option>
            {students.map((student) => (
              <option key={student._id} value={student._id}>
                {student.name} (Roll No: {student.rollNo})
              </option>
            ))}
          </select>
          <button onClick={handleMarkAttendance}>Mark Attendance</button>
        </>
      )}
    </div>
  );
};

export default MarkAttendance;
