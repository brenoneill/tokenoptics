import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 2 L16 2 L22 8 L22 16 L16 22 L8 22 L2 16 L2 8 Z" fill="none" stroke="#a371f7" stroke-width="1.5" stroke-linejoin="miter"/><path d="M10 7 L14 7 L17 10 L17 14 L14 17 L10 17 L7 14 L7 10 Z" fill="none" stroke="#a371f7" stroke-width="1.5" stroke-linejoin="miter"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0d1117",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(logoSvg)}`}
          width={140}
          height={140}
        />
      </div>
    ),
    { ...size },
  );
}
