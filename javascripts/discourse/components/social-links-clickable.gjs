import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import icon from "discourse-common/helpers/d-icon";

function isNumericOnly(value) {
  return /^\d+(\.\d+)?$/.test(value);
}

function normalizeRadius(value) {
  const v = (value || "").trim();
  if (!v) return "";
  // If admin enters only a number, treat it as px
  return isNumericOnly(v) ? `${v}px` : v;
}

export default class SocialLinksClickable extends Component {
  @service linksSettings;

  get userModel() {
    return this.args.outletArgs?.user || this.args.outletArgs?.model;
  }

  get isDarkScheme() {
    if (typeof document === "undefined") return false;

    // 1) Prefer the *active* computed scheme (updates with palette)
    try {
      const cs = getComputedStyle(document.documentElement)
        .colorScheme?.toString()
        .trim()
        .toLowerCase();

      if (cs) {
        // colorScheme can be "light", "dark", or "light dark"
        if (cs.includes("dark") && !cs.includes("light")) return true;
        if (cs.includes("light") && !cs.includes("dark")) return false;
        // If it's "light dark" (both supported), fall through to --scheme-type
      }

      const schemeType = getComputedStyle(document.documentElement)
        .getPropertyValue("--scheme-type")
        .trim()
        .toLowerCase();

      if (schemeType === "dark") return true;
      if (schemeType === "light") return false;
    } catch {
      // ignore and fall back
    }

    // 2) Fallback: initial boot meta (can be stale)
    const meta = document.querySelector("meta#data-discourse-setup");
    return meta?.dataset?.colorSchemeIsDark === "true";
  }

  _pickLightDark(lightValue, darkValue) {
    const light = (lightValue || "").trim();
    const dark = (darkValue || "").trim();

    if (this.isDarkScheme) {
      return dark || light;
    }
    return light;
  }

  get containerStyle() {
    const globalLight = (settings.icon_color || "").trim();
    const globalDark = (settings.icon_color_dark || "").trim();
    const chosen = this.isDarkScheme ? globalDark || globalLight : globalLight;

    return chosen ? `--slc-global-icon-color: ${chosen};` : "";
  }

  get list() {
    const items = this.linksSettings.fieldOptions(this.userModel) || [];

    return items.map((field) => {
      const styleParts = [];

      // Per-platform icon (foreground) color (optional)
      if (settings.use_platform_colors) {
        const perColor = this._pickLightDark(field.color, field.colorDark);
        if (perColor) {
          styleParts.push(`--slc-icon-color: ${perColor};`);
        }
      }

      // Badge background (optional)
      const badgeBg = this._pickLightDark(
        field.badgeBackground,
        field.badgeBackgroundDark
      );

      const badgeEnabled = !!badgeBg;
      const frameClass = badgeEnabled
        ? "slc-icon-frame slc-badge"
        : "slc-icon-frame";

      if (badgeEnabled) {
        styleParts.push(`--slc-badge-bg: ${badgeBg};`);
      }

      // Badge radius (numeric => px, otherwise raw CSS value)
      const radius = normalizeRadius(field.badgeRadius);
      if (radius) {
        styleParts.push(`--slc-badge-radius: ${radius};`);
      }

      // Mask icon
      if (field.iconMask) {
        styleParts.push(`--slc-icon-mask: url('${field.iconMask}');`);
      }

      return {
        ...field,
        badgeEnabled,
        frameClass,
        style: styleParts.join(" "),
      };
    });
  }

  <template>
    <div class="iconic-user-fields" style={{this.containerStyle}}>
      {{#each this.list as |field|}}
        <a
          href={{field.href}}
          rel="nofollow noopener noreferrer"
          target="_blank"
          title={{field.name}}
          style={{field.style}}
        >
          <span class={{field.frameClass}}>
            {{#if field.iconImage}}
              <img class="slc-image-icon" src={{field.iconImage}} alt="" aria-hidden="true" />
            {{else if field.iconMask}}
              <span class="slc-custom-icon" aria-hidden="true"></span>
            {{else}}
              {{icon field.icon}}
            {{/if}}
          </span>
        </a>
      {{/each}}
    </div>
  </template>
}
