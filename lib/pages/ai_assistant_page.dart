import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/hadir_brand.dart';
import '../core/local_ai.dart';
import '../core/session.dart';

class AIAssistantPage extends StatefulWidget {
  const AIAssistantPage({super.key});
  @override
  State<AIAssistantPage> createState() => _AIAssistantPageState();
}

class _Message {
  const _Message({required this.user, required this.text, this.provider});
  final bool user;
  final String text;
  final String? provider;
}

class _AIAssistantPageState extends State<AIAssistantPage> {
  final _session = HadirSession();
  final _question = TextEditingController();
  final _scroll = ScrollController();
  final List<_Message> _messages = [];
  bool _busy = false;
  bool _manager = false;
  bool _contextLoading = true;
  String _provider = 'جاهز';
  Map<String, dynamic>? _employee;
  Map<String, dynamic> _managerData = {};
  List<dynamic> _attendance = [];

  static const _employeeExamples = <String>[...HadirLocalAi.employeeExamples, 'ما الخدمات المتاحة لي؟'];
  static const _managerExamples = <String>[...HadirLocalAi.managerExamples, 'ما الخدمات المتاحة لي؟'];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final adminToken = await _session.adminToken();
      final isManager = adminToken != null && adminToken.isNotEmpty;
      if (isManager) {
        final data = await HadirApi(token: adminToken).workforceLive();
        if (!mounted) return;
        setState(() {
          _manager = true;
          _managerData = data;
          _contextLoading = false;
          _messages
            ..clear()
            ..add(const _Message(user: false, text: 'مرحبًا. أنا Hadir AI، مساعدك الذكي لتحليل الحضور والغياب والهروب والإحصاءات ضمن صلاحيات الإدارة.'));
        });
      } else {
        final token = await _session.token();
        if (token != null && token.isNotEmpty) {
          final api = HadirApi(token: token);
          final results = await Future.wait<dynamic>([api.employeeProfile(), api.attendance(limit: 2000)]);
          if (!mounted) return;
          setState(() {
            _employee = results[0] is Map ? Map<String, dynamic>.from(results[0] as Map) : null;
            _attendance = results[1] is List ? List<dynamic>.from(results[1] as List) : [];
            _contextLoading = false;
            _messages
              ..clear()
              ..add(_Message(user: false, text: 'مرحبًا ${_employee?['name'] ?? ''}. أنا Hadir AI، مساعدك الذكي لبيانات حضورك والخدمات المتاحة لك.'));
          });
        } else if (mounted) {
          setState(() {
            _contextLoading = false;
            _messages.add(const _Message(user: false, text: 'مرحبًا. سجّل الدخول أولًا حتى أتمكن من استخدام بيانات حاضر المسموح بها.'));
          });
        }
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _contextLoading = false;
        _messages
          ..clear()
          ..add(const _Message(user: false, text: 'مرحبًا. Hadir AI جاهز. إذا تعذر تحميل البيانات الآن، سأستخدم الوضع المحلي عند توفر البيانات.'));
      });
    }
  }

  @override
  void dispose() {
    _question.dispose();
    _scroll.dispose();
    super.dispose();
  }

  List<String> get _examples => _manager ? _managerExamples : _employeeExamples;

  Future<void> _ask([String? preset]) async {
    final text = (preset ?? _question.text).trim();
    if (text.isEmpty || _busy) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _question.clear();
      _busy = true;
      _messages.add(_Message(user: true, text: text));
    });
    _jumpToEnd();
    try {
      final token = _manager ? await _session.adminToken() : await _session.token();
      if (token == null || token.isEmpty) throw Exception('missing token');
      final response = await HadirApi(token: token).dio.post('/api/ai', data: {'question': text});
      final raw = response.data;
      final data = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
      final answer = '${data['text'] ?? ''}'.trim();
      if (response.statusCode != 200 || data['ok'] != true || answer.isEmpty) throw Exception('${data['error'] ?? 'تعذر تشغيل النموذج'}');
      final provider = '${data['provider'] ?? 'cloudflare-workers-ai'}';
      if (!mounted) return;
      setState(() {
        _provider = _providerLabel(provider);
        _messages.add(_Message(user: false, text: answer, provider: provider));
      });
    } catch (_) {
      if (!mounted) return;
      final fallback = _manager
          ? HadirLocalAi.manager(text, _asList(_managerData['employees']), _asList(_managerData['attendance']), _asList(_managerData['escapes']))
          : HadirLocalAi.employee(text, _employee, _attendance);
      setState(() {
        _provider = 'محلي';
        _messages.add(_Message(user: false, text: fallback, provider: 'local'));
      });
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        _jumpToEnd();
      }
    }
  }

  List<dynamic> _asList(dynamic value) => value is List ? List<dynamic>.from(value) : const <dynamic>[];

  String _providerLabel(String value) {
    if (value == 'google-gemini') return 'Gemini';
    if (value == 'cloudflare-workers-ai') return 'Workers AI';
    if (value == 'hadir-data') return 'Hadir Data';
    if (value == 'local') return 'محلي';
    return value;
  }

  void _jumpToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: scheme.surface,
        appBar: AppBar(
          leading: IconButton(onPressed: () => Navigator.maybePop(context), icon: const Icon(Icons.arrow_forward_rounded)),
          titleSpacing: 0,
          title: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: HadirBrand.darkPrimary,
                  borderRadius: BorderRadius.circular(15),
                  boxShadow: [BoxShadow(color: HadirBrand.darkPrimary.withValues(alpha: .18), blurRadius: 16, offset: const Offset(0, 7))],
                ),
                child: const Center(child: Text('AI', style: TextStyle(color: HadirBrand.darkPrimaryForeground, fontWeight: FontWeight.w900))),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [const Text('Hadir AI', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)), const SizedBox(width: 7), _pill(_provider)]),
                    Text(_manager ? 'مساعد المدير' : 'مساعد الموظف', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11)),
                  ],
                ),
              ),
            ],
          ),
        ),
        body: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 760;
            return Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (wide) SizedBox(width: 280, child: _sidePanel()),
                Expanded(child: Padding(padding: const EdgeInsets.fromLTRB(12, 4, 12, 10), child: _chatPanel())),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _pill(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: HadirBrand.darkPrimary.withValues(alpha: .10), borderRadius: BorderRadius.circular(30)),
      child: Text(text, style: const TextStyle(color: HadirBrand.darkPrimary, fontSize: 9, fontWeight: FontWeight.w800)),
    );
  }

  Widget _sidePanel() {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 0, 10),
      child: Card(
        margin: EdgeInsets.zero,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('المساعد الشخصي', style: TextStyle(color: HadirBrand.darkPrimary, fontSize: 11, fontWeight: FontWeight.w800)),
            const SizedBox(height: 5),
            Text(_manager ? 'لوحة المدير' : 'مساعدك', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 5),
            Text(_manager ? 'تحليل بيانات الموظفين ضمن الصلاحيات الممنوحة لك.' : 'معلومات حضورك وخدماتك دون كشف بيانات الآخرين.', style: TextStyle(color: scheme.onSurfaceVariant, height: 1.6, fontSize: 11)),
            const SizedBox(height: 18),
            ..._examples.map(_exampleButton),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: scheme.surfaceContainerHighest.withValues(alpha: .65), borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  Icon(_contextLoading ? Icons.sync_rounded : Icons.check_circle_outline_rounded, size: 17, color: HadirBrand.darkPrimary),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_contextLoading ? 'جارٍ تحميل سياق الحساب…' : 'بيانات الحساب متاحة للمساعد حسب الصلاحيات.', style: TextStyle(fontSize: 10, color: scheme.onSurfaceVariant))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _exampleButton(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: OutlinedButton(
        onPressed: _busy ? null : () => _ask(text),
        style: OutlinedButton.styleFrom(alignment: Alignment.centerRight, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
        child: Text(text, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _chatPanel() {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_manager ? 'مساعد المدير' : 'مساعد الموظف', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                      const SizedBox(height: 3),
                      Text('اسأل بلغة طبيعية، وسأستخدم بيانات حاضر المسموح بها.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10)),
                    ],
                  ),
                ),
                Row(children: [Container(width: 7, height: 7, decoration: BoxDecoration(color: _provider == 'محلي' ? HadirBrand.darkWarning : HadirBrand.darkPrimary, shape: BoxShape.circle)), const SizedBox(width: 6), Text(_provider, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 9, fontWeight: FontWeight.w700))]),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(child: _messages.length <= 1 ? _emptyChat() : ListView.builder(controller: _scroll, padding: const EdgeInsets.fromLTRB(14, 18, 14, 14), itemCount: _messages.length, itemBuilder: (_, i) => _bubble(_messages[i]))),
          if (_busy) Padding(padding: const EdgeInsets.only(bottom: 7, right: 18), child: Align(alignment: Alignment.centerRight, child: Text('Hadir AI يفكر…', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 10)))),
          _composer(),
        ],
      ),
    );
  }

  Widget _emptyChat() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 18),
      children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(color: HadirBrand.darkPrimary.withValues(alpha: .035), borderRadius: BorderRadius.circular(26), border: Border.all(color: HadirBrand.darkPrimary.withValues(alpha: .10))),
          child: Column(
            children: [
              Container(width: 56, height: 56, decoration: BoxDecoration(color: HadirBrand.darkPrimary.withValues(alpha: .10), borderRadius: BorderRadius.circular(17)), child: const Icon(Icons.auto_awesome_rounded, color: HadirBrand.darkPrimary)),
              const SizedBox(height: 14),
              const Text('كيف يمكنني مساعدتك؟', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
              const SizedBox(height: 7),
              const Text('تحدث معي بشكل طبيعي عن الحضور والغياب والهروب والإحصاءات والخدمات المتاحة لك.', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, height: 1.6)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        for (final text in _examples.take(3))
          Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: OutlinedButton.icon(
              onPressed: _busy ? null : () => _ask(text),
              icon: const Icon(Icons.arrow_back_rounded, size: 17),
              label: Text(text),
              style: OutlinedButton.styleFrom(alignment: Alignment.centerRight, padding: const EdgeInsets.all(14)),
            ),
          ),
      ],
    );
  }

  Widget _bubble(_Message message) {
    final scheme = Theme.of(context).colorScheme;
    return Align(
      alignment: message.user ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 560),
        margin: const EdgeInsets.only(bottom: 11),
        padding: const EdgeInsets.fromLTRB(15, 12, 15, 13),
        decoration: BoxDecoration(
          color: message.user ? HadirBrand.darkPrimary : scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(22),
            topRight: const Radius.circular(22),
            bottomLeft: Radius.circular(message.user ? 6 : 22),
            bottomRight: Radius.circular(message.user ? 22 : 6),
          ),
          border: message.user ? null : Border.all(color: scheme.outline.withValues(alpha: .72)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message.user ? 'أنت' : 'Hadir AI${message.provider == null ? '' : ' · ${_providerLabel(message.provider!)}'}', style: TextStyle(color: message.user ? HadirBrand.darkPrimaryForeground.withValues(alpha: .72) : scheme.onSurfaceVariant, fontSize: 9, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(message.text, style: TextStyle(color: message.user ? HadirBrand.darkPrimaryForeground : scheme.onSurface, height: 1.65, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Widget _composer() {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 7, 10, 11),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: TextField(controller: _question, minLines: 1, maxLines: 4, textInputAction: TextInputAction.newline, onSubmitted: (_) => _ask(), decoration: const InputDecoration(hintText: 'اكتب سؤالك هنا…'))),
            const SizedBox(width: 8),
            SizedBox(width: 48, height: 48, child: FilledButton(onPressed: _busy ? null : () => _ask(), style: FilledButton.styleFrom(padding: EdgeInsets.zero), child: const Icon(Icons.arrow_upward_rounded))),
          ],
        ),
      ),
    );
  }
}
