package com.griffin.home;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;

/** The screensaver on demand, from the home screen. Any remote press goes back home, like the real one. */
public class ScreensaverActivity extends Activity {
    private SaverView saver;
    private boolean pressed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        saver = new SaverView(this);
        setContentView(saver);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        // Only a press that started here: the release of the OK that opened us shouldn't close us.
        if (e.getAction() == KeyEvent.ACTION_DOWN) pressed = true;
        else if (pressed) finish();
        return true;
    }

    @Override
    protected void onStop() {
        super.onStop();
        finish();
    }

    @Override
    protected void onDestroy() {
        if (saver != null) {
            saver.destroy();
            saver = null;
        }
        super.onDestroy();
    }
}
