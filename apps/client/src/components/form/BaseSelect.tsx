import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import Select, {
  type CSSObjectWithLabel,
  type ControlProps,
  type GroupBase,
  type OptionProps,
  type Props as SelectProps,
  type StylesConfig,
  type Theme,
  type ThemeConfig,
  mergeStyles,
} from "react-select";
import CreatableSelect, { type CreatableProps } from "react-select/creatable";

import "@/styles/react-select.css";

export const SELECT_PALETTES = {
  dark: {
    controlBg: "#0F1115", // graphite-950
    menuBg: "#141821", // graphite-900
    border: "#2F394B", // graphite-600
    borderHover: "#3B475C", // graphite-500
    focusBorder: "#50617A", // graphite-400
    text: "#EEF1F5", // graphite-25
    placeholder: "#8C97AA", // graphite-200
    optionHover: "#1B2130", // graphite-800
    optionSelected: "#242B3A", // graphite-700
    indicator: "#6B7A92", // graphite-300
  },
  light: {
    controlBg: "#FFFFFF",
    menuBg: "#FFFFFF",
    border: "#D1D5DB",
    borderHover: "#9CA3AF",
    focusBorder: "#4B5563",
    text: "#111827",
    placeholder: "#6B7280",
    optionHover: "#F3F4F6",
    optionSelected: "#E5E7EB",
    indicator: "#6B7280",
  },
} as const;

type Palette = (typeof SELECT_PALETTES)[keyof typeof SELECT_PALETTES];

function useIsDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return isDarkMode;
}

function getPalette(isDarkMode: boolean): Palette {
  return isDarkMode ? SELECT_PALETTES.dark : SELECT_PALETTES.light;
}

function buildBaseStyles<Option, IsMulti extends boolean, Group extends GroupBase<Option>>(
  palette: Palette,
): StylesConfig<Option, IsMulti, Group> {
  const styles = {
    control: (base: CSSObjectWithLabel, state: ControlProps<Option, IsMulti, Group>) => ({
      ...base,
      backgroundColor: palette.controlBg,
      borderColor: state.isFocused ? palette.focusBorder : palette.border,
      boxShadow: "none",
      minHeight: 40,
      borderRadius: 8,
      color: palette.text,
      transition: "border-color 120ms ease, box-shadow 120ms ease",
      ":hover": {
        borderColor: palette.borderHover,
      },
    }),
    valueContainer: (base: CSSObjectWithLabel) => ({
      ...base,
      padding: "0 0.5rem",
    }),
    input: (base: CSSObjectWithLabel) => ({
      ...base,
      color: palette.text,
    }),
    singleValue: (base: CSSObjectWithLabel) => ({
      ...base,
      color: palette.text,
    }),
    placeholder: (base: CSSObjectWithLabel) => ({
      ...base,
      color: palette.placeholder,
    }),
    menu: (base: CSSObjectWithLabel) => ({
      ...base,
      backgroundColor: palette.menuBg,
      border: `1px solid ${palette.border}`,
      borderRadius: 8,
      overflow: "hidden",
      zIndex: 2147483647,
    }),
    menuPortal: (base: CSSObjectWithLabel) => ({
      ...base,
      zIndex: 2147483647,
    }),
    menuList: (base: CSSObjectWithLabel) => ({
      ...base,
      backgroundColor: palette.menuBg,
    }),
    option: (base: CSSObjectWithLabel, state: OptionProps<Option, IsMulti, Group>) => ({
      ...base,
      backgroundColor: state.isSelected
        ? palette.optionSelected
        : state.isFocused
          ? palette.optionHover
          : "transparent",
      color: palette.text,
      cursor: "pointer",
    }),
    dropdownIndicator: (base: CSSObjectWithLabel) => ({
      ...base,
      color: palette.indicator,
      ":hover": {
        color: palette.text,
      },
    }),
    indicatorSeparator: () => ({
      display: "none",
    }),
    clearIndicator: (base: CSSObjectWithLabel) => ({
      ...base,
      color: palette.indicator,
      ":hover": {
        color: palette.text,
      },
    }),
    multiValue: (base: CSSObjectWithLabel) => ({
      ...base,
      backgroundColor: palette.optionSelected,
    }),
    multiValueLabel: (base: CSSObjectWithLabel) => ({
      ...base,
      color: palette.text,
    }),
    multiValueRemove: (base: CSSObjectWithLabel) => ({
      ...base,
      color: palette.indicator,
      ":hover": {
        backgroundColor: palette.optionHover,
        color: palette.text,
      },
    }),
  };

  return styles as StylesConfig<Option, IsMulti, Group>;
}

