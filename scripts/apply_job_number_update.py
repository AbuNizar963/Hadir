from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# Production-safe/idempotent: normalize only the exact job-number patch route.
# Never replace source files wholesale and never touch historical attendance rows.
# Every mutation below is marker-based and fails closed when the expected source shape changes.
# Keep this script deterministic so CI can safely rerun it after unrelated source changes.

def patch_index():
    target = ROOT / "backend/src/index.ts"
    text = target.read_text(encoding="utf-8")