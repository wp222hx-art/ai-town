export default function PoweredBySynapse() {
  return (
    <div
      className="group absolute top-0 left-0 w-64 h-16 md:block z-10 hidden overflow-hidden"
      aria-label="由 Synapse 驱动"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 to-indigo-900/60"></div>
      <div className="absolute inset-0 flex items-center p-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-system font-medium uppercase tracking-wider text-purple-300 text-xs">
            由...  驱动
          </span>
          <span className="font-display text-xl font-bold text-white tracking-wide">
            Synapse
          </span>
        </div>
      </div>
    </div>
  );
}
