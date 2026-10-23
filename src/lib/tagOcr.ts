import { createWorker, OEM, PSM } from 'tesseract.js'
import { extractTagFromOcr } from './animals'

/** Viewfinder rectangle, as percentages of the camera preview. */
export const TAG_FRAME = {
  left: 7,
  top: 31,
  width: 86,
  height: 38,
} as const

interface Glyph {
  pixels: number[]
  minX: number
  minY: number
  maxX: number
  maxY: number
  area: number
}

interface Reading {
  tag: string
  confidence: number
}

let readerPromise: ReturnType<typeof createWorker> | null = null

function getReader() {
  if (!readerPromise) {
    const pending = createWorker('eng', OEM.LSTM_ONLY, undefined, {
      load_system_dawg: '0',
      load_freq_dawg: '0',
      load_unambig_dawg: '0',
      load_punc_dawg: '0',
      load_number_dawg: '0',
      load_bigram_dawg: '0',
    }).then(async (worker) => {
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789-',
        user_defined_dpi: '300',
        tessedit_enable_dict_correction: '0',
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      })
      return worker
    })
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('The number reader did not start. Check your connection and try again.')),
        20000,
      )
    })
    readerPromise = Promise.race([pending, timeout]).catch((error: unknown) => {
      readerPromise = null
      throw error
    })
  }
  return readerPromise
}

/** Start loading the digit reader while the camera opens. */
export function preloadTagReader() {
  void getReader()
}

function scoreReading(tag: string, confidence: number) {
  if (/^\d{2}-\d{4}$/.test(tag)) return confidence + 100
  if (/^\d{2}-\d{3,4}$/.test(tag)) return confidence + 40
  if (/^\d{1,2}-\d{2,4}$/.test(tag)) return confidence + 15
  return 0
}

function luminance(image: ImageData) {
  const { data } = image
  const gray = new Uint8Array(image.width * image.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8
  }
  return gray
}

function stretchContrast(gray: Uint8Array) {
  const hist = new Uint32Array(256)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  const lowTarget = gray.length * 0.02
  const highTarget = gray.length * 0.02
  let seen = 0
  let low = 0
  for (; low < 255; low++) {
    seen += hist[low]
    if (seen >= lowTarget) break
  }
  seen = 0
  let high = 255
  for (; high > 0; high--) {
    seen += hist[high]
    if (seen >= highTarget) break
  }
  if (high <= low + 8) return gray
  const scale = 255 / (high - low)
  const out = new Uint8Array(gray.length)
  for (let i = 0; i < gray.length; i++) {
    const value = Math.round((gray[i] - low) * scale)
    out[i] = value < 0 ? 0 : value > 255 ? 255 : value
  }
  return out
}

function boxBlur(src: Uint8Array, width: number, height: number) {
  const horizontal = new Uint8Array(src.length)
  const out = new Uint8Array(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let offset = -1; offset <= 1; offset++) {
        const sampleX = Math.min(width - 1, Math.max(0, x + offset))
        sum += src[y * width + sampleX]
      }
      horizontal[y * width + x] = (sum / 3) | 0
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let offset = -1; offset <= 1; offset++) {
        const sampleY = Math.min(height - 1, Math.max(0, y + offset))
        sum += horizontal[sampleY * width + x]
      }
      out[y * width + x] = (sum / 3) | 0
    }
  }
  return out
}

function sharpen(gray: Uint8Array, width: number, height: number) {
  const blur = boxBlur(gray, width, height)
  const out = new Uint8Array(gray.length)
  for (let i = 0; i < gray.length; i++) {
    const value = gray[i] + (gray[i] - blur[i]) * 0.9
    out[i] = value < 0 ? 0 : value > 255 ? 255 : value
  }
  return out
}

