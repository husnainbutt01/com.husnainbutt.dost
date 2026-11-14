package com.husnainbutt.dost;

import android.Manifest;
import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "DostNative")
public class DostNativePlugin extends Plugin {

    private static final String MSG_CHANNEL_ID = "dost_messages";
    private static final String CALL_CHANNEL_ID = "dost_calls";
    private static final int CALL_NOTIFICATION_ID = 2001;
    private static final int PERMISSION_REQUEST_CODE = 9012;

    private JSObject pendingAction = null;

    @Override
    public void load() {
        createNotificationChannels();
        if (getActivity() != null && getActivity().getIntent() != null) {
            extractIntentAction(getActivity().getIntent(), false);
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null) {
            extractIntentAction(intent, true);
        }
    }

    private void extractIntentAction(Intent intent, boolean emitImmediately) {
        String actionType = intent.getStringExtra("dost_action");
        if (actionType == null || actionType.isEmpty()) return;

        JSObject payload = new JSObject();
        payload.put("action", actionType);
        String chatId = intent.getStringExtra("dost_chat_id");
        String callId = intent.getStringExtra("dost_call_id");
        if (chatId != null) payload.put("chatId", chatId);
        if (callId != null) payload.put("callId", callId);

        // Clear call notification once user interacts with Answer / Decline / Open Call
        if ("answer_call".equals(actionType) || "decline_call".equals(actionType) || "open_call".equals(actionType)) {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.cancel(CALL_NOTIFICATION_ID);
            }
            resetLockScreenFlags();
        }

        // Prevent re-firing on activity recreation
        intent.removeExtra("dost_action");

