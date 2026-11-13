import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { auth } from '../lib/firebase';
import { ThemeToggle } from './ThemeToggle';
import { normalizePhone, saveProfile } from '../lib/chat';

type AuthMode = 'sign-in' | 'create-account';

function friendlyAuthError(issue: unknown) {
  const code = typeof issue === 'object' && issue !== null && 'code' in issue ? String(issue.code) : undefined;
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'That email and password combination was not recognized.';
  if (code === 'auth/email-already-in-use') return 'There is already a Lanchat account with that email. Try signing in instead.';
  if (code === 'auth/weak-password') return 'Choose a password with at least 6 characters.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a little and try again.';
  return issue instanceof Error ? issue.message : 'We could not complete that request. Please try again.';
}

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth) {
      setError('Firebase is not configured. Check the Firebase web app settings.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'create-account') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const displayName = name.trim();
        await updateProfile(credential.user, { displayName });
        await saveProfile(credential.user, {
          name: displayName,
          about: 'Available',
          photoURL: '',
          phoneNumber: normalizePhone(phoneNumber),
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (issue) {
      setError(friendlyAuthError(issue));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!auth) return;
    if (!email.trim()) {
      setError('Enter your email address first, then choose “Forgot password?”.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('If an account uses that email, Firebase will send a password reset link.');
    } catch (issue) {
      setError(friendlyAuthError(issue));
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: AuthMode) {
    setMode(next);
    setError('');
    setMessage('');
  }

  const creating = mode === 'create-account';

  return <main className="auth-screen">
    <div className="auth-skywash" />
    <div className="auth-layout">
      <section className="auth-story">
        <div className="auth-brand"><span className="brand-mark"><MessageCircle size={22} strokeWidth={2.5} /><Sparkles size={9} className="brand-spark" /></span><span>lanchat<span className="title-period">.</span></span><ThemeToggle /></div>
        <div className="auth-story-copy"><span className="auth-overline"><span /> A LITTLE CLOSER, EVERY DAY</span><h1>Good things<br />are better<br /><span>shared.</span></h1><p>Your people, your moments, all in one lovely little place.</p></div>
        <div className="auth-story-art" aria-hidden="true"><div className="auth-art-orbit orbit-one" /><div className="auth-art-orbit orbit-two" /><span className="auth-art-main"><MessageCircle size={47} /></span><span className="auth-art-bubble bubble-a">hey! <Sparkles size={12} /></span><span className="auth-art-bubble bubble-b"><i /><i /><i /></span></div>
        <div className="auth-story-foot"><ShieldCheck size={15} />Email and password sign-in — no SMS needed.</div>
      </section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="auth-card-icon"><MessageCircle size={21} /></div>
        <p className="eyebrow">PICK UP WHERE YOUR PEOPLE ARE</p>
        <h2>{creating ? <>Make your<br />Lanchat account.</> : <>Good to see<br />you again.</>}</h2>
        <p className="auth-intro">{creating ? 'Create an account with your email and a password. Phone is optional profile information.' : 'Sign in with the email and password for your Lanchat account.'}</p>
        <form onSubmit={submit} className="auth-form">
          {creating && <><label htmlFor="account-name">Your name</label><input className="auth-text-input" id="account-name" type="text" autoComplete="name" placeholder="How should people know you?" value={name} onChange={(event) => setName(event.target.value)} required maxLength={48} />
            <label htmlFor="account-phone">Phone number <span className="optional-label">OPTIONAL</span></label><input className="auth-text-input" id="account-phone" type="tel" autoComplete="tel" placeholder="+1 415 555 0108" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} maxLength={32} /><small className="field-hint">Profile info only — test or fictional numbers are okay. No SMS is sent.</small></>}
          <label htmlFor="account-email">Email address</label><input className="auth-text-input" id="account-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="account-password">Password</label><input className="auth-text-input" id="account-password" type="password" autoComplete={creating ? 'new-password' : 'current-password'} placeholder={creating ? 'At least 6 characters' : 'Your password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}
          <button className="primary-button auth-submit" disabled={busy || (creating && !name.trim())}>{busy ? (creating ? 'Creating account…' : 'Signing in…') : (creating ? 'Create account' : 'Sign in')}<span>→</span></button>
        </form>
        {!creating && <button className="text-button auth-reset" type="button" onClick={() => void resetPassword()} disabled={busy}>Forgot password?</button>}
        <p className="auth-switch">{creating ? 'Already have an account?' : 'New to Lanchat?'} <button type="button" onClick={() => changeMode(creating ? 'sign-in' : 'create-account')}>{creating ? 'Sign in' : 'Create an account'}</button></p>
        <div className="auth-card-foot"><ShieldCheck size={14} /><span>Phone OTP is not used in this development sign-in flow; no SMS is sent.</span></div>
      </div><p className="auth-terms">By continuing, you agree to keep this a kind little corner.</p></section>
    </div>
  </main>;
}
