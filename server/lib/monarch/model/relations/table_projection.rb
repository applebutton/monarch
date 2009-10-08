module Model
  module Relations
    class TableProjection < Relation
      class << self
        def from_wire_representation(representation, repository)
          operand = Relation.from_wire_representation(representation["operand"], repository)
          projected_table = repository.resolve_table_name(representation["projected_table"]).record_class.table
          new(operand, projected_table)
        end
      end

      attr_reader :operand, :projected_table
      def initialize(operand, projected_table)
        @operand, @projected_table = operand, projected_table
      end

      def record_class
        projected_table.record_class
      end

      def build_sql_query(query=SqlQuery.new)
        query.projected_table = projected_table unless query.projected_table
        operand.build_sql_query(query)
      end
    end
  end
end
