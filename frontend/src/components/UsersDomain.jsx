import React, { useEffect, useState } from "react";
import { UserPlus, Search, Edit2, Trash2, Save, X } from "lucide-react";
import "./UsersDomain.css"; // styles for UsersDomain (modal, table, buttons, etc.)

export default function UsersDomain({ onUsersChanged }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const [newUser, setNewUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "user",
    password: "",
  });

  const [editingUserId, setEditingUserId] = useState(null);
  const [editedUser, setEditedUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "",
  });

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");
      
      console.log("Fetching users with token:", token ? "Token exists" : "No token");
      console.log("User role:", role);
      
      const res = await fetch("http://127.0.0.1:5000/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Failed to fetch users:", res.status, errorData);
        return;
      }
      
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:5000/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert("User deleted successfully");
        fetchUsers();
        onUsersChanged?.();
      } else {
        alert("Failed to delete user");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const startEdit = (user) => {
    setEditingUserId(user.id);
    setEditedUser({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      role: user.role || "",
    });
  };

  const handleCancel = () => {
    setEditingUserId(null);
    setEditedUser({ first_name: "", last_name: "", email: "", role: "" });
  };

  const handleUpdate = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:5000/api/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editedUser),
      });
      if (res.ok) {
        alert("User updated successfully");
        handleCancel();
        fetchUsers();
        onUsersChanged?.();
      } else alert("Failed to update user");
    } catch (err) {
      console.error("Error updating user:", err);
    }
  };

  const handleAdd = async () => {
    if (!newUser.first_name || !newUser.email || !newUser.password) {
      alert("Please fill required fields (first name, email, password).");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:5000/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        alert("User added successfully");
        setShowAddForm(false);
        setNewUser({ first_name: "", last_name: "", email: "", role: "user", password: "" });
        fetchUsers();
        onUsersChanged?.();
      } else alert("Failed to add user");
    } catch (err) {
      console.error("Error adding user:", err);
    }
  };

  return (
    <div className="users-domain">
      <div className="users-header">
        <h2>Users Management</h2>
        <button className="add-user-btn" onClick={() => setShowAddForm(true)}>
          <UserPlus size={18} /> Add User
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            className="search-input"
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>Role</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => (
                <tr key={u.id || u.email}>
                  {editingUserId === u.id ? (
                    <>
                      <td><input className="editable-input edit-input" value={editedUser.first_name} onChange={(e) => setEditedUser(s => ({ ...s, first_name: e.target.value }))} /></td>
                      <td><input className="editable-input edit-input" value={editedUser.last_name} onChange={(e) => setEditedUser(s => ({ ...s, last_name: e.target.value }))} /></td>
                      <td><input className="editable-input edit-input" value={editedUser.email} onChange={(e) => setEditedUser(s => ({ ...s, email: e.target.value }))} /></td>
                      <td><input className="editable-input edit-input" value={editedUser.role} onChange={(e) => setEditedUser(s => ({ ...s, role: e.target.value }))} /></td>
                      <td>
                        <button className="save-btn" onClick={() => handleUpdate(u.id)}>
                          <Save size={16} /> Save
                        </button>
                        <button className="cancel-btn" onClick={handleCancel}>
                          <X size={16} /> Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{u.first_name}</td>
                      <td>{u.last_name}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>
                        <button className="edit-btn" onClick={() => startEdit(u)}>
                          <Edit2 size={16} /> Edit
                        </button>
                        <button className="delete-btn" onClick={() => handleDelete(u.id)}>
                          <Trash2 size={16} /> Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", color: "#777" }}>No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🔥 Add User Popup Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-form">
              <h3 className="add-user">Add User</h3>
              <input placeholder="First Name" value={newUser.first_name} onChange={(e) => setNewUser(s => ({ ...s, first_name: e.target.value }))} />
              <input placeholder="Last Name" value={newUser.last_name} onChange={(e) => setNewUser(s => ({ ...s, last_name: e.target.value }))} />
              <input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser(s => ({ ...s, email: e.target.value }))} />
              <input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser(s => ({ ...s, password: e.target.value }))} />
              {/* role dropdown limited to user only */}
              <select value={newUser.role} onChange={(e) => setNewUser(s => ({ ...s, role: e.target.value }))}>
                <option value="user">User</option>
              </select>
              <div className="modal-buttons">
                <button className="save-btn" onClick={handleAdd}>Add</button>
                <button className="cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
