function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden shadow-lg">
          <img src="/PHVC_Logo.png" alt="PHVC" className="w-full h-full object-cover" />
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-400 font-body">Loading PHVC...</p>
      </div>
    </div>
  );
}
export default LoadingScreen;
