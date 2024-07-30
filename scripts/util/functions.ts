/**
 * Utility functions for Javascript.
 * Could be ported to C++ and exposed globally in the future.
 */

/**
 * Check whether a given argument is an Object.
 */
function isObject(item: any): boolean {
	return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deep merge two Objects.
 */
function mergeDeep(target: object, source: object): object {
	if (!(isObject(target) && isObject(source))) {
		throw new Error('Both arguments must be objects.');
	}

	const output = Object.assign({}, target);
	for (const key of Object.keys(source)) {
		if (isObject(source[key])) {
			if (!(key in target)) Object.assign(output, { [key]: source[key] });
			else output[key] = mergeDeep(target[key], source[key]);
		} else {
			Object.assign(output, { [key]: source[key] });
		}
	}
	return output;
}

/**
 * Deep compare two Objects.
 */
function compareDeep(object1: object, object2: object): boolean {
	const objKeys1 = Object.keys(object1);
	const objKeys2 = Object.keys(object2);

	if (objKeys1.length !== objKeys2.length) return false;

	for (const key of objKeys1) {
		const value1 = object1[key];
		const value2 = object2[key];
		const isObjects = isObject(value1) && isObject(value2);

		if ((isObjects && !compareDeep(value1, value2)) || (!isObjects && value1 !== value2)) return false;
	}

	return true;
}

function* traverseChildren(panel: GenericPanel): Generator<GenericPanel> {
	const stack = panel.Children();
	const attr = panel.GetAttributeString('id', 'null');
	if (attr === 'null') {
		throw new Error('Panel has no id attribute.');
	}
	for (const child of panel.Children() ?? []) {
		yield child;
		yield* traverseChildren(child);
	}
}