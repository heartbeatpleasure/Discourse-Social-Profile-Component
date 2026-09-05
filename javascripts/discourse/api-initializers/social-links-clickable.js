import { apiInitializer } from "discourse/lib/api";
import SocialLinksClickable from "../components/social-links-clickable";

function renderedSocialFieldIds(model, container) {
  try {
    const linksSettings = container?.lookup?.("service:links-settings");
    const items = linksSettings?.fieldOptions?.(model);

    if (!Array.isArray(items)) {
      return new Set();
    }

    return new Set(
      items
        .map((item) => item?.userFieldId)
        .filter((id) => id !== undefined && id !== null)
        .map(String)
    );
  } catch {
    // Fail open: if the service/model is unavailable, leave Discourse's native
    // profile fields untouched rather than hiding something unexpectedly.
    return new Set();
  }
}

function withoutRenderedSocialFields(fields, model, container) {
  if (typeof fields?.filter !== "function") {
    return fields;
  }

  const socialFieldIds = renderedSocialFieldIds(model, container);
  if (!socialFieldIds.size) {
    return fields;
  }

  return fields.filter((item) => {
    const field = item?.field;
    const id = field?.id ?? field?.get?.("id");
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
  // the profile's native text list only when LinksSettings actually builds a
  // valid icon/link for that user. Invalid, empty or disabled entries fail open
  // and keep Discourse's native text visible. This does not alter model.user_fields
  // or backend authorization.
  api.modifyClass(
    "controller:user",
    (Superclass) =>
      class extends Superclass {
        get publicUserFields() {
          return withoutRenderedSocialFields(
            super.publicUserFields,
            this.model,
            api.container
          );
        }
      }
  );
});
