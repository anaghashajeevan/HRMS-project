"""
Whitelisted formula parser for salary component calculations.
Uses Python's ast module to parse and evaluate SAFE math expressions only.

ALLOWED:
  - Numeric literals (int, float)
  - Variables (from provided context dict)
  - Operators: + - * / // % **
  - Parentheses
  - Functions: min, max, round, abs

BLOCKED:
  - Function definitions
  - Attribute access (obj.attr)
  - Subscripts (obj[key])
  - Imports
  - Any name not in context or ALLOWED_FUNCTIONS
  - eval, exec, __class__, __import__, etc.

Example:
    parser = FormulaParser()
    result = parser.evaluate(
        'min(basic, 15000) * 0.12',
        {'basic': Decimal('20000')}
    )
    # Returns Decimal('1800.00')
"""

import ast
import operator
from decimal import Decimal, ROUND_HALF_UP

# Operators that are safe
_BINARY_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}

_UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}

# Functions whitelisted for use in formulas
ALLOWED_FUNCTIONS = {
    'min': min,
    'max': max,
    'abs': abs,
    'round': lambda x, n=2: Decimal(str(x)).quantize(
        Decimal('0.1') ** n, rounding=ROUND_HALF_UP,
    ),
}


class FormulaError(Exception):
    """Raised for invalid or unsafe formulas."""
    pass


class FormulaParser:
    """
    Deterministic evaluator for whitelisted math expressions.
    All numeric operations use Decimal for precision.
    """

    def __init__(self):
        self.max_depth = 20  # Prevent nested-expression DoS

    def evaluate(self, expression, context):
        """
        Evaluate a formula string with a context dict.

        Args:
            expression: str, the formula (e.g., 'basic * 0.40')
            context: dict mapping variable names to Decimal values

        Returns:
            Decimal result

        Raises:
            FormulaError: if the formula is invalid or unsafe
        """
        if not expression or not str(expression).strip():
            return Decimal('0')
        # Older/manual records may contain these UI placeholders in the
        # formula column. They mean "no formula" and must not be parsed as
        # variable references (for example, Unknown variable: 'blank').
        if str(expression).strip().lower() in {'blank', 'none', 'null'}:
            return Decimal('0')

        # Normalize context values to Decimal
        safe_context = {}
        for key, value in context.items():
            if not isinstance(key, str) or not key.isidentifier():
                raise FormulaError(f"Invalid context key: {key}")
            try:
                safe_context[key.lower()] = Decimal(str(value))
            except Exception:
                raise FormulaError(f"Context value for '{key}' is not numeric: {value}")

        # Parse to AST
        try:
            tree = ast.parse(expression, mode='eval')
        except SyntaxError as e:
            raise FormulaError(f"Syntax error in formula: {e}")

        # Walk and evaluate
        try:
            result = self._eval_node(tree.body, safe_context, depth=0)
        except FormulaError:
            raise
        except Exception as e:
            raise FormulaError(f"Evaluation error: {e}")

        # Final result as Decimal
        if not isinstance(result, Decimal):
            try:
                result = Decimal(str(result))
            except Exception:
                raise FormulaError(f"Formula did not produce a numeric result: {result}")

        return result

    def _eval_node(self, node, context, depth):
        """Recursive AST evaluator with depth guard."""
        if depth > self.max_depth:
            raise FormulaError(f"Formula exceeds max depth of {self.max_depth}")

        # Numeric literal (int, float)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return Decimal(str(node.value))
            raise FormulaError(f"Unsupported constant: {node.value!r}")

        # Variable reference
        if isinstance(node, ast.Name):
            normalized_name = node.id.lower()
            if normalized_name in context:
                return context[normalized_name]
            raise FormulaError(f"Unknown variable: '{node.id}'")

        # Binary operation
        if isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type not in _BINARY_OPS:
                raise FormulaError(f"Operator not allowed: {op_type.__name__}")
            left = self._eval_node(node.left, context, depth + 1)
            right = self._eval_node(node.right, context, depth + 1)
            try:
                return _BINARY_OPS[op_type](left, right)
            except ZeroDivisionError:
                raise FormulaError("Division by zero")

        # Unary operation (+x, -x)
        if isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type not in _UNARY_OPS:
                raise FormulaError(f"Unary operator not allowed: {op_type.__name__}")
            operand = self._eval_node(node.operand, context, depth + 1)
            return _UNARY_OPS[op_type](operand)

        # Function call
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name):
                raise FormulaError("Only direct function calls allowed")
            func_name = node.func.id
            if func_name not in ALLOWED_FUNCTIONS:
                raise FormulaError(f"Function not allowed: '{func_name}'")
            if node.keywords:
                raise FormulaError("Keyword arguments not supported in formulas")
            args = [
                self._eval_node(arg, context, depth + 1)
                for arg in node.args
            ]
            try:
                return ALLOWED_FUNCTIONS[func_name](*args)
            except Exception as e:
                raise FormulaError(f"{func_name}() failed: {e}")

        # Anything else is blocked
        raise FormulaError(
            f"Expression type not allowed: {type(node).__name__}"
        )


# Convenience singleton
_default_parser = FormulaParser()


def evaluate_formula(expression, context):
    """Shortcut for one-off evaluation."""
    return _default_parser.evaluate(expression, context)
