'use strict';

class ImportExportSettings {
	static panels = {
		/** @type {TextEntry} @static */
		import: $('#ImportCode'),
		/** @type {TextEntry} @static */
		export: $('#ExportCode'),
		/** @type {ToggleButton} @static */
		modeButton: $('#Base64ModeButton'),
		/** @type {Label} @static */
		modeWarning: $('#Base64ModeWarning'),
		/** @type {Label} @static */
		importStatus: $('#ImportStatus'),
		/** @type {Label} @static */
		blockInputWarning: $('#BlockInputWarning')
	};

	static base64Mode = $.persistentStorage.getItem('settings.base64ExportMode');

	static onLoad() {
		const cp = $.GetContextPanel();

		const sectionName = cp.GetAttributeString('name', '');

		cp.SetDialogVariable('title', `Import/Export ${sectionName} Settings`);
		cp.SetDialogVariable('import_warning', '');

		this.cvars = {};
		let cvar;
		let i = 0;
		while ((cvar = cp.GetAttributeString(`cvar${i + 1}`, '')) !== '') {
			this.cvars[i] = cvar;
			i++;
		}

		if (this.base64Mode) $.DispatchEvent('Activated', this.panels.modeButton, 'mouse');
		else this.exportSettings();
	}

	static exportSettings() {
		this.exportString = Object.values(this.cvars)
			.map((cvar) => (this.base64Mode ? GameInterfaceAPI.GetSettingString(cvar) : cvar + ' ' + GameInterfaceAPI.GetSettingString(cvar)))
			.join('\n');

		if (this.base64Mode) this.exportString = $.CompressString(this.exportString);

		this.panels.export.text = this.exportString;
	}

	static importSettings() {
		const inputText = this.panels.import.text;

		try {
			const input = this.base64Mode ? $.DecompressString(inputText) : inputText;

			const cvars = input.split(/\n|;/);
			let foundInvalidInput = false;

			if (cvars.length === 0 || (cvars.length === 1 && !cvars[0])) throw 'No settings input!';

			if (this.base64Mode) {
				if (Object.keys(this.cvars).length !== cvars.length) throw 'Code is likely outdated.';

				cvars.forEach((cvarValue, index) => GameInterfaceAPI.SetSettingString(this.cvars[index], cvarValue));
			} else {
				if (!cvars[0].includes(' ')) throw 'Input contains no cvars. Are you trying to convert base64?';

				cvars.forEach((cvar) => {
					const cvarArray = cvar.split(' ');

					if (!Object.values(this.cvars).includes(cvarArray[0])) {
						foundInvalidInput = true;
						if (!cvar.startsWith('[')) this.panels.import.text = this.panels.import.text.replace(cvar, `[Invalid] ${cvar}`);

						return;
					}

					GameInterfaceAPI.SetSettingString(cvarArray[0], cvarArray.slice(1).join(' '));
				});
			}

			this.panels.importStatus.AddClass('color-positive');
			this.panels.importStatus.RemoveClass('color-error');
			$.GetContextPanel().SetDialogVariable('import_warning', 'Import successful!' + (foundInvalidInput ? ' Some invalid cvars were excluded.' : ''));
		} catch (e) {
			this.panels.importStatus.RemoveClass('color-positive');
			this.panels.importStatus.AddClass('color-error');
			$.GetContextPanel().SetDialogVariable('import_warning', 'Import failed! ' + e);
			$.Warning('Settings import parser failed! ' + e);
		}

		this.exportSettings();
	}

	static toggleBase64Mode() {
		this.base64Mode = this.panels.modeButton.IsSelected();
		$.persistentStorage.setItem('settings.base64ExportMode', this.base64Mode);
		this.panels.modeWarning.SetHasClass('hide', !this.base64Mode);
		this.exportSettings();
	}

	static blockExportEntryInput() {
		if (this.panels.export.text !== this.exportString) {
			// Hacky way of keeping the TextEntry enabled (so you can highlight stuff) without actually letting you change text
			const offset = this.panels.export.GetCursorOffset();
			this.panels.export.text = this.exportString;
			this.panels.export.SetCursorOffset(offset - 1);
		}
	}

	static exportSelectAll() {
		this.panels.export.SetFocus(true);
		this.panels.export.SelectAll();
	}
}
