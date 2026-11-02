import React, { useState } from 'react';
import {
  loginAccount,
  registerAccount,
  verifyEmailToken,
  requestPasswordReset,
  resetAccountPassword
} from '../api/client';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login', 'register', 'verify', 'forgot', 'reset'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [debugToken, setDebugToken] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setDebugToken('');
  };

  const switchMode = (newMode) => {
    resetForm();
    setMode(newMode);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetForm();
    try {
      const res = await loginAccount(email, password);
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('not verified')) {
        setErrorMessage('Account is unverified. Please enter your verification token below.');
        setMode('verify');
      } else {
        setErrorMessage(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      setErrorMessage('You must agree to the Terms of Use to register');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Password and confirmation do not match');
      return;
    }
    setLoading(true);
    resetForm();
    try {
      const res = await registerAccount(fullName, email, password, confirmPassword, termsAccepted);
      setSuccessMessage(res.message);
      if (res.verification_token_debug) {
        setDebugToken(res.verification_token_debug);
        setToken(res.verification_token_debug);
      }
      setMode('verify');
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await verifyEmailToken(token);
      setSuccessMessage(res.message);
      setTimeout(() => {
        setMode('login');
      }, 1200);
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    resetForm();
    try {
      const res = await requestPasswordReset(email);
      setSuccessMessage(res.message);
      if (res.reset_token_debug) {
        setDebugToken(res.reset_token_debug);
        setToken(res.reset_token_debug);
      }
      setMode('reset');
    } catch (err) {
      setErrorMessage(err.message || 'Password reset request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage('Password and confirmation do not match');
      return;
    }
    setLoading(true);
    resetForm();
    try {
      const res = await resetAccountPassword(token, password, confirmPassword);
      setSuccessMessage(res.message);
      setTimeout(() => {
        setMode('login');
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(16, 18, 17, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16
    }}>
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div className="page-eyebrow">CloudOps Lab Identity</div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {mode === 'login' && 'Sign in to workspace'}
              {mode === 'register' && 'Create laboratory account'}
              {mode === 'verify' && 'Verify email address'}
              {mode === 'forgot' && 'Reset account password'}
              {mode === 'reset' && 'Set new password'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: 4
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px 24px' }}>
          {errorMessage && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 4,
              fontSize: '12px',
              color: 'var(--status-danger)',
              marginBottom: 16
            }}>
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(71, 119, 100, 0.1)',
              border: '1px solid var(--accent)',
              borderRadius: 4,
              fontSize: '12px',
              color: 'var(--accent)',
              marginBottom: 16
            }}>
              {successMessage}
            </div>
          )}

          {debugToken && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-canvas)',
              border: '1px dashed var(--border-color)',
              borderRadius: 4,
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginBottom: 16
            }}>
              <strong>Development Token:</strong> <span className="font-mono">{debugToken}</span>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Email address
                </label>
                <input
                  type="email"
                  required
                  className="input-text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@cloudops.edu"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  className="input-text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', height: 36, marginTop: 4 }}
              >
                {loading ? 'Authenticating...' : 'Sign in'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: 8 }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Register here
                </button>
              </div>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Full name
                </label>
                <input
                  type="text"
                  required
                  className="input-text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alice Smith"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Email address
                </label>
                <input
                  type="email"
                  required
                  className="input-text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice@cloudops.edu"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Password (min 12 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  className="input-text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 12 characters"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  className="input-text"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <label htmlFor="terms" style={{ fontSize: '11.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  I agree to the Terms of Use and Lab Safety Guidelines
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', height: 36, marginTop: 4 }}
              >
                {loading ? 'Registering...' : 'Create account'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: 8 }}>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {/* 3. VERIFY FORM */}
          {mode === 'verify' && (
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Please enter the 32-character single-use verification token sent to your email address (or logged to the local development console).
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Verification token
                </label>
                <input
                  type="text"
                  required
                  className="input-text font-mono"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste verification token"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', height: 36 }}
              >
                {loading ? 'Verifying...' : 'Verify account'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                >
                  Return to sign in
                </button>
              </div>
            </form>
          )}

          {/* 4. FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Enter your account email. If the account exists, a time-limited password reset token will be issued.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Account email
                </label>
                <input
                  type="email"
                  required
                  className="input-text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@cloudops.edu"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', height: 36 }}
              >
                {loading ? 'Sending request...' : 'Send reset link'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                >
                  Back to login
                </button>
              </div>
            </form>
          )}

          {/* 5. RESET PASSWORD FORM */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Reset token
                </label>
                <input
                  type="text"
                  required
                  className="input-text font-mono"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste reset token"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  New password (min 12 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  className="input-text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Confirm new password
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  className="input-text"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', height: 36 }}
              >
                {loading ? 'Updating password...' : 'Update password'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                >
                  Cancel and sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

