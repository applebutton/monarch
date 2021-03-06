module Monarch
  module Model
    class ExposedRepository
      include Util::BuildRelationalDataset

      class << self
        def expose(name, &relation_definition)
          exposed_relation_definitions_by_name[name] = relation_definition
          define_method name do
            resolve_table_name(name)
          end
        end

        def exposed_relation_definitions_by_name
          @exposed_relation_definitions_by_name ||= HashWithIndifferentAccess.new
        end
      end

      def fetch(relation_wire_representations)
        build_relational_dataset(build_relations_from_wire_representations(relation_wire_representations))
      end

      def mutate(operations)
        perform_operations_in_transaction(operations)
      end

      def subscribe(real_time_client, relation_wire_representations)
        subscription_guids = build_relations_from_wire_representations(relation_wire_representations).map do |relation|
          real_time_client.subscribe(relation)
        end
        return true, subscription_guids
      end

      def unsubscribe(real_time_client, subscription_ids)
        subscription_ids.each do |subscription_id|
          real_time_client.unsubscribe(subscription_id)
        end
        true
      end

      def perform_operations_in_transaction(operations)
        successful = true
        response_data = { 'primary' => [], 'secondary' => [] }

        Repository.transaction do
          operations.each_with_index do |operation, index|
            result = perform_operation(operation)
            if result.valid?
              response_data['primary'].push(result.data)
            else
              successful = false
              response_data = {
                'index' => index,
                'errors' => result.data
              }
              raise Sequel::Rollback
            end
          end
        end

        [successful, response_data]
      end

      def resolve_table_name(name)
        if relation = exposed_relations_by_name[name]
          return relation
        end
        relation_definition = exposed_relation_definitions_by_name[name]
        raise "No table named #{name} defined in #{inspect}" unless relation_definition
        relation = instance_eval(&relation_definition)
        relation.exposed_name = name
        exposed_relations_by_name[name] = relation
      end

      protected

      def perform_operation(operation)
        operation_type = operation.shift

        case operation_type
        when 'create'
          perform_create(*operation)
        when 'update'
          perform_update(*operation)
        when 'destroy'
          perform_destroy(*operation)
        end
      end

      def perform_create(table_name, field_values)
        relation = resolve_table_name(table_name)
        record = relation.create(field_values)

        if record.valid?
          valid_result(record.wire_representation)
        else
          invalid_result(record.validation_errors_by_column_name.stringify_keys)
        end
      end

      def perform_update(table_name, id, field_values)
        relation = resolve_table_name(table_name)
        record = relation.find(id)
        record.update_fields(field_values)

        if record.valid?
          if relation.find(id)
            return valid_result(record.wire_representation.stringify_keys)
          else
            return invalid_result("Security violation")
          end
        else
          return invalid_result(record.validation_errors_by_column_name.stringify_keys)
        end
      end

      def perform_destroy(table_name, id)
        relation = resolve_table_name(table_name)
        relation.destroy(id)
        valid_result(nil)
      end

      def headers
        { 'Content-Type' => 'application/json' }
      end

      def build_relations_from_wire_representations(representations)
        representations.map do |representation|
          build_relation_from_wire_representation(representation)
        end
      end

      def build_relation_from_wire_representation(representation)
        Relations::Relation.from_wire_representation(representation, self)
      end

      def exposed_relations_by_name
        @exposed_relations_by_name ||= HashWithIndifferentAccess.new
      end

      def exposed_relation_definitions_by_name
        self.class.exposed_relation_definitions_by_name
      end

      def valid_result(data)
        OperationResult.new(true, data)
      end

      def invalid_result(data)
        OperationResult.new(false, data)
      end

      class OperationResult
        attr_reader :data

        def initialize(valid, data)
          @valid, @data = valid, data
        end

        def valid?
          @valid
        end
      end

      class SecurityException < Exception
      end
    end
  end
end