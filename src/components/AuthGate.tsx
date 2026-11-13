import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { auth } from '../lib/firebase';

export function AuthGate() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const recaptchaHost = useRef<HTMLDivElement>(null);

  useEffect(() => () => { verifier.current?.clear(); }, []);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    if (!auth || !recaptchaHost.current) return;
    setBusy(true);
    setError('');
    try {
      verifier.current?.clear();
      verifier.current = new RecaptchaVerifier(auth, recaptchaHost.current, { size: 'invisible' });
      const result = await signInWithPhoneNumber(auth, phone.trim().replace(/[\s().-]/g, ''), verifier.current);
      setConfirmation(result);
    } catch (issue) {
      verifier.current?.clear();
      verifier.current = null;
      setError(issue instanceof Error ? issue.message : 'We could not send the verification code. Check the number and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!confirmation) return;
    setBusy(true);
    setError('');
    try {
      await confirmation.confirm(code.trim());
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'That code did not work. Check it and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <div className="auth-skywash" />
    <div className="auth-layout">
      <section className="auth-story">
        <div className="auth-brand"><span className="brand-mark"><MessageCircle size={22} strokeWidth={2.5} /><Sparkles size={9} className="brand-spark" /></span><span>lanchat<span className="title-period">.</span></span></div>
        <div className="auth-story-copy"><span className="auth-overline"><span /> A LITTLE CLOSER, EVERY DAY</span><h1>Good things<br />are better<br /><span>shared.</span></h1><p>Your people, your moments, all in one lovely little place.</p></div>
        <div className="auth-story-art" aria-hidden="true"><div className="auth-art-orbit orbit-one" /><div className="auth-art-orbit orbit-two" /><span className="auth-art-main"><MessageCircle size={47} /></span><span className="auth-art-bubble bubble-a">hey! <Sparkles size={12} /></span><span className="auth-art-bubble bubble-b"><i /><i /><i /></span></div>
        <div className="auth-story-foot"><ShieldCheck size={15} />Your account is protected with Firebase phone verification.</div>
      </section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="auth-card-icon"><MessageCircle size={21} /></div>
        {!confirmation ? <><p className="eyebrow">PICK UP WHERE YOUR PEOPLE ARE</p><h2>Sign in with<br />your number.</h2><p className="auth-intro">We’ll text you a one-time code. No password to remember.</p><form onSubmit={requestCode} className="auth-form"><label htmlFor="phone">Phone number</label><div className="phone-input-wrap"><span className="phone-globe">+</span><input id="phone" type="tel" autoComplete="tel" placeholder="1 415 555 0100" value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={8} /></div><small className="field-hint">Include your country code, for example +1 415 555 0100.</small>{error && <p className="auth-error">{error}</p>}<button className="primary-button auth-submit" disabled={busy || phone.trim().length < 8}>{busy ? 'Sending code…' : 'Text me a code'}<span>→</span></button></form></> : <><p className="eyebrow">CHECK YOUR MESSAGES</p><h2>One small code,<br />then you’re in.</h2><p className="auth-intro">Enter the verification code we sent to <strong>{phone}</strong>.</p><form onSubmit={verifyCode} className="auth-form"><label htmlFor="code">Verification code</label><input className="code-input" id="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(event) => setCode(event.target.value)} required maxLength={8} />{error && <p className="auth-error">{error}</p>}<button className="primary-button auth-submit" disabled={busy || code.length < 4}>{busy ? 'Checking…' : 'Verify & continue'}<span>→</span></button><button className="text-button" type="button" onClick={() => { setConfirmation(null); setCode(''); setError(''); }}>Use a different number</button></form></>}
        <div className="auth-card-foot"><ShieldCheck size={14} /><span>Private by design. Your number is only used to sign you in.</span></div>
      </div><p className="auth-terms">By continuing, you agree to keep this a kind little corner.</p></section>
    </div>
    <div ref={recaptchaHost} id="recaptcha-container" />
  </main>;
}
