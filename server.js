const express = require('express');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for active streams
const streams = {};

app.use(express.json());

// Endpoint to start processing a live video URL
app.post('/process-video', (req, res) => {
  const videoUrl = req.body.url;
  if (!videoUrl) {
    return res.status(400).send('Video URL is required');
  }

  // Generate a unique ID for the stream
  const streamId = crypto.randomBytes(16).toString('hex');

  // Store the FFmpeg process in the streams map
  const ffmpeg = spawn('ffmpeg', [
    '-i', videoUrl,
    '-vn',
    '-acodec', 'aac',
    '-f', 'adts',
    'pipe:1'
  ]);

  streams[streamId] = ffmpeg;

  ffmpeg.stderr.on('data', (data) => {
    console.error(`FFmpeg error: ${data}`);
  });

  ffmpeg.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
    delete streams[streamId]; // Remove stream from the map
  });

  // Send the audio URL
  const audioUrl = `http://${req.headers.host}/audio/${streamId}`;
  res.json({ audioUrl });
});

// Endpoint to serve the audio stream
app.get('/audio/:streamId', (req, res) => {
  const streamId = req.params.streamId;
  const ffmpeg = streams[streamId];

  if (!ffmpeg) {
    return res.status(404).send('Stream not found');
  }

  res.setHeader('Content-Type', 'audio/aac');
  ffmpeg.stdout.pipe(res);

  // Handle client disconnection
  res.on('close', () => {
    if (!res.finished) {
      res.end();
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
