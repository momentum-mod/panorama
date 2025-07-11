export const xmlFrameTop =
	'<root>\n' + '	<styles>\n' + '		<include src="file://{resources}/styles/main.scss" />\n' + '	</styles>\n\n' + '	<Panel>';

export const xmlFrameBottom = '	</Panel>\n' + '</root>';

/**
 * Very basic KV1 parser. Won't support everything, works for Google sheets!
 * @param {Object} jsonData - JSON data
 * @param {string} header - String to put at the very top
 * @returns {string} kvString - Formatted KV string
 */
export const jsonToKV1 = (jsonData, header) => {
	const out = (str) => (output += '\t'.repeat(tabDepth) + str);

	let tabDepth = 0;

	const doObject = (obj) => {
		tabDepth++;
		for (const [k, v] of Object.entries(obj)) {
			if (typeof v == 'string') {
				out(`${JSON.stringify(k.replaceAll(' ', ''))}    ${JSON.stringify(v.replaceAll('"', "'"))}\n`);
			} else if (typeof v == 'object') {
				out(`"${k}"\n`);
				out('{\n');
				doObject(v);
				out('}\n');
			}
		}
		tabDepth--;
	};

	let output = `"${header}" \n{\n`;
	doObject(jsonData);
	out('}');
	return output;
};
