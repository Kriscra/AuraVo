# AuraVo Recorder

AuraVo Recorder, Electron tabanlı minimalist bir masaüstü ses kayıt uygulamasıdır. Gürültü kapısı, gürültü bekletme (gate hold), format seçimi ve kayıt arşivi yönetimi gibi sistem odaklı özellikleri sunar.

## Özellikler

- **Gürültü kapısı ve bekletme:** Desibel eşiğini ve bekletme süresini ayarlayarak arka plan gürültüsünü filtreleyin veya kapıyı tamamen devre dışı bırakın.
- **Mikrofon seçimi:** Bağlı tüm mikrofonları listeler, yenileme seçeneği ile dinamik güncelleme sağlar.
- **Format çeşitliliği:** WAV (PCM), WebM/Opus, Ogg/Opus ve (destekliyorsa) MP3 formatlarında kayıt alma.
- **Gerçek zamanlı seviye ölçer:** Anlık desibel değerini ve kapı durumunu gösteren görsel geribildirim.
- **Kayıt arşivi:** Uygulama içinde kayıtları saklama, yeniden adlandırma, not ekleme, silme ve dışa aktarma işlemleri.
- **Dosya içe aktarma:** Harici ses dosyalarını kütüphaneye ekleyip çalabilme.

## Kurulum

> Not: Bu depo, Electron ikili paketine erişimin kısıtlı olduğu bir ortamda oluşturuldu. `npm install` komutu Electron'u indiremediğinde hata verebilir.

1. Bağımlılıkları yükleyin:

   ```bash
   npm install
   ```

2. Uygulamayı başlatın:

   ```bash
   npm start
   ```

## Kullanım

1. **Dosya adı ve formatı** belirleyin.
2. Kullanmak istediğiniz **mikrofonu** seçin ve gerekirse listeyi yenileyin.
3. **Gürültü eşiği** ve **bekletme** değerlerini ayarlayın.
4. Kapıyı tamamen devre dışı bırakmak için "Daimi kayıt" seçeneğini işaretleyin.
5. "Kaydı Başlat" ile kayıt sürecini başlatın. Kapı durumunu ve seviye çubuğunu takip edin.
6. "Kaydı Bitir" ile kaydı tamamlayın; kayıt otomatik olarak arşive eklenir.
7. Arşiv üzerinden kayıtları dinleyebilir, yeniden adlandırabilir, not ekleyebilir veya "Dışa aktar" ile farklı bir konuma kaydedebilirsiniz.
8. "Kayıt Arşivine Dosya Ekle" butonu ile mevcut bir ses dosyasını içe aktarabilirsiniz.

## Format desteği hakkında

- WebM ve Ogg seçenekleri tarayıcının/Chromium'un yerel MediaRecorder desteğine dayanır.
- MP3 formatı, MediaRecorder tarafından desteklendiği ortamlarda etkinleşir. Destek yoksa açılır listede görünmez.
- WAV formatı her ortamda kullanılabilir ve 16-bit PCM olarak dışa aktarılır.

## Lisans

MIT
