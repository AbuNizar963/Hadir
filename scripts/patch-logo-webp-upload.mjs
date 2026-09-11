import fs from 'node:fs';
const path = 'lib/features/administration/pages/admin_mobile_settings_reference_page.dart';
let s = fs.readFileSync(path, 'utf8');
if (!s.includes("package:flutter_image_compress/flutter_image_compress.dart")) {
  s = s.replace("import 'package:flutter/material.dart';\n", "import 'package:flutter/material.dart';\nimport 'package:flutter_image_compress/flutter_image_compress.dart';\n");
}
const old = `      await apiClient.uploadCompanyLogo(path);`;
const replacement = `      final compressed = await FlutterImageCompress.compressWithFile(\n        path,\n        minWidth: 1024,\n        minHeight: 1024,\n        quality: 88,\n        format: CompressFormat.webp,\n        autoCorrectionAngle: true,\n        keepExif: false,\n      );\n      if (compressed == null || compressed.isEmpty) {\n        throw StateError('تعذر تحويل الشعار إلى WebP.');\n      }\n      final tempDir = await Directory.systemTemp.createTemp('hadir-company-logo-');\n      final webpFile = File('${tempDir.path}/company-logo.webp');\n      try {\n        await webpFile.writeAsBytes(compressed, flush: true);\n        await apiClient.uploadCompanyLogo(webpFile.path);\n      } finally {\n        await webpFile.delete().catchError((_) => webpFile);\n        await tempDir.delete().catchError((_) => tempDir);\n      }`;
if (!s.includes(old)) throw new Error('upload call marker not found');
s = s.replace(old, replacement);
fs.writeFileSync(path, s);
console.log('patched WebP logo upload');
