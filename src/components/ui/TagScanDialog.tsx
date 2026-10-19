import { useCallback, useEffect, useRef, useState } from 'react'
import { preloadTagReader, scanTagFromVideo, TAG_FRAME } from '../../lib/tagOcr'
import { Button } from './Button'
import { Input } from './Input'

interface TagScanDialogProps {
  open: boolean
  title?: string
  initialValue?: string
  onClose: () => void
  onApply: (value: string) => void
}

export function TagScanDialog({
  open,
  title = 'Scan tag',
  initialValue = '',
  onClose,
  onApply,
}: TagScanDialogProps) {
  const [scanning, setScanning] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [ocrError, setOcrError] = useState('')
  const [draft, setDraft] = useState(initialValue)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cancelled = useRef(false)
  const cameraRequest = useRef(0)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startCamera = useCallback(async () => {
    const request = ++cameraRequest.current
    setOcrError('')
    stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      if (cancelled.current || request !== cameraRequest.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
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
      if (request !== cameraRequest.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      if (!cancelled.current && request === cameraRequest.current) {
        setOcrError('Camera access denied or unavailable. Enter the tag manually.')
      }
    }
  }, [stopCamera])

  useEffect(() => {
    if (!open) return
    cancelled.current = false
    setDraft(initialValue)
    setPreview(null)
    setOcrError('')
    setScanning(false)
    preloadTagReader()
    startCamera()
    return () => {
      cancelled.current = true
      cameraRequest.current += 1
      stopCamera()
    }
  }, [open, initialValue, startCamera, stopCamera])

  if (!open) return null

  const captureAndScan = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setOcrError('Camera not ready. Try again or enter manually.')
      return
    }

    setScanning(true)
    setOcrError('')

    try {
      const result = await scanTagFromVideo(video)
      if (cancelled.current) return
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
    } catch {
      if (!cancelled.current) setOcrError('Could not read the tag. Enter the number manually.')
    } finally {
      if (!cancelled.current) setScanning(false)
    }
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
          <div className="flex flex-col gap-2 sm:flex-row">
            {!preview ? (
              <Button type="button" className="w-full" onClick={captureAndScan} disabled={scanning}>
                {scanning ? 'Reading numbers...' : 'Capture & read'}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setPreview(null)
                    setOcrError('')
                    startCamera()
                  }}
                >
                  Retake photo
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
        </div>
      </div>
    </div>
  )
}
