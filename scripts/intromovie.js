'use strict';

class IntroMovie {
    static showIntroMovie()
    {
        $.DispatchEvent("ChaosHideIntroMovie"); // Disable intro movie for Momentum
    }
}

//--------------------------------------------------------------------------------------------------
// Entry point called when panel is created
//--------------------------------------------------------------------------------------------------
(function()
{
    $.RegisterForUnhandledEvent("ChaosShowIntroMovie", IntroMovie.showIntroMovie);
})();
