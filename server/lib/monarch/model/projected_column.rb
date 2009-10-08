module Model
  class ProjectedColumn
    attr_reader :column, :column_alias

    delegate :convert_value_for_storage, :to => :column

    def initialize(column, column_alias=nil)
      @column, @column_alias = column, column_alias
    end

    def name
      column_alias || column.name
    end

    def to_sql
      as_suffix = column_alias ? " as #{column_alias}" : ""
      "#{column.to_sql}#{as_suffix}"
    end
  end
end
