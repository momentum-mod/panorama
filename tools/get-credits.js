'use strict';

const lib = require('./lib.js');
const csvParser = require('papaparse');
const axios = require('axios');
const fs = require('node:fs');
const prettier = require('prettier');

const DATA_URL =
	'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7185y3UAgXH_sHrR98VXNXFoKIeBOhdSgFZS1dR9oi1eTR_rGEVsWXO_5sfidmdk0qlDxjMxKI1aj/pub?gid=0&single=true&output=csv';
const PATH = process.env.npm_package_config_baseDir + 'layout/pages/drawer/credits.xml';

const CREDITS_CLASS = 'about-credits';

const TYPES = {
	team: {
		title: '#Credits_MomentumTeam',
		sheetName: 'Team',
		maxColumns: 5
	}
	// Add back once Contributors section is done
	// contr: {
	// 	title: 'Contributors',
	// 	sheetName: 'Contributor',
	// 	maxColumns: 8
	// }
};

const SECTION_STYLES = {
	'Project Lead': 'lead',
	'Department Head': 'dept-head',
	Team: 'team'
};

class xmlStringBuilder {
	constructor() {
		this.output = '';
	}

	openPanel(type, data, unnested = false) {
		let str = `<${type}`;
		for (const [k, v] of Object.entries(data)) str += ` ${k}="${v}"`;
		this.output += str + (unnested ? '/>' : '>') + '\n';
		return type;
	}

	closePanel(type) {
		this.output += `</${type}>\n`;
	}
}

(async () => {
	try {
		const makeSection = (sectionArray, columns) => {
			const sectionName = sectionArray[0]['Section'];

			xmlString.openPanel(
				'Label',
				{ class: `${CREDITS_CLASS}__subheader`, text: `#Credits_${sectionName.replace(' ', '')}` },
				true
			);

			let personIndex = 0;
			const style = SECTION_STYLES[sectionName];
			const cols = Math.ceil(sectionArray.length / columns);

			for (let i = 0; i < cols; i++) {
				const row = xmlString.openPanel('Panel', {
					class: `${CREDITS_CLASS}__row`
				});

				for (let j = 0; j < sectionArray.length / cols; j++) {
					const personData = sectionArray[personIndex];

					if (!personData) break;
					if (!personData['Username']) continue;

					xmlString.openPanel(
						'Label',
						{
							id: `Credit${sectionName.replaceAll(/[^\dA-Za-z]/g, '')}${personIndex + 1}`,
							class:
								`${CREDITS_CLASS}__col ${CREDITS_CLASS}__name` +
								(style ? ` ${CREDITS_CLASS}__name--${style}` : ''),
							text: personData['Username'],
							username: personData['Username'],
							name: personData['Name'],
							section:
								SECTION_STYLES[personData['Section']] !== undefined
									? SECTION_STYLES[personData['Section']]
									: 'contributor', // WHY IS ES2020
							roles: personData['Roles'],
							pronouns: personData['Pronouns'],
							bio: personData['Bio'],
							steamID: personData['SteamID'],
							discord: personData['Discord'],
							email: personData['Email'],
							github: personData['Github']
						},
						true
					);

					personIndex++;
				}

				xmlString.closePanel(row);
			}
		};

		const sheetData = await axios.get(DATA_URL);

		const data = csvParser.parse(await sheetData.data, {
			header: true
		}).data;

		for (const [key, value] of Object.entries(data)) {
			delete value['Readme'];
			data[key] = value;
		}

		const xmlString = new xmlStringBuilder();

		for (const type of Object.values(TYPES)) {
			xmlString.openPanel('Label', { class: `${CREDITS_CLASS}__header`, text: type.title }, true);

			for (const section of new Set(
				data.filter((person) => person['Type'] === type.sheetName).map((person) => person['Section'])
			)) {
				makeSection(
					data.filter((x) => x['Section'] === section),
					type.maxColumns
				);
			}
		}

		const outString = prettier
			.format(lib.xmlFrameTop + '\n' + xmlString.output + '\n' + lib.xmlFrameBottom, {
				parser: 'html',
				useTabs: true
			})
			.replaceAll('<label', '<Label')
			.replaceAll('&', 'and');

		fs.writeFileSync(PATH, outString);

		console.log(`Wrote ${PATH} successfully.`);
	} catch (error) {
		console.log(error);
	}
})();
