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
}

export interface Thread {
  id: string;
  peer: Profile;
  lastMessage: ChatMessage | null;
  updatedAt: Date;
}
