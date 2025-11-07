export default function HypeSignalLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 animate-spin-slow" />
      <div className="absolute inset-[3px] rounded-lg bg-black flex items-center justify-center">
        <span className="text-xs font-semibold tracking-widest text-white">HS</span>
      </div>
    </div>
  );
}
