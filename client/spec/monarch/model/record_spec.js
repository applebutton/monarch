//= require "../../monarch_spec_helper"

Screw.Unit(function(c) { with(c) {
  describe("Model.Record", function() {
    use_local_fixtures();

    describe("when a subsconstructor is declared", function() {
      it("associates the subconstructor with a Table whose #global_name is the underscored subconstructor name", function() {
        var table = Blog.table;
        expect(table.constructor).to(equal, Model.Relations.Table);
        expect(table.global_name).to(equal, "blogs");
        expect(table.record_constructor).to(equal, Blog);
      });

      it("automatically gives the subconstructor an 'id' Column with a type of 'string'", function() {
        expect(Blog.id).to(be_an_instance_of, Model.Column);
        expect(Blog.id.name).to(equal, "id");
        expect(Blog.id.type).to(equal, "string");
      });

      it("is registered in Repository, and has its table registered in Repository.tables by its global_name", function() {
        expect(Repository.tables.blogs).to(equal, Blog.table);
      });
    });

    describe(".column(name, type)", function() {
      before(function() {
        delete window['Blog'];
        ModuleSystem.constructor("Blog", Model.Record);
        Blog.column("user_id", "string");
      });

      it("calls #define_column on its #table, assigning the returned Column to a constructor property", function() {
        expect(Blog.user_id).to(equal, Blog.table.columns_by_name.user_id);
      });

      it("generates a method on .prototype that accesses the field corresponding to the prototype", function() {
        var record = new Blog();

        var field = record.fields_by_column_name.user_id;
        expect(field.value()).to(be_undefined);
        expect(record.user_id("jan")).to(equal, "jan");
        expect(field.value()).to(equal, "jan");
        expect(record.user_id()).to(equal, "jan");
      });
    });

    describe(".columns(column_definitions)", function() {
      it("calls .column for every column-name/value pair in the given hash", function() {
        mock(Blog, 'column');

        Blog.columns({
          id: "string",
          name: "string"
        });

        expect(Blog.column).to(have_been_called, twice);
        expect(Blog.column.call_args[0]).to(equal, ['id', 'string']);
        expect(Blog.column.call_args[1]).to(equal, ['name', 'string']);
      });
    });

    describe(".relates_to_many(name, definition)", function() {
      it("associates a method with the relation returned by the definition function", function() {
        var user = User.find('jan');
        var relation = user.blogs2();
        expect(relation.predicate).to(equal, Blog.user_id.eq("jan"));
      });
    });

    describe(".has_many(plural_target_table_name)", function() {
      it("uses .relates_to_many to make a has-many relation", function() {
        var user = User.find('jan');
        var relation = user.blogs();
        expect(relation.predicate).to(equal, Blog.user_id.eq("jan"));
      });

      context("if a single 'order_by' column is supplied in the options", function() {
        it("constructs an ordered has_many relation ordered by that one column", function() {
          User.has_many('blogs', { order_by: "name desc" });
          var user = User.local_create({id: "jerry"});
          var ordering = user.blogs();
          expect(ordering.constructor).to(equal, Model.Relations.Ordering);
          expect(ordering.order_by_columns[0].column).to(equal, Blog.name);
          expect(ordering.order_by_columns[0].direction).to(equal, "desc");
        });
      });

      context("if multiple 'order_by' columns are supplied in the options", function() {
        it("constructs an ordered has_many relation ordered by those columns", function() {
          User.has_many('blogs', { order_by: ["name desc", "user_id"]});
          var user = User.local_create({id: "jerry"});
          var ordering = user.blogs();
          expect(ordering.constructor).to(equal, Model.Relations.Ordering);
          expect(ordering.order_by_columns.length).to(equal, 2);
          expect(ordering.order_by_columns[0].column).to(equal, Blog.name);
          expect(ordering.order_by_columns[0].direction).to(equal, "desc");
          expect(ordering.order_by_columns[1].column).to(equal, Blog.user_id);
          expect(ordering.order_by_columns[1].direction).to(equal, "asc");
        });
      });
    });
    
//    describe(".create(field_values)", function() {
//      context("when Server.create responds successfully", function() {
//        it("calls .local_create with the field values returned by the remote repository and triggers success callbacks with the result", function() {
//          var remote_create_future = new Http.AjaxFuture();
//          mock(Server, 'remote_create', function() {
//            return remote_create_future;
//          });
//
//          var create_future = Blog.create({ name: "Recipes" });
//          expect(Server.create).to(have_been_called, with_args(Blog.table, { name: "Recipes" }));
//          
//          remote_create_future.trigger_success({id: 'recipes', name: 'Recipes'});
//
//          expect(create_future.successful).to(be_true);
//          expect(create_future.data).to(equal, mock_local_create_result);
//        });
//      });
//    });
    
    describe(".local_create(field_values)", function() {
      it("builds an instance of the Record with the given field_values and inserts it in .table before returning it", function() {
        mock(Blog.table, 'insert');
        var record = Blog.local_create({
          id: 'recipes',
          name: 'Recipes'
        });
        expect(Blog.table.insert).to(have_been_called, with_args(record));
        expect(record.id()).to(equal, 'recipes');
        expect(record.name()).to(equal, 'Recipes');
      });

      it("does not trigger update events on its Table", function() {
        var update_callback = mock_function("update callback");
        Blog.table.on_update(update_callback);

        var record = Blog.local_create({
          id: 'recipes',
          name: 'Recipes'
        });

        expect(update_callback).to_not(have_been_called);
      });
    });

    describe("#initialize(field_values_by_column_name={})", function() {
      it("instantiates a Field in #fields_by_column_name for each Column on the constructor's .table", function() {
        var record = new Blog();

        var name_field = record.fields_by_column_name.name;
        var user_id_field = record.fields_by_column_name.user_id;

        expect(name_field).to(be_an_instance_of, Model.Field);
        expect(name_field.record).to(equal, record);
        expect(name_field.column).to(equal, Blog.name);

        expect(user_id_field).to(be_an_instance_of, Model.Field);
        expect(user_id_field.record).to(equal, record);
        expect(user_id_field.column).to(equal, Blog.user_id);
      });

      it("assigns the given field values to their respective Fields", function() {
        var record = new Blog({
          id: "recipes",
          name: "Recipes"
        });

        expect(record.id()).to(equal, "recipes");
        expect(record.name()).to(equal, "Recipes");
      });
    });

    describe("#destroy", function() {
      it("removes the Record from its Table", function() {
        var record = User.find('jan');
        record.destroy();
        expect(User.find('jan')).to(be_null);
      });
    });
    
    describe("#local_update(values_by_method)", function() {
      it("calls setter methods for each key in the given hash and calls #record_updated on its Table with all the changed attributes", function() {
        var record = Blog.find('recipes');
        record.other_method = mock_function('other method');

        mock(record.table(), 'record_updated');

        record.local_update({
          id: 'recipes',
          name: 'Pesticides',
          user_id: 'jan',
          other_method: 'foo'
        });

        expect(record.name()).to(equal, 'Pesticides');
        expect(record.user_id()).to(equal, 'jan');
        expect(record.other_method).to(have_been_called, with_args('foo'));

        expect(record.table().record_updated).to(have_been_called, with_args(record, {
          name: {
            column: Blog.name,
            old_value: 'Recipes from the Front',
            new_value: 'Pesticides'
          },
          user_id: {
            column: Blog.user_id,
            old_value: 'mike',
            new_value: 'jan'
          }
        }));
      });
    });

    describe("column accessor functions", function() {
      they("call #record_updated on the Record's table when a new value is assigned", function() {
        var record = Blog.find('recipes');
        mock(record.table(), 'record_updated');

        record.name('Pesticides');

        expect(record.table().record_updated).to(have_been_called, with_args(record, {
          name: {
            column: Blog.name,
            old_value: 'Recipes from the Front',
            new_value: 'Pesticides'
          }
        }));

        record.table().record_updated.clear();

        record.name('Pesticides');
        expect(record.table().record_updated).to_not(have_been_called);
      });
    });

    describe("#field", function() {
      it("returns the field for the given column name or Column", function() {
        var record = Blog.find('recipes');

        var field = record.field(Blog.id);
        expect(field.record).to(equal, record);
        expect(field.column).to(equal, Blog.id);

        field = record.field('id');
        expect(field.record).to(equal, record);
        expect(field.column).to(equal, Blog.id);
      });
    });

    describe("#wire_representation", function() {
      it("returns the field values by column name", function() {
        var record = Blog.find('recipes');

        expect(record.wire_representation()).to(equal, {
          id: 'recipes',
          name: 'Recipes from the Front',
          user_id: 'mike'
        });
      });
    });
  });
}});
