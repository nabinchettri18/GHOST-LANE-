export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f6f8fb] p-6 lg:pl-[300px]">
      <div className="mx-auto max-w-[1480px] animate-pulse space-y-5">
        <div className="h-7 w-64 rounded-lg bg-[#e4e9f0]" />
        <div className="h-4 w-[520px] max-w-full rounded bg-[#e9edf2]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl border border-[#dbe2ec] bg-white" />)}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <div className="h-[430px] rounded-3xl border border-[#dbe2ec] bg-white" />
          <div className="h-[430px] rounded-3xl bg-[#08111f]" />
        </div>
      </div>
    </main>
  )
}
