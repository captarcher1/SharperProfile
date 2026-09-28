import type { MetricsData } from "@/config/types";

export default function Metrics({
  id,
  heading,
  data,
}: {
  id: string;
  heading?: string;
  data: MetricsData;
}) {
  return (
    <section id={id} className="bg-black">
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 md:py-12">
        {heading && (
          <h2 className="mb-6 text-2xl font-semibold text-white sm:text-3xl">{heading}</h2>
        )}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-8">
          {data.map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-3xl font-semibold text-white sm:text-4xl">{m.value}</p>
              <p className="mt-1 text-sm text-white/70">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
