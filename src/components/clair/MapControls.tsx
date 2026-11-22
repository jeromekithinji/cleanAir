import { ExposureIcon, LocateIcon, MinusIcon, PlusIcon } from "./icons"

type MapControlsProps = {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate: () => void
  exposureOn: boolean
  onExposure: () => void
}

export function MapControls({ onZoomIn, onZoomOut, onLocate, exposureOn, onExposure }: MapControlsProps) {
  return (
    <div className="controls">
      <div className="controls-row">
        <button type="button" className="ctrl" aria-label="Show my location" onClick={onLocate}>
          <LocateIcon size={24} />
        </button>
        <button
          type="button"
          className={`ctrl ctrl-exposure${exposureOn ? " is-on" : ""}`}
          aria-label="Exposure map: busy roads and heat"
          aria-pressed={exposureOn}
          title="Exposure map"
          onClick={onExposure}
        >
          <ExposureIcon size={22} />
        </button>
      </div>
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
