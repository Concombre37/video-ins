export const blackFridayPromoCode = `import { AbsoluteFill, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const PhotoBeat = ({ src, index, beat, accent, discount }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, beat], index % 2 === 0 ? [1, 1.12] : [1.12, 1], { extrapolateRight: "clamp" });
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const badge = spring({ frame: frame - 6, fps, config: { damping: 8 } });
  return (
    <AbsoluteFill>
      {src ? (
        <>
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.45)", transform: "scale(1.2)" }} />
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <Img src={src} style={{ width: "88%", height: "60%", objectFit: "contain", transform: \`scale(\${zoom * (0.85 + 0.15 * enter)})\`, opacity: enter, borderRadius: 24 }} />
          </AbsoluteFill>
        </>
      ) : (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", color: "#555", fontSize: 70, fontWeight: 900 }}>TON PRODUIT</AbsoluteFill>
      )}
      <div style={{ position: "absolute", right: 70, top: 300, width: 260, height: 260, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 84, fontWeight: 900, color: "#000", transform: \`scale(\${badge}) rotate(-10deg)\` }}>{discount}</div>
    </AbsoluteFill>
  );
};

const PriceBeat = ({ oldPrice, newPrice, accent, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const strike = interpolate(frame, [5, 18], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pop = spring({ frame: frame - 18, fps, config: { damping: 9 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 30 }}>
      <div style={{ position: "relative", color: text, opacity: 0.55, fontSize: 120, fontWeight: 800 }}>
        {oldPrice}
        <div style={{ position: "absolute", left: 0, top: "50%", height: 12, width: strike + "%", background: "#FF1E3C" }} />
      </div>
      <div style={{ color: accent, fontSize: 230, fontWeight: 900, transform: \`scale(\${pop})\` }}>{newPrice}</div>
    </AbsoluteFill>
  );
};

const CtaBeat = ({ cta, accent }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.06 * Math.sin(frame / 4);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ background: accent, color: "#000", fontSize: 110, fontWeight: 900, padding: "30px 60px", borderRadius: 30, transform: \`scale(\${pulse})\` }}>{cta}</div>
    </AbsoluteFill>
  );
};

export const MyAnimation = () => {
  /*
   * Pub Black Friday verticale : hook choc, photos produits avec Ken Burns,
   * prix barré puis CTA "lien en bio".
   */
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const COLOR_BG = "#000000";
  const COLOR_ACCENT = "#FFD600";
  const COLOR_TEXT = "#FFFFFF";
  const TITLE_TEXT = "BLACK FRIDAY";
  const DISCOUNT = "-40%";
  const OLD_PRICE = "89€";
  const NEW_PRICE = "53€";
  const CTA_TEXT = "LIEN EN BIO";
  const HOOK = Math.round(fps * 1.5);
  const BEAT = Math.round(fps * 2);
  const PHOTOS = PRODUCT_IMAGES.length > 0 ? PRODUCT_IMAGES : [];
  const SHOW_COUNT = Math.max(1, Math.min(PHOTOS.length, 4));
  const PRICE_START = HOOK + SHOW_COUNT * BEAT;
  const CTA_START = PRICE_START + Math.round(fps * 2);

  const hookScale = spring({ frame, fps, from: 2.5, to: 1, config: { damping: 12 } });
  const flash = interpolate(frame, [0, 3], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const marquee = -((frame * 8) % (width * 1.2));

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR_BG, fontFamily: "Inter, sans-serif" }}>
      <Sequence durationInFrames={HOOK}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ color: COLOR_ACCENT, fontSize: 170, fontWeight: 900, lineHeight: 0.95, textAlign: "center", transform: \`scale(\${hookScale})\`, letterSpacing: -4 }}>
            {TITLE_TEXT.split(" ").map((w) => <div key={w}>{w}</div>)}
          </div>
        </AbsoluteFill>
      </Sequence>

      {Array.from({ length: SHOW_COUNT }).map((_, i) => {
        const src = PHOTOS[i % Math.max(PHOTOS.length, 1)];
        return (
          <Sequence key={i} from={HOOK + i * BEAT} durationInFrames={BEAT}>
            <PhotoBeat src={src} index={i} beat={BEAT} accent={COLOR_ACCENT} discount={DISCOUNT} />
          </Sequence>
        );
      })}

      <Sequence from={PRICE_START} durationInFrames={CTA_START - PRICE_START}>
        <PriceBeat oldPrice={OLD_PRICE} newPrice={NEW_PRICE} accent={COLOR_ACCENT} text={COLOR_TEXT} />
      </Sequence>

      <Sequence from={CTA_START}>
        <CtaBeat cta={CTA_TEXT} accent={COLOR_ACCENT} />
      </Sequence>

      <div style={{ position: "absolute", top: 120, left: marquee, whiteSpace: "nowrap", color: COLOR_BG, background: COLOR_ACCENT, fontSize: 44, fontWeight: 900, padding: "10px 0" }}>
        {Array(8).fill(TITLE_TEXT + " • " + DISCOUNT + " • ").join("")}
      </div>
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};
`;

export const blackFridayPromoExample = {
  id: "black-friday-promo",
  name: "Black Friday Promo",
  description: "Pub verticale : hook, photos produits (PRODUCT_IMAGES) avec Ken Burns et badge, prix barré, CTA",
  code: blackFridayPromoCode,
  durationInFrames: 345,
  fps: 30,
  category: "Other" as const,
};
