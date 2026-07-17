import 'package:flutter/foundation.dart';

/// Centralized environment detection for the Dyne app.
/// Reports whether the app is running in development (debug) mode.
abstract class EnvConfig {
  /// True when the app is running via `flutter run` (debug mode).
  /// False when built with `flutter build web` (release mode).
  static bool get isDev => _overrideIsDev ?? kDebugMode;

  // Test-only override – private; accessible only via setOverride.
  static bool? _overrideIsDev;

  @visibleForTesting
  static void setOverride(bool? value) => _overrideIsDev = value;
}
