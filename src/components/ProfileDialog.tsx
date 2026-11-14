import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { ArrowLeft, Check, ImagePlus, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { Avatar } from './Avatar';
import type { Profile } from '../types';

export function ProfileDialog({ profile, onClose, onSave, busy }: { profile: Profile; onClose: () => void; onSave: (next: Pick<Profile, 'name' | 'about' | 'phoneNumber'>, image?: File | null) => Promise<void>; busy: boolean }) {
  const [name, setName] = useState(profile.name);
  const [about, setAbout] = useState(profile.about);
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState(profile.photoURL);
  const [cropOpen, setCropOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [cropError, setCropError] = useState('');
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image) return;
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  function chooseImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setCropError('Choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setCropError('Choose an image smaller than 5 MB.'); return; }
    setImage(file);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setCropError('');
    setCropOpen(true);
  }

  function startCropDrag(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y });
  }
  function moveCropDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    setOffset({ x: dragStart.originX + event.clientX - dragStart.x, y: dragStart.originY + event.clientY - dragStart.y });
  }

  async function applyCrop() {
    const imageElement = cropImageRef.current;
    if (!imageElement || !imageElement.naturalWidth) return;
    const size = 512;
    const frameSize = cropFrameRef.current?.clientWidth ?? 280;
    const scale = Math.max(frameSize / imageElement.naturalWidth, frameSize / imageElement.naturalHeight) * zoom;
    const renderedWidth = imageElement.naturalWidth * scale;
    const renderedHeight = imageElement.naturalHeight * scale;
    const left = (frameSize - renderedWidth) / 2 + offset.x;
    const top = (frameSize - renderedHeight) / 2 + offset.y;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) { setCropError('Your browser could not crop this image.'); return; }
    context.drawImage(imageElement, -left * size / frameSize, -top * size / frameSize, renderedWidth * size / frameSize, renderedHeight * size / frameSize);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9));
    if (!blob) { setCropError('Could not prepare this image. Try another photo.'); return; }
    const croppedFile = new File([blob], 'lanchat-profile.jpg', { type: 'image/jpeg' });
    setImage(croppedFile);
    setPreview(URL.createObjectURL(croppedFile));
    setCropOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave({ name: name.trim(), about: about.trim(), phoneNumber: phoneNumber.trim() }, image);
  }

  const previewProfile = { ...profile, name: name || profile.name, photoURL: preview };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-heading">
      <header className="modal-heading"><div><span className="eyebrow">YOUR LITTLE INTRODUCTION</span><h2 id="profile-heading">Edit your profile</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}><X size={19} /></button></header>
      <form onSubmit={submit}>
        <div className="profile-photo-edit"><div className="profile-photo-large"><Avatar profile={previewProfile} size="xl" /></div><button type="button" className="photo-upload-button" onClick={() => inputRef.current?.click()}><ImagePlus size={16} /> {preview ? 'Change photo' : 'Add profile photo'}</button><input ref={inputRef} type="file" accept="image/*" className="visually-hidden" onChange={(event) => { chooseImage(event.target.files?.[0]); event.target.value = ''; }} /><small>JPG, PNG or GIF · up to 5 MB</small></div>
        <label className="form-label" htmlFor="profile-name">Your name</label><input className="text-field" id="profile-name" value={name} maxLength={48} onChange={(event) => setName(event.target.value)} required />
        <div className="label-with-count"><label className="form-label" htmlFor="profile-about">About</label><span>{about.length}/140</span></div><textarea className="text-field about-field" id="profile-about" value={about} maxLength={140} rows={3} onChange={(event) => setAbout(event.target.value)} placeholder="A little something about you…" />
        <label className="form-label" htmlFor="profile-phone">Phone number <span className="optional-label">OPTIONAL</span></label><input className="text-field" id="profile-phone" type="tel" autoComplete="tel" maxLength={32} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+1 415 555 0108" /><small className="profile-phone-hint">Profile information only — fictional/test numbers are okay. It is not SMS-verified. Signed-in users can see it and use it to find you.</small>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="primary-button save-profile-button" disabled={!name.trim() || busy}>{busy ? <><LoaderCircle size={16} className="spin" /> Saving…</> : 'Save changes'}</button></div>
      </form>
    </section>
    {cropOpen && image && <div className="avatar-crop-page" role="dialog" aria-modal="true" aria-label="Crop profile photo">
      <header className="avatar-crop-header"><button type="button" onClick={() => setCropOpen(false)} aria-label="Back"><ArrowLeft size={20} /></button><div><strong>Adjust your photo</strong><small>Move and zoom to get the perfect fit</small></div><button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} aria-label="Reset crop"><RotateCcw size={18} /></button></header>
      <main className="avatar-crop-main">
        <div ref={cropFrameRef} className="avatar-crop-frame" onPointerDown={startCropDrag} onPointerMove={moveCropDrag} onPointerUp={() => setDragStart(null)} onPointerCancel={() => setDragStart(null)}>
          <img ref={cropImageRef} src={URL.createObjectURL(image)} alt="Crop preview" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }} />
          <span className="avatar-crop-mask" />
        </div>
        <p>Drag the photo to reposition it. Your profile picture will appear as a circle.</p>
        <label className="avatar-crop-zoom">Zoom <input type="range" min="1" max="3" step=".01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        {cropError && <p className="avatar-crop-error">{cropError}</p>}
      </main>
      <footer className="avatar-crop-footer"><button type="button" className="secondary-button" onClick={() => setCropOpen(false)}>Cancel</button><button type="button" className="primary-button" onClick={() => void applyCrop()}><Check size={16} /> Use photo</button></footer>
    </div>}
  </div>;
}
