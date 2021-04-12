'use strict';

let m_moviePlayer;

class IntroMovie {

    static showIntroMovie()
    {
        let movieName = "file://{resources}/videos/intro.webm";

        m_moviePlayer.SetMovie(movieName);

        // This function is called from CGameUI::OnGameUIActivated()
        // For now, we schedule the movie to play on the next frame because the first frame is so long that it causes the videoplayer to
        // stutter. The same bug can be seen if you hit a breakpoint, then resume during a video playback with audio.
        $.Schedule(0.0, IntroMovie.playIntroMovie);
        m_moviePlayer.SetFocus();
        $.RegisterKeyBind($("#IntroMoviePlayer"), "key_enter,key_space,key_escape", IntroMovie.skipIntroMovie);
    }

    static playIntroMovie() {
        m_moviePlayer.Play();
    }

    static skipIntroMovie() {
        m_moviePlayer.Stop();
    }

    static destroyMoviePlayer() {
        m_moviePlayer.SetMovie("");
    }

    static hideIntroMovie() {
        // Can't destroy the movie player straight away as this event has been dispatched by the video player itself
        // and therefore delay the destruction to the next iteration of the scheduler.
        $.Schedule( 0.0, IntroMovie.destroyMoviePlayer );

        $.DispatchEvent("ChaosHideIntroMovie");
    }
}

//--------------------------------------------------------------------------------------------------
// Entry point called when panel is created
//--------------------------------------------------------------------------------------------------
(function()
{
    m_moviePlayer = $("#IntroMoviePlayer");

    $.RegisterForUnhandledEvent("ChaosShowIntroMovie", IntroMovie.showIntroMovie);
    $.RegisterEventHandler("MoviePlayerPlaybackEnded", $("#IntroMoviePlayer"), IntroMovie.hideIntroMovie);
})();
