/**
 * All sorts of utility functions for JavaScript, plus some types.
 */
namespace Util {
	/** Check whether a given argument is an Object. */
	export function isObject(item: any): boolean {
		return item && typeof item === 'object' && !Array.isArray(item);
	}

	/** Deep merge two Objects. */
	export function mergeDeep(target: object, source: object): object {
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

	/** Deep compare two Objects. */
	export function compareDeep(object1: object, object2: object): boolean {
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

	export function getMainTrack(mapData: Web.MMap, gamemode: Web.Gamemode): Web.Leaderboard {
		return mapData.leaderboards.find(
			(leaderboard) =>
				leaderboard.gamemode === gamemode &&
				leaderboard.trackType === _.Web.TrackType.MAIN &&
				leaderboard.style === 0
		);
	}

	export function getNumZones(mapData: Web.MMap): number {
		return mapData.leaderboards.filter((leaderboard) => leaderboard.trackType === _.Web.TrackType.STAGE)
			.length;
	}

	export function uniqueID(): string {
		return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
	}

	/**
	 * Pass an event that should be only registered when playing certain gamemodes.
	 *
	 * This function will register/unregister the provided events handler when gamemodes change.
	 *
	 * It returns a function that will clean up both event handlers. It's unlikely we'll ever need to use it,
	 * so usually you can just discard it.
	 *
	 * @example
	 * ```ts
	 * // In the static initializer block for some panel's class, call the onUpdate function on this class
	 * // whenever the 'HudProcessInput' event is fired, ONLY if the current gamemode is Gamemode.DEFRAG.
	 * 	static {
	 * 		RegisterEventForGamemodes(
	 * 			[GameMode.DEFRAG],
	 * 			'HudProcessInput',
	 * 			$.GetContextPanel(),
	 * 			this.onUpdate.bind(this)
	 * 		);
	 * 	}
	 * ```
	 * @param gamemodes - Gamemodes to register the callback for. Handler is unregistered for any other modes.
	 * @param event - Event name
	 * @param context - Panel context
	 * @param callbackFn - Event callback
	 * @returns Cleanup function that unregisters both event handlers
	 */
	export function RegisterEventForGamemodes(
		gamemodes: number[],
		event: keyof GlobalEventNameMap,
		context: string | Panel,
		callbackFn: (...args: unknown[]) => void
	): () => void {
		let innerHandle: number | undefined;
		const outerHandle = $.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
			if (!innerHandle && gamemodes.includes(GameModeAPI.GetCurrentGameMode())) {
				innerHandle = $.RegisterEventHandler(event, context, callbackFn);
			} else if (innerHandle) {
				$.UnregisterEventHandler(event, context, innerHandle);
				innerHandle = undefined;
			}
		});

		return () => {
			if (innerHandle) {
				$.UnregisterEventHandler(event, context, innerHandle);
			}

			$.UnregisterForUnhandledEvent('LevelInitPostEntity', outerHandle);
		};
	}

	export interface RegisterHUDPanelForGamemodeOptions {
		context: object;
		contextPanel: Panel;
		gamemodes: number[];
		onLoad?: Func;
		handledEvents?: Array<{ event: keyof GlobalEventNameMap; callback: Func; contextPanel: Panel }>;
		unhandledEvents?: Array<{ event: keyof GlobalEventNameMap; callback: Func }>;
	}

