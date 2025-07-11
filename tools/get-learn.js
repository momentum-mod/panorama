import Papa from 'papaparse';
import axios from 'axios';
import * as fs from 'node:fs';
import { jsonToKV1 } from './lib.js';

const DATA_URL =
	'https://docs.google.com/spreadsheets/d/e/2PACX-1vTlH08v-dqtGl49T0Eslb56o-Y-xp6kOwhEo4Bwx387AxbpGHFw7AUBeBQMQdwEBI9g4gBBnGmUZ5EW/pub?output=csv';
const PATH = process.env['npm_package_config_baseDir'] + 'data/learn.vdf';

try {
	const res = await axios.get(DATA_URL);
	let dataArray = Papa.parse(res.data, { header: true }).data;
	dataArray = dataArray.filter((x) => x['Shippable'] === 'TRUE');
	for (const [i, _] of dataArray.entries()) {
		delete dataArray[i]['Ignore Me!'];
		delete dataArray[i]['Shippable'];
	}
	const data = {};
	for (const mode of ['Surf', 'Bhop', 'Climb', 'RJ', 'SJ', 'Tricksurf', 'Ahop', 'Parkour', 'Conc', 'Defrag'])
		for (const [index, lesson] of dataArray.filter((lesson) => lesson['Mode'] === mode).entries())
			data[mode] = {
				...data[mode],
				[mode + (index + 1)]: lesson
			};
	fs.writeFileSync(PATH, jsonToKV1(data, 'Learn'));
	console.log('Wrote converted data to ' + PATH);
} catch (error) {
	console.error(error);
}
