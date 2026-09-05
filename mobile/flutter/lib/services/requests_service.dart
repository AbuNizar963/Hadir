import '../core/api.dart';

class RequestsService {
  final HadirApi api;
  RequestsService(this.api);

  Future<List<Map<String, dynamic>>> list() async {
    final rows = await api.requests();
    return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<Map<String, dynamic>> create({required String type, required String reason, String? startDate, String? endDate}) {
    return api.createRequest(type: type, reason: reason, startDate: startDate, endDate: endDate);
  }

  Future<Map<String, dynamic>> confirm(String id) => api.confirmRequest(id);
}
