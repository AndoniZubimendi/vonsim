import { klona } from "klona/json";
import type { Merge } from "type-fest";
import { CompilerError, includes, PositionRange } from "../common";
import {
  DATA_DIRECTIVES,
  INSTRUCTIONS,
  REGISTERS,
  RegisterType,
  Token,
  TokenType,
} from "../lexer/tokens";
import type { DataDirectiveValue, NumberExpression, Operand, Statement } from "./grammar";

/**
 * The parser is responsible for taking a list of tokens and turning it into a
 * list of statements.
 *
 * It is a class because it maintains state as it parses the tokens, although it
 * could be refactored to be pure functions.
 *
 * This parser parses each line individually, which can be
 * - an origin change,
 * - an end statement,
 * - a data directive,
 * - or an instruction.
 *
 * The last two can have multiple operands separated by commas. Inside each operand,
 * there can be a number expression, which is a sequence of numbers and operators
 * that can be evaluated at compile time.
 *
 * The number expression parser is a recursive descent parser, which means that
 * it uses a set of functions to parse the tokens. Each function is responsible
 * for parsing a specific type of statement, and it calls other functions to parse
 * sub-parts of the statement.
 *
 * The parser is also responsible for validating the syntax of the source code.
 * For example, it will throw an error if it encounters a token that it doesn't
 * expect. More extensive validation is done by the semantic analyzer.
 */
export class Parser {
  private current = 0;
  private statements: Statement[] = [];
  private parsed = false;

  constructor(private tokens: Token[]) {}

  parseTokens(): Statement[] {
    if (this.parsed) throw new Error("Parser has already been used.");
    else this.parsed = true;

    this.current = 0;
    this.statements = [];

    while (!this.isAtEnd()) {
      if (this.check("EOL")) {
        this.advance();
        continue;
      }

      // First, parse special statements
      if (this.check("ORG")) {
        const token = this.advance();
        const addressToken = this.consume("NUMBER", "Expected address after ORG");
        const address = this.parseNumber(addressToken);

        this.addStatement({
          type: "origin-change",
          newAddress: address,
          position: this.calculatePositionRange(token, addressToken),
        });

        this.expectEOL();
        continue;
      }

      if (this.check("END")) {
        const token = this.advance();
        this.addStatement({
          type: "end",
          position: this.calculatePositionRange(token),
        });
        while (this.check("EOL")) {
          this.advance();
        }
        if (!this.isAtEnd()) {
          throw CompilerError.fromToken("END must be the last instruction", token);
        }
        continue;
      }

      const label = this.label();
      const token = this.advance();

      if (includes(DATA_DIRECTIVES, token.type)) {
        const statement = {
          type: "data",
          directive: token.type,
          label,
          values: [this.dataDirectiveValue()], // There must be at least one value
          position: this.calculatePositionRange(token),
        } satisfies Statement;

        while (this.check("COMMA")) {
          this.advance();
          statement.values.push(this.dataDirectiveValue());
        }

        this.expectEOL();

        this.addStatement(statement);
        continue;
      }

      if (includes(INSTRUCTIONS, token.type)) {
        const statement = {
          type: "instruction",
          instruction: token.type,
          label,
          operands: [] as Operand[],
          position: this.calculatePositionRange(token),
        } satisfies Statement;

        // Check for zeroary instructions
        if (this.check("EOL")) {
          this.addStatement(statement);
          continue;
        } else {
          statement.operands.push(this.instructionOperand());
        }

        while (this.check("COMMA")) {
          this.advance();
          statement.operands.push(this.instructionOperand());
        }

        this.expectEOL();

        this.addStatement(statement);
        continue;
      }

      throw CompilerError.fromToken(`Expected instruction, got ${token.type}`, token);
    }

    return this.statements;
  }

  // #=========================================================================#
  // # Helpers                                                                 #
  // #=========================================================================#

  private addStatement(statement: Statement) {
    // Clones the statement to prevent mutation
    this.statements.push(klona(statement));
  }

