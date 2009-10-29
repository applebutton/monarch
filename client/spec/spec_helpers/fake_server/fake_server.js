Monarch.constructor("FakeServer", {
  initialize: function() {
    this.posts = [];
    this.puts = [];
    this.deletes = [];
    this.gets = [];
    this.fetches = [];
    this.creates = [];
    this.updates = [];
    this.destroys = [];
    this.batches = [];
    this.auto_fetch = false;

    this.Repository = Repository.clone_schema();
  },

  fetch: function(relations) {
    var fake_fetch = new FakeServer.FakeFetch(Repository.origin_url, relations, this.Repository);
    if (this.auto_fetch) {
      fake_fetch.simulate_success();
    } else {
      this.last_fetch = fake_fetch;
      this.fetches.push(fake_fetch);
    }
    return fake_fetch.future;
  },

  simulate_fetch: function(relations) {
    this.fetch(relations);
    if (!this.auto_fetch) this.fetches.shift().simulate_success();
  },

  create: function(relation, field_values) {
    return this.mutate(new FakeServer.FakeCreate(Repository.origin_url, relation, field_values, this));
  },

  update: function(record, field_values) {
    return this.mutate(new FakeServer.FakeUpdate(record, field_values, this));
  },

  destroy: function(record) {
    return this.mutate(new FakeServer.FakeDestroy(Repository.origin_url, record, this));
  },

  mutate: function(command) {
    if (this.batch_in_progress) {
      this.last_batch.add_command(command);
    } else if (this.auto_mutate) {
      command.simulate_success();
    } else {
      this["last_" + command.type] = command;
      this[command.type + "s"].push(command);
    }
    return command.future;
  },

  start_batch: function() {
    if (this.batch_in_progress) throw new Error("Batch already in progress");
    this.batch_in_progress = true;
    var fake_batch = new FakeServer.FakeBatch();
    this.last_batch = fake_batch;
    this.batches.push(fake_batch);
  },

  finish_batch: function() {
    if (!this.batch_in_progress) throw new Error("No batch in progress");
    this.batch_in_progress = false;
  },

  post: function(url, data) {
    var fake_post = new FakeServer.FakeRequest('POST', url, data)
    this.last_post = fake_post;
    this.posts.push(fake_post);
    return fake_post.future;
  },

  get: function(url, data) {
    var fake_get = new FakeServer.FakeRequest('GET', url, data)
    this.last_get = fake_get;
    this.gets.push(fake_get);
    return fake_get.future;
  },

  put: function(url, data) {
    var fake_put = new FakeServer.FakeRequest('PUT', url, data)
    this.last_put = fake_put;
    this.puts.push(fake_put);
    return fake_put.future;
  },

  delete_: function(url, data) {
    var fake_delete = new FakeServer.FakeRequest('DELETE', url, data)
    this.last_delete = fake_delete;
    this.deletes.push(fake_delete);
    return fake_delete.future;
  },

  remove_request: function(request) {
    var requests_array = this[request.type + "s"];

    Monarch.Util.remove(requests_array, request);
    this["last_" + request.type] = requests_array[requests_array.length - 1];
  }
});
