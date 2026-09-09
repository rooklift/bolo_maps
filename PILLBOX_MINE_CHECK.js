#!/usr/bin/env node

/*
 * Scan every .map file in a folder (default: this script's folder) and
 * report any pillbox sitting on mined terrain. Symmetry is irrelevant
 * here; every pill on every map is checked.
 *
 * Usage: node PILLBOX_MINE_CHECK.js [folder]
 */

"use strict";

const fs = require("fs");
const path = require("path");

const LGM_SRC = path.join(__dirname, "..", "lgm", "src");
let BoloMap;
try {
	BoloMap = require(path.join(LGM_SRC, "format.js"));
} catch (err) {
	console.log(`Could not load the lgm editor's codec from ${LGM_SRC}`);
	console.log(err.message);
	process.exit(1);
}

/* Terrain codes 10..15 are the mined variants (swamp, crater, road,
 * forest, rubble, grass). */
function is_mined(t) {
	return t >= 10 && t <= 15;
}

function terrain_name(t) {
	return BoloMap.TERRAIN_NAMES[t] || `terrain ${t}`;
}

function main() {
	let folder = process.argv[2] || __dirname;
	let names = fs.readdirSync(folder).filter(n => n.toLowerCase().endsWith(".map")).sort();
	let counts = { total: 0, bad_maps: 0, bad_pills: 0, errors: 0 };

	for (let name of names) {
		counts.total++;
		let map;
		try {
			map = BoloMap.parse_map(new Uint8Array(fs.readFileSync(path.join(folder, name))));
		} catch (err) {
			counts.errors++;
			console.log(`${name}: ERROR (${err.message})`);
			continue;
		}

		let mined = map.pills
			.map(p => ({ ...p, t: BoloMap.get_pos(map.grid, p.x, p.y) }))
			.filter(p => is_mined(p.t));
		if (mined.length === 0) continue;

		counts.bad_maps++;
		counts.bad_pills += mined.length;
		console.log(`${name}: ${mined.length} mined pill${mined.length === 1 ? "" : "s"}`);
		for (let p of mined) console.log(`    pill (${p.x},${p.y}) on ${terrain_name(p.t)}`);
	}

	console.log("");
	console.log(`${counts.total} maps, ${counts.errors} unreadable`);
	console.log(`${counts.bad_pills} mined pill${counts.bad_pills === 1 ? "" : "s"} across ${counts.bad_maps} map${counts.bad_maps === 1 ? "" : "s"}`);
}

main();
