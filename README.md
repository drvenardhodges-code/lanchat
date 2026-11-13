# Lanchat

A responsive, light-blue messaging app inspired by familiar chat apps. Built with React, TypeScript, Vite, and Firebase Authentication, Cloud Firestore, and Storage.

## Quick start

1. Install dependencies: `pnpm install`
2. Start the app: `pnpm dev`
3. For Firebase phone authentication and live chats, follow [Firebase setup](./FIREBASE_SETUP.md).

Lanchat is wired to the Firebase web app `lanchat-ccf2a`; the Firebase browser config and Analytics measurement ID supplied by the project owner are set as defaults in the client initializer. Enable Phone Auth, authorize your Preview/published domains, create Firestore and Storage, and deploy the included rules/index before using real accounts and messages. The sample preview remains available if Firebase config is removed. Optional `VITE_FIREBASE_*` values in `.env.local` can override the defaults.

## Main features

- Firebase phone number registration and one-time-code sign-in.
- Realtime one-to-one chat list and message updates.
- Exact E.164 phone-number discovery for registered Lanchat users.
- Editable name, about text, and Firebase Storage profile picture.
- Responsive desktop/mobile conversation interface and local sample preview.

The Firebase browser configuration is public app configuration, not a server secret. Never add a Firebase service-account key to the client. Phone-index writes are bound to the verified Firebase phone claim, and each message plus its conversation preview is committed atomically. The rules, schema, phone-index privacy limits, and deployment steps are documented in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).
