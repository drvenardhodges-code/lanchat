import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, where, writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import type { ChatMessage, Profile, Thread } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  return db;
}

export function normalizePhone(phone: string) {
  return phone.trim().replace(/[\s().-]/g, '');
}

function toDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate() as Date;
  }
  return value instanceof Date ? value : new Date();
}

function profileFrom(uid: string, data: Record<string, unknown>, phoneNumber = ''): Profile {
  return {
    uid,
    phoneNumber: String(data.phoneNumber ?? phoneNumber),
    name: String(data.name ?? 'Lanchat friend'),
    about: String(data.about ?? 'Available'),
    photoURL: String(data.photoURL ?? ''),
  };
}

export async function ensureUserProfile(user: User): Promise<Profile> {
  const firestore = requireDb();
  const userRef = doc(firestore, 'users', user.uid);
  const privateSnapshot = await getDoc(userRef);
  const phoneNumber = user.phoneNumber ?? '';
  if (!privateSnapshot.exists()) {
    await setDoc(userRef, { uid: user.uid, phoneNumber, createdAt: serverTimestamp() });
  }

  const profileRef = doc(firestore, 'profiles', user.uid);
  let profileSnapshot = await getDoc(profileRef);
  if (!profileSnapshot.exists()) {
    await setDoc(profileRef, {
      uid: user.uid,
      name: user.displayName ?? 'New Lanchat friend',
      about: 'Available',
      photoURL: user.photoURL ?? '',
      phoneNumber: normalizePhone(phoneNumber),
      updatedAt: serverTimestamp(),
    });
    profileSnapshot = await getDoc(profileRef);
  } else if (!profileSnapshot.data().phoneNumber && phoneNumber) {
    await setDoc(profileRef, { phoneNumber: normalizePhone(phoneNumber), updatedAt: serverTimestamp() }, { merge: true });
    profileSnapshot = await getDoc(profileRef);
  }

  if (phoneNumber) {
    await setDoc(doc(firestore, 'phoneIndex', normalizePhone(phoneNumber)), { uid: user.uid }, { merge: true });
  }
  return profileFrom(user.uid, profileSnapshot.data() ?? {}, phoneNumber);
}

export function subscribeToThreads(uid: string, onChange: (threads: Thread[]) => void, onError: (error: Error) => void) {
  const firestore = requireDb();
  const chatsQuery = query(collection(firestore, 'chats'), where('participants', 'array-contains', uid), orderBy('updatedAt', 'desc'), limit(80));
  return onSnapshot(chatsQuery, async (snapshot) => {
    const blockedSnapshot = await getDocs(collection(firestore, 'users', uid, 'blocked'));
    const blockedIds = new Set(blockedSnapshot.docs.map((entry) => entry.id));
    const result = await Promise.all(snapshot.docs.map(async (chatSnapshot) => {
      const data = chatSnapshot.data();
      const peerId = (data.participants as string[]).find((participant) => participant !== uid);
      if (!peerId || blockedIds.has(peerId)) return null;
      const peerSnapshot = await getDoc(doc(firestore, 'profiles', peerId));
      const peerProfile = peerSnapshot.exists() ? peerSnapshot.data() : {};
      const last = data.lastMessage as Record<string, unknown> | undefined;
      const lastMessage = last?.text ? {
        id: 'last-message',
        text: String(last.text),
        senderId: String(last.senderId ?? ''),
        createdAt: toDate(last.createdAt),
      } satisfies ChatMessage : null;
      return {
        id: chatSnapshot.id,
        peer: profileFrom(peerId, peerProfile),
        lastMessage,
        updatedAt: toDate(data.updatedAt),
      } satisfies Thread;
    }));
    onChange(result.filter((thread): thread is Thread => thread !== null));
  }, (error) => onError(error));
}

