import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, where, writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import type { ChatMessage, Profile, Thread } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  return db;
}

function requireStorage() {
  if (!storage) throw new Error('Firebase Storage is not configured.');
  return storage;
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
    phoneNumber,
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
      updatedAt: serverTimestamp(),
    });
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
    const result = await Promise.all(snapshot.docs.map(async (chatSnapshot) => {
      const data = chatSnapshot.data();
      const peerId = (data.participants as string[]).find((participant) => participant !== uid);
      if (!peerId) return null;
      const peerSnapshot = await getDoc(doc(firestore, 'profiles', peerId));
      if (!peerSnapshot.exists()) return null;
      const last = data.lastMessage as Record<string, unknown> | undefined;
      const lastMessage = last?.text ? {
        id: 'last-message',
        text: String(last.text),
        senderId: String(last.senderId ?? ''),
        createdAt: toDate(last.createdAt),
      } satisfies ChatMessage : null;
      return {
        id: chatSnapshot.id,
        peer: profileFrom(peerId, peerSnapshot.data()),
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
  return onSnapshot(messagesQuery, (snapshot) => {
    onChange(snapshot.docs.map((entry) => {
      const data = entry.data();
      return { id: entry.id, text: String(data.text ?? ''), senderId: String(data.senderId ?? ''), createdAt: toDate(data.createdAt) };
    }));
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
  if (!indexSnapshot.exists()) throw new Error('No Lanchat account is registered with that number.');
  const peerId = String(indexSnapshot.data().uid ?? '');
  if (!peerId || peerId === currentUid) throw new Error(peerId === currentUid ? 'That is your own number.' : 'Could not find that account.');
  const peerSnapshot = await getDoc(doc(firestore, 'profiles', peerId));
  if (!peerSnapshot.exists()) throw new Error('That Lanchat profile is not available.');

  const participants = [currentUid, peerId].sort();
  const chatId = participants.join('__');
  const chatRef = doc(firestore, 'chats', chatId);
  const chatSnapshot = await getDoc(chatRef);
  if (!chatSnapshot.exists()) {
    await setDoc(chatRef, { participants, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessage: null });
  }
  return {
    id: chatId,
    peer: profileFrom(peerId, peerSnapshot.data(), normalized),
    lastMessage: null,
    updatedAt: new Date(),
  };
}

export async function saveProfile(user: User, profile: Pick<Profile, 'name' | 'about' | 'photoURL'>) {
  const firestore = requireDb();
  const phoneNumber = user.phoneNumber ?? '';
  await setDoc(doc(firestore, 'profiles', user.uid), {
    uid: user.uid,
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  if (phoneNumber) {
    await setDoc(doc(firestore, 'phoneIndex', normalizePhone(phoneNumber)), { uid: user.uid }, { merge: true });
  }
}

export async function uploadAvatar(uid: string, file: File) {
  const bucket = requireStorage();
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for your profile photo.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile pictures must be 5 MB or smaller.');
  const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
  const avatarRef = ref(bucket, `avatars/${uid}/profile-${Date.now()}.${extension}`);
  await uploadBytes(avatarRef, file, { contentType: file.type });
  return getDownloadURL(avatarRef);
}
