import { HomepageContent } from "@/components/homepage-content";
import { getContent } from "@/lib/content/content";

export default async function HomePage() {
  // Fetch homepage content from content registry
  const homepageResult = await getContent("homepage");
  const homepage = homepageResult.data as {
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

  return <HomepageContent homepage={homepage} />;
}
