package com.bytetobrain.fiscalfocus;

import android.Manifest;
import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "SmsInbox",
    permissions = { @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS }) }
)
public class SmsInboxPlugin extends Plugin {
    private final Executor executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void hasPermission(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        requestPermissionForAlias("sms", call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        String state;
        switch (getPermissionState("sms")) {
            case GRANTED:
                state = "granted";
                break;
            case DENIED:
                state = "denied";
                break;
            default:
                state = "prompt";
                break;
        }

        JSObject result = new JSObject();
        result.put("state", state);
        call.resolve(result);
    }

    @PluginMethod
    public void readInbox(PluginCall call) {
        Long sinceMs = call.getLong("sinceMs");
        if (sinceMs == null) {
            call.reject("sinceMs is required");
            return;
        }

        // Check permission before attempting query
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("PERMISSION_DENIED", "READ_SMS permission not granted");
            return;
        }

        // Run query on background thread to avoid blocking main thread
        executor.execute(() -> {
            try {
                JSArray messages = queryInbox(sinceMs);
                
                // Resolve on main thread
                getActivity().runOnUiThread(() -> {
                    JSObject result = new JSObject();
                    result.put("messages", messages);
                    call.resolve(result);
                });
            } catch (SecurityException e) {
                getActivity().runOnUiThread(() -> {
                    call.reject("PERMISSION_DENIED", "SecurityException: " + e.getMessage());
                });
            } catch (Exception e) {
                getActivity().runOnUiThread(() -> {
                    call.reject("QUERY_FAILED", "Failed to query SMS inbox: " + e.getMessage());
                });
            }
        });
    }

    private JSArray queryInbox(long sinceMs) {
        JSArray messages = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();
        Uri inboxUri = Telephony.Sms.Inbox.CONTENT_URI;
        
        String[] projection = { "_id", "address", "body", "date" };
        String selection = "date >= ?";
        String[] selectionArgs = { String.valueOf(sinceMs) };
        String sortOrder = "date DESC";

        Cursor cursor = null;
        try {
            cursor = resolver.query(inboxUri, projection, selection, selectionArgs, sortOrder);
            
            if (cursor != null) {
                int idIndex = cursor.getColumnIndexOrThrow("_id");
                int addressIndex = cursor.getColumnIndexOrThrow("address");
                int bodyIndex = cursor.getColumnIndexOrThrow("body");
                int dateIndex = cursor.getColumnIndexOrThrow("date");

                while (cursor.moveToNext()) {
                    JSObject message = new JSObject();
                    message.put("id", cursor.getString(idIndex));
                    message.put("sender", cursor.getString(addressIndex));
                    message.put("body", cursor.getString(bodyIndex));
                    message.put("timestamp", cursor.getLong(dateIndex));
                    messages.put(message);
                }
            }
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }

        return messages;
    }
}
