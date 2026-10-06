export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <nav className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white">PR</div>
            <div>
              <p className="text-lg font-semibold">Prime Airlines</p>
            </div>
          </div>

          <a
            href="/login"
            className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            Login
          </a>
        </nav>

        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-blue-200">Customer + Agent Experience</p>
            <h1 className="max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
              Support your customers and agents in one connected airline experience.
            </h1>
            <p className="mt-5 max-w-lg text-base text-blue-100">
              A modern airline assistant for booking, cancellation, refunds, and live escalation with dedicated customer and agent workflows.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/login"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-blue-900 transition hover:bg-blue-50"
              >
                Go to login
              </a>
              <a
                href="/chat"
                className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Open chat demo
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-2xl backdrop-blur-sm">
            <div className="space-y-4">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-blue-200">Customer portal</p>
                <p className="mt-2 text-2xl font-semibold">Book, cancel, refund</p>
              </div>
              <div className="rounded-2xl bg-green-500/10 p-4 border border-green-300/20">
                <p className="text-xs uppercase tracking-[0.2em] text-green-200">Agent console</p>
                <p className="mt-2 text-2xl font-semibold">Review escalations</p>
              </div>
              <div className="rounded-2xl bg-red-500/10 p-4 border border-red-300/20">
                <p className="text-xs uppercase tracking-[0.2em] text-red-200">Live workflow</p>
                <p className="mt-2 text-2xl font-semibold">Handle both ends in one app</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
