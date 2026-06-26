import type { McpTemplate } from "../types/checklist";
import { categoryLabels } from "../utils/formatters";

interface PermissionSelectorProps {
  template: McpTemplate;
  selectedIds: string[];
  onToggle: (permissionId: string) => void;
}

export function PermissionSelector({
  template,
  selectedIds,
  onToggle
}: PermissionSelectorProps) {
  return (
    <div className="permission-selector">
      {template.permissionGroups.map((group) => (
        <fieldset className="permission-group" key={group.label}>
          <legend>{group.label}</legend>
          <div className="checkbox-grid">
            {group.permissions.map((permission) => (
              <label className="check-row" key={permission.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(permission.id)}
                  onChange={() => onToggle(permission.id)}
                />
                <span>
                  <strong>{permission.name}</strong>
                  <small>
                    {categoryLabels[permission.category]} · 위험 점수 {permission.riskScore}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
