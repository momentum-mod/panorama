const PS_OBJECT_KEY = 'dosa';

/**
 * A utility of handling anything with DOn't Show Again behaviour (not rice-based pancakes).
 */
class DosaHandler {
	/**
	 * Store a DoSA
	 */
	static addDosa(key: string, nameToken: string) {
		const dosas = this.getPSObject();
		dosas[key] = nameToken;
		this.setPSObject(dosas);
	}

	/**
	 * Remove a stored DoSA
	 */
	static removeDosa(key: string): boolean {
		const dosas = this.getPSObject();
		if (!dosas) return false;

		if (dosas[key]) {
			delete dosas[key];
			this.setPSObject(dosas);
			return true;
		}

		return false;
	}

	/**
	 * Check whether a DoSA is stored.
	 * */
	static checkDosa(key: string): boolean {
		const dosas = this.getPSObject();

		return !!dosas?.[key];
	}

	/**
	 * Get all DoSAs as [key, nameToken] tuples
	 */
	static getAll(): [string, string][] {
		return Object.entries(this.getPSObject() ?? []).map(([key, nameToken]) => [key, nameToken]);
	}

	/**
	 * Get the corresponding name token for a DoSA, if exists
	 */
	static getNameToken(key: string): string | undefined {
		const dosas = this.getPSObject();

		return dosas?.[key];
	}

	/**
	 * Traverse a panel to find a nested DontShowAgainCheckbox, and add DoSA if it's checked.
	 * If no key or token are given, attempts to use the panel's attributes.
	 * @param {Panel} panel
	 * @param {String} key
	 * @param {String} nameToken
	 * @returns {Boolean} Whether a DoSA was added
	 */
	static handleDosaCheckbox<P extends Panel>(panel: P, key: string, nameToken: string): boolean {
		key ??= panel.GetAttributeString('dosaKey', '');
		nameToken ??= panel.GetAttributeString('dosaNameToken', '');

		if (!key || !nameToken)
			throw new Error(`Missing key or nameToken values for DosaHandler: ${{ key, nameToken }}`);

		if (panel.FindChildTraverse('DontShowAgainCheckbox')?.checked && key) {
			this.addDosa(key, nameToken);
			return true;
		}

		return false;
	}

	private static getPSObject(): Record<string, string> {
		return $.persistentStorage.getItem(PS_OBJECT_KEY) ?? {};
	}

	private static setPSObject(obj: Record<string, string>) {
		return $.persistentStorage.setItem(PS_OBJECT_KEY, obj);
	}
}

/**
 * Provides a simple way for popups to register don't show again popups.
 */
class DosaPopup {
	/**
	 * Traverses the popup for a DontShowAgainCheckbox ToggleButton and adds a DoSA if checked.
	 * The arguments may be omitted and instead passed to the popup as params to
	 * ShowCustomLayoutPopupParameters, and they'll be read from the popup's contextpanel's attributes.
	 */
	static onSubmit(dosaKey: string, dosaNameToken: string) {
		DosaHandler.handleDosaCheckbox($.GetContextPanel(), dosaKey, dosaNameToken);

		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