function buildTheme(palette: Palette): ThemeConfig {
  return (baseTheme: Theme): Theme => ({
    ...baseTheme,
    borderRadius: 8,
    colors: {
      ...baseTheme.colors,
      primary: palette.focusBorder,
      primary25: palette.optionHover,
      primary50: palette.optionSelected,
      primary75: palette.borderHover,
      neutral0: palette.controlBg,
      neutral5: palette.optionHover,
      neutral10: palette.optionSelected,
      neutral20: palette.border,
      neutral30: palette.borderHover,
      neutral40: palette.placeholder,
      neutral50: palette.placeholder,
      neutral60: palette.indicator,
      neutral70: palette.text,
      neutral80: palette.text,
      neutral90: palette.text,
    },
  });
}

const toThemeFunction = (config: ThemeConfig): ((theme: Theme) => Theme) => {
  if (typeof config === "function") {
    return config;
  }

  return (theme: Theme) => ({
    ...theme,
    ...config,
    colors: {
      ...theme.colors,
      ...(config.colors ?? {}),
    },
  });
};

function mergeThemes(baseThemeFn: ThemeConfig, override?: ThemeConfig): ThemeConfig {
  if (!override) {
    return baseThemeFn;
  }

  const baseFn = toThemeFunction(baseThemeFn);
  const overrideFn = toThemeFunction(override);

  return (theme: Theme) => overrideFn(baseFn(theme));
}

const useSelectPalette = () => {
  const isDarkMode = useIsDarkMode();
  return useMemo(() => getPalette(isDarkMode), [isDarkMode]);
};

const useMergedStyles = <Option, IsMulti extends boolean, Group extends GroupBase<Option>>(
  palette: Palette,
  stylesProp: StylesConfig<Option, IsMulti, Group> | undefined,
) => {
  const baseStyles = useMemo(() => buildBaseStyles<Option, IsMulti, Group>(palette), [palette]);

  return useMemo(() => {
    if (!stylesProp) {
      return baseStyles;
    }
    return mergeStyles(baseStyles, stylesProp) as StylesConfig<Option, IsMulti, Group>;
  }, [baseStyles, stylesProp]);
};

const useMergedTheme = (palette: Palette, themeProp: ThemeConfig | undefined) => {
  const baseTheme = useMemo(() => buildTheme(palette), [palette]);
  return useMemo(() => mergeThemes(baseTheme, themeProp), [baseTheme, themeProp]);
};

const useMenuPortalTarget = (menuPortalTarget: HTMLElement | null | undefined) =>
  useMemo(() => {
    if (menuPortalTarget !== undefined) {
      return menuPortalTarget;
    }
    if (typeof document === "undefined") {
      return undefined;
    }
    return document.body;
  }, [menuPortalTarget]);

export const BaseSelect = <
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(
  props: SelectProps<Option, IsMulti, Group>,
) => {
  const { className = "", styles: stylesProp, theme: themeProp, menuPortalTarget, ...rest } = props;

  const palette = useSelectPalette();
  const styles = useMergedStyles<Option, IsMulti, Group>(palette, stylesProp);
  const theme = useMergedTheme(palette, themeProp);
  const resolvedMenuPortalTarget = useMenuPortalTarget(menuPortalTarget);

  return (
    <Select<Option, IsMulti, Group>
      {...rest}
      className={clsx("w-full", className)}
      classNamePrefix="react-select"
      styles={styles}
      theme={theme}
      menuPortalTarget={resolvedMenuPortalTarget ?? null}
    />
  );
};

export const BaseCreatableSelect = <
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(
  props: CreatableProps<Option, IsMulti, Group>,
) => {
  const { className = "", styles: stylesProp, theme: themeProp, menuPortalTarget, ...rest } = props;

  const palette = useSelectPalette();
  const styles = useMergedStyles<Option, IsMulti, Group>(palette, stylesProp);
  const theme = useMergedTheme(palette, themeProp);
  const resolvedMenuPortalTarget = useMenuPortalTarget(menuPortalTarget);

  return (
    <CreatableSelect<Option, IsMulti, Group>
      {...rest}
      className={clsx("w-full", className)}
      classNamePrefix="react-select"
      styles={styles}
      theme={theme}
      menuPortalTarget={resolvedMenuPortalTarget ?? null}
    />
  );
};

export { useIsDarkMode as useSelectIsDarkMode };
