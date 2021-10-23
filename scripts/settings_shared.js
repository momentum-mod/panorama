'use strict';

class SettingsMenuShared {
	static resetControlsRecursive( panel )
	{
		if ( panel == null ) {
			return;
		}

		if (panel.GetChildCount == undefined) {
			// This happens sometimes. Not sure why
			return;
		}

		if (panel.paneltype == 'ChaosSettingsSlider' || panel.paneltype == 'ChaosSettingsEnumDropDown') {
			panel.RestoreCVarDefault();
		}
		else if ( panel.paneltype == 'ChaosSettingsKeyBinder' )
		{
			// Only need to refresh, as the binds are reset to default using the OptionsMenu component
			panel.OnShow();
		}
		else // We don't have nested settings controls
		{
			const nCount = panel.GetChildCount();
			for ( let i = 0; i < nCount; i++ )
			{
				const child = panel.GetChild(i);
				SettingsMenuShared.resetControlsRecursive(child);
			}
		}
	}

	static resetControls()
	{
		SettingsMenuShared.resetControlsRecursive($.GetContextPanel());
	}
	
	static refreshControlsRecursive( panel )
	{
		if ( panel == null ) {
			return;
		}

		if ( panel.OnShow != undefined ) {
			panel.OnShow();
		}
		
		if (panel.GetChildCount == undefined) {
			// This happens sometimes. Not sure why
			return;
		}
		else { // We don't have nested settings controls
			const nCount = panel.GetChildCount();
			for ( let i = 0; i < nCount; i++ )
			{
				const child = panel.GetChild(i);
				SettingsMenuShared.refreshControlsRecursive(child);
			}
		}
	}

	static scrollToId( locationId )
	{
		const elLocationPanel = $( '#'+locationId );

		if ( elLocationPanel != null )
		{
			elLocationPanel.ScrollParentToMakePanelFit(2, false);
			elLocationPanel.AddClass('Highlight');

			const kfs = elLocationPanel.CreateCopyOfCSSKeyframes( 'settings-highlight' );
			elLocationPanel.UpdateCurrentAnimationKeyframes( kfs );
		}
		else
		{
			$.Msg("Failed to scroll to '" + locationId + "'");
		}
	}
	
	static newTabOpened( newTab )
	{
		$.Msg( 'Settings menu new tab: ' + newTab );
		
		if ( newTab == 'VideoSettings' )
		{
			const videoSettingsPanel = $('#VideoSettings');
			
			// Get the apply and discard buttons on the video settings screen
			const btnApplyVideoSettings = videoSettingsPanel.FindChildInLayoutFile( "BtnApplyVideoSettings" );
			const btnDiscardVideoSettingChanges = videoSettingsPanel.FindChildInLayoutFile( "BtnDiscardVideoSettingChanges" );
			
			// disabled as no user changes yet
			btnApplyVideoSettings.enabled = false;
			btnDiscardVideoSettingChanges.enabled = false;

			// Tell C++ to init controls from convars
			$.DispatchEvent( "ChaosVideoSettingsInit" );
		}
		else if ( newTab == 'OnlineSettings' )
		{
			SettingsMenuShared.onlineSettingsUpdateModel();
		}
		
		const newTabPanel = $.GetContextPanel().FindChildInLayoutFile( newTab );
		SettingsMenuShared.refreshControlsRecursive( newTabPanel );

		// Save any changes made to convars, for tabs that do not have an explicit save
		GameInterfaceAPI.ConsoleCommand("host_writeconfig");
	}

	static resetVideoSettings()
	{
		$.DispatchEvent( "ChaosVideoSettingsResetDefault" );
		SettingsMenuShared.resetControls();
		SettingsMenuShared.videoSettingsOnUserInputSubmit();
	}
	
	// State logic to tracking if there are changes to apply or discard:
	// Changes in panel controls -> enable both
	// Reset button pressed -> enable both
	// Apply button pressed -> disable both
	// Discard button pressed -> disable both

	static btnApplyVideoSettings = null;
	static btnDiscardVideoSettingChanges = null;
	
	static videoSettingsOnUserInputSubmit()
	{
		const btnApplyVideoSettings = $( "#BtnApplyVideoSettings" );
		const btnDiscardVideoSettingChanges = $( "#BtnDiscardVideoSettingChanges" );
		
		if ( btnApplyVideoSettings != null ) {
			btnApplyVideoSettings.enabled = true;
		}

		if ( btnDiscardVideoSettingChanges != null ) {
			btnDiscardVideoSettingChanges.enabled = true;
		}
	}

	static videoSettingsResetUserInput()
	{
		const btnApplyVideoSettings = $( "#BtnApplyVideoSettings" );
		const btnDiscardVideoSettingChanges = $( "#BtnDiscardVideoSettingChanges" );
		
		if ( btnApplyVideoSettings != null ) {
			btnApplyVideoSettings.enabled = false;
		}

		if ( btnDiscardVideoSettingChanges != null ) {
			btnDiscardVideoSettingChanges.enabled = false;
		}
	}

	static videoSettingsDiscardChanges()
	{
		$.DispatchEvent( "ChaosVideoSettingsInit" );
		SettingsMenuShared.videoSettingsResetUserInput();
	}

	static videoSettingsApplyChanges()
	{
		$.DispatchEvent( "ChaosApplyVideoSettings" );
		SettingsMenuShared.videoSettingsResetUserInput();
	}
	
	static onlineSettingsUpdateModel()
	{
		const color = GameInterfaceAPI.GetSettingColor("mom_ghost_color");
		const bodygroup = GameInterfaceAPI.GetSettingInt("mom_ghost_bodygroup");
		
		const onlineSettingsPanel = $('#OnlineSettings');
		const ghostPreview = onlineSettingsPanel.FindChildInLayoutFile('GhostModelPreview');
		ghostPreview.SetCameraFOV(60.0);
		ghostPreview.SetModelRotationBoundsEnabled(true, false, false);
		ghostPreview.SetModelRotationBoundsX(-90.0, 90.0);
		ghostPreview.LookAtModel();
		ghostPreview.SetCameraOffset(-100.0, 0.0, 0.0);
		ghostPreview.SetModelColor(color);
		ghostPreview.SetModelBodygroup(1, bodygroup);
	}

	static setMainMenuBackgroundType(type)
	{
		GameInterfaceAPI.SetSettingInt('mom_ui_menu_background_video', type); 
		
		$.DispatchEvent('ReloadBackground');
	}

	static showConfirmDiscard( discardCall )
	{
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle('Confirm',
			'Are you sure you want to discard current settings?',
			'',
			'Discard',
			function() {
				discardCall();
			},
			'Return',
			function() {
			},
			'dim'
		);
	}
};