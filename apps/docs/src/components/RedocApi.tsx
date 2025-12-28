import { RedocStandalone } from "redoc";

interface RedocApiProps {
  specUrl: string;
  title?: string;
}

export default function RedocApi({ specUrl, title: _title }: RedocApiProps) {
  return (
    <RedocStandalone
      specUrl={specUrl}
      options={{
        scrollYOffset: 60,
        hideDownloadButton: false,
        expandResponses: "200,201",
        requiredPropsFirst: true,
        sortOperationsAlphabetically: false,
        sortTagsAlphabetically: true,
        theme: {
          colors: {
            primary: {
              main: "#25c2a0",
            },
          },
          typography: {
            fontSize: "14px",
            fontFamily: "var(--ifm-font-family-base)",
            code: {
              fontSize: "13px",
              fontFamily: "var(--ifm-font-family-monospace)",
            },
            headings: {
              fontFamily: "var(--ifm-font-family-base)",
              fontWeight: "600",
            },
          },
        },
      }}
    />
  );
}
