import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'pages/create_username_page.dart';
import 'pages/dashboard_page.dart';
import 'pages/landing_page.dart';
import 'theme/dyne_theme.dart';
import 'widgets/dyne_loading.dart';

class DyneApp extends StatelessWidget {
  const DyneApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Dyne',
      debugShowCheckedModeBanner: false,
      theme: DyneTheme.dark,
      home: StreamBuilder<User?>(
        stream: FirebaseAuth.instance.authStateChanges(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Scaffold(
              body: DyneLoading(),
            );
          }
          if (snapshot.hasData) {
            return const _AuthenticatedRouter();
          }
          return const LandingPage();
        },
      ),
    );
  }
}

/// Routes authenticated users to either the username creation page
/// or the dashboard based on whether they have a username set.
class _AuthenticatedRouter extends StatelessWidget {
  const _AuthenticatedRouter();

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser!.uid;

    return StreamBuilder<DocumentSnapshot>(
      stream:
          FirebaseFirestore.instance.collection('users').doc(uid).snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: DyneLoading(),
          );
        }

        final data = snapshot.data?.data() as Map<String, dynamic>?;
        final username = data?['username'] as String?;

        if (username == null || username.isEmpty) {
          return const CreateUsernamePage();
        }

        return const DashboardPage();
      },
    );
  }
}
