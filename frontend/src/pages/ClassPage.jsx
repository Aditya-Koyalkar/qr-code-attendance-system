import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BACKEND_URL } from "../lib/env";

const ClassPage = () => {
  const { id: classId } = useParams();
  const [students, setStudents] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [attendanceDateTime, setAttendanceDateTime] = useState("");
  const navigate = useNavigate();
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentRollNo, setNewStudentRollNo] = useState("");
  useEffect(() => {
    fetchStudents();
    fetchAttendances();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/students/${classId}`);
      setStudents(response.data);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };
  const fetchAttendances = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/attendances/${classId}`);
      setAttendances(response.data);
    } catch (error) {
      console.error("Error fetching attendances:", error);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentName.trim() || !newStudentRollNo.trim()) return;

    try {
      const response = await axios.post(`${BACKEND_URL}/api/students`, {
        name: newStudentName,
        rollNo: newStudentRollNo,
        classId,
      });

      setStudents([...students, response.data]); // Update state
      setNewStudentName("");
      setNewStudentRollNo("");
    } catch (error) {
      console.error("Error adding student:", error);
    }
  };
  const handleCreateAttendance = async () => {
    if (!attendanceDateTime.trim()) return;

    try {
      await axios.post(`${BACKEND_URL}/create-attendance`, {
        classId,
        date: attendanceDateTime,
      });

      fetchAttendances(); // Refresh attendance list
    } catch (error) {
      console.error("Error creating attendance:", error);
    }
  };
  return (
    <div>
      <h1>Class Details</h1>
      <h2>Students</h2>
      <ul>
        {students.map((student) => (
          <li key={student._id}>
            {student.name} (Roll No: {student.rollNo})
          </li>
        ))}
      </ul>
      <h2>Add Student</h2>
      <input type="text" placeholder="Student Name" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} />
      <input type="text" placeholder="Roll No" value={newStudentRollNo} onChange={(e) => setNewStudentRollNo(e.target.value)} />
      <button onClick={handleAddStudent}>Add Student</button>
      <h2>Attendance Records</h2>
      <ul>
        {attendances.map((attendance) => (
          <li onClick={() => navigate(`/attendance/${attendance._id}`)} key={attendance._id}>
            {attendance.date}
          </li>
        ))}
      </ul>
      <h2>Create Attendance</h2>
      <input type="datetime-local" value={attendanceDateTime} onChange={(e) => setAttendanceDateTime(e.target.value)} />
      <button onClick={handleCreateAttendance}>Create Attendance</button>
    </div>
  );
};

export default ClassPage;
