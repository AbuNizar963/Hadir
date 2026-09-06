package com.hadir.attendance;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView clockText;
    private TextView dateText;
    private TextView statusText;
    private Button attendanceButton;
    private long clockInAt = 0L;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            refreshClock();
            handler.postDelayed(this, 1000L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        clockText = findViewById(R.id.current_time);
        dateText = findViewById(R.id.current_date);
        statusText = findViewById(R.id.attendance_status);
        attendanceButton = findViewById(R.id.attendance_button);

        attendanceButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (clockInAt == 0L) {
                    clockInAt = System.currentTimeMillis();
                    attendanceButton.setText("إنهاء الدوام");
                    statusText.setText("أنت تعمل الآن");
                } else {
                    clockInAt = 0L;
                    attendanceButton.setText("بدء الدوام");
                    statusText.setText("لم يبدأ الدوام بعد");
                }
                refreshClock();
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(ticker);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(ticker);
        super.onPause();
    }

    private void refreshClock() {
        Date now = new Date();
        clockText.setText(new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(now));
        dateText.setText(new SimpleDateFormat("EEEE، d MMMM yyyy", new Locale("ar")).format(now));
    }
}
