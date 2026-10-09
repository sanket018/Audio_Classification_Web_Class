
from flask import Flask, render_template, request
from werkzeug.utils import secure_filename
import os
import uuid
import joblib
import pandas as pd

from utils.feature_extraction import extract_features

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024

# Load trained model
MODEL_PATH = os.path.join(
    "model",
    "final_audio_classification_model.pkl"
)

package = joblib.load(MODEL_PATH)
model = package["model"]
scaler = package["scaler"]
feature_columns = package["feature_columns"]
class_names = package["class_names"]
sample_rate = package["sample_rate"]

ALLOWED_EXTENSIONS = {".wav", ".ogg", ".mp3", ".m4a", ".webm"}

print("Model loaded successfully!")
print("Features:", len(feature_columns))
print("Classes:", len(class_names))


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    if "audio" not in request.files:
        return render_template(
            "index.html",
            error="Please record your voice or choose an audio file."
        )

    audio_file = request.files["audio"]

    if not audio_file.filename:
        return render_template(
            "index.html",
            error="Please select or record an audio file."
        )

    original_name = secure_filename(audio_file.filename)
    extension = os.path.splitext(original_name)[1].lower()

    if extension not in ALLOWED_EXTENSIONS:
        return render_template(
            "index.html",
            error="Unsupported audio format. Please use WAV, OGG, MP3, M4A, or WEBM."
        )

    filename = f"{uuid.uuid4().hex}{extension}"
    file_path = os.path.join(UPLOAD_FOLDER, filename)

    try:
        audio_file.save(file_path)

        # Extract features using the existing feature extractor
        features = extract_features(file_path, sr=sample_rate)
        features_df = pd.DataFrame([features])

        missing = [
            col for col in feature_columns
            if col not in features_df.columns
        ]

        if missing:
            raise ValueError(
                f"Feature mismatch: {len(missing)} model features are missing."
            )

        features_df = features_df[feature_columns]
        scaled_features = scaler.transform(features_df)

        prediction = str(model.predict(scaled_features)[0])

        confidence = None
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(scaled_features)[0]
            confidence = round(float(max(probabilities) * 100), 2)

        return render_template(
            "index.html",
            prediction=prediction,
            confidence=confidence
        )

    except Exception:
        app.logger.exception("Audio prediction failed")
        return render_template(
            "index.html",
            error=(
                "Could not process this recording. Try a clear recording "
                "or upload a WAV file. See the VS Code terminal for details."
            )
        )

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@app.errorhandler(413)
def file_too_large(error):
    return render_template(
        "index.html",
        error="The audio file is too large. Maximum size is 25 MB."
    ), 413


if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )