# Verdict rules (scripts/validate/reality_check.py)

Order of evaluation:
1. Schema/unit/naming/closure errors (validate_geometry.py) → REJECTED.
2. calibration.uncalibrated == true → UNVERIFIED (no metric claims).
3. No source file referenced → UNVERIFIED.
4. Any executed check failed → REJECTED.
5. No executed check passed → UNVERIFIED.
6. Any check skipped → UNVERIFIED (names the skipped checks).
7. Otherwise → VERIFIED, with the statement "architecturally accurate (for the checked properties only)".

Tolerances (constants in reality_check.py): dimensions 0.02 m, unit positions 0.10 m, source IoU ≥ 0.90.
A skipped check is never counted as a pass.

Tested by tests/geometry/test_reality.py (7 tests).
