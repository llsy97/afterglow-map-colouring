import { useRef, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { toPng } from 'html-to-image'
import { useTranslation } from 'react-i18next'
import { POSTER_H, POSTER_W, Poster } from '../components/Poster'
import { TopBar } from '../components/ui'
import { isNativeApp, saveFile } from '../lib/saveFile'
import { useNav } from '../store/useNav'

async function render(node: HTMLElement): Promise<Blob> {
  await document.fonts.ready
  const opts = {
    width: POSTER_W,
    height: POSTER_H,
    pixelRatio: 1,
    // the preview is scaled down; export at the full 1080x1350
    style: { transform: 'none', transformOrigin: 'top left' },
  }
  // Safari draws images/fonts only on the second pass
  if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) await toPng(node, opts)
  const dataUrl = await toPng(node, opts)
  return (await fetch(dataUrl)).blob()
}

export function PosterScreen() {
  const { t } = useTranslation()
  const back = useNav((s) => s.back)
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()

  const previewW = Math.min(window.innerWidth, 560) - 40
  const scale = previewW / POSTER_W
  // the Android app always goes through the system share sheet, so it needs no separate Share button
  const canShare = !isNativeApp() && typeof navigator.canShare === 'function'

  async function run(share: boolean) {
    if (!ref.current) return
    setBusy(true)
    setMessage(t('poster.exporting'))
    try {
      const blob = await render(ref.current)
      const file = new File([blob], `travel-light-map-${new Date().getFullYear()}.png`, { type: 'image/png' })
      if (share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] })
      else await saveFile(blob, file.name)
      setMessage(t('poster.done'))
    } catch (e) {
      // the user dismissing the share sheet is not an error
      setMessage(e instanceof DOMException && e.name === 'AbortError' ? undefined : t('poster.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <TopBar onBack={back} label={t('poster.make')} />
      <div className="screen-scroll px-5 pb-6">
        <div
          className="mt-2 overflow-hidden rounded-[12px] border border-[var(--line)]"
          style={{ width: previewW, height: previewW * (POSTER_H / POSTER_W) }}
        >
          <Poster ref={ref} scale={scale} />
        </div>
        <p className="m-0 mt-3 text-[13px] t-dim" role="status" aria-live="polite">
          {message ?? t('poster.hint')}
        </p>
      </div>
      <div className="bottom-bar">
        {canShare && (
          <button className="pill-btn ghost" disabled={busy} onClick={() => void run(true)}>
            <Share2 size={16} strokeWidth={1.5} />
            {t('poster.share')}
          </button>
        )}
        <button className="pill-btn" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }} onClick={() => void run(false)}>
          <Download size={16} strokeWidth={1.5} />
          {t('poster.save')}
        </button>
      </div>
    </div>
  )
}
