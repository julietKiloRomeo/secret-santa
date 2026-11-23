"""Draw a year's Secret Santa locally and write the plaintext and encoded files.

Run from the repo root:  uv run python scripts/draw.py --year 2026
Commit only secret-santa-<year>.enc. The .json is gitignored.
"""

import argparse
import datetime
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from secret_santa import SecretSanta  # noqa: E402


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=datetime.date.today().year)
    parser.add_argument("--out", default=".", help="directory for the output files")
    parser.add_argument("--force", action="store_true", help="overwrite an existing draw")
    args = parser.parse_args(argv)

    santa = SecretSanta(year=args.year, data_dir=args.out)
    if os.path.exists(santa.encoded_path) and not args.force:
        print(f"{santa.encoded_path} exists; pass --force to redraw", file=sys.stderr)
        return 1

    santa.draw()
    problems = santa.violations(santa.config)
    if problems:
        print("draw broke rules, nothing written:", *problems, sep="\n  ", file=sys.stderr)
        return 1

    santa.save()
    print(f"wrote {santa.file_path} and {santa.encoded_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
