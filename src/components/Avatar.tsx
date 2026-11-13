import type { CSSProperties } from 'react';
import type { Profile } from '../types';

const tones = ['avatar-sky', 'avatar-lilac', 'avatar-coral', 'avatar-mint', 'avatar-peach', 'avatar-blue'];

export function Avatar({ profile, size = 'md', online = false }: { profile: Profile; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; online?: boolean }) {
  const tone = tones[[...profile.uid].reduce((total, char) => total + char.charCodeAt(0), 0) % tones.length];
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'L';
  return <span className={`avatar avatar-${size} ${tone}`} style={{ '--avatar-tone': tone } as CSSProperties} aria-label={profile.name}>
    {profile.photoURL ? <img src={profile.photoURL} alt="" /> : <span>{initials}</span>}
    {online && <i className="avatar-presence" />}
  </span>;
}
