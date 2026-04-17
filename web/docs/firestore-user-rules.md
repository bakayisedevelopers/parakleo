# Firestore rules for protecting user documents (development template)

Use this pattern so each signed-in user can only read/write their own `users/{uid}` document.

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isSelf(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Each user can only access their own profile document.
    match /users/{userId} {
      allow read, write: if isSelf(userId);
    }

    // Keep everything else locked by default and open explicitly as needed.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> Note: Cloud Functions using Admin SDK bypass Firestore security rules.
