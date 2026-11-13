import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  ArrowLeft, ArrowUpRight, Check, CheckCheck, ChevronDown, CircleHelp, Info,
  MessageCircle, MoreHorizontal, Paperclip, Phone, Plus, Search, Send, Settings2,
  ShieldCheck, Smile, Sparkles, X,
} from 'lucide-react';
import { Avatar } from './components/Avatar';
import { ThemeToggle } from './components/ThemeToggle';
import { AuthGate } from './components/AuthGate';
import { NewChatDialog } from './components/NewChatDialog';
import { ProfileDialog } from './components/ProfileDialog';
import { firebaseConfigured, auth } from './lib/firebase';
import {
  ensureUserProfile,
  getChatByPhone,
  normalizePhone,
  saveProfile,
  sendChatMessage,
  subscribeToMessages,
  subscribeToThreads,
  uploadAvatar,
} from './lib/chat';
import { demoMessages, demoProfile, demoThreads, demoUsers } from './lib/demo';
import type { ChatMessage, Profile, Thread } from './types';
import './index.css';

function timeAgo(date: Date) {
  const delta = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function messageTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function messageDay(date: Date) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((startOfToday.getTime() - day.getTime()) / 86400000);
  if (difference === 0) return 'TODAY';
  if (difference === 1) return 'YESTERDAY';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) }).toUpperCase();
}

