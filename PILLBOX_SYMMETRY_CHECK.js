#!/usr/bin/env node

/*
 * Scan every .map file in a folder (default: this script's folder). For
 * each map, detect its symmetry (using the editor's own detector from
 * ../lgm, so the judgement matches what the editor would say on load)
 * and then, for the strongest symmetry found, check that every pillbox
 * has the same terrain under it as each of its symmetric copies.
 *
 * The detector deliberately excuses terrain under objects, so a map can
 * be "perfectly symmetric" while its pills sit on mismatched tiles —
 * that is exactly what this tool looks for.
 *
 * Usage: node PILLBOX_SYMMETRY_CHECK.js [folder] [--all]
 *   --all   also list maps with no problems (default: problems only)
 */

"use strict";

const fs = require("fs");
const path = require("path");

const LGM_SRC = path.join(__dirname, "..", "lgm", "src");
let BoloMap, BoloSym;
try {
	BoloMap = require(path.join(LGM_SRC, "format.js"));
	BoloSym = require(path.join(LGM_SRC, "sym.js"));
} catch (err) {
	console.log(`Could not load the lgm editor's modules from ${LGM_SRC}`);
	console.log(err.message);
	process.exit(1);
}

const SIZE = BoloMap.MAP_SIZE;

/* Position-only transform group about mirror sums S and T, matching the
 * detector's own axes (the x axis sits at S/2, the y axis at T/2). */
function group_about(mode, S, T) {
	const ID = (x, y) => [x, y];
	const MX = (x, y) => [S - x, y];
	const MY = (x, y) => [x, T - y];
	const R2 = (x, y) => [S - x, T - y];
	const R1 = (x, y) => [(S + T) / 2 - y, (T - S) / 2 + x];
	const R3 = (x, y) => [(S - T) / 2 + y, (S + T) / 2 - x];
	switch (mode) {
		case "h":      return [ID, MX];
		case "v":      return [ID, MY];
		case "quad":   return [ID, MX, MY, R2];
		case "rot180": return [ID, R2];
		case "rot90":  return [ID, R1, R2, R3];
		default:       throw new Error(`unknown mode ${mode}`);
	}
}

const MODE_LABELS = {
	quad:   "quad mirror",
	rot90:  "rotate 90",
	h:      "mirror left-right",
	v:      "mirror top-bottom",
	rot180: "rotate 180",
};

function terrain_name(t) {
	return BoloMap.TERRAIN_NAMES[t] || `terrain ${t}`;
}

/* Returns a list of problem strings (empty when every pill orbit agrees). */
function check_pills(map, mode, S, T) {
	let problems = [];
	let tf = group_about(mode, S, T);
	let pill_at = new Map(map.pills.map(p => [p.x + "," + p.y, p]));
	let done = new Set();

	for (let p of map.pills) {
		let key = p.x + "," + p.y;
		if (done.has(key)) continue;

		/* the orbit: every image position, deduplicated */
		let orbit = [];
		for (let f of tf) {
			let [ix, iy] = f(p.x, p.y);
			let k = ix + "," + iy;
			if (!orbit.some(o => o.k === k)) orbit.push({ x: ix, y: iy, k });
		}
		for (let o of orbit) done.add(o.k);

		/* detect() guarantees the pill set is closed under the group, but
		 * check anyway rather than trust it silently */
		let missing = orbit.filter(o => !pill_at.has(o.k));
		if (missing.length > 0) {
			problems.push(`pill (${p.x},${p.y}) has no copy at ${missing.map(o => `(${o.x},${o.y})`).join(" ")}`);
			continue;
		}

		let tiles = orbit.map(o => ({ ...o, t: BoloMap.get_pos(map.grid, o.x, o.y) }));
		let first = tiles[0].t;
		if (tiles.every(o => o.t === first)) continue;

		let desc = tiles.map(o => `(${o.x},${o.y}) ${terrain_name(o.t)}`).join(", ");
		problems.push(`pill terrain differs: ${desc}`);
	}
	return problems;
}

function main() {
	let args = process.argv.slice(2);
	let show_all = args.includes("--all");
	args = args.filter(a => a !== "--all");
	let folder = args[0] || __dirname;

	let names = fs.readdirSync(folder).filter(n => n.toLowerCase().endsWith(".map")).sort();
	let counts = { total: 0, asymmetric: 0, bad_pills: 0, errors: 0 };
	let by_mode = {};

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

		let d = BoloSym.detect(map);
		if (!d) {
			counts.asymmetric++;
			let s = BoloSym.score(map);
			let hint = s ? ` (nearest: ${MODE_LABELS[s.mode]}, ${s.flaws} edit${s.flaws === 1 ? "" : "s"} away)` : "";
			console.log(`${name}: no symmetry${hint}`);
			continue;
		}

		let label = MODE_LABELS[d.mode];
		by_mode[label] = (by_mode[label] || 0) + 1;
		let S = d.bounds.min_x + d.bounds.max_x;
		let T = d.bounds.min_y + d.bounds.max_y;
		let problems = check_pills(map, d.mode, S, T);

		if (problems.length > 0) {
			counts.bad_pills++;
			console.log(`${name}: ${label}, ${problems.length} pill problem${problems.length === 1 ? "" : "s"}`);
			for (let p of problems) console.log(`    ${p}`);
		} else if (show_all) {
			console.log(`${name}: ${label}, ${map.pills.length} pills OK`);
		}
	}

	console.log("");
	console.log(`${counts.total} maps: ${counts.total - counts.asymmetric - counts.errors} symmetric, ${counts.asymmetric} asymmetric, ${counts.errors} unreadable`);
	for (let label of Object.keys(by_mode).sort()) {
		console.log(`    ${label}: ${by_mode[label]}`);
	}
	console.log(`${counts.bad_pills} symmetric map${counts.bad_pills === 1 ? "" : "s"} with pill terrain mismatches`);
}

main();