/** Local threshold so marker strokes survive glare and shadow on a plastic tag. */
function adaptiveThreshold(gray: Uint8Array, width: number, height: number) {
  const radius = Math.max(15, Math.round(height / 10))
  const bias = 8
  const stride = width + 1
  const integral = new Float64Array(stride * (height + 1))
  for (let y = 1; y <= height; y++) {
    let rowSum = 0
    for (let x = 1; x <= width; x++) {
      rowSum += gray[(y - 1) * width + (x - 1)]
      integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum
    }
  }
  const out = new Uint8Array(gray.length)
  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - radius)
    const y2 = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - radius)
      const x2 = Math.min(width - 1, x + radius)
      const count = (x2 - x1 + 1) * (y2 - y1 + 1)
      const sum =
        integral[(y2 + 1) * stride + (x2 + 1)] -
        integral[y1 * stride + (x2 + 1)] -
        integral[(y2 + 1) * stride + x1] +
        integral[y1 * stride + x1]
      out[y * width + x] = gray[y * width + x] < sum / count - bias ? 0 : 255
    }
  }
  return out
}

function darkRatio(bin: Uint8Array) {
  let dark = 0
  for (let i = 0; i < bin.length; i++) if (bin[i] === 0) dark++
  return dark / bin.length
}

function invert(bin: Uint8Array) {
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin[i] === 0 ? 255 : 0
  return out
}

function dilateInk(bin: Uint8Array, width: number, height: number) {
  const out = bin.slice()
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x
      if (bin[index] === 0) continue
      if (
        bin[index - 1] === 0 ||
        bin[index + 1] === 0 ||
        bin[index - width] === 0 ||
        bin[index + width] === 0
      ) {
        out[index] = 0
      }
    }
  }
  return out
}

function erodeInk(bin: Uint8Array, width: number, height: number) {
  const out = bin.slice()
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x
      if (bin[index] !== 0) continue
      if (
        bin[index - 1] !== 0 ||
        bin[index + 1] !== 0 ||
        bin[index - width] !== 0 ||
        bin[index + width] !== 0
      ) {
        out[index] = 255
      }
    }
  }
  return out
}

function removeSpecks(bin: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(bin.length)
  const stack: number[] = []
  for (let start = 0; start < bin.length; start++) {
    if (bin[start] !== 0 || seen[start]) continue
    stack.push(start)
    seen[start] = 1
    const pixels: number[] = []
    while (stack.length > 0) {
      const point = stack.pop() as number
      pixels.push(point)
      const x = point % width
      const y = (point - x) / width
      for (let dy = -1; dy <= 1; dy++) {
        const nextY = y + dy
        if (nextY < 0 || nextY >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nextX = x + dx
          if (nextX < 0 || nextX >= width) continue
          const next = nextY * width + nextX
          if (bin[next] === 0 && !seen[next]) {
            seen[next] = 1
            stack.push(next)
          }
        }
      }
    }
    if (pixels.length < 18) {
      for (const point of pixels) bin[point] = 255
    }
  }
}

function removeRuleLines(bin: Uint8Array, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    let run = 0
    let longest = 0
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (bin[row + x] === 0) {
        run++
        if (run > longest) longest = run
      } else {
        run = 0
      }
    }
    if (longest > width * 0.45) {
      for (let x = 0; x < width; x++) bin[row + x] = 255
    }
  }
  for (let x = 0; x < width; x++) {
    let run = 0
    let longest = 0
    for (let y = 0; y < height; y++) {
      if (bin[y * width + x] === 0) {
        run++
        if (run > longest) longest = run
      } else {
        run = 0
      }
    }
    if (longest > height * 0.72) {
      for (let y = 0; y < height; y++) bin[y * width + x] = 255
    }
  }
}

function inkBounds(bin: Uint8Array, width: number, height: number) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bin[y * width + x] !== 0) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null
  return { minX, minY, maxX, maxY }
}

function cropBinary(bin: Uint8Array, width: number, height: number, margin: number) {
  const bounds = inkBounds(bin, width, height)
  if (!bounds) return { pixels: bin, width, height, minX: 0, minY: 0 }
  const minX = Math.max(0, bounds.minX - margin)
  const minY = Math.max(0, bounds.minY - margin)
  const maxX = Math.min(width - 1, bounds.maxX + margin)
  const maxY = Math.min(height - 1, bounds.maxY + margin)
  const cropW = maxX - minX + 1
  const cropH = maxY - minY + 1
  const pixels = new Uint8Array(cropW * cropH)
  pixels.fill(255)
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      pixels[y * cropW + x] = bin[(y + minY) * width + (x + minX)]
    }
  }
  return { pixels, width: cropW, height: cropH, minX, minY }
}

