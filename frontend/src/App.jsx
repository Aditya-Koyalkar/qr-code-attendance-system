import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SignInPage from "./pages/SignIn";
import ProtectedRoute from "./layouts/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ClassPage from "./pages/ClassPage";
import AttendancePage from "./pages/AttendancePage";
import MarkAttendance from "./pages/MarkAttendance";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signin" element={<SignInPage />} />
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
          path={"/attendance/:id"}
          element={
            <ProtectedRoute>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route path="/mark-attendance" element={<MarkAttendance />} />
        <Route path="/" element={<>Hello</>} />
      </Routes>
    </Router>
  );
}
