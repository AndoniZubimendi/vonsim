package vonsim.assembly

import vonsim.assembly.lexer.Lexer

import scala.collection.mutable
import vonsim.assembly.lexer.EMPTY
import vonsim.assembly.lexer.Token
import vonsim.simulator
import vonsim.simulator._
import vonsim.assembly.parser.ZeroAry
import vonsim.utils.CollectionUtils._
import vonsim.assembly.parser.LabeledInstruction
import scala.util.parsing.input.Positional
import vonsim.assembly.lexer.VarType
import scala.collection.mutable.ListBuffer
import vonsim.assembly.parser.VarDef
import vonsim.simulator.UndefinedIndirectMemoryAddress
import PositionalExtension._
import vonsim.assembly.parser.ConstantExpression
import vonsim.assembly.parser.BinaryExpression
import vonsim.assembly.lexer.ExpressionOperation
import vonsim.assembly.lexer.PlusOp
import vonsim.assembly.lexer.MultOp
import vonsim.assembly.lexer.DivOp
import vonsim.assembly.lexer.MinusOp
import vonsim.assembly.parser.LabelExpression
import vonsim.assembly.parser.OffsetLabelExpression
import vonsim.assembly.i18n.CompilerLanguage
import vonsim.assembly.i18n.English
import scala.util.Random
import vonsim.assembly.lexer.DB
import vonsim.assembly.lexer.LowRegisterToken

object Compiler {

  class SuccessfulCompilation(
    val instructions: List[InstructionInfo],
    val addressToInstruction: Map[MemoryAddress, InstructionInfo],
    val variablesMemory: Map[MemoryAddress, Int],
    val instructionsMemory: Map[MemoryAddress, Int],
    val warnings: List[Warning]
  ) {
    override def toString() = {
      s"SuccessfulCompilation(${instructions.length} instructions)"
    }
  }
  class FailedCompilation(
    val instructions: List[Either[CompilationError, InstructionInfo]],
    val globalErrors: List[GlobalError]
  ) {
    override def toString() = {
      s"FailedCompilation:\n ${instructions.lefts().mkString("\n")}"
    }
  }
  type InstructionCompilationResult =
    Either[CompilationError, simulator.InstructionInfo]
  type CompilationResult = Either[FailedCompilation, SuccessfulCompilation]
  type MemoryAddress = Int
  type Warning = (Line, String)
  type Line = Int
  type ParsingResult = List[Either[CompilationError, parser.Instruction]]
  var language: CompilerLanguage = new English()

  def setLanguage(c: CompilerLanguage) {
    language = c
    Lexer.compilerLanguage = c
    parser.Parser.compilerLanguage = c
  }

  def apply(
    code: String,
    compilerLanguage: CompilerLanguage = language
  ): CompilationResult = {
    setLanguage(compilerLanguage)
    val rawInstructions = code.split("(\r\n)|\r|\n")
    var optionTokens = rawInstructions map { Lexer(_) }
    //optionTokens.foreach(f => println(f))

    val fixedTokens = Lexer.fixLineNumbers(optionTokens)
    val fixedTokensNoEmpty = fixedTokens.filter(p => {
      !(p.isRight && p.right.get.length == 1 && p.right.get(0).equals(EMPTY()))
    })
    
    
    
    
    def parseValidTokens(
      t: Either[LexerError, List[Token]]
    ): Either[CompilationError, parser.Instruction] = {
      if (t.isLeft) Left(t.left.get) else parser.Parser(t.right.get.toSeq)
    }

    val parsedInstructions = fixedTokensNoEmpty map parseValidTokens toList
    
    
    
    //    println("Compiler: parsed instructions")
    //    parsedInstructions.foreach(f => println(f))

    val compilation =
      transformToSimulatorInstructions(parsedInstructions, rawInstructions)
    compilation
  }

