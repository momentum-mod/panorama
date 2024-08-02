namespace DontShowAgain {
	const psObjectKey = 'dosa';

	/** Store a DOSA */
	export function addDosa(key: string, nameToken: string): void {
		const dosas = this.getPSObject();
		dosas[key] = nameToken;
		this.setPSObject(dosas);
	}

	/** Remove a stored DOSA */
	export function removeDosa(key: string): boolean {
		const dosas = this.getPSObject();
		if (!dosas) return false;

		if (dosas[key]) {
			delete dosas[key];
			this.setPSObject(dosas);
			return true;
		}

		return false;
	}

	/** Check whether a DOSA is stored. * */
	export function checkDosa(key: string): boolean {
		const dosas = this.getPSObject();

		return !!dosas?.[key];
	}

	/** Get all DOSAs as [key, nameToken] tuples */
	export function getAll(): [string, string][] {
		return Object.entries(getPSObject() ?? []).map(([key, nameToken]) => [key, nameToken]);
	}

	/** Get the corresponding name token for a DoSA, if exists */
	export function getNameToken(key: string): string | undefined {
		return this.getPSObject()?.[key];
	}

	/**
	 * Traverse a panel to find a nested DontShowAgainCheckbox, and add DoSA if it's checked.
	 * If no key or token are given, attempts to use the panel's attributes.
	 * @returns Whether a DoSA was added
	 */
	export function handleDosaCheckbox<Panel extends GenericPanel = GenericPanel>(
		panel: Panel,
		key: string,
		nameToken: string
	): boolean {
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

	function getPSObject(): Record<string, string> {
		return $.persistentStorage.getItem(psObjectKey) ?? {};
	}

	function setPSObject(obj: Record<string, string>) {
		return $.persistentStorage.setItem(psObjectKey, obj);
	}

	/**
	 * Provides a simple way for popups to register don't show again popups.
	 */
	export class DontShowAgainPopup {
		/**
		 * Traverses the popup for a DontShowAgainCheckbox ToggleButton and adds a DOSA if checked.
		 * The arguments may be omitted and instead passed to the popup as params to
		 * ShowCustomLayoutPopupParameters, and they'll be read from the popup's contextpanel's attributes.
		 */
		static onSubmit(dosaKey: string, dosaNameToken: string) {
			DontShowAgain.handleDosaCheckbox($.GetContextPanel(), dosaKey, dosaNameToken);

			UiToolkitAPI.CloseAllVisiblePopups();
		}
	}
}
