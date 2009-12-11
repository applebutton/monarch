
(function(Monarch) {

Monarch.constructor("Monarch.Model.Record", {
  constructor_properties: {
    extended: function(subconstructor) {
      subconstructor.table = new Monarch.Model.Relations.Table(this.determine_global_name(subconstructor), subconstructor);
      subconstructor.column("id", "string");
      subconstructor.relation_definitions = [];
      Repository.register_table(subconstructor.table);
    },

    column: function(name, type) {
      var column = this.table.define_column(name, type);

      // name property of functions is read-only in safari and chrome
      if (name == "name") {
        this["name_"] = column;
      } else {
        this[name] = column;
      }

      this.prototype[name] = function() {
        var field = this.field(name);
        return field.value.apply(field, arguments);
      };
    },

    synthetic_column: function(name, definition) {
      this[name] = this.table.define_synthetic_column(name, definition);
      this.prototype[name] = function(value) {
        if (arguments.length == 0) {
          return this.field(name).value();
        } else {
          return this.field(name).value(value);
        }
      };
    },

    columns: function(column_name_type_pairs) {
      for (var name in column_name_type_pairs) {
        this.column(name, column_name_type_pairs[name]);
      }
    },

    relates_to_many: function(name, definition) {
      this.relation_definitions.push({ name: name, definition: definition });
      this.prototype[name] = function() {
        return this.relations_by_name[name];
      };
    },

    has_many: function(relation_name, options) {
      var self = this;
      options = options || {};
      var conditions = options.conditions || {};

      var target_table_name = options.table || relation_name;
      var foreign_key_column_name = options.key || Monarch.Inflection.singularize(this.table.global_name) + "_id";

      this.relates_to_many(relation_name, function() {
        var target_table = Repository.tables[target_table_name];
        conditions[foreign_key_column_name] = this.id();
        var relation = target_table.where(conditions);

        if (options.order_by) relation = self.process_has_many_order_by_option(relation, options.order_by);
        return relation;
      });
    },

    process_has_many_order_by_option: function(relation, order_by) {
      if (order_by instanceof Array) {
        return relation.order_by.apply(relation, order_by);
      } else {
        return relation.order_by(order_by);
      }
    },

    determine_global_name: function(record_constructor) {
      return Monarch.Inflection.pluralize(Monarch.Inflection.underscore(record_constructor.basename));
    },

    create: function(field_values) {
      return this.table.create(field_values);
    },

    local_create: function(field_values) {
      var record = new this();
      record.remote.update(field_values);
      this.table.insert(record);
      return record;
    },

    human_name: function() {
      return Monarch.Inflection.humanize(this.basename);
    },

    // delegate to table
    find: function(id) {
      return this.table.find(id);
    },

    fetch: function() {
      return this.table.fetch();
    },

    records: function() {
      return this.table.records();
    },

    each: function(fn) {
      this.table.each(fn);
    },

    on_insert: function(callback) {
      return this.table.on_insert(callback);
    },

    on_update: function(callback) {
      return this.table.on_update(callback);
    },

    on_remove: function(callback) {
      return this.table.on_remove(callback);
    },

    where: function(predicate) {
      return this.table.where(predicate);
    },

    empty: function() {
      return this.table.empty();
    }
  },

  initialize: function(field_values_by_column_name) {
    this.remote = new Monarch.Model.RemoteFieldset(this);
    this.local = new Monarch.Model.LocalFieldset(this, this.remote);
    this.initialize_update_node();

    if (field_values_by_column_name) this.local_update(field_values_by_column_name);
    this.remote.initialize_synthetic_fields();
    this.local.initialize_synthetic_fields();
  },

  fetch: function() {
    return this.table().where(this.table().column('id').eq(this.id())).fetch();
  },

  update: function(values_by_method_name) {
    this.local_update(values_by_method_name);
    return Server.update(this);
  },

  save: function() {
    return Server.update(this);
  },

  destroy: function() {
    return Server.destroy(this);
  },

  populate_fields_with_errors: function(errors_by_field_name) {
    this.local.populate_fields_with_errors(errors_by_field_name);
  },

  all_validation_errors: function() {
    return this.local.all_validation_errors();
  },

  on_update: function(callback) {
    return this.on_update_node.subscribe(callback);
  },

  local_update: function(values_by_method_name) {
    for (var method_name in values_by_method_name) {
      if (this[method_name]) {
        this[method_name](values_by_method_name[method_name]);
      }
    }
  },

  local_destroy: function() {
    this.mark_for_destroy = true;
    this.finalize_local_destroy();
  },

  finalize_local_destroy: function() {
    this.table().remove(this);
    if (this.table.on_remove_node) this.table.on_remove_node.publish(this); // i know this doesn't belong here
    if (this.after_destroy) this.after_destroy();
  },

  valid: function() {
    return this.local.valid();
  },

  table: function() {
    return this.constructor.table;
  },

  dirty_wire_representation: function() {
    return this.local.dirty_wire_representation();
  },

  wire_representation: function() {
    return this.local.wire_representation();
  },

  field: function(column) {
    if (!this.local) debugger;
    return this.local.field(column);
  },

  signal: function(column, optional_transformer) {
    return this.field(column).signal(optional_transformer);
  },

  evaluate: function(column_or_constant) {
    if (column_or_constant instanceof Monarch.Model.Column) {
      return this.field(column_or_constant).value();
    } else {
      return column_or_constant;
    }
  },

  pause_events: function() {
    this.on_update_node.pause_events();
  },

  resume_events: function() {
    this.on_update_node.resume_events();
  },

  // private
  initialize_update_node: function() {
    this.on_update_node = new Monarch.SubscriptionNode();
    this.on_update_node.subscribe(function(changeset) {
      if (this.after_update) this.after_update(changeset);
    }.bind(this));
  },

  initialize_relations: function() {
    var self = this;
    this.relations_by_name = {};
    Monarch.Util.each(this.constructor.relation_definitions, function(relation_definition) {
      self.relations_by_name[relation_definition.name] = relation_definition.definition.call(self);
    });
  }
});

})(Monarch);
