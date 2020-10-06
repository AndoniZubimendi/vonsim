package vonsim.webapp

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSGlobal, JSName}
import com.scalawarrior.scalajs.ace.Editor
import com.scalawarrior.scalajs.ace.{Annotation => ScalaJSAnnotation}
import com.scalawarrior.scalajs.ace.Position
import com.scalawarrior.scalajs.ace.Range

//@JSName("Ace")
trait MyAce extends js.Object {
  def edit(): Editor
}
import js.Dynamic.global
import com.scalawarrior.scalajs.ace.IEditSession
import scala.io.Position

object Annotation {
  def apply(
    row: Double,
    column: Double,
    text: String,
    `type`: String
  ): ScalaJSAnnotation =
    js.Dynamic
      .literal(row = row, column = column, text = text, `type` = `type`)
      .asInstanceOf[ScalaJSAnnotation]
}

package object webapp {
  lazy val myace: MyAce = global.ace.asInstanceOf[MyAce]
}
@js.native
@JSGlobal
class AceRange protected () extends Range {
  def this(
    startRow: Double,
    startColumn: Double,
    endRow: Double,
    endColumn: Double
  ) = this()

}
