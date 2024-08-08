"use strict";
/**
 * All sorts of utility functions for JavaScript, plus some types.
 */
var Util;
(function (Util) {
    /** Check whether a given argument is an Object. */
    function isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
    Util.isObject = isObject;
    /** Deep merge two Objects. */
    function mergeDeep(target, source) {
        if (!(isObject(target) && isObject(source))) {
            throw new Error('Both arguments must be objects.');
        }
        const output = Object.assign({}, target);
        for (const key of Object.keys(source)) {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = mergeDeep(target[key], source[key]);
            }
            else {
                Object.assign(output, { [key]: source[key] });
            }
        }
        return output;
    }
    Util.mergeDeep = mergeDeep;
    /** Deep compare two Objects. */
    function compareDeep(object1, object2) {
        const objKeys1 = Object.keys(object1);
        const objKeys2 = Object.keys(object2);
        if (objKeys1.length !== objKeys2.length)
            return false;
        for (const key of objKeys1) {
            const value1 = object1[key];
            const value2 = object2[key];
            const isObjects = isObject(value1) && isObject(value2);
            if ((isObjects && !compareDeep(value1, value2)) || (!isObjects && value1 !== value2))
                return false;
        }
        return true;
    }
    Util.compareDeep = compareDeep;
    /**
     * Traverse all descendents of a Panel (depth-first). Use this to avoid ugly recursive search functions.
     * This is a generator iterator function, meaning it returns an iterable you can iterate over it directly with a
     * for...of loop.
     */
    function* traverseChildren(panel) {
        const stack = panel.Children();
        while (stack.length > 0) {
            const child = stack.pop();
            yield child;
            stack.push(...child.Children());
        }
    }
    Util.traverseChildren = traverseChildren;
    function getMainTrack(mapData, gamemode) {
        return mapData.leaderboards.find((leaderboard) => leaderboard.gamemode === gamemode &&
            leaderboard.trackType === _.Web.TrackType.MAIN &&
            leaderboard.style === 0);
    }
    Util.getMainTrack = getMainTrack;
    function getNumZones(mapData) {
        return mapData.leaderboards.filter((leaderboard) => leaderboard.trackType === _.Web.TrackType.STAGE)
            .length;
    }
    Util.getNumZones = getNumZones;
    function uniqueID() {
        return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
    Util.uniqueID = uniqueID;
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
    function RegisterEventForGamemodes(gamemodes, event, context, callbackFn) {
        let innerHandle;
        const outerHandle = $.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
            if (!innerHandle && gamemodes.includes(GameModeAPI.GetCurrentGameMode())) {
                innerHandle = $.RegisterEventHandler(event, context, callbackFn);
            }
            else if (innerHandle) {
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
    Util.RegisterEventForGamemodes = RegisterEventForGamemodes;
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
    function RegisterHUDPanelForGamemode({ context, contextPanel, onLoad, gamemodes, handledEvents, unhandledEvents }) {
        if (!(gamemodes?.length > 0)) {
            throw new Error('RegisterHUDPanelForGamemode: no gamemode provided');
        }
        let handles;
        const unregister = () => (handles ?? []).forEach(({ event, handle, contextPanel }) => contextPanel === undefined
            ? $.UnregisterForUnhandledEvent(event, handle)
            : $.UnregisterEventHandler(event, contextPanel, handle));
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
            }
            else {
                contextPanel.enabled = false;
            }
        });
        return () => {
            unregister();
            $.UnregisterForUnhandledEvent('LevelInitPostEntity', handle);
        };
    }
    Util.RegisterHUDPanelForGamemode = RegisterHUDPanelForGamemode;
    /** Yes "Maths" is a british-ism but avoids annoying namespace collisions with native library. */
    let Maths;
    (function (Maths) {
        /** 2D length of input vector */
        function getSize2D(vec) {
            return Math.sqrt(getSizeSquared2D(vec));
        }
        Maths.getSize2D = getSize2D;
        /** 2D length squared of input vector */
        function getSizeSquared2D(vec) {
            return vec.x * vec.x + vec.y * vec.y;
        }
        Maths.getSizeSquared2D = getSizeSquared2D;
        /**
         * Returns copy of input vector scaled to length 1.
         * If input vector length is less than threshold,
         * the zero vector is returned.
         */
        function getNormal2D(vec, threshold) {
            const mag = getSize2D(vec);
            const vecNormal = {
                x: vec.x,
                y: vec.y
            };
            if (mag < threshold * threshold) {
                vecNormal.x = 0;
                vecNormal.y = 0;
            }
            else {
                const inv = 1 / mag;
                vecNormal.x *= inv;
                vecNormal.y *= inv;
            }
            return vecNormal;
        }
        Maths.getNormal2D = getNormal2D;
        /** Dot product of two vectors. */
        function getDot2D(vec1, vec2) {
            return vec1.x * vec2.x + vec1.y * vec2.y;
        }
        Maths.getDot2D = getDot2D;
        /**
         * Cross product of two 2D vectors.
         * Defined as Z-component of resultant vector.
         */
        function getCross2D(vec1, vec2) {
            return vec1.x * vec2.y - vec1.y * vec2.x;
        }
        Maths.getCross2D = getCross2D;
        /**
         * Returns 2D copy of input vector rotated anti-clockwise by specified angle (in radians).
         */
        function rotateVector2D(vec, angle) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return {
                x: vec.x * cos - vec.y * sin,
                y: vec.y * cos + vec.x * sin
            };
        }
        Maths.rotateVector2D = rotateVector2D;
        /** Float equals check with threshold. */
        function approxEquals(A, B, threshold) {
            return Math.abs(A - B) < threshold;
        }
        Maths.approxEquals = approxEquals;
        /** Clamp angle to range [-Pi/2, Pi/2] by wrapping */
        function wrapToHalfPi(angle) {
            return Math.abs(angle) > Math.PI * 0.5 ? wrapToHalfPi(angle - Math.sign(angle) * Math.PI) : angle;
        }
        Maths.wrapToHalfPi = wrapToHalfPi;
        /** Converts [0, 2Pi) to [-Pi, Pi] */
        function remapAngle(angle) {
            angle += Math.PI;
            const integer = Math.trunc(angle / (2 * Math.PI));
            angle -= integer * 2 * Math.PI;
            return angle < 0 ? angle + Math.PI : angle - Math.PI;
        }
        Maths.remapAngle = remapAngle;
        /** Convert an angle to a projected screen length in pixels. */
        function mapAngleToScreenDist(angle, fov, length, scale = 1, projection = 0) {
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
        Maths.mapAngleToScreenDist = mapAngleToScreenDist;
    })(Maths = Util.Maths || (Util.Maths = {}));
    let Color;
    (function (Color) {
        /**
         * Functions for manipulating RGB/RGBA strings and tuples.
         */
        /**
         * Returns a string formatted `rgba(R, G, B, A)` from RGBA number tuple, where
         * `R`, `G`, `B` are values ranged [0, 255], `A` ranged [0, 1].
         */
        function tupleToRgbaString([r, g, b, a = 255]) {
            return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        }
        Color.tupleToRgbaString = tupleToRgbaString;
        /**
         * Returns a corresponding RGBA tuple for an RGB string.
         * Input string must be formatted as `rgb(R, G, B)`, where `R`, `G`, `B`
         * are values ranged `[0, 255]`. A is set to 255.
         *
         * For performance, this function does not check the input string.
         */
        function rgbStringToTuple(str) {
            return [
                ...str
                    .slice(4, -1)
                    .split(',')
                    .map((c) => Number.parseInt(c)),
                255
            ];
        }
        Color.rgbStringToTuple = rgbStringToTuple;
        /**
         * Returns a corresponding RGBA tuple for an RGBA string.
         * Input string must be formatted as `rgb(R, G, B, A)`, where `R`, `G`, `B`
         * are values ranged `[0, 255]`, `A` ranged `[0, 1]`.
         */
        function rgbaStringToTuple(str) {
            if (str[3] !== 'a')
                return rgbStringToTuple(str);
            return str
                .slice(5, -1)
                .split(',')
                .map((c, i) => (i === 3 ? Math.round(Number.parseFloat(c) * 255) : Number.parseInt(c)));
        }
        Color.rgbaStringToTuple = rgbaStringToTuple;
        /**
         * Blends two tuples linearly by alpha value.
         */
        function rgbaTupleLerp(colorA, colorB, alpha) {
            const interp = Math.max(Math.min(alpha, 1), 0);
            return colorA.map((Ai, i) => Math.round(Ai + interp * (colorB[i] - Ai)));
        }
        Color.rgbaTupleLerp = rgbaTupleLerp;
        /**
         * Blends two strings linearly by alpha.
         * RGB inputs are converted to RGBA with A value of 1.
         */
        function rgbaStringLerp(colorA, colorB, alpha, useHsv = false) {
            const arrayA = rgbaStringToTuple(colorA);
            const arrayB = rgbaStringToTuple(colorB);
            if (!useHsv) {
                return tupleToRgbaString(rgbaTupleLerp(arrayA, arrayB, alpha));
            }
            const fromHsv = rgbaToHsva(arrayA);
            const toHsv = rgbaToHsva(arrayB);
            // Take the shortest path to the new hue
            if (Math.abs(fromHsv[0] - toHsv[0]) > 180) {
                if (toHsv[0] > fromHsv[0]) {
                    fromHsv[0] += 360;
                }
                else {
                    toHsv[0] += 360;
                }
            }
            const newHsv = rgbaTupleLerp(fromHsv, toHsv, alpha);
            newHsv[0] = newHsv[0] % 360;
            if (newHsv[0] < 0) {
                newHsv[0] += 360;
            }
            const newRgb = hsvaToRgba(newHsv);
            return tupleToRgbaString(newRgb);
        }
        Color.rgbaStringLerp = rgbaStringLerp;
        /** Converts HSVA tuple to RGBA tuple */
        function hsvaToRgba([h, s, v, a]) {
            const hueDir = h / 60; // divide color wheel into Red, Yellow, Green, Cyan, Blue, Magenta
            const hueDirFloor = Math.floor(hueDir); // see which of the six regions holds the color to be converted
            const hueDirFraction = hueDir - hueDirFloor;
            const rgbValues = [
                v,
                v * (1 - s),
                v * (1 - hueDirFraction * s),
                v * (1 - (1 - hueDirFraction) * s)
            ];
            const rgbSwizzle = [
                [0, 3, 1],
                [2, 0, 1],
                [1, 0, 3],
                [1, 2, 0],
                [3, 1, 0],
                [0, 1, 2]
            ];
            const swizzleIndex = hueDirFloor % 6;
            return [
                rgbValues[rgbSwizzle[swizzleIndex][0]] * 255,
                rgbValues[rgbSwizzle[swizzleIndex][1]] * 255,
                rgbValues[rgbSwizzle[swizzleIndex][2]] * 255,
                a
            ];
        }
        Color.hsvaToRgba = hsvaToRgba;
        /** Converts RGBA tuple to HSVA tuple */
        function rgbaToHsva([r, g, b, a]) {
            const rgbMin = Math.min(r, g, b);
            const rgbMax = Math.max(r, g, b);
            const rgbRange = rgbMax - rgbMin;
            const h = rgbMax === rgbMin
                ? 0
                : rgbMax === r
                    ? (((g - b) / rgbRange) * 60 + 360) % 360
                    : rgbMax === g
                        ? ((b - r) / rgbRange) * 60 + 120
                        : rgbMax === b
                            ? ((r - g) / rgbRange) * 60 + 240
                            : 0;
            const s = rgbMax === 0 ? 0 : rgbRange / rgbMax;
            const v = rgbMax / 255;
            return [h, s, v, a];
        }
        Color.rgbaToHsva = rgbaToHsva;
        /** Removes A value from string formatted `rgba(R, G, B, A)`. */
        function rgbaStringToRgb(str) {
            const [r, g, b] = rgbaStringToTuple(str);
            return `rgb(${r}, ${g}, ${b})`;
        }
        Color.rgbaStringToRgb = rgbaStringToRgb;
        /** Compresses A value from string formatted `rgba(R, G, B, A)` to the range `[0.75, 1]` */
        function enhanceAlpha(str) {
            const [r, g, b, a = 255] = rgbaStringToTuple(str);
            return tupleToRgbaString([r, g, b, Math.min(0.25 * a + 192, 255)]);
        }
        Color.enhanceAlpha = enhanceAlpha;
    })(Color = Util.Color || (Util.Color = {}));
})(Util || (Util = {}));
