/**
 * Deterministic (Level 0) execution: no model, no network call.
 * Only handles arithmetic and structured extraction — anything else
 * falls through to the Router for a stronger execution path.
 */

/** Recursive-descent evaluator for +, -, *, div, ^, () with standard precedence. No eval(). */
export function evaluateArithmetic(expr: string): number {
  const tokens = expr.match(/[0-9.]+|[+\-*/().%^]/g);
  if (!tokens) throw new Error("No tokens found");
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next();
      const rhs = parseFactor();
      if (op === "*") value *= rhs;
      else if (op === "/") value /= rhs;
      else value %= rhs;
    }
    return value;
  }

  function parseFactor(): number {
    let value = parseUnary();
    while (peek() === "^") {
      next();
      const rhs = parseUnary();
      value = Math.pow(value, rhs);
    }
    return value;
  }

  function parseUnary(): number {
    if (peek() === "-") {
      next();
      return -parseUnary();
    }
    return parseAtom();
  }

  function parseAtom(): number {
    const token = next();
    if (token === "(") {
      const value = parseExpr();
      if (next() !== ")") throw new Error("Mismatched parentheses");
      return value;
    }
    const num = Number(token);
    if (Number.isNaN(num)) throw new Error(`Unexpected token: ${token}`);
    return num;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("Unexpected trailing tokens");
  return result;
}

export function extractEmails(text: string): string[] {
  return Array.from(new Set(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []));
}
