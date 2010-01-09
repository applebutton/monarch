module Model
  module Relations
    class Relation
      class << self
        def from_wire_representation(representation, repository)
          case representation["type"]
          when "table"
            repository.resolve_table_name(representation["name"])
          when "selection"
            Selection.from_wire_representation(representation, repository)
          when "inner_join"
            InnerJoin.from_wire_representation(representation, repository)
          when "table_projection"
            TableProjection.from_wire_representation(representation, repository)
          end
        end
      end
      include ForwardsArrayMethodsToRecords
      attr_writer :exposed_name
      delegate :include?, :map, :to => :all


      def initialize(&block)
        class_eval(&block) if block
      end

      def all
        Origin.read(self)
      end

      def find(id_or_predicate)
        predicate = (id_or_predicate.is_a?(Predicates::Predicate)? id_or_predicate : column(:id).eq(id_or_predicate))
        where(predicate).all.first
      end

      def find_or_create(predicate)
        extant_record = find(predicate)
        if extant_record
          extant_record
        else
          create(predicate.force_matching_field_values)
        end
      end

      def [](column_or_name)
        column = column(column_or_name)
        raise "No column name #{column_or_name}" unless column
        column
      end

      def destroy(id)
        find(id).destroy
      end

      def where(predicate, &block)
        Selection.new(self, predicate, &block)
      end

      def join(right_operand, &block)
        PartiallyConstructedInnerJoin.new(self, convert_to_table_if_needed(right_operand), &block)
      end

      def join_to(right_operand)
        right_operand = convert_to_table_if_needed(right_operand)
        left_operand_surface_tables = surface_tables
        right_operand_surface_tables = right_operand.surface_tables
        unless right_operand_surface_tables.size == 1
          raise "#join_to can only be passed relations that have a single surface table"
        end

        right_surface_table = right_operand_surface_tables.first
        id_column, foreign_key_column = find_join_columns(left_operand_surface_tables.last, right_surface_table)
        self.join(right_operand).on(id_column.eq(foreign_key_column))
      end


      def join_through(right_operand)
        right_operand = convert_to_table_if_needed(right_operand)
        right_surface_table = right_operand.surface_tables.first
        self.join_to(right_operand).project(right_surface_table)
      end

      def project(*args, &block)
        if args.size == 1 && table_or_record_class?(args.first)
          TableProjection.new(self, convert_to_table_if_needed(args.first), &block)
        else
          Projection.new(self, convert_to_projected_columns_if_needed(args), &block)
        end
      end

      def aggregate(*args, &block)
        Aggregation.new(self, args, &block)
      end

      def to_sql
        build_sql_query.to_sql
      end

      def add_to_relational_dataset(dataset)
        dataset[exposed_name] ||= {}
        all.each do |record|
          dataset[exposed_name][record.id] = record.wire_representation
        end
      end

      def exposed_name
        @exposed_name || operand.exposed_name
      end

      def size
        all.size
      end

      def empty?
        all.empty?
      end

      def on_insert(&block)
        initialize_event_system
        on_insert_node.subscribe(&block)
      end

      def on_update(&block)
        initialize_event_system
        on_update_node.subscribe(&block)
      end

      def on_remove(&block)
        initialize_event_system
        on_remove_node.subscribe(&block)
      end

      def num_subscriptions
        event_nodes.map {|node| node.count}.sum
      end

      protected
      attr_reader :on_insert_node, :on_update_node, :on_remove_node, :event_nodes, :operand_subscriptions

      def initialize_event_system
        if event_nodes.nil?
          @on_insert_node = Util::SubscriptionNode.new
          @on_update_node = Util::SubscriptionNode.new
          @on_remove_node = Util::SubscriptionNode.new
          @event_nodes = [on_insert_node, on_update_node, on_remove_node]
        end
        initialize_operand_subscriptions if has_operands? && num_subscriptions == 0 
      end

      def initialize_operand_subscriptions
        @operand_subscriptions = Util::SubscriptionBundle.new
        subscribe_to_operands

        event_nodes.each do |node|
          node.on_unsubscribe do
            operand_subscriptions.destroy_all if num_subscriptions == 0
          end
        end
      end

      def has_operands?
        true
      end

      def table_or_record_class?(arg)
        arg.instance_of?(Table) || arg.instance_of?(Class)
      end

      def convert_to_table_if_needed(relation_or_record_class)
        if relation_or_record_class.instance_of?(Class)
          relation_or_record_class.table
        else
          relation_or_record_class
        end
      end

      def convert_to_projected_columns_if_needed(args)
        args.map do |arg|
          if arg.instance_of?(ConcreteColumn)
            ProjectedColumn.new(arg)
          elsif table_or_record_class?(arg)
            convert_to_table_if_needed(arg).concrete_columns.map {|c| ProjectedColumn.new(c)}
          else
            arg
          end
        end.flatten
      end

      def find_join_columns(table_1, table_2)
        if foreign_key = table_2.column("#{table_1.global_name.singularize}_id".to_sym)
          [table_1.column(:id), foreign_key]
        elsif foreign_key = table_1.column("#{table_2.global_name.singularize}_id".to_sym)
          [table_2.column(:id), foreign_key]
        else
          raise "No viable foreign key column found between #{table_1.global_name} and #{table_2.global_name}"
        end
      end

      class PartiallyConstructedInnerJoin
        attr_reader :left_operand, :right_operand
        def initialize(left_operand, right_operand)
          @left_operand, @right_operand = left_operand, right_operand
        end

        def on(predicate)
          InnerJoin.new(left_operand, right_operand, predicate)
        end
      end
    end
  end
end
