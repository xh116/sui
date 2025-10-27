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

## 📸 Screenshots

| Interface Preview | Rule Group Icons | Mobile View | 
|-------------------|------------------|-------------|
| ![Preview](https://github.com/user-attachments/assets/7aa70e51-ede4-4887-9810-a1778c4e06d9) | ![Icons](https://github.com/user-attachments/assets/97754d89-2955-43a4-9105-0624d8c8ee01) | ![Mobile](https://github.com/user-attachments/assets/006bdfa5-9304-4f9d-b7e5-4884b68443de) | 

---

## 🛠 Features

- ✅ Mobile-first layout  
- 🎨 Local icon support for Rule Groups  
- ⚡ Fast and lightweight
- 📉 Traffic insight 
 
 
  