  def transformToSimulatorInstructions(
    instructions: ParsingResult,
    rawInstructions: Array[String]
  ): CompilationResult = {
    if (instructions.isEmpty) {
      return Left(
        new FailedCompilation(
          List(),
          List(GlobalError(Option.empty, language.emptyProgram))
        )
      )
    }
    var ins = instructions
    val globalErrors = mutable.ListBuffer[GlobalError]()

    // check final end
    if (!(instructions.last.isRight && instructions.last.right.get
          .isInstanceOf[parser.End])) {
      globalErrors += GlobalError(Option.empty, language.missingEnd)
    }
    ins = checkRepeatedEnds(ins)
    ins = checkRepeatedLabels(ins)
//    ins = checkExpressionLabelReferences(ins)
    ins = checkLoopsInLabels(ins)
    ins = checkFirstOrgBeforeInstructionsWithAddress(ins)

    val firstPassResolver = new FirstPassResolver(ins)

    //    println("Vardef label to line " + firstPassResolver.vardefLabelToLine)
    //    println("Vardef label to type" + firstPassResolver.vardefLabelToType)
    //    println("jump label to line" + firstPassResolver.jumpLabelToLine)
    //    ins.foreach(println(_))
    val unlabeledInstructions = unlabelInstructions(ins)
    

    //Transform from parser.Instruction to simulator.Instruction
    // Note that at this point the jump and memory addresses are actually dummy values
//    println("Performing first pass of compilation..")
    val firstPassResult = compileInstructions(
      unlabeledInstructions,
      firstPassResolver,
      rawInstructions
    )
//    print("FP: "+firstPassResult)
    if (firstPassResult.allRight && globalErrors.isEmpty) {
      //      println(s"Instructions $r")
      val firstPassInstructions = firstPassResult.rights
      val warnings = ListBuffer[Warning]()
      val hltFirstPassInstructions = firstPassInstructions.filter(_.instruction == Hlt)
      if (hltFirstPassInstructions.isEmpty) {
      	//println("Verificó que no tuviera Hlt")
      	if(hltFirstPassInstructions.filter(_.instruction == IntN(WordValue(0))).isEmpty) {
      		//println("Verificó que no tuviera Int 0")
	        val hltWarning = (0, language.noHltInstructionsWarning)
	        warnings += hltWarning
      	}
      }

      //Build a db of information after getting correctly parsed instructions
//      println("Performing second pass of compilation..")
      val secondPassResolver =
        new SecondPassResolver(firstPassInstructions, firstPassResolver)
      //println("Memory"+memory)
      //println("Vardef address" + vardefLineToAddress)
      //println("executable" + executableLineToAddress)
      val secondPassResult = compileInstructions(
        unlabeledInstructions,
        secondPassResolver,
        rawInstructions
      )
      if (secondPassResult.allRight) {
        val secondPassInstructions = secondPassResult.rights()

        val (variablesMemory, instructionsMemory) = getMemory(
          secondPassInstructions,
          secondPassResolver.executableLineToAddress
        )
        val executableInstructions = secondPassInstructions.filter(
          _.instruction.isInstanceOf[ExecutableInstruction]
        )
        val addressToInstruction = executableInstructions
          .map(x => (secondPassResolver.executableLineToAddress(x.line), x))
          .toMap
        Right(
          new SuccessfulCompilation(
            secondPassInstructions,
            addressToInstruction,
            variablesMemory,
            instructionsMemory,
            warnings.toList
          )
        )
      } else {
        Left(new FailedCompilation(secondPassResult, globalErrors.toList))
      }
    } else {
      Left(new FailedCompilation(firstPassResult, globalErrors.toList))
    }
  }
  def compileInstructions(
    instructions: ParsingResult,
    resolver: Resolver,
    rawInstructions: Array[String]
  ) = {
    instructions.mapRightEither(x => {
      val compiled = parserToSimulatorInstruction(x, resolver)
      val line = x.location.line
      val a = compiled.right.map(
        i => new InstructionInfo(line, i, rawInstructions(line - 1))
      )
      a
    })

  }

