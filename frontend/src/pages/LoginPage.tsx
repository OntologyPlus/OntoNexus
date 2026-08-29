import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { COPY } from '../copy';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('wang');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoArea}>
          <img src="/logo.png" alt="OntoNexus" style={styles.logoIcon} />
          <h1 style={styles.title}>OntoNexus</h1>
          <p style={styles.subtitle}>医药销售 AI 决策中枢</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.chips}>
            {[
              { username: 'wang', label: COPY.login.wang },
              { username: 'manager', label: COPY.login.manager },
              { username: 'admin', label: COPY.login.admin },
            ].map((chip) => (
              <button
                key={chip.username}
                type="button"
                style={{
                  ...styles.chip,
                  ...(username === chip.username ? styles.chipActive : {}),
                }}
                onClick={() => { setUsername(chip.username); setPassword('123456'); }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="请输入用户名"
              required
              autoComplete="username"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="请输入密码"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" style={styles.loginButton} disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.hint}>演示账号密码均为 123456。王代表提交，经理审批。</p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  logoArea: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoIcon: {
    width: '64px',
    height: '64px',
    marginBottom: '16px',
    borderRadius: '22%',
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    boxShadow: '0 8px 24px rgba(0, 85, 166, 0.35)',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  formGroup: {
    marginBottom: '20px',
  },
  chips: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  },
  chip: {
    flex: 1,
    minWidth: '90px',
    padding: '8px 10px',
    fontSize: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
  },
  chipActive: {
    border: '1px solid #8b5cf6',
    background: 'rgba(139, 92, 246, 0.2)',
    color: '#fff',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const,
  },
  loginButton: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'transform 0.1s, opacity 0.2s',
  },
  error: {
    padding: '12px',
    marginBottom: '20px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    fontSize: '14px',
    textAlign: 'center' as const,
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center' as const,
  },
  hint: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
};
