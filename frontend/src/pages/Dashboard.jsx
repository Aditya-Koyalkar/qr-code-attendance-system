import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL } from "../lib/env";

export default function Dashboard() {
  const { user, isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [facultyId, setFacultyId] = useState(null);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [newClass, setNewClass] = useState({
    name: "",
    year: "",
    branch: "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn) {
      createUserIfNotExists();
    }
  }, [isSignedIn]);

  const createUserIfNotExists = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/faculty`, {
        clerkId: user.id,
        name: user.fullName,
        email: user.primaryEmailAddress?.emailAddress,
      });

      const facultyResponse = await axios.get(`${BACKEND_URL}/api/faculty/${user.id}`);
      const fetchedFacultyId = facultyResponse.data._id;
      setFacultyId(fetchedFacultyId);

      // Create standard classes if they don't exist
      await axios.post(`${BACKEND_URL}/api/create-standard-classes`, {
        facultyId: fetchedFacultyId,
      });

      // Fetch classes after creating standard ones
      fetchClasses(fetchedFacultyId);
    } catch (error) {
      console.error("Error creating user or fetching facultyId:", error.response?.data || error.message);
      setError("Failed to initialize your account. Please try again.");
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
      setError("Failed to load your classes. Please refresh the page.");
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClass.name.trim() || !newClass.year || !newClass.branch) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/api/create-class`, {
        name: newClass.name,
        year: parseInt(newClass.year),
        branch: newClass.branch,
        facultyId: facultyId,
      });

      setClasses([...classes, response.data]);
      setNewClass({ name: "", year: "", branch: "" });
      setShowCreateModal(false);
      setError("");
    } catch (error) {
      console.error("Error creating class:", error);
      setError("Failed to create class. Please try again.");
    }
  };

  const handleDeleteClass = async (classId, className) => {
    setClassToDelete({ id: classId, name: className });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete) return;

    try {
      await axios.delete(`${BACKEND_URL}/api/classes/${classToDelete.id}`);
      setClasses(classes.filter((cls) => cls._id !== classToDelete.id));
      setShowDeleteConfirm(false);
      setClassToDelete(null);
    } catch (error) {
      console.error("Error deleting class:", error);
      setError("Failed to delete class. Please try again.");
    }
  };

  // Function to organize classes by year (no branch)
  const organizeClasses = (classes) => {
    const organized = {};
    classes.forEach((cls) => {
      const year = cls.year;
      if (!organized[year]) {
        organized[year] = [];
      }
      organized[year].push(cls);
    });
    return organized;
  };

  // Function to get year suffix
  const getYearSuffix = (year) => {
    switch (year) {
      case 1:
        return "1st";
      case 2:
        return "2nd";
      case 3:
        return "3rd";
      case 4:
        return "4th";
      default:
        return `${year}th`;
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

  const organizedClasses = organizeClasses(classes);
  const years = Object.keys(organizedClasses).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>}

        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome back, {user.fullName}!</h2>
          <p className="text-gray-600">Manage your classes and track attendance efficiently.</p>
        </div>

        {/* Years Grid */}
        {!selectedYear ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {years.map((year) => (
              <div
                key={year}
                onClick={() => setSelectedYear(year)}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition duration-300 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">{getYearSuffix(parseInt(year))} Year</h2>
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {/* Back button and Year header */}
            <div className="flex items-center mb-6">
              <button onClick={() => setSelectedYear(null)} className="mr-4 text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex justify-between items-center flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{getYearSuffix(parseInt(selectedYear))} Year</h2>
                <button
                  onClick={() => {
                    setNewClass({ ...newClass, year: selectedYear });
                    setShowCreateModal(true);
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Class
                </button>
              </div>
            </div>

            {/* Classes Grid (no branch grouping) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {organizedClasses[selectedYear].map((cls) => (
                <div key={cls._id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div onClick={() => navigate(`/class/${cls._id}`)} className="flex-1 cursor-pointer">
                      <span className="text-gray-900">{cls.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDeleteClass(cls._id, cls.name)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete Class"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && classToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Delete Class</h2>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setClassToDelete(null);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete the class "{classToDelete.name}"? This will also delete all associated students and attendance
                records. This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setClassToDelete(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-300"
                >
                  Cancel
                </button>
                <button onClick={confirmDeleteClass} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300">
                  Delete Class
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Class Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Create New Class</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewClass({ name: "", year: "", branch: "" });
                    setError("");
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleCreateClass}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Class Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={newClass.name}
                      onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                      placeholder="e.g. A, B, C"
                    />
                  </div>
                  <div>
                    <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                      Year
                    </label>
                    <select
                      id="year"
                      value={newClass.year}
                      onChange={(e) => setNewClass({ ...newClass, year: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="branch" className="block text-sm font-medium text-gray-700">
                      Branch
                    </label>
                    <select
                      id="branch"
                      value={newClass.branch}
                      onChange={(e) => setNewClass({ ...newClass, branch: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Branch</option>
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="EEE">EEE</option>
                      <option value="MECH">MECH</option>
                      <option value="CIVIL">CIVIL</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewClass({ name: "", year: "", branch: "" });
                      setError("");
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-300"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
                    Create Class
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
