import EmployeeScan from "@/pages/EmployeeScan";

/**
 * Compatibility route kept for existing employee links.
 *
 * IMPORTANT: this route must never request permissions or click controls on
 * behalf of the employee. Camera and geolocation are privacy-sensitive APIs
 * and must only start after an explicit user action.
 *
 * EmployeeScan already owns the complete verification flow and exposes the
 * explicit actions for location, QR camera and manual QR entry.
 */
export default function EmployeeScanAutoFlow() {
  return <EmployeeScan />;
}
