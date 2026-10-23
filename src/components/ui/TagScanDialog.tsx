import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { cameraErrorMessage, requestTagCamera } from '../../lib/tagCamera'
import { preloadTagReader, scanTagFromImage, scanTagFromVideo, TAG_FRAME } from '../../lib/tagOcr'
import { Button } from './Button'
import { Input } from './Input'

interface TagScanDialogProps {
  open: boolean
  title?: string
  initialValue?: string
  cameraPromise?: Promise<MediaStream> | null
  onClose: () => void
  onApply: (value: string) => void
}

export function TagScanDialog({
  open,
  title = 'Scan tag',
  initialValue = '',
  cameraPromise = null,
  onClose,
  onApply,
}: TagScanDialogProps) {
  const [scanning, setScanning] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [ocrError, setOcrError] = useState('')
  const [draft, setDraft] = useState(initialValue)
  const [cameraReady, setCameraReady] = useState(false)
  const [retakePromise, setRetakePromise] = useState<Promise<MediaStream> | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cancelled = useRef(false)
  const cameraRequest = useRef(0)
  const activeCamera = retakePromise ?? cameraPromise

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const applyReading = (result: { tag: string; previewUrl: string }) => {
    if (!result.previewUrl) {
      setOcrError('Could not capture image.')
      return
    }
    setPreview(result.previewUrl)
    stopCamera()
    const digits = result.tag.replace(/\D/g, '')
    if (/^\d{2}-\d{4}$/.test(result.tag)) {
      setDraft(result.tag)
    } else if (digits.length >= 3) {
      setDraft(result.tag)
      setOcrError('Check the digits. Part of the handwritten number was unclear.')
    } else {
      setOcrError('Could not read the handwritten numbers. Fill the box, hold steady, and try again, or type the tag.')
    }
  }

  useEffect(() => {
    if (!open) return
    cancelled.current = false
    setDraft(initialValue)
    setPreview(null)
    setOcrError('')
    setScanning(false)
    setCameraReady(false)
    setRetakePromise(null)
  }, [open, initialValue])

  useEffect(() => {
    if (!open || !activeCamera) {
      stopCamera()
      return
    }
    cancelled.current = false
    const request = ++cameraRequest.current
    setCameraReady(false)
    setOcrError('')
    preloadTagReader()
    stopCamera()

    activeCamera
      .then(async (stream) => {
        if (cancelled.current || request !== cameraRequest.current) return
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        const focus = track?.getCapabilities?.() as { focusMode?: string[] } | undefined
        if (track && focus?.focusMode?.includes('continuous')) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
            })
          } catch {
            // Continuous focus is optional; the still frame is still usable.
          }
        }
        const video = videoRef.current
        if (!video || cancelled.current || request !== cameraRequest.current) return
        video.srcObject = stream
        video.muted = true
        if (video.readyState < 2) {
          await new Promise<void>((resolve) => {
            const done = () => {
              video.removeEventListener('loadeddata', done)
              resolve()
            }
            video.addEventListener('loadeddata', done)
            window.setTimeout(done, 2500)
          })
        }
        await video.play().catch(() => undefined)
        if (!cancelled.current && request === cameraRequest.current) setCameraReady(true)
      })
      .catch((error: unknown) => {
        if (!cancelled.current && request === cameraRequest.current) {
          setOcrError(cameraErrorMessage(error))
        }
      })

    return () => {
      cancelled.current = true
      cameraRequest.current += 1
    }
  }, [open, activeCamera, stopCamera])

  if (!open) return null

  const readTag = async (work: () => Promise<{ tag: string; previewUrl: string }>) => {
    setScanning(true)
    setOcrError('')
    try {
      const result = await work()
      if (cancelled.current) return
      applyReading(result)
    } catch (error) {
      if (!cancelled.current) {
        setOcrError(error instanceof Error ? error.message : 'Could not read the tag. Enter the number manually.')
      }
    } finally {
      if (!cancelled.current) setScanning(false)
    }
  }

  const captureAndScan = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setOcrError('Camera not ready. Use Take photo, or try again.')
      return
    }
    void readTag(() => scanTagFromVideo(video))
  }

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void readTag(async () => {
      const bitmap = await createImageBitmap(file)
      try {
        return await scanTagFromImage(bitmap, bitmap.width, bitmap.height)
      } finally {
        bitmap.close()
      }
    })
  }

  const close = () => {
    stopCamera()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-soil-800/60 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-pasture-900">{title}</h3>
            <p className="mt-1 text-sm text-soil-500">
              Fit the handwritten numbers in the box. The tag is year – number, for example 01-1000.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-2 py-1 text-soil-500 hover:bg-field"
            aria-label="Close scanner"
          >
            ✕
          </button>
        </div>

        {!preview ? (
          <div className="relative overflow-hidden rounded-xl border border-field-dark bg-soil-800">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted autoPlay />
            <div
              className="pointer-events-none absolute rounded-lg border-2 border-white shadow-[0_0_0_9999px_rgba(28,25,23,0.55)]"
              style={{
                left: `${TAG_FRAME.left}%`,
                top: `${TAG_FRAME.top}%`,
                width: `${TAG_FRAME.width}%`,
                height: `${TAG_FRAME.height}%`,
              }}
            />
            <p className="pointer-events-none absolute inset-x-3 bottom-2 text-center text-xs font-medium text-white">
              Fit the handwritten numbers in the box
            </p>
          </div>
        ) : (
          <img
            src={preview}
            alt="Captured tag"
            className="w-full rounded-xl border border-field-dark bg-soil-800"
          />
        )}

        {ocrError && (
          <p className="mt-3 rounded-xl bg-barn-100 px-3 py-2 text-sm text-barn-800">{ocrError}</p>
        )}

        <div className="mt-4 space-y-3">
          <Input
            label="Detected tag number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="01-1000"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhoto}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            {!preview ? (
              <>
                <Button type="button" className="w-full" onClick={captureAndScan} disabled={scanning || !cameraReady}>
                  {scanning ? 'Reading numbers...' : 'Capture & read'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                  disabled={scanning}
                >
                  Take photo
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setPreview(null)
                    setOcrError('')
                    setCameraReady(false)
                    setRetakePromise(requestTagCamera())
                  }}
                >
                  Retake
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                  disabled={scanning}
                >
                  Take photo
                </Button>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    onApply(draft.trim())
                    close()
                  }}
                >
                  Use this tag
                </Button>
              </>
            )}
          </div>
          {!preview && !cameraReady && !ocrError && (
            <p className="text-sm text-soil-500">Starting camera... You can also take a photo.</p>
          )}
        </div>
      </div>
    </div>
  )
}
