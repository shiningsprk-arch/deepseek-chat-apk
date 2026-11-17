package com.shiningsprk.deepseekchat;

import android.Manifest;
import android.content.ContentUris;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * 读取系统相册最近图片，供附件弹层展示缩略图并读取原图。
 * 只在用户打开附件弹层时调用，不做后台扫描。
 */
@CapacitorPlugin(
    name = "RecentMedia",
    permissions = {
        @Permission(alias = "images", strings = { Manifest.permission.READ_MEDIA_IMAGES }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class RecentMediaPlugin extends Plugin {
    private static final int THUMBNAIL_SIZE = 240;

    private boolean hasAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("images") == PermissionState.GRANTED) {
                return true;
            }
            // Android 14 的“仅选择部分照片”会授予这个权限，而不是 READ_MEDIA_IMAGES。
            if (Build.VERSION.SDK_INT >= 34
                && getContext().checkSelfPermission(
                    Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
                ) == PackageManager.PERMISSION_GRANTED) {
                return true;
            }
            return false;
        }
        return getPermissionState("storage") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (hasAccess()) {
            call.resolve();
            return;
        }
        String alias = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "images" : "storage";
        requestPermissionForAlias(alias, call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (hasAccess()) {
            call.resolve();
        } else {
            call.reject("Photo access denied");
        }
    }

    @PluginMethod
    public void list(PluginCall call) {
        JSObject result = new JSObject();
        JSArray items = new JSArray();
        boolean granted = hasAccess();
        result.put("granted", granted);
        if (granted) {
            Integer requested = call.getInt("limit");
            int limit = requested == null ? 12 : Math.max(1, Math.min(requested, 50));
            Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            boolean hasDimensions = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;
            List<String> columns = new ArrayList<>();
            columns.add(MediaStore.Images.Media._ID);
            columns.add(MediaStore.Images.Media.DISPLAY_NAME);
            columns.add(MediaStore.Images.Media.MIME_TYPE);
            columns.add(MediaStore.Images.Media.SIZE);
            if (hasDimensions) {
                columns.add(MediaStore.Images.Media.WIDTH);
                columns.add(MediaStore.Images.Media.HEIGHT);
            }
            String[] projection = columns.toArray(new String[0]);
            String sort = MediaStore.Images.Media.DATE_ADDED + " DESC";
            try (
                Cursor cursor = getContext()
                    .getContentResolver()
                    .query(collection, projection, null, null, sort)
            ) {
                if (cursor != null) {
                    int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                    int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
                    int mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE);
                    int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE);
                    int widthColumn = hasDimensions
                        ? cursor.getColumnIndex(MediaStore.Images.Media.WIDTH)
                        : -1;
                    int heightColumn = hasDimensions
                        ? cursor.getColumnIndex(MediaStore.Images.Media.HEIGHT)
                        : -1;
                    int count = 0;
                    while (cursor.moveToNext() && count < limit) {
                        try {
                            long id = cursor.getLong(idColumn);
                            Uri uri = ContentUris.withAppendedId(collection, id);
                            String thumbnail = loadThumbnail(uri);
                            if (thumbnail == null) {
                                continue;
                            }
                            JSObject item = new JSObject();
                            item.put("id", String.valueOf(id));
                            item.put("name", cursor.getString(nameColumn));
                            item.put("mimeType", cursor.getString(mimeColumn));
                            item.put("width", widthColumn >= 0 ? cursor.getInt(widthColumn) : 0);
                            item.put("height", heightColumn >= 0 ? cursor.getInt(heightColumn) : 0);
                            item.put("size", cursor.getLong(sizeColumn));
                            item.put("thumbnail", "data:image/jpeg;base64," + thumbnail);
                            items.put(item);
                            count++;
                        } catch (Exception ignored) {
                            // 单张图片损坏或不可读时跳过，不影响其余结果。
                        }
                    }
                }
            } catch (SecurityException error) {
                granted = false;
                result.put("granted", false);
                result.put("error", "permission");
            } catch (Exception error) {
                result.put("error", error.getMessage());
            }
        }
        result.put("items", items);
        call.resolve(result);
    }

    @PluginMethod
    public void read(PluginCall call) {
        String id = call.getString("id");
        if (id == null || !hasAccess()) {
            call.reject("Photo access denied");
            return;
        }

        Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        Uri uri;
        try {
            uri = ContentUris.withAppendedId(collection, Long.parseLong(id));
        } catch (NumberFormatException error) {
            call.reject("Invalid photo id");
            return;
        }

        String name = "photo-" + id + ".jpg";
        String mimeType = "image/jpeg";
        try (
            Cursor cursor = getContext()
                .getContentResolver()
                .query(
                    uri,
                    new String[] {
                        MediaStore.Images.Media.DISPLAY_NAME,
                        MediaStore.Images.Media.MIME_TYPE
                    },
                    null,
                    null,
                    null
                )
        ) {
            if (cursor != null && cursor.moveToFirst()) {
                String displayName = cursor.getString(0);
                String mime = cursor.getString(1);
                if (displayName != null && !displayName.isEmpty()) {
                    name = displayName;
                }
                if (mime != null && !mime.isEmpty()) {
                    mimeType = mime;
                }
            }
        } catch (Exception ignored) {
            // 查询元数据失败时仍尝试按默认名称读取。
        }

        String safeName = name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!safeName.contains(".")) {
            safeName += ".jpg";
        }
        File directory = new File(getContext().getCacheDir(), "recent-media");
        if (!directory.exists() && !directory.mkdirs()) {
            call.reject("Cannot create cache directory");
            return;
        }
        File[] cached = directory.listFiles();
        if (cached != null) {
            long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
            for (File item : cached) {
                if (item.isFile() && item.lastModified() < cutoff) {
                    item.delete();
                }
            }
        }
        File file = new File(directory, id + "-" + safeName);

        try (
            InputStream input = getContext().getContentResolver().openInputStream(uri);
            OutputStream output = new FileOutputStream(file)
        ) {
            if (input == null) {
                call.reject("Cannot open photo");
                return;
            }
            byte[] buffer = new byte[8192];
            int length;
            while ((length = input.read(buffer)) != -1) {
                output.write(buffer, 0, length);
            }
        } catch (Exception error) {
            call.reject("Failed to read photo", error);
            return;
        }

        JSObject result = new JSObject();
        result.put("name", safeName);
        result.put("mimeType", mimeType);
        result.put("uri", Uri.fromFile(file).toString());
        call.resolve(result);
    }

    private String loadThumbnail(Uri uri) {
        Bitmap bitmap = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                bitmap = getContext()
                    .getContentResolver()
                    .loadThumbnail(uri, new Size(THUMBNAIL_SIZE, THUMBNAIL_SIZE), null);
            } else {
                long id = ContentUris.parseId(uri);
                bitmap = MediaStore.Images.Thumbnails.getThumbnail(
                    getContext().getContentResolver(),
                    id,
                    MediaStore.Images.Thumbnails.MINI_KIND,
                    null
                );
            }
        } catch (Exception ignored) {
            // 缩略图服务不可用时退回解码原图。
        }
        if (bitmap == null) {
            try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = 4;
                bitmap = BitmapFactory.decodeStream(input, null, options);
            } catch (Exception ignored) {
                return null;
            }
        }
        if (bitmap == null) {
            return null;
        }
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 72, output)) {
                return null;
            }
            return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
        } catch (Exception error) {
            return null;
        } finally {
            if (!bitmap.isRecycled()) {
                bitmap.recycle();
            }
        }
    }
}
