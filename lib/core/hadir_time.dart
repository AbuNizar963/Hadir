import 'package:timezone/timezone.dart' as tz;

/// HADIR business clock.
///
/// All business-day calculations and user-facing attendance timestamps must
/// use Asia/Damascus, regardless of the device's local timezone.
class HadirTime {
  static const String zoneName = 'Asia/Damascus';

  static tz.Location get _location => tz.getLocation(zoneName);

  /// Current wall-clock time in the HADIR business timezone.
  static DateTime now() => tz.TZDateTime.now(_location);

  /// Converts an API timestamp (an absolute instant) to Damascus wall time.
  /// API timestamps are expected to carry an explicit UTC/offset designator.
  static DateTime? fromTimestamp(Object? raw) {
    if (raw == null) return null;
    final parsed = DateTime.tryParse('$raw');
    if (parsed == null) return null;
    return tz.TZDateTime.from(parsed, _location);
  }

  /// Stable business-date key for an absolute instant.
  static String dateKey(DateTime instant) {
    final local = tz.TZDateTime.from(instant, _location);
    final month = local.month.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    return '${local.year.toString().padLeft(4, '0')}-$month-$day';
  }
}