export function subscribeToMessages(chatId: string, onChange: (messages: ChatMessage[]) => void, onError: (error: Error) => void) {
  const firestore = requireDb();
  const messagesQuery = query(collection(firestore, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(150));
  return onSnapshot(messagesQuery, async (snapshot) => {
    try {
      const messages = await Promise.all(snapshot.docs.map(async (entry) => {
        const data = entry.data();
        const reactionSnapshot = await getDocs(collection(firestore, 'chats', chatId, 'messages', entry.id, 'reactions'));
        const reactions = reactionSnapshot.docs.map((reaction) => ({ userId: reaction.id, emoji: String(reaction.data().emoji ?? '') }));
        return { id: entry.id, text: String(data.text ?? ''), senderId: String(data.senderId ?? ''), createdAt: toDate(data.createdAt), reactions };
      }));
      onChange(messages);
    } catch (error) { onError(error instanceof Error ? error : new Error('Could not load reactions.')); }
  }, onError);
}

export async function sendChatMessage(chatId: string, senderId: string, text: string) {
  const firestore = requireDb();
  const chatRef = doc(firestore, 'chats', chatId);
  const batch = writeBatch(firestore);
  const messageRef = doc(collection(chatRef, 'messages'));
  batch.set(messageRef, { text, senderId, createdAt: serverTimestamp() });
  batch.update(chatRef, {
    lastMessage: { text, senderId, createdAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function getChatByPhone(currentUid: string, phone: string): Promise<Thread> {
  const firestore = requireDb();
  const normalized = normalizePhone(phone);
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error('Enter the phone number with its country code, for example +14155550108.');
  }
  const indexSnapshot = await getDoc(doc(firestore, 'phoneIndex', normalized));
  let peerId = indexSnapshot.exists() ? String(indexSnapshot.data().uid ?? '') : '';
  let peerData: Record<string, unknown> | undefined;
  if (peerId) {
    const legacyProfile = await getDoc(doc(firestore, 'profiles', peerId));
    if (legacyProfile.exists()) peerData = legacyProfile.data();
  }
  if (!peerData) {
    const matchingProfiles = await getDocs(query(collection(firestore, 'profiles'), where('phoneNumber', '==', normalized), limit(1)));
    const match = matchingProfiles.docs[0];
    if (match) {
      peerId = match.id;
      peerData = match.data();
    }
  }
  if (!peerId || !peerData) throw new Error('No Lanchat account is registered with that profile number.');
  if (peerId === currentUid) throw new Error('That is your own number.');

  const participants = [currentUid, peerId].sort();
  const chatId = participants.join('__');
  const chatRef = doc(firestore, 'chats', chatId);
  const chatSnapshot = await getDoc(chatRef);
  // Keep a complete, queryable chat record so it remains in the inbox after reload.
  await setDoc(chatRef, {
    participants,
    updatedAt: serverTimestamp(),
    ...(!chatSnapshot.exists() ? { createdAt: serverTimestamp(), lastMessage: null } : {}),
  }, { merge: true });
  return {
    id: chatId,
    peer: profileFrom(peerId, peerData, normalized),
    lastMessage: null,
    updatedAt: new Date(),
  };
}

export async function saveProfile(user: User, profile: Pick<Profile, 'name' | 'about' | 'photoURL' | 'phoneNumber'>) {
  const firestore = requireDb();
  const phoneNumber = user.phoneNumber ?? '';
  await setDoc(doc(firestore, 'profiles', user.uid), {
    uid: user.uid,
    ...profile,
    phoneNumber: normalizePhone(profile.phoneNumber),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  if (phoneNumber) {
    await setDoc(doc(firestore, 'phoneIndex', normalizePhone(phoneNumber)), { uid: user.uid }, { merge: true });
  }
}

export async function uploadAvatar(uid: string, file: File) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !uploadPreset) {
    throw new Error('Profile photo uploads are not configured yet. Add the Cloudinary cloud name and unsigned upload preset to Vercel.');
  }
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for your profile photo.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile pictures must be 5 MB or smaller.');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', `lanchat/avatars/${uid}`);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const result = await response.json() as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || 'The profile photo could not be uploaded. Check the Cloudinary upload preset and try again.');
  }
  return result.secure_url;
}


export async function uploadStoryMedia(uid: string, file: File) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !uploadPreset) {
    throw new Error('Story uploads are not configured. Check the Cloudinary environment variables in Vercel.');
  }
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    throw new Error('Choose an image or video for your story.');
  }
  if (file.size > 15 * 1024 * 1024) throw new Error('Stories must be 15 MB or smaller.');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', `lanchat/stories/${uid}`);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, {
    method: 'POST',
    body: formData,
  });
  const result = await response.json() as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || 'Story media upload failed. Check that your unsigned Cloudinary preset allows image and video uploads.');
  }
  return result.secure_url;
}


export async function reactToMessage(chatId: string, messageId: string, uid: string, emoji: string) {
  const firestore = requireDb();
  const reactionRef = doc(firestore, 'chats', chatId, 'messages', messageId, 'reactions', uid);
  const existing = await getDoc(reactionRef);
  if (existing.exists() && existing.data().emoji === emoji) await deleteDoc(reactionRef);
  else await setDoc(reactionRef, { userId: uid, emoji, createdAt: serverTimestamp() });
}

export async function deleteChatMessage(chatId: string, messageId: string, uid: string) {
  const firestore = requireDb();
  const messageRef = doc(firestore, 'chats', chatId, 'messages', messageId);
  const message = await getDoc(messageRef);
  if (!message.exists() || message.data().senderId !== uid) throw new Error('You can only delete your own messages.');
  await deleteDoc(messageRef);
}

export async function blockChatUser(uid: string, peerId: string) {
  await setDoc(doc(requireDb(), 'users', uid, 'blocked', peerId), { userId: peerId, createdAt: serverTimestamp() });
}

export async function reportChatUser(uid: string, peerId: string, reason: string) {
  await setDoc(doc(collection(requireDb(), 'reports')), { reporterId: uid, reportedUserId: peerId, reason, createdAt: serverTimestamp(), status: 'new' });
}