	/**
	 * Mark a panel as being only active in the given gamemodes.
	 *
	 * The panel will be set to `visible=true` in the given modes, and `false` in all others.
	 *
	 * Any events provided will be registered at `LevelInitPostEntity` when the given a map is launched in the provided
	 * modes, and unregistered in any other modes.
	 *
	 * An optional `onLoad` function will be called whenever a launched in the provided modes.
	 *
	 * You must provide the current JS context with `context`, and don't need to use `.bind(this)` on any functions you pass.
	 *
	 * @example
	 * // Simplest usage, only visible in SURF.
	 * class MyEpicSurfPanel {
	 *   static {
	 *     RegisterHUDPanelForGamemode({
	 *       gamemodes: [Gamemode.SURF],
	 *       context: this,
	 *       contextPanel: $.GetContextPanel()
	 *     })
	 *   }
	 * }
	 *
	 * // More advanced example.
	 * class MyFuckedUpBhopPanel {
	 *   static {
	 *     RegisterHUDPanelForGamemode({
	 *        gamemodes: [Gamemode.BHOP],
	 *        context: this,
	 *        contextPanel: $.GetContextPanel(),
	 *        onLoad: this.setup,
	 *        handledEvents: [{
	 *          event: 'HudProcessInput',
	 *          callback: this.onUpdate,
	 *          contextPanel: $.GetContextPanel()
	 *        }]
	 *     })
	 *   }
	 *
	 *   static setup() {
	 *     // ...
	 *   }
	 *
	 *   static onUpdate() {
	 *     // ...
	 *   }
	 * }
	 *
	 * @returns Cleanup function that unregisters all event handlers
	 */
	export function RegisterHUDPanelForGamemode({
		context,
		contextPanel,
		onLoad,
		gamemodes,
		handledEvents,
		unhandledEvents
	}: RegisterHUDPanelForGamemodeOptions): () => void {
		if (!(gamemodes?.length > 0)) {
			throw new Error('RegisterHUDPanelForGamemode: no gamemode provided');
		}

		let handles: Array<{ event: keyof GlobalEventNameMap; handle: number; contextPanel?: GenericPanel }>;

		const unregister = () =>
			(handles ?? []).forEach(({ event, handle, contextPanel }) =>
				contextPanel === undefined
					? $.UnregisterForUnhandledEvent(event, handle)
					: $.UnregisterEventHandler(event, contextPanel, handle)
			);

		const handle = $.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
			unregister();
			handles = [];

			if (gamemodes.includes(GameModeAPI.GetCurrentGameMode())) {
				contextPanel.enabled = true;
				onLoad?.call(context);

				for (const { event, callback } of unhandledEvents ?? []) {
					handles.push({
						event,
						handle: $.RegisterForUnhandledEvent(event, callback.bind(context))
					});
				}

				for (const { event, contextPanel, callback } of handledEvents ?? []) {
					handles.push({
						event,
						contextPanel,
						handle: $.RegisterEventHandler(event, contextPanel, callback.bind(context))
					});
				}
			} else {
				contextPanel.enabled = false;
			}
		});

		return () => {
			unregister();
			$.UnregisterForUnhandledEvent('LevelInitPostEntity', handle);
		};
	}

	/** Yes "Maths" is a british-ism but avoids annoying namespace collisions with native library. */
	export namespace Maths {
		/** 2D vector object with x and y member variables */
		export type Vec2D = { x: number; y: number };

		/** 3D vector object with x, y, and z member variables */
		export type Vec3D = { x: number; y: number; z: number };
		export type Vector = Vec2D | Vec3D;

		/** 2D length of input vector */
		export function getSize2D(vec: Vector): number {
			return Math.sqrt(getSizeSquared2D(vec));
		}

		/** 2D length squared of input vector */
		export function getSizeSquared2D(vec: Vector): number {
			return vec.x * vec.x + vec.y * vec.y;
		}

		/**
		 * Returns copy of input vector scaled to length 1.
		 * If input vector length is less than threshold,
		 * the zero vector is returned.
		 */
		export function getNormal2D(vec: Vector, threshold: number): Vec2D {
			const mag = getSize2D(vec);
			const vecNormal = {
				x: vec.x,
				y: vec.y
			};
			if (mag < threshold * threshold) {
				vecNormal.x = 0;
				vecNormal.y = 0;
			} else {
				const inv = 1 / mag;
				vecNormal.x *= inv;
				vecNormal.y *= inv;
			}
			return vecNormal;
		}

		/** Dot product of two vectors. */
		export function getDot2D(vec1: Vector, vec2: Vector): number {
			return vec1.x * vec2.x + vec1.y * vec2.y;
		}

		/**
		 * Cross product of two 2D vectors.
		 * Defined as Z-component of resultant vector.
		 */
		export function getCross2D(vec1: Vector, vec2: Vector): number {
			return vec1.x * vec2.y - vec1.y * vec2.x;
		}

		/**
		 * Returns 2D copy of input vector rotated anti-clockwise by specified angle (in radians).
		 */
		export function rotateVector2D(vec: Vector, angle: number): Vec2D {
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);

			return {
				x: vec.x * cos - vec.y * sin,
				y: vec.y * cos + vec.x * sin
			};
		}

		/** Float equals check with threshold. */
		export function approxEquals(A: number, B: number, threshold: number): boolean {
			return Math.abs(A - B) < threshold;
		}

		/** Clamp angle to range [-Pi/2, Pi/2] by wrapping */
		export function wrapToHalfPi(angle: number): number {
			return Math.abs(angle) > Math.PI * 0.5 ? wrapToHalfPi(angle - Math.sign(angle) * Math.PI) : angle;
		}

		/** Converts [0, 2Pi) to [-Pi, Pi] */
		export function remapAngle(angle: number): number {
			angle += Math.PI;
			const integer = Math.trunc(angle / (2 * Math.PI));
			angle -= integer * 2 * Math.PI;
			return angle < 0 ? angle + Math.PI : angle - Math.PI;
		}

		/** Convert an angle to a projected screen length in pixels. */
		export function mapAngleToScreenDist(
			angle: number,
			fov: number,
			length: number,
			scale: number = 1,
			projection: number = 0
		) {
			const screenDist = length / scale;

			if (Math.abs(angle) >= fov) {
				return Math.sign(angle) > 0 ? screenDist + 1 : -1;
			}

			switch (projection) {
				case 0:
					return Math.round((1 + Math.tan(angle) / Math.tan(fov)) * screenDist * 0.5);
				case 1:
					return Math.round((1 + angle / fov) * screenDist * 0.5);
				case 2:
					return Math.round((1 + Math.tan(angle * 0.5) / Math.tan(fov * 0.5)) * screenDist * 0.5);
			}
		}
	}

	export namespace Color {
		/**
		 * Functions for manipulating RGB/RGBA strings and tuples.
		 */

		/** Tuple of R, G, B, A values ranged [0, 255] */
		export type RgbaTuple = [number, number, number, number];

		/**
		 * Returns a string formatted `rgba(R, G, B, A)` from RGBA number tuple, where
		 * `R`, `G`, `B` are values ranged [0, 255], `A` ranged [0, 1].
		 */
		export function tupleToRgbaString([r, g, b, a = 255]: RgbaTuple): string {
			return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
		}

		/**
		 * Returns a corresponding RGBA tuple for an RGB string.
		 * Input string must be formatted as `rgb(R, G, B)`, where `R`, `G`, `B`
		 * are values ranged `[0, 255]`. A is set to 255.
		 *
		 * For performance, this function does not check the input string.
		 */
		export function rgbStringToTuple(str: string): RgbaTuple {
			return [
				...str
					.slice(4, -1)
					.split(',')
					.map((c) => Number.parseInt(c)),
				255
			] as RgbaTuple;
		}

		/**
		 * Returns a corresponding RGBA tuple for an RGBA string.
		 * Input string must be formatted as `rgb(R, G, B, A)`, where `R`, `G`, `B`
		 * are values ranged `[0, 255]`, `A` ranged `[0, 1]`.
		 */
		export function rgbaStringToTuple(str: string): RgbaTuple {
			if (str[3] !== 'a') return rgbStringToTuple(str);

			return str
				.slice(5, -1)
				.split(',')
				.map((c, i) => (i === 3 ? Math.round(Number.parseFloat(c) * 255) : Number.parseInt(c))) as RgbaTuple;
		}

		/**
		 * Blends two tuples linearly by alpha value.
		 */
		export function rgbaTupleLerp(colorA: RgbaTuple, colorB: RgbaTuple, alpha: number): RgbaTuple {
			const interp: number = Math.max(Math.min(alpha, 1), 0);
			return (colorA as number[]).map((Ai, i) => Math.round(Ai + interp * (colorB[i] - Ai))) as RgbaTuple;
		}

		/**
		 * Blends two strings linearly by alpha.
		 * RGB inputs are converted to RGBA with A value of 1.
		 */
		export function rgbaStringLerp(colorA: string, colorB: string, alpha: number, useHsv: boolean = false): string {
			const arrayA: RgbaTuple = rgbaStringToTuple(colorA);
			const arrayB: RgbaTuple = rgbaStringToTuple(colorB);
			if (!useHsv) {
				return tupleToRgbaString(rgbaTupleLerp(arrayA, arrayB, alpha));
			}

			const fromHsv: RgbaTuple = rgbaToHsva(arrayA) as RgbaTuple;
			const toHsv: RgbaTuple = rgbaToHsva(arrayB) as RgbaTuple;

			// Take the shortest path to the new hue
			if (Math.abs(fromHsv[0] - toHsv[0]) > 180) {
				if (toHsv[0] > fromHsv[0]) {
					fromHsv[0] += 360;
				} else {
					toHsv[0] += 360;
				}
			}
			const newHsv = rgbaTupleLerp(fromHsv, toHsv, alpha);

			newHsv[0] = newHsv[0] % 360;
			if (newHsv[0] < 0) {
				newHsv[0] += 360;
			}

			const newRgb: RgbaTuple = hsvaToRgba(newHsv) as RgbaTuple;

			return tupleToRgbaString(newRgb);
		}

		/** Converts HSVA tuple to RGBA tuple */
		export function hsvaToRgba([h, s, v, a]: RgbaTuple): RgbaTuple {
			const hueDir: number = h / 60; // divide color wheel into Red, Yellow, Green, Cyan, Blue, Magenta
			const hueDirFloor: number = Math.floor(hueDir); // see which of the six regions holds the color to be converted
			const hueDirFraction: number = hueDir - hueDirFloor;

			const rgbValues: RgbaTuple = [
				v,
				v * (1 - s),
				v * (1 - hueDirFraction * s),
				v * (1 - (1 - hueDirFraction) * s)
			];
			const rgbSwizzle: number[][] = [
				[0, 3, 1],
				[2, 0, 1],
				[1, 0, 3],
				[1, 2, 0],
				[3, 1, 0],
				[0, 1, 2]
			];
			const swizzleIndex: number = hueDirFloor % 6;

			return [
				rgbValues[rgbSwizzle[swizzleIndex][0]] * 255,
				rgbValues[rgbSwizzle[swizzleIndex][1]] * 255,
				rgbValues[rgbSwizzle[swizzleIndex][2]] * 255,
				a
			] as RgbaTuple;
		}

		/** Converts RGBA tuple to HSVA tuple */
		export function rgbaToHsva([r, g, b, a]: RgbaTuple): RgbaTuple {
			const rgbMin: number = Math.min(r, g, b);
			const rgbMax: number = Math.max(r, g, b);
			const rgbRange: number = rgbMax - rgbMin;

			const h: number =
				rgbMax === rgbMin
					? 0
					: rgbMax === r
						? (((g - b) / rgbRange) * 60 + 360) % 360
						: rgbMax === g
							? ((b - r) / rgbRange) * 60 + 120
							: rgbMax === b
								? ((r - g) / rgbRange) * 60 + 240
								: 0;

			const s: number = rgbMax === 0 ? 0 : rgbRange / rgbMax;
			const v: number = rgbMax / 255;

			return [h, s, v, a] as RgbaTuple;
		}

		/** Removes A value from string formatted `rgba(R, G, B, A)`. */
		export function rgbaStringToRgb(str: string): string {
			const [r, g, b] = rgbaStringToTuple(str);
			return `rgb(${r}, ${g}, ${b})`;
		}

		/** Compresses A value from string formatted `rgba(R, G, B, A)` to the range `[0.75, 1]` */
		export function enhanceAlpha(str: string): string {
			const [r, g, b, a = 255] = rgbaStringToTuple(str);
			return tupleToRgbaString([r, g, b, Math.min(0.25 * a + 192, 255)]);
		}
	}
}
