# Firestore rules for protecting user and tutor verification documents

This repo does not include deployable `firestore.rules` or `storage.rules` files. Use this as the recommended production rule shape so users can manage their own basic data while Cloud Functions own verified qualification fields.

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

    function protectedTutorFieldsUnchanged() {
      return !request.resource.data.diff(resource.data).affectedKeys().hasAny([
        'qualifiedSubjects',
        'tutorProfile.verificationStatus'
      ]);
    }

    match /users/{userId} {
      allow read: if isSelf(userId);
      allow create: if isSelf(userId);
      allow update: if isSelf(userId)
        && protectedTutorFieldsUnchanged();
    }

    match /tutorDocuments/{docId} {
      allow read: if isSignedIn() && resource.data.uid == request.auth.uid;
      allow create: if isSignedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.status == 'UPLOADED'
        && request.resource.data.extractedText == ''
        && request.resource.data.extractedSubjects == []
        && request.resource.data.qualifiedSubjects == [];
      allow update, delete: if false;
    }

    match /system/subjects {
      allow read: if true;
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Recommended Storage rules for the new files:

```firestore
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isSignedIn() {
      return request.auth != null;
    }

    match /tutorSelfies/{userId}/{fileName} {
      allow read, write: if isSignedIn() && request.auth.uid == userId;
    }

    match /tutorDocuments/{userId}/{docId}/{fileName} {
      allow read, write: if isSignedIn() && request.auth.uid == userId;
    }
  }
}
```

Cloud Functions using the Admin SDK bypass Firestore and Storage security rules.