  private advance() {
    return this.tokens[this.current++];
  }

  private calculatePositionRange(...tokens: [Token, ...Token[]]): PositionRange {
    let leftmost = tokens[0];
    let rightmost = tokens[0];

    for (const token of tokens) {
      if (token.position < leftmost.position) leftmost = token;
      else if (token.position > rightmost.position) rightmost = token;
    }

    return [leftmost.position, rightmost.position + rightmost.lexeme.length];
  }

  private check(type: TokenType) {
    return this.peek().type === type;
  }

  private checkNext(type: TokenType) {
    return this.peekNext().type === type;
  }

  private consume<T extends TokenType>(type: T, onError?: string): Merge<Token, { type: T }> {
    if (!this.check(type)) {
      throw CompilerError.fromToken(
        (onError || `Expected ${type}`) + `, got ${this.peek().lexeme}`,
        this.peek(),
      );
    }
    return this.advance() as any;
  }

  private expectEOL() {
    if (this.isAtEnd()) {
      throw CompilerError.fromToken(`The program must end with an END instruction.`, this.peek());
    }
    if (!this.check("EOL")) {
      throw CompilerError.fromToken(`Expected EOL, got ${this.peek().type}`, this.peek());
    }
    return this.advance();
  }

  private isAtEnd() {
    return this.check("EOF");
  }

  private match(...types: TokenType[]) {
    for (const type of types) {
      if (this.check(type)) {
        return true;
      }
    }

    return false;
  }

  private parseNumber(t: Token) {
    if (t.lexeme.at(-1) === "h" || t.lexeme.at(-1) === "H") {
      return parseInt(t.lexeme.slice(0, -1), 16);
    } else if (t.lexeme.at(-1) === "b" || t.lexeme.at(-1) === "B") {
      return parseInt(t.lexeme.slice(0, -1), 2);
    } else {
      return parseInt(t.lexeme, 10);
    }
  }

  private parseString(t: Token) {
    return t.lexeme.slice(1, -1);
  }

  private peek() {
    return this.tokens[this.current];
  }

  private peekNext() {
    return this.tokens[this.current + 1];
  }

  // #=========================================================================#
  // # Parse labels                                                            #
  // #=========================================================================#

  private label(): string | null {
    if (!this.check("IDENTIFIER") || !this.checkNext("COLON")) {
      return null;
    }

    const labelToken = this.advance();
    const label = labelToken.lexeme.toUpperCase(); // all labels are uppercase
    const colonToken = this.advance();

    const duplicatedLabel = this.statements.find(s => "label" in s && s.label === label);
    if (duplicatedLabel) {
      throw CompilerError.fromPositionRange(
        `Duplicated label: ${label}`,
        this.calculatePositionRange(labelToken, colonToken),
      );
    }

    while (this.check("EOL")) {
      this.advance();
    }

    return label;
  }

  // #=========================================================================#
  // # Parse operands                                                          #
  // #=========================================================================#

  private dataDirectiveValue(): DataDirectiveValue {
    if (this.check("STRING")) {
      const stringToken = this.advance();
      return {
        type: "string",
        value: this.parseString(stringToken),
        position: this.calculatePositionRange(stringToken),
      };
    }

    if (this.check("QUESTION_MARK")) {
      const questionMarkToken = this.advance();
      return {
        type: "unassigned",
        position: this.calculatePositionRange(questionMarkToken),
      };
    }

    return this.numberExpression();
  }

