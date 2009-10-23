module Model
  module Relations
    class Table < Relation
      attr_reader :global_name, :record_class, :columns_by_name

      def initialize(global_name, record_class)
        @global_name, @record_class = global_name, record_class
        @columns_by_name = ActiveSupport::OrderedHash.new
      end

      def define_column(name, type)
        columns_by_name[name] = Column.new(self, name, type)
      end

      def columns
        columns_by_name.values
      end

      def column(name)
        name = name.to_sym if name.instance_of?(String)
        columns_by_name[name]
      end

      def create(field_values = {})
        record = record_class.new(field_values)
        record.before_create if record.respond_to?(:before_create)
        insert(record)
        record.mark_clean
        record.after_create if record.respond_to?(:after_create)
        record
      end

      def insert(record)
        Origin.insert(self, record.field_values_by_column_name)
      end

      def joined_tables
        [self]
      end

      def build_sql_query(query=SqlQuery.new)
        query.add_from_table(self)
        query
      end

      def build_record_from_database(field_values)
        id = field_values[:id]
        if record_from_id_map = identity_map[id]
          record_from_id_map
        else
          record = record_class.unsafe_new(field_values)
          record.mark_clean
          identity_map[id] = record
          record
        end
      end

      def initialize_identity_map
        Thread.current["#{global_name}_identity_map"] = {}
      end

      def identity_map
        Thread.current["#{global_name}_identity_map"]
      end

      def clear_identity_map
        Thread.current["#{global_name}_identity_map"] = nil
      end

      def load_fixtures(fixtures)
        fixtures.each do |id, field_values|
          insert(record_class.unsafe_new(field_values.merge(:id => id.to_s)))
        end
      end

      def clear_table
        Origin.clear_table(global_name)
      end

      def create_table
        columns_to_generate = columns
        Origin.create_table(global_name) do
          columns_to_generate.each do |c|
            column c.name, c.ruby_type
          end
        end
      end

      def drop_table
        Origin.drop_table(global_name)
      end
    end
  end
end
