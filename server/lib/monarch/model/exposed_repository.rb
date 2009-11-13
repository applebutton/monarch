module Model
  class ExposedRepository < ::Http::Resource
    class << self
      def expose(name, &relation_definition)
        exposed_relation_definitions_by_name[name] = relation_definition
      end

      def exposed_relation_definitions_by_name
        @exposed_relation_definitions_by_name ||= HashWithIndifferentAccess.new
      end
    end

    def get(params)
      relation_wire_representations = JSON.parse(params[:relations])
      [200, headers, { :successful => true, :data => fetch(relation_wire_representations)}.to_json]
    end

    def post(params)
      successful_response_data = Hash.new {|h,k| h[k] = {}};
      unsuccessful_response_data = Hash.new {|h,k| h[k] = {}};

      operations_by_table_name = JSON.parse(params[:operations])

      all_operations_valid = true
      operations_by_table_name.each do |table_name, operations_by_id|
        operations_by_id.each do |id, field_values|
          result = perform_operation(table_name, id, field_values)
          if result.valid?
            successful_response_data[table_name][id] = result.data
          else
            unsuccessful_response_data[table_name][id] = result.data
            all_operations_valid = false
          end
        end
      end

      response_data = all_operations_valid ? successful_response_data : unsuccessful_response_data
      [200, headers, { 'successful' => all_operations_valid, 'data' => response_data}.to_json]
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

    def perform_operation(table_name, id, field_values)
      if id =~ /^create/
        perform_create(table_name, field_values)
      elsif field_values.nil?
        perform_destroy(table_name, id)
      else
        perform_update(table_name, id, field_values)
      end
    end

    def perform_create(table_name, field_values)
      relation = resolve_table_name(table_name)
      record = relation.create(field_values)

      if record.valid?
        valid_result(record.wire_representation)
      else
        invalid_result(record.validation_errors_by_column_name)
      end
    end

    def perform_update(table_name, id, field_values)
      relation = resolve_table_name(table_name)
      record = relation.find(id)
      updated_field_values = record.update(field_values)

      if record.valid?
        record.save
        valid_result(updated_field_values)
      else
        invalid_result(record.validation_errors_by_column_name)
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

    def fetch(relation_wire_representations)
      dataset = {}
      relation_wire_representations.each do |representation|
        build_relation_from_wire_representation(representation).add_to_relational_dataset(dataset)
      end
      dataset
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
  end
end