function paint(pixels: Uint8Array, width: number, height: number, pad: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width + pad * 2
  canvas.height = height + pad * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const image = ctx.createImageData(width, height)
  for (let i = 0, p = 0; i < pixels.length; i++, p += 4) {
    const value = pixels[i]
    image.data[p] = value
    image.data[p + 1] = value
    image.data[p + 2] = value
    image.data[p + 3] = 255
  }
  ctx.putImageData(image, pad, pad)
  return canvas
}

function scaleBinary(pixels: Uint8Array, width: number, height: number, targetHeight: number) {
  if (height < 8 || targetHeight === height) return { pixels, width, height }
  const scale = targetHeight / height
  const nextW = Math.max(1, Math.round(width * scale))
  const nextH = Math.max(1, Math.round(height * scale))
  const out = new Uint8Array(nextW * nextH)
  out.fill(255)
  for (let y = 0; y < nextH; y++) {
    const srcY = Math.min(height - 1, Math.floor(y / scale))
    for (let x = 0; x < nextW; x++) {
      const srcX = Math.min(width - 1, Math.floor(x / scale))
      out[y * nextW + x] = pixels[srcY * width + srcX]
    }
  }
  return { pixels: out, width: nextW, height: nextH }
}

function cropColor(
  source: HTMLCanvasElement,
  minX: number,
  minY: number,
  cropW: number,
  cropH: number,
  destW: number,
  destH: number,
) {
  const pad = 24
  const canvas = document.createElement('canvas')
  canvas.width = destW + pad * 2
  canvas.height = destH + pad * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return source
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = destH < cropH
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, minX, minY, cropW, cropH, pad, pad, destW, destH)
  return canvas
}

function visibleCrop(video: HTMLVideoElement) {
  const frameWidth = video.videoWidth
  const frameHeight = video.videoHeight
  const elementWidth = video.clientWidth || frameWidth
  const elementHeight = video.clientHeight || frameHeight
  const frameAspect = frameWidth / frameHeight
  const elementAspect = elementWidth / elementHeight
  let sourceX = 0
  let sourceY = 0
  let sourceWidth = frameWidth
  let sourceHeight = frameHeight
  if (frameAspect > elementAspect) {
    sourceWidth = frameHeight * elementAspect
    sourceX = (frameWidth - sourceWidth) / 2
  } else if (frameAspect < elementAspect) {
    sourceHeight = frameWidth / elementAspect
    sourceY = (frameHeight - sourceHeight) / 2
  }
  const x = sourceX + sourceWidth * (TAG_FRAME.left / 100)
  const y = sourceY + sourceHeight * (TAG_FRAME.top / 100)
  const w = sourceWidth * (TAG_FRAME.width / 100)
  const h = sourceHeight * (TAG_FRAME.height / 100)
  const left = Math.max(0, Math.min(frameWidth - 1, x))
  const top = Math.max(0, Math.min(frameHeight - 1, y))
  return {
    x: left,
    y: top,
    w: Math.max(1, Math.min(frameWidth - left, w)),
    h: Math.max(1, Math.min(frameHeight - top, h)),
  }
}

