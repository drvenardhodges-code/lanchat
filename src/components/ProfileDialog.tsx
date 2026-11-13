import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, LoaderCircle, X } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Profile } from '../types';

export function ProfileDialog({ profile, onClose, onSave, busy }: { profile: Profile; onClose: () => void; onSave: (next: Pick<Profile, 'name' | 'about' | 'phoneNumber'>, image?: File | null) => Promise<void>; busy: boolean }) {
  const [name, setName] = useState(profile.name);
  const [about, setAbout] = useState(profile.about);
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState(profile.photoURL);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image) return;
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave({ name: name.trim(), about: about.trim(), phoneNumber: phoneNumber.trim() }, image);
  }

  const previewProfile = { ...profile, name: name || profile.name, photoURL: preview };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-heading">
      <header className="modal-heading"><div><span className="eyebrow">YOUR LITTLE INTRODUCTION</span><h2 id="profile-heading">Edit your profile</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}><X size={19} /></button></header>
      <form onSubmit={submit}>
        <div className="profile-photo-edit"><div className="profile-photo-large"><Avatar profile={previewProfile} size="xl" /></div><button type="button" className="photo-upload-button" onClick={() => inputRef.current?.click()}><ImagePlus size={16} /> Change photo</button><input ref={inputRef} type="file" accept="image/*" className="visually-hidden" onChange={(event) => setImage(event.target.files?.[0] ?? null)} /><small>JPG, PNG or GIF · up to 5 MB</small></div>
        <label className="form-label" htmlFor="profile-name">Your name</label><input className="text-field" id="profile-name" value={name} maxLength={48} onChange={(event) => setName(event.target.value)} required />
        <div className="label-with-count"><label className="form-label" htmlFor="profile-about">About</label><span>{about.length}/140</span></div><textarea className="text-field about-field" id="profile-about" value={about} maxLength={140} rows={3} onChange={(event) => setAbout(event.target.value)} placeholder="A little something about you…" />
        <label className="form-label" htmlFor="profile-phone">Phone number <span className="optional-label">OPTIONAL</span></label><input className="text-field" id="profile-phone" type="tel" autoComplete="tel" maxLength={32} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+1 415 555 0108" /><small className="profile-phone-hint">Profile information only — fictional/test numbers are okay. It is not SMS-verified. Signed-in users can see it and use it to find you.</small>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="primary-button save-profile-button" disabled={!name.trim() || busy}>{busy ? <><LoaderCircle size={16} className="spin" /> Saving…</> : 'Save changes'}</button></div>
      </form>
    </section>
  </div>;
}
