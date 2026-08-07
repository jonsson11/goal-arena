import { HeroSection } from "@/components/home/HeroSection";
import { Novedades } from "@/components/home/Novedades";
import { GamesCarousel } from "@/components/home/GamesCarousel";
import { StatsSection } from "@/components/home/StatsSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <StatsSection />
      <GamesCarousel />
      <Novedades />
    </main>
  );
}