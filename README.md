# 🌐 SUI for sing-box

> **Created by AI. Inspired by YACD, Refined by my Brain.**

  
---

## 🚀 Live Demo

🔗 [Visit the test site](https://sui.page.gd)

---

## ⚠️ Login Issue: Mixed Content

This site is served over **HTTPS**, but the backend API uses **HTTP**.  
Modern browsers like **Chrome** block mixed content by default, which may prevent login functionality.

### ✅ Temporary Workaround (Chrome)

To enable login during testing:

1. Open [https://sui.page.gd](https://sui.page.gd) in Chrome  
2. Click the 🔒 **lock icon** in the address bar  
3. Select **Site settings**  
4. Find **Insecure content**  
5. Set it to **Allow**  
6. Reload the page

You can also directly add this line in Sing-box config file. 
```
{
    "external_controller": "0.0.0.0:9090",
    "external_ui": "ui",
    "external_ui_download_url": "https://github.com/xh116/sui/releases/latest/download/sui.zip",
    "default_mode": "Rule"
}
```

---

## 🔌 Two backend modes

SUI can talk to either API. The mode is detected when you save an address on the setup page (sing-box API first, Clash API as fallback) and is stored in `localStorage.apiMode`; log out and enter another address to switch.

| Mode | Address example | Version shown in sidebar |
|------|-----------------|--------------------------|
| Clash API (REST + WebSocket) | `http://127.0.0.1:9090` | `1.14.3` |
| sing-box API (gRPC-Web, since sing-box 1.14.0) | `http://127.0.0.1:9091` | `sing-box 1.14.3 (api 1)` |

### sing-box API service

sing-box 1.14.0 added the `api` service — gRPC over HTTP/2, which also accepts gRPC-Web so a browser can talk to it directly:

```json
{
  "services": [
    {
      "type": "api",
      "listen": "127.0.0.1",
      "listen_port": 9091,
      "secret": "your-secret",
      "access_control_allow_origin": ["*"],
      "access_control_allow_private_network": true
    }
  ]
}
```

- `secret` is sent as `Authorization: Bearer <secret>` (empty = no auth).
- `access_control_allow_origin` defaults to `*`; required headers (`Content-Type`, `Authorization`, `X-Grpc-Web`, `X-User-Agent`, `Grpc-Timeout`) are already allowed.
- When the dashboard is served from a public origin while the API is on loopback/LAN, browsers treat the call as a private network request: set `access_control_allow_private_network: true` and allow insecure content in Chrome (see above).
- The `api` service does not replace the Clash API (`experimental.clash_api`); run both side by side if you want the Rules page in sing-box API mode.

### Proto codegen

`proto/daemon/started_service.proto` is a verbatim copy of sing-box tag `v1.14.3`. After updating it, regenerate the bindings:

```sh
npm run generate   # buf + protoc-gen-es → src/gen
```

### Known differences in sing-box API mode

- **Rules page is empty**: the API has no rules/provider RPCs and its listener serves no Clash REST routes.
- Group expand state is kept locally (`SetGroupExpand` is not wired).
- Connection speeds and traffic rates are derived in the client from cumulative counters, exactly like in Clash mode.

---

## 📸 Screenshots

| Interface Preview | Rule Group Icons | Mobile View | 
|-------------------|------------------|-------------|
| ![Preview](https://github.com/user-attachments/assets/7aa70e51-ede4-4887-9810-a1778c4e06d9) | ![Icons](https://github.com/user-attachments/assets/f43a0e42-fa9b-4346-9d5d-bd2f285a0312) | ![Mobile](https://github.com/user-attachments/assets/96a4040e-589b-461e-89e1-e433da8d4f55) | 

---

## 🛠 Features

- ✅ Mobile-first layout  
- 🎨 Local icon support for Rule Groups  
- ⚡ Fast and lightweight
- 📉 Traffic insight 
 
 
  
