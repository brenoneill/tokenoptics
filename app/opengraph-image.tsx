import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Tokenoptics — transparency for Claude Code spend";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 2 L16 2 L22 8 L22 16 L16 22 L8 22 L2 16 L2 8 Z" fill="none" stroke="#a371f7" stroke-width="1.5" stroke-linejoin="miter"/><path d="M10 7 L14 7 L17 10 L17 14 L14 17 L10 17 L7 14 L7 10 Z" fill="none" stroke="#a371f7" stroke-width="1.5" stroke-linejoin="miter"/></svg>`;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0d1117",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
              border: "1px solid rgba(163, 113, 247, 0.4)",
              background: "rgba(163, 113, 247, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(logoSvg)}`}
              width={64}
              height={64}
            />
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              color: "#e6edf3",
              letterSpacing: "-0.02em",
            }}
          >
            tokenoptics
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            fontSize: 76,
            fontWeight: 600,
            color: "#e6edf3",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          <span>Where did all your&nbsp;</span>
          <span style={{ color: "#a371f7" }}>Claude Code</span>
          <span>&nbsp;spend go?</span>
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 30,
            color: "#8b949e",
            maxWidth: 880,
            lineHeight: 1.4,
          }}
        >
          Token-level visibility into every session, branch, and project — built
          on the transcripts already on your machine.
        </div>
      </div>
    ),
    { ...size },
  );
}
