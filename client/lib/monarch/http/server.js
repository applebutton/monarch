(function(Monarch, jQuery) {

Monarch.constructor("Monarch.Http.Server", {
  initialize: function() {
    this._next_echo_id = 0;
    this.pending_commands = {};
  },

  fetch: function(relations) {
    var fetch_future = new Monarch.Http.RepositoryUpdateFuture();

    start = new Date().getTime();

    this.get(Repository.origin_url, {
      relations: Monarch.Util.map(relations, function(relation) {
        return relation.wire_representation();
      })
    })
      .on_success(function(data) {
        Repository.pause_events();
        Repository.update(data);
        fetch_future.trigger_before_events();
        Repository.resume_events();
        fetch_future.trigger_after_events();
      });

    return fetch_future;
  },

  next_echo_id: function() {
    return "create_" + this._next_echo_id++;
  },

  create: function(table, field_values) {
    var table_name = table.global_name;
    if (!this.pending_commands[table_name]) this.pending_commands[table_name] = {};

    var create_command = new Monarch.Http.CreateCommand(table, field_values, this.next_echo_id());

    this.pending_commands[table_name][create_command.echo_id] = create_command;
    this.perform_pending_mutations();
    return create_command.future;
  },


  update: function(record, values_by_method_name) {
    var table_name = record.table().global_name;
    if (!this.pending_commands[table_name]) this.pending_commands[table_name] = {};

    var update_command = new Monarch.Http.UpdateCommand(record, values_by_method_name);

    this.pending_commands[table_name][record.id()] = update_command;

    this.perform_pending_mutations();
    return update_command.future;
  },

  destroy: function(record) {
    var table_name = record.table().global_name;
    if (!this.pending_commands[table_name]) this.pending_commands[table_name] = {};

    var destroy_command = new Monarch.Http.DestroyCommand(record);

    this.pending_commands[table_name][record.id()] = destroy_command;

    this.perform_pending_mutations();
    return destroy_command.future;
  },

  for_each_pending_command: function(fn) {
    Monarch.Util.values(this.pending_commands, function(commands_by_id) {
      Monarch.Util.values(commands_by_id, function(command) {
        fn(command);
      });
    });
  },

  perform_pending_mutations: function() {
    var self = this;
    var operations = {};

    this.for_each_pending_command(function(command) {
      command.add_to_request_data(operations);
    });

    this.post(Repository.origin_url, { operations: operations }).on_success(function(response_data) {
      self.handle_mutation_response(response_data);
    });
  },

  handle_mutation_response: function(response_data) {
    var self = this;
    Repository.pause_events();

    Monarch.Util.each(response_data, function(table_name, responses_by_id) {
      Monarch.Util.each(responses_by_id, function(id, response) {
        self.pending_commands[table_name][id].complete_and_trigger_before_events(response);      
      });
    });

    Repository.resume_events();

    this.for_each_pending_command(function(command) {
      command.trigger_after_events();
    });

    this.pending_commands = {};
  },

  start_batch: function() {
    this.batch_in_progress = true;
  },

  finish_batch: function() {
    this.batch_in_progress = false;
  },

  post: function(url, data) {
    return this.request('POST', url, data);
  },

  get: function(url, data) {
    return this.request('GET', url, data);
  },

  put: function(url, data) {
    return this.request('PUT', url, data);
  },

  delete_: function(url, data) {
    var url_encoded_data = jQuery.param(this.stringify_json_data(data));
    return this.request('DELETE', url + "?" + url_encoded_data);
  },

  request: function(type, url, data) {
    var future = new Monarch.Http.AjaxFuture();
    jQuery.ajax({
      url: url,
      type: type,
      dataType: 'json',
      data: data ? this.stringify_json_data(data) : null,
      success: function(response) {
        future.handle_response(response);
      }
    });
    return future;
  },

  stringify_json_data: function(data) {
    var stringified_data = {};
    Monarch.Util.each(data, function(key, value) {
      if (typeof value == "object") value = JSON.stringify(value);
      stringified_data[key] = value;
    });
    return stringified_data;
  }
});

})(Monarch, jQuery);
