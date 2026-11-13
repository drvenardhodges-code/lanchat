import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, Timestamp, where } from 'firebase/firestore';
import { Eye, Heart, ImagePlus, LoaderCircle, Plus, Send, Trash2, Video, X, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { Avatar } from './Avatar';
import { db } from '../lib/firebase';
import { uploadStoryMedia } from '../lib/chat';
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
  const [viewCount, setViewCount] = useState(0);
  const [reactionCount, setReactionCount] = useState(0);
  const [hasReacted, setHasReacted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!viewer || !activeStory || !db || !user) {
      setViewCount(0); setReactionCount(0); setHasReacted(false);
      return;
    }
    const firestore = db;
    let cancelled = false;
    const loadEngagement = async () => {
      try {
        if (activeStory.userId !== user.uid) {
          await setDoc(doc(firestore, 'stories', activeStory.id, 'views', user.uid), {
            userId: user.uid, userName: profile.name, viewedAt: Timestamp.now(),
          }, { merge: true });
        }
        const [views, reactions, mine] = await Promise.all([
          activeStory.userId === user.uid ? getDocs(collection(firestore, 'stories', activeStory.id, 'views')) : Promise.resolve(null),
          getDocs(collection(firestore, 'stories', activeStory.id, 'reactions')),
          getDocs(query(collection(firestore, 'stories', activeStory.id, 'reactions'), where('userId', '==', user.uid))),
        ]);
        if (!cancelled) {
          setViewCount(views?.size ?? 0); setReactionCount(reactions.size); setHasReacted(!mine.empty);
        }
      } catch {
        if (!cancelled) onNotice('Could not load story views and reactions.');
      }
    };
    void loadEngagement();
    return () => { cancelled = true; };
  }, [viewer?.groupIndex, viewer?.storyIndex, activeStory?.id, user?.uid]);

  async function toggleReaction() {
    if (!db || !user || !activeStory) return;
    const reactionRef = doc(db, 'stories', activeStory.id, 'reactions', user.uid);
    try {
      if (hasReacted) {
        await deleteDoc(reactionRef);
        setHasReacted(false); setReactionCount((count) => Math.max(0, count - 1));
      } else {
        await setDoc(reactionRef, { userId: user.uid, userName: profile.name, emoji: '❤️', createdAt: Timestamp.now() });
        setHasReacted(true); setReactionCount((count) => count + 1);
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
        <button type="button" className="story-person story-add" onClick={() => { setError(''); setComposerOpen(true); }}>
          <span className="story-ring story-add-ring"><span className="story-avatar-placeholder"><Plus size={21} /></span></span>
          <span className="story-person-name">Your story</span>
        </button>
        {groups.filter((group) => group.userId !== user?.uid).map((group) => (
          <button type="button" className="story-person" key={group.userId} onClick={() => setViewer({ groupIndex: groups.indexOf(group), storyIndex: 0 })}>
            <span className="story-ring"><Avatar profile={{ uid: group.userId, name: group.userName, photoURL: group.userPhotoURL, about: '', phoneNumber: '' }} size="md" /></span>
            <span className="story-person-name">{group.userName.split(' ')[0]}</span>
          </button>
        ))}
        {ownGroup && <button type="button" className="story-person story-own-view" onClick={() => setViewer({ groupIndex: groups.indexOf(ownGroup), storyIndex: 0 })}>
          <span className="story-ring"><Avatar profile={profile} size="md" /></span><span className="story-person-name">Your updates</span>
        </button>}
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
          <div className={'story-viewer-content ' + (activeStory.mediaType === 'text' ? 'story-text-content' : '')}>
            {activeStory.mediaType === 'image' && <img src={activeStory.mediaURL} alt="Story" />}
            {activeStory.mediaType === 'video' && <video src={activeStory.mediaURL} controls autoPlay playsInline onEnded={nextStory} />}
            {activeStory.mediaType === 'text' && <div className="story-text-art"><span>LANCHAT MOMENT</span><p>{activeStory.text}</p></div>}
            {activeStory.mediaType !== 'text' && activeStory.text && <div className="story-viewer-caption">{activeStory.text}</div>}
            <button type="button" className="story-nav story-nav-prev" onClick={previousStory} aria-label="Previous story"><ChevronLeft size={24} /></button>
            <button type="button" className="story-nav story-nav-next" onClick={nextStory} aria-label="Next story"><ChevronRight size={24} /></button>
          </div>
          <footer className="story-engagement">
            <span className="story-engagement-count"><Heart size={16} /> {reactionCount} likes</span>
            {activeStory.userId === user?.uid && <span className="story-engagement-count"><Eye size={16} /> {viewCount} views</span>}
            {activeStory.userId !== user?.uid && <button type="button" className={hasReacted ? 'story-react-button story-reacted' : 'story-react-button'} onClick={() => void toggleReaction()} aria-label={hasReacted ? 'Remove reaction' : 'React to story'}><Heart size={18} fill={hasReacted ? 'currentColor' : 'none'} /> {hasReacted ? 'Liked' : 'React'}</button>}
          </footer>
        </div>
      </div>}
    </section>
  );
}
