#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from gelatin_island import run_all_gates, write_receipt


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Gelatin Island G0-G3")
    parser.add_argument(
        "--out",
        default=str(ROOT / "results" / "gate_receipt.json"),
        help="JSON receipt path",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero if any frozen gate fails",
    )
    args = parser.parse_args()

    receipt = write_receipt(args.out)
    print("Gelatin Island gate receipt")
    for gate in receipt["gates"]:
        print(f"  {gate['name']}: {'PASS' if gate['pass'] else 'FAIL'}")
    print(f"ALL: {'PASS' if receipt['all_pass'] else 'FAIL'}")
    print(f"Wrote {args.out}")

    if args.check and not receipt["all_pass"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
