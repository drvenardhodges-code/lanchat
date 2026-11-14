import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  ArrowLeft, ArrowUpRight, Check, CheckCheck, CircleHelp, Info,
  MessageCircle, Paperclip, Phone, Plus, Search, Send, Settings2, Crown,
  ShieldCheck, Smile, Sparkles, X, CircleDot, UserRound, Ban, Flag, Trash2, MoreVertical, Star,
} from 'lucide-react';
import { Avatar } from './components/Avatar';
import { ThemeToggle } from './components/ThemeToggle';
import { AuthGate } from './components/AuthGate';
import { NewChatDialog } from './components/NewChatDialog';
import { ProfileDialog } from './components/ProfileDialog';
import { StoriesBar } from './components/StoriesBar';
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
  reactToMessage,
  deleteChatMessage,
  blockChatUser,
  reportChatUser,
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
  const [inboxCategory, setInboxCategory] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => { try { return JSON.parse(window.localStorage.getItem('lanchat-favorites') || '[]') as string[]; } catch { return []; } });
  const [readAt, setReadAt] = useState<Record<string, number>>(() => { try { return JSON.parse(window.localStorage.getItem('lanchat-read-at') || '{}') as Record<string, number>; } catch { return {}; } });
  const [showInboxSearch, setShowInboxSearch] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [compose, setCompose] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showPeerProfile, setShowPeerProfile] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [mobileList, setMobileList] = useState(true);
  const [mobileTab, setMobileTab] = useState<'chats' | 'status' | 'profile'>('chats');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const seenThreadUpdates = useRef<Map<string, string> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const messageEnd = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);

  const demoMode = !firebaseConfigured;
  const activeThread = threads.find((thread) => thread.id === activeId) ?? null;

  useEffect(() => {
    if (!firebaseConfigured || !auth) return;
    const stopAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setThreads([]);
      setActiveId(null);
      setMessages([]);
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
    seenThreadUpdates.current = null;
    return subscribeToThreads(firebaseUser.uid, (nextThreads) => {
      const signature = (thread: Thread) => thread.lastMessage ? `${thread.lastMessage.createdAt.getTime()}|${thread.lastMessage.senderId}|${thread.lastMessage.text}` : '';
      const previous = seenThreadUpdates.current;
      if (previous) {
        const hasIncoming = nextThreads.some((thread) => {
          const nextSignature = signature(thread);
          const changed = nextSignature && previous.get(thread.id) !== nextSignature;
          return Boolean(changed && thread.lastMessage?.senderId !== firebaseUser.uid);
        });
        if (hasIncoming) playIncomingTone();
      }
      seenThreadUpdates.current = new Map(nextThreads.map((thread) => [thread.id, signature(thread)]));
      setThreads(nextThreads);
    }, (error) => showNotice(error.message));
  }, [demoMode, firebaseUser?.uid]);

  useEffect(() => {
    if (activeId && !threads.some((thread) => thread.id === activeId)) {
      setActiveId(threads[0]?.id ?? null);
      return;
    }
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

  useEffect(() => { try { window.localStorage.setItem('lanchat-favorites', JSON.stringify(favoriteIds)); } catch { /* Keep favorites for this session. */ } }, [favoriteIds]);
  useEffect(() => { try { window.localStorage.setItem('lanchat-read-at', JSON.stringify(readAt)); } catch { /* Keep read markers for this session. */ } }, [readAt]);

  const filteredThreads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return threads.filter((thread) => {
      const matchesSearch = !term || `${thread.peer.name} ${thread.lastMessage?.text ?? ''}`.toLowerCase().includes(term);
      const unread = Boolean(thread.lastMessage && thread.lastMessage.senderId !== (firebaseUser?.uid ?? 'me') && thread.lastMessage.createdAt.getTime() > (readAt[thread.id] ?? 0));
      const matchesCategory = inboxCategory === 'all' || (inboxCategory === 'unread' && unread) || (inboxCategory === 'favorites' && favoriteIds.includes(thread.id)) || (inboxCategory === 'groups' && false);
      return matchesSearch && matchesCategory;
    });
  }, [query, threads, inboxCategory, favoriteIds, readAt, firebaseUser?.uid]);

  const visibleMessages = useMemo(() => {
    const term = messageSearch.trim().toLowerCase();
    return term ? messages.filter((message) => message.text.toLowerCase().includes(term)) : messages;
  }, [messageSearch, messages]);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 3600);
  }

  function playIncomingTone() {
    try {
      const context = audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = context;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.16);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 0.23);
    } catch { /* Sound is optional; keep chat working when audio is unavailable. */ }
  }

  useEffect(() => {
    const unlockAudio = () => {
      try {
        const context = audioContextRef.current ?? new window.AudioContext();
        audioContextRef.current = context;
        if (context.state === 'suspended') void context.resume();
      } catch { /* Audio may be unavailable on this browser. */ }
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => { window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); };
  }, []);

  function handleAppTouchStart(event: TouchEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, button, .message-bubble, .story-viewer-backdrop, .peer-profile-page') || (target.closest('.modal-backdrop') && !target.closest('.profile-modal'))) return;
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleAppTouchEnd(event: TouchEvent<HTMLElement>) {
    if (!swipeStart.current) return;
    const start = swipeStart.current;
    swipeStart.current = null;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 75 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (dx < 0) {
      if (mobileTab === 'chats') { setMobileTab('status'); setMobileList(true); }
      else if (mobileTab === 'status') { setMobileTab('profile'); setShowProfile(true); }
    } else {
      if (mobileTab === 'profile') { setShowProfile(false); setMobileTab('status'); }
      else if (mobileTab === 'status') { setMobileTab('chats'); setMobileList(true); }
    }
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    const text = compose.trim();
    if (!text || !activeThread || busy) return;
    setCompose('');
    if (demoMode) {
      const sent: ChatMessage = { id: `local-${Date.now()}`, text, senderId: 'me', createdAt: new Date(), replyTo: replyTo ? { messageId: replyTo.id, text: replyTo.text, senderName: replyTo.senderId === (firebaseUser?.uid ?? 'me') ? 'You' : activeThread.peer.name } : null };
      setMessages((current) => [...current, sent]);
      setReplyTo(null);
      setThreads((current) => current.map((thread) => thread.id === activeThread.id
        ? { ...thread, lastMessage: sent, updatedAt: sent.createdAt }
        : thread).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
      return;
    }
    if (!firebaseUser) return;
    setBusy(true);
    try {
      await sendChatMessage(activeThread.id, firebaseUser.uid, text, replyTo ? { messageId: replyTo.id, text: replyTo.text, senderName: replyTo.senderId === firebaseUser.uid ? 'You' : activeThread.peer.name } : null);
      setReplyTo(null);
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
      if (!contact) throw new Error('No sample account matches that number. No account matches that number. Check the number and try again.');
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
    const opening = threads.find((thread) => thread.id === threadId);
    setReadAt((current) => ({ ...current, [threadId]: Math.max(current[threadId] ?? 0, opening?.lastMessage?.createdAt.getTime() ?? Date.now()) }));
    setMobileTab('chats');
    setActiveId(threadId);
    setMobileList(false);
    setShowDetails(false);
    setMessageSearch('');
    setReplyTo(null);
    setShowMessageSearch(false);
  }

  async function handleMessageReaction(messageId: string, emoji: string) {
    if (demoMode || !firebaseUser || !activeThread) { showNotice('Reactions are available in a connected chat.'); return; }
    try { await reactToMessage(activeThread.id, messageId, firebaseUser.uid, emoji); setSelectedMessageId(null); }
    catch (error) { showNotice(error instanceof Error ? error.message : 'Reaction could not be saved.'); }
  }

  async function handleDeleteMessage(message: ChatMessage) {
    if (!firebaseUser || !activeThread || message.senderId !== firebaseUser.uid) return;
    if (demoMode) { setMessages((current) => current.filter((item) => item.id !== message.id)); setSelectedMessageId(null); return; }
    try { await deleteChatMessage(activeThread.id, message.id, firebaseUser.uid); setSelectedMessageId(null); showNotice('Message deleted.'); }
    catch (error) { showNotice(error instanceof Error ? error.message : 'Message could not be deleted.'); }
  }

  async function handleBlockUser() {
    if (!firebaseUser || !activeThread || demoMode) { showNotice('Blocking is available in connected accounts.'); return; }
    if (!window.confirm('Block ' + activeThread.peer.name + '?')) return;
    try { await blockChatUser(firebaseUser.uid, activeThread.peer.uid); setShowChatMenu(false); setShowPeerProfile(false); setMobileList(true); setActiveId(null); showNotice('User blocked.'); }
    catch (error) { showNotice(error instanceof Error ? error.message : 'Could not block this user.'); }
  }

  async function handleReportUser() {
    if (!firebaseUser || !activeThread || demoMode) { showNotice('Reporting is available in connected accounts.'); return; }
    const reason = window.prompt('Why are you reporting this user?');
    if (!reason || !reason.trim()) return;
    try { await reportChatUser(firebaseUser.uid, activeThread.peer.uid, reason.trim()); setShowChatMenu(false); showNotice('Report submitted. Thank you for helping keep Lanchat safe.'); }
    catch (error) { showNotice(error instanceof Error ? error.message : 'Report could not be submitted.'); }
  }

  async function handleSignOut() {
    if (auth) await signOut(auth);
  }

  if (!demoMode && !firebaseUser) {
    return <AuthGate />;
  }

  if (loadingProfile) {
    return <div className="loading-screen"><div className="brand-mark"><MessageCircle size={23} /></div><span>Opening your Lanchat…</span></div>;
  }

  return (
    <main className="app-shell" onTouchStart={handleAppTouchStart} onTouchEnd={handleAppTouchEnd} onTouchCancel={() => { swipeStart.current = null; }}>
      <aside className="app-rail">
        <button className="brand-mark" type="button" onClick={() => openThread(activeId ?? '')} aria-label="Lanchat home">
          <MessageCircle size={23} strokeWidth={2.5} />
          <span className="brand-spark"><Sparkles size={9} fill="currentColor" /></span>
        </button>
        <div className="rail-divider" />
        <button className="rail-button active" aria-label="Chats" title="Chats" type="button"><MessageCircle size={21} /><span className="rail-dot" /></button>
        <button className="rail-button" aria-label="New chat" title="New chat" type="button" onClick={() => setShowNewChat(true)}><Plus size={21} /></button>
        <div className="rail-spacer" />
        <button className="rail-button" aria-label="Help" title="Help" type="button" onClick={() => showNotice('Your conversations are right here.')}><CircleHelp size={20} /></button>
        {firebaseUser && <button className="rail-button" aria-label="Sign out" title="Sign out" type="button" onClick={handleSignOut}><ArrowUpRight size={20} /></button>}
        <button className="rail-avatar" type="button" onClick={() => setShowProfile(true)} aria-label="Open your profile"><Avatar profile={profile} size="sm" /></button>
      </aside>

      <section className={`inbox-panel ${mobileList ? 'inbox-panel-mobile-open' : ''}`}>
        <header className="inbox-header reference-inbox-header">
          <div className="reference-brand-row">
            <div className="reference-brand"><Crown size={30} strokeWidth={2.4} fill="currentColor" /><h1>LANChat</h1></div>
            <div className="reference-header-actions">
              <button className="reference-icon-button" type="button" aria-label="Search conversations" onClick={() => setShowInboxSearch((value) => !value)}><Search size={19} /></button>
              <button className="reference-add-button" type="button" onClick={() => setShowNewChat(true)} aria-label="New chat"><Plus size={23} /></button>
            </div>
          </div>
          <div className="inbox-category-tabs" role="tablist" aria-label="Conversation categories">
            {([{ id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' }, { id: 'favorites', label: 'Favorites' }, { id: 'groups', label: 'Group' }] as const).map((category) => <button key={category.id} type="button" role="tab" aria-selected={inboxCategory === category.id} className={inboxCategory === category.id ? 'active' : ''} onClick={() => setInboxCategory(category.id)}>{category.label}</button>)}
          </div>
          {showInboxSearch && <label className="search-box reference-search-box"><Search size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a conversation" aria-label="Search conversations" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}</label>}
        </header>
        <div className="thread-list reference-thread-list">
          {filteredThreads.length > 0 ? filteredThreads.map((thread, index) => {
            const selected = thread.id === activeId;
            const unread = Boolean(thread.lastMessage && thread.lastMessage.senderId !== (firebaseUser?.uid ?? 'me') && thread.lastMessage.createdAt.getTime() > (readAt[thread.id] ?? 0));
            const favorite = favoriteIds.includes(thread.id);
            return <div className={`thread-card reference-thread-card ${selected ? 'selected' : ''}`} key={thread.id} style={{ animationDelay: `${index * 35}ms` }}>
              <button className="thread-card-open" type="button" onClick={() => openThread(thread.id)} aria-label={`Open chat with ${thread.peer.name}`}>
                <div className="thread-avatar-wrap reference-thread-avatar"><Avatar profile={thread.peer} size="lg" online={thread.peer.online} /></div>
                <div className="thread-copy reference-thread-copy"><div className="thread-title-row"><strong>{thread.peer.name}</strong><time>{messageTime(thread.updatedAt)}</time></div><div className="thread-preview-row"><span className="thread-preview">{thread.lastMessage?.senderId === (firebaseUser?.uid ?? 'me') ? 'You: ' : ''}{thread.lastMessage?.text ?? 'Tap to start chatting'}</span>{unread && <i className="inbox-unread-dot" aria-label="Unread" />}{thread.lastMessage?.senderId === (firebaseUser?.uid ?? 'me') && <CheckCheck className="delivered-icon" size={14} />}</div></div>
              </button>
              <button type="button" className={`thread-favorite-button ${favorite ? 'is-favorite' : ''}`} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => setFavoriteIds((current) => favorite ? current.filter((id) => id !== thread.id) : [...current, thread.id])}><Star size={16} fill={favorite ? 'currentColor' : 'none'} /></button>
            </div>;
          }) : <div className="empty-search"><div className="empty-search-icon"><Search size={18} /></div><strong>{inboxCategory === 'groups' ? 'Group chats are coming soon' : inboxCategory === 'favorites' ? 'No favorite chats yet' : inboxCategory === 'unread' ? 'You are all caught up' : 'No conversations found'}</strong><span>{inboxCategory === 'groups' ? 'Group conversations are not supported yet.' : inboxCategory === 'favorites' ? 'Tap the star beside a conversation to save it here.' : inboxCategory === 'unread' ? 'New messages will appear here.' : 'Try a different name or message.'}</span></div>}
        </div>
        <footer className="inbox-footer">
          
        </footer>
      </section>

      <section className={`chat-panel ${mobileList ? 'chat-panel-mobile-hidden' : ''}`}>
        {activeThread ? <>
          <header className="chat-header">
            <button type="button" className="back-to-list" onClick={() => setMobileList(true)} aria-label="Back to conversations"><ArrowLeft size={19} /></button>
            <button type="button" className="chat-person chat-person-clickable" onClick={() => setShowPeerProfile(true)} aria-label="View contact profile"><Avatar profile={activeThread.peer} size="md" online={activeThread.peer.online} /><div><h2>{activeThread.peer.name}</h2><span className="person-status"><i className={activeThread.peer.online ? 'status-online' : ''} />{activeThread.peer.online ? 'Around right now' : 'On Lanchat'}</span></div></button>
            <div className="chat-header-actions"><ThemeToggle />
              {showMessageSearch && <input className="message-search-input" value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search in chat" autoFocus />}
              <button type="button" className={`header-icon ${showMessageSearch ? 'header-icon-active' : ''}`} onClick={() => { setShowMessageSearch((value) => !value); setMessageSearch(''); }} aria-label="Search messages"><Search size={19} /></button>
              <button type="button" className={`header-icon ${showDetails ? 'header-icon-active' : ''}`} onClick={() => setShowDetails((value) => !value)} aria-label="Chat details"><Info size={19} /></button>
              <span className="action-separator" />
              <button type="button" className="call-button" onClick={() => showNotice('Voice calls are not included in this version.')} aria-label="Voice call"><Phone size={17} /></button>
              <div className="chat-menu-wrap"><button type="button" className="header-icon more-button" onClick={() => setShowChatMenu((value) => !value)} aria-label="More chat options"><MoreVertical size={21} /></button>{showChatMenu && <div className="chat-options-menu"><button type="button" onClick={() => { setShowChatMenu(false); setShowPeerProfile(true); }}><UserRound size={16} /> View profile</button><button type="button" onClick={handleBlockUser}><Ban size={16} /> Block user</button><button type="button" onClick={handleReportUser}><Flag size={16} /> Report user</button></div>}</div>
            </div>
          </header>
          
          <div className="chat-body-wrap">
            <div className="chat-wallpaper" />
            <div className="message-scroll-area">
              <div className="encryption-note"><span><ShieldCheck size={14} /> {demoMode ? 'This is a local sample preview.' : 'Your conversations appear here.'}</span></div>
              {visibleMessages.map((message, index) => {
                const own = message.senderId === (firebaseUser?.uid ?? 'me');
                const newDay = index === 0 || visibleMessages[index - 1].createdAt.toDateString() !== message.createdAt.toDateString();
                return <Fragment key={message.id}>
                  {newDay && <div className="day-divider"><span>{messageDay(message.createdAt)}</span></div>}
                  <div className={`message-row ${own ? 'message-row-own' : ''}`} style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}>
                  {!own && <Avatar profile={activeThread.peer} size="xs" />}
                  <div className={`message-bubble ${own ? 'message-bubble-own' : ''}`} onClick={() => setSelectedMessageId(message.id)} onContextMenu={(event) => { event.preventDefault(); setSelectedMessageId(message.id); }} onTouchStart={(event) => { swipeStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; longPressTimer.current = window.setTimeout(() => setSelectedMessageId(message.id), 520); }} onTouchEnd={(event) => { if (longPressTimer.current) window.clearTimeout(longPressTimer.current); const start = swipeStart.current; swipeStart.current = null; if (start && event.changedTouches[0].clientX - start.x > 65 && Math.abs(event.changedTouches[0].clientY - start.y) < 55) { setReplyTo(message); setSelectedMessageId(null); } }} onTouchMove={() => { if (longPressTimer.current) window.clearTimeout(longPressTimer.current); }}><p>{message.replyTo && <span className="message-reply-quote"><strong>{message.replyTo.senderName}</strong>{message.replyTo.text}</span>}{message.text}</p><div className="message-meta"><time>{messageTime(message.createdAt)}</time>{own && <CheckCheck size={14} className="message-check" />}</div>{message.reactions && message.reactions.length > 0 && <div className="message-reaction-list">{Array.from(new Set(message.reactions.map((reaction) => reaction.emoji))).map((emoji) => <span key={emoji}>{emoji} {message.reactions!.filter((reaction) => reaction.emoji === emoji).length}</span>)}</div>}{selectedMessageId === message.id && <div className="message-actions"><button type="button" onClick={() => handleMessageReaction(message.id, '❤️')}>❤️</button><button type="button" onClick={() => handleMessageReaction(message.id, '😂')}>😂</button><button type="button" onClick={() => handleMessageReaction(message.id, '👍')}>👍</button><button type="button" onClick={() => handleMessageReaction(message.id, '🔥')}>🔥</button>{own && <button type="button" className="message-delete-action" onClick={() => handleDeleteMessage(message)}><Trash2 size={14} /> Delete</button>}<button type="button" onClick={() => setSelectedMessageId(null)} aria-label="Close actions">×</button></div>}</div>
                  </div>
                </Fragment>;
              })}
              {visibleMessages.length === 0 && messageSearch && <div className="no-message-results">No messages match “{messageSearch}”.</div>}
              <div ref={messageEnd} />
            </div>
            {showDetails && <aside className="details-card"><button type="button" className="details-close" onClick={() => setShowDetails(false)} aria-label="Close chat details"><X size={16} /></button><Avatar profile={activeThread.peer} size="xl" online={activeThread.peer.online} /><h3>{activeThread.peer.name}</h3>{activeThread.peer.phoneNumber && <span className="details-phone">{activeThread.peer.phoneNumber}</span>}<p>{activeThread.peer.about || 'A Lanchat friend'}</p><div className="details-note"><ShieldCheck size={15} />Your conversation details.</div></aside>}
          </div>
          <form className="composer" onSubmit={handleSend}>
            {replyTo && <div className="reply-composer-preview"><span><strong>Replying to {replyTo.senderId === (firebaseUser?.uid ?? 'me') ? 'yourself' : activeThread.peer.name}</strong><small>{replyTo.text}</small></span><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={16} /></button></div>}
            <button type="button" className="composer-tool" aria-label="Emoji picker" onClick={() => setCompose((value) => `${value}${value ? ' ' : ''}🙂`)}><Smile size={21} /></button>
            <button type="button" className="composer-tool attach-tool" aria-label="Attach file" onClick={() => showNotice('File attachments are not included yet.')}><Paperclip size={20} /></button>
            <input value={compose} onChange={(event) => setCompose(event.target.value)} maxLength={4000} placeholder={`Write ${activeThread.peer.name.split(' ')[0]} a message…`} aria-label="Message text" />
            <span className="composer-hint">↵ to send</span>
            <button type="submit" className={`send-button ${compose.trim() ? 'send-button-ready' : ''}`} disabled={!compose.trim() || busy} aria-label="Send message"><Send size={17} fill="currentColor" /></button>
          </form>
        </> : <div className="no-active-chat"><div className="empty-illustration"><div className="empty-orbit orbit-one" /><div className="empty-orbit orbit-two" /><div className="empty-chat-icon"><MessageCircle size={34} /><span><Sparkles size={13} fill="currentColor" /></span></div><div className="float-bubble bubble-a"><span /></div><div className="float-bubble bubble-b"><span /><span /><span /></div></div><p className="eyebrow">A LITTLE SPACE FOR YOUR PEOPLE</p><h2>Good conversations<br />start with hello.</h2><p className="no-chat-copy">Pick a conversation on the left or make a new one. Your people are just a message away.</p><button className="primary-button" type="button" onClick={() => setShowNewChat(true)}><Plus size={17} /> Start a new chat</button><div className="quiet-trust"><ShieldCheck size={14} /> {demoMode ? 'Sign in to connect with people' : 'Messages update in real time'}</div></div>}
      </section>

      {showPeerProfile && activeThread && <section className="peer-profile-page" role="dialog" aria-modal="true"><header className="peer-profile-header"><button type="button" onClick={() => setShowPeerProfile(false)} aria-label="Back"><ArrowLeft size={20} /></button><strong>Contact info</strong></header><div className="peer-profile-hero"><Avatar profile={activeThread.peer} size="xl" online={activeThread.peer.online} /><h1>{activeThread.peer.name}</h1><span>{activeThread.peer.online ? 'Around right now' : 'On Lanchat'}</span></div><div className="peer-profile-details"><div><small>ABOUT</small><p>{activeThread.peer.about || 'Hey there! I am using Lanchat.'}</p></div><div><small>PHONE NUMBER</small><p>{activeThread.peer.phoneNumber || 'Not shared'}</p></div><button type="button" onClick={handleBlockUser}><Ban size={17} /> Block user</button><button type="button" onClick={handleReportUser}><Flag size={17} /> Report user</button></div></section>}
      <section className={`status-page ${mobileTab === 'status' ? 'status-page-open' : ''}`} aria-label="Status">
        <header className="status-page-header">
          <div><p className="eyebrow">MOMENTS THAT LAST 24 HOURS</p><h1>Status<span className="title-period">.</span></h1></div>
          <ThemeToggle />
        </header>
        <StoriesBar user={firebaseUser ? { uid: firebaseUser.uid } : null} profile={profile} demoMode={demoMode} onNotice={showNotice} />
      </section>
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        <button type="button" className={mobileTab === 'chats' ? 'mobile-nav-item active' : 'mobile-nav-item'} onClick={() => { setMobileTab('chats'); setMobileList(true); setShowProfile(false); }} aria-label="Chats">
          <MessageCircle size={22} strokeWidth={2.2} /><span>Chats</span>
        </button>
        <button type="button" className={mobileTab === 'status' ? 'mobile-nav-item active' : 'mobile-nav-item'} onClick={() => { setMobileTab('status'); setMobileList(true); setShowProfile(false); }} aria-label="Status">
          <CircleDot size={22} strokeWidth={2.1} /><span>Status</span>
        </button>
        <button type="button" className="mobile-nav-item" onClick={() => { setMobileTab('profile'); setShowProfile(true); }} aria-label="Profile">
          <UserRound size={22} strokeWidth={2.1} /><span>Profile</span>
        </button>
      </nav>
      {showNewChat && <NewChatDialog onClose={() => setShowNewChat(false)} onStart={handleNewChat} demoMode={demoMode} contacts={demoUsers} />}
      {showProfile && <ProfileDialog profile={profile} onClose={() => { setShowProfile(false); setMobileTab('chats'); }} onSave={handleSaveProfile} busy={busy} />}
      {notice && <div className="toast" role="status"><span className="toast-check"><Check size={14} /></span>{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice('')}><X size={15} /></button></div>}
    </main>
  );
}

export default App;
