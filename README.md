# Lanchat

A responsive, light-blue messaging app inspired by familiar chat apps. Built with React, TypeScript, Vite, and Firebase Authentication and Cloud Firestore, with Cloudinary for profile-photo uploads.

## Quick start

1. Install dependencies: `pnpm install`
2. Start the app: `pnpm dev`
3. For Firebase email/password authentication and live chats, follow [Firebase setup](./FIREBASE_SETUP.md).

Lanchat remains wired to the existing Firebase web app `lanchat-ccf2a` and uses email/password authentication, without requiring SMS OTP or a paid-plan change. Enable the Email/Password provider, authorize your Preview/published domains, keep/create Firestore as already configured, configure a Cloudinary unsigned upload preset for profile photos, and deploy the included Firestore rules/index before using real accounts and messages. Users can save optional, fictional/test phone numbers as unverified profile information; a country-code number can be used for user discovery. Optional `VITE_FIREBASE_*` values in `.env.local` can override the Firebase web defaults.

## Main features

- Firebase email/password registration, sign-in, and password reset.
- Optional editable phone number in the user profile; fictional/test values do not trigger SMS or verification.
- Realtime one-to-one chat list and message updates.
- Exact country-code phone-number discovery for profiles that share a number.
- Editable name, about text, and Cloudinary-hosted profile picture.
- Responsive desktop/mobile conversation interface and local sample preview.

Set `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` in your hosting environment (for example, Vercel) to enable profile-photo uploads. Use an unsigned Cloudinary upload preset. The Firebase browser configuration is public app configuration, not a server secret. Never add a Firebase service-account key to the client. Phone-index writes for legacy phone-auth accounts remain bound to the verified Firebase phone claim; current email/password accounts use the optional profile number. Each message plus its conversation preview is committed atomically. The rules, schema, phone privacy notes, and deployment steps are documented in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).
