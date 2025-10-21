# AuraVo

EaseUS tarzı siyah ve mor temalı Electron masaüstü ses kayıt uygulaması.

## Özellikler

- Mikrofon seçimi ve tek tıkla cihaz listesini yenileme
- WebM, Ogg ve WAV (PCM dönüştürmeli) formatlarında otomatik dışa aktarma
- Noise gate için eşik (dB) ve bekletme süresi (ms) ayarlayarak sessiz anları filtreleme
- Geri sayım ile kayıt başlangıcını planlama, isteğe bağlı otomatik sessizlik kırpma
- Canlı seviye göstergesi, gerçek zamanlı dalga formu ve gate durumuna göre görsel geri bildirim
- Her kayıt için süre, boyut, zaman damgası, not ve favori işaretiyle arşiv yönetimi
- Kayıt arşivinde hızlı yeniden adlandırma, favoriye alma, dışa aktarma ve silme
- Klavye kısayolları: Space (başlat/durdur), Ctrl/Cmd+S (kaydet), Delete (seçili kaydı kaldır)

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
npm start
```

İlk başlatmada uygulama mikrofon erişimi isteyecektir. Ardından:

1. Sol panelden mikrofonu seçin veya **Yenile** ile cihaz listesini güncelleyin.
2. Çıkış formatını belirleyin ve noise gate için eşik ile bekletme sürelerini ayarlayın.
3. Geri sayım ve otomatik sessizlik kırpma seçeneklerini ihtiyaçlarınıza göre açıp kapatın.
4. "Kaydı Başlat" düğmesine basın; dalga formu ve seviye göstergesi kayıt sürecini canlı gösterir.
5. Kayıt tamamlandığında sağ panelden önizleme, not ekleme, favoriye alma veya arşive kaydetme işlemlerini yapın.
6. Arşivdeki herhangi bir kaydı yeniden adlandırabilir, hızlıca dışa aktarabilir veya silerek yönetebilirsiniz.

> Sandbox ortamlarında Electron paketini indirirken kısıtlamalar nedeniyle `npm install` komutu hata verebilir. Yerel makinenizde normal koşullarda çalışacaktır.