  def checkRepeatedEnds(ins: ParsingResult) = {
    val lastLine = ins.last.fold(_.location.line, _.pos.line)
    ins.mapRightEither(_ match {
      case end: parser.End => {
        if (end.pos.line < lastLine) { //
          semanticError(end, language.onlyOneEnd)
        } else { // leave End if it is the last instruction
          Right(end)
        }
      }
      case other => Right(other)
    })
  }

//  def checkExpressionLabelReferences(ins: ParsingResult) = {
//    ins.last.right.get.location.line
//    val equ = ins.collect { case Right(parser.EQUDef(l, e)) => l }
//
//    val refs = ins.collect {
//      case Right(parser.EQUDef(l, e)) => (l, e)
//      case Right(parser.EQUDef(l, e)) => (l, e)
//    }
//    ins
//  }

  def checkLoopsInLabels(ins: ParsingResult) = {

    val graph = makeGraph(ins)
    val loopyLabels = loopyEquStatements(graph)
    ins.mapRightEither(_ match {
      case x @ parser.EQUDef(l, e) =>
        if (loopyLabels.contains(l)) semanticError(x, language.loopsInEqu)
        else Right(x)
      case other => Right(other)
    })

  }
  def makeGraph(ins: ParsingResult) = {
    val equ = ins.collect { case Right(parser.EQUDef(l, e)) => (l, e) }
    val equLabels = equ.map(_._1).toSet
    val graphPairs =
      equ.map(p => (p._1, p._2.labels.toSet.intersect(equLabels)))
    makeMutable(graphPairs.toMap)
  }

  def loopyEquStatements(g: mutable.Map[String, Set[String]]) = {
    var graph = g
    var inDegrees = getInDegrees(graph)
    var edges = inDegrees.filter(_._2 == 0).map(_._1).toSet
    while (!edges.isEmpty) {
      graph --= edges
      graph = graph.map(p => (p._1, p._2.filterNot(s => edges.contains(s))))
      inDegrees = getInDegrees(graph)
      edges = inDegrees.filter(_._2 == 0).map(_._1).toSet
    }
    graph.keySet
  }

  def makeMutable[E, T](a: Map[E, T]): mutable.Map[E, T] = {
    mutable.Map(a.toSeq: _*)
  }
  def getInDegrees(graph: mutable.Map[String, Set[String]]) = {
    val init = graph.keys.map(k => (k, 0))
    val inDegrees = makeMutable(init.toMap)
    graph.foreach(
      p =>
        p._2.foreach(l => {
          inDegrees(l) = inDegrees(l) + 1
        })
    )
    inDegrees
  }

  def checkRepeatedLabels(ins: ParsingResult) = {
    val labels = ins.rights.collect {
      case x: parser.LabelDefinition => x.label
    }
    val labelCounts = mutable.Map[String, Int]()
    labels.foreach(
      label => labelCounts(label) = labelCounts.getOrElse(label, 0) + 1
    )

    ins.mapRightEither(_ match {
      case x: parser.LabelDefinition => {
        if (labelCounts(x.label) > 1) {
          semanticError(x, language.labelWithMultipleDefinitions(x.label))
        } else {
          Right(x)
        }
      }
      case x => Right(x)
    })

  }
  def checkFirstOrgBeforeInstructionsWithAddress(ins: ParsingResult) = {
    val firstOrg =
      ins.indexWhere(x => x.isRight && x.right.get.isInstanceOf[parser.Org])

    ins.zipWithIndex.map {
      case (e, i) =>
        e match {
          case Left(x) => Left(x)
          case Right(x) => {
            if ((i < firstOrg || firstOrg == -1) && (!x
                  .isInstanceOf[parser.NonAddressableInstruction])) {
              semanticError(x, language.noOrg)
            } else {
              Right(x)
            }
          }
        }
    }
  }
  def getMemory(
    instructions: List[InstructionInfo],
    executableLineToAddress: Map[Int, Int]
  ) = {
    val variablesMemory = mutable.Map[MemoryAddress, Int]()
    val instructionsMemory = mutable.Map[MemoryAddress, Int]()

    instructions.foreach(
      f =>
        f.instruction match {
          case v: VarDefInstruction =>
            setMemory(variablesMemory, v)

          case x: ExecutableInstruction => {

            setMemory(
              instructionsMemory,
              executableLineToAddress(f.line),
              Simulator.encode(x)
            )
          }
          case other =>
        }
    )

    (variablesMemory.toMap, instructionsMemory.toMap)
  }
  def setMemory(memory: mutable.Map[MemoryAddress, Int], v: VarDefInstruction) {
    var address = v.address

    v.values.foreach(
      cw =>
        cw match {
          case None => address += v.size

          case Some(value) =>
            value
              .toByteList()
              .foreach(b => {
                memory(address) = b.toInt
                address += 1
              })
        }
    )
  }
  def setMemory(
    memory: mutable.Map[MemoryAddress, Int],
    baseAddress: Int,
    values: List[Word]
  ) {
    var address = baseAddress

    values.foreach(word => {
      memory(address) = word.toInt
      address += 1
    })

  }

