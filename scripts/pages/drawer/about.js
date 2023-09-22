const CHANGELOG_FILE_PATH = 'panorama/data/changelog.vdf';

class About {
	static sections = {
		/** @type {Panel} @static */
		credits: $('#Credits'),
		/** @type {Panel} @static */
		changelog: $('#Changelog')
	};

	static onLoad() {
		this.loadChangelog();

		this.initCreditEvents();

		this.switchSection('credits');

		$.GetContextPanel().SetDialogVariable('version', MomentumAPI.GetVersionInfo().version);
	}

	static switchSection(section) {
		const newSection = this.sections[section];

		if (!newSection) return;

		if (this.activeSection) this.activeSection.AddClass('about__section--hidden');

		newSection.RemoveClass('about__section--hidden');

		this.activeSection = newSection;
	}

	static initCreditEvents() {
		for (const panel of this.sections.credits.FindChildrenWithClassTraverse('about-credits__name')) {
			const name = panel.GetAttributeString('name', '');
			const roles = panel.GetAttributeString('roles', '');
			const bio = panel.GetAttributeString('bio', '');
			const section = panel.GetAttributeString('section', '');

			// Don't bother with tooltips for contributors that don't have any extra stuff set
			if (!name && !roles && !bio && section === 'contributor') continue;

			// Attribute strings seem to be limited to 256 chars, this breaks up bios into multiple strings when required.
			const maxLength = 255;
			const constructedBioString = bio
				? Array.from({ length: Math.ceil(bio.length / maxLength) })
						.fill(0)
						.map((_, i) => `&bio${i + 1}=${bio.slice(i * maxLength, (i + 1) * maxLength)}`)
						.join('')
				: '';

			panel.SetPanelEvent('onmouseover', () =>
				UiToolkitAPI.ShowCustomLayoutParametersTooltip(
					panel.id,
					'CreditsTooltip',
					'file://{resources}/layout/modals/tooltips/credit.xml',
					`username=${panel.GetAttributeString('username', '')}` +
						`&name=${name}` +
						`&section=${section}` +
						`&roles=${roles}` +
						`&pronouns=${panel.GetAttributeString('pronouns', '')}` +
						`&steamid=${panel.GetAttributeString('steamID', '')}` +
						`&discord=${panel.GetAttributeString('discord', '')}` +
						`&email=${panel.GetAttributeString('email', '')}` +
						`&github=${panel.GetAttributeString('github', '')}` +
						constructedBioString
				)
			);
			panel.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideCustomLayoutTooltip('CreditsTooltip'));
		}
	}

	static loadChangelog() {
		const changelogData = $.LoadKeyValuesFile(CHANGELOG_FILE_PATH);

		for (const [version, versionData] of Object.entries(changelogData)) {
			$.CreatePanel('Label', this.sections.changelog, '', {
				class: 'about-changelog__version',
				text: version
			});

			for (const [category, categoryData] of Object.entries(versionData)) {
				$.CreatePanel('Label', this.sections.changelog, '', {
					class: 'about-changelog__category',
					text: category
				});

				$.CreatePanel('Label', this.sections.changelog, '', {
					class: 'about-changelog__item',
					text: ' • ' + Object.values(categoryData).join('\n • ')
				});
			}
		}
	}
}
