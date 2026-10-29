package com.griffin.home;

import android.service.dreams.DreamService;

/**
 * Screensaver: Interstellar's Gargantua with a terminal readout of the date and Chicago weather,
 * alternating with 4K Apple aerials and film stills that scripts/stills.sh pushes to the TV.
 * The content lives in SaverView so the home screen can start it too (ScreensaverActivity).
 */
public class Gargantua extends DreamService {
    private SaverView saver;

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false); // any remote press wakes the TV
        setFullscreen(true);
        setScreenBright(true);
        MainActivity.dreaming();
        saver = new SaverView(this);
        setContentView(saver);
    }

    @Override
    public void onDetachedFromWindow() {
        if (saver != null) {
            saver.destroy();
            saver = null;
        }
        super.onDetachedFromWindow();
    }
}
