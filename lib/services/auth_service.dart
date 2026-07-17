import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:google_sign_in/google_sign_in.dart';

/// Service that handles Google Sign-In and Firebase Authentication.
class AuthService {
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    clientId: kIsWeb
        ? '31669439721-a5kq8k5flekfvgopm06n6cd72vc0ig2s.apps.googleusercontent.com'
        : null,
  );

  /// Stream of auth state changes (signed in / signed out).
  Stream<User?> get authStateChanges => _firebaseAuth.authStateChanges();

  /// The currently signed-in user, or null.
  User? get currentUser => _firebaseAuth.currentUser;

  /// Sign in with Google. Returns the [UserCredential] on success,
  /// or null if the user cancelled the sign-in flow.
  Future<UserCredential?> signInWithGoogle() async {
    final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
    if (googleUser == null) return null; // User cancelled

    final GoogleSignInAuthentication googleAuth =
        await googleUser.authentication;

    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    return _firebaseAuth.signInWithCredential(credential);
  }

  /// Sign out of both Firebase and Google.
  Future<void> signOut() async {
    await _googleSignIn.signOut();
    await _firebaseAuth.signOut();
  }
}