  def unlabelInstructions(instructions: ParsingResult): ParsingResult = {

    instructions.mapRight(_ match {
      case li: parser.LabeledInstruction => li.i
      case other                         => other
    })
  }
  
  def getTooLargeValues(t: VarType, values:List[Option[Int]]):List[Int] ={
    val maxBytes = t match{
            case t:lexer.DB => 1
            case t:lexer.DW => 2
          }
    val bytesForValues = values.map(_ match{
      case None=> 0
      case Some(v) => ComputerWord.bytesFor(v)
    })
    val tooLargeValuesIndices = bytesForValues.indicesOf(_>maxBytes)
    val tooLargeValues = tooLargeValuesIndices.map(values(_)).map(_ match{
        case None => 0
        case Some(v) => v
      })
    tooLargeValues  
  }
  
  def parserToSimulatorInstruction(
    i: parser.Instruction,
    resolver: Resolver
  ): Either[CompilationError, simulator.Instruction] = {
    //    println(s"Transforming $i")
    val zeroary = Map(
      parser.Popf() -> Popf,
      parser.Pushf() -> Pushf,
      parser.Hlt() -> Hlt,
      parser.Nop() -> Nop,
      parser.IRet() -> Iret,
      parser.Ret() -> Ret,
      parser.Cli() -> Cli,
      parser.Sti() -> Sti,
      parser.End() -> End
    )

    i match {
      case x: ZeroAry     => successfulTransformation(x, zeroary(x))
      case x: parser.IntN => successfulTransformation(x, IntN(WordValue(x.n)))
      case x: parser.Org  => successfulTransformation(x, Org(x.dir))
      case x: parser.Jump => {
        if (resolver.jumpLabelDefined(x.label)) {
          successfulTransformation(
            x,
            x match {
              case x: parser.ConditionalJump =>
                ConditionalJump(
                  resolver.jumpLabelAddress(x.label),
                  jumpConditions(x.op)
                )
              case x: parser.Call => Call(resolver.jumpLabelAddress(x.label))
              case x: parser.UnconditionalJump =>
                Jump(resolver.jumpLabelAddress(x.label))
            }
          )
        } else {
          semanticError(x, language.labelUndefined(x.label))
        }
      }
      case x: parser.Stack =>
        successfulTransformation(x, x.i match {
          case st: lexer.POP  => Pop(fullRegisters(x.r))
          case st: lexer.PUSH => Push(fullRegisters(x.r))
        })
      case x: parser.Mov =>
        parserToSimulatorBinaryOperands(x, x.m, x.v, resolver).right
          .flatMap(op => successfulTransformation(x, Mov(op)))
      case x: parser.BinaryArithmetic => {
        parserToSimulatorBinaryOperands(x, x.m, x.v, resolver).right.flatMap(
          operands =>
            successfulTransformation(
              x,
              ALUBinary(binaryOperations(x.op), operands)
            )
        )

      }
      case x: parser.UnaryArithmetic =>
        parserToSimulatorOperand(x.m, resolver).right.flatMap(_ match {
          case operand: UnaryOperandUpdatable =>
            successfulTransformation(
              x,
              ALUUnary(unaryOperations(x.op), operand)
            )
          case o: ImmediateOperand =>
            semanticError(
              x,
              language.immediateOperandsNotUpdatable(o.toString())
            )
          case other =>
            semanticError(x, language.operandNotUpdatable(other.toString()))
        })

      case x: parser.VarDef => {
        val undefinedLabels = x.values.collect {
          case Right(e) => resolver.undefinedLabels(e)
        }.flatten
        val a = x.values
        if (!undefinedLabels.isEmpty) {
          semanticError(x, language.labelsUndefined(undefinedLabels))
        } else {
          val values = x.values.map(_ match {
            case Right(e) => {
              Some(resolver.expression(e))
            }
            case Left(u) => None // This is for the case `var DB ?`
          })
          
          val tooLargeValues = getTooLargeValues(x.t, values) 
          
          x.t match {
            case t: lexer.DB => {
              if (tooLargeValues.length > 0){
                semanticError(x,language.dontFitIn8Bits(tooLargeValues))
              }else{
                val wordValues = values.map(_ match{
                  case None=> None
                  case Some(v) => Some(Word(v))       
                })
                
                successfulTransformation(
                  x,
                  WordDef(
                    x.label,
                    resolver.vardefLabelAddress(x.label),
                    wordValues
                  )
                )
              }
            }
            case t: lexer.DW => {
              if (tooLargeValues.length > 0){
                semanticError(x,language.dontFitIn16Bits(tooLargeValues))
              }else{
                  val dwordValues = values.map(_ match{
                    case None=> None
                    case Some(v) => Some(DWord(v))       
                  })
                  successfulTransformation(
                    x,
                    DWordDef(
                      x.label,
                      resolver.vardefLabelAddress(x.label),
                      dwordValues
                    )
                  )
                }
            }
          }
        }
      }
      case x: parser.EQUDef => {
        val undefinedLabels = resolver.undefinedLabels(x.expression)
        if (undefinedLabels.isEmpty) {
          successfulTransformation(
            x,
            EQUDef(x.label, resolver.expression(x.expression))
          )
        } else {
          semanticError(x, language.labelsUndefined(undefinedLabels))
        }

      }
      case x: parser.IO => {
      	successfulTransformation(x, x.op match {
      		case io: lexer.OUT	=> {
		        x.r match {
		      		case lexer.AX()	=> Out(AX, resolver.expression(x.add).toByte)
		      		case lexer.AL() => Out(AL, resolver.expression(x.add).toByte)
		      	}
      		}
      		case io: lexer.IN	=> {
		        x.r match {
		      		case lexer.AX()	=> In(AX, resolver.expression(x.add).toByte)
		      		case lexer.AL() => In(AL, resolver.expression(x.add).toByte)
		      	}
      		}
        })
      }
      case other =>
        semanticError(other, language.instructionNotSupported(other.toString()))

    }

  }

