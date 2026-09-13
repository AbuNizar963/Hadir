import 'package:flutter_test/flutter_test.dart';

import 'package:hadir/features/authentication/pages/employee_login_page.dart';

void main() {
  test('accepts employee passwords with four or more alphanumeric characters', () {
    expect(isValidEmployeePassword('1234'), isTrue);
    expect(isValidEmployeePassword('Ab12'), isTrue);
    expect(isValidEmployeePassword('Ab12cd34'), isTrue);
  });

  test('rejects employee passwords shorter than four or with unsupported characters', () {
    expect(isValidEmployeePassword('123'), isFalse);
    expect(isValidEmployeePassword('Ab1'), isFalse);
    expect(isValidEmployeePassword('Ab 1'), isFalse);
    expect(isValidEmployeePassword('Ab12!'), isFalse);
    expect(isValidEmployeePassword(''), isFalse);
  });
}
