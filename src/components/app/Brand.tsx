export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/gignova-icon.png"
        alt=""
        aria-hidden="true"
        className="h-10 w-10 rounded-xl object-cover"
      />
      <span className="text-lg font-extrabold tracking-tight text-foreground">Gig Nova</span>
    </span>
  );
}