  private instructionOperand(): Operand {
    if (this.match(...REGISTERS)) {
      const registerToken = this.advance() as Merge<Token, { type: RegisterType }>;
      return {
        type: "register",
        value: registerToken.type,
        position: this.calculatePositionRange(registerToken),
      };
    }

    if (this.check("IDENTIFIER")) {
      const identifierToken = this.advance();
      return {
        type: "memory-direct",
        label: identifierToken.lexeme.toUpperCase(),
        position: this.calculatePositionRange(identifierToken),
      };
    }

    if (this.match("BYTE", "WORD", "LEFT_BRACKET")) {
      let mode: "auto" | "byte" | "word";
      let start: Token;
      if (this.check("LEFT_BRACKET")) {
        mode = "auto";
        start = this.advance();
      } else {
        mode = this.check("BYTE") ? "byte" : "word";
        start = this.advance();
        this.consume("PTR", `Expected "PTR" after "${mode.toUpperCase()}"`);
        this.consume("LEFT_BRACKET", `Expected "[" after "${mode.toUpperCase()} PTR"`);
      }

      if (this.check("BX")) {
        this.advance();
        const rbracket = this.consume("RIGHT_BRACKET", 'Expected "]" after "BX"');
        return {
          type: "memory-indirect",
          mode,
          value: { type: "BX" },
          position: this.calculatePositionRange(start, rbracket),
        };
      } else {
        const calc = this.numberExpression();
        const rbracket = this.consume("RIGHT_BRACKET", 'Expected "]" after expression');
        return {
          type: "memory-indirect",
          mode,
          value: calc,
          position: this.calculatePositionRange(start, rbracket),
        };
      }
    }

    const calc = this.numberExpression();
    return {
      type: "immediate",
      value: calc,
      position: calc.position,
    };
  }

  // #=========================================================================#
  // # Parse number expression (NE)                                            #
  // #=========================================================================#

  private unaryNE(): NumberExpression {
    if (this.match("PLUS", "MINUS")) {
      const operatorToken = this.advance();
      const right = this.unaryNE();
      return {
        type: "unary-operation",
        operator: operatorToken.type === "PLUS" ? "+" : "-",
        right,
        position: [operatorToken.position, right.position[1]],
      };
    }

    return this.primaryNE();
  }

  private primaryNE(): NumberExpression {
    if (this.check("NUMBER")) {
      const numberToken = this.advance();
      const value = this.parseNumber(numberToken);
      return {
        type: "number-literal",
        value,
        position: this.calculatePositionRange(numberToken),
      };
    }

    if (this.check("OFFSET")) {
      const offsetToken = this.advance();
      const identifierToken = this.consume("IDENTIFIER", "Expected label after OFFSET");
      return {
        type: "label",
        value: identifierToken.lexeme.toUpperCase(),
        offset: true,
        position: this.calculatePositionRange(offsetToken, identifierToken),
      };
    }

    if (this.check("IDENTIFIER")) {
      const identifierToken = this.advance();
      return {
        type: "label",
        value: identifierToken.lexeme.toUpperCase(),
        offset: false,
        position: this.calculatePositionRange(identifierToken),
      };
    }

    if (this.check("LEFT_PAREN")) {
      const lparen = this.advance();
      let expression = this.numberExpression();
      const rparen = this.consume("RIGHT_PAREN", "Expected )");
      return {
        ...expression,
        position: this.calculatePositionRange(lparen, rparen),
      };
    }

    throw CompilerError.fromToken("Expected argument", this.peek());
  }

  private factorNE(): NumberExpression {
    let expression = this.unaryNE();

    while (this.match("ASTERISK")) {
      this.advance();
      const right = this.unaryNE();
      expression = {
        type: "binary-operation",
        left: expression,
        right,
        operator: "*",
        position: [expression.position[0], right.position[1]],
      };
    }

    return expression;
  }

  private termNE(): NumberExpression {
    let expression = this.factorNE();

    while (this.match("PLUS", "MINUS")) {
      const operatorToken = this.advance();
      const right = this.factorNE();
      expression = {
        type: "binary-operation",
        left: expression,
        right,
        operator: operatorToken.type === "PLUS" ? "+" : "-",
        position: [expression.position[0], right.position[1]],
      };
    }

    return expression;
  }

  private numberExpression(): NumberExpression {
    return this.termNE();
  }
}