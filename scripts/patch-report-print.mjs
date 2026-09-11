import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');

let pub = read('pubspec.yaml');
if (!pub.includes('  pdf:')) pub = pub.replace('  dio: ^5.9.0\n', '  dio: ^5.9.0\n  pdf: ^3.11.3\n');
if (!pub.includes('  printing:')) pub = pub.replace('  qr_flutter: ^4.1.0\n', '  qr_flutter: ^4.1.0\n  printing: ^5.14.3\n');
write('pubspec.yaml', pub);

let report = read('lib/features/administration/pages/admin_reports_implementation.dart');
if (!report.includes("package:pdf/widgets.dart")) report = report.replace("import 'package:flutter/material.dart';\n", "import 'package:flutter/material.dart';\nimport 'package:pdf/pdf.dart';\nimport 'package:pdf/widgets.dart' as pw;\nimport 'package:printing/printing.dart';\n");
if (!report.includes('Future<void> _printReport() async')) {
  const anchor = '  Future<void> _exportExcel() async {';
  const method = `  Future<void> _printReport() async {
    final rows = _filteredRows();
    if (rows.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final regular = await PdfGoogleFonts.notoSansArabicRegular();
      final bold = await PdfGoogleFonts.notoSansArabicBold();
      final pdf = pw.Document();
      final summary = _report?['summary'] is Map ? Map<String, dynamic>.from(_report!['summary'] as Map) : <String, dynamic>{};
      final analytics = _report?['analytics'] is Map ? Map<String, dynamic>.from(_report!['analytics'] as Map) : <String, dynamic>{};
      final exceptions = analytics['exceptions'] is List ? (analytics['exceptions'] as List).length : 0;
      final data = rows.map((r) => <String>[
        '\${r['attendanceDay'] ?? '—'}', '\${r['employeeName'] ?? '—'}', '\${r['jobNumber'] ?? '—'}', _status('\${r['status'] ?? ''}'),
        _clock(r['checkInAt']), _clock(r['checkOutAt']), _fmtMinutes(r['workedMinutes']), '\${r['lateMinutes'] ?? 0}', '\${r['earlyLeaveMinutes'] ?? 0}', '\${r['overtimeMinutes'] ?? 0}',
      ]).toList();
      pdf.addPage(pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.all(24),
        textDirection: pw.TextDirection.rtl,
        header: (_) => pw.Container(padding: const pw.EdgeInsets.only(bottom: 10), decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey700, width: 1.2))), child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [pw.Text('HADIR / حاضر', style: pw.TextStyle(font: bold, fontSize: 18, color: PdfColor.fromInt(0xFF0B6B5A))), pw.Text('تقرير الحضور', style: pw.TextStyle(font: bold, fontSize: 17))])),
        footer: (c) => pw.Center(child: pw.Text('صفحة \${c.pageNumber} من \${c.pagesCount}', style: pw.TextStyle(font: regular, fontSize: 8, color: PdfColors.grey600))),
        build: (c) => [
          pw.Text('الفترة: \${_date(_from)} → \${_date(_to)}', style: pw.TextStyle(font: bold, fontSize: 11)),
          pw.SizedBox(height: 10),
          pw.Row(children: [_pdfMetric('الموظفون', '\${_num(summary, 'employees')}', regular, bold), _pdfMetric('الحضور', '\${_num(summary, 'present') + _num(summary, 'late')}', regular, bold), _pdfMetric('الساعات', _fmtMinutes(summary['workedMinutes']), regular, bold), _pdfMetric('الاستثناءات', '$exceptions', regular, bold)]),
          pw.SizedBox(height: 14),
          pw.Text('السجل اليومي الرسمي', style: pw.TextStyle(font: bold, fontSize: 14)),
          pw.SizedBox(height: 6),
          pw.TableHelper.fromTextArray(data: data, headers: const ['التاريخ','الموظف','الرقم الوظيفي','الحالة','الحضور','الانصراف','الساعات','التأخر','المغادرة المبكرة','الإضافي'], headerStyle: pw.TextStyle(font: bold, fontSize: 7.5, color: PdfColors.white), cellStyle: pw.TextStyle(font: regular, fontSize: 7), headerDecoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFF0B6B5A)), tableDirection: pw.TextDirection.rtl, headerDirection: pw.TextDirection.rtl, cellPadding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 4)),
        ],
      ));
      await Printing.layoutPdf(name: 'hadir-report-\${_date(_from)}-\${_date(_to)}.pdf', onLayout: (_) async => pdf.save());
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  pw.Widget _pdfMetric(String label, String value, pw.Font regular, pw.Font bold) => pw.Expanded(child: pw.Container(margin: const pw.EdgeInsets.only(left: 6), padding: const pw.EdgeInsets.all(8), decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.grey300), borderRadius: pw.BorderRadius.circular(8)), child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [pw.Text(label, style: pw.TextStyle(font: regular, fontSize: 7, color: PdfColors.grey600)), pw.SizedBox(height: 2), pw.Text(value, style: pw.TextStyle(font: bold, fontSize: 13))])));

`;
  if (!report.includes(anchor)) throw new Error('report anchor missing');
  report = report.replace(anchor, method + anchor);
}
if (!report.includes("tooltip: 'طباعة التقرير'")) {
  const anchor = "          PopupMenuButton<String>(\n            tooltip: 'تصدير التقرير',\n";
  const replacement = "          IconButton(onPressed: !_exporting && rows.isNotEmpty ? _printReport : null, tooltip: 'طباعة التقرير', icon: const Icon(Icons.print_outlined)),\n" + anchor;
  if (!report.includes(anchor)) throw new Error('report action anchor missing');
  report = report.replace(anchor, replacement);
}
const oldHero = `            Container(
              padding: const EdgeInsets.all(19),
              decoration: BoxDecoration(
                gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [HadirBrand.primary, HadirBrand.primaryDark]),
                borderRadius: BorderRadius.circular(HadirBrand.radiusXl),
              ),
              child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('لوحة الحضور التنفيذية', style: TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900)),
                SizedBox(height: 6),
                Text('تقرير رسمي من طبقة بيانات حاضر مع فلاتر، تفصيل يومي وتصدير جاهز للمشاركة.', style: TextStyle(color: Colors.white70, height: 1.5, fontSize: 12)),
              ]),
            ),
`;
const newHero = `            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: HadirBrand.border), boxShadow: const [BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 5))]),
              child: Row(children: [
                Container(width: 44, height: 44, decoration: BoxDecoration(color: HadirBrand.soft, borderRadius: BorderRadius.circular(13)), child: const Icon(Icons.bar_chart_rounded, color: HadirBrand.primary, size: 23)),
                const SizedBox(width: 12),
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('التقارير', style: TextStyle(color: HadirBrand.muted, fontSize: 10)), SizedBox(height: 2), Text('تقرير الحضور', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)), SizedBox(height: 4), Text('بيانات الحضور الرسمية مع الفلاتر والتفصيل والتصدير والطباعة.', style: TextStyle(color: HadirBrand.muted, height: 1.4, fontSize: 11))])),
              ]),
            ),
`;
if (report.includes(oldHero)) report = report.replace(oldHero, newHero);
write('lib/features/administration/pages/admin_reports_implementation.dart', report);

