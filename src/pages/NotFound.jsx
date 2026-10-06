import { Link } from 'react-router-dom';
import { Utensils, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64, background: 'var(--color-primary-50)', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Utensils size={28} color="var(--color-primary)" />
      </div>
      <div style={{ fontSize: 72, fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 }}>404</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Page not found</h1>
      <p style={{ color: 'var(--color-text-muted)', margin: 0, maxWidth: 320 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard" className="btn btn-primary">
        <Home size={15} /> Back to Dashboard
      </Link>
    </div>
  );
}
