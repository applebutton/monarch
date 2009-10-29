(function(Monarch) {

Monarch.constructor("Monarch.Http.CreateCommand", Monarch.Http.Command, {

  constructor_initialize: function() {
    this.command_id_counter = 0;
  },

  initialize: function(table, field_values) {
    this.table = table;
    this.table_name = table.global_name;
    this.field_values = field_values;
    this.command_id = "create_" + this.constructor.command_id_counter++;
    this.future = new Monarch.Http.RepositoryUpdateFuture();
    this.record = new this.table.record_constructor(this.field_values);
  },

  wire_representation: function() {
    return this.record.wire_representation();
  },

  complete: function(field_values_from_server) {
    this.record.local_update(field_values_from_server);
    this.table.insert(this.record);
  }
});

})(Monarch);
