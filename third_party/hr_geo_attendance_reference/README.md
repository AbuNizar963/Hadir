# HR Geo Attendance Reference

This directory contains a small, isolated reference snapshot derived from:

- Repository: `MadhavPruthi/HR-Management-and-Geo-Attendance-System`
- Branch: `develop`
- License: Apache License 2.0

The imported files are implementation references for HADIR's native Flutter application, especially:

- geofencing state and lifecycle patterns
- attendance IN/OUT sequencing and validation
- map/location attendance recorder patterns
- office/geofence data modeling

The reference code is intentionally isolated from the production app and is **not wired into HADIR directly**. Some files were lightly adapted for this reference directory (while retaining attribution); production integration must be adapted further to HADIR's current API contracts, architecture, and dependency versions rather than copying obsolete dependencies or endpoints.

Original source: `MadhavPruthi/HR-Management-and-Geo-Attendance-System`.
See `LICENSE` in this directory for the applicable Apache 2.0 license text.
