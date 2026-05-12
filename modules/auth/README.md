# Auth Module

This module provides a generic authentication interface that can be used with any authentication provider. It is designed to be a drop-in replacement for the Firebase authentication service.

## Usage

To use the auth module, you first need to configure it with your authentication provider. This is done by creating an `auth` object that implements the following methods:

- `createUserWithEmailAndPassword(email, password)`
- `signInWithEmailAndPassword(email, password)`
- `signOut()`
- `sendPasswordResetEmail(email)`
- `updateProfile(user, profile)`

Once you have configured the `auth` object, you can use the following functions to interact with the authentication service:

- `registerUser(email, password, name, phone, role)`
- `loginUser(email, password)`
- `logoutUser()`
- `resetPassword(email)`
- `getUserData(userId)`