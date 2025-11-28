// ...existing code...
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./components/Landing";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import UserDashboard from "./components/Userdashboard"; // placeholder
import DebugAuth from "./components/DebugAuth";
import "./App.css";

// diagnostic log
console.log("App imports:", {
  Landing: !!Landing,
  Login: !!Login,
  AdminDashboard: !!AdminDashboard,
  UserDashboard: !!UserDashboard,
  DebugAuth: !!DebugAuth,
});
function App() {
  return (
    <Router>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        {/* Admin Dashboard — accept both path variants */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* User Dashboard */}
        <Route path="/user-dashboard" element={<UserDashboard />} />

        {/* Debug Auth Page */}
        <Route path="/debug-auth" element={<DebugAuth />} />
      </Routes>
    </Router>
  );
}

export default App;
// ...existing code...