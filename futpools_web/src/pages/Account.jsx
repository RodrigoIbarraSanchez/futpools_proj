import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { t } from '../i18n/translations';
import { AppBackground } from '../components/AppBackground';
import { CardView } from '../components/CardView';
import { PrimaryButton } from '../components/PrimaryButton';

export function Account() {
  const { user, logout, updateDisplayName } = useAuth();
  const { locale } = useLocale();
  const [showEditName, setShowEditName] = useState(false);
  const [editName, setEditName] = useState(user?.displayName || '');

  const displayName = (user?.displayName || '').trim() || user?.email || 'User';
  const balance = user?.balance ?? 0;

  const handleSaveName = async () => {
    await updateDisplayName(editName);
    setShowEditName(false);
  };

  return (
    <>
      <AppBackground />
      <header
        style={{
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--app-stroke)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{t(locale, 'My Account')}</h1>
        <Link
          to="/settings"
          style={{
            padding: 'var(--spacing-xs)',
            color: 'var(--app-primary)',
            fontSize: 24,
            textDecoration: 'none',
          }}
        >
          ⚙️
        </Link>
      </header>

      <div style={{ padding: 'var(--spacing-md)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--spacing-sm)' }}>👤</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 'var(--spacing-xs)' }}>{displayName}</h2>
          {user?.email && (
            <p style={{ color: 'var(--app-text-secondary)', fontSize: 15 }}>{user.email}</p>
          )}
        </div>

        <CardView style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--app-text-secondary)', margin: 0 }}>{t(locale, 'Display name')}</p>
              <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{displayName}</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowEditName(true); setEditName(displayName); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--app-primary)',
                fontSize: 24,
                padding: 'var(--spacing-xs)',
              }}
            >
              ✏️
            </button>
          </div>
        </CardView>

        <Link to="/recharge" style={{ textDecoration: 'none' }}>
          <CardView style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--app-text-secondary)' }}>{t(locale, 'Balance')}</span>
              <span style={{ fontWeight: 600, color: 'var(--app-primary)' }}>{balance}</span>
              <span style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>→</span>
            </div>
          </CardView>
        </Link>

        <PrimaryButton style="purple" onClick={logout}>
          {t(locale, 'Sign out')}
        </PrimaryButton>
      </div>

      {showEditName && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--app-background)',
            zIndex: 100,
            padding: 'var(--spacing-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>{t(locale, 'Edit name')}</h2>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder={t(locale, 'Your name')}
            style={{
              padding: 'var(--spacing-md)',
              background: 'var(--app-surface)',
              border: '1px solid var(--app-stroke)',
              borderRadius: 'var(--app-radius-button)',
              color: 'var(--app-text-primary)',
              fontSize: 16,
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              type="button"
              onClick={() => setShowEditName(false)}
              style={{
                flex: 1,
                padding: 'var(--spacing-md)',
                background: 'var(--app-surface-alt)',
                border: 'none',
                borderRadius: 'var(--app-radius-button)',
                color: 'var(--app-text-secondary)',
                fontSize: 15,
              }}
            >
              {t(locale, 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveName}
              style={{
                flex: 1,
                padding: 'var(--spacing-md)',
                background: 'var(--app-primary)',
                border: 'none',
                borderRadius: 'var(--app-radius-button)',
                color: '#000',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {t(locale, 'Save')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
