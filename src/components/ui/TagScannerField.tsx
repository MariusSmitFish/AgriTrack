import { useCallback, useEffect, useRef, useState } from 'react'
import { createWorker } from 'tesseract.js'
import { Button } from './Button'
import { Input } from './Input'
import { extractTagFromOcr } from '../../lib/animals'

interface TagScannerFieldProps {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  id?: string
}

export function TagScannerField({ label, hint, value, onChange, id }: TagScannerFieldProps) {
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [ocrError, setOcrError] = useState('')
  const [draft, setDraft] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setOcrError('')
    stopCamera()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setOcrError('Camera access denied or unavailable. Enter the tag manually.')
    }
  }, [stopCamera])

  const openScanner = () => {
    setDraft(value)
    setPreview(null)
    setOcrError('')
    setOpen(true)
  }

  const closeScanner = () => {
    stopCamera()
    setOpen(false)
    setPreview(null)
    setScanning(false)
  }

  useEffect(() => {
    if (open) {
      startCamera()
    }
    return () => stopCamera()
  }, [open, startCamera, stopCamera])

  const captureAndScan = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setOcrError('Camera not ready. Try again or enter manually.')
      return
    }

    setScanning(true)
    setOcrError('')

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setScanning(false)
      setOcrError('Could not capture image.')
      return
    }

    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setPreview(dataUrl)
    stopCamera()

    try {
      const worker = await createWorker('eng')
      const { data } = await worker.recognize(dataUrl)
      await worker.terminate()

      const extracted = extractTagFromOcr(data.text)
      if (extracted) {
        setDraft(extracted)
      } else {
        setOcrError('No tag number detected. Adjust the photo or type it in.')
      }
    } catch {
      setOcrError('Could not read the tag. Enter the number manually.')
    } finally {
      setScanning(false)
    }
  }

  const applyTag = () => {
    onChange(draft.trim())
    closeScanner()
  }

  return (
    <>
      <div className="space-y-2">
        <Input
          id={id}
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Optional"
        />
        {hint && <p className="text-xs text-soil-500">{hint}</p>}
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={openScanner}>
          Scan with camera
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-soil-800/60 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold text-pasture-900">Scan {label}</h3>
                <p className="mt-1 text-sm text-soil-500">
                  Point the camera at the ear tag. Hold steady and tap capture.
                </p>
              </div>
              <button
                type="button"
                onClick={closeScanner}
                className="rounded-lg px-2 py-1 text-soil-500 hover:bg-field"
                aria-label="Close scanner"
              >
                ✕
              </button>
            </div>

            {!preview ? (
              <div className="overflow-hidden rounded-xl border border-field-dark bg-soil-800">
                <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
              </div>
            ) : (
              <img src={preview} alt="Captured tag" className="aspect-[4/3] w-full rounded-xl border border-field-dark object-cover" />
            )}

            {ocrError && (
              <p className="mt-3 rounded-xl bg-barn-100 px-3 py-2 text-sm text-barn-800">{ocrError}</p>
            )}

            <div className="mt-4 space-y-3">
              <Input
                label="Detected tag number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Edit if needed"
              />

              <div className="flex flex-col gap-2 sm:flex-row">
                {!preview ? (
                  <Button type="button" className="w-full" onClick={captureAndScan} disabled={scanning}>
                    {scanning ? 'Reading tag...' : 'Capture & read'}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        setPreview(null)
                        startCamera()
                      }}
                    >
                      Retake photo
                    </Button>
                    <Button type="button" className="w-full" onClick={applyTag}>
                      Use this tag
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
