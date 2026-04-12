# Venue-finder

Gerçek zamanlı konum verilerini ve mekansal indeksleme teknolojilerini kullanarak şehri devasa bir strateji oyununa dönüştüren bir keşif platformudur. Proje, yüzlerce eşzamanlı kullanıcının hareketlerini takip ederek, fiziksel mekan ziyaretleri üzerinden bölge hakimiyeti hesaplamaktadır.

## Nasıl Kullanılır

1. Sunucuyu başlatın:
   - `cd server`
   - `npm install`
   - `npm run dev`

2. İstemciyi başlatın:
   - `cd client`
   - `npm install`
   - `npm run dev`

3. Tarayıcınızda `http://localhost:5173` adresini açın.

## Özellikler

- Ana harita görünümü: mekanların harita üzerinde gösterilmesi
- Altıgen ızgara görünümü: H3 tabanlı bölge sahipliğinin görselleştirilmesi
- Giriş ve kayıt sayfaları

## Gereksinimler

- Node.js
- Back-end için `npm install`
- Front-end için `npm install`

## Not

Arka uç sunucusunu çalıştırdıktan sonra ön uç uygulamayı açmayı unutmayın. API istekleri `http://localhost:3000` adresine yönlendirilmektedir.
