import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../core/session.dart';

const _archiveBrand = Color(0xFF0B6B5A);
const _archiveInk = Color(0xFF17322C);
const _archiveMuted = Color(0xFF70817B);
const _archiveSoft = Color(0xFFEAF4F0);

class AdminReportArchivePage extends StatefulWidget {
  const AdminReportArchivePage({super.key});

  @override
  State<AdminReportArchivePage> createState() => _AdminReportArchivePageState();
}

class _AdminReportArchivePageState extends State<AdminReportArchivePage> {
  HadirApi? _api;
  List<dynamic> _reports = const [];
  bool _loading = true;
  String? _error;
  String? _sharingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = await HadirSession().adminToken();
      if (token == null || token.isEmpty) throw Exception('انتهت جلسة الإدارة.');
      final api = HadirApi(token: token);
      final reports = await api.archivedReports(limit: 100);
      if (!mounted) return;
      setState(() {
        _api = api;
        _reports = reports;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = HadirApi.errorMessage(e);
      });
    }
  }

  Future<void> _share(Map<String, dynamic> report) async {
    final id = _value(report['report_id']);
    if (id == '—' || _api == null) return;
    setState(() => _sharingId = id);
    try {
      final bytes = await _api!.downloadArchivedReport(id);
      if (bytes.isEmpty) throw Exception('ملف التقرير المؤرشف فارغ.');
      final fileName = _value(report['file_name']) == '—' ? 'hadir-report' : _value(report['file_name']);
      final mimeType = _value(report['mime_type']) == '—' ? 'application/octet-stream' : _value(report['mime_type']);
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(bytes, name: fileName, mimeType: mimeType)],
        subject: 'تقرير HADIR المؤرشف',
        title: fileName,
      ));
    } catch (e) {
      if (mounted) setState(() => _error = HadirApi.errorMessage(e));
    } finally {
      if (mounted) setState(() => _sharingId = null);
    }
  }

  Future<void> _delete(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف النسخة المؤرشفة؟'),
        content: const Text('سيتم حذف ملف التقرير المؤرشف فقط، ولن تتغير سجلات الحضور الأصلية.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          FilledButton.tonal(onPressed: () => Navigator.pop(context, true), child: const Text('حذف')),
        ],
      ),
    );
    if (confirmed != true || _api == null) return;
    try {
      await _api!.deleteArchivedReport(id);
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = HadirApi.errorMessage(e));
    }
  }

  String _value(dynamic value) => value == null || '$value'.trim().isEmpty ? '—' : '$value';

  String _size(dynamic value) {
    final bytes = double.tryParse('$value');
    if (bytes == null || bytes <= 0) return '—';
    if (bytes < 1024) return '${bytes.toStringAsFixed(0)} B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('أرشيف التقارير', style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [_archiveBrand, Color(0xFF084F44)]),
                borderRadius: BorderRadius.circular(26),
                boxShadow: const [BoxShadow(blurRadius: 24, offset: Offset(0, 12), color: Color(0x220B6B5A))],
              ),
              child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [Icon(Icons.inventory_2_outlined, color: Colors.white), SizedBox(width: 9), Text('HADIR · REPORT VAULT', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.1))]),
                SizedBox(height: 14),
                Text('نسخ رسمية قابلة للتتبع', style: TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900)),
                SizedBox(height: 7),
                Text('عرض حالة الأرشيف، الفترة، الإصدار، الحجم والبصمة دون تعديل بيانات الحضور الأصلية.', style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.5)),
              ]),
            ),
            const SizedBox(height: 14),
            if (_error != null) Card(color: const Color(0xFFFFF3F1), child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [const Icon(Icons.error_outline_rounded, color: Color(0xFFB94A3D)), const SizedBox(width: 9), Expanded(child: Text(_error!, style: const TextStyle(color: Color(0xFF8D332C), fontSize: 12)))]))),
            if (_loading) ...const [SizedBox(height: 30), Center(child: CircularProgressIndicator()), SizedBox(height: 16)],
            if (!_loading && _reports.isEmpty) Card(child: Padding(padding: const EdgeInsets.symmetric(vertical: 42, horizontal: 18), child: Column(children: const [Icon(Icons.archive_outlined, size: 46, color: _archiveMuted), SizedBox(height: 12), Text('لا توجد نسخ مؤرشفة', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: _archiveInk)), SizedBox(height: 5), Text('أنشئ نسخة Excel أو CSV من شاشة التقارير لإضافتها إلى الأرشيف.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: _archiveMuted))]))),
            ..._reports.map((raw) => _archiveCard(Map<String, dynamic>.from(raw as Map))),
          ],
        ),
      ),
    );
  }

  Widget _archiveCard(Map<String, dynamic> report) {
    final id = _value(report['report_id']);
    final type = _value(report['report_type']);
    final status = _value(report['status']);
    final from = _value(report['period_from']);
    final to = _value(report['period_to']);
    final version = _value(report['report_version']);
    final hash = _value(report['data_snapshot_hash']);
    final fileName = _value(report['file_name']);
    final sharing = _sharingId == id;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 44, height: 44, decoration: BoxDecoration(color: _archiveSoft, borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.description_outlined, color: _archiveBrand)),
            const SizedBox(width: 11),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('$from → $to', style: const TextStyle(fontWeight: FontWeight.w900, color: _archiveInk)), const SizedBox(height: 3), Text(fileName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: _archiveMuted))])),
            PopupMenuButton<String>(onSelected: (action) { if (action == 'share') _share(report); if (action == 'delete' && id != '—') _delete(id); }, itemBuilder: (_) => const [PopupMenuItem(value: 'share', child: Text('تنزيل ومشاركة')), PopupMenuItem(value: 'delete', child: Text('حذف النسخة'))]),
          ]),
          const SizedBox(height: 13),
          Wrap(spacing: 7, runSpacing: 7, children: [
            _chip(Icons.category_outlined, type),
            _chip(Icons.verified_outlined, status),
            _chip(Icons.code_outlined, 'v$version'),
            _chip(Icons.data_usage_outlined, _size(report['file_size'])),
          ]),
          const SizedBox(height: 12),
          Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFF7F9F8), borderRadius: BorderRadius.circular(12)), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.fingerprint_rounded, size: 18, color: _archiveBrand), const SizedBox(width: 7), Expanded(child: Text(hash, style: const TextStyle(fontFamily: 'monospace', fontSize: 10, color: _archiveMuted)))])),
          const SizedBox(height: 9),
          Row(children: [const Icon(Icons.info_outline_rounded, size: 15, color: _archiveMuted), const SizedBox(width: 5), Expanded(child: Text('معرّف النسخة: $id', style: const TextStyle(fontSize: 10, color: _archiveMuted))), if (sharing) const SizedBox(width: 8, height: 8, child: CircularProgressIndicator(strokeWidth: 1.7)), TextButton(onPressed: sharing ? null : () => _showDetails(report), child: const Text('التفاصيل'))]),
        ]),
      ),
    );
  }

  Widget _chip(IconData icon, String label) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6), decoration: BoxDecoration(color: _archiveSoft, borderRadius: BorderRadius.circular(20)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 14, color: _archiveBrand), const SizedBox(width: 5), Text(label, style: const TextStyle(fontSize: 10, color: _archiveInk, fontWeight: FontWeight.w700))]));

  void _showDetails(Map<String, dynamic> report) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(18, 4, 18, 24), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('تفاصيل النسخة', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: _archiveInk)),
        const SizedBox(height: 15),
        _detail('الفترة', '${_value(report['period_from'])} → ${_value(report['period_to'])}'),
        _detail('النوع', _value(report['report_type'])),
        _detail('الحالة', _value(report['status'])),
        _detail('الإصدار', _value(report['report_version'])),
        _detail('الحجم', _size(report['file_size'])),
        _detail('تاريخ الإنشاء', _value(report['created_at'] ?? report['generated_at'])),
        _detail('البصمة', _value(report['data_snapshot_hash'])),
      ]))),
    );
  }

  Widget _detail(String label, String value) => Padding(padding: const EdgeInsets.only(bottom: 9), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [SizedBox(width: 95, child: Text(label, style: const TextStyle(fontSize: 11, color: _archiveMuted))), Expanded(child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _archiveInk)))]));
}
