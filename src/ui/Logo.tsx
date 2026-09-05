type LogoProps = {
  size?: "nav" | "hero";
  className?: string;
};

const SIZES = {
  nav: "h-10 w-10 sm:h-11 sm:w-11",
  hero: "h-[clamp(7.5rem,28vw,13.5rem)] w-[clamp(7.5rem,28vw,13.5rem)]",
} as const;

/** Cavaleiro PH — marca oficial. */
export function Logo({ size = "nav", className = "" }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="PH"
      width={size === "hero" ? 216 : 44}
      height={size === "hero" ? 216 : 44}
      className={`block object-cover ${SIZES[size]} ${className}`}
      decoding="async"
    />
  );
}
