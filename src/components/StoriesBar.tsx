import { useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, Timestamp, where } from 'firebase/firestore';
import { Eye, Heart, ImagePlus, LoaderCircle, Plus, Send, Trash2, Video, X, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { Avatar } from './Avatar';
import { db } from '../lib/firebase';
import { uploadStoryMedia, sendStoryReply } from '../lib/chat';
import type { Profile } from '../types';

type StoryItem = {
  id: string; userId: string; userName: string; userPhotoURL: string;
  text: string; mediaURL: string; mediaType: 'text' | 'image' | 'video';
  createdAt: Date; expiresAt: Date;
};
type StoryGroup = { userId: string; userName: string; userPhotoURL: string; stories: StoryItem[] };

function asDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate() as Date;
  return value instanceof Date ? value : new Date();
}
function ageLabel(date: Date) {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  return Math.floor(minutes / 60) + 'h ago';
}

export function StoriesBar({ user, profile, demoMode, onNotice }: {
  user: { uid: string } | null; profile: Profile; demoMode: boolean; onNotice: (message: string) => void;
}) {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [now, setNow] = useState(Date.now());
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewer, setViewer] = useState<{ groupIndex: number; storyIndex: number } | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [viewers, setViewers] = useState<{ userId: string; userName: string; photoURL: string }[]>([]);
  const [likers, setLikers] = useState<{ userId: string; userName: string; photoURL: string }[]>([]);
  const [hasReacted, setHasReacted] = useState(false);
  const [storyReply, setStoryReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [engagementSheet, setEngagementSheet] = useState<'views' | 'likes' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function handleStoryTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleStoryTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    if (deltaX < 0) nextStory();
    else previousStory();
  }

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (demoMode || !user || !db) { setStories([]); return; }
    const activeQuery = query(collection(db, 'stories'), where('expiresAt', '>', Timestamp.now()), orderBy('expiresAt', 'asc'), limit(100));
    return onSnapshot(activeQuery, (snapshot) => {
      const next = snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id, userId: String(data.userId ?? ''), userName: String(data.userName ?? 'Lanchat friend'),
          userPhotoURL: String(data.userPhotoURL ?? ''), text: String(data.text ?? ''), mediaURL: String(data.mediaURL ?? ''),
          mediaType: (data.mediaType === 'image' || data.mediaType === 'video' ? data.mediaType : 'text') as StoryItem['mediaType'],
          createdAt: asDate(data.createdAt), expiresAt: asDate(data.expiresAt),
        };
      }).filter((story) => story.expiresAt.getTime() > Date.now());
      setStories(next);
    }, (issue) => onNotice(issue.message.includes('permission') ? 'Stories need the updated Firestore rules. Publish the rules from this update.' : 'Could not load stories. Please try again.'));
  }, [demoMode, user?.uid]);

  const groups = useMemo<StoryGroup[]>(() => {
    const byUser = new Map<string, StoryGroup>();
    for (const story of stories.filter((item) => item.expiresAt.getTime() > now)) {
      const group = byUser.get(story.userId) ?? { userId: story.userId, userName: story.userName, userPhotoURL: story.userPhotoURL, stories: [] };
      group.stories.push(story);
      byUser.set(story.userId, group);
    }
    return [...byUser.values()].map((group) => ({
      ...group, stories: group.stories.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    })).sort((a, b) => b.stories[b.stories.length - 1].createdAt.getTime() - a.stories[a.stories.length - 1].createdAt.getTime());
  }, [stories, now]);

  const activeGroup = viewer ? groups[viewer.groupIndex] : undefined;
  const activeStory = activeGroup?.stories[viewer?.storyIndex ?? 0];

  function nextStory() {
    setViewer((current) => {
      if (!current) return null;
      const group = groups[current.groupIndex];
      if (!group) return null;
      if (current.storyIndex + 1 < group.stories.length) return { ...current, storyIndex: current.storyIndex + 1 };
      if (current.groupIndex + 1 < groups.length) return { groupIndex: current.groupIndex + 1, storyIndex: 0 };
      return null;
    });
  }
  function previousStory() {
    setViewer((current) => {
      if (!current) return null;
      if (current.storyIndex > 0) return { ...current, storyIndex: current.storyIndex - 1 };
      if (current.groupIndex > 0) return { groupIndex: current.groupIndex - 1, storyIndex: groups[current.groupIndex - 1].stories.length - 1 };
      return current;
    });
  }
  useEffect(() => {
    setEngagementSheet(null);
  }, [activeStory?.id]);

  useEffect(() => {
    if (!viewer || !activeStory || !db || !user) {
      setViewers([]); setLikers([]); setHasReacted(false);
      return;
    }
    const firestore = db;
    const storyRef = doc(firestore, 'stories', activeStory.id);
    const viewsRef = collection(storyRef, 'views');
    const reactionsRef = collection(storyRef, 'reactions');
    let stopViews: (() => void) | undefined;
    let stopReactions: (() => void) | undefined;
    let stopMyReaction: (() => void) | undefined;
    let cancelled = false;

    if (activeStory.userId !== user.uid) {
      // Record this viewer once, then keep this user's own reaction in sync.
      void setDoc(doc(viewsRef, user.uid), {
        userId: user.uid, userName: profile.name, photoURL: profile.photoURL || '', viewedAt: Timestamp.now(),
      }, { merge: true }).catch(() => { /* A failed view write should never interrupt viewing a friend's status. */ });
      stopMyReaction = onSnapshot(doc(reactionsRef, user.uid), (snapshot) => {
        setHasReacted(snapshot.exists());
      }, () => { /* Keep the status viewer quiet if reaction metadata is unavailable. */ });
    } else {
      // Only the owner sees the engagement panel. Both lists update live.
      stopViews = onSnapshot(query(viewsRef, orderBy('viewedAt', 'desc')), async (snapshot) => {
        const people = await Promise.all(snapshot.docs.map(async (entry) => {
          const data = entry.data();
          let photoURL = String(data.photoURL ?? '');
          if (!photoURL) {
            try { const personProfile = await getDoc(doc(firestore, 'profiles', entry.id)); if (personProfile.exists()) photoURL = String(personProfile.data().photoURL ?? ''); } catch { /* Keep initials if profile access is unavailable. */ }
          }
          return { userId: entry.id, userName: String(data.userName ?? 'LANChat user'), photoURL };
        }));
        if (!cancelled) setViewers(people);
      }, () => onNotice('Could not load story viewers. Check your Firestore rules.'));
    }
    stopReactions = onSnapshot(query(reactionsRef, orderBy('createdAt', 'desc')), async (snapshot) => {
      const people = await Promise.all(snapshot.docs.map(async (entry) => {
        const data = entry.data();
        let photoURL = String(data.photoURL ?? '');
        if (!photoURL) {
          try { const personProfile = await getDoc(doc(firestore, 'profiles', entry.id)); if (personProfile.exists()) photoURL = String(personProfile.data().photoURL ?? ''); } catch { /* Keep initials if profile access is unavailable. */ }
        }
        return { userId: entry.id, userName: String(data.userName ?? 'LANChat user'), photoURL };
      }));
      if (cancelled) return;
      setLikers(people);
      if (activeStory.userId !== user.uid) setHasReacted(snapshot.docs.some((entry) => entry.id === user.uid));
    }, () => { if (activeStory.userId === user.uid) onNotice('Could not load story likes.'); });

    return () => {
      cancelled = true;
      stopViews?.();
      stopReactions?.();
      stopMyReaction?.();
    };
  }, [viewer?.groupIndex, viewer?.storyIndex, activeStory?.id, user?.uid, profile.name]);

  async function submitStoryReply(event: FormEvent) {
    event.preventDefault();
    const message = storyReply.trim();
    if (!message || !user || !activeStory || activeStory.userId === user.uid || demoMode || sendingReply) return;
    setSendingReply(true);
    try {
      await sendStoryReply(user.uid, activeStory.userId, activeStory, message);
      setStoryReply('');
      onNotice('Reply sent to chat. 💜');
    } catch {
      onNotice('Could not send your status reply. Please try again.');
    } finally { setSendingReply(false); }
  }

  async function toggleReaction() {
    if (!db || !user || !activeStory) return;
    const reactionRef = doc(db, 'stories', activeStory.id, 'reactions', user.uid);
    try {
      if (hasReacted) {
        await deleteDoc(reactionRef);
        setHasReacted(false);
      } else {
        await setDoc(reactionRef, { userId: user.uid, userName: profile.name, photoURL: profile.photoURL || '', emoji: '❤️', createdAt: Timestamp.now() });
        setHasReacted(true);
      }
    } catch { onNotice('Could not send your reaction. Check your Firestore rules.'); }
  }

  useEffect(() => {
    if (!viewer || !activeStory || activeStory.mediaType === 'video') return;
    const timer = window.setTimeout(nextStory, 6500);
    return () => window.clearTimeout(timer);
  }, [viewer, activeStory?.id]);

  async function submitStory(event: FormEvent) {
    event.preventDefault();
    if (demoMode || !user || !db) { onNotice('Sign in to a real LANChat account to publish stories.'); return; }
    if (!text.trim() && !file) { setError('Write something or choose a photo/video first.'); return; }
    setUploading(true); setError('');
    try {
      let mediaURL = '';
      let mediaType: StoryItem['mediaType'] = 'text';
      if (file) {
        mediaType = file.type.startsWith('video/') ? 'video' : 'image';
        mediaURL = await uploadStoryMedia(user.uid, file);
      }
      const createdAt = Timestamp.now();
      await addDoc(collection(db, 'stories'), {
        userId: user.uid, userName: profile.name, userPhotoURL: profile.photoURL,
        text: text.trim().slice(0, 500), mediaURL, mediaType, createdAt,
        expiresAt: Timestamp.fromMillis(createdAt.toMillis() + 24 * 60 * 60 * 1000),
      });
      setText(''); setFile(null); setComposerOpen(false);
      onNotice('Your story is live for 24 hours! ✨');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Your story could not be published.');
    } finally { setUploading(false); }
  }
  async function removeStory(story: StoryItem) {
    if (!db || !user || story.userId !== user.uid) return;
    try { await deleteDoc(doc(db, 'stories', story.id)); setViewer(null); onNotice('Story deleted.'); }
    catch { onNotice('Could not delete that story. Please try again.'); }
  }

  const ownGroup = groups.find((group) => group.userId === user?.uid);
  return (
    <section className="stories-section" aria-label="Stories">
      <div className="stories-heading"><span>STORIES</span><span className="stories-expiry"><Clock3 size={11} /> 24 HOURS</span></div>
      <div className="stories-track">
        <button type="button" className="story-self-card" onClick={() => { if (ownGroup) setViewer({ groupIndex: groups.indexOf(ownGroup), storyIndex: 0 }); else { setError(''); setComposerOpen(true); } }}>
          <span className="story-self-avatar"><Avatar profile={profile} size="lg" /><i><Plus size={13} /></i></span>
          <span className="story-self-copy"><strong>My status</strong><small>{ownGroup ? 'Tap to view your update' : 'Share a photo, video or thought'}</small></span>
          <span className="story-self-action">{ownGroup ? 'View' : 'Add'}</span>
        </button>
        {groups.filter((group) => group.userId !== user?.uid).map((group) => (
          <button type="button" className="story-person" key={group.userId} onClick={() => setViewer({ groupIndex: groups.indexOf(group), storyIndex: 0 })}>
            <span className="story-ring"><Avatar profile={{ uid: group.userId, name: group.userName, photoURL: group.userPhotoURL, about: '', phoneNumber: '' }} size="md" /></span>
            <span className="story-person-name">{group.userName.split(' ')[0]}</span>
          </button>
        ))}

        {!groups.length && <span className="stories-empty">{demoMode ? 'Connect your account to share stories.' : 'Your friends’ stories will appear here.'}</span>}
      </div>

      {composerOpen && <div className="modal-backdrop story-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !uploading) setComposerOpen(false); }}>
        <section className="modal-card story-composer" role="dialog" aria-modal="true" aria-labelledby="story-composer-title">
          <header className="modal-heading"><div><span className="eyebrow">A MOMENT, JUST FOR TODAY</span><h2 id="story-composer-title">Create a story</h2></div><button type="button" className="modal-close" onClick={() => setComposerOpen(false)} disabled={uploading} aria-label="Close"><X size={19} /></button></header>
          {demoMode ? <div className="story-signin-note">Sign in to a real account to share a story with your friends.</div> : <form onSubmit={submitStory}>
            <div className="story-media-picker">
              {file && previewUrl ? <div className="story-file-preview">{file.type.startsWith('video/') ? <video src={previewUrl} muted playsInline /> : <img src={previewUrl} alt="Story preview" />}<button type="button" onClick={() => setFile(null)} aria-label="Remove selected media"><X size={15} /></button></div> : <button type="button" className="story-upload-prompt" onClick={() => fileRef.current?.click()}><span><ImagePlus size={21} /><Video size={19} /></span><strong>Add a photo or video</strong><small>Up to 15 MB · Images and videos</small></button>}
              <input ref={fileRef} type="file" accept="image/*,video/*" className="visually-hidden" onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected && selected.size > 15 * 1024 * 1024) { setError('Choose a photo or video smaller than 15 MB.'); return; } setFile(selected); setError(''); }} />
            </div>
            <label className="form-label" htmlFor="story-caption">Add a caption <span className="optional-label">OPTIONAL</span></label>
            <textarea id="story-caption" className="text-field story-caption" rows={3} maxLength={500} value={text} onChange={(event) => setText(event.target.value)} placeholder="Share a little moment…" />
            <div className="story-caption-count">{text.length}/500</div>
            {error && <p className="story-error" role="alert">{error}</p>}
            <div className="story-footer-note"><Clock3 size={13} /> Stories disappear from LANChat after 24 hours.</div>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setComposerOpen(false)} disabled={uploading}>Cancel</button><button type="submit" className="primary-button save-profile-button" disabled={uploading || (!text.trim() && !file)}>{uploading ? <><LoaderCircle size={16} className="spin" /> Posting…</> : <><Send size={15} /> Share story</>}</button></div>
          </form>}
        </section>
      </div>}

      {viewer && activeStory && activeGroup && <div className="story-viewer-backdrop" role="dialog" aria-modal="true" aria-label={activeGroup.userName + "'s story"} onMouseDown={(event) => { if (event.target === event.currentTarget) setViewer(null); }}>
        <div className="story-viewer">
          <div className="story-progress">{activeGroup.stories.map((item, index) => <span key={item.id} className={index <= viewer.storyIndex ? 'story-progress-done' : ''}><i /></span>)}</div>
          <header className="story-viewer-header">
            <Avatar profile={{ uid: activeGroup.userId, name: activeGroup.userName, photoURL: activeGroup.userPhotoURL, about: '', phoneNumber: '' }} size="sm" />
            <div><strong>{activeGroup.userName}</strong><small>{ageLabel(activeStory.createdAt)}</small></div>
            {activeStory.userId === user?.uid && <button type="button" className="story-delete" onClick={() => void removeStory(activeStory)} aria-label="Delete story"><Trash2 size={17} /></button>}
            <button type="button" className="story-close" onClick={() => setViewer(null)} aria-label="Close story"><X size={20} /></button>
          </header>
          <div
            className={'story-viewer-content ' + (activeStory.mediaType === 'text' ? 'story-text-content' : '')}
            onTouchStart={handleStoryTouchStart}
            onTouchEnd={handleStoryTouchEnd}
            onTouchCancel={() => { touchStartRef.current = null; }}
          >
            {activeStory.mediaType === 'image' && <img src={activeStory.mediaURL} alt="Story" />}
            {activeStory.mediaType === 'video' && <video src={activeStory.mediaURL} controls autoPlay playsInline onEnded={nextStory} />}
            {activeStory.mediaType === 'text' && <div className="story-text-art"><span>LANCHAT MOMENT</span><p>{activeStory.text}</p></div>}
            {activeStory.mediaType !== 'text' && activeStory.text && <div className="story-viewer-caption">{activeStory.text}</div>}
            <button type="button" className="story-nav story-nav-prev" onClick={previousStory} aria-label="Previous story"><ChevronLeft size={24} /></button>
            <button type="button" className="story-nav story-nav-next" onClick={nextStory} aria-label="Next story"><ChevronRight size={24} /></button>
          </div>
          <footer className="story-engagement">
            {activeStory.userId === user?.uid ? <>
              <div className="story-owner-metrics">
                <button type="button" className="story-owner-metric" onClick={() => setEngagementSheet('views')} aria-label={`View story viewers, ${viewers.length}`}>
                  <span><Eye size={17} /> View</span><strong>{viewers.length}</strong>
                </button>
                <button type="button" className="story-owner-metric" onClick={() => setEngagementSheet('likes')} aria-label={`View story likes, ${likers.length}`}>
                  <span><Heart size={17} /> Like</span><strong>{likers.length}</strong>
                </button>
              </div>
            </> : <div className="story-viewer-actions"><button type="button" className={hasReacted ? 'story-react-button story-reacted' : 'story-react-button'} onClick={() => void toggleReaction()} aria-label={hasReacted ? 'Remove reaction' : 'Like story'}><Heart size={18} fill={hasReacted ? 'currentColor' : 'none'} /> {hasReacted ? 'Liked' : 'Like'}</button>{user && !demoMode && <form className="story-reply-form" onSubmit={submitStoryReply}><input value={storyReply} onChange={(event) => setStoryReply(event.target.value)} maxLength={500} placeholder="Reply to status…" aria-label="Reply to status" /><button type="submit" disabled={!storyReply.trim() || sendingReply} aria-label="Send status reply">{sendingReply ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />}</button></form>}</div>}
          </footer>
        </div>
      </div>}
      {engagementSheet && activeStory?.userId === user?.uid && <div className="story-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEngagementSheet(null); }}>
        <section className="story-people-sheet" role="dialog" aria-modal="true" aria-label={engagementSheet === 'views' ? 'People who viewed your status' : 'People who liked your status'}>
          <div className="story-sheet-handle" />
          <header><div><strong>{engagementSheet === 'views' ? 'People who viewed' : 'People who liked'}</strong><small>{engagementSheet === 'views' ? viewers.length : likers.length} {engagementSheet === 'views' ? 'views' : 'likes'}</small></div><button type="button" onClick={() => setEngagementSheet(null)} aria-label="Close list"><X size={19} /></button></header>
          <div className="story-sheet-list">
            {(engagementSheet === 'views' ? viewers : likers).length ? (engagementSheet === 'views' ? viewers : likers).map((person) => <div className="story-sheet-person" key={person.userId}><Avatar profile={{ uid: person.userId, name: person.userName, photoURL: person.photoURL, about: '', phoneNumber: '' }} size="sm" /><span>{person.userName}</span></div>) : <p className="story-sheet-empty">{engagementSheet === 'views' ? 'No one has viewed your status yet.' : 'No one has liked your status yet.'}</p>}
          </div>
        </section>
      </div>}
    </section>
  );
}