        if (emitImmediately && hasListeners("notificationAction")) {
            notifyListeners("notificationAction", payload, true);
        } else {
            pendingAction = payload;
        }
    }

    @PluginMethod
    public void getPendingAction(PluginCall call) {
        if (pendingAction != null) {
            JSObject result = pendingAction;
            pendingAction = null;
            call.resolve(result);
        } else {
            call.resolve(new JSObject());
        }
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject status = buildStatusObject();
        call.resolve(status);
    }

    @PluginMethod
    public void requestAllPermissions(PluginCall call) {
        if (getActivity() == null) {
            call.resolve(buildStatusObject());
            return;
        }

        List<String> needed = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.RECORD_AUDIO);
        }
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(getActivity(), needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }

        call.resolve(buildStatusObject());
    }

    @PluginMethod
    public void startBackgroundService(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), DostBackgroundService.class);
            serviceIntent.setAction(DostBackgroundService.ACTION_START);
            ContextCompat.startForegroundService(getContext(), serviceIntent);
            JSObject res = new JSObject();
            res.put("started", true);
            call.resolve(res);
        } catch (Exception e) {
            JSObject res = new JSObject();
            res.put("started", false);
            res.put("error", e.getMessage());
            call.resolve(res);
        }
    }

    @PluginMethod
    public void stopBackgroundService(PluginCall call) {
        try {
            Intent stopIntent = new Intent(getContext(), DostBackgroundService.class);
            stopIntent.setAction(DostBackgroundService.ACTION_STOP);
            getContext().startService(stopIntent);
        } catch (Exception e) {
            try {
                Intent serviceIntent = new Intent(getContext(), DostBackgroundService.class);
                getContext().stopService(serviceIntent);
            } catch (Exception ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && getActivity() != null) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                String pkg = getContext().getPackageName();
                if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + pkg));
                    getActivity().startActivity(intent);
                }
            }
        } catch (Exception ignored) {}
        call.resolve(buildStatusObject());
    }

    @PluginMethod
    public void isBiometricAvailable(PluginCall call) {
        JSObject res = new JSObject();
        boolean available = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            BiometricManager bm = getContext().getSystemService(BiometricManager.class);
            if (bm != null) {
                int canAuth = bm.canAuthenticate();
                available = (canAuth == BiometricManager.BIOMETRIC_SUCCESS);
            }
        }
        KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        boolean deviceSecure = km != null && km.isDeviceSecure();
        res.put("biometric", available);
        res.put("deviceCredential", deviceSecure);
        res.put("available", available || deviceSecure);
        call.resolve(res);
    }

    @PluginMethod
    public void authenticateBiometric(PluginCall call) {
        if (getActivity() == null) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("error", "Activity unavailable");
            call.resolve(res);
            return;
        }

        String title = call.getString("title", "Unlock DOST");
        String subtitle = call.getString("subtitle", "Verify your fingerprint or face to continue");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getActivity().runOnUiThread(() -> {
                try {
                    BiometricPrompt.Builder builder = new BiometricPrompt.Builder(getContext())
                        .setTitle(title)
                        .setSubtitle(subtitle);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        builder.setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_WEAK |
                            BiometricManager.Authenticators.DEVICE_CREDENTIAL
                        );
                    } else {
                        builder.setDeviceCredentialAllowed(true);
                    }

                    BiometricPrompt prompt = builder.build();
                    CancellationSignal signal = new CancellationSignal();
                    prompt.authenticate(
                        signal,
                        ContextCompat.getMainExecutor(getContext()),
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                JSObject res = new JSObject();
                                res.put("success", true);
                                call.resolve(res);
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, CharSequence errString) {
                                JSObject res = new JSObject();
                                res.put("success", false);
                                res.put("error", errString != null ? errString.toString() : "Authentication cancelled");
                                call.resolve(res);
                            }

                            @Override
                            public void onAuthenticationFailed() {
                                // User can retry inside the system biometric sheet
                            }
                        }
                    );
                } catch (Exception e) {
                    launchDeviceCredentialFallback(call, title, subtitle);
                }
            });
            return;
        }

        launchDeviceCredentialFallback(call, title, subtitle);
    }

    @SuppressWarnings("deprecation")
    private void launchDeviceCredentialFallback(PluginCall call, String title, String subtitle) {
        try {
            KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null && km.isDeviceSecure()) {
                Intent intent = km.createConfirmDeviceCredentialIntent(title, subtitle);
                if (intent != null) {
                    startActivityForResult(call, intent, "handleCredentialResult");
                    return;
                }
            }
        } catch (Exception ignored) {}
        JSObject res = new JSObject();
        res.put("success", false);
        res.put("error", "Biometric / device lock not configured");
        call.resolve(res);
    }

    @ActivityCallback
    private void handleCredentialResult(PluginCall call, ActivityResult result) {
        JSObject res = new JSObject();
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            res.put("success", true);
        } else {
            res.put("success", false);
            res.put("error", "Authentication cancelled");
        }
        call.resolve(res);
    }

    @PluginMethod
    public void showMessageNotification(PluginCall call) {
        createNotificationChannels();
        String title = call.getString("title", "DOST Message");
        String body = call.getString("body", "You received a new message");
        String chatId = call.getString("chatId", "");
        int notifId = Math.abs((chatId + "_" + System.currentTimeMillis()).hashCode());
        if (chatId != null && !chatId.isEmpty()) {
            notifId = Math.abs(chatId.hashCode());
        }

        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("dost_action", "open_chat");
        intent.putExtra("dost_chat_id", chatId);

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;

        PendingIntent pendingIntent = PendingIntent.getActivity(getContext(), notifId, intent, flags);
        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        Notification notification = new NotificationCompat.Builder(getContext(), MSG_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_dost)
            .setColor(Color.parseColor("#0FA958"))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 220, 120, 220})
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build();

        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notifId, notification);
        }
        call.resolve();
    }

    @PluginMethod
    public void showIncomingCallNotification(PluginCall call) {
        createNotificationChannels();
        String callId = call.getString("callId", "");
        String callerName = call.getString("callerName", "DOST User");
        String callType = call.getString("callType", "audio");
        String subtitle = "video".equals(callType) ? "Incoming DOST Video Call" : "Incoming DOST Voice Call";

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;

        Intent fullScreenIntent = new Intent(getContext(), MainActivity.class);
        fullScreenIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        fullScreenIntent.putExtra("dost_action", "open_call");
        fullScreenIntent.putExtra("dost_call_id", callId);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(getContext(), 3001, fullScreenIntent, flags);

        Intent answerIntent = new Intent(getContext(), MainActivity.class);
        answerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        answerIntent.putExtra("dost_action", "answer_call");
        answerIntent.putExtra("dost_call_id", callId);
        PendingIntent answerPendingIntent = PendingIntent.getActivity(getContext(), 3002, answerIntent, flags);

        Intent declineIntent = new Intent(getContext(), MainActivity.class);
        declineIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        declineIntent.putExtra("dost_action", "decline_call");
        declineIntent.putExtra("dost_call_id", callId);
        PendingIntent declinePendingIntent = PendingIntent.getActivity(getContext(), 3003, declineIntent, flags);

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_dost)
            .setColor(Color.parseColor("#0FA958"))
            .setContentTitle(callerName)
            .setContentText(subtitle)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(ringtoneUri)
            .setVibrate(new long[]{0, 800, 400, 800, 400, 800})
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(60000)
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
            .addAction(android.R.drawable.ic_menu_call, "Answer", answerPendingIntent);

        Notification notification = builder.build();
        notification.flags |= Notification.FLAG_INSISTENT;

        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(CALL_NOTIFICATION_ID, notification);
        }
        wakeScreenForCall(fullScreenIntent);
        call.resolve();
    }

    @PluginMethod
    public void cancelCallNotification(PluginCall call) {
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(CALL_NOTIFICATION_ID);
        }
        resetLockScreenFlags();
        call.resolve();
    }

    @SuppressWarnings("deprecation")
    private void wakeScreenForCall(Intent callIntent) {
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                PowerManager.WakeLock screenLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "DOST:IncomingCallWake"
                );
                screenLock.acquire(10000);
            }
        } catch (Exception ignored) {}

        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                        getActivity().setShowWhenLocked(true);
                        getActivity().setTurnScreenOn(true);
                        KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
                        if (km != null) {
                            km.requestDismissKeyguard(getActivity(), null);
                        }
                    }
                    getContext().startActivity(callIntent);
                } catch (Exception ignored) {}
            });
        }
    }

    private void resetLockScreenFlags() {
        if (getActivity() != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().setShowWhenLocked(false);
                    getActivity().setTurnScreenOn(false);
                } catch (Exception ignored) {}
            });
        }
    }

    private JSObject buildStatusObject() {
        JSObject obj = new JSObject();
        boolean notifGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifGranted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        boolean micGranted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        boolean camGranted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        boolean batteryExempt = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            batteryExempt = pm == null || pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        obj.put("notifications", notifGranted);
        obj.put("microphone", micGranted);
        obj.put("camera", camGranted);
        obj.put("batteryUnrestricted", batteryExempt);
        return obj;
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            if (manager.getNotificationChannel(MSG_CHANNEL_ID) == null) {
                NotificationChannel msgChannel = new NotificationChannel(
                    MSG_CHANNEL_ID,
                    "DOST Messages",
                    NotificationManager.IMPORTANCE_HIGH
                );
                msgChannel.setDescription("Heads-up alerts for new incoming DOST messages.");
                msgChannel.enableVibration(true);
                msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                msgChannel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), attrs);
                manager.createNotificationChannel(msgChannel);
            }

            if (manager.getNotificationChannel(CALL_CHANNEL_ID) == null) {
                NotificationChannel callChannel = new NotificationChannel(
                    CALL_CHANNEL_ID,
                    "DOST Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH
                );
                callChannel.setDescription("Full-screen alerts & ringtone for incoming audio/video calls.");
                callChannel.enableVibration(true);
                callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                AudioAttributes ringAttrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                callChannel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), ringAttrs);
                manager.createNotificationChannel(callChannel);
            }
        }
    }
}
