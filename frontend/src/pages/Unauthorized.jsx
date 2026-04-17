import React from 'react';
import { Link } from 'react-router-dom';

const Unauthorized = () => {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Unauthorized Access</h2>
        <p>You do not have permission to view this page.</p>
        <Link to="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem', textAlign: 'center' }}>
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default Unauthorized;
