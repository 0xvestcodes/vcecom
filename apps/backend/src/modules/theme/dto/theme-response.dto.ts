export interface ThemeResponseDto {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
  sectionPadding: "xs" | "sm" | "md" | "lg" | "xl";
  globalRadius: "none" | "sm" | "md" | "lg" | "full";
  typography: {
    fontSans: string;
    fontSerif: string;
  };
}
