import { useEffect, useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ArrowRight, Eye, EyeOff, Heart, LockKeyhole, Mail, MessageCircle, Phone, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { auth } from '../lib/firebase';
import { ThemeToggle } from './ThemeToggle';
import { normalizePhone, saveProfile } from '../lib/chat';

type AuthMode = 'sign-in' | 'create-account';

function friendlyAuthError(issue: unknown) {
  const code = typeof issue === 'object' && issue !== null && 'code' in issue ? String(issue.code) : undefined;
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'That email and password combination was not recognized.';
  if (code === 'auth/email-already-in-use') return 'There is already a LANChat account with that email. Try signing in instead.';
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
  const [showPassword, setShowPassword] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setShowWelcome(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth) {
      setError('Sign-in is temporarily unavailable. Please try again later.');
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
      setMessage('If an account uses that email, a password reset link will be sent.');
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

  if (showWelcome) {
    return <main className="lanchat-welcome" aria-label="Welcome to LANChat">
      <div className="welcome-glow welcome-glow-top" />
      <div className="welcome-glow welcome-glow-bottom" />
      <div className="welcome-orbit welcome-orbit-one" />
      <div className="welcome-orbit welcome-orbit-two" />
      <div className="welcome-spark welcome-spark-one">✦</div>
      <div className="welcome-spark welcome-spark-two">✧</div>
      <div className="welcome-emblem"><MessageCircle size={72} strokeWidth={1.6} /><span><i /><i /><i /></span><b>♛</b></div>
      <div className="welcome-wordmark">LAN<span>Chat</span></div>
      <p>Chat. Share. Connect.</p>
      <small>Stay close, always <Heart size={13} fill="currentColor" /></small>
      <div className="welcome-progress"><span /></div>
    </main>;
  }

  const creating = mode === 'create-account';

  return <main className="auth-screen auth-screen-premium">
    <div className="auth-premium-glow auth-premium-glow-a" />
    <div className="auth-premium-glow auth-premium-glow-b" />
    <div className="auth-layout auth-layout-premium">
      <section className="auth-story auth-story-premium">
        <div className="auth-brand"><span className="brand-mark"><MessageCircle size={22} strokeWidth={2.5} /><Sparkles size={9} className="brand-spark" /></span><span>LANChat<span className="title-period">.</span></span><ThemeToggle /></div>
        <div className="auth-story-copy"><span className="auth-overline"><span /> A LITTLE CLOSER, EVERY DAY</span><h1>Good things<br />are better<br /><span>shared.</span></h1><p>Your people, your moments, all in one lovely little place.</p></div>
        <div className="auth-story-art auth-story-art-premium" aria-hidden="true"><div className="auth-art-orbit orbit-one" /><div className="auth-art-orbit orbit-two" /><span className="auth-art-main"><MessageCircle size={47} /></span><span className="auth-art-bubble bubble-a">hey! <Sparkles size={12} /></span><span className="auth-art-bubble bubble-b"><i /><i /><i /></span><Heart className="auth-art-heart" size={30} fill="currentColor" /></div>
        <div className="auth-story-foot"><ShieldCheck size={15} />Your conversations stay between you and your people.</div>
      </section>
      <section className="auth-card-wrap auth-card-wrap-premium"><div className="auth-card auth-card-premium">
        <div className="auth-card-icon"><Heart size={22} fill="currentColor" /></div>
        <p className="eyebrow">{creating ? 'YOUR PEOPLE ARE ONE STEP AWAY' : 'PICK UP WHERE YOUR PEOPLE ARE'}</p>
        <h2>{creating ? <>Create your<br />LANChat account.</> : <>Welcome Back <span className="auth-wave">👋</span></>}</h2>
        <p className="auth-intro">{creating ? 'Join LANChat and be part of something lovely.' : 'Sign in to continue to LANChat.'}</p>
        <form onSubmit={submit} className="auth-form auth-form-premium">
          {creating && <><label htmlFor="account-name">Full name</label><div className="auth-input-shell"><UserRound size={17} /><input id="account-name" type="text" autoComplete="name" placeholder="Your full name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={48} /></div>
            <label htmlFor="account-phone">Phone number <span className="optional-label">OPTIONAL</span></label><div className="auth-input-shell"><Phone size={17} /><input id="account-phone" type="tel" autoComplete="tel" placeholder="Your phone number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} maxLength={32} /></div></>}
          <label htmlFor="account-email">Email address</label><div className="auth-input-shell"><Mail size={17} /><input id="account-email" type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <label htmlFor="account-password">Password</label><div className="auth-input-shell"><LockKeyhole size={17} /><input id="account-password" type={showPassword ? 'text' : 'password'} autoComplete={creating ? 'new-password' : 'current-password'} placeholder={creating ? 'At least 6 characters' : 'Password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /><button className="auth-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}
          <button className="primary-button auth-submit auth-submit-premium" disabled={busy || (creating && !name.trim())}>{busy ? (creating ? 'Creating account…' : 'Signing in…') : (creating ? 'Create Account' : 'Log In')}<ArrowRight size={18} /></button>
        </form>
        {!creating && <button className="text-button auth-reset" type="button" onClick={() => void resetPassword()} disabled={busy}>Forgot password?</button>}
        <p className="auth-switch">{creating ? 'Already have an account?' : "Don't have an account?"} <button type="button" onClick={() => changeMode(creating ? 'sign-in' : 'create-account')}>{creating ? 'Log In' : 'Sign Up'}</button></p>
        <div className="auth-card-foot"><ShieldCheck size={14} /><span>Secure sign-in to keep your conversations yours.</span></div>
      </div><p className="auth-terms">A little corner for the people who matter. <Heart size={11} fill="currentColor" /></p></section>
    </div>
  </main>;
}
