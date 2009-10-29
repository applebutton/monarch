Monarch.constructor("FakeServer.FakeUpdate", {
  type: "update",

  initialize: function(record, values_by_method_name, fake_server) {
    this.record = record;
    this.fake_server = fake_server;
    this.record.start_pending_changes();
    this.record.local_update(values_by_method_name);
    this.pending_fieldset = this.record.active_fieldset;
    this.record.restore_primary_fieldset();
    this.field_values = this.pending_fieldset.wire_representation();
    this.future = new Monarch.Http.RepositoryUpdateFuture();
  },

  add_to_batch_commands: function(commands) {
    var table_name = this.record.table().global_name;
    if (!commands[table_name]) commands[table_name] = {};
    commands[table_name][this.record.id()] = this;
  },

  simulate_success: function(server_field_values) {
    Repository.pause_events();
    if (server_field_values) this.pending_fieldset.update(server_field_values);
    this.pending_fieldset.commit();
    this.future.trigger_before_events(this.record);
    Repository.resume_events();
    this.future.trigger_after_events(this.record);
    this.fake_server.remove_request(this);
  }
});
