export interface Profile {
  uid: string;
  phoneNumber: string;
  name: string;
  about: string;
  photoURL: string;
  online?: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: Date;
  reactions?: { userId: string; emoji: string }[];
  replyTo?: { messageId: string; text: string; senderName: string } | null;
}

export interface Thread {
  id: string;
  peer: Profile;
  lastMessage: ChatMessage | null;
  updatedAt: Date;
}