  def successfulTransformation[T](x: parser.Instruction, y: Instruction) = {
    Right[T, Instruction](y)
  }

  def parserToSimulatorBinaryOperands(
    i: parser.Instruction,
    x: lexer.Operand,
    y: lexer.Operand,
    resolver: Resolver
  ): Either[SemanticError, BinaryOperands] = {
    parserToSimulatorOperand(x, resolver).right.flatMap(
      o1 =>
        parserToSimulatorOperand(y, resolver).right
          .flatMap(o2 => unaryOperandsToBinaryOperands(i, o1, o2))
    )
  }

  def unaryOperandsToBinaryOperands(
    i: parser.Instruction,
    op1: UnaryOperand,
    op2: UnaryOperand
  ): Either[SemanticError, BinaryOperands] = {
    (op1, op2) match {
      case (r: FullRegister, x: FullRegister) =>
        Right(DWordRegisterRegister(r, x))
      case (r: HalfRegister, x: HalfRegister) =>
        Right(WordRegisterRegister(r, x))

      case (r: HalfRegister, x: WordValue) => Right(WordRegisterValue(r, x))
      case (r: FullRegister, x: WordValue) =>
        Right(DWordRegisterValue(r, DWordValue(x.v)))
      case (r: FullRegister, x: DWordValue) => Right(DWordRegisterValue(r, x))

      case (r: HalfRegister, x: DirectMemoryAddressOperand) =>
        Right(WordRegisterMemory(r, x.asWord))
      case (r: FullRegister, x: DirectMemoryAddressOperand) =>
        Right(DWordRegisterMemory(r, x.asDWord))

      case (r: HalfRegister, WordIndirectMemoryAddress) =>
        Right(WordRegisterIndirectMemory(r, WordIndirectMemoryAddress))
      case (r: FullRegister, DWordIndirectMemoryAddress) =>
        Right(DWordRegisterIndirectMemory(r, DWordIndirectMemoryAddress))
      case (r: HalfRegister, UndefinedIndirectMemoryAddress) =>
        Right(WordRegisterIndirectMemory(r, WordIndirectMemoryAddress))
      case (r: FullRegister, UndefinedIndirectMemoryAddress) =>
        Right(DWordRegisterIndirectMemory(r, DWordIndirectMemoryAddress))

      case (r: DirectMemoryAddressOperand, x: FullRegister) =>
        Right(DWordMemoryRegister(r.asDWord, x))
      case (r: DirectMemoryAddressOperand, x: HalfRegister) =>
        Right(WordMemoryRegister(r.asWord, x))

      //      case (r: DWordMemoryAddress, x: FullRegister)      => Right(DWordMemoryRegister(r, x))
      //      case (r: WordMemoryAddress, x: HalfRegister)       => Right(WordMemoryRegister(r, x))
      case (r: WordMemoryAddress, x: WordValue) => Right(WordMemoryValue(r, x))
      case (r: DWordMemoryAddress, x: WordValue) =>
        Right(DWordMemoryValue(r, DWordValue(x.v)))
      case (r: DWordMemoryAddress, x: DWordValue) =>
        Right(DWordMemoryValue(r, x))

      case (DWordIndirectMemoryAddress, x: DWordValue) =>
        Right(DWordIndirectMemoryValue(DWordIndirectMemoryAddress, x))
      case (WordIndirectMemoryAddress, x: WordValue) =>
        Right(WordIndirectMemoryValue(WordIndirectMemoryAddress, x))
      case (DWordIndirectMemoryAddress, x: WordValue) =>
        Right(
          DWordIndirectMemoryValue(DWordIndirectMemoryAddress, DWordValue(x.v))
        )

      case (DWordIndirectMemoryAddress, x: FullRegister) =>
        Right(DWordIndirectMemoryRegister(DWordIndirectMemoryAddress, x))
      case (WordIndirectMemoryAddress, x: HalfRegister) =>
        Right(WordIndirectMemoryRegister(WordIndirectMemoryAddress, x))
      case (UndefinedIndirectMemoryAddress, x: FullRegister) =>
        Right(DWordIndirectMemoryRegister(DWordIndirectMemoryAddress, x))
      case (UndefinedIndirectMemoryAddress, x: HalfRegister) =>
        Right(WordIndirectMemoryRegister(WordIndirectMemoryAddress, x))

      case (UndefinedIndirectMemoryAddress, x: ImmediateOperand) =>
        Left(IndirectPointerTypeUndefined(i))
      case (r: MemoryOperand, x: MemoryOperand) =>
        Left(MemoryMemoryReferenceError(i))
      case (r: WordOperand, x: DWordOperand) =>
        Left(WordDWordOperandSizeMismatchError(i))
      case (r: DWordOperand, x: WordOperand) =>
        Left(DWordWordOperandSizeMismatchError(i))
      case other => semanticError(i, language.invalidOperands)
    }

  }

