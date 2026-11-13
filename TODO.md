# Lanchat — delivery outcomes

- [x] **Phone-number accounts and Firebase authentication** — People use their phone number to open an account. Implement Firebase Authentication phone-number sign-in and registration. The supplied Firebase web app settings are wired; enable Phone Auth and authorize the site domain in Firebase Console to sign in.
- [x] **Real-time chats and conversation list** — Implement real-time one-to-one messaging powered by Firebase. Show each conversation’s latest message and recent activity. Include sent and received message bubbles with timestamps. Messages and conversation summaries are written together in one Firestore batch.
- [x] **Discover users and start chats** — Support user discovery and new-chat creation based on registered phone numbers. Index writes are restricted to the phone number in the verified Firebase Auth claim; phone-index lookups are get-only.
- [x] **Editable user profile** — Let users edit their name, about text, and profile picture. Profile text is stored in Firestore and profile images use Firebase Storage.
- [x] **Lanchat branding and responsive interface** — Name the app Lanchat. Use a light-blue color scheme and a responsive WhatsApp-inspired chat interface.
- [x] **Firebase setup and integration handoff** — Provide the Firebase configuration path and setup instructions necessary to connect Firebase Authentication, Firestore, and Storage to the app. The supplied Firebase web app and Analytics settings are connected in the client; enable Firebase services and deploy the included rules/indexes for live operation.
