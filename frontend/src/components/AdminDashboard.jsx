import React, { useState, useEffect, useRef } from "react";
import { LayoutDashboard, Users, Rss } from "lucide-react";
import UsersDomain from "./UsersDomain";
import FeedsDomain from "./FeedsDomain";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userCount, setUserCount] = useState(0);
  const [feedCount, setFeedCount] = useState(7);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [firstName, setFirstName] = useState(localStorage.getItem("firstName") || "Admin");
  const [lastName, setLastName] = useState(localStorage.getItem("lastName") || "");
  const [email, setEmail] = useState(localStorage.getItem("email") || "admin@gmail.com");

  const dropdownRef = useRef(null);
  const avatarRef = useRef(null);

  // Default avatar for every login
  const profilePic = "https://cdn-icons-png.flaticon.com/512/194/194938.png";

  const refreshCount = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:5000/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return setUserCount(0);
      const data = await res.json();
      const usersArray = Array.isArray(data) ? data : data.users || [];
      setUserCount(usersArray.length);
    } catch {
      setUserCount(0);
    }
  };

  const refreshFeedCount = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:5000/api/admin/feeds", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return setFeedCount(0);
      const data = await res.json();
      const feedsArray = Array.isArray(data) ? data : data.feeds || [];
      setFeedCount(feedsArray.length);
    } catch {
      setFeedCount(0);
    }
  };

  const fetchAdminProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("http://127.0.0.1:5000/api/admin/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const fName = data.first_name || data.firstName || "";
      const lName = data.last_name || data.lastName || "";
      const mail = data.email || data.Email || "";

      if (fName) setFirstName(fName);
      if (lName) setLastName(lName);
      if (mail) setEmail(mail);
    } catch (err) {
      console.error("Error fetching admin profile:", err);
    }
  };

  useEffect(() => {
    refreshCount();
    refreshFeedCount();
    fetchAdminProfile();
  }, []);

  useEffect(() => {
    if (showProfile) setProfileMenuOpen(false);
  }, [showProfile]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!dropdownRef.current || !avatarRef.current) return;
      if (
        profileMenuOpen &&
        !dropdownRef.current.contains(e.target) &&
        !avatarRef.current.contains(e.target)
      ) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [profileMenuOpen]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="admin-dashboard">
      {/* Topbar - Full Width */}
      <header className="topbar">
        <h1>Admin Dashboard</h1>
        <div className="topbar-right">
          <img
            src={profilePic}
            alt="profile"
            className="profile-avatar"
            onClick={() => setShowProfile(true)}
            title="View Profile"
          />
        </div>
      </header>

      {/* Body with Sidebar and Main Content */}
      <div className="admin-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <ul>
            <li className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}>
              <LayoutDashboard size={18} /> Dashboard
            </li>
            <li className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}>
              <Users size={18} /> Users
            </li>
            <li className={activeTab === "feeds" ? "active" : ""} onClick={() => setActiveTab("feeds")}>
              <Rss size={18} /> Feeds
            </li>
          </ul>
        </aside>

        {/* Main Content */}
        <div className="main-content">
          <div className="content-area">
          {activeTab === "dashboard" && (
            <>
              <div className="dashboard-greeting">
                <h2 className="dash">Hi {firstName}, Welcome to Admin Dashboard</h2>
              </div>

              <div className="cards-container">
                <div className="card blue">
                  <h3>{userCount}</h3>
                  <p>Total Users</p>
                  <button onClick={() => setActiveTab("users")}>More info</button>
                </div>

                <div className="card green">
                  <h3>{feedCount}</h3>
                  <p>Total Feeds</p>
                  <button onClick={() => setActiveTab("feeds")}>More info</button>
                </div>
              </div>
            </>
          )}

          {activeTab === "users" && <UsersDomain onUsersChanged={refreshCount} />}
          {activeTab === "feeds" && <FeedsDomain />}
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <div className="profile-modal" onClick={() => setShowProfile(false)}>
          <div className="profile-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-icon" onClick={() => setShowProfile(false)}>×</button>
            <h2 className="mypro">My Profile</h2>
            <img src={profilePic} alt="profile" className="profile-large" />
            <p className="mypro"><strong>Name:</strong> {firstName} {lastName}</p>
            <p className="mypro"><strong>Email:</strong> {email}</p>
            <p className="mypro"><strong>Role:</strong> Administrator</p>
            <button className="logout-btn-modal" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      )}
    </div>
  );
}
