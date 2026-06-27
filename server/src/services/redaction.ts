const redactionRules: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /sk-[a-zA-Z0-9_-]{8,}/g,
    replacement: "sk-****"
  },
  {
    pattern: /ghp_[a-zA-Z0-9_]{8,}/g,
    replacement: "ghp_****"
  },
  {
    pattern: /github_pat_[a-zA-Z0-9_]{8,}/g,
    replacement: "github_pat_****"
  },
  {
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: "AKIA****"
  },
  {
    pattern: /Bearer\s+[a-zA-Z0-9._~+/=-]{10,}/gi,
    replacement: "Bearer ****"
  },
  {
    pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
    replacement: "jwt.****"
  },
  {
    pattern:
      /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|sessionid|session|cookie)\s*[:=]\s*["']?[^"'\s,;]+/gi,
    replacement: "$1=****"
  },
  {
    pattern: /\b(sessionid|connect\.sid|sid|auth|jwt)\s*=\s*[^;\s]+/gi,
    replacement: "$1=****"
  },
  {
    pattern: /(password|passwd|pwd|비밀번호)\s+(is|는|:)?\s*[^,\s.;]+/gi,
    replacement: "$1 ****"
  }
];

export function redactSensitiveText(value: string): string {
  return redactionRules.reduce((current, rule) => {
    rule.pattern.lastIndex = 0;
    return current.replace(rule.pattern, rule.replacement);
  }, value);
}

export function containsSensitiveText(value: string): boolean {
  return redactionRules.some((rule) => {
    rule.pattern.lastIndex = 0;
    return rule.pattern.test(value);
  });
}
