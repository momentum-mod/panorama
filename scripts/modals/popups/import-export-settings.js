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

		cp.SetDialogVariable(
			'title',
			$.Localize('#Settings_ImportExport_Title').replace('%thing%', $.Localize(sectionName))
		);
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
			.map((cvar) =>
				this.base64Mode
					? GameInterfaceAPI.GetSettingString(cvar)
					: cvar + ' ' + GameInterfaceAPI.GetSettingString(cvar)
			)
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

			if (cvars.length === 0 || (cvars.length === 1 && !cvars[0]))
				throw '#Settings_ImportExport_Error_NoSettings';

			if (this.base64Mode) {
				if (Object.keys(this.cvars).length !== cvars.length) throw '#Settings_ImportExport_Error_Outdated';

				for (const [index, cvarValue] of cvars.entries())
					GameInterfaceAPI.SetSettingString(this.cvars[index], cvarValue);
			} else {
				if (!cvars[0].includes(' ')) throw '#Settings_ImportExport_Error_NoCvars';

				for (const cvar of cvars) {
					const cvarArray = cvar.split(' ');

					if (!Object.values(this.cvars).includes(cvarArray[0])) {
						foundInvalidInput = true;
						if (!cvar.startsWith('['))
							this.panels.import.text = this.panels.import.text.replace(
								cvar,
								`[${$.Localize('#Settings_ImportExport_Invalid')}] ${cvar}`
							);

						continue;
					}

					GameInterfaceAPI.SetSettingString(cvarArray[0], cvarArray.slice(1).join(' '));
				}
			}

			this.panels.importStatus.AddClass('color-positive');
			this.panels.importStatus.RemoveClass('color-error');
			$.GetContextPanel().SetDialogVariable(
				'import_warning',
				$.Localize('#Settings_ImportExport_Success') +
					(foundInvalidInput ? ' ' + $.Localize('#Settings_ImportExport_Success_Excluded') : '')
			);
		} catch (error) {
			this.panels.importStatus.RemoveClass('color-positive');
			this.panels.importStatus.AddClass('color-error');
			$.GetContextPanel().SetDialogVariable(
				'import_warning',
				$.Localize('#Settings_ImportExport_Failure') + ' ' + $.Localize(error)
			);
			$.Warning($.Localize('#Settings import parser failed!') + ' ' + error);
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
