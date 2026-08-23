from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REQUIRED_FILES = (
    "src/pages/AIAssistant.tsx",
    "src/pages/EmployeeProfile.tsx",
    "src/lib/avatarUrl.ts",
    "src/features/auth/employee/EmployeeLogin.tsx",
    "backend/src/workforce.ts",
)

# These markers intentionally describe the current implementation. This script is
# validation-only; it must never expect code from an older patch revision.
REQUIRED_MARKERS = {
    "src/pages/AIAssistant.tsx": (
        "getPrayerTimes",
        "qiblaBearing",
        "api.open-meteo.com",
        "answerManagerQuestion",
    ),
    "src/pages/EmployeeProfile.tsx": (
        "getBackendEmployeeProfile",
        "saveProfile",
        "setAvatar",
        "newPassword",
    ),
    "src/lib/avatarUrl.ts": (
        "employeeAvatarUrl",
        "/api/employees/",
    ),
    "src/features/auth/employee/EmployeeLogin.tsx": (
        "device-rebind-request",
        "إرسال طلب للإدارة لفك الجهاز",
    ),
    "backend/src/workforce.ts": (
        "device-rebind-request",
    ),
}


def fail(message: str) -> None:
    raise SystemExit(f"Hadir feature validation failed: {message}")


def main() -> None:
    for relative in REQUIRED_FILES:
        path = ROOT / relative
        if not path.is_file():
            fail(f"missing required file: {relative}")

    for relative, markers in REQUIRED_MARKERS.items():
        text = (ROOT / relative).read_text(encoding="utf-8")
        missing = [marker for marker in markers if marker not in text]
        if missing:
            fail(f"{relative}: missing markers: {', '.join(missing)}")

    print("Hadir feature validation passed: AI/weather/prayer/qibla, employee profile/avatar, and device rebind are present.")


if __name__ == "__main__":
    main()