  def semanticError[T](
    p: Positional,
    message: String
  ): Left[SemanticError, T] = {
    Left(new GenericSemanticError(p, message))
  }
  def parserToSimulatorOperand(
    op: lexer.Operand,
    resolver: Resolver
  ): Either[SemanticError, UnaryOperand] = {

    op match {

      //        case x:lexer.SP => semanticError(x, s"Using SP as a register is not supported")
      case x: lexer.RegisterToken => Right(registers(x))

      case e: parser.Expression => {

        def valueToWord(v: Integer) = {
          ComputerWord.bytesFor(v) match {
            case 1 => Right(WordValue(v))
            case 2 => Right(DWordValue(v))
            case _ => semanticError(e, language.dontFitIn16Bits(v))
          }
        }
        def valueToMemoryAddress(v: Integer) = {

          resolver.memoryExpressionType(e) match {
            case None =>
              semanticError(e, language.cannotDetermineMemoryReferenceType)
            case Some(varType) =>
              Right(varType match {
                case lexer.DB() => WordMemoryAddress(v)
                case lexer.DW() => DWordMemoryAddress(v)
              })
          }
        }

        val expressionValue = resolver.expression(e)
        val memoryReferencedLabels = resolver.memoryReferencesLabels(e)
        val undefinedLabels = resolver.undefinedLabels(e)
        //        println(s"WORD PTRCompiler:Undefined labels = $undefinedLabels for expression $e")
        if (undefinedLabels.isEmpty) {
          
          if (resolver.isMemoryExpression(e)) {
            valueToMemoryAddress(expressionValue)
          } else {
            if (resolver.memoryReferences(e)==0){
              valueToWord(expressionValue)
            }else{
              semanticError(op, language.expressionsWithMemoryOperands(memoryReferencedLabels))    
            }
          }
        } else {
          semanticError(op, language.labelsUndefined(undefinedLabels))
        }
      }

      case x: lexer.LITERALSTRING =>
        semanticError(x, language.literalStringsAsImmediate(x.str))
      // TODO remove UndefinedIndirectMemoryAddress and use hints to remove its need
      case x: lexer.INDIRECTBX      => Right(UndefinedIndirectMemoryAddress)
      case x: lexer.WORDINDIRECTBX  => Right(WordIndirectMemoryAddress)
      case x: lexer.DWORDINDIRECTBX => Right(DWordIndirectMemoryAddress)

    }
  }

