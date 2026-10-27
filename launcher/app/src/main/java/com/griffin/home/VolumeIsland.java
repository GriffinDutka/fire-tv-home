package com.griffin.home;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;

/**
 * iPhone-style volume HUD: a bar hanging from the top edge that fills with white to the level,
 * with the speaker inside it.
 *
 * Fire OS eats the volume keys before any app sees them and always shows its own VolumePanel
 * (a translucent strip at x 498–1422, y 0–112 on the 1920×1080 UI). We can't stop that, so the
 * island is opaque, appears instantly and fully covers the strip, and only retracts once the stock
 * panel has timed out (~3s after the last press). All sizes are in 1920-wide px, scaled by `s`.
 */
class VolumeIsland extends View {
    private static final long HOLD_MS = 3600;   // stock panel hides ~3s after the last change
    private static final float WIDTH = 980, HEIGHT = 136, RADIUS = 68, TOP = -80;
    private static final float WIN_W = 1060, WIN_H = 180;
    private static final int TRACK = 0xFF2C2C2E;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final WindowManager wm;
    private final float s;
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF r = new RectF();
    private final Path speaker = new Path();
    private final Runnable retract = () -> {
        exiting = true;
        lastFrame = 0;
        invalidate();
    };

    private boolean attached, exiting, muted;
    private float level, levelVel, target;  // slider fill, springs toward target
    private float bump, bumpVel;            // brief swell on each press, never shrinks below cover
    private float content;                  // 0→1 fade-in of the fill and icon
    private float exit;                     // 0→1 slide back up off the screen
    private long lastFrame;

    VolumeIsland(Context context) {
        super(context);
        wm = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        s = context.getResources().getDisplayMetrics().widthPixels / 1920f;
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        stroke.setStrokeWidth(5 * s);
    }

    /** @param value 0..1 */
    void show(float value, boolean mute) {
        main.removeCallbacks(retract);
        main.postDelayed(retract, HOLD_MS);
        boolean fresh = !attached || exit > 0;
        exiting = false;
        exit = 0; // the stock panel is back, so cover it again at once
        if (!attached) {
            level = value;
            levelVel = 0;
            content = 0;
            attach();
        } else if (!fresh && (value != target || mute != muted)) {
            bumpVel += 2.2f;
        } else if (!fresh && (value <= 0 || value >= 1)) {
            bumpVel += 4f; // pressing past either end: a bigger stretch, like iOS rubber-banding
        }
        target = value;
        muted = mute;
        lastFrame = 0;
        invalidate();
    }

    boolean isShowing() {
        return attached && !exiting;
    }

    void remove() {
        main.removeCallbacks(retract);
        if (!attached) return;
        try {
            wm.removeView(this);
        } catch (RuntimeException ignored) {
        }
        attached = false;
    }

    private void attach() {
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                Math.round(WIN_W * s), Math.round(WIN_H * s),
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        try {
            wm.addView(this, lp);
            attached = true;
        } catch (RuntimeException ignored) {
        }
    }

    @Override
    protected void onDraw(Canvas c) {
        long now = SystemClock.uptimeMillis();
        float dt = lastFrame == 0 ? 0.016f : Math.min((now - lastFrame) / 1000f, 0.032f);
        lastFrame = now;
        if (step(dt)) {
            postInvalidateOnAnimation();
        } else if (exit >= 1) {
            main.post(this::remove);
            return;
        }

        float b = Math.max(bump, 0);
        float w = (WIDTH + 24 * b) * s, h = (HEIGHT + 10 * b) * s;
        float cx = getWidth() / 2f;
        float shift = -exit * (HEIGHT + 24) * s;
        c.save();
        c.translate(0, shift);

        // The island is the bar, like iOS: an opaque dark track that fills with white.
        float rad = (RADIUS + 5 * b) * s;
        float left = cx - w / 2, right = cx + w / 2;
        r.set(left, TOP * s, right, h);
        fill.setColor(TRACK);
        c.drawRoundRect(r, rad, rad, fill);

        float a = content * (1 - exit);
        float v = Math.max(0, Math.min(1, level));
        float edge = left + w * v;
        if (v > 0) {
            fill.setColor(Color.argb(Math.round(255 * a), 0xF2, 0xF2, 0xF7));
            c.save();
            c.clipRect(left, TOP * s, edge, h);
            c.drawRoundRect(r, rad, rad, fill);
            c.restore();
        }

        // Speaker inside the bar: dark where the fill is under it, white where it isn't.
        float ix = left + 72 * s, cy = h / 2 + 2 * s;
        int waves = muted || target <= 0 ? -1 : target < 0.34f ? 1 : target < 0.67f ? 2 : 3;
        c.save();
        c.clipRect(left, TOP * s, edge, h);
        drawSpeaker(c, ix, cy, waves, Color.argb(Math.round(255 * a), 0x48, 0x48, 0x4A));
        c.restore();
        c.save();
        c.clipRect(edge, TOP * s, right, h);
        drawSpeaker(c, ix, cy, waves, Color.argb(Math.round(240 * a), 255, 255, 255));
        c.restore();
        c.restore();
    }

    /** Advances the springs; returns true while anything is still moving. */
    private boolean step(float dt) {
        // Slider: a stiff spring with a hint of overshoot, like iOS.
        float accel = 420 * (target - level) - 34 * levelVel;
        levelVel += accel * dt;
        level += levelVel * dt;
        // Swell: kicked by each press, bounces back to rest.
        float bAccel = -520 * bump - 26 * bumpVel;
        bumpVel += bAccel * dt;
        bump += bumpVel * dt;
        content = Math.min(1, content + dt / 0.22f);
        if (exiting) exit = Math.min(1, exit + dt / 0.28f);

        boolean settled = Math.abs(target - level) < 0.001f && Math.abs(levelVel) < 0.01f
                && Math.abs(bump) < 0.001f && Math.abs(bumpVel) < 0.01f;
        if (settled) {
            level = target;
            bump = bumpVel = levelVel = 0;
        }
        return !settled || content < 1 || (exiting && exit < 1);
    }

    /** Speaker glyph centred on (x, y). waves: 0–3, or -1 for muted (slashed). */
    private void drawSpeaker(Canvas c, float x, float y, int waves, int color) {
        float u = 2.4f * s;
        float ox = x - 7 * u;
        speaker.reset();
        speaker.moveTo(ox, y - 3 * u);
        speaker.lineTo(ox + 3.5f * u, y - 3 * u);
        speaker.lineTo(ox + 8 * u, y - 7.5f * u);
        speaker.lineTo(ox + 8 * u, y + 7.5f * u);
        speaker.lineTo(ox + 3.5f * u, y + 3 * u);
        speaker.lineTo(ox, y + 3 * u);
        speaker.close();
        fill.setColor(color);
        c.drawPath(speaker, fill);

        stroke.setColor(color);
        if (waves < 0) {
            c.drawLine(ox - 2 * u, y - 8 * u, ox + 13 * u, y + 8 * u, stroke);
            return;
        }
        for (int i = 1; i <= waves; i++) {
            float rad = (3 + 3.6f * i) * u;
            r.set(ox + 8 * u - rad + 2 * u, y - rad, ox + 8 * u + rad + 2 * u, y + rad);
            c.drawArc(r, -42, 84, false, stroke);
        }
    }
}
