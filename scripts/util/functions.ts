/**
 * Utility functions for Javascript.
 * Could be ported to C++ and exposed globally in the future.
 */

/**
 * Check whether a give argument is an Object.
 * @param {any} item
 * @returns {boolean}
 */
function isObject(item) {
	return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deep merge two Objects.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function mergeDeep(target, source) {
	if (!(isObject(target) && isObject(source))) return;

	const output = Object.assign({}, target);
	for (const key of Object.keys(source))
		if (isObject(source[key]))
			if (!(key in target)) Object.assign(output, { [key]: source[key] });
			else output[key] = mergeDeep(target[key], source[key]);
		else Object.assign(output, { [key]: source[key] });
	return output;
}

/**
 * Deep compare two Objects.
 * @param {object} object1
 * @param {object} object2
 * @returns {boolean}
 */
function compareDeep(object1, object2) {
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

/**
 * Traverse all descendents of a Panel (depth-first). Use this to avoid ugly recursive search functions.
 * This is a generator iterator function, meaning it returns an iterable you can iterate over it directly with a
 * for...of loop.
 */
export function* traverseChildren(panel: GenericPanel): Generator<GenericPanel> {
	const stack = panel.Children();
	while (stack.length > 0) {
		const child = stack.pop();
		yield child;
		stack.push(...child.Children());
	}
}