function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(demoProfile);
  const [threads, setThreads] = useState<Thread[]>(demoThreads);
  const [activeId, setActiveId] = useState<string | null>(demoThreads[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages[demoThreads[0]?.id ?? ''] ?? []);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [query, setQuery] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [compose, setCompose] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileList, setMobileList] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const messageEnd = useRef<HTMLDivElement>(null);

  const demoMode = !firebaseConfigured;
  const activeThread = threads.find((thread) => thread.id === activeId) ?? null;

  useEffect(() => {
    if (!firebaseConfigured || !auth) return;
    const stopAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(demoProfile);
        setThreads([]);
        setActiveId(null);
        return;
      }
      setLoadingProfile(true);
      try {
        const nextProfile = await ensureUserProfile(user);
        setProfile(nextProfile);
      } catch (error) {
        showNotice(error instanceof Error ? error.message : 'Could not load your profile.');
      } finally {
        setLoadingProfile(false);
      }
    });
    return () => stopAuth();
  }, []);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.search-box input')?.focus();
      }
    }
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  useEffect(() => {
    if (demoMode) {
      setThreads(demoThreads);
      if (!activeId || !demoThreads.some((thread) => thread.id === activeId)) {
        setActiveId(demoThreads[0]?.id ?? null);
      }
      return;
    }
    if (!firebaseUser) return;
    return subscribeToThreads(firebaseUser.uid, setThreads, (error) => showNotice(error.message));
  }, [demoMode, firebaseUser?.uid]);

  useEffect(() => {
    if (!activeId && threads.length > 0) setActiveId(threads[0].id);
  }, [activeId, threads]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (demoMode) {
      setMessages(demoMessages[activeId] ?? []);
      return;
    }
    if (!firebaseUser) return;
    return subscribeToMessages(activeId, setMessages, (error) => showNotice(error.message));
  }, [activeId, demoMode, firebaseUser?.uid]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, activeId]);

  const filteredThreads = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter((thread) =>
      `${thread.peer.name} ${thread.lastMessage?.text ?? ''}`.toLowerCase().includes(term),
    );
  }, [query, threads]);

  const visibleMessages = useMemo(() => {
    const term = messageSearch.trim().toLowerCase();
    return term ? messages.filter((message) => message.text.toLowerCase().includes(term)) : messages;
  }, [messageSearch, messages]);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 3600);
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    const text = compose.trim();
    if (!text || !activeThread || busy) return;
    setCompose('');
    if (demoMode) {
      const sent: ChatMessage = { id: `local-${Date.now()}`, text, senderId: 'me', createdAt: new Date() };
      setMessages((current) => [...current, sent]);
      setThreads((current) => current.map((thread) => thread.id === activeThread.id
        ? { ...thread, lastMessage: sent, updatedAt: sent.createdAt }
        : thread).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
      return;
    }
    if (!firebaseUser) return;
    setBusy(true);
    try {
      await sendChatMessage(activeThread.id, firebaseUser.uid, text);
    } catch (error) {
      setCompose(text);
      showNotice(error instanceof Error ? error.message : 'Message could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  async function handleNewChat(phone: string) {
    if (demoMode) {
      const cleaned = phone.replace(/[\s().-]/g, '');
      const contact = demoUsers.find((person) => person.phoneNumber.replace(/[\s().-]/g, '') === cleaned);
      if (!contact) throw new Error('No sample account matches that number. Connect Firebase to discover real Lanchat users.');
      const existing = threads.find((thread) => thread.peer.uid === contact.uid);
      if (existing) {
        setActiveId(existing.id);
        setShowNewChat(false);
        setMobileList(false);
        return;
      }
      const thread: Thread = { id: `demo-${contact.uid}`, peer: contact, updatedAt: new Date(), lastMessage: null };
      setThreads((current) => [thread, ...current]);
      setActiveId(thread.id);
      setShowNewChat(false);
      setMobileList(false);
      showNotice(`Chat started with ${contact.name}`);
      return;
    }
    if (!firebaseUser) return;
    const thread = await getChatByPhone(firebaseUser.uid, phone);
    setThreads((current) => current.some((item) => item.id === thread.id) ? current : [thread, ...current]);
    setActiveId(thread.id);
    setShowNewChat(false);
    setMobileList(false);
  }

  async function handleSaveProfile(next: Pick<Profile, 'name' | 'about' | 'phoneNumber'>, image?: File | null) {
    if (demoMode) {
      let photoURL = profile.photoURL;
      if (image) photoURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that image.'));
        reader.readAsDataURL(image);
      });
      setProfile((current) => ({ ...current, ...next, phoneNumber: normalizePhone(next.phoneNumber), photoURL }));
      setShowProfile(false);
      showNotice('Your profile was updated in this preview.');
      return;
    }
    if (!firebaseUser) return;
    setBusy(true);
    try {
      const photoURL = image ? await uploadAvatar(firebaseUser.uid, image) : profile.photoURL;
      await saveProfile(firebaseUser, { ...next, photoURL });
      setProfile((current) => ({ ...current, ...next, phoneNumber: normalizePhone(next.phoneNumber), photoURL }));
      setShowProfile(false);
      showNotice('Profile updated.');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Profile could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function openThread(threadId: string) {
    setActiveId(threadId);
    setMobileList(false);
    setShowDetails(false);
    setMessageSearch('');
    setShowMessageSearch(false);
  }

  async function handleSignOut() {
    if (auth) await signOut(auth);
  }

  const profileMenu = (
    <button className="profile-shortcut" type="button" onClick={() => setShowProfile(true)} aria-label="Edit your profile">
      <Avatar profile={profile} size="sm" />
      <span className="profile-shortcut-copy"><strong>{profile.name}</strong><small>Edit profile</small></span>
      <ChevronDown size={15} />
    </button>
  );

  if (!demoMode && !firebaseUser) {
    return <AuthGate />;
  }

  if (loadingProfile) {
    return <div className="loading-screen"><div className="brand-mark"><MessageCircle size={23} /></div><span>Opening your Lanchat…</span></div>;
  }

  return (
    <main className="app-shell">
      <aside className="app-rail">
        <button className="brand-mark" type="button" onClick={() => openThread(activeId ?? '')} aria-label="Lanchat home">
          <MessageCircle size={23} strokeWidth={2.5} />
          <span className="brand-spark"><Sparkles size={9} fill="currentColor" /></span>
        </button>
        <div className="rail-divider" />
        <button className="rail-button active" aria-label="Chats" title="Chats" type="button"><MessageCircle size={21} /><span className="rail-dot" /></button>
        <button className="rail-button" aria-label="New chat" title="New chat" type="button" onClick={() => setShowNewChat(true)}><Plus size={21} /></button>
        <div className="rail-spacer" />
        <button className="rail-button" aria-label="Help" title="Help" type="button" onClick={() => showNotice('Your chats stay in sync with Firebase when connected.')}><CircleHelp size={20} /></button>
        {firebaseUser && <button className="rail-button" aria-label="Sign out" title="Sign out" type="button" onClick={handleSignOut}><ArrowUpRight size={20} /></button>}
        <button className="rail-avatar" type="button" onClick={() => setShowProfile(true)} aria-label="Open your profile"><Avatar profile={profile} size="sm" /></button>
      </aside>

      <section className={`inbox-panel ${mobileList ? 'inbox-panel-mobile-open' : ''}`}>
        <header className="inbox-header">
          <div className="wordmark-line">
            <div><p className="eyebrow">YOUR LITTLE CORNER</p><h1>Messages<span className="title-period">.</span></h1></div>
            <div className="inbox-header-actions"><ThemeToggle /><button className="new-chat-button" type="button" onClick={() => setShowNewChat(true)} aria-label="Start a new chat"><Plus size={19} /><span>New chat</span></button></div>
          </div>
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a conversation" aria-label="Search conversations" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}<kbd>⌘ K</kbd></label>
          <div className="inbox-section-label"><span>RECENT CONVERSATIONS</span><button type="button" className="icon-quiet" aria-label="Conversation settings" onClick={() => showNotice('You’re all caught up.') }><Settings2 size={17} /></button></div>
        </header>
        <div className="thread-list">
          {filteredThreads.length > 0 ? filteredThreads.map((thread, index) => {
            const selected = thread.id === activeId;
            return <button className={`thread-card ${selected ? 'selected' : ''}`} key={thread.id} type="button" onClick={() => openThread(thread.id)} style={{ animationDelay: `${index * 35}ms` }}>
              <div className="thread-avatar-wrap"><Avatar profile={thread.peer} size="lg" online={thread.peer.online} /></div>
              <div className="thread-copy"><div className="thread-title-row"><strong>{thread.peer.name}</strong><time>{timeAgo(thread.updatedAt)}</time></div><div className="thread-preview-row"><span className="thread-preview">{thread.lastMessage?.text ?? 'Say hello and start something lovely.'}</span>{thread.lastMessage?.senderId === (firebaseUser?.uid ?? 'me') && <CheckCheck className="delivered-icon" size={15} />}</div></div>
            </button>;
          }) : <div className="empty-search"><div className="empty-search-icon"><Search size={18} /></div><strong>No conversations found</strong><span>Try a different name or message.</span></div>}
        </div>
        <footer className="inbox-footer">
          {demoMode && <button className="demo-connect-card" type="button" onClick={() => showNotice('Add your Firebase web app settings to .env — see FIREBASE_SETUP.md.') }><span className="demo-connect-icon"><Sparkles size={15} /></span><span><strong>Make it yours</strong><small>Connect your Firebase project</small></span><ArrowUpRight size={16} /></button>}
          {profileMenu}
        </footer>
      </section>

      <section className={`chat-panel ${mobileList ? 'chat-panel-mobile-hidden' : ''}`}>
        {activeThread ? <>
          <header className="chat-header">
            <button type="button" className="back-to-list" onClick={() => setMobileList(true)} aria-label="Back to conversations"><ArrowLeft size={19} /></button>
            <div className="chat-person"><Avatar profile={activeThread.peer} size="md" online={activeThread.peer.online} /><div><h2>{activeThread.peer.name}</h2><span className="person-status"><i className={activeThread.peer.online ? 'status-online' : ''} />{activeThread.peer.online ? 'Around right now' : 'On Lanchat'}</span></div></div>
            <div className="chat-header-actions"><ThemeToggle />
              {showMessageSearch && <input className="message-search-input" value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search in chat" autoFocus />}
              <button type="button" className={`header-icon ${showMessageSearch ? 'header-icon-active' : ''}`} onClick={() => { setShowMessageSearch((value) => !value); setMessageSearch(''); }} aria-label="Search messages"><Search size={19} /></button>
              <button type="button" className={`header-icon ${showDetails ? 'header-icon-active' : ''}`} onClick={() => setShowDetails((value) => !value)} aria-label="Chat details"><Info size={19} /></button>
              <span className="action-separator" />
              <button type="button" className="call-button" onClick={() => showNotice('Voice calls are not included in this version.')} aria-label="Voice call"><Phone size={17} /></button>
              <button type="button" className="header-icon more-button" onClick={() => showNotice('This is a one-to-one chat.')} aria-label="More chat options"><MoreHorizontal size={21} /></button>
            </div>
          </header>
          {demoMode && <div className="preview-ribbon"><span><Sparkles size={13} /> SAMPLE PREVIEW</span><span>Connect Firebase to send messages between real accounts.</span><button type="button" onClick={() => showNotice('Add Firebase configuration and read FIREBASE_SETUP.md to connect the app.')}>Setup <ArrowUpRight size={12} /></button></div>}
          <div className="chat-body-wrap">
            <div className="chat-wallpaper" />
            <div className="message-scroll-area">
              <div className="encryption-note"><span><ShieldCheck size={14} /> {demoMode ? 'This is a local sample preview.' : 'Your conversations are stored in your Firebase project.'}</span></div>
              {visibleMessages.map((message, index) => {
                const own = message.senderId === (firebaseUser?.uid ?? 'me');
                const newDay = index === 0 || visibleMessages[index - 1].createdAt.toDateString() !== message.createdAt.toDateString();
                return <Fragment key={message.id}>
                  {newDay && <div className="day-divider"><span>{messageDay(message.createdAt)}</span></div>}
                  <div className={`message-row ${own ? 'message-row-own' : ''}`} style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}>
                  {!own && <Avatar profile={activeThread.peer} size="xs" />}
                  <div className={`message-bubble ${own ? 'message-bubble-own' : ''}`}><p>{message.text}</p><div className="message-meta"><time>{messageTime(message.createdAt)}</time>{own && <CheckCheck size={14} className="message-check" />}</div></div>
                  </div>
                </Fragment>;
              })}
              {visibleMessages.length === 0 && messageSearch && <div className="no-message-results">No messages match “{messageSearch}”.</div>}
              <div ref={messageEnd} />
            </div>
            {showDetails && <aside className="details-card"><button type="button" className="details-close" onClick={() => setShowDetails(false)} aria-label="Close chat details"><X size={16} /></button><Avatar profile={activeThread.peer} size="xl" online={activeThread.peer.online} /><h3>{activeThread.peer.name}</h3>{activeThread.peer.phoneNumber && <span className="details-phone">{activeThread.peer.phoneNumber}</span>}<p>{activeThread.peer.about || 'A Lanchat friend'}</p><div className="details-note"><ShieldCheck size={15} />Messages sync through Firebase.</div></aside>}
          </div>
          <form className="composer" onSubmit={handleSend}>
            <button type="button" className="composer-tool" aria-label="Emoji picker" onClick={() => setCompose((value) => `${value}${value ? ' ' : ''}🙂`)}><Smile size={21} /></button>
            <button type="button" className="composer-tool attach-tool" aria-label="Attach file" onClick={() => showNotice('File attachments are not included yet.')}><Paperclip size={20} /></button>
            <input value={compose} onChange={(event) => setCompose(event.target.value)} maxLength={4000} placeholder={`Write ${activeThread.peer.name.split(' ')[0]} a message…`} aria-label="Message text" />
            <span className="composer-hint">↵ to send</span>
            <button type="submit" className={`send-button ${compose.trim() ? 'send-button-ready' : ''}`} disabled={!compose.trim() || busy} aria-label="Send message"><Send size={17} fill="currentColor" /></button>
          </form>
        </> : <div className="no-active-chat"><div className="empty-illustration"><div className="empty-orbit orbit-one" /><div className="empty-orbit orbit-two" /><div className="empty-chat-icon"><MessageCircle size={34} /><span><Sparkles size={13} fill="currentColor" /></span></div><div className="float-bubble bubble-a"><span /></div><div className="float-bubble bubble-b"><span /><span /><span /></div></div><p className="eyebrow">A LITTLE SPACE FOR YOUR PEOPLE</p><h2>Good conversations<br />start with hello.</h2><p className="no-chat-copy">Pick a conversation on the left or make a new one. Your people are just a message away.</p><button className="primary-button" type="button" onClick={() => setShowNewChat(true)}><Plus size={17} /> Start a new chat</button><div className="quiet-trust"><ShieldCheck size={14} /> {demoMode ? 'Connect Firebase for real accounts and live chats' : 'Messages update in real time'}</div></div>}
      </section>

      {showNewChat && <NewChatDialog onClose={() => setShowNewChat(false)} onStart={handleNewChat} demoMode={demoMode} contacts={demoUsers} />}
      {showProfile && <ProfileDialog profile={profile} onClose={() => setShowProfile(false)} onSave={handleSaveProfile} busy={busy} />}
      {notice && <div className="toast" role="status"><span className="toast-check"><Check size={14} /></span>{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice('')}><X size={15} /></button></div>}
    </main>
  );
}

export default App;
