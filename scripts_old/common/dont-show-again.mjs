const psObjectKey = 'dosa';
/** Store a DOSA */
export function addDosa(key, nameToken) {
    const dosas = getPSObject();
    dosas[key] = nameToken;
    setPSObject(dosas);
}
/** Remove a stored DOSA */
export function removeDosa(key) {
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
/** Check whether a DOSA is stored. */
export function checkDosa(key) {
    const dosas = getPSObject();
    return !!dosas?.[key];
}
/** Get all DOSAs as [key, nameToken] tuples */
export function getAll() {
    return Object.entries(getPSObject() ?? []).map(([key, nameToken]) => [key, nameToken]);
}
/** Get the corresponding name token for a DoSA, if exists */
export function getNameToken(key) {
    return getPSObject()?.[key];
}
/**
 * Traverse a panel to find a nested DontShowAgainCheckbox, and add DoSA if it's checked.
 * If no key or token are given, attempts to use the panel's attributes.
 * @returns Whether a DoSA was added
 */
export function handleDosaCheckbox(panel, key, nameToken) {
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
function getPSObject() {
    return $.persistentStorage.getItem(psObjectKey) ?? {};
}
function setPSObject(obj) {
    return $.persistentStorage.setItem(psObjectKey, obj);
}
/**
 * Traverses the popup for a DontShowAgainCheckbox ToggleButton and adds a DOSA if checked.
 * The arguments may be omitted and instead passed to the popup as params to
 * ShowCustomLayoutPopupParameters, and they'll be read from the popup's contextpanel's attributes.
 */
export function onSubmitHandler(dosaKey, dosaNameToken) {
    handleDosaCheckbox($.GetContextPanel(), dosaKey, dosaNameToken);
    UiToolkitAPI.CloseAllVisiblePopups();
}
