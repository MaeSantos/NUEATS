import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import nuimage from "../assets/background/nuimage.png";
import logo from "../assets/icons/Full Logo.png";
import { apiFetch } from "../api";
import { useAuth } from "../auth";

function AdminLogin() {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(!!localStorage.getItem("nu_admin_token"));

  useEffect(() => {
    const adminToken = localStorage.getItem("nu_admin_token");
    const studentToken = localStorage.getItem("nu_token");

    if (studentToken) {
      navigate("/", { replace: true });
      return;
    }

    if (!adminToken) {
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (res.ok && mounted) {
          const data = await res.json();
          loginAdmin(data.profile, adminToken);
          navigate("/admin", { replace: true });
        } else {
          localStorage.removeItem("nu_admin_token");
          localStorage.removeItem("nu_admin_user");
          if (mounted) setVerifying(false);
        }
      } catch (e) {
        console.error("Admin token verification failed", e);
        localStorage.removeItem("nu_admin_token");
        localStorage.removeItem("nu_admin_user");
        if (mounted) setVerifying(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate, loginAdmin]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!normalizedUsername) {
      setError("Please enter your admin username.");
      return;
    }

    if (!normalizedPassword) {
      setError("Please enter your admin password.");
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedUsername, password: normalizedPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Admin login failed. Please try again.");
        return;
      }

      loginAdmin(data.profile, data.token);
      navigate("/admin", { replace: true });
    } catch (e) {
      console.error(e);
      setError("Unable to log in. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <div id="LoginGrid" className="AdminLoginGrid">
        <div id="LoginSection" className="VerifyingContainer">
          <img src={logo} alt="NUEATS Logo" className="VerifyingLogo" />
          <p className="VerifyingText">Verifying admin session...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="LoginGrid" className="AdminLoginGrid">
      <div id="ImageSection">
        <img id="BackgroundImage" src={nuimage} alt="National University Building" />
      </div>
      <div id="LoginSection">
        <div id="InnerBox">
          <div id="LogoDiv">
            <img id="Logo" src={logo} alt="NUEATS Logo" />
          </div>
          <div id="TextDiv">
            <div id="TextWrapper">
              <p className="PortalEyebrow">Admin portal</p>
              <h1>Staff Sign In</h1>
              <h3>Use your private admin account to continue.</h3>
            </div>
          </div>
          <div id="FormDiv">
            <form id="FormWrapper" onSubmit={handleSubmit}>
              <p className="FormLabel">Admin Username</p>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Input your admin username"
                type="text"
                autoComplete="username"
                autoFocus
                required
              />

              <p className="FormLabel">Password</p>
              <div className="PasswordField">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Input your password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="PasswordToggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {error && <p className="LoginError">{error}</p>}

              <div id="ButtonDiv">
                <button id="LoginButton" type="submit" disabled={loading}>
                  {loading ? "Please wait..." : "LOG IN AS ADMIN"}
                </button>
              </div>

              <div className="PortalSwitch">
                <button type="button" className="PortalSwitchButton" onClick={() => navigate("/login")}>
                  Student Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
