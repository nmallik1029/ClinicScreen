// The full-screen "meet your doctor" card. Fills its parent (the player stage or
// the editor preview) and scales typography with container-query units so it
// reads correctly at TV size and at thumbnail size from the same markup.

export type DoctorCardData = {
  name: string;
  credentials?: string | null;
  title?: string | null;
  specialty?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
  /** Screen-ready introduction rephrased at import; preferred over the raw bio. */
  screenBlurb?: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function DoctorCard({ doctor }: { doctor: DoctorCardData }) {
  const fullName = doctor.credentials ? `${doctor.name}, ${doctor.credentials}` : doctor.name;
  // Prefer the rephrased blurb (sized to fit); fall back to the raw bio only when a
  // blurb hasn't been generated yet.
  const intro = doctor.screenBlurb?.trim() || doctor.bio?.trim() || "";
  const introIsBlurb = Boolean(doctor.screenBlurb?.trim());

  return (
    <div
      className="absolute inset-0 flex items-center overflow-hidden"
      style={{
        containerType: "size",
        background: "linear-gradient(135deg, #0b1e3b 0%, #12294d 55%, #0b1e3b 100%)",
        color: "white",
      }}
    >
      {/* Subtle brand accent glow */}
      <div
        className="pointer-events-none absolute -right-[10cqw] -top-[10cqw] rounded-full"
        style={{ width: "45cqw", height: "45cqw", background: "radial-gradient(circle, rgba(37,99,235,0.25), transparent 70%)" }}
      />

      <div className="flex w-full items-center" style={{ gap: "5cqw", padding: "4.5cqw 7cqw" }}>
        {/* Photo / initials */}
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: "30cqw",
            height: "30cqw",
            borderRadius: "3cqw",
            boxShadow: "0 0.5cqw 3cqw rgba(0,0,0,0.45)",
            border: "0.4cqw solid rgba(255,255,255,0.12)",
          }}
        >
          {doctor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doctor.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center font-semibold"
              style={{ background: "#1e3a68", fontSize: "9cqw", letterSpacing: "0.05em" }}
            >
              {initials(doctor.name)}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div style={{ fontSize: "2.4cqw", letterSpacing: "0.25em", color: "#7aa7ff", textTransform: "uppercase" }}>
            Your Physician
          </div>
          <div
            className="overflow-hidden font-semibold leading-tight"
            style={{
              fontSize: "6cqw",
              marginTop: "1cqw",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {fullName}
          </div>

          {doctor.specialty && (
            <div style={{ marginTop: "2cqw" }}>
              <span
                style={{
                  fontSize: "2.6cqw",
                  padding: "0.8cqw 2cqw",
                  borderRadius: "10cqw",
                  background: "rgba(37,99,235,0.25)",
                  border: "0.2cqw solid rgba(122,167,255,0.5)",
                }}
              >
                {doctor.specialty}
              </span>
            </div>
          )}

          {doctor.title && (
            <div style={{ fontSize: "2.8cqw", marginTop: "2cqw", color: "rgba(255,255,255,0.75)" }}>
              {doctor.title}
            </div>
          )}

          {intro && (
            <p
              className="overflow-hidden"
              style={{
                fontSize: "2.4cqw",
                lineHeight: 1.45,
                marginTop: "2.5cqw",
                color: "rgba(255,255,255,0.82)",
                // Always clamp so the text can never spill off the card. Generated
                // blurbs are short enough to fit inside this without ellipsizing;
                // the clamp is a safety net (and tidies an over-long raw-bio fallback).
                display: "-webkit-box",
                WebkitLineClamp: introIsBlurb ? 6 : 5,
                WebkitBoxOrient: "vertical",
              }}
            >
              {intro}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
