import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config.dart';
import '../services/auth_service.dart';
import '../services/org_service.dart';
import '../state/auth_state.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _twofaController = TextEditingController();

  bool _twofaRequired = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    _twofaController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });

    final auth = context.read<AuthState>();
    try {
      final orgs = await auth.login(
        phone: _phoneController.text.trim(),
        password: _passwordController.text,
        twofaCode: _twofaRequired ? _twofaController.text.trim() : null,
      );
      final organizationId = await _resolveOrganization(orgs);
      if (organizationId == null) return;
      await auth.completeLogin(organizationId);
    } on TwoFaRequiredException {
      setState(() {
        _twofaRequired = true;
        _error = 'Ikki bosqichli tasdiqlash kodini kiriting';
      });
    } on DioException catch (e) {
      setState(() => _error = _messageFor(e));
    } catch (_) {
      setState(() => _error = 'Kutilmagan xatolik yuz berdi');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<String?> _resolveOrganization(List<Organization> orgs) async {
    if (orgs.isEmpty) {
      setState(() => _error =
          'Sizga biriktirilgan tashkilot topilmadi — administratorga murojaat qiling');
      return null;
    }
    if (orgs.length == 1) return orgs.first.id;

    final defaults = orgs.where((o) => o.isDefault).toList();
    if (defaults.length == 1) return defaults.first.id;

    if (!mounted) return null;
    return _pickOrganization(orgs);
  }

  Future<String?> _pickOrganization(List<Organization> orgs) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Tashkilotni tanlang',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            for (final org in orgs)
              ListTile(
                leading: const Icon(Icons.apartment_outlined),
                title: Text(org.name),
                subtitle: Text(org.code),
                onTap: () => Navigator.of(ctx).pop(org.id),
              ),
          ],
        ),
      ),
    );
  }

  String _messageFor(DioException e) {
    final data = e.response?.data;
    final detail = data is Map ? data['detail'] : null;
    if (detail is String && detail.isNotEmpty) return detail;
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return 'Server javob bermadi — internet aloqasini tekshiring';
    }
    if (e.response == null) return 'Tarmoq xatosi — internet aloqasini tekshiring';
    return 'Xatolik yuz berdi (${e.response?.statusCode})';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.storefront_outlined, size: 56),
                  const SizedBox(height: 12),
                  Text(
                    AppConfig.appName,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 32),
                  TextFormField(
                    controller: _phoneController,
                    enabled: !_submitting,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Telefon raqam',
                      hintText: '+998901234567',
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Telefon raqamni kiriting' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    enabled: !_submitting,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Parol'),
                    validator: (v) =>
                        (v == null || v.length < 6) ? "Parol kamida 6 belgi bo'lishi kerak" : null,
                  ),
                  if (_twofaRequired) ...[
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _twofaController,
                      enabled: !_submitting,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: '2FA kod'),
                      validator: (v) =>
                          (v == null || v.trim().isEmpty) ? '2FA kodni kiriting' : null,
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Kirish'),
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
