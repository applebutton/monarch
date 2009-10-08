//= require "../../../monarch_spec_helper"

Screw.Unit(function(c) { with(c) {
  describe("Model.Relations.Relation (abstract superclass)", function() {
    use_local_fixtures();
    var relation, insert, column_1, column_2;

    scenario("Table subclass", function() {
      init(function() {
        relation = Blog.table;
        insert = function(record) {
          Blog.table.insert(record);
        }
        column_1 = Blog.user_id;
        column_2 = Blog.name;
      })
    });

    scenario("Selection subclass", function() {
      init(function() {
        relation = Blog.where(Blog.user_id.eq("jan"));
        insert = function(record) {
          Blog.table.insert(record);
        }
        column_1 = Blog.user_id;
        column_2 = Blog.name;
      })
    });

    describe("#fetch()", function() {
      it("calls Server.fetch with itself", function() {
        mock(Server, 'fetch', function() { return "mock future"; });
        expect(relation.fetch()).to(equal, "mock future");
        expect(Server.fetch).to(have_been_called, once);
        expect(Server.fetch).to(have_been_called, with_args([relation]));
      });
    });

    describe("#contains(record)", function() {
      it("returns true if the relation has the record and false otherwise", function() {
        record = new Blog({user_id: "jan"});
        expect(relation.contains(record)).to(be_false);
        insert(record);
        expect(relation.contains(record)).to(be_true);
      });
    });

    describe("#where(predicate)", function() {
      it("returns a Selection with the receiver as its #operand and the given predicate as its #predicate", function() {
        var predicate = Blog.user_id.eq('The Pain of Motorcycle Maintenance');
        var selection = relation.where(predicate);
        expect(selection.constructor).to(equal, Model.Relations.Selection);
        expect(selection.operand).to(equal, relation);
        expect(selection.predicate).to(equal, predicate);
      });
    });

    describe("#order_by(order_by_columns...)", function() {
      context("when passed OrderByColumns", function() {
        it("builds an Ordering relation with the receiver as its #operand and the given #order_by_columns", function() {
          var ordering = relation.order_by(column_1.asc(), column_2.desc());
          expect(ordering.order_by_columns[0].column).to(equal, column_1);
          expect(ordering.order_by_columns[0].direction).to(equal, "asc");
          expect(ordering.order_by_columns[1].column).to(equal, column_2);
          expect(ordering.order_by_columns[1].direction).to(equal, "desc");
        });
      });

      context("when passed naked Columns", function() {
        it("builds an Ordering relation with the receiver as its #operand and defaults the OrderByColumns to ascending", function() {
          var ordering = relation.order_by(column_1, column_2);
          expect(ordering.order_by_columns[0].column).to(equal, column_1);
          expect(ordering.order_by_columns[0].direction).to(equal, "asc");
          expect(ordering.order_by_columns[1].column).to(equal, column_2);
          expect(ordering.order_by_columns[1].direction).to(equal, "asc");
        });
      });

      context("when passed strings", function() {
        it("builds an Ordering relation with the receiver as its #operand and defaults the OrderByColumns to ascending", function() {
          var ordering = relation.order_by(column_1.name + " asc", column_2.name + " desc");
          expect(ordering.order_by_columns[0].column).to(equal, column_1);
          expect(ordering.order_by_columns[0].direction).to(equal, "asc");
          expect(ordering.order_by_columns[1].column).to(equal, column_2);
          expect(ordering.order_by_columns[1].direction).to(equal, "desc");
        });
      });
    });

    describe("#project(projected_columns...)", function() {
      context("when passed ProjectedColumns", function() {
        it("constructs a Projection with self as #operand and the given ProjectedColumns", function() {
          projected_column_1 = column_1.as('a');
          projected_column_2 = column_2.as('b');
          var projection = relation.project(projected_column_1, projected_column_2);

          expect(projection).to(be_an_instance_of, Model.Relations.Projection);
          expect(projection.operand).to(equal, relation);
          expect(projection.projected_columns_by_name['a']).to(equal, projected_column_1);
          expect(projection.projected_columns_by_name['b']).to(equal, projected_column_2);
        });
      });

      context("when passed Columns", function() {
        it("constructs a Projection with self as #operand and the given Columns converted to ProjectedColumns", function() {
          var projection = relation.project(column_1, column_2);
          expect(projection).to(be_an_instance_of, Model.Relations.Projection);
          expect(projection.operand).to(equal, relation);
          expect(projection.projected_columns_by_name[column_1.name].column).to(equal, column_1);
          expect(projection.projected_columns_by_name[column_2.name].column).to(equal, column_2);
        });
      });
    });
  });
}});
