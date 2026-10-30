import * as faceapi from '@vladmandic/face-api';

let modelsLoadPromise: Promise<void> | null = null;
let modelsReady = false;

const MODEL_BASE_URL = '/models';

export async function ensureFaceRecognitionModels(): Promise<void> {
  if (modelsReady) return;
  if (modelsLoadPromise) return modelsLoadPromise;

  modelsLoadPromise = (async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_BASE_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE_URL),
      ]);
      modelsReady = true;
    } catch (err) {
      modelsLoadPromise = null;
      modelsReady = false;
      throw new Error(
        `Failed to load facial recognition models: ${
          err instanceof Error ? err.message : 'Model weights unavailable'
        }`
      );
    }
  })();

  return modelsLoadPromise;
}

export async function requestUserCameraStream(): Promise<MediaStream> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    throw new Error(
      'Camera API is unavailable in this browser or embedded preview environment. Open the application in a browser context with HTTPS camera access.'
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
  } catch (err) {
    const domErr = err as DOMException;
    if (domErr?.name === 'NotAllowedError' || domErr?.name === 'PermissionDeniedError') {
      throw new Error(
        'Camera permission was denied. Please allow camera access in your browser address bar settings (or check iframe camera permissions) and retry.'
      );
    }
    if (domErr?.name === 'NotFoundError' || domErr?.name === 'DevicesNotFoundError') {
      throw new Error(
        'No camera device was detected on this system. Connect a webcam or open on a mobile device with a front camera.'
      );
    }
    if (domErr?.name === 'NotReadableError' || domErr?.name === 'TrackStartError') {
      throw new Error(
        'The camera is currently in use by another application or tab. Close other camera apps and retry.'
      );
    }
    throw new Error(
      domErr?.message || 'Unable to start the device camera. Please check camera permissions and retry.'
    );
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore cleanup error
    }
  });
}

export async function detectLiveFace(
  videoEl: HTMLVideoElement
): Promise<{ detected: boolean; score: number }> {
  if (
    !videoEl ||
    videoEl.readyState < 2 ||
    videoEl.videoWidth === 0 ||
    videoEl.videoHeight === 0
  ) {
    return { detected: false, score: 0 };
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.6,
  });

  const detection = await faceapi.detectSingleFace(videoEl, options);
  if (!detection) {
    return { detected: false, score: 0 };
  }

  // Require the face bounding box to be reasonably sized (not tiny background noise)
  const minFaceWidth = videoEl.videoWidth * 0.16;
  if (detection.box.width < minFaceWidth) {
    return { detected: false, score: detection.score };
  }

  return { detected: true, score: detection.score };
}

export async function extractFaceDescriptorFromVideo(
  videoEl: HTMLVideoElement
): Promise<{ descriptor: number[]; score: number } | null> {
  if (
    !videoEl ||
    videoEl.readyState < 2 ||
    videoEl.videoWidth === 0 ||
    videoEl.videoHeight === 0
  ) {
    return null;
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.6,
  });

  const result = await faceapi
    .detectSingleFace(videoEl, options)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!result || !result.descriptor || result.descriptor.length !== 128) {
    return null;
  }

  const minFaceWidth = videoEl.videoWidth * 0.16;
  if (result.detection.box.width < minFaceWidth) {
    return null;
  }

  return {
    descriptor: Array.from(result.descriptor),
    score: result.detection.score,
  };
}

export function averageFaceDescriptors(samples: number[][]): number[] {
  const avg = new Array<number>(128).fill(0);
  if (samples.length === 0) return avg;

  for (const vec of samples) {
    for (let i = 0; i < 128; i++) {
      avg[i] += vec[i];
    }
  }
  for (let i = 0; i < 128; i++) {
    avg[i] /= samples.length;
  }
  return avg;
}
