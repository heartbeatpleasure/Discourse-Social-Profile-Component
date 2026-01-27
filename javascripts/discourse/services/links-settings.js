import Service from "@ember/service";

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

function normalizeHosts(hostsString) {
  if (!hostsString) return [];
  return hostsString
    .split(/[,\s]+/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function hostAllowed(hostname, allowedHosts) {
  if (!allowedHosts?.length) return false;
  const h = (hostname || "").toLowerCase();

  return allowedHosts.some((allowed) => {
    if (!allowed) return false;
    if (allowed.startsWith(".")) {
      return h === allowed.slice(1) || h.endsWith(allowed);
    }
    return h === allowed;
  });
}

function safeParseUrl(urlString) {
  try {
    return new URL(urlString);
  } catch {
    return null;
  }
}

// SECURITY: HTTPS only
function isSafeProtocol(url) {
  return url && url.protocol === "https:";
}

function normalizeHandle(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@/, "")
    .replace(/\s+/g, "");
}

function isSafeHandle(handle) {
  if (!handle) return false;
  if (/[\/:?#]/.test(handle)) return false;
  if (/\s/.test(handle)) return false;
  return true;
}

function isNumericId(value) {
  return /^\d+$/.test(value);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default class LinksSettings extends Service {
  get socialLinksConfig() {
    let cfg = settings.social_links;

    if (typeof cfg === "string") {
      try {
        cfg = JSON.parse(cfg);
      } catch {
        cfg = [];
      }
    }

    if (!Array.isArray(cfg)) return [];
    return cfg;
  }

  fieldOptions(model) {
    const userFields = model?.user_fields;
    const siteFields = model?.site?.user_fields;

    if (!userFields || !siteFields) {
      return null;
    }

    return this.socialLinksConfig
      .map((entry) => this._buildField(entry, siteFields, userFields))
      .filter(Boolean);
  }

  _resolveThemeUploadOrHttpsUrl(rawValue) {
    const raw = (rawValue || "").trim();
    if (!raw) return "";

    const themeUploads = settings?.theme_uploads;
    if (themeUploads && themeUploads[raw]) {
      return themeUploads[raw];
    }

    if (isHttpUrl(raw)) {
      const url = safeParseUrl(raw);
      if (isSafeProtocol(url)) {
        return url.toString();
      }
    }

    return "";
  }

  _buildField(entry, siteFields, userFields) {
    if (!entry) return null;
    if (entry.enabled === false) return null;

    const label = entry.label || entry.id || "Link";
    const userFieldName = entry.user_field;
    if (!userFieldName) return null;

    const siteUserField = siteFields.find((f) => f?.name === userFieldName);
    if (!siteUserField) return null;

    const rawValue = userFields[siteUserField.id];
    if (!rawValue) return null;

    const href = this._buildHref(entry, rawValue);
    if (!href) return null;

    // Icon priority:
    // 1) icon_image (full-color)
    // 2) icon_mask (monochrome mask)
    // 3) icon (FontAwesome / Discourse icon)
    const iconImage = this._resolveThemeUploadOrHttpsUrl(entry.icon_image);
    const iconMask = this._resolveThemeUploadOrHttpsUrl(entry.icon_mask);

    return {
      id: entry.id,
      name: label,
      href,
      icon: entry.icon || "globe",
      iconImage,
      iconMask,

      badgeBackground: (entry.badge_background || "").trim(),
      badgeBackgroundDark: (entry.badge_background_dark || "").trim(),
      badgeRadius: (entry.badge_radius || "").trim(),

      color: (entry.color || "").trim(),
      colorDark: (entry.color_dark || "").trim(),
    };
  }

  _buildHref(entry, rawValue) {
    const inputType = entry.input_type || "handle";
    const raw = String(rawValue).trim();
    if (!raw) return null;

    if (inputType === "email") {
      if (!isValidEmail(raw)) return null;
      return `mailto:${raw}`;
    }

    if (isHttpUrl(raw)) {
      return this._validateUrl(entry, raw, inputType);
    }

    if (inputType === "url_locked" || inputType === "url_any_https") {
      return null;
    }

    const handle = normalizeHandle(raw);
    if (!isSafeHandle(handle)) return null;

    if (inputType === "numeric_id") {
      if (!isNumericId(handle)) return null;
    }

    const baseUrl = (entry.base_url || "").trim();
    if (!baseUrl) return null;

    return `${baseUrl}${encodeURIComponent(handle)}`;
  }

  _validateUrl(entry, urlString, inputType) {
    const url = safeParseUrl(urlString);
    if (!isSafeProtocol(url)) return null;

    const allowedHosts = normalizeHosts(entry.allowed_hosts);

    if (inputType === "url_any_https") {
      if (allowedHosts.length && !hostAllowed(url.hostname, allowedHosts)) return null;
      if (entry.path_regex) {
        try {
          const re = new RegExp(entry.path_regex);
          if (!re.test(url.pathname)) return null;
        } catch {
          return null;
        }
      }
      return url.toString();
    }

    if (!allowedHosts.length) return null;
    if (!hostAllowed(url.hostname, allowedHosts)) return null;

    if (entry.path_regex) {
      try {
        const re = new RegExp(entry.path_regex);
        if (!re.test(url.pathname)) return null;
      } catch {
        return null;
      }
    }

    return url.toString();
  }
}
