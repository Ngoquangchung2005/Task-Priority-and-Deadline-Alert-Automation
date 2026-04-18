import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Fingerprint, KeyRound, Mail, Mic, ShieldCheck } from 'lucide-react';
import heroImage from '../assets/hero.png';
import deadlineMark from '../assets/deadline-mark.svg';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const userData = await login(email, password);
      
      if (userData.mustChangePassword) {
        navigate('/change-password');
      } else if (userData.role === 'MANAGER') {
        navigate('/manager');
      } else {
        navigate('/user');
      }
    } catch {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="auth-scene">
      <div className="auth-shell glass-panel">
        <div className="auth-form-panel">
          <div className="auth-icon-badge">
            <img src={deadlineMark} alt="DeadlineDash" />
          </div>

          <h1 className="auth-heading">Login to your account</h1>
          <p className="auth-subheading">Welcome back, please enter your details to continue.</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form-grid">
            <div className="form-group">
              <label>Email</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  type="email"
                  className="input-field auth-input"
                  placeholder="manager@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="auth-input-wrap">
                <KeyRound size={16} className="auth-input-icon" />
                <input
                  type="password"
                  className="input-field auth-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-form-meta">
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <button type="button" className="auth-text-btn">Forgot password?</button>
            </div>

            <button type="submit" className="btn-primary auth-submit-btn">
              Continue <ArrowRight size={16} />
            </button>
          </form>

          <div className="auth-divider"><span>OR</span></div>

          <div className="auth-secondary-actions">
            <button type="button" className="btn-outline auth-alt-btn">
              <Fingerprint size={16} /> Employee ID
            </button>
            <button type="button" className="btn-outline auth-alt-btn">
              <Mic size={16} /> Login with voice
            </button>
          </div>

          <p className="auth-register-text">
            Not registered yet? <button type="button" className="auth-text-btn auth-inline-btn">Contact manager</button>
          </p>
        </div>

        <div className="auth-visual-panel">
          <div className="auth-visual-copy">
            <h2>Deadline matters.</h2>
          </div>

          <div className="auth-preview-card glass-panel-inner">
            <img
              src="/deadline.jpeg"
              alt="Task planning preview"
              className="auth-preview-image"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = heroImage;
              }}
            />
            <div className="auth-preview-floating auth-preview-success">
              <BadgeCheck size={16} />
              <span>Task plan synced</span>
            </div>
            <div className="auth-preview-floating auth-preview-alert">
              <ShieldCheck size={16} />
              <span>2 deadlines protected</span>
            </div>
            <div className="auth-preview-metrics">
              <div>
                <strong>94.2%</strong>
                <span>on-time delivery</span>
              </div>
              <div>
                <strong>8</strong>
                <span>active reviews</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
