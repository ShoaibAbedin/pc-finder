import { ImageResponse } from "next/og";

// Home-screen icon (iPhone/iPad "Add to Home Screen"). Same artwork as app/icon.svg, rendered at 180×180.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="180" height="180">
  <rect width="32" height="32" fill="#111111"/>
  <g fill="none" stroke="#f6f5f1" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="6.5" width="18" height="12.5" rx="2" stroke-width="2.2"/>
    <path d="M12 19v3.2M8.6 23.2h6.8" stroke-width="2.2"/>
    <circle cx="21.3" cy="18.6" r="5" fill="#111111" stroke-width="2.4"/>
    <path d="M25 22.3l2.9 2.9" stroke-width="2.8"/>
    <path d="M19.2 16.6a3 3 0 0 1 2-1.1" stroke-width="1.4"/>
  </g>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={180} height={180} alt="" />,
    size,
  );
}
