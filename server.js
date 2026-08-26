const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const app = express();
const PORT = 3000;

const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "outputs");
const impulseDir = path.join(__dirname, "impulses");

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(impulseDir, { recursive: true });

const upload = multer({
    dest: uploadDir,
    limits: {
        fileSize: 150 * 1024 * 1024
    }
});

app.use(express.static(path.join(__dirname, "public")));


/* =========================================
   CREATE SMALL ROOM IMPULSE RESPONSE
========================================= */

function createImpulseResponse() {

    const file = path.join(
        impulseDir,
        "room.wav"
    );

    if (fs.existsSync(file)) {
        return file;
    }

    /*
     * Create a short stereo room impulse.
     * 1.8 seconds gives ambience without
     * creating a long obvious echo.
     */

    const args = [
        "-y",

        "-f",
        "lavfi",

        "-i",
        "anoisesrc=color=white:sample_rate=44100:duration=1.8",

        "-af",
        "afade=t=in:st=0:d=0.005,afade=t=out:st=0.45:d=1.35,volume=0.20",

        "-ar",
        "44100",

        "-ac",
        "2",

        "-c:a",
        "pcm_s16le",

        file
    ];

    try {

        require("child_process").execFileSync(
            "ffmpeg",
            args,
            {
                stdio: "ignore"
            }
        );

    } catch (error) {

        console.log(
            "Could not create impulse response."
        );

        return null;
    }

    return file;
}


/* =========================================
   PROCESS AUDIO
========================================= */

app.post(
    "/process",
    upload.single("song"),
    (req, res) => {

        if (!req.file) {

            return res.status(400).json({
                error: "Song file missing"
            });

        }

        const speed = Math.max(
            0.50,
            Math.min(
                1.00,
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
           PITCH
        ===================================== */

        const pitchRatio =
            Math.pow(2, pitch / 12);


        /* =====================================
           ROOM REVERB AMOUNT
        ===================================== */

        const wet =
            reverb / 100;

        const dry =
            1.0 - (wet * 0.12);

        const wetLevel =
            wet * 0.55;


        /* =====================================
           INPUT / OUTPUT
        ===================================== */

        const inputFile =
            req.file.path;

        const outputName =
            "SlowReverb_" +
            Date.now() +
            "." +
            format;

        const outputFile =
            path.join(
                outputDir,
                outputName
            );


        /*
         * Create impulse response.
         */

        const impulse =
            createImpulseResponse();


        if (!impulse) {

            fs.unlink(
                inputFile,
                () => {}
            );

            return res.status(500).json({
                error:
                    "Could not create reverb engine"
            });

        }


        /* =====================================
           FILTER GRAPH
        ===================================== */

        const filterComplex = [

            `[0:a]` +

            `asetrate=44100*${pitchRatio},` +

            `aresample=44100,` +

            `atempo=${speed},` +

            `highpass=f=45,` +

            `lowpass=f=18000` +

            `[dry]`,

            `[dry]` +

            `asplit=2[original][reverbInput]`,

            `[reverbInput][1:a]` +

            `afir=dry=0:wet=${wetLevel.toFixed(3)}` +

            `[wet]`,

            `[original]` +

            `volume=${dry.toFixed(3)}` +

            `[dryLevel]`,

            `[dryLevel][wet]` +

            `amix=inputs=2:duration=first:normalize=0,` +

            `loudnorm=I=-14:TP=-1.5:LRA=11` +

            `[out]`

        ].join(";");


        /* =====================================
           FFMPEG
        ===================================== */

        let args = [

            "-y",

            "-i",
            inputFile,

            "-i",
            impulse,

            "-filter_complex",
            filterComplex,

            "-map",
            "[out]",

            "-ar",
            "44100",

            "-ac",
            "2"
        ];


        if (format === "wav") {

            args.push(
                "-c:a",
                "pcm_s16le"
            );

        } else {

            args.push(
                "-c:a",
                "libmp3lame",

                "-b:a",
                "192k"
            );

        }


        args.push(
            outputFile
        );


        console.log("");
        console.log(
            "🎧 NATURAL REVERB PROCESSING"
        );
        console.log(
            "Speed  :",
            speed
        );
        console.log(
            "Pitch  :",
            pitch
        );
        console.log(
            "Reverb :",
            reverb + "%"
        );
        console.log(
            "Format :",
            format
        );
        console.log("");


        execFile(
            "ffmpeg",
            args,
            {
                maxBuffer:
                    50 * 1024 * 1024
            },

            (error, stdout, stderr) => {

                fs.unlink(
                    inputFile,
                    () => {}
                );


                if (error) {

                    console.error(
                        stderr
                    );

                    return res.status(500).json({
                        error:
                            "Audio processing failed"
                    });

                }


                console.log(
                    "✅ NATURAL REVERB COMPLETE"
                );


                res.json({

                    success: true,

                    file:
                        "/download/" +
                        outputName

                });

            }
        );

    }
);


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
   START
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
