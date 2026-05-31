import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import Login from "./pages/Login";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import { AuthContext } from "./auth";
import './styles/App.css'

function readStoredJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function App() {
  const [user, setUser] = useState(() => (
    localStorage.getItem("nu_token") ? readStoredJson("nu_user") : null
  ));
  const [admin, setAdmin] = useState(() => (
    localStorage.getItem("nu_admin_token") ? readStoredJson("nu_admin_user") : null
  ));

  const loginUser = (userData, token) => {
    localStorage.setItem("nu_user", JSON.stringify(userData));
    localStorage.setItem("nu_token", token);
    setUser(userData);
  };

  const loginAdmin = (adminData, token) => {
    localStorage.setItem("nu_admin_user", JSON.stringify(adminData));
    localStorage.setItem("nu_admin_token", token);
    setAdmin(adminData);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ user, admin, loginUser, loginAdmin, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/admin/login" element={admin ? <Navigate to="/admin" replace /> : <AdminLogin />} />

          <Route path="/" element={user ? <UserDashboard /> : <Navigate to="/login" replace />} />
          <Route path="/admin" element={admin ? <AdminDashboard /> : <Navigate to="/admin/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default App