let profile = read('lib/features/employee/pages/profile_page_reference_implementation_v2.dart');
if (!profile.includes("import 'dart:ui' as ui;")) profile = "import 'dart:ui' as ui;\n" + profile;
if (!profile.includes("package:pdf/widgets.dart")) profile = profile.replace("import 'package:lucide_icons_flutter/lucide_icons.dart';\n", "import 'package:lucide_icons_flutter/lucide_icons.dart';\nimport 'package:pdf/pdf.dart';\nimport 'package:pdf/widgets.dart' as pw;\nimport 'package:printing/printing.dart';\n");
if (!profile.includes('Future<void> _printDigitalCard() async')) {
  const anchor = '  Widget _digitalCard() {';
  const method = `  Future<void> _printDigitalCard() async {
    final name = _text('name', 'الموظف');
    final job = _text('jobNumber', _text('username'));
    final id = _text('id', job);
    final verifyUrl = id == '—' ? '' : '$_webOrigin/employee/verify/\${Uri.encodeComponent(id)}';
    if (verifyUrl.isEmpty) return;
    try {
      final qrData = await QrPainter(data: verifyUrl, version: QrVersions.auto, gapless: true).toImageData(480, format: ui.ImageByteFormat.png);
      if (qrData == null) throw Exception('QR');
      final regular = await PdfGoogleFonts.notoSansArabicRegular();
      final bold = await PdfGoogleFonts.notoSansArabicBold();
      final pdf = pw.Document();
      pdf.addPage(pw.Page(pageFormat: PdfPageFormat.a4, margin: const pw.EdgeInsets.all(40), build: (_) => pw.Directionality(textDirection: pw.TextDirection.rtl, child: pw.Center(child: pw.Container(width: 360, padding: const pw.EdgeInsets.all(24), decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColor.fromInt(0xFFDCE6E2)), borderRadius: pw.BorderRadius.circular(18)), child: pw.Column(children: [pw.Text('HADIR', style: pw.TextStyle(font: bold, fontSize: 14, color: PdfColor.fromInt(0xFF0B6B5A))), pw.SizedBox(height: 5), pw.Text('الهوية الرقمية', style: pw.TextStyle(font: bold, fontSize: 20)), pw.SizedBox(height: 16), pw.Text(name, style: pw.TextStyle(font: bold, fontSize: 22)), pw.SizedBox(height: 5), pw.Text('موظف · الرقم الوظيفي $job', style: pw.TextStyle(font: regular, fontSize: 10, color: PdfColors.grey700)), pw.SizedBox(height: 18), pw.Image(pw.MemoryImage(qrData.buffer.asUint8List()), width: 190, height: 190), pw.SizedBox(height: 8), pw.Text('امسح الرمز للتحقق من هوية الموظف', style: pw.TextStyle(font: regular, fontSize: 9, color: PdfColors.grey700)), pw.SizedBox(height: 16), pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [pw.Text('الحالة: نشط', style: pw.TextStyle(font: bold, fontSize: 9, color: PdfColor.fromInt(0xFF0B6B5A))), pw.Text('التحقق: QR آمن', style: pw.TextStyle(font: bold, fontSize: 9))])])))));
      await Printing.layoutPdf(name: 'hadir-digital-card-$job.pdf', onLayout: (_) async => pdf.save());
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر تجهيز البطاقة للطباعة. حاول مرة أخرى.')));
    }
  }

`;
  if (!profile.includes(anchor)) throw new Error('profile anchor missing');
  profile = profile.replace(anchor, method + anchor);
}
profile = profile.replace("onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('طباعة البطاقة متاحة من نسخة الويب حالياً.'))),", 'onPressed: _printDigitalCard,');
write('lib/features/employee/pages/profile_page_reference_implementation_v2.dart', profile);
