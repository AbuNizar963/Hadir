import EmployeeScan from "@/pages/EmployeeScan";

/**
 * Compatibility route kept for existing employee links.
 *
 * The employee action is explicit because the employee navigates to this
 * route by choosing check-in or check-out. EmployeeScan then opens the rear
 * camera, waits for a QR scan, requests geolocation only after the QR step,
 * and submits the attendance operation through the existing verification
 * service.
 */
export default function EmployeeScanAutoFlow() {
  return <EmployeeScan />;
}
