// 0. Mengambil fungsi penting dari bungkus besar MediaPipe (mpVision)
const FilesetResolver = mpVision.FilesetResolver;
const HandLandmarker = mpVision.HandLandmarker;

// Ambil elemen-elemen HTML yang kita butuhkan
const video = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const subtitleText = document.getElementById('subtitle');
const startButton = document.getElementById('startButton');

let handLandmarker = undefined;
let runningMode = "VIDEO";
let terakhirBicara = ""; // Untuk mencatat kata terakhir agar tidak diucapkan berulang-ulang

// 1. Fungsi untuk me-load AI MediaPipe Hand Landmarker
async function buatHandLandmarker() {
    subtitleText.innerText = "Memuat AI pendeteksi tangan... Mohon tunggu.";
    
    // Menyiapkan pelacak file dari CDN Google
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );
    
    // Membuat objek detektor tangan dengan konfigurasi khusus
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU" // Menggunakan kartu grafis HP agar deteksi lancar dan cepat
        },
        runningMode: runningMode,
        numHands: 1 // Kita batasi 1 tangan saja dulu agar tidak berat di HP
    });
    
    // Teks ini akan muncul jika download AI di latar belakang sudah selesai
    subtitleText.innerText = "AI Siap! Klik 'Aktifkan Kamera'.";
}
buatHandLandmarker(); // Jalankan fungsi load AI di awal halaman dibuka

// 2. Fungsi untuk menyalakan Kamera HP/Laptop
startButton.addEventListener('click', async () => {
    // Jika tombol diklik sebelum AI selesai dimuat, tampilkan peringatan
    if (!handLandmarker) {
        alert("AI belum selesai dimuat, tunggu sebentar ya!");
        return;
    }

    // Pengaturan kamera: gunakan kamera depan (user)
    const constraints = {
        video: { facingMode: "user", width: 640, height: 480 }
    };

    // Meminta izin membuka kamera ke sistem HP
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", prediksiLoop);
        startButton.style.display = "none"; // Sembunyikan tombol setelah kamera aktif
    }).catch((err) => {
        console.error("Gagal akses kamera: ", err);
        alert("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
    });
});

// 3. Loop Prediksi (Akan berjalan terus menerus mendeteksi video)
let lastVideoTime = -1;
async function prediksiLoop() {
    // Sesuaikan ukuran canvas dengan ukuran video asli biar posisi titik pas
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    let startTimeMs = performance.now();
    
    // Hanya mendeteksi jika ada frame video baru yang berjalan
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        
        // Mulai deteksi tangan dari frame video saat ini
        const hasil = handLandmarker.detectForVideo(video, startTimeMs);

        // Bersihkan gambar titik yang lama di canvas sebelum menggambar yang baru
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Jika ada tangan yang terdeteksi oleh AI Google
        if (hasil.landmarks && hasil.landmarks.length > 0) {
            const titikTangan = hasil.landmarks[0]; // Ambil data koordinat tangan pertama

            // Gambar titik-titik tangan di layar agar kita tahu AI bekerja
            gambarTitikTangan(titikTangan);

            // Jalankan rumus logika penerjemah berdasarkan titik tangan
            logikaPenerjemah(titikTangan);
        } else {
            subtitleText.innerText = "Tangan tidak terlihat...";
        }
    }
    // Panggil fungsi ini terus-menerus mengikuti kelancaran layar (frame rate)
    requestAnimationFrame(prediksiLoop);
}

// 4. Aturan Logika Sederhana untuk Menerjemahkan Gestur
function logikaPenerjemah(titik) {
    // MediaPipe mendeteksi 21 titik (0 sampai 20).
    // Koordinat Y makin ke bawah layar nilainya makin BESAR, makin ke atas makin KECIL.
    const ujungJariTengahY = titik[12].y;
    const pangkalJariTengahY = titik[9].y; // Buku jari tengah

    let hasilTeks = "...";

    // KONDISI 1: Telapak Tangan Terbuka (Halo)
    // Jika ujung jari tengah berada di ATAS pangkal jarinya sendiri (nilai Y-nya lebih kecil)
    if (ujungJariTengahY < pangkalJariTengahY) {
        hasilTeks = "Halo";
    } 
    // KONDISI 2: Kepalan Tangan (Selesai)
    // Jika ujung jari tengah menekuk ke BAWAH melewati pangkal jarinya (nilai Y-nya lebih besar)
    else if (ujungJariTengahY > pangkalJariTengahY) {
        hasilTeks = "Selesai";
    }

    // Tampilkan hasil teks di kotak subtitle web
    subtitleText.innerText = hasilTeks;

    // Panggil fungsi suara (Text-to-Speech)
    bicara(hasilTeks);
}

// 5. Fitur Mengubah Teks Menjadi Suara (Web Speech API)
function bicara(teks) {
    // Cek agar HP hanya bersuara SEKALI jika kata berganti (biar tidak berisik berulang-ulang)
    if (teks !== terakhirBicara && teks !== "..." && teks !== "Tangan tidak terlihat...") {
        terakhirBicara = teks;

        // Buat objek suara baru di browser
        const pesanSuara = new SpeechSynthesisUtterance(teks);
        pesanSuara.lang = "id-ID"; // Menggunakan suara aksen Bahasa Indonesia
        
        // Perintahkan browser untuk membacakan teksnya keras-keras
        window.speechSynthesis.speak(pesanSuara);
    }
}

// 6. Fungsi Sederhana untuk Menggambar Titik Tangan di Atas Video
function gambarTitikTangan(titik) {
    canvasCtx.fillStyle = "#00FF00"; // Warna hijau terang untuk titik koordinat
    for (const koordinat of titik) {
        // Ubah skala koordinat (0.0 sampai 1.0) dari MediaPipe ke ukuran pixel canvas asli
        const x = koordinat.x * canvasElement.width;
        const y = koordinat.y * canvasElement.height;
        
        // Gambar lingkaran kecil hijau di setiap titik
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}
