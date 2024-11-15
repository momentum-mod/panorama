![Momentum Mod](images/momentumLogo.svg)

> _Momentum Mod's game User Interface files used by the Strata Source Engine's Panorama UI framework._

# Structure

The repository primarily consists of XML, SCSS and TypeScript files. It also includes all icons and various images and
videos used by the UI.

For a general overview of Panorama, see the [VDC page](https://developer.valvesoftware.com/wiki/Panorama).

## XML

XML, found in the `layout/` folder, is used to describe the overall _layout_ of all panels. These panels can then be
manipulated by JavaScript and C++ code.

## CSS/SCSS

Panorama uses a variant of CSS for styling. Note that it does _not_ conform to the standard CSS spec, differing majorly
in how it handles things like flow and scaling. A complete list of CSS properties can be found using
`dump_panorama_css_properties markdown` in the ingame console (you will need to launch with -condebug and read the
console.log output). The list is also kept on the
[VDC](https://developer.valvesoftware.com/wiki/CSGO_Panorama_CSS_Properties) though this may not be fully up to date.

Momentum uses the [Sass](https://sass-lang.com/) preprocessor for all styling. This is compiled by the game itself on
first load then cached for future loads if unchanged. Developers may therefore change any Sass styling and it will be
recompiled on next launch or reload with `panorama_reload`, which is by default bound to F7.

The Sass module structure, found in `styles/`, is quite conventional, with all top-level modules (besides `abstract/`)
handled by `main.scss`. Any XML file then needs only include `main.scss` to access the entirety of the styling. We use
the [BEM](http://getbem.com/) (Block Element Modifier) naming scheme for all classes, besides those that are referenced
in C++ code, which use UpperCamelCase.

## JavaScript/TypeScript

Panorama uses the [V8 JavaScript engine](https://v8.dev) to run JavaScript, with TypeScript compiler (tsc) built-in to
the engine to provide native TypeScript support. Scripts can be found in `scripts/`, and are loaded at runtime through
`<scripts>` tags in XML files.

Whilst loading plain JavaScript is still supported, practically all of our code is in TypeScript, and we expect
contributors to use TypeScript for new code.

JavaScript communicates with the game via events and APIs exposed by the game. Types for these are includes in
`scripts/types-mom` and `scripts/types`, which is a submodule of the
[pano-typed](https://github.com/StrataSource/pano-typed) repo. and documentation for the exposed APIs and events. These
are updated manually, and some things may be missing; please let us know if anything seems off and we'll check engine
code.

# Contributing

Most of our larger systems and components require significant work with (closed-source) game code, and thus require
licensed C++ access or working in tandem with a licensed C++ developer. Our work until now has been done internally by
the core team. For 0.9.1 and onwards, we have exposed enough events and APIs that non-team developers should be able to
work on areas like HUD components (for a good example of non-licensed HUD work, see
[`scripts/hud/cgaz.ts`](scripts/hud/cgaz.ts)). We will continue to expose data as we best see fit for custom panels.

Those looking to contribute should look for issues **NOT** marked with "Needs C++". We also greatly encourage you to
check out the the #panorama channel in our [Discord](https://discord.gg/momentummod) - whilst Panorama itself is poorly
documented, we are happy to help any potential contributors further there!

### Basic Setup

For non-licensed developers, you will need to have a Steam build of the game installed. The easiest way to develop
Panorama changes on top of that is to mount the `panorama` folder in your `momentum/custom/` folder, by forking this
repo (if not a team member), then:

```bash
cd <Your Steam Momentum Mod or Momentum Mod Playtest install location>\momentum\custom\
mkdir PanoramaDev
cd PanoramaDev
git clone https://github.com/<your github account>/panorama.git
```

You should end up with `momentum/custom/PanoramaDev/panorama` containing the contents of this repository.

This will be mounted on game launch and override the files in your `momentum/panorama/` folder. Mind that it's possible
for overlaps, e.g. if your branch renames or moves a file, the original file will still be mounted, but this is very
rarely an issue. If necessary, rename your `momentum/panorama/` folder. (_NOTE: you'll need to do this after each
Momentum Mod Steam update!_)

### Type Checking, Linting and Formatting

Since adding native TypeScript support, a Node.js installation is not technically required. However, for performance the
built-in compiler only transpiles to JavaScript, without performing type checks. We run type checks in CI, but you
likely also want an editor with TypeScript support, and may want to run `npm run watch` (script for
`tsc --noEmit  --watch`) to check types as you go.

Linting and formatting is enforced in CI, run `npm install` to setup commit hooks for both, and use
`npm run <format/lint>:<fix/check>` to format/lint your code.

To get Node.js and NPM go to <https://nodejs.org/en/download/>

### Recommendations

@braem's [panorama-languages-support](https://marketplace.visualstudio.com/items?itemName=braemie.panorama-css) VSCode
plugin for language support for Panorama's version of CSS, which is invaluable for those unfamiliar with Panorama's
unique CSS properties.
