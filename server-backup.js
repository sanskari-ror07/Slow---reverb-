const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const app = express();
const PORT = 3000;

const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "outputs");

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

const upload = multer({
    dest: uploadDir,
    limits: {
        fileSize: 150 * 1024 * 1024
    }
});

app.use(express.static(path.join(__dirname, "public")));


/* =========================================
   PROCESS SONG
========================================= */

app.post("/process", upload.single("song"), (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            error: "Song file missing"
        });
    }

    const speed = Math.max(
        0.5,
        Math.min(
            1,
            Number(req.body.speed) || 0.70
        )
    );

    const pitch = Math.max(
        -12,
        Math.min(
            12,
            Number(req.body.pitch) || 0
        )
    );

    const reverb = Math.max(
        0,
        Math.min(
            100,
            Number(req.body.reverb) || 50
        )
    );

    const format =
        req.body.format === "wav"
            ? "wav"
            : "mp3";


    /* =====================================
       PITCH CALCULATION
    ===================================== */

    const pitchRatio =
        Math.pow(2, pitch / 12);


    /* =====================================
       CLEAN NATURAL REVERB
       
       Low echo feedback.
       Short delays.
       Keeps original sound clear.
    ===================================== */

    const wet =
        reverb / 100;

    const echo1 =
        (0.025 + wet * 0.055).toFixed(3);

    const echo2 =
        (0.018 + wet * 0.040).toFixed(3);

    const echo3 =
        (0.012 + wet * 0.028).toFixed(3);

    const echo4 =
        (0.008 + wet * 0.018).toFixed(3);


    /* =====================================
       AUDIO FILTER
    ===================================== */

    const filters = [

        // Pitch
        `asetrate=44100*${pitchRatio}`,

        // Restore sample rate
        "aresample=44100",

        // Slow
        `atempo=${speed}`,

        // CLEAN SHORT REVERB
        `aecho=0.96:0.22:35|70|115|170:${echo1}|${echo2}|${echo3}|${echo4}`,

        // Remove unwanted low rumble
        "highpass=f=45",

        // Remove extreme high noise
        "lowpass=f=18000",

        // Stereo output
        "aformat=channel_layouts=stereo",

        // Keep original sound clear
        "volume=1.04"

    ].join(",");


    /* =====================================
       OUTPUT FILE
    ===================================== */

    const outputName =
        `SlowReverb_${Date.now()}.${format}`;

    const outputPath =
        path.join(outputDir, outputName);


    /* =====================================
       FFMPEG ARGUMENTS
    ===================================== */

    let args = [

        "-y",

        "-i",
        req.file.path,

        "-af",
        filters,

        "-ar",
        "44100",

        "-ac",
        "2"

    ];


    /* =====================================
       MP3
    ===================================== */

    if (format === "mp3") {

        args.push(
            "-c:a",
            "libmp3lame",

            "-b:a",
            "192k"
        );

    }


    /* =====================================
       WAV
    ===================================== */

    else {

        args.push(
            "-c:a",
            "pcm_s16le"
        );

    }


    args.push(outputPath);


    console.log("");
    console.log("================================");
    console.log("🎧 SLOWREVERB PROCESSING");
    console.log("================================");
    console.log("Speed  :", speed);
    console.log("Pitch  :", pitch);
    console.log("Reverb :", reverb + "%");
    console.log("Format :", format);
    console.log("================================");
    console.log("");


    /* =====================================
       RUN FFMPEG
    ===================================== */

    execFile(
        "ffmpeg",
        args,
        {
            maxBuffer: 50 * 1024 * 1024
        },

        (error, stdout, stderr) => {

            // Delete uploaded temporary file
            fs.unlink(
                req.file.path,
                () => {}
            );


            if (error) {

                console.error(
                    "FFMPEG ERROR:"
                );

                console.error(stderr);

                return res.status(500).json({
                    error:
                        "Audio processing failed"
                });

            }


            console.log(
                "✅ PROCESSING COMPLETE"
            );


            res.json({

                success: true,

                file:
                    "/download/" +
                    outputName

            });

        }
    );

});


/* =========================================
   DOWNLOAD
========================================= */

app.get(
    "/download/:file",
    (req, res) => {

        const fileName =
            path.basename(
                req.params.file
            );

        const filePath =
            path.join(
                outputDir,
                fileName
            );


        if (!fs.existsSync(filePath)) {

            return res
                .status(404)
                .send(
                    "File not found"
                );

        }


        res.download(
            filePath
        );

    }
);


/* =========================================
   HOME
========================================= */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


/* =========================================
   START SERVER
========================================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "🎧 SlowReverb Studio"
        );

        console.log(
            "🌐 http://localhost:" +
            PORT
        );

        console.log("");

    }
);
