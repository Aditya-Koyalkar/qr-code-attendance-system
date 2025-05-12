import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import SignInPage from "./pages/SignIn";
import ProtectedRoute from "./layouts/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ClassPage from "./pages/ClassPage";
import AttendancePage from "./pages/AttendancePage";
import MarkAttendance from "./pages/MarkAttendance";
import LandingPage from "./pages/LandingPage";
import "./App.css";
import MarkAttendancePage from "./pages/MarkAttendancePage";
import VerifyStudentPage from "./pages/VerifyStudentPage";

export default function App() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={isSignedIn ? <Navigate to="/dashboard" replace /> : <SignInPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/class/:id"
          element={
            <ProtectedRoute>
              <ClassPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance/:id"
          element={
            <ProtectedRoute>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mark-attendance/:id"
          element={
            <ProtectedRoute>
              <MarkAttendancePage />
            </ProtectedRoute>
          }
        />
        <Route path="/verify-student/:token" element={<VerifyStudentPage />} />

        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
