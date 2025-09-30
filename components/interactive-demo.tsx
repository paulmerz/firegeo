'use client';

import { useState, ElementType } from 'react';
import Image, { StaticImageData } from 'next/image';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Target, Heart } from 'lucide-react';

// Images: utilisez des images libres existantes (public/) ou remplacez ces placeholders
// Pour l'instant, on pointe vers un SVG déjà présent; vous pouvez remplacer par vos captures dashboard_*.jpg dans /public
import prompts from '@/public/prompts.jpg';
import sentiment from '@/public/sentiment.jpg';
import visibility from '@/public/visibility.jpg';

type DemoId = 'visibility' | 'prompts' | 'sentiment';

export default function InteractiveDemo() {
  const t = useTranslations('home.demo');
  const [activeDemo, setActiveDemo] = useState<DemoId>('visibility');

  const demoContent: Array<{
    id: DemoId;
    title: string;
    description: string;
    icon: ElementType;
    image: StaticImageData;
  }> = [
    {
      id: 'visibility',
      title: t('items.visibility.title'),
      description: t('items.visibility.description'),
      icon: Eye,
      image: visibility,
    },
    {
      id: 'prompts',
      title: t('items.prompts.title'),
      description: t('items.prompts.descrition'),
      icon: Target,
      image: prompts,
    },
    {
      id: 'sentiment',
      title: t('items.sentiment.title'),
      description: t('items.sentiment.description'),
      icon: Heart,
      image: sentiment,
    },
  ];

  const activeDemoContent = demoContent.find((d) => d.id === activeDemo);

  return (
    <section className="py-20 lg:py-32 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            {t('title')}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('description')}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Côté gauche - Cartes */}
          <div className="space-y-4">
            {demoContent.map((demo) => {
              const Icon = demo.icon;
              const isActive = activeDemo === demo.id;
              return (
                <Card
                  key={demo.id}
                  className={`cursor-pointer transition-all duration-300 hover:shadow-md ${
                    isActive
                      ? 'border-orange-500 shadow-lg bg-card'
                      : 'border-border hover:border-orange-400/50'
                  }`}
                  onClick={() => setActiveDemo(demo.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-2 rounded-lg ${
                          isActive
                            ? 'bg-orange-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3
                          className={`text-lg font-semibold mb-2 ${
                            isActive ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {demo.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {demo.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Côté droit - Image tableau de bord */}
          <div className="relative">
            <div className="relative rounded-xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)] bg-card">
              {activeDemoContent && (
                <Image
                  src={activeDemoContent.image}
                  alt={activeDemoContent.title}
                  className="w-full h-auto"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


