/**
 * Homepage Content Component
 *
 * Renders homepage with hero, highlights, and sections
 */

interface HomepageContentProps {
  homepage: {
    hero: {
      title: string;
      subtitle?: string;
      description?: string;
      image: string;
      cta_label?: string;
      cta_url?: string;
    };
    sections?: Array<{
      id: string;
      type: string;
      content: unknown;
    }>;
    highlights?: Array<{
      icon?: string;
      title: string;
      description: string;
    }>;
  };
}

export function HomepageContent({ homepage }: HomepageContentProps) {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {homepage.hero.title}
          </h1>
          {homepage.hero.subtitle && (
            <h2 className="text-2xl md:text-4xl text-muted-foreground mb-4">
              {homepage.hero.subtitle}
            </h2>
          )}
          {homepage.hero.description && (
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              {homepage.hero.description}
            </p>
          )}
          {homepage.hero.cta_label && homepage.hero.cta_url && (
            <a
              href={homepage.hero.cta_url}
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {homepage.hero.cta_label}
            </a>
          )}
        </div>
      </section>

      {/* Highlights Section */}
      {homepage.highlights && homepage.highlights.length > 0 && (
        <section className="py-16 px-4 bg-muted/50">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {homepage.highlights.map((highlight, index) => (
                <div key={index} className="text-center">
                  {highlight.icon && (
                    <div className="mb-4">
                      <img
                        src={highlight.icon}
                        alt={highlight.title}
                        className="w-16 h-16 mx-auto"
                      />
                    </div>
                  )}
                  <h3 className="text-xl font-semibold mb-2">
                    {highlight.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {highlight.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Additional Sections */}
      {homepage.sections && homepage.sections.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto">
            {homepage.sections.map((section) => (
              <div key={section.id} className="mb-8">
                {/* Render section based on type */}
                {section.type === "richtext" && (
                  <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: String(section.content),
                    }}
                  />
                )}
                {section.type === "image" && (
                  <img
                    src={String(section.content)}
                    alt={`Section ${section.id}`}
                    className="w-full"
                  />
                )}
                {section.type === "cta" && (
                  <div className="text-center">
                    <a
                      href={String(
                        (section.content as { url?: string })?.url || "#",
                      )}
                      className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      {(section.content as { label?: string })?.label ||
                        "Learn More"}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
