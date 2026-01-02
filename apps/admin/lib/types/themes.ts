export interface Theme {
  id: string;
  name: string;
  description?: string;
  version: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted?: string;
    mutedForeground?: string;
    border?: string;
    input?: string;
    ring?: string;
    card?: string;
    cardForeground?: string;
    destructive?: string;
    destructiveForeground?: string;
  };
  typography: {
    fontFamily: string;
    fontFamilyHeading?: string;
    fontSizes?: Record<string, string>;
    fontWeights?: Record<string, number>;
    lineHeights?: Record<string, number>;
  };
  spacing: Record<string, string>;
  buttons: {
    borderRadius: "none" | "sm" | "md" | "lg" | "full";
    padding?: Record<string, string>;
    variants?: Record<string, Record<string, string>>;
  };
  layout: {
    containerMaxWidth: string;
    headerHeight: string;
    footerHeight: string;
    cartDrawerWidth?: string;
  };
}

export interface ThemeSettingsDto {
  colors?: Partial<Theme["colors"]>;
  typography?: Partial<Theme["typography"]>;
  spacing?: Partial<Theme["spacing"]>;
  buttons?: Partial<Theme["buttons"]>;
  layout?: Partial<Theme["layout"]>;
}
