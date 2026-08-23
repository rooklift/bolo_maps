#!/usr/bin/env python3

"""
Scan every .map file in a folder (default: this script's folder) and report
any map containing a pillbox whose speed is not 100.
"""

import os
import sys


def read_pills(path):
	with open(path, "rb") as f:
		data = f.read()
	if data[:8] != b"BMAPBOLO":
		raise ValueError("bad header")
	n_pills = data[9]
	pills = []
	p = 12
	for _ in range(n_pills):
		if p + 5 > len(data):
			raise ValueError("unexpected end of file")
		x, y, owner, armour, speed = data[p:p + 5]
		pills.append({"x": x, "y": y, "owner": owner, "armour": armour, "speed": speed})
		p += 5
	return pills


def main():
	folder = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
	found = 0
	for name in sorted(os.listdir(folder)):
		if not name.lower().endswith(".map"):
			continue
		try:
			pills = read_pills(os.path.join(folder, name))
		except Exception as e:
			print(f"{name}: ERROR ({e})")
			continue
		odd = [p for p in pills if p["speed"] != 100]
		if odd:
			print(name)


if __name__ == "__main__":
	main()
