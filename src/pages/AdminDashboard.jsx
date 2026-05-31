import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminHeader from "../components/AdminHeader";
import AdminDashboardBody from "../components/AdminDashboardBody";
import Drawer from "@mui/material/Drawer";
import Profile from "../components/Profile";
import { apiFetch } from "../api";
import { useAuth } from "../auth";

function AdminDashboard() {
  const navigate = useNavigate();
  const { logout: authLogout } = useAuth();
  // State for the selected tab ("Orders", "Menu", or "Reports")
  const [currentTab, setCurrentTab] = useState("Orders");

  // State for profile drawer toggle
  const [openProfile, setProfileToOpen] = useState(false);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("nu_admin_token") || "");
  const [adminProfile, setAdminProfile] = useState(() => {
    try {
      const raw = localStorage.getItem("nu_admin_user");
      return raw ? JSON.parse(raw) : { name: "Admin User", username: "" };
    } catch {
      return { name: "Admin User", username: "" };
    }
  });

  useEffect(() => {
    if (!adminToken) {
      navigate("/admin/login");
      return undefined;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (res.status === 401) {
          localStorage.removeItem("nu_admin_token");
          localStorage.removeItem("nu_admin_user");
          setAdminToken("");
          navigate("/admin/login");
          return;
        }
        if (!res.ok) {
          console.warn("Admin profile check failed; keeping cached login.", res.status);
          return;
        }

        const data = await res.json();
        if (mounted && data.profile) {
          setAdminProfile(data.profile);
          localStorage.setItem("nu_admin_user", JSON.stringify(data.profile));
        }
      } catch (e) {
        console.error("Admin auth check failed", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [adminToken, navigate]);

  const toggleProfileDrawer = (value) => {
    setProfileToOpen(value);
  };

  async function handleSaveAdminProfile(profile) {
    const nextProfile = { ...adminProfile, name: profile.name, imageUrl: profile.imageUrl };
    setAdminProfile(nextProfile);
    localStorage.setItem("nu_admin_user", JSON.stringify(nextProfile));

    try {
      const response = await apiFetch("/api/admin/me", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: profile.name, imageUrl: profile.imageUrl }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to save admin profile");
      }
      const savedProfile = data.profile || nextProfile;
      setAdminProfile(savedProfile);
      localStorage.setItem("nu_admin_user", JSON.stringify(savedProfile));
    } catch (error) {
      console.error("Admin profile save failed", error);
    }
  }

  return (
    <div>
      <AdminHeader
        currentTab={currentTab}
        adminProfile={adminProfile}
        onSelectTab={setCurrentTab}
        onOpenProfile={() => toggleProfileDrawer(true)}
      />

      <AdminDashboardBody currentTab={currentTab} adminToken={adminToken} />

      <Drawer
        anchor="right"
        open={openProfile}
        onClose={() => toggleProfileDrawer(false)}
      >
        <Profile
          onClose={() => toggleProfileDrawer(false)}
          profile={{ name: adminProfile.name, studentId: adminProfile.username }}
          isAdmin={true}
          onSave={handleSaveAdminProfile}
          onLogout={async () => {
            try {
              await apiFetch("/api/admin/logout", {
                method: "POST",
                headers: { Authorization: `Bearer ${adminToken}` },
              });
            } catch (e) {
              console.error("Admin logout failed", e);
            }
            authLogout();
            navigate("/admin/login");
          }}
        />
      </Drawer>
    </div>
  );
}

export default AdminDashboard;
