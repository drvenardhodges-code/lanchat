# Firebase setup for Lanchat

Lanchat remains connected to the existing Firebase web app `lanchat-ccf2a`. The current development sign-in uses Firebase Authentication email/password. Phone numbers are optional profile information only: users may enter fictional/test values, no phone verification happens, and the app does not send SMS. This flow does not require a paid billing account or a plan change; keep the project on Spark. Firebase Analytics is initialized when supported by the browser. Never put a Firebase service-account key in the client.

## Firebase web configuration

The project owner's public Firebase web settings are already the defaults in `src/lib/firebase.ts`. To point a development build at a different web app, copy `.env.example` to `.env.local` and set its public `VITE_FIREBASE_*` values. Restart Vite after changing the file. These web-app settings are browser-visible configuration, not privileged server credentials.

## Enable email/password authentication

In Firebase Console, open project `lanchat-ccf2a` and go to **Authentication → Sign-in method**. Enable **Email/Password** (not Email link). Add the development and published website domains under **Authentication → Settings → Authorized domains**. Account creation and sign-in use Firebase Auth; password reset calls Firebase's email reset flow. The app does not require Phone sign-in, reCAPTCHA, SMS delivery, or a billing-plan upgrade for account access.

For a development profile, the optional phone field accepts fictional/test numbers. It is stored as self-reported profile data and is not proof of ownership. Use a country-code format such as `+14155550108` if you want other signed-in users to find that profile by number. The number is visible to signed-in Lanchat users because profile-based lookup is available. No SMS is sent.

## Preserve Firestore and chats

Keep the existing Firestore data. Existing chats, messages, and profile documents are not deleted or rewritten. Lanchat continues to use the same Firestore UID-based chat model, realtime subscriptions, and atomic message/preview writes. New profile photos are uploaded directly to Cloudinary, and the returned secure image URL is saved in the user's Firestore profile.

Firebase Auth accounts are identified by UID. This change does not merge an old phone-only Auth user into a new email/password account or rewrite chat participants. When phone OTP is introduced, add/link the phone credential to the signed-in email account (or provide a verified migration) rather than silently creating a second identity. Existing phone-only Auth users need that future linking path to sign into the same UID-based conversations; their Firestore records remain intact in the meantime.

If the Firestore rules or composite index in this repository have not already been deployed, authenticate the Firebase CLI and deploy only those resources:

```sh
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

The rules keep each account's Auth phone claim in its owner-only `users/{uid}` record. Profile phone numbers are optional, capped at 32 characters, owner-editable, and visible only to signed-in users. Email/password profiles can be found by an exact normalized phone-number match. The legacy get-only `phoneIndex/{normalized E.164 phone}` remains for preexisting accounts authenticated with Firebase Phone Auth; new email/password profiles do not need a verified-phone claim to provide profile phone information.

Phone-number discovery is exact-match, not an address-book sync. Since a user can enter fictional/unverified profile data, it must not be treated as verified identity or for account recovery. Consider Firebase App Check and a server-mediated, rate-limited discovery endpoint before public launch.

## 24-hour Stories

Lanchat Stories use the existing Firestore database and the Cloudinary unsigned upload preset; Firebase Storage and a paid backend are not used. The app supports text-only stories and photo/video stories with an optional caption. Each story document stores its creation time and an expiry exactly 24 hours later. The app filters expired stories from the Stories bar and viewer, and only signed-in users can read stories. Users can delete their own stories sooner.

Photo and video uploads use the Cloudinary `auto/upload` endpoint. Make sure the unsigned preset configured in `VITE_CLOUDINARY_UPLOAD_PRESET` allows the image and video formats you want (for example JPG, PNG, WEBP, MP4, MOV, and WEBM). The app currently limits each story media file to 15 MB on the client. Cloudinary unsigned presets are public client-side upload credentials, so restrict allowed formats in the preset and monitor your Cloudinary usage. Do not put a Cloudinary API secret in Vercel's `VITE_*` variables.

Important: stories disappear from the Lanchat feed after 24 hours, but this free client-only implementation does not automatically purge old Firestore story documents or Cloudinary media files. Those old records are no longer displayed by the app; physical cleanup would require a separate cleanup workflow.

## Development/testing numbers and future OTP

The current app does not use Phone Auth. To prepare a future phone-OTP development flow without sending real SMS, Firebase Console supports Phone Auth test numbers with configured fictional numbers and fixed test codes. They can be used only after a future phone-auth UI and provider setup are added; they are not required for the current email/password sign-in. When real OTP is introduced, link phone credentials to the existing Firebase Auth user rather than creating a second UID, so existing chats and profiles remain associated with the same account.

## Run Lanchat

```sh
pnpm install
pnpm dev
```

After Email/Password is enabled, create an account with an email and password. During registration, name and password are required; phone is optional. Users can later edit name, about, profile picture, and phone in **Edit profile**. Profile-picture uploads require a Cloudinary cloud name and unsigned upload preset in the deployment environment; Firebase Storage is not used for new avatar uploads. If the Firebase configuration is absent, Lanchat uses the clearly labeled local sample preview.

## Data layout

- `users/{uid}` — owner-readable Auth phone claim and account metadata.
- `profiles/{uid}` — signed-in-readable name, about text, profile photo URL, and optional unverified phone profile field.
- `phoneIndex/{normalized E.164 phone}` — legacy lookup for verified Firebase Phone Auth users; writes still require a matching verified Auth phone claim.
- `chats/{sortedUid1__sortedUid2}` — two participant UIDs, latest message summary, and activity timestamps.
- `chats/{chatId}/messages/{messageId}` — immutable message text, sender UID, and timestamp.
- `stories/{storyId}` — signed-in-readable text/photo/video story metadata with a 24-hour expiry.
- Profile photo files — uploaded to Cloudinary using the unsigned preset configured by `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`; only the resulting image URL is stored in `profiles/{uid}`.
