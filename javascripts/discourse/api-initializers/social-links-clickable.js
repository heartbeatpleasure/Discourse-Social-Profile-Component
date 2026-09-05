import { apiInitializer } from "discourse/lib/api";
import SocialLinksClickable from "../components/social-links-clickable";

function socialLinksConfig() {
  let config = settings.social_links;

  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch {
      config = [];
    }
  }

  return Array.isArray(config) ? config : [];
}

function valueFor(object, key) {
  return object?.[key] ?? object?.get?.(key);
}

function configuredSocialFieldIds(site) {
  const siteFields = valueFor(site, "user_fields");
  if (typeof siteFields?.find !== "function") {
    return new Set();
  }

  const ids = new Set();

  for (const entry of socialLinksConfig()) {
    if (!entry) {
      continue;
    }

    const name = String(entry.user_field || "").trim();
    if (!name) {
      continue;
    }

    // Match the same first field by name that LinksSettings uses.
    const field = siteFields.find(
      (candidate) => valueFor(candidate, "name") === name
    );
    const id = valueFor(field, "id");

    if (id !== undefined && id !== null) {
      ids.add(String(id));
    }
  }

  return ids;
}

function withoutConfiguredSocialFields(fields, site) {
  if (typeof fields?.filter !== "function") {
    return fields;
  }

  const socialFieldIds = configuredSocialFieldIds(site);
  if (!socialFieldIds.size) {
    return fields;
  }

  return fields.filter((item) => {
    const id = valueFor(item?.field, "id");
    return id === undefined || id === null || !socialFieldIds.has(String(id));
  });
}

export default apiInitializer("1.13.0", (api) => {
  api.renderInOutlet("user-post-names", SocialLinksClickable);
  api.renderInOutlet("user-card-post-names", SocialLinksClickable);

  // Discourse only sends non-staff viewers custom-field values when a native
  // visibility flag is enabled. For this theme component the social fields
  // should use "Show on user profile" as that publication flag, while "Show on
  // user card" stays disabled. Hide those same configured social fields from
  // the profile's native text list so only the icons remain. This does not alter
  // model.user_fields or backend authorization.
  api.modifyClass(
    "controller:user",
    (Superclass) =>
      class extends Superclass {
        get publicUserFields() {
          return withoutConfiguredSocialFields(
            super.publicUserFields,
            this.site
          );
        }
      }
  );
});
