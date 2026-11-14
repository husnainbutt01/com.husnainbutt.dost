package com.husnainbutt.dost;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class DostCallActionReceiver extends BroadcastReceiver {
    public static final String ACTION_DECLINE_CALL = "com.husnainbutt.dost.ACTION_DECLINE_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (ACTION_DECLINE_CALL.equals(intent.getAction())) {
            String callId = intent.getStringExtra("dost_call_id");
            DostNativePlugin.handleDeclineFromReceiver(context, callId);
        }
    }
}
