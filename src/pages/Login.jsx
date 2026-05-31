import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import nuimage from "../assets/background/nuimage.png";
import logo from "../assets/icons/Full Logo.png";
import { apiFetch } from "../api";
import { useAuth } from "../auth";

function Login() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(!!localStorage.getItem("nu_token"));

  useEffect(() => {
    const token = localStorage.getItem("nu_token");
    const adminToken = localStorage.getItem("nu_admin_token");

    if (adminToken) {
      navigate("/admin", { replace: true });
      return;
    }

    if (!token) {
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch("/api/user", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok && mounted) {
          const profile = await res.json();
          loginUser(profile, token);
          navigate("/", { replace: true });
        } else {
          localStorage.removeItem("nu_token");
          localStorage.removeItem("nu_user");
          if (mounted) setVerifying(false);
        }
      } catch (e) {
        console.error("Token verification failed", e);
        localStorage.removeItem("nu_token");
        localStorage.removeItem("nu_user");
        if (mounted) setVerifying(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate, loginUser]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const normalizedStudentId = studentId.trim();
    const normalizedPassword = password.trim();

    if (!normalizedStudentId) {
      setError("Please enter your student ID.");
      return;
    }

    if (!normalizedPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: normalizedStudentId,
          password: normalizedPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed. Please try again.");
        return;
      }

      loginUser(data.profile, data.token);
      navigate("/", { replace: true });
    } catch (e) {
      console.error(e);
      setError("Unable to log in. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <div id="LoginGrid">
        <div id="LoginSection" className="VerifyingContainer">
           <img src={logo} alt="NUEATS Logo" className="VerifyingLogo" />
           <p className="VerifyingText">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="LoginGrid">
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
              <h1>Welcome Back!</h1>
              <h3>Please log-in to continue.</h3>
            </div>
          </div>
          <div id="FormDiv">
            <form id="FormWrapper" onSubmit={handleSubmit}>
              <p className="FormLabel">Student ID</p>
              <input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Input your student ID"
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
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {error && <p className="LoginError">{error}</p>}

              <div id="ButtonDiv">
                <button id="LoginButton" type="submit" disabled={loading}>
                  {loading ? "Please wait..." : "LOG IN"}
                </button>
              </div>

              <div className="PortalSwitch">
                <button type="button" className="PortalSwitchButton" onClick={() => navigate("/admin/login")}>
                  Admin/Staff Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
