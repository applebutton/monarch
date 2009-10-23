module Model
  module Relations
    class Selection < Relation
      class << self
        def from_wire_representation(representation, repository)
          operand = Relation.from_wire_representation(representation["operand"], repository)
          predicate = Predicates::Predicate.from_wire_representation(representation["predicate"], repository)
          new(operand, predicate)
        end
      end

      attr_reader :operand, :predicate
      delegate :column, :joined_tables, :build_record_from_database, :to => :operand

      def initialize(operand, predicate)
        @operand, @predicate = operand, predicate
      end

      def create(field_values)
        operand.create(predicate.force_matching_field_values(field_values))
      end

      def build_sql_query(query=SqlQuery.new)
        query.add_condition(predicate)
        operand.build_sql_query(query)
      end
    end
  end
end
