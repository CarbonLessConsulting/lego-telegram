// Brick: telegram-bot-snapshot-test v0.1.0 (le-GO G-Ops)
// Asserzioni: subset deep + predicati semplici.

export interface AssertResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verifica che `actual` contenga TUTTI i campi di `expected` con valori uguali (deep).
 * Campi extra in `actual` sono OK.
 *
 * Esempio:
 *   isSubset({ok: true}, {ok: true, cost: 0.5}) → ok
 *   isSubset({ok: true, cost: 1}, {ok: true, cost: 0.5}) → fail
 */
export function isSubset(expected: unknown, actual: unknown, path = ""): AssertResult {
  if (expected === null || expected === undefined) {
    if (actual === expected) return { ok: true };
    return { ok: false, reason: `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
  }

  if (typeof expected !== "object") {
    if (expected === actual) return { ok: true };
    return { ok: false, reason: `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return { ok: false, reason: `${path}: expected array, got ${typeof actual}` };
    }
    if (expected.length !== actual.length) {
      return { ok: false, reason: `${path}: expected array len ${expected.length}, got ${actual.length}` };
    }
    for (let i = 0; i < expected.length; i++) {
      const r = isSubset(expected[i], actual[i], `${path}[${i}]`);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  if (typeof actual !== "object" || actual === null) {
    return { ok: false, reason: `${path}: expected object, got ${typeof actual}` };
  }

  for (const key of Object.keys(expected as Record<string, unknown>)) {
    const r = isSubset(
      (expected as Record<string, unknown>)[key],
      (actual as Record<string, unknown>)[key],
      path ? `${path}.${key}` : key,
    );
    if (!r.ok) return r;
  }
  return { ok: true };
}

/**
 * Valuta predicato semplice del tipo:
 *   "field >= 1"
 *   "field == 'ok'"
 *   "field exists"
 *
 * Path con dot supportato (es. "data.cost").
 */
export function evaluatePredicate(predicate: string, body: unknown): AssertResult {
  // Sintassi: <field> <op> <value>  |  <field> exists
  const existsMatch = predicate.match(/^(\S+)\s+exists$/);
  if (existsMatch) {
    const val = getByPath(body, existsMatch[1]);
    return val !== undefined
      ? { ok: true }
      : { ok: false, reason: `field "${existsMatch[1]}" missing` };
  }

  const opMatch = predicate.match(/^(\S+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (!opMatch) return { ok: false, reason: `cannot parse predicate "${predicate}"` };

  const [, field, op, rawValue] = opMatch;
  const actualVal = getByPath(body, field);

  let expectedVal: unknown = rawValue.trim();
  // Cast numerico se possibile
  const num = Number(expectedVal);
  if (!Number.isNaN(num) && String(num) === expectedVal) expectedVal = num;
  // Cast boolean
  if (expectedVal === "true") expectedVal = true;
  if (expectedVal === "false") expectedVal = false;
  // Strip quotes
  if (typeof expectedVal === "string") {
    expectedVal = expectedVal.replace(/^['"]|['"]$/g, "");
  }

  switch (op) {
    case "==": return actualVal === expectedVal ? { ok: true } : { ok: false, reason: `${field}=${JSON.stringify(actualVal)} !== ${JSON.stringify(expectedVal)}` };
    case "!=": return actualVal !== expectedVal ? { ok: true } : { ok: false, reason: `${field}=${JSON.stringify(actualVal)} === ${JSON.stringify(expectedVal)}` };
    case ">=": return Number(actualVal) >= Number(expectedVal) ? { ok: true } : { ok: false, reason: `${field}=${actualVal} < ${expectedVal}` };
    case "<=": return Number(actualVal) <= Number(expectedVal) ? { ok: true } : { ok: false, reason: `${field}=${actualVal} > ${expectedVal}` };
    case ">":  return Number(actualVal) > Number(expectedVal)  ? { ok: true } : { ok: false, reason: `${field}=${actualVal} <= ${expectedVal}` };
    case "<":  return Number(actualVal) < Number(expectedVal)  ? { ok: true } : { ok: false, reason: `${field}=${actualVal} >= ${expectedVal}` };
    default:   return { ok: false, reason: `unsupported op "${op}"` };
  }
}

function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur && typeof cur === "object") {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
