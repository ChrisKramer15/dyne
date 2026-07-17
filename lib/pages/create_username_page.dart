import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../theme/dyne_theme.dart';

/// Page shown after first sign-in to force the user to create a username.
class CreateUsernamePage extends StatefulWidget {
  const CreateUsernamePage({super.key});

  @override
  State<CreateUsernamePage> createState() => _CreateUsernamePageState();
}

class _CreateUsernamePageState extends State<CreateUsernamePage> {
  final _controller = TextEditingController();
  bool _isChecking = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _controller.text.trim().toLowerCase();

    if (username.isEmpty) {
      setState(() => _error = 'Username cannot be empty.');
      return;
    }

    if (username.length < 3) {
      setState(() => _error = 'Username must be at least 3 characters.');
      return;
    }

    if (username.length > 20) {
      setState(() => _error = 'Username must be 20 characters or less.');
      return;
    }

    if (!RegExp(r'^[a-z0-9_]+$').hasMatch(username)) {
      setState(
          () => _error = 'Only lowercase letters, numbers, and underscores.');
      return;
    }

    setState(() {
      _isChecking = true;
      _error = null;
    });

    try {
      final firestore = FirebaseFirestore.instance;

      // Check if username is already taken
      final existing = await firestore
          .collection('usernames')
          .doc(username)
          .get();

      if (existing.exists) {
        setState(() {
          _error = 'Username "$username" is already taken.';
          _isChecking = false;
        });
        return;
      }

      final user = FirebaseAuth.instance.currentUser!;

      // Reserve the username
      await firestore.collection('usernames').doc(username).set({
        'uid': user.uid,
        'createdAt': FieldValue.serverTimestamp(),
      });

      // Update the user profile
      await firestore.collection('users').doc(user.uid).set({
        'username': username,
        'displayName': user.displayName ?? username,
        'email': user.email?.toLowerCase() ?? '',
        'photoURL': user.photoURL ?? '',
        'lastSeen': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      setState(() {
        _error = 'Something went wrong. Try again.';
        _isChecking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: DyneTheme.landingGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.person_outline,
                    size: 56,
                    color: colorScheme.primary,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Choose a Username',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'This is how other players will find you.',
                    style: TextStyle(
                      fontSize: 14,
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 32),
                  TextField(
                    controller: _controller,
                    autofocus: true,
                    maxLength: 20,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submit(),
                    decoration: InputDecoration(
                      hintText: 'e.g. gridiron_king',
                      hintStyle: TextStyle(
                        color: colorScheme.onSurface.withValues(alpha: 0.3),
                      ),
                      filled: true,
                      fillColor: const Color(0xFF141829),
                      prefixIcon: Icon(Icons.alternate_email,
                          color: colorScheme.primary),
                      prefixText: '@',
                      prefixStyle: TextStyle(
                        color: colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: colorScheme.primary.withValues(alpha: 0.3),
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: colorScheme.primary),
                      ),
                      errorText: _error,
                    ),
                    style: TextStyle(
                      color: colorScheme.onSurface,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Lowercase letters, numbers, and underscores only.',
                    style: TextStyle(
                      fontSize: 12,
                      color: colorScheme.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _isChecking ? null : _submit,
                      child: _isChecking
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text(
                              'Continue',
                              style: TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.w600),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