function prepareFrames(
  source: CanvasImageSource,
  crop: { x: number; y: number; w: number; h: number },
) {
  const targetHeight = 300
  const scale = targetHeight / crop.h
  const width = Math.max(1, Math.round(crop.w * scale))
  const height = Math.max(1, Math.round(crop.h * scale))
  const color = document.createElement('canvas')
  color.width = width
  color.height = height
  const ctx = color.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = scale < 1
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height)

  const gray = sharpen(stretchContrast(luminance(ctx.getImageData(0, 0, width, height))), width, height)
  let binary = adaptiveThreshold(gray, width, height)
  if (darkRatio(binary) > 0.55) binary = invert(binary)
  binary = erodeInk(dilateInk(binary, width, height), width, height)
  removeSpecks(binary, width, height)
  removeRuleLines(binary, width, height)
  const cropped = cropBinary(binary, width, height, 14)
  const inkHeight = cropped.height > 190 ? 160 : cropped.height < 72 ? 120 : cropped.height
  const scaled = scaleBinary(cropped.pixels, cropped.width, cropped.height, inkHeight)
  const thick = dilateInk(scaled.pixels, scaled.width, scaled.height)

  return {
    previewUrl: color.toDataURL('image/jpeg', 0.9),
    width: scaled.width,
    height: scaled.height,
    binary: scaled.pixels,
    binaryCanvas: paint(scaled.pixels, scaled.width, scaled.height, 24),
    colorCanvas: cropColor(color, cropped.minX, cropped.minY, cropped.width, cropped.height, scaled.width, scaled.height),
    thickCanvas: paint(thick, scaled.width, scaled.height, 24),
  }
}

