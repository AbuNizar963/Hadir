#!/usr/bin/env bash
set -Eeuo pipefail

wrapper_properties="android/gradle/wrapper/gradle-wrapper.properties"
expected_distribution="gradle-9.3.1-all.zip"
ci_distribution_url='https\://downloads.gradle.org/distributions/gradle-9.3.1-bin.zip'
ci_distribution_checksum='b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06'

if [ ! -f "$wrapper_properties" ]; then
  echo "Gradle wrapper properties were not generated: $wrapper_properties" >&2
  exit 1
fi

current_distribution="$(sed -n 's/^distributionUrl=//p' "$wrapper_properties")"
if [[ "$current_distribution" != *"$expected_distribution" ]]; then
  echo "Unexpected Gradle wrapper distribution: $current_distribution" >&2
  echo "Review the pinned Gradle version and its official checksum before changing this CI setup." >&2
  exit 1
fi

temporary_file="$(mktemp)"
trap 'rm -f "$temporary_file"' EXIT
awk -v url="$ci_distribution_url" -v checksum="$ci_distribution_checksum" '
  BEGIN { url_written = 0; checksum_written = 0 }
  /^distributionUrl=/ {
    print "distributionUrl=" url
    url_written = 1
    next
  }
  /^distributionSha256Sum=/ {
    print "distributionSha256Sum=" checksum
    checksum_written = 1
    next
  }
  { print }
  END {
    if (!url_written) exit 2
    if (!checksum_written) print "distributionSha256Sum=" checksum
  }
' "$wrapper_properties" > "$temporary_file"
mv "$temporary_file" "$wrapper_properties"

grep -Fxq "distributionUrl=$ci_distribution_url" "$wrapper_properties"
grep -Fxq "distributionSha256Sum=$ci_distribution_checksum" "$wrapper_properties"
echo "Configured verified Gradle 9.3.1 binary distribution for CI."
