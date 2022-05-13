![Momentum Mod](images/momentumLogo.svg)

> _Momentum Mod is a standalone game built on the Source Engine, aiming to centralize movement gametypes found in CS:S, CS:GO, and TF2._

# Momentum Mod Panorama

This repo contains all of our core game UI files used by Source's Panorama UI framework.

No C++ or other game code files will ever be stored here, it solely contains files interpreted at runtime by the game, authored by the Momentum Mod team.

## Structure

The repository primarily consists of XML, CSS and JavaScript files. It also includes all icons and various images and videos used by the UI.

For a general overview of Panorama see the [VDC page](https://developer.valvesoftware.com/wiki/Panorama).

### XML

XML is used to describe the overall layout of all panels. These panels can then be manipulated by JavaScript and C++ code.

### CSS/SCSS

Panorama uses a variant of CSS for styling. Note that it does _not_ conform to the standard CSS spec, differing majorly in how it handles things like flow and scaling. A complete list of CSS properties can be found using `dump_panorama_css_properties markdown` in the ingame console (you will need to launch with -condebug and read the console.log output). The list is also kept on the [VDC](https://developer.valvesoftware.com/wiki/CSGO_Panorama_CSS_Properties) though this may not be fully up to date.

Momentum uses the [Sass](https://sass-lang.com/) preprocessor for all styling. This is compiled by the game itself on first load then cached for future loads if unchanged. Developers may therefore change any Sass styling and it will be recompiled on next launch or reload with `panorama_reload`.

The Sass module structure is quite conventional, with all top-level modules (besides `abstract/`) handled by `main.scss`. Any XML file then needs only include `main.scss` to access the entirety of the styling. We use the [BEM](http://getbem.com/) (Block Element Modifier) naming scheme for all classes, besides those that are referenced in C++ code, which use Upper Camel Case.

### JavaScript

Panorama uses the V8 JavaScript engine to interpret and run JS files at runtime, including files in `<scripts>` tags in XML similar to regular web development.

JavaScript communicates with the game via events and APIs exposed by the game, a full list of which can be found by running `dump_panorama_events markdown` and `dump_panorama_js_scopes markdown` ingame. Many of these are listed in [this repository](https://github.com/panorama-languages-support/panorama-dumps), though it currently requires manual updating so may not be kept up-to-date.

## Setup

The easiest way to develop for Momentum Mod Panorama is to fork this repository and mount it in your `momentum/custom/` folder, for example:

```
cd <Your Steam Momentum Mod or Momentum Mod Playtest install location>\momentum\custom\
mkdir PanoramaDev
cd PanoramaDev
git clone https://github.com/<your github account>/panorama.git
```

You should end up with `momentum/custom/PanoramaDev/panorama`, containing the contents of this repository.

This will be mounted on game launch and override the files in your `momentum/panorama/` folder. To avoid nasty overlaps (such as if your dev branch renames or moves a file, both files will be mounted), we recommend temporarily renaming your `momentum/panorama/` folder (you'll need to do this after each Steam update).

Once up and running, if you're on VSCode, we highly recommend the tools at [panorama-languages-support](https://github.com/panorama-languages-support) made by one of our team members, brae. Also, the `get_latest_js_types` scripts in `momentum/tools/` will generate a JS file containing type information for all the Panorama panels and APIs, just keeping that file open in VSCode/WebStorm should provide you with type info.

## Contributing

Most of our larger systems and components require significant work with (closed-source) game code and thus requires licensed access or working tandem licensed dev. Thus, our work until now has been done internally by the core team. By the time of the release of 0.9.1 however, we have exposed enough events and APIs that non-team developers should be able to work on areas like HUD components (for an example of non-licensed HUD work, we recommend `scripts/hud/cgaz.js`).

Those looking to contribute should look for issues not marked with "Needs C++". See also the #panorama channel in our [Discord](https://discord.gg/momentummod) - whilst Panorama itself is poorly documented, we are happy to help any potential contributors there.
