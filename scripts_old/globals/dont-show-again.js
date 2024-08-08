"use strict";
var DontShowAgain;
(function (DontShowAgain) {
    const psObjectKey = 'dosa';
    /** Store a DOSA */
    function addDosa(key, nameToken) {
        const dosas = getPSObject();
        dosas[key] = nameToken;
        setPSObject(dosas);
    }
    DontShowAgain.addDosa = addDosa;
    /** Remove a stored DOSA */
    function removeDosa(key) {
        const dosas = getPSObject();
        if (!dosas)
            return false;
        if (dosas[key]) {
            delete dosas[key];
            setPSObject(dosas);
            return true;
        }
        return false;
    }
    DontShowAgain.removeDosa = removeDosa;
    /** Check whether a DOSA is stored. * */
    function checkDosa(key) {
        const dosas = getPSObject();
        return !!dosas?.[key];
    }
    DontShowAgain.checkDosa = checkDosa;
    /** Get all DOSAs as [key, nameToken] tuples */
    function getAll() {
        return Object.entries(getPSObject() ?? []).map(([key, nameToken]) => [key, nameToken]);
    }
    DontShowAgain.getAll = getAll;
    /** Get the corresponding name token for a DoSA, if exists */
    function getNameToken(key) {
        return getPSObject()?.[key];
    }
    DontShowAgain.getNameToken = getNameToken;
    /**
     * Traverse a panel to find a nested DontShowAgainCheckbox, and add DoSA if it's checked.
     * If no key or token are given, attempts to use the panel's attributes.
     * @returns Whether a DoSA was added
     */
    function handleDosaCheckbox(panel, key, nameToken) {
        key ??= panel.GetAttributeString('dosaKey', '');
        nameToken ??= panel.GetAttributeString('dosaNameToken', '');
        if (!key || !nameToken)
            throw new Error(`Missing key or nameToken values for DosaHandler: ${{ key, nameToken }}`);
        if (panel.FindChildTraverse('DontShowAgainCheckbox')?.checked && key) {
            addDosa(key, nameToken);
            return true;
        }
        return false;
    }
    DontShowAgain.handleDosaCheckbox = handleDosaCheckbox;
    function getPSObject() {
        return $.persistentStorage.getItem(psObjectKey) ?? {};
    }
    function setPSObject(obj) {
        return $.persistentStorage.setItem(psObjectKey, obj);
    }
    /**
     * Provides a simple way for popups to register don't show again popups.
     */
    class DontShowAgainPopup {
        /**
         * Traverses the popup for a DontShowAgainCheckbox ToggleButton and adds a DOSA if checked.
         * The arguments may be omitted and instead passed to the popup as params to
         * ShowCustomLayoutPopupParameters, and they'll be read from the popup's contextpanel's attributes.
         */
        static onSubmit(dosaKey, dosaNameToken) {
            DontShowAgain.handleDosaCheckbox($.GetContextPanel(), dosaKey, dosaNameToken);
            UiToolkitAPI.CloseAllVisiblePopups();
        }
    }
    DontShowAgain.DontShowAgainPopup = DontShowAgainPopup;
})(DontShowAgain || (DontShowAgain = {}));
