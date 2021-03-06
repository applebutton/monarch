module Monarch
  module Model
    module Expressions
      class And < Expression
        attr_reader :operands
        def initialize(operands)
          @operands = operands
        end

        def sql_expression(state)
          state[self][:sql_expression] ||=
            Sql::Expressions::And.new(operands.map {|op| op.sql_expression(state)})
        end
      end
    end
  end
end