function glyphFromPixels(pixels: number[], width: number): Glyph {
  let minX = width
  let minY = Number.POSITIVE_INFINITY
  let maxX = 0
  let maxY = 0
  for (const point of pixels) {
    const x = point % width
    const y = (point - x) / width
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { pixels, minX, minY, maxX, maxY, area: pixels.length }
}

function findGlyphs(bin: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(bin.length)
  const stack: number[] = []
  const glyphs: Glyph[] = []
  for (let start = 0; start < bin.length; start++) {
    if (bin[start] !== 0 || seen[start]) continue
    stack.push(start)
    seen[start] = 1
    const pixels: number[] = []
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    while (stack.length > 0) {
      const point = stack.pop() as number
      pixels.push(point)
      const x = point % width
      const y = (point - x) / width
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      for (let dy = -1; dy <= 1; dy++) {
        const nextY = y + dy
        if (nextY < 0 || nextY >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nextX = x + dx
          if (nextX < 0 || nextX >= width) continue
          const next = nextY * width + nextX
          if (bin[next] === 0 && !seen[next]) {
            seen[next] = 1
            stack.push(next)
          }
        }
      }
    }
    const glyphWidth = maxX - minX + 1
    const glyphHeight = maxY - minY + 1
    if (pixels.length < 18) continue
    if (pixels.length > width * height * 0.35) continue
    if (glyphWidth > width * 0.9 && glyphHeight > height * 0.9) continue
    glyphs.push({ pixels, minX, minY, maxX, maxY, area: pixels.length })
  }
  return glyphs
}

function percentileHeight(glyphs: Glyph[], percentile: number) {
  if (glyphs.length === 0) return 1
  const heights = glyphs.map((glyph) => glyph.maxY - glyph.minY + 1).sort((a, b) => a - b)
  const index = Math.min(heights.length - 1, Math.max(0, Math.round((heights.length - 1) * percentile)))
  return heights[index] || 1
}

function shouldMerge(left: Glyph, right: Glyph, digitHeight: number) {
  const gap = right.minX - left.maxX - 1
  const overlap = Math.min(left.maxX, right.maxX) - Math.max(left.minX, right.minX) + 1
  const narrower = Math.min(left.maxX - left.minX, right.maxX - right.minX) + 1
  if (overlap > narrower * 0.4) return true
  if (gap < 0) return false
  const shorter = Math.min(left.maxY - left.minY, right.maxY - right.minY) + 1
  return gap < digitHeight * 0.16 && shorter < digitHeight * 0.5
}

function mergeFragments(glyphs: Glyph[], digitHeight: number) {
  const sorted = [...glyphs].sort((a, b) => a.minX - b.minX || a.minY - b.minY)
  const merged: Glyph[] = []
  for (const glyph of sorted) {
    const previous = merged[merged.length - 1]
    if (previous && shouldMerge(previous, glyph, digitHeight)) {
      merged[merged.length - 1] = {
        pixels: previous.pixels.concat(glyph.pixels),
        minX: Math.min(previous.minX, glyph.minX),
        minY: Math.min(previous.minY, glyph.minY),
        maxX: Math.max(previous.maxX, glyph.maxX),
        maxY: Math.max(previous.maxY, glyph.maxY),
        area: previous.area + glyph.area,
      }
    } else {
      merged.push(glyph)
    }
  }
  return merged
}

function splitWideGlyph(glyph: Glyph, width: number, digitHeight: number) {
  const glyphWidth = glyph.maxX - glyph.minX + 1
  const glyphHeight = glyph.maxY - glyph.minY + 1
  if (glyphWidth < digitHeight * 1.25 || glyphHeight < digitHeight * 0.55) return [glyph]
  const start = glyph.minX + Math.floor(glyphWidth * 0.3)
  const end = glyph.maxX - Math.floor(glyphWidth * 0.3)
  if (end <= start) return [glyph]
  const counts = new Map<number, number>()
  for (const point of glyph.pixels) {
    const x = point % width
    if (x < start || x > end) continue
    counts.set(x, (counts.get(x) ?? 0) + 1)
  }
  let valleyX = start
  let valleyCount = Number.POSITIVE_INFINITY
  for (let x = start; x <= end; x++) {
    const count = counts.get(x) ?? 0
    if (count < valleyCount) {
      valleyCount = count
      valleyX = x
    }
  }
  if (valleyCount > Math.max(2, Math.round(glyphHeight * 0.04))) return [glyph]
  const left: number[] = []
  const right: number[] = []
  for (const point of glyph.pixels) {
    if (point % width <= valleyX) left.push(point)
    else right.push(point)
  }
  if (left.length < 12 || right.length < 12) return [glyph]
  return [glyphFromPixels(left, width), glyphFromPixels(right, width)]
}

function isHyphen(glyph: Glyph, digitHeight: number, lineCenter: number) {
  const glyphWidth = glyph.maxX - glyph.minX + 1
  const glyphHeight = glyph.maxY - glyph.minY + 1
  const center = (glyph.minY + glyph.maxY) / 2
  return (
    glyphHeight < digitHeight * 0.42 &&
    glyphWidth > glyphHeight * 1.3 &&
    Math.abs(center - lineCenter) < digitHeight * 0.35
  )
}

function glyphCanvas(glyph: Glyph, sourceWidth: number) {
  const glyphWidth = glyph.maxX - glyph.minX + 1
  const glyphHeight = Math.max(1, glyph.maxY - glyph.minY + 1)
  const scale = 96 / glyphHeight
  const pad = 18
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(glyphWidth * scale) + pad * 2)
  canvas.height = Math.round(glyphHeight * scale) + pad * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(canvas.width, canvas.height)
  image.data.fill(255)
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255
  for (const point of glyph.pixels) {
    const x = (point % sourceWidth) - glyph.minX
    const y = Math.floor(point / sourceWidth) - glyph.minY
    const destX = pad + Math.floor(x * scale)
    const destY = pad + Math.floor(y * scale)
    const destW = Math.max(1, Math.ceil(scale))
    const destH = Math.max(1, Math.ceil(scale))
    for (let py = 0; py < destH; py++) {
      for (let px = 0; px < destW; px++) {
        const drawX = destX + px
        const drawY = destY + py
        if (drawX < 0 || drawY < 0 || drawX >= canvas.width || drawY >= canvas.height) continue
        const offset = (drawY * canvas.width + drawX) * 4
        image.data[offset] = 0
        image.data[offset + 1] = 0
        image.data[offset + 2] = 0
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function segmentGlyphs(bin: Uint8Array, width: number, height: number) {
  const raw = findGlyphs(bin, width, height)
  const digitHeight = percentileHeight(raw, 0.7)
  const kept = raw.filter((glyph) => {
    const glyphWidth = glyph.maxX - glyph.minX + 1
    const glyphHeight = glyph.maxY - glyph.minY + 1
    if (glyphWidth > width * 0.85) return false
    return glyphHeight >= digitHeight * 0.18 || glyphWidth >= digitHeight * 0.35
  })
  const merged = mergeFragments(kept, digitHeight).flatMap((glyph) => splitWideGlyph(glyph, width, digitHeight))
  const digitCenters = merged
    .filter((glyph) => glyph.maxY - glyph.minY + 1 >= digitHeight * 0.6)
    .map((glyph) => (glyph.minY + glyph.maxY) / 2)
    .sort((a, b) => a - b)
  const lineCenter =
    digitCenters.length > 0 ? digitCenters[Math.floor(digitCenters.length / 2)] : height / 2
  return { glyphs: merged, digitHeight, lineCenter }
}

async function readGlyphs(
  worker: Awaited<ReturnType<typeof createWorker>>,
  bin: Uint8Array,
  width: number,
  height: number,
): Promise<Reading> {
  const { glyphs, digitHeight, lineCenter } = segmentGlyphs(bin, width, height)
  if (glyphs.length < 4 || glyphs.length > 10) return { tag: '', confidence: 0 }
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_CHAR,
    tessedit_char_whitelist: '0123456789',
    user_defined_dpi: '300',
    tessedit_enable_dict_correction: '0',
  })
  const chars: string[] = []
  let confidenceSum = 0
  let samples = 0
  for (const glyph of glyphs) {
    if (isHyphen(glyph, digitHeight, lineCenter)) {
      chars.push('-')
      confidenceSum += 75
      samples++
      continue
    }
    const { data } = await worker.recognize(glyphCanvas(glyph, width))
    const digit = (data.text ?? '').replace(/\D/g, '').charAt(0)
    if (!digit) return { tag: '', confidence: 0 }
    chars.push(digit)
    confidenceSum += data.confidence ?? 0
    samples++
  }
  const tag = extractTagFromOcr(chars.join(''))
  return { tag, confidence: samples > 0 ? confidenceSum / samples : 0 }
}

async function readLine(
  worker: Awaited<ReturnType<typeof createWorker>>,
  image: HTMLCanvasElement,
  mode: PSM,
): Promise<Reading> {
  await worker.setParameters({
    tessedit_pageseg_mode: mode,
    tessedit_char_whitelist: '0123456789-',
    user_defined_dpi: '300',
    tessedit_enable_dict_correction: '0',
  })
  try {
    const { data } = await worker.recognize(image)
    return { tag: extractTagFromOcr(data.text ?? ''), confidence: data.confidence ?? 0 }
  } catch {
    return { tag: '', confidence: 0 }
  }
}

function consider(best: Reading, next: Reading) {
  if (scoreReading(next.tag, next.confidence) > scoreReading(best.tag, best.confidence)) return next
  return best
}

async function readPreparedFrames(frames: NonNullable<ReturnType<typeof prepareFrames>>) {
  const worker = await getReader()
  let best = await readGlyphs(worker, frames.binary, frames.width, frames.height)
  if (scoreReading(best.tag, best.confidence) < 170) {
    best = consider(best, await readLine(worker, frames.binaryCanvas, PSM.SINGLE_LINE))
  }
  if (scoreReading(best.tag, best.confidence) < 150) {
    best = consider(best, await readLine(worker, frames.colorCanvas, PSM.SINGLE_LINE))
  }
  if (scoreReading(best.tag, best.confidence) < 120) {
    best = consider(best, await readLine(worker, frames.thickCanvas, PSM.SINGLE_LINE))
  }
  return { tag: scoreReading(best.tag, best.confidence) > 0 ? best.tag : '', previewUrl: frames.previewUrl }
}

/**
 * Read a handwritten year–number tag (for example 01-1000) from the camera frame.
 * The viewfinder crop is cleaned up, then digits are read one at a time and as a line.
 */
export async function scanTagFromVideo(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) return { tag: '', previewUrl: '' }
  const frames = prepareFrames(video, visibleCrop(video))
  if (!frames) return { tag: '', previewUrl: '' }
  return readPreparedFrames(frames)
}

/** Read a tag from a photo when the live camera cannot be used. */
export async function scanTagFromImage(source: CanvasImageSource, width: number, height: number) {
  if (!width || !height) return { tag: '', previewUrl: '' }
  const frames = prepareFrames(source, { x: 0, y: 0, w: width, h: height })
  if (!frames) return { tag: '', previewUrl: '' }
  return readPreparedFrames(frames)
}
