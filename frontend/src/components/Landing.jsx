import React, { useState } from "react";
import Login from "./Login";
import Register from "./Register";
import "./Login.css";

export default function Landing() {
  const [selectedForm, setSelectedForm] = useState("login");
  const [isAnimating, setIsAnimating] = useState(false);

  const handleFormSelect = (form) => {
    if (isAnimating || selectedForm === form) return;
    setIsAnimating(true);
    setTimeout(() => {
      setSelectedForm(form);
      setIsAnimating(false);
    }, 300);
  };

  const renderButtons = () => (
    <div className="buttons-card">
      <h2 className="auth-title">Welcome Back!</h2>
      <button 
        className={`role-button login-btn ${selectedForm === 'login' ? 'active' : ''}`}
        onClick={() => handleFormSelect('login')}
      >
        Sign In
      </button>
      <button 
        className={`role-button register-btn ${selectedForm === 'register' ? 'active' : ''}`}
        onClick={() => handleFormSelect('register')}
      >
        Sign Up
      </button>
    </div>
  );

  return (
    <div className="landing-container">
      <h1 className="project-title">Crowd Count using Video Analytics</h1>
      
      <div className="cards-wrapper">
        {selectedForm === 'login' ? (
          <>
            <div className={`card-container ${isAnimating ? 'slide-out' : ''}`}>
              {renderButtons()}
            </div>
            <div className={`auth-card ${isAnimating ? 'slide-in' : ''}`}>
              <Login />
            </div>
          </>
        ) : (
          <>
            <div className={`auth-card ${isAnimating ? 'slide-in' : ''}`}>
              <Register />
            </div>
            <div className={`card-container ${isAnimating ? 'slide-out' : ''}`}>
              {renderButtons()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
