import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans antialiased">
      <div className="max-w-md w-full space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-800 text-red-400 mx-auto flex items-center justify-center text-2xl font-black shadow-lg shadow-red-950/50">
          404
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Page or Portal Not Found
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The requested school subdomain or page address does not exist on this platform. Please verify the web address and try again.
          </p>
        </div>

        <div className="pt-4 flex justify-center">
          <Link
            href="/"
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all"
          >
            ← Return to Platform Home
          </Link>
        </div>
      </div>
    </div>
  );
}
