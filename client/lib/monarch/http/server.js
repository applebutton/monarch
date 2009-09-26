constructor("Http.Server", {
  fetch: function(relations) {
    var url = Repository.origin_url;
    var fetch_future = new Http.FetchFuture();

    start = new Date().getTime();

    Origin.get(url, {
      relations: Util.map(relations, function(relation) {
        return relation.wire_representation();
      })
    })
      .on_success(function(data) {
        Repository.pause_delta_events();
        Repository.update(data);
        fetch_future.trigger_before_delta_events();
        Repository.resume_delta_events();
        fetch_future.trigger_after_delta_events();
      });

    return fetch_future;
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

  request: function(type, url, data) {
    var future = new Http.AjaxFuture();
    jQuery.ajax({
      url: url,
      type: type,
      dataType: 'json',
      data: this.stringify_json_data(data),
      success: function(response) {
        future.handle_response(response);
      }
    });
    return future;
  },

  stringify_json_data: function(data) {
    var stringified_data = {};
    Util.each(data, function(key, value) {
      stringified_data[key] = JSON.stringify(value);
    });
    return stringified_data;
  }
});
