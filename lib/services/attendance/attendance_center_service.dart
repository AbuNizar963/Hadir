import '../../core/api.dart';

/// Shared read-only attendance/report center client.
///
/// The backend endpoint is the common read model for mobile and web. It keeps
/// live attendance on the canonical attendance engine while historical report
/// data remains read-only from the reporting facts layer.
class AttendanceCenterService {
  final HadirApi _api;

  const AttendanceCenterService(this._api);

  Future<Map<String, dynamic>> read({
    required String date,
    String? from,
    String? to,
    String? employeeId,
  }) async {
    final response = await _api.dio.get(
      '/api/manager/attendance-center',
      queryParameters: {
        'date': date,
        'from': from ?? date,
        'to': to ?? date,
        if (employeeId != null && employeeId.isNotEmpty) 'employeeId': employeeId,
      },
    );
    if (response.data is! Map) {
      throw StateError('استجابة مركز الحضور غير صالحة.');
    }
    return Map<String, dynamic>.from(response.data as Map);
  }
}
