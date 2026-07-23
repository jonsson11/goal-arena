import { HeroSection } from "@/components/home/HeroSection";
import { ArenasTeaser } from "@/components/home/ArenasTeaser";
import { GamesCarousel } from "@/components/home/GamesCarousel";
import { StatsSection } from "@/components/home/StatsSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <StatsSection />
      <GamesCarousel />
      <ArenasTeaser />
    </main>
  );
}