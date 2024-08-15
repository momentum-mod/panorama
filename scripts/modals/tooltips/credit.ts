const SECTIONS = ['lead', 'dept-head', 'team', 'contributor'];

class Credit {
	static panels = {
		pronouns: $('#Pronouns'),
		roles: $('#Roles'),
		bio: $('#Bio'),
		email: $('#Email'),
		discord: $('#Discord'),
		github: $('#Github')
	};

	static onShow() {
		const cp = $.GetContextPanel();
		const username = cp.GetAttributeString('username', '');
		const name = cp.GetAttributeString('name', '');
		const section = cp.GetAttributeString('section', '');
		const roles = cp.GetAttributeString('roles', '');
		const pronouns = cp.GetAttributeString('pronouns', '');
		const steamID = cp.GetAttributeString('steamid', '');
		const discord = cp.GetAttributeString('discord', '');
		const email = cp.GetAttributeString('email', '');
		const github = cp.GetAttributeString('github', '');

		// Reconstruct full bio strings
		let bio = '';
		let i = 1;
		let curBioSection;
		do {
			curBioSection = cp.GetAttributeString(`bio${i}`, '');
			bio += curBioSection;
			i++;
		} while (curBioSection.length >= 255);

		// If the name contains a comma, split around it, for names like "Blah von Blah"
		cp.SetDialogVariable(
			'first_names',
			name.includes(',') ? name.split(',')[0] : name.split(' ').slice(0, -1).join(' ')
		);
		cp.SetDialogVariable('last_name', name.includes(',') ? name.split(',')[1] : name.split(' ').slice(-1));
		cp.SetDialogVariable('username', username);
		cp.SetDialogVariable('roles', roles);
		cp.SetDialogVariable('pronouns', pronouns);
		cp.SetDialogVariable('bio', bio);
		cp.SetDialogVariable('email', email);
		cp.SetDialogVariable('discord', discord);
		cp.SetDialogVariable('github', github);

		for (const s of SECTIONS) cp.SetHasClass(`credit--${s.toLowerCase()}`, s === section);

		cp.SetHasClass('credit--no-name', name === '');
		this.panels.pronouns.SetHasClass('hide', pronouns === '');
		this.panels.roles.SetHasClass('hide', roles === '');
		this.panels.bio.SetHasClass('hide', bio === '');
		this.panels.email.SetHasClass('hide', email === '');
		this.panels.discord.SetHasClass('hide', discord === '');
		this.panels.github.SetHasClass('hide', github === '');
	}
}
