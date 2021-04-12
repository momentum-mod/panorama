'use strict';

var LoadingScreen = ( function() {

	var _Init = function ()
	{
		$('#ProgressBar').value = 0;

		var elOverview = $('#LoadingScreenOverview');
		elOverview.RemoveAndDeleteChildren();
		//elOverview.SetImage("file://{images}/overheadmaps/default.png");

		$('#LoadingScreenMapName').text = "";
		$( '#LoadingScreenGameMode' ).SetLocalizationString( "#SFUI_LOADING" );
		$('#LoadingScreenModeDesc').text = "";
		$('#LoadingScreenGameModeIcon').SetImage("");

		var elBackgroundImage = $.GetContextPanel().FindChildInLayoutFile('BackgroundMapImage');
		elBackgroundImage.SetImage("file://{images}/map_icons/screenshots/1080p/default.png");

	    $('#LoadingScreenIcon').visible = false;
	}

	var _UpdateLoadingScreenInfo = function (mapName, prettyMapName, prettyGameModeName, gameType, gameMode, descriptionText)
	{
		if( mapName )
		{
			var elBackgroundImage = $.GetContextPanel().FindChildInLayoutFile( 'BackgroundMapImage' );		
			elBackgroundImage.SetImage( 'file://{images}/map_icons/screenshots/1080p/' + mapName +'.png' );

            // ** map icon
			var mapIconFailedToLoad = function () {
			    $('#LoadingScreenMapName').RemoveClass("loading-screen-content__info__text-title-short");
			    $('#LoadingScreenMapName').AddClass("loading-screen-content__info__text-title-long");
			    $('#LoadingScreenIcon').visible = false;
			}

			$('#LoadingScreenIcon').visible = true;
			$.RegisterEventHandler('ImageFailedLoad', $('#LoadingScreenIcon'), mapIconFailedToLoad.bind(undefined));
			$('#LoadingScreenMapName').RemoveClass("loading-screen-content__info__text-title-long");
			$('#LoadingScreenMapName').AddClass("loading-screen-content__info__text-title-short");
			$('#LoadingScreenIcon').SetImage('file://{images}/map_icons/map_icon_' + mapName + '.svg');
			
		    // ** map icon
			var mapOverviewLoaded = function () {
			    $('#LoadingScreenOverview').visible = true;
			}
			$.RegisterEventHandler('ImageLoaded', $('#LoadingScreenOverview'), mapOverviewLoaded.bind(undefined));
			var mapOverviewFailed = function () {
			    $('#LoadingScreenOverview').visible = false;
			}
			$.RegisterEventHandler('ImageFailedLoad', $('#LoadingScreenOverview'), mapOverviewFailed.bind(undefined));

			var elOverview = $( '#LoadingScreenOverview' );
			elOverview.SetImage('file://{images_overviews}/' + mapName + '_radar.dds');

			$( '#LoadingScreenIcon' ).AddClass('show');
			elBackgroundImage.AddClass('show');

			if ( prettyMapName != "" )
			    $( '#LoadingScreenMapName' ).SetProceduralTextThatIPromiseIsLocalizedAndEscaped( prettyMapName, false );
			else
			    $( '#LoadingScreenMapName' ).SetLocalizationString( GameStateAPI.GetMapDisplayNameToken( mapName ) );
		}

		var elInfoBlock = $('#LoadingScreenInfo' );

		if( gameMode )
		{
		    elInfoBlock.RemoveClass('hidden');
		    if ( prettyGameModeName != "" )
		        $( '#LoadingScreenGameMode' ).SetProceduralTextThatIPromiseIsLocalizedAndEscaped( prettyGameModeName, false );
		    else
		        $( '#LoadingScreenGameMode' ).SetLocalizationString( '#sfui_gamemode_' + gameMode );
			
			$('#LoadingScreenGameModeIcon').SetImage('file://{images}/icons/ui/' + gameMode + '.svg');

			if ( descriptionText != "" )
			    $( '#LoadingScreenModeDesc' ).SetProceduralTextThatIPromiseIsLocalizedAndEscaped( descriptionText, false );
			else
			    $( '#LoadingScreenModeDesc' ).SetLocalizationString( "" ); //$.Localize('#gamemode_' + gameMode + '_desc');
		}
		else
			elInfoBlock.AddClass( 'hidden' );
	}

	var _SetCharacterAnim = function ( elPanel, settings )
	{
        /*
		elPanel.ResetAnimation( false );
		elPanel.SetPlayerModel( settings.model );
		
		elPanel.EquipPlayerFromLoadout( settings.team, 'secondary0' );

		elPanel.LayerSequence( settings.anims.idle , true, false );
		elPanel.SetCameraPreset( settings.anims.cameraPreset, false );

		elPanel.EnableRendering( true );
		elPanel.Pause( true );
        */
	}

	// Create and position an image for an overview map icon, if present in the kv. 
	function CreateMapIcon( overviewKV, elParent, name )
	{
	    var X = overviewKV[ name+'_x' ];
	    var Y = overviewKV[ name+'_y' ];
	    if (X != null && Y != null && parseFloat(X) && parseFloat(Y))
		{
			var elIcon = $.CreatePanel( "Image", elParent, name );
			elIcon.style.position = Math.floor( X * 100 ).toString() + "% " + Math.floor( Y * 100 ).toString() + "% 0px;";
			return elIcon;
		}
	}

	var _OnMapConfigLoaded = function ( overviewKV )
	{
		// file from resource/overviews/mapname.txt as an object.
		var elMapOverview = $( '#LoadingScreenOverview' );
		if( elMapOverview )
		{
			var elImage;
			if ( elImage = CreateMapIcon( overviewKV, elMapOverview, "CTSpawn" ) )
			{
			    elImage.SetImage("file://{images}/hud/radar/RadarCTLogo.svg");
				elImage.AddClass("ct-spawn");

			    //\Chaos\trunk\game\Chaos\materials\panorama\images\icons\  ct_logo.svg and t_logo.svg
			}

			if ( elImage = CreateMapIcon( overviewKV, elMapOverview, "TSpawn" ) )
			{
			    elImage.SetImage("file://{images}/hud/radar/RadarTLogo.svg");
				elImage.AddClass( "t-spawn" );
			}

			if ( elImage = CreateMapIcon( overviewKV, elMapOverview, "bombA" ) )
			{
			    elImage.SetImage( "file://{images}/hud/radar/icon-bomb-zone-a.png" );
				elImage.AddClass("bomb-zone");
			}

			if ( elImage = CreateMapIcon( overviewKV, elMapOverview, "bombB" ) )
			{
			    elImage.SetImage( "file://{images}/hud/radar/icon-bomb-zone-b.png" );
				elImage.AddClass( "bomb-zone" );
			}

			for ( var i = 1; i <= 6; i++ )
			{
				if ( elImage = CreateMapIcon( overviewKV, elMapOverview, "Hostage"+i ) )
				{
				    elImage.SetImage("file://{images}/icons/ui/hostage_alive.svg");
					elImage.AddClass( "hostage-alive" );
				}
			}	

		}
	}	

	
	return {
		Init					: _Init,
		UpdateLoadingScreenInfo	: _UpdateLoadingScreenInfo,
		OnMapConfigLoaded		: _OnMapConfigLoaded
	}
})();


( function() {
	$.RegisterForUnhandledEvent( 'PopulateLoadingScreen', LoadingScreen.UpdateLoadingScreenInfo );
//	$.RegisterForUnhandledEvent( 'QueueConnectToServer', LoadingScreen.Init );
	$.RegisterForUnhandledEvent( 'OnMapConfigLoaded', LoadingScreen.OnMapConfigLoaded );
	$.RegisterForUnhandledEvent( 'UnloadLoadingScreenAndReinit', LoadingScreen.Init );
		
	// for testing
	//LoadingScreen.UpdateLoadingScreenInfo( 'de_inferno', 'deathmatch', 'deathmatch', '', '' );
})();