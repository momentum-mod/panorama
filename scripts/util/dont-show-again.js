const PS_OJBECT_KEY = 'dosa';

/**
 * A utility of handling anything with DOn't Show Again behaviour (not rice-based pancakes).
 */
class DosaHandler {
	/**
	 * Store a DoSA.
	 * @param {String} key
	 * @param {String} nameToken
	 */
	static addDosa(key, nameToken) {
		const dosas = this.#getPSObject();
		dosas[key] = nameToken;
		this.#setPSObject(dosas);
	}

	/**
	 * Remove a stored DoSA.
	 * @param {String} key
	 * @returns {Boolean} Whether the DoSA was deleted
	 */
	static removeDosa(key) {
		const dosas = this.#getPSObject();

		if (dosas[key]) {
			delete dosas[key];
			this.#setPSObject(dosas);
			return true;
		}

		return false;
	}

	/**
	 * Check whether a DoSA is stored.
	 * @param {String} key
	 */
	static checkDosa(key) {
		const dosas = this.#getPSObject();

		return !!dosas[key];
	}

	/**
	 * Get all DoSAs as [key, nameToken] tuples
	 * @returns {[string, string]}
	 */
	static getAll() {
		return Object.entries(this.#getPSObject()).map(([key, nameToken]) => [key, nameToken]);
	}

	/**
	 * Get the corresponding name token for a DoSA, if exists.
	 * @param {String} key
	 * @returns {String | undefined}
	 */
	static getNameToken(key) {
		const dosas = this.#getPSObject();

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
	static handleDosaCheckbox(panel, key, nameToken) {
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

	static #getPSObject() {
		return $.persistentStorage.getItem(PS_OJBECT_KEY) ?? {};
	}

	static #setPSObject(obj) {
		return $.persistentStorage.setItem(PS_OJBECT_KEY, obj);
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
	 * @param {String} [dosaKey]
	 * @param {String} [dosaNameToken]
	 */
	static onSubmit(dosaKey, dosaNameToken) {
		DosaHandler.handleDosaCheckbox($.GetContextPanel(), dosaKey, dosaNameToken);

		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
