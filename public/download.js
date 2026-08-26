const downloadBtn = document.getElementById("downloadBtn");

downloadBtn.addEventListener("click", async () => {

    if (!currentFile) {
        status.textContent = "⚠️ Pehle song import karo";
        return;
    }

    try {

        downloadBtn.disabled = true;
        downloadBtn.textContent = "⏳ Processing...";

        const formData = new FormData();

        formData.append("song", currentFile);
        formData.append("speed", speed.value);
        formData.append("pitch", pitch.value);
        formData.append("reverb", reverb.value);

        const response = await fetch("/process", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Processing failed");
        }

        status.textContent = "✅ Song ready! Downloading...";

        const link = document.createElement("a");
        link.href = data.file;
        link.download = "SlowReverb.mp3";

        document.body.appendChild(link);
        link.click();
        link.remove();

    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ Error: " + error.message;

    } finally {

        downloadBtn.disabled = false;
        downloadBtn.textContent = "⬇ Download";
    }

});
