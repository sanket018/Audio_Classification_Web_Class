
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    const audioInput = document.getElementById("audio");
    const audioForm = document.getElementById("audioForm");
    const uploadBtn = document.getElementById("uploadBtn");
    const fileName = document.getElementById("fileName");

    const recordStatus = document.getElementById("recordStatus");
    const recordingVisual = document.getElementById("recordingVisual");
    const timerDisplay = document.getElementById("timer");
    const recordingPreview = document.getElementById("recordingPreview");
    const audioPreview = document.getElementById("audioPreview");
    const predictRecordingBtn = document.getElementById("predictRecordingBtn");

    let mediaRecorder = null;
    let mediaStream = null;
    let audioChunks = [];
    let recordedBlob = null;
    let previewUrl = null;
    let timerInterval = null;
    let secondsElapsed = 0;
    let isRecording = false;

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(remainingSeconds).padStart(2, "0")
        );
    }

    function stopTimer() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function releaseMicrophone() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
    }

    function resetPreviewUrl() {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
    }

    // Select an audio file from the computer.
    audioInput.addEventListener("change", () => {
        recordedBlob = null;
        recordingPreview.hidden = true;

        if (audioInput.files.length > 0) {
            const file = audioInput.files[0];

            fileName.textContent = file.name;
            uploadBtn.disabled = false;
            predictRecordingBtn.disabled = true;
            recordStatus.textContent = "Audio file selected";
        } else {
            fileName.textContent = "No file selected";
            uploadBtn.disabled = true;
        }
    });

    // Start microphone recording.
    startBtn.addEventListener("click", async () => {
        if (!navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === "undefined") {
            alert(
                "Your browser does not support audio recording. " +
                "Please use an updated Chrome or Edge browser."
            );
            return;
        }

        if (isRecording) {
            return;
        }

        try {
            startBtn.disabled = true;
            recordStatus.textContent = "Requesting microphone access...";

            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            let mimeType = "";

            if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
                mimeType = "audio/webm;codecs=opus";
            } else if (MediaRecorder.isTypeSupported("audio/webm")) {
                mimeType = "audio/webm";
            } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
                mimeType = "audio/ogg;codecs=opus";
            }

            const options = mimeType ? { mimeType } : {};
            mediaRecorder = new MediaRecorder(mediaStream, options);

            audioChunks = [];
            recordedBlob = null;
            secondsElapsed = 0;

            audioInput.value = "";
            uploadBtn.disabled = true;
            fileName.textContent = "No file selected";
            recordingPreview.hidden = true;

            resetPreviewUrl();

            mediaRecorder.addEventListener("dataavailable", event => {
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            });

            mediaRecorder.addEventListener("stop", () => {
                stopTimer();
                releaseMicrophone();

                isRecording = false;
                recordingVisual.classList.remove("is-recording");
                startBtn.disabled = false;
                stopBtn.disabled = true;

                const actualType =
                    mediaRecorder.mimeType || "audio/webm";

                recordedBlob = new Blob(audioChunks, {
                    type: actualType
                });

                if (recordedBlob.size === 0) {
                    recordStatus.textContent = "No audio captured";
                    alert("No audio was captured. Please try again.");
                    return;
                }

                const extension = actualType.includes("ogg")
                    ? "ogg"
                    : "webm";

                const recordedFile = new File(
                    [recordedBlob],
                    `voice_recording.${extension}`,
                    { type: actualType }
                );

                const transfer = new DataTransfer();
                transfer.items.add(recordedFile);
                audioInput.files = transfer.files;

                fileName.textContent = recordedFile.name;
                previewUrl = URL.createObjectURL(recordedBlob);
                audioPreview.src = previewUrl;

                recordingPreview.hidden = false;
                predictRecordingBtn.disabled = false;
                uploadBtn.disabled = false;
                recordStatus.textContent = "Recording ready to classify";
            });

            mediaRecorder.start();
            isRecording = true;

            recordingVisual.classList.add("is-recording");
            recordStatus.textContent = "Recording in progress...";
            timerDisplay.textContent = "00:00";

            startBtn.disabled = true;
            stopBtn.disabled = false;

            timerInterval = setInterval(() => {
                secondsElapsed += 1;
                timerDisplay.textContent = formatTime(secondsElapsed);

                // Automatically stop after 60 seconds.
                if (secondsElapsed >= 60 && mediaRecorder?.state === "recording") {
                    mediaRecorder.stop();
                }
            }, 1000);

        } catch (error) {
            console.error("Microphone error:", error);

            stopTimer();
            releaseMicrophone();

            isRecording = false;
            recordingVisual.classList.remove("is-recording");
            startBtn.disabled = false;
            stopBtn.disabled = true;
            recordStatus.textContent = "Microphone unavailable";

            alert(
                "Could not access your microphone. Allow microphone " +
                "permission in your browser and try again."
            );
        }
    });

    // Stop the current recording.
    stopBtn.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            recordStatus.textContent = "Preparing recording...";
            mediaRecorder.stop();
        }
    });

    // Submit the recorded audio to Flask for prediction.
    predictRecordingBtn.addEventListener("click", () => {
        if (!recordedBlob || recordedBlob.size === 0) {
            alert("Please record your voice first.");
            return;
        }

        if (!audioInput.files || audioInput.files.length === 0) {
            alert("The recording is not ready. Please record again.");
            return;
        }

        audioForm.requestSubmit(uploadBtn);
    });

    // Show a processing state while Flask predicts.
    audioForm.addEventListener("submit", event => {
        if (!audioInput.files || audioInput.files.length === 0) {
            event.preventDefault();
            alert("Please record or select an audio file first.");
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Processing audio...";

        predictRecordingBtn.disabled = true;
        startBtn.disabled = true;
        stopBtn.disabled = true;
    });

    // Release the microphone if the page is being left.
    window.addEventListener("pagehide", () => {
        stopTimer();
        releaseMicrophone();
        resetPreviewUrl();
    });
});