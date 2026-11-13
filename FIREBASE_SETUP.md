# Connect Lanchat to Firebase

Lanchat uses the Firebase JavaScript SDK directly in the browser: Firebase Authentication for phone verification, Cloud Firestore for profiles/chats/messages, and Firebase Storage for profile pictures. The app currently runs a labeled sample-data preview until all six Firebase web app settings are present. Firebase client configuration values are browser-visible by design; keep service-account keys and other server credentials out of this app.

## 1. Create a Firebase project and web app

1. In the [Firebase Console](https://console.firebase.google.com/), create or choose a project and register a Web app.
2. In **Project settings → General → Your apps**, copy the web app settings. From the app directory, copy `.env.example` to `.env.local` and fill in the six values below:

```dotenv
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Some newer Firebase projects use a `firebasestorage.app` storage bucket domain; use the exact `storageBucket` value shown in your Firebase project configuration. Restart the Vite dev server after changing `.env.local`. For a published frontend, provide the same `VITE_` values as public build-time variables in the hosting configuration.

## 2. Enable phone sign-in

In **Authentication → Sign-in method**, enable **Phone**. Add your development and production origins to **Authentication → Settings → Authorized domains**. Firebase phone sign-in uses an invisible reCAPTCHA challenge; on development builds, Firebase Console **Phone numbers for testing** can be configured to use test numbers and fixed test codes. Real SMS delivery is subject to Firebase/Google Cloud project settings, country policy, quotas, and applicable billing.

## 3. Create Firestore and Storage

Create a **Cloud Firestore** database and a **Storage** bucket in the same Firebase project. Deploy the included `firestore.rules`, `storage.rules`, and `firestore.indexes.json` using the Firebase CLI, or paste the rules into the respective Firebase Console rule editors. The chat-list composite index is required for the participant-filtered activity sort.

Install and authenticate the Firebase CLI if needed, then from this directory:

```sh
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,storage
```

If your Firebase CLI project does not yet have a `firebase.json`, add the configuration below before deploy (replace the bucket name with your actual Firebase Storage bucket):

```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "storage": { "rules": "storage.rules" }
}
```

The Firestore rules keep each user's phone number in an owner-only `users/{uid}` document. Lanchat exposes a minimal signed-in profile directory (`profiles/{uid}`) and a get-only phone index (`phoneIndex/{normalized E.164 number}`). Writes are restricted to the number in the signed-in Firebase Auth token's verified `phone_number` claim, preventing users from claiming another account's lookup entry. The exact-number index can still be probed by authenticated clients; it is not rate-limited. Before a public launch, enable App Check and consider a server-mediated, rate-limited contact-discovery endpoint.

## 4. Run the app

```sh
pnpm install
pnpm dev
```

With no Firebase settings, the interface explicitly labels itself as a sample preview. With the six settings present, it opens the phone-number sign-in flow. New accounts create their private user record, profile, and phone lookup index after successful Firebase phone verification. Users can then find an existing account using its exact E.164 number (for example `+14155550108`), open a real-time one-to-one conversation, and edit their name, about text, or profile photo.

## Data layout

- `users/{uid}` — owner-readable phone number and account metadata.
- `profiles/{uid}` — signed-in-readable name, about text, and profile photo URL.
- `phoneIndex/{normalized E.164 phone}` — exact phone lookup mapped to the account UID; index writes require a matching verified phone claim and collection listing is denied.
- `chats/{sortedUid1__sortedUid2}` — two participant UIDs, latest message summary, and activity timestamps.
- `chats/{chatId}/messages/{messageId}` — immutable message text, sender UID, and timestamp.
- `avatars/{uid}/{filename}` — per-user image objects in Firebase Storage.
