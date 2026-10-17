import CTAButton from './CTAButton';
import type { Page } from './Navbar';

type Props = {
  onNavigate: (page: Page) => void;
};

function Hero({ onNavigate }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-xxl pb-12 pt-6 sm:pb-16 sm:pt-8">
      <section className="relative overflow-hidden rounded-xl border bg-card shadow-sticker-lg">
        <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
          <div
            className="relative min-h-[320px] overflow-hidden"
            style={{ clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)' }}
          >
            <img
              alt="Berufskolleg Meschede"
              className="absolute inset-0 h-full w-full object-cover"
              src="/bkm-luftbild.jpg"
            />
          </div>
          <div className="flex items-center justify-center px-xxl py-huge md:px-huge lg:px-16 lg:py-20">
            <div className="flex flex-col gap-lg sm:flex-row">
              <CTAButton
                label="Zum Webshop"
                onClick={() => onNavigate('webshop')}
                variant="outline"
              />
              <CTAButton
                label="Zur Simulation"
                onClick={() => onNavigate('simulation')}
                variant="solid"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Hero;
