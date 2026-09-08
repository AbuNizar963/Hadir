import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/session.dart';

const _brand = Color(0xFF0B6B5A);
const _canvas = Color(0xFFF5F8F7);
const _ink = Color(0xFF142D27);
const _muted = Color(0xFF73827E);
const _line = Color(0xFFDCE6E2);

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
  final _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 20),
    sendTimeout: const Duration(seconds: 15),
  ));
  final _session = HadirSession();
  final _question = TextEditingController();
  final _scroll = ScrollController();
  final List<_Message> _messages = [];
  bool _busy = false;
  bool _manager = false;
  String _provider = 'جاهز';

  static const _employeeExamples = [
    'ما هي حالة حضوري اليوم؟',
    'ما الخدمات المتاحة لي؟',
    'متى كان آخر حضور لي؟',
    'كيف أستخدم تسجيل الحضور؟',
    'هل أستطيع رؤية سجل حضوري؟',
  ];
  static const _managerExamples = [
    'ما حالة الحضور اليوم؟',
    'أعطني ملخص الغياب والتأخير.',
    'ما الخدمات المتاحة لي؟',
    'كيف أراجع سجلات الموظفين؟',
    'أعطني ملخصًا عن القوى العاملة.',
  ];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final admin = await _session.adminToken();
    if (!mounted) return;
    setState(() {
      _manager = admin != null;
      _messages.add(_Message(
        user: false,
        text: admin != null
            ? 'مرحبًا. أنا Hadir AI، مساعدك الذكي لتحليل الحضور والغياب والإحصاءات ضمن صلاحيات الإدارة.'
            : 'مرحبًا. أنا Hadir AI، مساعدك الذكي لبيانات حضورك والخدمات المتاحة لك.',
      ));
    });
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
      final response = await _dio.post(
        'https://hadir-api.abunizar963.workers.dev/api/ai',
        data: {'question': text},
        options: Options(
          headers: token == null
              ? <String, dynamic>{}
              : {'Authorization': 'Bearer $token'},
        ),
      );
      final data = Map<String, dynamic>.from(response.data as Map);
      if (data['ok'] != true && data['text'] == null) {
        throw Exception('AI request failed');
      }
      final provider = '${data['provider'] ?? 'cloudflare-workers-ai'}';
      if (!mounted) return;
      setState(() {
        _provider = _providerLabel(provider);
        _messages.add(_Message(
          user: false,
          text: '${data['text'] ?? 'تعذر الحصول على إجابة.'}',
          provider: provider,
        ));
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _provider = 'محلي';
        _messages.add(
          _Message(user: false, text: _localFallback(text), provider: 'local'),
        );
      });
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        _jumpToEnd();
      }
    }
  }

  String _providerLabel(String value) {
    if (value == 'google-gemini') return 'Gemini';
    if (value == 'cloudflare-workers-ai') return 'Workers AI';
    if (value == 'local') return 'محلي';
    return value;
  }

  String _localFallback(String question) {
    final q = question.toLowerCase();
    if (q.contains('خدمات') || q.contains('الخدمات')) {
      return 'يمكنك من حاضر الوصول إلى الحضور، السجل، الطلبات، الإشعارات، الملف الشخصي، الطقس، مواقيت الصلاة والقبلة، إضافة إلى Hadir AI.';
    }
    if (q.contains('حضور') || q.contains('غياب')) {
      return _manager
          ? 'تعذر الاتصال بخدمة الذكاء الاصطناعي. يمكنك فتح لوحة الإدارة لمراجعة الحضور والغياب والتأخير مباشرة.'
          : 'تعذر الاتصال بخدمة الذكاء الاصطناعي. يمكنك فتح مركز الموظف أو سجل الحضور لمراجعة بياناتك مباشرة.';
    }
    return 'تعذر الاتصال بالمساعد الآن. حاول مرة أخرى بعد لحظات، أو استخدم إحدى الأسئلة المقترحة.';
  }

  void _jumpToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: _canvas,
        appBar: AppBar(
          backgroundColor: _canvas,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            onPressed: () => Navigator.maybePop(context),
            icon: const Icon(Icons.arrow_forward_rounded),
          ),
          titleSpacing: 0,
          title: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: _brand,
                  borderRadius: BorderRadius.circular(15),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x220B6B5A),
                      blurRadius: 16,
                      offset: Offset(0, 7),
                    ),
                  ],
                ),
                child: const Center(
                  child: Text(
                    'AI',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text(
                          'Hadir AI',
                          style: TextStyle(
                            color: _ink,
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(width: 7),
                        _pill(_provider),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _manager ? 'مساعد المدير' : 'مساعد الموظف',
                      style: const TextStyle(color: _muted, fontSize: 11),
                    ),
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
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(12, 4, 12, 10),
                    child: _chatPanel(),
                  ),
                ),
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
      decoration: BoxDecoration(
        color: _brand.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: _brand,
          fontSize: 9,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _sidePanel() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 0, 10),
      child: Card(
        margin: EdgeInsets.zero,
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(26),
          side: const BorderSide(color: _line),
        ),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'المساعد الشخصي',
              style: TextStyle(color: _brand, fontSize: 11, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 5),
            Text(
              _manager ? 'لوحة المدير' : 'مساعدك',
              style: const TextStyle(color: _ink, fontSize: 20, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 5),
            Text(
              _manager
                  ? 'تحليل بيانات الموظفين ضمن الصلاحيات الممنوحة لك.'
                  : 'معلومات حضورك وخدماتك دون كشف بيانات الآخرين.',
              style: const TextStyle(color: _muted, height: 1.6, fontSize: 11),
            ),
            const SizedBox(height: 18),
            ..._examples.map(
              (x) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: OutlinedButton(
                  onPressed: _busy ? null : () => _ask(x),
                  style: OutlinedButton.styleFrom(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    side: const BorderSide(color: _line),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: Text(
                    x,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _ink),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chatPanel() {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
        side: const BorderSide(color: _line),
      ),
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
                      Text(
                        _manager ? 'مساعد المدير' : 'مساعد الموظف',
                        style: const TextStyle(color: _ink, fontWeight: FontWeight.w900, fontSize: 14),
                      ),
                      const SizedBox(height: 3),
                      const Text(
                        'اسأل بلغة طبيعية، وسأستخدم بيانات حاضر المسموح بها.',
                        style: TextStyle(color: _muted, fontSize: 10),
                      ),
                    ],
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: _provider == 'محلي' ? Colors.orange : Colors.green,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _provider,
                      style: const TextStyle(color: _muted, fontSize: 9, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: _line),
          Expanded(
            child: _messages.length <= 1
                ? _emptyChat()
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(14, 18, 14, 14),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) => _bubble(_messages[i]),
                  ),
          ),
          if (_busy)
            const Padding(
              padding: EdgeInsets.only(bottom: 7),
              child: Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 18),
                  child: Text('Hadir AI يفكر…', style: TextStyle(color: _muted, fontSize: 10)),
                ),
              ),
            ),
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
          decoration: BoxDecoration(
            color: _brand.withValues(alpha: .035),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: _brand.withValues(alpha: .10)),
          ),
          child: Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: _brand.withValues(alpha: .10),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: const Icon(Icons.auto_awesome_rounded, color: _brand),
              ),
              const SizedBox(height: 14),
              const Text(
                'كيف يمكنني مساعدتك؟',
                style: TextStyle(color: _ink, fontSize: 21, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 7),
              const Text(
                'تحدث معي بشكل طبيعي عن الحضور والغياب والإحصاءات والخدمات المتاحة لك.',
                textAlign: TextAlign.center,
                style: TextStyle(color: _muted, fontSize: 11, height: 1.6),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        ..._examples.take(2).map(
          (x) => Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: OutlinedButton.icon(
              onPressed: _busy ? null : () => _ask(x),
              icon: const Icon(Icons.arrow_back_rounded, size: 17),
              label: Text(x),
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerRight,
                padding: const EdgeInsets.all(14),
                side: const BorderSide(color: _line),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _bubble(_Message message) {
    return Align(
      alignment: message.user ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 560),
        margin: const EdgeInsets.only(bottom: 11),
        padding: const EdgeInsets.fromLTRB(15, 12, 15, 13),
        decoration: BoxDecoration(
          color: message.user ? _brand : const Color(0xFFF0F4F2),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(22),
            topRight: const Radius.circular(22),
            bottomLeft: Radius.circular(message.user ? 6 : 22),
            bottomRight: Radius.circular(message.user ? 22 : 6),
          ),
          border: message.user ? null : Border.all(color: _line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.user
                  ? 'أنت'
                  : 'Hadir AI${message.provider == null ? '' : ' · ${_providerLabel(message.provider!)}'}',
              style: TextStyle(
                color: message.user ? Colors.white70 : _muted,
                fontSize: 9,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              message.text,
              style: TextStyle(
                color: message.user ? Colors.white : _ink,
                height: 1.65,
                fontSize: 13,
              ),
            ),
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
            Expanded(
              child: TextField(
                controller: _question,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.newline,
                onSubmitted: (_) => _ask(),
                decoration: InputDecoration(
                  hintText: 'اكتب سؤالك هنا…',
                  hintStyle: const TextStyle(color: _muted, fontSize: 11),
                  filled: true,
                  fillColor: _canvas,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: const BorderSide(color: _line),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: const BorderSide(color: _line),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: const BorderSide(color: _brand),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 48,
              height: 48,
              child: FilledButton(
                onPressed: _busy ? null : () => _ask(),
                style: FilledButton.styleFrom(
                  backgroundColor: _brand,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
                  padding: EdgeInsets.zero,
                ),
                child: const Icon(Icons.arrow_upward_rounded),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
