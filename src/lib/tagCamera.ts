/** Call this inside the tap that opens the scanner. Phones ignore a later request. */
export function requestTagCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error('This browser cannot open the live camera. Use Take photo.'))
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  })
}

export function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
    return 'Camera permission was blocked. Allow the camera, or use Take photo.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No camera was found. Use Take photo instead.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'The camera did not open. Use Take photo instead.'
}
