import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../theme/dyne_theme.dart';

class CreateTeamModal extends StatefulWidget {
  const CreateTeamModal({super.key, required this.leagueId});

  final String leagueId;

  @override
  State<CreateTeamModal> createState() => _CreateTeamModalState();
}

class _CreateTeamModalState extends State<CreateTeamModal> {
  final _nameController = TextEditingController();
  final _abbrevController = TextEditingController();
  Color _primaryColor = const Color(0xFF00E5FF);
  Color _secondaryColor = const Color(0xFF0B0E1A);
  int _selectedIconIndex = 0;
  bool _isSaving = false;

  static const _iconOptions = [
    Icons.sports_football,
    Icons.flash_on,
    Icons.whatshot,
    Icons.pets,
    Icons.shield,
    Icons.bolt,
    Icons.rocket_launch,
    Icons.star,
    Icons.diamond,
    Icons.tsunami,
    Icons.thunderstorm,
    Icons.local_fire_department,
  ];

  static const _colorOptions = [
    Color(0xFFFFFFFF),
    Color(0xFF000000),
    Color(0xFFFF2D55),
    Color(0xFF00E676),
    Color(0xFF2979FF),
    Color(0xFFFFD600),
    Color(0xFF7C4DFF),
    Color(0xFFFF8F00),
    Color(0xFF00E5FF),
    Color(0xFFEC407A),
    Color(0xFF26C6DA),
    Color(0xFFAB47BC),
    Color(0xFFFF5252),
    Color(0xFF69F0AE),
    Color(0xFF448AFF),
    Color(0xFFFFFF00),
    Color(0xFFE040FB),
    Color(0xFFFF6D00),
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _abbrevController.dispose();
    super.dispose();
  }

  Future<void> _saveTeam() async {
    final name = _nameController.text.trim();
    final abbrev = _abbrevController.text.trim().toUpperCase();

    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a team name.')),
      );
      return;
    }

    if (abbrev.isEmpty || abbrev.length > 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Abbreviation must be 1-4 characters.')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final uid = FirebaseAuth.instance.currentUser!.uid;

      await FirebaseFirestore.instance
          .collection('leagues')
          .doc(widget.leagueId)
          .collection('teams')
          .doc(uid)
          .set({
        'name': name,
        'abbreviation': abbrev,
        'primaryColor': _primaryColor.toARGB32(),
        'secondaryColor': _secondaryColor.toARGB32(),
        'iconIndex': _selectedIconIndex,
        'ownerId': uid,
        'createdAt': FieldValue.serverTimestamp(),
      });

      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create team: $e')),
        );
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        gradient: DyneTheme.landingGradient,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: colorScheme.onSurface.withValues(alpha: 0.2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Create Your Team',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Set up your identity for this league',
              style: TextStyle(
                fontSize: 13,
                color: colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(height: 24),

            // Team preview
            _buildPreview(colorScheme),
            const SizedBox(height: 24),

            // Team Name
            _buildLabel('Team Name', colorScheme),
            const SizedBox(height: 8),
            TextField(
              controller: _nameController,
              maxLength: 24,
              onChanged: (_) => setState(() {}),
              decoration: _inputDecoration('e.g. Thunder Hawks', colorScheme),
              style: TextStyle(color: colorScheme.onSurface),
            ),
            const SizedBox(height: 16),

            // Abbreviation
            _buildLabel('Abbreviation', colorScheme),
            const SizedBox(height: 8),
            TextField(
              controller: _abbrevController,
              maxLength: 4,
              textCapitalization: TextCapitalization.characters,
              onChanged: (_) => setState(() {}),
              decoration: _inputDecoration('e.g. THK', colorScheme),
              style: TextStyle(color: colorScheme.onSurface),
            ),
            const SizedBox(height: 16),

            // Logo Icon
            _buildLabel('Team Logo', colorScheme),
            const SizedBox(height: 10),
            _buildLogoPicker(colorScheme),
            const SizedBox(height: 20),

            // Primary Color
            _buildLabel('Primary Color', colorScheme),
            const SizedBox(height: 10),
            _buildColorPicker(isPrimary: true, colorScheme: colorScheme),
            const SizedBox(height: 16),

            // Secondary Color
            _buildLabel('Secondary Color', colorScheme),
            const SizedBox(height: 10),
            _buildColorPicker(isPrimary: false, colorScheme: colorScheme),
            const SizedBox(height: 28),

            // Save button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _saveTeam,
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text(
                        'Create Team',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700),
                      ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildPreview(ColorScheme colorScheme) {
    final name = _nameController.text.trim().isEmpty
        ? 'Your Team'
        : _nameController.text.trim();
    final abbrev = _abbrevController.text.trim().toUpperCase();

    return Center(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: _secondaryColor.withValues(alpha: 0.5),
          border: Border.all(color: _primaryColor.withValues(alpha: 0.5)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [_primaryColor, _primaryColor.withValues(alpha: 0.6)],
                ),
              ),
              child: Icon(
                _iconOptions[_selectedIconIndex],
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSurface,
                  ),
                ),
                if (abbrev.isNotEmpty)
                  Text(
                    abbrev,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.5,
                      color: _primaryColor,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogoPicker(ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Disabled upload button
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: const Color(0xFF141829),
            border: Border.all(
              color: colorScheme.primary.withValues(alpha: 0.1),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.upload_rounded,
                  size: 18,
                  color: colorScheme.onSurface.withValues(alpha: 0.25)),
              const SizedBox(width: 8),
              Text(
                'Upload Custom Logo — Coming Soon',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: colorScheme.onSurface.withValues(alpha: 0.25),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Choose an icon:',
          style: TextStyle(
            fontSize: 11,
            color: colorScheme.onSurface.withValues(alpha: 0.4),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: _iconOptions.asMap().entries.map((entry) {
            final index = entry.key;
            final icon = entry.value;
            final isSelected = _selectedIconIndex == index;

            return GestureDetector(
              onTap: () => setState(() => _selectedIconIndex = index),
              child: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: isSelected
                      ? _primaryColor.withValues(alpha: 0.2)
                      : const Color(0xFF141829),
                  border: Border.all(
                    color: isSelected
                        ? _primaryColor
                        : colorScheme.primary.withValues(alpha: 0.15),
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Icon(
                  icon,
                  size: 20,
                  color: isSelected
                      ? _primaryColor
                      : colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildColorPicker(
      {required bool isPrimary, required ColorScheme colorScheme}) {
    final selected = isPrimary ? _primaryColor : _secondaryColor;

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _colorOptions.map((color) {
        final isSelected = selected.toARGB32() == color.toARGB32();

        return GestureDetector(
          onTap: () => setState(() {
            if (isPrimary) {
              _primaryColor = color;
            } else {
              _secondaryColor = color;
            }
          }),
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color,
              border: Border.all(
                color: isSelected ? Colors.white : Colors.transparent,
                width: isSelected ? 3 : 0,
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: color.withValues(alpha: 0.5),
                        blurRadius: 8,
                      )
                    ]
                  : null,
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildLabel(String text, ColorScheme colorScheme) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: colorScheme.onSurface.withValues(alpha: 0.7),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint, ColorScheme colorScheme) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(
        color: colorScheme.onSurface.withValues(alpha: 0.3),
      ),
      filled: true,
      fillColor: const Color(0xFF141829),
      counterStyle: TextStyle(
        color: colorScheme.onSurface.withValues(alpha: 0.3),
      ),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
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
    );
  }
}
