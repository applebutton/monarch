//= require "../../monarch_spec_helper"

Screw.Unit(function(c) { with(c) {
  describe("Monarch.Http.Server", function() {
    var server;

    before(function() {
      server = new Monarch.Http.Server();
      Monarch.Http.CreateCommand.command_id_counter = 0;
    });

    describe("#fetch(origin_url, relations)", function() {
      use_example_domain_model();

      before(function() {
        server.gets = [];
        server.get = FakeServer.prototype.get;
      });


      it("performs a GET to Repository.origin_url with the json to fetch the given Relations, then merges the results into the Repository with the delta events sandwiched by before_events and after_events callback triggers on the returned future", function() {
        Repository.origin_url = "/users/steph/repository"
        var future = server.fetch([Blog.table, User.table]);

        expect(server.gets).to(have_length, 1);
        var get = server.gets.shift();
        expect(get.url).to(equal, "/users/steph/repository");
        expect(get.data).to(equal, {
          relations: [Blog.table.wire_representation(), User.table.wire_representation()]
        });

        var dataset = {
          users: {
            nathan: {
              id: 'nathan',
              full_name: "Nathan Sobo"
            },
            wil: {
              id: 'wil',
              full_name: 'Wil Bierbaum'
            }
          },
          blogs: {
            metacircular: {
              id: 'metacircular',
              user_id: 'nathan',
              name: 'Metacircular'
            },
            canyonero: {
              id: 'canyonero',
              user_id: 'wil',
              name: 'Canyonero'
            }
          }
        };

        var events = [];

        future
          .before_events(function() {
          events.push('before_events');
        })
          .after_events(function() {
          events.push('after_events')
        });

        mock(Repository, 'pause_events', function() {
          events.push('Repository.pause_events')
        });

        mock(Repository, 'update', function() {
          events.push('Repository.update')
        });

        mock(Repository, 'resume_events', function() {
          events.push('Repository.resume_events')
        });

        get.simulate_success(dataset);

        expect(Repository.update).to(have_been_called, with_args(dataset));

        expect(events).to(equal, [
          'Repository.pause_events',
          'Repository.update',
          'before_events',
          'Repository.resume_events',
          'after_events'
        ]);
      });
    });

    describe("#save", function() {
      use_local_fixtures();

      before(function() {
        Repository.origin_url = "/repo";
        server.post = FakeServer.prototype.post;
        server.posts = [];
      });
      
      context("when given a locally-updated record", function() {
        it("sends an update command", function() {
          var record = User.find('jan');
          record.full_name("Jesus Chang");
          server.save(record);

          expect(server.posts.length).to(equal, 1);
          var post = server.posts.shift();

          expect(post.url).to(equal, Repository.origin_url);
          expect(post.data).to(equal, {
            operations: [['update', 'users', 'jan', record.dirty_wire_representation()]]
          });
        });

        context("when the request is successful", function() {
          it("updates the remote field values and fires the before_events and after_events callbacks", function() {
            var record = Blog.find('recipes');

            var table_update_callback = mock_function("table update callback");
            var record_update_callback = mock_function("record update callback");
            Blog.on_update(table_update_callback);
            record.on_update(record_update_callback);
            record.after_update = mock_function("optional record on update method");

            var fun_profit_name_before_update = record.fun_profit_name();
            var name_before_update = record.name();
            var user_id_before_update = record.user_id();

            record.local_update({
              name: "Programming",
              user_id: 'wil'
            });

            var save_future = server.save(record);

            expect(record.remote.name()).to(equal, name_before_update);
            expect(record.remote.fun_profit_name()).to(equal, fun_profit_name_before_update);
            expect(record.remote.user_id()).to(equal, user_id_before_update);

            var before_events_callback = mock_function('before events callback', function() {
              expect(table_update_callback).to_not(have_been_called);
              expect(record_update_callback).to_not(have_been_called);
              expect(record.after_update).to_not(have_been_called);
            });
            var after_events_callback = mock_function('after events callback', function() {
              expect(table_update_callback).to(have_been_called, once);
              expect(record_update_callback).to(have_been_called, once);
              expect(record.after_update).to(have_been_called, once);
            });

            save_future.before_events(before_events_callback);
            save_future.after_events(after_events_callback);

            server.posts.shift().simulate_success({
              primary: [{
                name: "Fancy Programming Prime", // server can change field values too
                user_id: 'wil'
              }],
              secondary: []
            });

            expect(record.local.name()).to(equal, "Fancy Programming Prime");
            expect(record.local.fun_profit_name()).to(equal, "Fancy Programming Prime for Fun and Profit");
            expect(record.local.user_id()).to(equal, "wil");

            expect(record.remote.name()).to(equal, "Fancy Programming Prime");
            expect(record.remote.fun_profit_name()).to(equal, "Fancy Programming Prime for Fun and Profit");
            expect(record.remote.user_id()).to(equal, "wil");

            expect(before_events_callback).to(have_been_called);
            expect(after_events_callback).to(have_been_called);
          });
        });

        context("when the request is unsuccessful", function() {
          it("adds validation errors to the local fields without changing remote fields and calls the on failure callback with the invalid record", function() {
            var record = Blog.find('recipes');
            var name_before_update = record.name();
            var fun_profit_name_before_update = record.fun_profit_name();
            var user_id_before_update = record.user_id();

            record.local_update({
              name: "Programming",
              user_id: 'wil'
            });

            var on_failure_callback = mock_function("on_failure_callback");
            server.save(record).on_failure(on_failure_callback);

            var name_errors = ["This name is already taken"];
            var user_id_errors = ["This name is already taken"];
            server.posts.shift().simulate_failure({
              index: 0,
              errors: {
                name: name_errors,
                user_id: user_id_errors
              }
            });

            expect(record.local.name()).to(equal, "Programming");
            expect(record.local.fun_profit_name()).to(equal, "Programming for Fun and Profit");
            expect(record.local.user_id()).to(equal, "wil");

            expect(record.remote.name()).to(equal, name_before_update);
            expect(record.remote.fun_profit_name()).to(equal, fun_profit_name_before_update);
            expect(record.remote.user_id()).to(equal, user_id_before_update);

            expect(on_failure_callback).to(have_been_called, once);
            expect(record.local.field('name').validation_errors).to(equal, name_errors);
            expect(record.local.field('user_id').validation_errors).to(equal, user_id_errors);
          });
        });
      });

      context("when given a locally-destroyed record", function() {
        it("sends a destroy command", function() {
          var record = User.find('jan');
          record.local_destroy();
          server.save(record);

          expect(server.posts.length).to(equal, 1);
          var post = server.posts.shift();

          expect(post.url).to(equal, Repository.origin_url);
          expect(post.data).to(equal, {
            operations: [['destroy', 'users', 'jan']]
          });
        });

        context("when the request is successful", function() {
          it("finalizes the destruction of the record, firing on_remove callbacks in between the before_events and after_events callbacks", function() {
            var record = Blog.find('recipes');

            var table_remove_callback = mock_function("table remove callback");
            Blog.on_remove(table_remove_callback);
            var record_remove_callback = mock_function("record remove callback");
            record.on_remove(record_remove_callback)
            record.after_destroy = mock_function("optional after_destroy method");

            record.local_destroy();
            var destroy_future = server.save(record);

            expect(server.pending_commands).to(equal, {});

            expect(server.posts.length).to(equal, 1);
            var post = server.posts.shift();
            expect(post.url).to(equal, Repository.origin_url);

            expect(post.data).to(equal, { operations: [['destroy', 'blogs', 'recipes']] });

            var before_events_callback = mock_function("before events", function() {
              expect(table_remove_callback).to_not(have_been_called);
              expect(record_remove_callback).to_not(have_been_called);
              expect(record.after_destroy).to_not(have_been_called);
            });
            var after_events_callback = mock_function("after events", function() {
              expect(table_remove_callback).to(have_been_called, once);
              expect(record_remove_callback).to(have_been_called, once);
              expect(record.after_destroy).to(have_been_called, once);
            });
            destroy_future.before_events(before_events_callback);
            destroy_future.after_events(after_events_callback);

            post.simulate_success({primary: [null], secondary: []});

            expect(Blog.find('recipes')).to(be_null);
            expect('recipes' in Blog.table.records_by_id).to(be_false);

            expect(before_events_callback).to(have_been_called);
            expect(after_events_callback).to(have_been_called);
          });
        });
      });
    });

    describe("#create(relation, field_values)", function() {
      use_local_fixtures();

      before(function() {
        server.posts = [];
        server.post = FakeServer.prototype.post;
      });

      context("when the server response indicates success", function() {
        it("instantiates a record without inserting it, posts its field values to the remote repository, then updates the record with the returned field values and inserts it, also processing any secondary mutations before firing handlers", function() {
          var insert_callback = mock_function("insert callback");
          var update_callback = mock_function("update callback");
          Blog.on_insert(insert_callback);
          Blog.on_update(update_callback);

          var field_values = { crazy_name: "Dinosaurs", user_id: 'wil'};
          var create_future = server.create(Blog.table, field_values);

          expect(server.posts.length).to(equal, 1);
          var post = server.posts.shift();
          expect(post.url).to(equal, Repository.origin_url);

          expect(post.data).to(equal, {
            operations: [['create', 'blogs', { name: "CRAZY Dinosaurs", user_id: 'wil' }]]
          });

          var before_events_callback = mock_function("before events", function() {
            expect(User.find('jan').age()).to(equal, 33);
            expect(Blog.find('demons').name()).to(equal, "Demons in my bathroom");
            expect(Blog.find('motorcycle')).to(be_null);
            expect(insert_callback).to_not(have_been_called);
          });
          var after_events_callback = mock_function("after events", function() {
            expect(insert_callback).to(have_been_called, twice);
          });
          create_future.before_events(before_events_callback);
          create_future.after_events(after_events_callback);

          post.simulate_success({
            primary: [{
              id: "dinosaurs",
              name: "Recipes Modified By Server",
              user_id: "wil"
            }],
            secondary: [
              ['update', 'users', 'jan', { age: 33 }],
              ['create', 'blogs', { id: "demons", name: "Demons in my bathroom" }],
              ['destroy', 'blogs', 'motorcycle']
            ]
          });

          expect(update_callback).to_not(have_been_called);
          expect(insert_callback).to(have_been_called, twice);

          var new_record = Blog.find('dinosaurs');
          expect(new_record.name()).to(equal, "Recipes Modified By Server");
          expect(new_record.user_id()).to(equal, "wil");

          expect(new_record.blog_posts().predicate.right_operand).to(equal, new_record.id());

          expect(before_events_callback).to(have_been_called, with_args(new_record));

          expect(after_events_callback).to(have_been_called);
          expect(after_events_callback).to(have_been_called, with_args(new_record));
        });
      });

      context("when the server response indicates failure", function() {
        it("assigns the indicated validation error messages to fields on the client side model and invokes the on_failure callbacks on the future", function() {

          var insert_callback = mock_function("insert callback");
          var update_callback = mock_function("update callback");
          Blog.on_insert(insert_callback);
          Blog.on_update(update_callback);

          var field_values = { crazy_name: "Dinosaurs", user_id: 'wil' };
          var create_future = server.create(Blog.table, field_values);

          expect(server.pending_commands).to(equal, {});

          expect(server.posts.length).to(equal, 1);
          var post = server.posts.shift();
          expect(post.url).to(equal, Repository.origin_url);

          expect(post.data).to(equal, {
            operations: [['create', 'blogs', { name: "CRAZY Dinosaurs", user_id: 'wil' }]]
          });

          var before_events_callback = mock_function("before events callback");
          var after_events_callback = mock_function("after events callback");
          var failure_callback = mock_function("failure callback");

          create_future.before_events(before_events_callback);
          create_future.after_events(after_events_callback);
          create_future.on_failure(failure_callback);

          post.simulate_failure({index: 0, errors: { name: ["This name is already taken"] }});

          expect(insert_callback).to_not(have_been_called);
          expect(before_events_callback).to_not(have_been_called);
          expect(after_events_callback).to_not(have_been_called);
          expect(failure_callback).to(have_been_called);
          var record = failure_callback.most_recent_args[0];

          expect(record.valid()).to(be_false);
          expect(record.field('name').validation_errors).to(equal, ["This name is already taken"]);
        });
      });
    });

    describe("#destroy(record)", function() {
      use_local_fixtures();

      before(function() {
        server.posts = [];
        server.post = FakeServer.prototype.post;
      });

      it("sends the table and id of the record to be deleted to the remote repository, then destroys the local record on success", function() {
        var remove_callback = mock_function("remove callback");
        Blog.on_remove(remove_callback);

        var record = Blog.find('recipes');
        var destroy_future = server.destroy(record);

        expect(server.pending_commands).to(equal, {});

        expect(server.posts.length).to(equal, 1);
        var post = server.posts.shift();
        expect(post.url).to(equal, Repository.origin_url);

        expect(post.data).to(equal, { operations: [['destroy', 'blogs', 'recipes']] });

        var before_events_callback = mock_function("before events", function() {
          expect(remove_callback).to_not(have_been_called);
        });
        var after_events_callback = mock_function("after events", function() {
          expect(remove_callback).to(have_been_called, once);
        });
        destroy_future.before_events(before_events_callback);
        destroy_future.after_events(after_events_callback);

        post.simulate_success({primary: [null], secondary: []});

        expect(remove_callback).to(have_been_called, once);

        expect(Blog.find('recipes')).to(be_null);

        expect(before_events_callback).to(have_been_called);
        expect(after_events_callback).to(have_been_called);
      });
    });

    describe("#start_batch() and #finish_batch()", function() {
      use_local_fixtures();
      var jan, wil, recipes, motorcycle, records_from_insert_events, records_from_update_events, records_from_remove_events, original_global_server;
      var insert_callback, update_callback, remove_callback, before_events_callback, after_events_callback;

      before(function() {
        server.posts = [];
        server.post = FakeServer.prototype.post;

        jan = User.find('jan');
        wil = User.find('wil');
        recipes = Blog.find('recipes');
        motorcycle = Blog.find('motorcycle');

        insert_callback = mock_function("insert_callback");
        update_callback = mock_function("update_callback");
        remove_callback = mock_function("remove_callback");

        User.on_insert(insert_callback);
        User.on_update(update_callback);
        User.on_remove(remove_callback);
        Blog.on_insert(insert_callback);
        Blog.on_update(update_callback);
        Blog.on_remove(remove_callback);
      });

      function expect_no_events_to_have_fired() {
        expect(insert_callback).to_not(have_been_called);
        expect(update_callback).to_not(have_been_called);
        expect(remove_callback).to_not(have_been_called);
      }

      function expect_all_events_to_have_fired() {
        expect(insert_callback).to(have_been_called, twice);
        expect(update_callback).to(have_been_called, twice);
        expect(remove_callback).to(have_been_called, twice);
      }

      context("when the server response indicates success", function() {
        they("cause all mutations occurring between the calls to be batched together in a single web request, firing the appropriate callbacks for all of them once they are complete", function() {
          var before_events_callback_count = 0;
          var after_events_callback_count = 0;

          server.start_batch();

          server.create(User.table, {full_name: "Stephanie Wambach"})
            .before_events(function(user) {
              expect(user.id()).to(equal, "stephanie");
              expect(user.full_name()).to(equal, "Stephanie Anne Wambach");
              expect_no_events_to_have_fired();
              before_events_callback_count++;
            })
            .after_events(function(user) {
              expect(user.id()).to(equal, "stephanie");
              expect_all_events_to_have_fired();
              after_events_callback_count++;
            });

          server.create(Blog.table, {name: "Bandwidth to Burn"})
            .before_events(function(blog) {
              expect(blog.id()).to(equal, "bandwidth");
              expect_no_events_to_have_fired();
              before_events_callback_count++;
            })
            .after_events(function(blog) {
              expect(blog.id()).to(equal, "bandwidth");
              expect_all_events_to_have_fired();
              after_events_callback_count++;
            });


          jan.full_name("Jan Christian Nelson");
          server.save(jan)
            .before_events(function(record) {
              expect(record).to(equal, jan);
              expect_no_events_to_have_fired();
              before_events_callback_count++;
            })
            .after_events(function(record) {
              expect(record).to(equal, jan);
              expect_all_events_to_have_fired();
              after_events_callback_count++;
            });

          recipes.name("Disgusting Recipes Involving Pork")
          server.save(recipes)
            .before_events(function(record) {
              expect(record).to(equal, recipes);
              expect_no_events_to_have_fired();
              before_events_callback_count++;
            })
            .after_events(function(record) {
              expect(record).to(equal, recipes);
              expect_all_events_to_have_fired();
              after_events_callback_count++;
            });

          server.destroy(wil)
            .before_events(function(record) {
              expect(record).to(equal, wil);
              expect_no_events_to_have_fired();
              before_events_callback_count++;
            })
            .after_events(function(record) {
              expect(record).to(equal, wil);
              expect_all_events_to_have_fired();
              after_events_callback_count++;
            });

          server.destroy(motorcycle)
            .before_events(function(record) {
              expect(record).to(equal, motorcycle);
              expect_no_events_to_have_fired();
              before_events_callback_count++;
            })
            .after_events(function(record) {
              expect(record).to(equal, motorcycle);
              expect_all_events_to_have_fired();
              after_events_callback_count++;
            });

          expect(before_events_callback_count).to(equal, 0);
          expect(after_events_callback_count).to(equal, 0);
          expect(server.posts).to(be_empty);

          server.finish_batch();

          expect(server.pending_commands).to(equal, {});

          expect(server.posts.length).to(equal, 1);
          var post = server.posts.shift();

          expect(post.url).to(equal, Repository.origin_url);
          expect(post.data).to(equal, {
            operations: [
              ['create', 'users', { full_name: "Stephanie Wambach" }],
              ['create', 'blogs', { name: "Bandwidth to Burn" }],
              ['update', 'users', 'jan', { full_name: "Jan Christian Nelson" }],
              ['update', 'blogs', 'recipes', { name: "Disgusting Recipes Involving Pork" }],
              ['destroy', 'users', 'wil'],
              ['destroy', 'blogs', 'motorcycle']
            ]
          });

          post.simulate_success({
            primary: [{ id: "stephanie", full_name: "Stephanie Anne Wambach" },
                      { id: "bandwidth", name: "Bandwidth to Burn" },
                      { full_name: "Jan Christian Nelson" },
                      { name: "Disgusting Recipes Involving Pork" },
                      null,
                      null
                    ],
            secondary: []
          });

          expect(before_events_callback_count).to(equal, 6);
          expect(after_events_callback_count).to(equal, 6);
          expect(server.pending_commands).to(equal, {});
        });
      });

      context("when the server response indicates failure", function() {
        they("does not perform the changes and invokes the failure callbacks for every operation, giving the invalid operation's callback an invalid record", function() {
          server.start_batch();

          var create_failure_callback = mock_function("create failure callback", function(record) {
            expect(record.valid()).to(be_true);
          });
          var update_failure_callback = mock_function("update failure callback", function(record) {
            expect(record.valid()).to(be_false);
            expect(record.name()).to(equal, 'Potatoes For Every Meal');
            expect(record.field('name').validation_errors).to(equal, ["You can't eat potatoes that much!"]);
          });
          var destroy_failure_callback = mock_function("destroy failure callback", function(record) {
            expect(record.valid()).to(be_true);
          });

          server.destroy(wil).on_failure(destroy_failure_callback);
          recipes.name('Potatoes For Every Meal');
          server.update(recipes).on_failure(update_failure_callback);
          server.create(User.table, {full_name: "Penelope Cruz"}).on_failure(create_failure_callback);

          server.finish_batch();

          server.last_post.simulate_failure({
            index: 1,
            errors: {
              name: ["You can't eat potatoes that much!"]
            }
          });

          expect(create_failure_callback).to(have_been_called);
          expect(update_failure_callback).to(have_been_called);
          expect(destroy_failure_callback).to(have_been_called, with_args(wil));
        });
      });
    });

    describe("request methods", function() {
      var request_method;

      scenario(".post(url, data)", function() {
        init(function() {
          request_method = 'post';
        });
      });

      scenario(".get(url, data)", function() {
        init(function() {
          request_method = 'get';
        });
      });

      scenario(".put(url, data)", function() {
        init(function() {
          request_method = 'put';
        });
      });

      scenario(".delete(url, data)", function() {
        init(function() {
          request_method = 'delete_';
        });
      });

      it("calls jQuery.ajax with the correct request type, returning an AjaxFuture whose #handle_response method is called upon receiving a response", function() {
        mock(jQuery, 'ajax');

        var data = {
          foo: {
            bar: "baz",
            quux: 1
          },
          baz: "hello",
          corge: [1, 2],
          grault: 1
        };

        var future = server[request_method].call(server, "/users", data);

        expect(jQuery.ajax).to(have_been_called, once);

        var ajax_options = jQuery.ajax.most_recent_args[0];
        expect(ajax_options.type).to(equal, request_method.toUpperCase().replace("_", ""));
        expect(ajax_options.dataType).to(equal, 'json');

        // data is url-encoded and appended as params for delete requests
        if (request_method == "delete_") {
          expect(ajax_options.url).to(equal, '/users?' + jQuery.param(server.stringify_json_data(data)));
          expect(ajax_options.data).to(be_null);
        } else {
          expect(ajax_options.url).to(equal, '/users');
          expect(JSON.parse(ajax_options.data.foo)).to(equal, data.foo);
          expect(ajax_options.data.baz).to(equal, data.baz);
          expect(JSON.parse(ajax_options.data.corge)).to(equal, data.corge);
          expect(JSON.parse(ajax_options.data.grault)).to(equal, data.grault);
        }


        expect(future.constructor).to(equal, Monarch.Http.AjaxFuture);

        mock(future, 'handle_response');

        var response_json = {
          success: true,
          data: {
            foo: "bar"
          }
        };
        ajax_options.success(response_json);
        expect(future.handle_response).to(have_been_called, with_args(response_json));
      });
    });
  });
}});
