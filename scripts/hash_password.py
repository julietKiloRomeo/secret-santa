from werkzeug.security import generate_password_hash
import sys


def main():
    if len(sys.argv) < 2:
        print("Usage: uv run python scripts/hash_password.py <clear-text-passphrase>")
        sys.exit(1)
    phrase = sys.argv[1]
    print(generate_password_hash(phrase))


if __name__ == "__main__":
    main()
