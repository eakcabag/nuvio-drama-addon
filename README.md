# Nuvio & Stremio Türkçe Dramalar Katalog Eklentisi (Addon)

Bu eklenti, **Nuvio** ve **Stremio** medya oynatıcılarının **Ana Menüsüne (Home Screen)** doğrudan afişleriyle birlikte Türkçe altyazılı Asya & Kore dramalarını getiren katalog eklentisidir.

---

## 🚀 Nuvio Uygulamasına Nasıl Eklenir?

1. Termux'ta eklenti sunucusu çalışırken:
   - **Nuvio** uygulamasını açın.
   - **Ayarlar > Add-ons (Eklentiler)** bölümüne gidin.
   - Aşağıdaki manifest adresini yapıştırıp **Install** deyin:
   ```text
   http://127.0.0.1:7070/manifest.json
   ```
   *(Eğer televizyondan veya farklı bir cihazdan bağlanıyorsanız `127.0.0.1` yerine telefonunuzun yerel Wi-Fi IP adresini yazın: `http://<IP>:7070/manifest.json`)*

---

## 🌟 Özellikler
- **Ana Ekran Kataloğu:** Nuvio ana sayfasında "Türkçe Asya Dramaları" satırı açılır.
- **Canlı Arama:** Arama kutusuna dizi adını yazdığınızda doğrudan DramaDünyam veritabanından sonuçlar gelir.
- **Bölüm Listeleri & Oynatma:** Tüm bölümler liste olarak açılır, 1080p HLS ve Türkçe altyazı ile anında oynatılır.
