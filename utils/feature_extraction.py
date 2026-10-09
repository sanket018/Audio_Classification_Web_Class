
import numpy as np
import librosa


def extract_features(file_path, sr=16000):
    """
    Extract 140 audio features from an audio file.
    The feature names and order must match model training.
    """

    # Load audio as mono at 16 kHz
    audio, sr = librosa.load(
        file_path,
        sr=sr,
        mono=True
    )

    if audio.size == 0:
        raise ValueError("The uploaded audio file is empty.")

    # Normalize audio
    audio = audio.astype(np.float32)
    audio = audio / (np.max(np.abs(audio)) + 1e-10)

    features = {}

    # 1. MFCC: 13 coefficients, mean and standard deviation
    mfcc = librosa.feature.mfcc(
        y=audio,
        sr=sr,
        n_mfcc=13
    )

    for i in range(13):
        features[f"mfcc_{i+1}_mean"] = float(np.mean(mfcc[i]))
        features[f"mfcc_{i+1}_std"] = float(np.std(mfcc[i]))

    # 2. Zero Crossing Rate
    zcr = librosa.feature.zero_crossing_rate(y=audio)[0]
    features["zcr_mean"] = float(np.mean(zcr))
    features["zcr_std"] = float(np.std(zcr))

    # 3. Root Mean Square Energy
    rms = librosa.feature.rms(y=audio)[0]
    features["rms_mean"] = float(np.mean(rms))
    features["rms_std"] = float(np.std(rms))

    # 4. Spectral Centroid
    centroid = librosa.feature.spectral_centroid(
        y=audio,
        sr=sr
    )[0]
    features["spectral_centroid_mean"] = float(np.mean(centroid))
    features["spectral_centroid_std"] = float(np.std(centroid))

    # 5. Spectral Bandwidth
    bandwidth = librosa.feature.spectral_bandwidth(
        y=audio,
        sr=sr
    )[0]
    features["spectral_bandwidth_mean"] = float(np.mean(bandwidth))
    features["spectral_bandwidth_std"] = float(np.std(bandwidth))

    # 6. Spectral Rolloff
    rolloff = librosa.feature.spectral_rolloff(
        y=audio,
        sr=sr
    )[0]
    features["spectral_rolloff_mean"] = float(np.mean(rolloff))
    features["spectral_rolloff_std"] = float(np.std(rolloff))

    # 7. Chroma: 12 features, mean and standard deviation
    chroma = librosa.feature.chroma_stft(
        y=audio,
        sr=sr
    )

    for i in range(12):
        features[f"chroma_{i+1}_mean"] = float(np.mean(chroma[i]))
        features[f"chroma_{i+1}_std"] = float(np.std(chroma[i]))

    # 8. Mel Spectrogram: 40 features, mean and standard deviation
    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=sr,
        n_mels=40
    )

    mel_db = librosa.power_to_db(mel, ref=np.max)

    for i in range(40):
        features[f"mel_{i+1}_mean"] = float(np.mean(mel_db[i]))
        features[f"mel_{i+1}_std"] = float(np.std(mel_db[i]))

    return features