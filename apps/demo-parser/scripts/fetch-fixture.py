#!/usr/bin/env python3
"""Fetch the pinned public CS2 regression fixture and verify its content."""
import hashlib
from pathlib import Path
import urllib.request

COMMIT = "45ca85aeac8fb0de9d385124d2c7fe0e7b8ff0c8"
BASE = f"https://raw.githubusercontent.com/LaihoE/demoparser/{COMMIT}/"
SIZE = 60_601_900
SHA256 = "84a1a4191302bdd2a3bbb5a727842093744b1fb1a228aeec630369e44b622cb2"
TARGET = Path(__file__).resolve().parents[1] / "testdata" / "public-cs2.dem"


def valid(path):
    return path.exists() and path.stat().st_size == SIZE and hashlib.file_digest(path.open("rb"), "sha256").hexdigest() == SHA256


def main():
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    if valid(TARGET):
        print(f"Verified existing fixture: {TARGET}")
        return
    temporary = TARGET.with_suffix(".dem.download")
    try:
        with urllib.request.urlopen(BASE + "src/parser/test_demo.dem", timeout=60) as response, temporary.open("wb") as output:
            count = 0
            while chunk := response.read(1024 * 1024):
                count += len(chunk)
                if count > SIZE:
                    raise RuntimeError("Fixture exceeds pinned size")
                output.write(chunk)
        if not valid(temporary):
            raise RuntimeError("Fixture size or SHA256 mismatch")
        if temporary.open("rb").read(8) != b"PBDEMS2\0":
            raise RuntimeError("Fixture is not a CS2 demo")
        temporary.replace(TARGET)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Downloaded verified CS2 fixture: {TARGET} ({SIZE} bytes; SHA256 {SHA256})")


if __name__ == "__main__":
    main()
