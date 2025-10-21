# AuraVo

EaseUS tarzı siyah ve mor temalı Electron masaüstü ses kayıt uygulaması.

## Özellikler

- Mikrofon seçimi ve anlık olarak cihaz değiştirirken kayıt güvenliği
- WebM, Ogg ve WAV (PCM dönüştürmeli) dahil olmak üzere farklı formatlarda dışa aktarma
- Ayarlanabilir gürültü eşiği (noise gate) ile belirli desibel altındaki sesleri otomatik olarak yok sayma
- Canlı seviye göstergesi ve kapı (gate) devreye girdiğinde görsel uyarı
- Kayıt tamamlandıktan sonra önizleme, süre ve dosya boyutu bilgisi

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
npm start
```

İlk başlatmada uygulama mikrofon erişimi isteyecektir. Ardından:

1. Üst bölümden kullanmak istediğiniz mikrofonu seçin.
2. Çıkış formatını belirleyin (WAV seçildiğinde kayıt otomatik olarak PCM 16-bit'e dönüştürülür).
3. Gürültü eşiği kaydırıcısı ile belirlenen desibel seviyesinin altındaki sesleri kayda dahil etmeyin.
4. "Kaydı Başlat" düğmesi ile kayda başlayın; seviye göstergesi gate devredeyken kırmızıya döner.
5. Kayıt bittiğinde önizleme üzerinden dinleyebilir, "Kaydı Dışa Aktar" ile dilediğiniz konuma kaydedebilirsiniz.

> Sandbox ortamlarında Electron paketini indirirken kısıtlamalar nedeniyle `npm install` komutu hata verebilir. Yerel makinenizde normal koşullarda çalışacaktır.
