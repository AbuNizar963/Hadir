class Office {
  String key;
  double latitude;
  double longitude;
  String name;
  double radius;

  Office({
    required this.key,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.radius,
  });

  factory Office.fromJson(String key, Map<String, dynamic> parsedJson) {
    return Office(
      key: key,
      name: parsedJson['name'],
      latitude: parsedJson['latitude'],
      longitude: parsedJson['longitude'],
      radius: parsedJson['radius'],
    );
  }
}
