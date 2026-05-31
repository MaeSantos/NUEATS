import { useEffect, useState } from "react";
import "../styles/components/profile.css";
import MyOrders from "./MyOrders";

function Profile(props) {
  const initial = {
    name: props.name || (props.profile && props.profile.name) || "",
    studentId: (props.profile && props.profile.studentId) || "",
  };

  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.name, props.profile]);

  function handleChange(field, value) {
    setProfile((p) => ({ ...p, [field]: value }));
    setError("");
  }

  function handleSave() {
    const nextName = profile.name.trim();
    if (!nextName) {
      setError("Name is required.");
      return;
    }
    if (nextName.length > 255) {
      setError("Name is too long.");
      return;
    }
    if (props.onSave) props.onSave({ name: nextName });
    setEditing(false);
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

      {!editing ? (
        <>
          <div className="ProfileAvatar" aria-hidden="true">
            {(profile.name || "U").trim().slice(0, 1).toUpperCase()}
          </div>
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
            <button className="EditButton" onClick={() => setEditing(true)}>Edit Profile</button>
            <button className="LogoutButton" onClick={() => props.onLogout && props.onLogout()}>Log out</button>
          </div>

          <div className="ProfileDivider" style={{ margin: "20px 0" }} />

          {!props.isAdmin && (
            <div className="ProfileHistorySection" style={{ flex: 1, overflowY: "auto" }}>
              <MyOrders
                token={props.token}
                refreshKey={props.refreshKey}
                onClose={null} // Nested, so we don't need a separate close button here
                isNested={true}
              />
            </div>
          )}
        </>
      ) : (
        <div className="ProfileForm">
          <div className="ProfileAvatar ProfileAvatar--editing" aria-hidden="true">
            {(profile.name || "U").trim().slice(0, 1).toUpperCase()}
          </div>

          <label className="InputLabel">Name</label>
          <input className="TextInput" value={profile.name} onChange={(e) => handleChange("name", e.target.value)} />

          <label className="InputLabel">{props.isAdmin ? "Staff ID" : "Student ID"}</label>
          <input
            className="TextInput TextInput--readonly"
            value={profile.studentId}
            readOnly
            aria-readonly="true"
          />
          {!props.isAdmin && <p className="InputHint">Student number cannot be edited here.</p>}

          {error && <p className="FormError">{error}</p>}

          <div className="ProfileActions">
            <button className="SaveButton" onClick={handleSave}>Save</button>
            <button className="CancelButton" onClick={() => { setProfile(initial); setEditing(false); setError(""); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="ProfileDivider" />
    </div>
  );
}

export default Profile;
