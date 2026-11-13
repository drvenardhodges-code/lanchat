# Lanchat

A responsive, light-blue messaging app inspired by familiar chat apps. Built with React, TypeScript, Vite, and Firebase Authentication, Cloud Firestore, and Storage.

## Quick start

1. Install dependencies: `pnpm install`
2. Start the app: `pnpm dev`
3. For Firebase phone authentication and live chats, follow [Firebase setup](./FIREBASE_SETUP.md).

Without Firebase settings, Lanchat opens a clearly marked interactive sample preview. Do not treat sample messages or profile edits as live, shared account data. Add the six `VITE_FIREBASE_*` values in a local `.env.local` file to enable phone-number registration/sign-in, real-time conversations, phone lookup, profile editing, and picture uploads.

## Main features

- Firebase phone number registration and one-time-code sign-in.
- Realtime one-to-one chat list and message updates.
- Exact E.164 phone-number discovery for registered Lanchat users.
- Editable name, about text, and Firebase Storage profile picture.
- Responsive desktop/mobile conversation interface and local sample preview.

The Firebase browser configuration is public app configuration, not a server secret. Deploy the included Firestore and Storage security rules before using real data. Phone-index writes are bound to the verified Firebase phone claim, and each message plus its conversation preview is committed atomically. The rules, schema, phone-index privacy limits, and deployment steps are documented in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).
