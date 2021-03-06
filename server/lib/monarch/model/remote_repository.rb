module Monarch
  module Model
    class RemoteRepository
      attr_accessor :connection
      delegate :transaction, :execute_dui, :to => :connection

      def insert(table, field_values)
        LOGGER.debug("insert -- #{table.global_name}, #{field_values.inspect}")
        connection.from(table.global_name).insert(field_values)
      end

      def update(table, id, field_values)
        LOGGER.debug("update -- #{table.global_name}, #{id}, #{field_values.inspect}")
        connection.from(table.global_name).filter(:id => id).update(field_values)
      end

      def destroy(table, id)
        LOGGER.debug("destroy -- #{table.global_name}, #{id}")
        connection.from(table.global_name).filter(:id => id).delete
      end

      def read(relation)
        records = connection[relation.to_sql].map do |field_values|
          relation.build_record_from_database(field_values)
        end
        records
      end

      def reload(record)
        table = record.table
        query = table.where(table.column(:id).eq(record.id)).to_sql
        field_values = connection[query].first
        raise "Record '#{record.id}' not found during reload" unless field_values
        record.update_fields(field_values)
      end

      #TODO: test
      def create_table(name, &definition)
        connection.create_table(name, &definition)
      end

      #TODO: test
      def clear_table(name)
        connection[name].delete
      end

      #TODO: test
      def drop_table(name)
        connection.drop_table(name)
      end
    end
  end
end
