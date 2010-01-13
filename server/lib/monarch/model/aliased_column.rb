module Model
  class AliasedColumn
    attr_reader :column, :column_alias
    delegate :convert_value_for_storage, :convert_value_for_wire, :where_clause_sql, :to => :column

    def initialize(column, column_alias=nil)
      @column, @column_alias = column, column_alias
    end

    def eq(right_operand)
      Predicates::Eq.new(self, right_operand)
    end

    def name
      column_alias || column.name
    end

    def select_clause_sql
      "#{column.to_sql} as #{name}"
    end

    def ==(other)
      return false unless other.instance_of?(self.class)
      column == other.column && column_alias == other.column_alias
    end
  end
end