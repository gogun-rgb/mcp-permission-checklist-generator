import templatesJson from "./mcpTemplates.json";
import type { McpTemplateMap } from "./checklist-types";

export * from "./checklist-types";
export * from "./constants";

export const mcpTemplates = templatesJson as McpTemplateMap;
