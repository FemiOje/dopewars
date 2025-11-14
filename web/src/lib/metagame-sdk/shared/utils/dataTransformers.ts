import { logger } from "./logger";

export const parseContextData = (rawContext: any): { name: string; description: string; contexts: any } => {
  if (!rawContext) {
    return { name: "", description: "", contexts: {} };
  }

  try {
    let name = "";
    let description = "";
    let contexts: any = {};

    if (typeof rawContext === "object" && rawContext !== null) {
      name = rawContext.Name || rawContext.name || "";
      description = rawContext.Description || rawContext.description || "";
      contexts = rawContext.contexts || rawContext;
    } else if (typeof rawContext === "string") {
      const parsed = JSON.parse(rawContext);
      name = parsed.Name || parsed.name || "";
      description = parsed.Description || parsed.description || "";
      contexts = parsed.contexts || parsed;
    } else {
      contexts = rawContext;
    }

    if (contexts.Contexts && typeof contexts.Contexts === "object") {
      contexts = contexts.Contexts;
    }

    if (typeof contexts === "object" && contexts !== null) {
      const { name, Name, description, Description, ...rest } = contexts;
      contexts = rest;
    }

    return { name, description, contexts };
  } catch (error) {
    logger.warn("Failed to parse context data:", error);
    return { name: "", description: "", contexts: {} };
  }
};

export const parseSettingsData = (rawSettings: any): { name: string; description: string; data: any } => {
  if (!rawSettings) {
    return { name: "", description: "", data: {} };
  }

  try {
    if (typeof rawSettings === "object" && rawSettings !== null) {
      return {
        name: rawSettings.Name || rawSettings.name || "",
        description: rawSettings.Description || rawSettings.description || "",
        data: rawSettings.data || rawSettings.Settings || rawSettings,
      };
    }

    if (typeof rawSettings === "string") {
      const parsed = JSON.parse(rawSettings);
      return {
        name: parsed.Name || parsed.name || "",
        description: parsed.Description || parsed.description || "",
        data: parsed.data || parsed.Settings || parsed,
      };
    }

    return { name: "", description: "", data: rawSettings };
  } catch (error) {
    logger.warn("Failed to parse settings data:", error);
    return { name: "", description: "", data: {} };
  }
};
