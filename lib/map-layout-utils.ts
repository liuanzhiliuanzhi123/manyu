import type { Spot } from "@/lib/travel-context"

type MarkerType = Spot["type"]

interface MarkerVisualOptions {
  order: number
  type: MarkerType
  isStart: boolean
  isEnd: boolean
  isSelected: boolean
  isKeyStop?: boolean
}

interface LabelVisualOptions {
  name: string
  type: MarkerType
  isSelected: boolean
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getMarkerTone(type: MarkerType, isStart: boolean, isEnd: boolean) {
  if (isStart) return "#5d6f2f"
  if (isEnd) return "#2e3a1e"
  if (type === "restaurant") return "#b49a62"
  if (type === "hotel") return "#7c8f64"
  return "#7f9652"
}

function getMarkerText(isStart: boolean, isEnd: boolean, order: number) {
  if (isStart) return "起"
  if (isEnd) return "终"
  return String(order)
}

export function createMapMarkerHtml(options: MarkerVisualOptions) {
  const { type, isStart, isEnd, isSelected, order, isKeyStop } = options
  const tone = getMarkerTone(type, isStart, isEnd)
  const ring = isSelected
    ? "0 0 0 3px rgba(255,255,255,0.96), 0 0 0 7px rgba(93,111,47,0.28)"
    : "0 0 0 2px rgba(255,255,255,0.94)"
  const size = isSelected ? 38 : isKeyStop ? 34 : 32
  const text = getMarkerText(isStart, isEnd, order)
  const badge = type === "restaurant" ? "食" : type === "hotel" ? "住" : ""

  return `
    <div style="
      width:${size}px;
      height:${size}px;
      border-radius:999px;
      background:${tone};
      color:#ffffff;
      font-weight:700;
      font-size:13px;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:${ring}, 0 8px 16px rgba(35,47,27,0.16);
      position:relative;
      transform:${isSelected ? "translateY(-2px)" : "translateY(0)"};
      transition:all 180ms cubic-bezier(0.22,1,0.36,1);
      user-select:none;
      pointer-events:auto;
    ">
      ${escapeHtml(text)}
      ${
        badge
          ? `<span style="
              position:absolute;
              right:-3px;
              bottom:-3px;
              min-width:16px;
              height:16px;
              border-radius:999px;
              border:1px solid rgba(255,255,255,0.88);
              background:rgba(255,255,255,0.96);
              color:${tone};
              font-size:9px;
              line-height:14px;
              text-align:center;
              font-weight:700;
            ">${badge}</span>`
          : ""
      }
    </div>
  `.trim()
}

export function createMapLabelHtml(options: LabelVisualOptions) {
  const tone =
    options.type === "restaurant"
      ? "#95763f"
      : options.type === "hotel"
      ? "#667b4f"
      : "#58713b"
  const typeText =
    options.type === "restaurant" ? "美食" : options.type === "hotel" ? "住宿" : "景点"

  return `
    <div style="
      max-width:188px;
      background:rgba(255,255,255,0.97);
      border:1px solid rgba(230,232,221,0.92);
      border-radius:12px;
      box-shadow:${
        options.isSelected
          ? "0 12px 26px rgba(41,52,27,0.18)"
          : "0 8px 16px rgba(41,52,27,0.1)"
      };
      padding:6px 9px;
      display:flex;
      gap:6px;
      align-items:center;
      font-size:11px;
      color:#1f2825;
      line-height:1.2;
      pointer-events:none;
    ">
      <span style="
        flex:0 0 auto;
        border-radius:999px;
        background:${tone};
        color:#fff;
        font-size:10px;
        line-height:1;
        font-weight:700;
        padding:2px 6px;
      ">${typeText}</span>
      <span style="
        display:block;
        min-width:0;
        max-width:126px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        font-weight:${options.isSelected ? 700 : 600};
      ">${escapeHtml(options.name)}</span>
    </div>
  `.trim()
}

interface LabelPolicyInput {
  index: number
  total: number
  isSelected: boolean
  isStart: boolean
  isEnd: boolean
  isKeyStop?: boolean
}

export function shouldRenderMarkerLabel(input: LabelPolicyInput) {
  if (input.isSelected || input.isStart || input.isEnd || input.isKeyStop) return true
  if (input.total <= 4) return true
  if (input.total <= 8) return input.index % 2 === 0
  return false
}

export function getRouteStrokeStyle(
  mode: "driving" | "walking" | "transit",
  status: "success" | "fallback" | "failed",
  highlighted: boolean
) {
  const baseColor =
    status !== "success"
      ? "#b48b4e"
      : mode === "walking"
      ? "#7f9652"
      : mode === "transit"
      ? "#7a8d5f"
      : "#5d6f2f"

  return {
    strokeColor: highlighted ? "#2e3a1e" : baseColor,
    strokeWeight: highlighted ? 8 : mode === "walking" ? 5 : 6,
    strokeOpacity: highlighted ? 0.98 : 0.86,
    strokeStyle: status === "success" ? "solid" : "dashed",
  } as const
}
