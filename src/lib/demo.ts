import type { ChatMessage, Profile, Thread } from '../types';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000);

export const demoProfile: Profile = {
  uid: 'me', phoneNumber: '+1 (415) 555-0100', name: 'Jamie Taylor', about: 'Collecting little moments ✨', photoURL: '', online: true,
};

export const demoUsers: Profile[] = [
  { uid: 'maya', phoneNumber: '+14155550108', name: 'Maya Chen', about: 'Somewhere between coffee and a good book.', photoURL: '', online: true },
  { uid: 'noah', phoneNumber: '+14155550112', name: 'Noah Bennett', about: 'Weekend cyclist, weekday dreamer.', photoURL: '', online: false },
  { uid: 'sofia', phoneNumber: '+14155550118', name: 'Sofia Ramirez', about: 'Making things with my hands.', photoURL: '', online: true },
  { uid: 'theo', phoneNumber: '+14155550126', name: 'Theo Park', about: 'Here for the plot.', photoURL: '', online: false },
  { uid: 'ivy', phoneNumber: '+14155550135', name: 'Ivy Morgan', about: 'Kindness is always in style.', photoURL: '', online: true },
];

export const demoThreads: Thread[] = [
  { id: 'maya', peer: demoUsers[0], lastMessage: { id: 'm1', text: 'That sounds like the perfect plan ☀️', senderId: 'maya', createdAt: minutesAgo(4) }, updatedAt: minutesAgo(4) },
  { id: 'noah', peer: demoUsers[1], lastMessage: { id: 'n1', text: 'Sent you the route — it’s beautiful!', senderId: 'me', createdAt: minutesAgo(28) }, updatedAt: minutesAgo(28) },
  { id: 'sofia', peer: demoUsers[2], lastMessage: { id: 's1', text: 'Thank you!! You made my day 💙', senderId: 'sofia', createdAt: minutesAgo(96) }, updatedAt: minutesAgo(96) },
  { id: 'theo', peer: demoUsers[3], lastMessage: { id: 't1', text: 'See you there around seven?', senderId: 'theo', createdAt: minutesAgo(240) }, updatedAt: minutesAgo(240) },
  { id: 'ivy', peer: demoUsers[4], lastMessage: { id: 'i1', text: 'Voice note · 0:18', senderId: 'ivy', createdAt: minutesAgo(1440) }, updatedAt: minutesAgo(1440) },
];

export const demoMessages: Record<string, ChatMessage[]> = {
  maya: [
    { id: 'maya-1', text: 'Hey Jamie! Have you had a chance to look at that little place by the water?', senderId: 'maya', createdAt: minutesAgo(12) },
    { id: 'maya-2', text: 'I walked by it this morning and the light was unreal.', senderId: 'maya', createdAt: minutesAgo(11) },
    { id: 'maya-3', text: 'I have! The one with all the blue chairs? I’m in.', senderId: 'me', createdAt: minutesAgo(8) },
    { id: 'maya-4', text: 'That’s the one! There’s a tiny bookshop next door too.', senderId: 'maya', createdAt: minutesAgo(6) },
    { id: 'maya-5', text: 'That sounds like the perfect plan ☀️', senderId: 'maya', createdAt: minutesAgo(4) },
  ],
  noah: [
    { id: 'noah-1', text: 'I found a new trail for Saturday. Nothing too intense, just enough to earn lunch.', senderId: 'noah', createdAt: minutesAgo(50) },
    { id: 'noah-2', text: 'You know I’m always in for a trail 🌲', senderId: 'me', createdAt: minutesAgo(42) },
    { id: 'noah-3', text: 'Sent you the route — it’s beautiful!', senderId: 'me', createdAt: minutesAgo(28) },
  ],
  sofia: [
    { id: 'sofia-1', text: 'The prints arrived this afternoon!', senderId: 'sofia', createdAt: minutesAgo(108) },
    { id: 'sofia-2', text: 'The colours came out even better than I imagined.', senderId: 'sofia', createdAt: minutesAgo(103) },
    { id: 'sofia-3', text: 'Thank you!! You made my day 💙', senderId: 'sofia', createdAt: minutesAgo(96) },
  ],
  theo: [
    { id: 'theo-1', text: 'I booked a table for two at the new place downtown.', senderId: 'theo', createdAt: minutesAgo(270) },
    { id: 'theo-2', text: 'See you there around seven?', senderId: 'theo', createdAt: minutesAgo(240) },
  ],
  ivy: [
    { id: 'ivy-1', text: 'Just wanted to send a little love your way today 💌', senderId: 'ivy', createdAt: minutesAgo(1440) },
  ],
};