  val jumpConditions = Map(
    lexer.JC() -> JC,
    lexer.JNC() -> JNC,
    lexer.JZ() -> JZ,
    lexer.JNZ() -> JNZ,
    lexer.JO() -> JO,
    lexer.JNO() -> JNO,
    lexer.JS() -> JS,
    lexer.JNS() -> JNS
  )
  val fullRegisters = Map(
    lexer.AX() -> AX,
    lexer.BX() -> BX,
    lexer.CX() -> CX,
    lexer.DX() -> DX,
    lexer.SP() -> SP,
    lexer.IP() -> IP
  )
  val halfRegisters = Map(
    lexer.AL() -> AL,
    lexer.AH() -> AH,
    lexer.BL() -> BL,
    lexer.BH() -> BH,
    lexer.CL() -> CL,
    lexer.CH() -> CH,
    lexer.DL() -> DL,
    lexer.DH() -> DH
  )
  val registers = fullRegisters ++ halfRegisters
  val binaryOperations = Map[lexer.BinaryArithmeticOp, ALUOpBinary](
    lexer.ADD() -> ADD,
    lexer.ADC() -> ADC,
    lexer.SUB() -> SUB,
    lexer.SBB() -> SBB,
    lexer.XOR() -> XOR,
    lexer.OR() -> OR,
    lexer.AND() -> AND,
    lexer.CMP() -> CMP
  )
  val unaryOperations = Map[lexer.UnaryArithmeticOp, ALUOpUnary](
    lexer.NOT() -> NOT,
    lexer.NEG() -> NEG,
    lexer.DEC() -> DEC,
    lexer.INC() -> INC
  )

}
