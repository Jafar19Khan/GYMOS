import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

export default async function PublicGymWebsitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gym = await prisma.gym.findUnique({
    where: { slug },
    include: {
      websiteSettings: true,
      plans: { where: { isActive: true }, orderBy: { pricePaise: "asc" }, take: 6 },
    },
  });
  const site = gym?.websiteSettings;
  if (!gym || !site || !site.isPublished) notFound();

  const facilities = site.facilitiesText.split("\n").map((item) => item.trim()).filter(Boolean);
  return <main className="min-h-screen bg-[#090b0a] text-[#e8ece7]">
    <header className="border-b border-white/10"><div className="container-shell flex min-h-[76px] items-center justify-between gap-4"><Link href="/" className="text-xl font-black tracking-[-.08em]">GYMOS<span className="text-[#b6f36a]">.</span></Link><Link href="/login" className="rounded-full bg-[#b6f36a] px-5 py-3 text-xs font-black text-[#090b0a]">Member login</Link></div></header>
    <section className="relative overflow-hidden border-b border-white/10 py-24 md:py-32"><div className="absolute -right-40 -top-20 h-[520px] w-[520px] rounded-full bg-[#39c98a]/10 blur-[120px]"/><div className="container-shell relative"><p className="eyebrow">{gym.name}</p><h1 className="mt-6 max-w-4xl text-5xl font-black leading-[.98] tracking-[-.06em] md:text-7xl">{site.heroTitle}</h1><p className="mt-6 max-w-2xl text-base leading-8 text-white/55">{site.heroSubtitle}</p><Link href="/login" className="mt-10 inline-flex rounded-full bg-[#b6f36a] px-7 py-4 text-sm font-black text-[#090b0a]">Member sign in</Link></div></section>
    <section className="container-shell grid gap-12 py-20 md:grid-cols-2"><div><p className="eyebrow">About the gym</p><h2 className="mt-4 text-3xl font-black">A place to make progress.</h2><p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-white/55">{site.aboutText}</p></div><div><p className="eyebrow">Facilities</p><h2 className="mt-4 text-3xl font-black">Train your way.</h2>{facilities.length ? <ul className="mt-6 space-y-3">{facilities.map((item,index)=><li key={index} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70">{item}</li>)}</ul> : <p className="mt-5 text-sm text-white/40">Contact the gym for current facilities.</p>}</div></section>
    <section className="bg-[#111612] py-20"><div className="container-shell"><p className="eyebrow">Membership</p><h2 className="mt-4 text-3xl font-black">Find your plan.</h2>{gym.plans.length ? <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{gym.plans.map((plan)=><article key={plan.id} className="surface rounded-2xl p-6"><h3 className="font-bold">{plan.name}</h3><p className="mt-4 text-3xl font-black text-[#b6f36a]">{money(plan.pricePaise)}</p><p className="mt-1 text-xs text-white/40">{plan.durationDays} days</p>{plan.description && <p className="mt-4 text-xs leading-6 text-white/50">{plan.description}</p>}</article>)}</div> : <p className="mt-5 text-sm text-white/45">Contact the gym for membership options.</p>}</div></section>
    <section className="container-shell py-20"><p className="eyebrow">Contact</p><h2 className="mt-4 text-3xl font-black">Visit {gym.name}.</h2><div className="mt-6 grid gap-4 text-sm text-white/60 sm:grid-cols-2">{site.address && <p>{site.address}</p>}{site.contactPhone && <p>{site.contactPhone}</p>}{site.contactEmail && <a className="text-[#b6f36a]" href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>}</div></section>
    <footer className="border-t border-white/10 py-8"><div className="container-shell flex flex-wrap items-center justify-between gap-3 text-xs text-white/35"><span>{gym.name} · GYMOS</span><span>Train with intent.</span></div></footer>
  </main>;
}
