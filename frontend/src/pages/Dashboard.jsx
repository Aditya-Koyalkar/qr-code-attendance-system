import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL } from "../lib/env";
export default function Dashboard() {
  const { user, isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [newClassName, setNewClassName] = useState("");
  const [facultyId, setFacultyId] = useState(null);

  const navigate = useNavigate();
  useEffect(() => {
    if (isSignedIn) {
      createUserIfNotExists();
    }
  }, [isSignedIn]);

  const createUserIfNotExists = async () => {
    try {
      // Create or verify faculty in backend
      await axios.post(`${BACKEND_URL}/api/faculty`, {
        clerkId: user.id,
        name: user.fullName,
        email: user.primaryEmailAddress?.emailAddress,
      });

      // Fetch faculty ID
      const facultyResponse = await axios.get(`${BACKEND_URL}/api/faculty/${user.id}`);
      const fetchedFacultyId = facultyResponse.data._id;

      // Set facultyId state and fetch classes immediately
      setFacultyId(fetchedFacultyId);
      fetchClasses(fetchedFacultyId);
    } catch (error) {
      console.error("Error creating user or fetching facultyId:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };
  const fetchClasses = async (id) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/classes/${id}`);
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;

    try {
      const response = await axios.post(`${BACKEND_URL}/api/create-class`, {
        name: newClassName,
        facultyId: facultyId,
      });

      navigate(`/class/${response.data._id}`);
    } catch (error) {
      console.error("Error creating class:", error);
    }
  };
  if (!isSignedIn) {
    navigate("/signin");
    return null;
  }
  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Welcome, {user.fullName}!</h1>
      <p>Create classes and manage attendance here.</p>
      <h2>Your Classes</h2>
      <ul>
        {classes.map((cls) => (
          <li key={cls._id} onClick={() => navigate(`/class/${cls._id}`)}>
            {cls.name}
          </li>
        ))}
      </ul>
      <input type="text" placeholder="Enter class name" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
      <button onClick={handleCreateClass}>Create Class</button>
    </div>
  );
}
