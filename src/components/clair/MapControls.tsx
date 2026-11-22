import { LocateIcon, MinusIcon, PlusIcon } from "./icons"

type MapControlsProps = {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate: () => void
}

export function MapControls({ onZoomIn, onZoomOut, onLocate }: MapControlsProps) {
  return (
    <div className="controls">
      <button type="button" className="ctrl" aria-label="Show my location" onClick={onLocate}>
        <LocateIcon size={24} />
      </button>
      <div className="controls-row">
        <button type="button" className="ctrl" aria-label="Zoom in" onClick={onZoomIn}>
          <PlusIcon size={22} />
        </button>
        <button type="button" className="ctrl" aria-label="Zoom out" onClick={onZoomOut}>
          <MinusIcon size={22} />
        </button>
      </div>
    </div>
  )
}
