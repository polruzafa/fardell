import { useState, type FormEvent } from 'react'
import { defaultServerUrl, useAccount } from '../account'
import { getLocale, LANGS, useI18n, type TKey } from '../i18n'
import { SCHEME_MODES, THEMES, useTheme } from '../theme'

export default function SettingsPage() {
  const { lang, setLang, t } = useI18n()
  const { theme, setTheme, mode, setMode } = useTheme()

  return (
    <>
      <h1>{t('settings.title')}</h1>

      <h2>{t('settings.language')}</h2>
      <div className="chips" role="group" aria-label={t('settings.language')}>
        {LANGS.map((l) => (
          <button
            key={l.code}
            className={`chip${lang === l.code ? ' chip-on' : ''}`}
            lang={l.code}
            onClick={() => setLang(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <h2>{t('settings.theme')}</h2>
      <div className="chips" role="group" aria-label={t('settings.theme')}>
        {THEMES.map((th) => (
          <button
            key={th.id}
            className={`chip${theme === th.id ? ' chip-on' : ''}`}
            onClick={() => setTheme(th.id)}
          >
            <span className="dot" style={{ background: th.swatch }} />
            {t(th.labelKey)}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label={t('settings.scheme')}>
        {SCHEME_MODES.map((m) => (
          <button
            key={m.id}
            className={`chip${mode === m.id ? ' chip-on' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {t(m.labelKey)}
          </button>
        ))}
      </div>

      <h2>{t('settings.account')}</h2>
      <AccountSection />

      <dl className="facts">
        <div>
          <dt>{t('settings.version')}</dt>
          <dd className="mono">
            {__VERSION__} · {__COMMIT__}
          </dd>
        </div>
      </dl>
    </>
  )
}

function AccountSection() {
  const { t } = useI18n()
  const { account, status, lastSyncedAt, errorKey, login, register, logout, deleteAccount, syncNow } =
    useAccount()

  const [serverUrl, setServerUrl] = useState(defaultServerUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<TKey | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(action: 'login' | 'register') {
    if (busy) return
    if (password.length < 8) {
      setFormError('account.errPassword')
      return
    }
    setBusy(true)
    setFormError(null)
    const error = await (action === 'login' ? login : register)(serverUrl, email, password)
    setBusy(false)
    if (error) {
      setFormError(error)
    } else {
      setEmail('')
      setPassword('')
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submit('login')
  }

  async function removeAccount() {
    if (!window.confirm(t('account.deleteConfirm'))) return
    const pw = window.prompt(t('account.deletePassword'))
    if (pw == null) return
    const error = await deleteAccount(pw)
    if (error) window.alert(t(error))
  }

  if (!account) {
    return (
      <>
        <p className="hint">{t('account.hint')}</p>
        {errorKey && <p className="sync-status sync-status-error">{t(errorKey)}</p>}
        <form className="form" onSubmit={onSubmit}>
          <label>
            {t('account.server')} <span className="hint">{t('account.serverHint')}</span>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={t('account.serverPlaceholder')}
              required
              spellCheck={false}
              autoCapitalize="off"
            />
          </label>
          <label>
            {t('account.email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            {t('account.password')} <span className="hint">{t('account.passwordHint')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
            />
          </label>
          {formError && <p className="sync-status sync-status-error">{t(formError)}</p>}
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {t('account.login')}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void submit('register')}>
              {t('account.register')}
            </button>
          </div>
        </form>
      </>
    )
  }

  const statusText =
    status === 'syncing'
      ? t('account.statusSyncing')
      : status === 'dirty'
        ? t('account.statusDirty')
        : status === 'error'
          ? t(errorKey ?? 'account.errNetwork')
          : t('account.statusSynced')
  const statusClass =
    status === 'error'
      ? 'sync-status-error'
      : status === 'synced'
        ? 'sync-status-ok'
        : 'sync-status-busy'

  return (
    <>
      <dl className="facts">
        <div>
          <dt>{t('account.email')}</dt>
          <dd className="mono">{account.email}</dd>
        </div>
        <div>
          <dt>{t('account.lastSync')}</dt>
          <dd className="mono">
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString(getLocale()) : t('account.never')}
          </dd>
        </div>
      </dl>
      <p className={`sync-status ${statusClass}`} role="status">
        {statusText}
      </p>
      <div className="actions actions-column">
        <button className="btn btn-primary" onClick={syncNow} disabled={status === 'syncing'}>
          {t('account.syncNow')}
        </button>
        <button className="btn" onClick={logout}>
          {t('account.logout')}
        </button>
        <button className="btn btn-danger" onClick={() => void removeAccount()}>
          {t('account.delete')}
        </button>
      </div>
    </>
  )
}
