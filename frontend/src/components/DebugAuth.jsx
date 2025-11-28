import React from 'react';
import { useNavigate } from 'react-router-dom';
import './DebugAuth.css';

export default function DebugAuth() {
  const navigate = useNavigate();

  const checkStorage = () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const email = localStorage.getItem('email');
    const firstName = localStorage.getItem('firstName');
    const lastName = localStorage.getItem('lastName');

    return { token, role, email, firstName, lastName };
  };

  const [storage, setStorage] = React.useState(checkStorage());

  const clearStorage = () => {
    localStorage.clear();
    setStorage(checkStorage());
    alert('✅ LocalStorage cleared! Please login again.');
    navigate('/');
  };

  const refreshStorage = () => {
    setStorage(checkStorage());
  };

  const decodeJWT = (token) => {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (e) {
      return { error: 'Invalid token format' };
    }
  };

  const tokenData = storage.token ? decodeJWT(storage.token) : null;

  return (
    <div className="debug-container">
      <div className="debug-card">
        <h1>🔧 Auth Debug Panel</h1>
        
        <div className="debug-section">
          <h2>LocalStorage Contents</h2>
          <div className="debug-grid">
            <div className="debug-item">
              <label>Token:</label>
              <span className={storage.token ? 'success' : 'error'}>
                {storage.token ? `${storage.token.substring(0, 30)}...` : '❌ No token'}
              </span>
            </div>
            <div className="debug-item">
              <label>Role:</label>
              <span className={storage.role ? 'success' : 'error'}>
                {storage.role || '❌ No role'}
              </span>
            </div>
            <div className="debug-item">
              <label>Email:</label>
              <span className={storage.email ? 'success' : 'error'}>
                {storage.email || '❌ No email'}
              </span>
            </div>
            <div className="debug-item">
              <label>First Name:</label>
              <span className={storage.firstName ? 'success' : 'error'}>
                {storage.firstName || '❌ No firstName'}
              </span>
            </div>
            <div className="debug-item">
              <label>Last Name:</label>
              <span className={storage.lastName ? 'success' : 'error'}>
                {storage.lastName || '❌ No lastName'}
              </span>
            </div>
          </div>
        </div>

        {tokenData && (
          <div className="debug-section">
            <h2>Decoded JWT Token</h2>
            <pre className="debug-json">
              {JSON.stringify(tokenData, null, 2)}
            </pre>
          </div>
        )}

        <div className="debug-actions">
          <button onClick={refreshStorage} className="btn-refresh">
            🔄 Refresh
          </button>
          <button onClick={clearStorage} className="btn-clear">
            🗑️ Clear Storage & Logout
          </button>
          <button onClick={() => navigate('/')} className="btn-back">
            ← Back to Home
          </button>
        </div>

        <div className="debug-info">
          <h3>⚠️ Troubleshooting Steps:</h3>
          <ol>
            <li>Click "Clear Storage & Logout"</li>
            <li>Login again with admin credentials</li>
            <li>Come back here to verify token is updated</li>
            <li>Check that JWT contains correct email and role</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
