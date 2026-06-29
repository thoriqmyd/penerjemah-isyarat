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
    subtitleText.innerText = "Memuat AI pendoa tangan... Mohon tunggu.";
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: runningMode,
        numHands: 1 // Kita batasi 1 tangan saja dulu agar ringan
    });
    subtitleText.innerText = "AI Siap! Klik 'Aktifkan Kamera'.";
}
buatHandLandmarker(); // Jalankan fungsi load AI di awal

// 2. Fungsi untuk menyalakan Kamera HP/Laptop
startButton.addEventListener('click', async () => {
    if (!handLandmarker) {
        alert("AI belum selesai dimuat, tunggu sebentar ya!");
        return;
    }

    const constraints = {
        video: { facingMode: "user", width: 640, height: 480 } // Menggunakan kamera depan
    };

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
    // Sesuaikan ukuran canvas dengan ukuran video asli
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        
        // Mulai deteksi tangan dari video
        const hasil = handLandmarker.detectForVideo(video, startTimeMs);

        // Bersihkan canvas setiap frame baru
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Jika ada tangan yang terdeteksi
        if (hasil.landmarks && hasil.landmarks.length > 0) {
            const titikTangan = hasil.landmarks[0]; // Ambil data tangan pertama

            // Gambar titik-titik tangan di layar agar kita tahu AI bekerja
            gambarTitikTangan(titikTangan);

            // Terjemahkan posisi titik tangan menjadi kata
            logikaPenerjemah(titikTangan);
        } else {
            subtitleText.innerText = "Tangan tidak terlihat...";
        }
    }
    // Jalankan terus fungsi ini di frame berikutnya
    requestAnimationFrame(prediksiLoop);
}

// 4. Aturan Logika Sederhana untuk Menerjemahkan Gestur
function logikaPenerjemah(titik) {
    // Kita gunakan titik nomor 12 (Ujung Jari Tengah) dan titik nomor 0 (Pergelangan Tangan)
    // Di MediaPipe, makin ke bawah layar, nilai koordinat Y justru makin besar.
    const ujungJariTengahY = titik[12].y;
    const pergelanganTanganY = titik[0].y;
    const pangkalJariTengahY = titik[9].y; // Buku jari tengah

    let hasilTeks = "...";

    // KONDISI 1: Telapak Tangan Terbuka (Halo)
    // Jika ujung jari tengah berada JAUH di atas pergelangan tangan (Y ujung jari lebih kecil dari Y pangkal jari)
    if (ujungJariTengahY < pangkalJariTengahY) {
        hasilTeks = "Halo";
    } 
    // KONDISI 2: Kepalan Tangan (Selesai)
    // Jika ujung jari tengah menekuk ke bawah melewati pangkal jarinya sendiri
    else if (ujungJariTengahY > pangkalJariTengahY) {
        hasilTeks = "Selesai";
    }

    // Tampilkan hasil di teks subtitle
    subtitleText.innerText = hasilTeks;

    // Panggil fungsi suara (Text-to-Speech)
    bicara(hasilTeks);
}

// 5. Fitur Mengubah Teks Menjadi Suara (Web Speech API)
function bicara(teks) {
    // Cek apakah kata yang dideteksi berbeda dengan kata sebelumnya
    // dan pastikan bukan teks kosong/titik-titik agar HP tidak berisik terus-menerus
    if (teks !== terakhirBicara && teks !== "..." && teks !== "Tangan tidak terlihat...") {
        terakhirBicara = teks;

        // Buat objek suara baru
        const pesanSuara = new SpeechSynthesisUtterance(teks);
        pesanSuara.lang = "id-ID"; // Set bahasa ke Bahasa Indonesia
        
        // Perintahkan browser untuk berbicara
        window.speechSynthesis.speak(pesanSuara);
    }
}

// 6. Fungsi Sederhana untuk Menggambar Titik Tangan di Canvas
function gambarTitikTangan(titik) {
    canvasCtx.fillStyle = "#00FF00"; // Warna hijau untuk titik
    for (const koordinat of titik) {
        const x = koordinat.x * canvasElement.width;
        const y = koordinat.y * canvasElement.height;
        
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}
