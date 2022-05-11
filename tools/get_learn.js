const lib = require('./lib.js');
const parser = require('papaparse');
const axios = require('axios');
const fs = require('fs');

const DATA_URL =
	'https://docs.google.com/spreadsheets/d/e/2PACX-1vTlH08v-dqtGl49T0Eslb56o-Y-xp6kOwhEo4Bwx387AxbpGHFw7AUBeBQMQdwEBI9g4gBBnGmUZ5EW/pub?output=csv';
const PATH = process.env.npm_package_config_baseDir + 'data/learn.vdf';

axios
	.get(DATA_URL)
	.then((res) => {
		let dataArray = parser.parse(res.data, { header: true }).data;
		dataArray = dataArray.filter((x) => x['Shippable'] === 'TRUE');
		dataArray.forEach((_, i) => {
			delete dataArray[i]['Ignore Me!'];
			delete dataArray[i]['Shippable'];
		});
		let data = {};
		['Surf', 'Bhop', 'Climb', 'RJ', 'SJ', 'Tricksurf', 'Ahop', 'Parkour', 'Conc', 'Defrag'].forEach((mode) =>
			dataArray
				.filter((lesson) => lesson['Mode'] === mode)
				.forEach(
					(lesson, index) =>
						(data[mode] = {
							...data[mode],
							[mode + (index + 1)]: lesson
						})
				)
		);
		fs.writeFileSync(PATH, lib.jsonToKV1(data, 'Learn'));
	})
	.then((_) => console.log('Wrote converted data to ' + PATH))
	.catch((err) => console.error(err));
