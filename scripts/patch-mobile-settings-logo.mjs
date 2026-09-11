import fs from 'node:fs';

const path = 'lib/features/administration/pages/admin_mobile_settings_reference_page.dart';
let s = fs.readFileSync(path, 'utf8');
const original = s;

if (!s.includes("package:image_picker/image_picker.dart")) {
  s = s.replace("import 'package:flutter/material.dart';\n", "import 'dart:io';\n\nimport 'package:flutter/material.dart';\nimport 'package:image_picker/image_picker.dart';\n");
}

if (!s.includes('bool logoBusy = false;')) {
  s = s.replace("  bool addingLocation = false;\n", "  bool addingLocation = false;\n  bool logoBusy = false;\n  String? pendingLogoPath;\n");
}

if (!s.includes('Future<void> pickCompanyLogo()')) {
  const marker = "  void toast(String message, {bool danger = false}) {";
  const methods = `  Future<void> pickCompanyLogo() async {\n    if (busy || logoBusy) return;\n    try {\n      final picker = ImagePicker();\n      final image = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1024, maxHeight: 1024, imageQuality: 88);\n      if (image == null || !mounted) return;\n      setState(() => pendingLogoPath = image.path);\n    } catch (e) {\n      if (mounted) toast('تعذر اختيار الشعار: \${HadirApi.errorMessage(e)}', danger: true);\n    }\n  }\n\n  Future<void> saveCompanyLogo() async {\n    final path = pendingLogoPath;\n    if (path == null || logoBusy) return;\n    setState(() => logoBusy = true);\n    try {\n      final apiClient = await api();\n      if (apiClient == null) return;\n      await apiClient.uploadCompanyLogo(path);\n      final remote = await apiClient.settings();\n      if (!mounted) return;\n      setState(() { settings = Map<String, dynamic>.from(remote); pendingLogoPath = null; });\n      toast('تم حفظ شعار الشركة مركزيًا');\n    } catch (e) {\n      if (mounted) toast('تعذر حفظ الشعار: \${HadirApi.errorMessage(e)}', danger: true);\n    } finally {\n      if (mounted) setState(() => logoBusy = false);\n    }\n  }\n\n  Future<void> removeCompanyLogo() async {\n    if (logoBusy) return;\n    final confirmed = await confirm('إزالة شعار الشركة', 'سيتم إزالة الشعار المركزي من R2 وإخفاؤه من هوية الجهة.');\n    if (!confirmed) return;\n    setState(() => logoBusy = true);\n    try {\n      final apiClient = await api();\n      if (apiClient == null) return;\n      await apiClient.deleteCompanyLogo();\n      final remote = await apiClient.settings();\n      if (!mounted) return;\n      setState(() { settings = Map<String, dynamic>.from(remote); pendingLogoPath = null; });\n      toast('تمت إزالة شعار الشركة');\n    } catch (e) {\n      if (mounted) toast('تعذر إزالة الشعار: \${HadirApi.errorMessage(e)}', danger: true);\n    } finally {\n      if (mounted) setState(() => logoBusy = false);\n    }\n  }\n\n`;
  if (!s.includes(marker)) throw new Error('toast marker not found');
  s = s.replace(marker, methods + marker);
}

const assetCall = "child: Image.asset('assets/branding/hadir_logo_transparent.png'),";
if (s.includes(assetCall) && !s.includes("settings['brandLogo']")) {
  s = s.replace(assetCall, `child: ClipOval(\n                child: (settings['brandLogo']?.toString().trim().isNotEmpty ?? false)\n                    ? Image.network(settings['brandLogo'].toString(), fit: BoxFit.contain, errorBuilder: (_, __, ___) => Image.asset('assets/branding/hadir_logo_transparent.png'))\n                    : Image.asset('assets/branding/hadir_logo_transparent.png'),\n              ),`);
}
if (!s.includes("settings['brandLogo']")) throw new Error('brand widget marker not found');

const identityMarker = "              field(\n                'اسم الشركة / الجهة',";
if (!s.includes('الشعار الرسمي')) {
  const logoBlock = `              const SizedBox(height: 14),\n              Container(\n                padding: const EdgeInsets.all(12),\n                decoration: BoxDecoration(color: inner, borderRadius: BorderRadius.circular(18), border: Border.all(color: green.withValues(alpha: .18))),\n                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [\n                  Row(children: [iconBox(Icons.image_outlined), const SizedBox(width: 9), const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [\n                    Text('الشعار الرسمي', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900)),\n                    Text('الشعار الذي يظهر كهوية الشركة داخل النظام', style: TextStyle(color: muted, fontSize: 9.5)),\n                  ]))]),\n                  const SizedBox(height: 10),\n                  Row(children: [\n                    Container(width: 72, height: 72, padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFF070C16), borderRadius: BorderRadius.circular(16), border: Border.all(color: line)), child: pendingLogoPath != null ? Image.file(File(pendingLogoPath!), fit: BoxFit.contain) : ((settings['brandLogo']?.toString().trim().isNotEmpty ?? false) ? Image.network(settings['brandLogo'].toString(), fit: BoxFit.contain, errorBuilder: (_, __, ___) => Image.asset('assets/branding/hadir_logo_transparent.png')) : Image.asset('assets/branding/hadir_logo_transparent.png'))),\n                    const SizedBox(width: 10),\n                    Expanded(child: Wrap(spacing: 7, runSpacing: 7, children: [\n                      OutlinedButton.icon(onPressed: logoBusy ? null : pickCompanyLogo, icon: const Icon(Icons.add_photo_alternate_outlined, size: 17), label: Text(settings['brandLogo']?.toString().trim().isNotEmpty ?? false ? 'تغيير الشعار' : 'اختيار الشعار')),\n                      if (pendingLogoPath != null) FilledButton.icon(onPressed: logoBusy ? null : saveCompanyLogo, icon: const Icon(Icons.check_rounded, size: 17), label: const Text('حفظ الشعار'), style: FilledButton.styleFrom(backgroundColor: green, foregroundColor: Colors.black)),\n                      if (settings['brandLogo']?.toString().trim().isNotEmpty ?? false) TextButton.icon(onPressed: logoBusy ? null : removeCompanyLogo, icon: const Icon(Icons.delete_outline_rounded, size: 17), label: const Text('إزالة'), style: TextButton.styleFrom(foregroundColor: red)),\n                    ])),\n                  ]),\n                  if (pendingLogoPath != null) const Padding(padding: EdgeInsets.only(top: 8), child: Text('تم تجهيز صورة جديدة. اضغط «حفظ الشعار» لرفعها إلى R2.', textAlign: TextAlign.right, style: TextStyle(color: cyan, fontSize: 9.5))),\n                ]),\n              ),\n`;
  if (!s.includes(identityMarker)) throw new Error('identity marker not found');
  s = s.replace(identityMarker, logoBlock + identityMarker);
}

if (s === original) throw new Error('No settings changes were applied');
fs.writeFileSync(path, s);
console.log('patched mobile settings logo support');
