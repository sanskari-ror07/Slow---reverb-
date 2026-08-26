const fileInput = document.getElementById("fileInput");
const audio = document.getElementById("audio");
const status = document.getElementById("status");

const speed = document.getElementById("speed");
const pitch = document.getElementById("pitch");
const reverb = document.getElementById("reverb");

const speedValue = document.getElementById("speedValue");
const pitchValue = document.getElementById("pitchValue");
const reverbValue = document.getElementById("reverbValue");

let currentFile = null;
let audioContext = null;
let source = null;
let dryGain = null;
let wetGain = null;
let convolver = null;

function createReverb(ctx) {
  const seconds = 2.5;
  const length = ctx.sampleRate * seconds;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);

    for (let i = 0; i < length; i++) {
      data[i] =
        (Math.random() * 2 - 1) *
        Math.pow(1 - i / length, 2.5);
    }
  }

  return impulse;
}

async function setupAudio() {
  if (audioContext) return;

  audioContext = new AudioContext();

  source = audioContext.createMediaElementSource(audio);

  dryGain = audioContext.createGain();
  wetGain = audioContext.createGain();
  convolver = audioContext.createConvolver();

  convolver.buffer = createReverb(audioContext);

  source.connect(dryGain);
  source.connect(convolver);

  convolver.connect(wetGain);

  dryGain.connect(audioContext.destination);
  wetGain.connect(audioContext.destination);

  updateReverb();
}

function updateReverb() {
  if (!dryGain || !wetGain) return;

  const amount = Number(reverb.value) / 100;

  wetGain.gain.value = amount;
  dryGain.gain.value = 1 - amount * 0.45;
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];

  if (!file) return;

  currentFile = file;

  document.getElementById("fileName").textContent =
    file.name;

  audio.src = URL.createObjectURL(file);

  audio.playbackRate = Number(speed.value);

  await setupAudio();

  status.textContent = "✓ Song ready";
});

speed.addEventListener("input", () => {
  speedValue.textContent =
    Number(speed.value).toFixed(2) + "x";

  audio.playbackRate =
    Number(speed.value);
});

pitch.addEventListener("input", () => {
  pitchValue.textContent =
    pitch.value + " semitones";
});

reverb.addEventListener("input", () => {
  reverbValue.textContent =
    reverb.value + "%";

  updateReverb();
});

document.getElementById("playBtn").addEventListener(
  "click",
  async () => {

    if (!currentFile) {
      status.textContent =
        "⚠️ Pehle song import karo";
      return;
    }

    await setupAudio();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (audio.paused) {

      await audio.play();

      document.getElementById("playBtn").textContent =
        "⏸ Pause";

      document.querySelectorAll(".bar").forEach(bar => {
        bar.style.animationPlayState = "running";
      });

      status.textContent =
        "🎧 Playing preview...";

    } else {

      audio.pause();

      document.getElementById("playBtn").textContent =
        "▶ Preview";

      document.querySelectorAll(".bar").forEach(bar => {
        bar.style.animationPlayState = "paused";
      });
    }
  }
);

audio.addEventListener("ended", () => {

  document.getElementById("playBtn").textContent =
    "▶ Preview";

  document.querySelectorAll(".bar").forEach(bar => {
    bar.style.animationPlayState = "paused";
  });
});

document.getElementById("downloadBtn").addEventListener(
  "click",
  async () => {

    if (!currentFile) {
      status.textContent =
        "⚠️ Pehle song import karo";
      return;
    }

    try {

      status.textContent =
        "⏳ Processing song...";

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
        throw new Error(
          data.error || "Processing failed"
        );
      }

      status.textContent =
        "✅ Processing complete! Download starting...";

      const link = document.createElement("a");

      link.href = data.file;
      link.download = "SlowReverb.mp3";

      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (error) {

      console.error(error);

      status.textContent =
        "❌ Processing failed: " +
        error.message;
    }
  }
);
