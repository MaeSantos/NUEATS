import { useEffect, useState } from "react";
import "../styles/components/profile.css";
import MyOrders from "./MyOrders";

function Profile(props) {
  const initial = {
    name: props.name || (props.profile && props.profile.name) || "",
    studentId: (props.profile && props.profile.studentId) || "",
    imageUrl: (props.profile && props.profile.imageUrl) || "",
  };

  const [profile, setProfile] = useState(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    setProfile(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.name, props.profile]);

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || "");
      if (props.onSave) props.onSave({ name: profile.name, imageUrl: base64 });
      setProfile(p => ({ ...p, imageUrl: base64 }));
    };
    reader.readAsDataURL(file);
  }

  function handleLogout() {
    if (window.confirm("Are you sure you want to log out? Any unsaved changes may be lost.")) {
      if (props.onLogout) props.onLogout();
    }
  }

  return (
    <div className="ProfileContainer">
      <div className="ProfileHeader">
        <button className="ProfileCloseButton" onClick={() => props.onClose && props.onClose(false)}>✕</button>
        <div className="ProfileTitle">
          <h1 id="profile-title">Profile</h1>
        </div>
      </div>

      <div className="ProfileDivider" />

      <div className="ProfileAvatarContainer">
        <div className="ProfileAvatar">
          {profile.imageUrl ? (
            <img src={profile.imageUrl} alt="Profile" className="ProfileAvatarImage" />
          ) : (
            (profile.name || "U").trim().slice(0, 1).toUpperCase()
          )}
        </div>
        <label className="ChangePhotoLabel">
          Change Photo
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
        </label>
      </div>

      {error && <p className="FormError" style={{ textAlign: 'center' }}>{error}</p>}

      <div className="NameContainer">
        <p id="name-label">{profile.name || "(no name)"}</p>
        <p className="ProfileSubtitle">NUEATS account</p>
      </div>

      <div className="ProfileDetails">
        <div className="DetailCard">
          <p className="DetailLabel">{props.isAdmin ? "Staff ID" : "Student ID"}</p>
          <p className="DetailValue">{profile.studentId || "—"}</p>
        </div>
        {props.isAdmin && (
          <div className="DetailCard" style={{ marginTop: "10px" }}>
            <p className="DetailLabel">Position</p>
            <p className="DetailValue">NUEats Staff/Admin</p>
          </div>
        )}
      </div>

      <div className="ProfileActions">
        <button className="LogoutButton" onClick={handleLogout} style={{ gridColumn: 'span 2' }}>Log out</button>
      </div>

      <div className="ProfileDivider" style={{ margin: "20px 0" }} />

      {!props.isAdmin && (
        <div className="ProfileHistorySection" style={{ flex: 1, overflowY: "auto" }}>
          <MyOrders
            token={props.token}
            refreshKey={props.refreshKey}
            onClose={null}
            isNested={true}
          />
        </div>
      )}

      <div className="ProfileDivider" />
    </div>
  );
}

export default Profile;
