export interface PhotobankImage {
  id: string;
  name: string;
  src: string;
}

const svgData = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const PHOTO_BANK: PhotobankImage[] = [
  {
    id: "sunset",
    name: "Soft sunset",
    src: svgData(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#ff9f6e"/>
            <stop offset="0.55" stop-color="#f6d365"/>
            <stop offset="1" stop-color="#5b86e5"/>
          </linearGradient>
        </defs>
        <rect width="600" height="600" fill="url(#sky)"/>
        <circle cx="300" cy="270" r="105" fill="#fff2a8" opacity="0.9"/>
        <path d="M0 410 C130 360 220 455 340 395 S520 360 600 430 V600 H0Z" fill="#284b63"/>
        <path d="M0 470 C150 420 240 520 380 455 S525 430 600 492 V600 H0Z" fill="#17324d"/>
      </svg>
    `),
  },
  {
    id: "leaf",
    name: "Green leaves",
    src: svgData(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
        <rect width="600" height="600" fill="#e6f5df"/>
        <g fill="none" stroke-linecap="round">
          <path d="M92 520 C150 300 250 120 514 44" stroke="#2d6a4f" stroke-width="22"/>
          <path d="M112 482 C210 450 260 380 284 276" stroke="#52b788" stroke-width="56"/>
          <path d="M208 396 C340 374 412 286 454 134" stroke="#40916c" stroke-width="68"/>
          <path d="M304 326 C412 352 500 284 548 168" stroke="#74c69d" stroke-width="52"/>
        </g>
        <g fill="#1b4332" opacity="0.18">
          <circle cx="120" cy="130" r="70"/>
          <circle cx="500" cy="485" r="95"/>
        </g>
      </svg>
    `),
  },
  {
    id: "texture",
    name: "Paper texture",
    src: svgData(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0.08 0.2"/>
          </feComponentTransfer>
        </filter>
        <rect width="600" height="600" fill="#f2e6d8"/>
        <rect width="600" height="600" filter="url(#noise)"/>
        <path d="M-20 470 C120 410 200 470 325 430 S515 360 625 430 V620 H-20Z" fill="#d8b4a0" opacity="0.85"/>
        <path d="M45 80 H555 V160 H45Z" fill="#ffcad4" opacity="0.55"/>
      </svg>
    `),
  },
  {
    id: "ocean",
    name: "Ocean glass",
    src: svgData(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
        <defs>
          <radialGradient id="glow" cx="30%" cy="20%" r="80%">
            <stop offset="0" stop-color="#caf0f8"/>
            <stop offset="0.45" stop-color="#00b4d8"/>
            <stop offset="1" stop-color="#023e8a"/>
          </radialGradient>
        </defs>
        <rect width="600" height="600" fill="url(#glow)"/>
        <g fill="none" stroke="#ffffff" stroke-width="18" opacity="0.38">
          <path d="M-10 170 C120 110 195 220 315 165 S500 105 615 178"/>
          <path d="M-10 330 C120 270 195 380 315 325 S500 265 615 338"/>
          <path d="M-10 490 C120 430 195 540 315 485 S500 425 615 498"/>
        </g>
      </svg>
    `),
  },
];
